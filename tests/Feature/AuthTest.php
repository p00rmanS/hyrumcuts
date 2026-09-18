<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Core\Auth;
use App\Core\Database;
use Tests\TestCase;

final class AuthTest extends TestCase
{
    private function createAdmin(string $email = 'hyrum@example.com', string $password = 'CorrectHorseBattery9'): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO admins (name, email, password_hash, created_at, updated_at) VALUES (:name, :email, :hash, :now, :now)'
        );
        $stmt->execute([
            'name' => 'Hyrum',
            'email' => $email,
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'now' => gmdate('Y-m-d H:i:s'),
        ]);
    }

    public function test_attempt_succeeds_with_correct_credentials(): void
    {
        $this->createAdmin();

        $this->assertTrue(Auth::attempt('hyrum@example.com', 'CorrectHorseBattery9'));
        $this->assertTrue(Auth::check());
    }

    public function test_attempt_fails_with_wrong_password(): void
    {
        $this->createAdmin();

        $this->assertFalse(Auth::attempt('hyrum@example.com', 'wrong-password'));
        $this->assertFalse(Auth::check());
    }

    public function test_attempt_fails_for_unknown_email(): void
    {
        $this->createAdmin();

        $this->assertFalse(Auth::attempt('nobody@example.com', 'whatever'));
    }

    public function test_logout_clears_authentication(): void
    {
        $this->createAdmin();
        Auth::attempt('hyrum@example.com', 'CorrectHorseBattery9');

        Auth::logout();

        $this->assertFalse(Auth::check());
        $this->assertNull(Auth::id());
    }

    public function test_successful_login_regenerates_the_session_id(): void
    {
        // Guards against session fixation: a pre-login session id must not
        // still be valid/attached after authenticating.
        session_write_close();
        session_id('fixedattackerchosenid00000000000');
        session_start();
        $originalId = session_id();

        $this->createAdmin();
        Auth::attempt('hyrum@example.com', 'CorrectHorseBattery9');

        $this->assertNotSame($originalId, session_id());
    }
}
