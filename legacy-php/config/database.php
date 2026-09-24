<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'connection' => Env::get('DB_CONNECTION', 'sqlite'),
    'sqlite' => [
        'path' => Env::get('DB_DATABASE', 'storage/database/hyrumhaircuts.sqlite'),
    ],
    'mysql' => [
        'host' => Env::get('DB_HOST', '127.0.0.1'),
        'port' => Env::get('DB_PORT', '3306'),
        'database' => Env::get('DB_MYSQL_DATABASE', 'hyrumhaircuts'),
        'username' => Env::get('DB_USERNAME', ''),
        'password' => Env::get('DB_PASSWORD', ''),
    ],
];
