<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\Database;
use App\Core\Migrator;

$config = require dirname(__DIR__) . '/config/bootstrap.php';
Config::set($config);

$migrator = new Migrator(Database::connection());
$ran = $migrator->run(dirname(__DIR__) . '/database/migrations');

if ($ran === []) {
    echo "No new migrations to run. Database is up to date.\n";
} else {
    echo count($ran) . " migration(s) applied:\n";
    foreach ($ran as $name) {
        echo "  - {$name}\n";
    }
}
