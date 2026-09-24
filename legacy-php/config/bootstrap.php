<?php

declare(strict_types=1);

use App\Core\Env;

define('BASE_PATH', dirname(__DIR__));

require BASE_PATH . '/vendor/autoload.php';

Env::load(BASE_PATH . '/.env');

date_default_timezone_set((string) Env::get('APP_TIMEZONE', 'UTC'));

$config = [
    'app' => require BASE_PATH . '/config/app.php',
    'database' => require BASE_PATH . '/config/database.php',
    'mail' => require BASE_PATH . '/config/mail.php',
    'booking' => require BASE_PATH . '/config/booking.php',
];

if ($config['app']['debug']) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL);
}

ini_set('log_errors', '1');
ini_set('error_log', BASE_PATH . '/storage/logs/php-error.log');

return $config;
