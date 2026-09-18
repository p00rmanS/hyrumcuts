<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'name' => Env::get('APP_NAME', 'HyrumHaircuts'),
    'env' => Env::get('APP_ENV', 'production'),
    'debug' => (bool) Env::get('APP_DEBUG', false),
    'url' => rtrim((string) Env::get('APP_URL', 'http://localhost:8000'), '/'),
    'timezone' => Env::get('APP_TIMEZONE', 'UTC'),
    'key' => Env::get('APP_KEY', ''),
    'session_secure_cookie' => (bool) Env::get('SESSION_SECURE_COOKIE', false),
];
