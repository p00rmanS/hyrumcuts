<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\Database;
use App\Core\Migrator;

putenv('APP_ENV=testing');
putenv('APP_DEBUG=true');
putenv('APP_KEY=test-key-not-for-production-0123456789abcdef');
putenv('DB_CONNECTION=sqlite');
putenv('DB_DATABASE=:memory:');
putenv('MAIL_DRIVER=log');

$config = require dirname(__DIR__) . '/config/bootstrap.php';
require dirname(__DIR__) . '/app/Core/helpers.php';
Config::set($config);

(new Migrator(Database::connection()))->run(dirname(__DIR__) . '/database/migrations');
