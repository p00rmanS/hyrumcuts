<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $driver = Config::get('database.connection', 'sqlite');

        self::$connection = $driver === 'mysql'
            ? self::connectMysql()
            : self::connectSqlite();

        self::$connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        self::$connection->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        self::$connection->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);

        if ($driver !== 'mysql') {
            self::$connection->exec('PRAGMA foreign_keys = ON');
            // NORMAL + WAL keeps concurrent readers/writers from stalling on
            // the single-file SQLite database used for portable installs.
            self::$connection->exec('PRAGMA journal_mode = WAL');
            self::$connection->exec('PRAGMA synchronous = NORMAL');
            self::$connection->exec('PRAGMA busy_timeout = 5000');
        }

        return self::$connection;
    }

    private static function connectSqlite(): PDO
    {
        $path = (string) Config::get('database.sqlite.path', 'storage/database/hyrumhaircuts.sqlite');

        if ($path !== ':memory:') {
            if (!str_starts_with($path, '/') && !preg_match('#^[A-Za-z]:[\\\\/]#', $path)) {
                $path = BASE_PATH . '/' . $path;
            }

            $dir = dirname($path);
            if (!is_dir($dir)) {
                mkdir($dir, 0775, true);
            }
        }

        try {
            return new PDO('sqlite:' . $path);
        } catch (PDOException $e) {
            throw new PDOException('Could not open SQLite database at ' . $path . ': ' . $e->getMessage(), (int) $e->getCode());
        }
    }

    private static function connectMysql(): PDO
    {
        $cfg = Config::get('database.mysql', []);
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $cfg['host'],
            $cfg['port'],
            $cfg['database']
        );

        return new PDO($dsn, $cfg['username'], $cfg['password'], [
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, sql_mode='STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION'",
        ]);
    }

    public static function driver(): string
    {
        return (string) Config::get('database.connection', 'sqlite');
    }

    /** Reset the cached connection. Only used by the test suite. */
    public static function reset(): void
    {
        self::$connection = null;
    }
}
