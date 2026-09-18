<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Mailer facade. Defaults to a local "log" driver that writes .eml files to
 * storage/mail/ so nothing ever silently vanishes in development. Switch
 * MAIL_DRIVER=smtp and fill in MAIL_SMTP_* to send real mail in production.
 */
final class Mail
{
    public static function send(string $to, string $subject, string $textBody): bool
    {
        $driver = (string) Config::get('mail.driver', 'log');

        return match ($driver) {
            'smtp' => self::sendSmtp($to, $subject, $textBody),
            default => self::sendLog($to, $subject, $textBody),
        };
    }

    private static function sendLog(string $to, string $subject, string $textBody): bool
    {
        $dir = BASE_PATH . '/storage/mail';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $from = Config::get('mail.from_name') . ' <' . Config::get('mail.from_address') . '>';
        $filename = $dir . '/' . gmdate('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.eml';

        $eml = "From: {$from}\r\nTo: {$to}\r\nSubject: {$subject}\r\nDate: " . gmdate('r') . "\r\n\r\n{$textBody}\r\n";
        file_put_contents($filename, $eml);

        return true;
    }

    private static function sendSmtp(string $to, string $subject, string $textBody): bool
    {
        $cfg = Config::get('mail.smtp', []);
        if (empty($cfg['host'])) {
            error_log('Mail: SMTP driver selected but MAIL_SMTP_HOST is not configured; falling back to log driver.');
            return self::sendLog($to, $subject, $textBody);
        }

        $transport = ($cfg['encryption'] ?? 'tls') === 'ssl' ? 'ssl://' : '';
        $socket = @fsockopen($transport . $cfg['host'], (int) $cfg['port'], $errno, $errstr, 10);
        if (!$socket) {
            error_log("Mail: could not connect to SMTP host ({$errstr}); message not sent.");
            return false;
        }

        try {
            $read = static fn () => fgets($socket, 512);
            $write = static function (string $line) use ($socket): void {
                fwrite($socket, $line . "\r\n");
            };

            $read();
            $write('EHLO hyrumhaircuts.local');
            $read();

            if (($cfg['encryption'] ?? 'tls') === 'tls') {
                $write('STARTTLS');
                $read();
                stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                $write('EHLO hyrumhaircuts.local');
                $read();
            }

            if (!empty($cfg['username'])) {
                $write('AUTH LOGIN');
                $read();
                $write(base64_encode($cfg['username']));
                $read();
                $write(base64_encode($cfg['password']));
                $read();
            }

            $from = (string) Config::get('mail.from_address');
            $write("MAIL FROM:<{$from}>");
            $read();
            $write("RCPT TO:<{$to}>");
            $read();
            $write('DATA');
            $read();

            $fromHeader = Config::get('mail.from_name') . ' <' . $from . '>';
            $body = "From: {$fromHeader}\r\nTo: {$to}\r\nSubject: {$subject}\r\n" .
                "Content-Type: text/plain; charset=utf-8\r\n\r\n{$textBody}\r\n.";
            $write($body);
            $read();
            $write('QUIT');
        } finally {
            fclose($socket);
        }

        return true;
    }
}
