<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function redirect(string $to, int $status = 302): never
    {
        http_response_code($status);
        header('Location: ' . $to);
        exit;
    }

    public static function json(array $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function status(int $status): void
    {
        http_response_code($status);
    }

    /**
     * Single source of truth for security headers: sent by PHP at runtime and
     * also written to dist/_headers by bin/build-static.php for Netlify.
     *
     * @return array<string, string>
     */
    public static function headers(): array
    {
        return [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=()',
            'Content-Security-Policy' =>
                "default-src 'self'; " .
                "img-src 'self' data: https://assets.calendly.com https://*.calendly.com; " .
                "font-src 'self'; " .
                "style-src 'self' https://assets.calendly.com; " .
                "script-src 'self' https://assets.calendly.com; " .
                "frame-src https://calendly.com https://*.calendly.com; " .
                "connect-src 'self' https://calendly.com https://*.calendly.com; " .
                "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
        ];
    }

    public static function securityHeaders(): void
    {
        foreach (self::headers() as $name => $value) {
            header($name . ': ' . $value);
        }
    }
}
