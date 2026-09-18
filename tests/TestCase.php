<?php

declare(strict_types=1);

namespace Tests;

use App\Core\Database;
use App\Core\Migrator;
use App\Core\Session;
use PHPUnit\Framework\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Fresh in-memory database per test so tests never see each other's data.
        Database::reset();
        (new Migrator(Database::connection()))->run(dirname(__DIR__) . '/database/migrations');

        // A real (if cookieless) session per test, matching production where
        // Session::start() always runs before a controller does — this keeps
        // things like Auth::attempt()'s session_regenerate_id() call valid.
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        session_id(bin2hex(random_bytes(16)));
        session_start();
    }

    protected function tearDown(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $_SESSION = [];
        parent::tearDown();
    }
}
