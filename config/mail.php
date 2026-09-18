<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'driver' => Env::get('MAIL_DRIVER', 'log'),
    'from_address' => Env::get('MAIL_FROM_ADDRESS', 'no-reply@example.com'),
    'from_name' => Env::get('MAIL_FROM_NAME', 'HyrumHaircuts'),
    'owner_address' => Env::get('MAIL_OWNER_ADDRESS', ''),
    'smtp' => [
        'host' => Env::get('MAIL_SMTP_HOST', ''),
        'port' => (int) Env::get('MAIL_SMTP_PORT', 587),
        'encryption' => Env::get('MAIL_SMTP_ENCRYPTION', 'tls'),
        'username' => Env::get('MAIL_SMTP_USERNAME', ''),
        'password' => Env::get('MAIL_SMTP_PASSWORD', ''),
    ],
];
