<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\Csrf;

if (!function_exists('e')) {
    /** Escape a value for safe HTML output. */
    function e(mixed $value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('csrf_field')) {
    function csrf_field(): string
    {
        return Csrf::field();
    }
}

if (!function_exists('config')) {
    function config(string $key, mixed $default = null): mixed
    {
        return Config::get($key, $default);
    }
}

if (!function_exists('url')) {
    function url(string $path = ''): string
    {
        $base = rtrim((string) Config::get('app.url', ''), '/');
        return $base . '/' . ltrim($path, '/');
    }
}

if (!function_exists('asset')) {
    function asset(string $path): string
    {
        return '/' . ltrim($path, '/');
    }
}

if (!function_exists('old')) {
    /** Re-populate a form field from the previous failed submission. */
    function old(string $key, mixed $default = ''): mixed
    {
        static $cache = null;
        if ($cache === null) {
            $cache = App\Core\Session::get('_old_input', []);
        }
        return $cache[$key] ?? $default;
    }
}

if (!function_exists('calendly_attrs')) {
    /**
     * HTML attributes that turn a normal "Book a Haircut" link into a
     * Calendly popup trigger (see public/assets/js/modules/calendly-popup.js).
     * Returns an empty string when no Calendly URL is configured, so the
     * link just falls through to its plain href="/booking".
     */
    function calendly_attrs(string $calendlyUrl): string
    {
        if ($calendlyUrl === '') {
            return '';
        }
        return ' data-calendly-trigger data-calendly-url="' . e($calendlyUrl) . '"';
    }
}

if (!function_exists('errors')) {
    /** Validation errors from the previous failed submission, keyed by field. */
    function errors(?string $key = null): mixed
    {
        static $cache = null;
        if ($cache === null) {
            $cache = App\Core\Session::get('_errors', []);
        }
        return $key === null ? $cache : ($cache[$key] ?? null);
    }
}
