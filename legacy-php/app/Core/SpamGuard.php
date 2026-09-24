<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Lightweight, dependency-free spam defenses for public forms: a honeypot
 * field bots fill in but humans never see, plus a signed timing token that
 * rejects submissions completed implausibly fast. Neither requires a paid
 * captcha service.
 */
final class SpamGuard
{
    private const MIN_SECONDS = 3;
    private const MAX_SECONDS = 3600;

    public static function honeypotField(): string
    {
        // Hidden via the CSS layer (not just an inline style, so a bot
        // scraping only inline attributes still can't tell it's a trap).
        return '<div class="hp-field" aria-hidden="true">' .
            '<label for="website">Leave this field empty</label>' .
            '<input type="text" id="website" name="website" tabindex="-1" autocomplete="off">' .
            '</div>';
    }

    public static function honeypotTripped(Request $request): bool
    {
        return trim((string) $request->input('website', '')) !== '';
    }

    public static function timingField(): string
    {
        $timestamp = time();
        $signature = self::sign($timestamp);
        return '<input type="hidden" name="form_issued" value="' . $timestamp . '.' . $signature . '">';
    }

    public static function timingValid(Request $request): bool
    {
        $raw = (string) $request->input('form_issued', '');
        if (!str_contains($raw, '.')) {
            return false;
        }
        [$timestamp, $signature] = explode('.', $raw, 2);
        if (!ctype_digit($timestamp) || !hash_equals(self::sign((int) $timestamp), $signature)) {
            return false;
        }

        $elapsed = time() - (int) $timestamp;
        return $elapsed >= self::MIN_SECONDS && $elapsed <= self::MAX_SECONDS;
    }

    private static function sign(int $timestamp): string
    {
        $key = (string) Config::get('app.key', '');
        return hash_hmac('sha256', (string) $timestamp, $key);
    }
}
