<?php

declare(strict_types=1);

namespace App\Core;

use App\Repositories\AdminRepository;

final class Auth
{
    private const SESSION_KEY = 'admin_id';

    public static function attempt(string $email, string $password): bool
    {
        $admin = (new AdminRepository())->findByEmail($email);
        if (!$admin || !password_verify($password, $admin['password_hash'])) {
            return false;
        }

        // Regenerate before storing identity to prevent session fixation.
        Session::regenerate();
        Session::put(self::SESSION_KEY, (int) $admin['id']);

        if (password_needs_rehash($admin['password_hash'], PASSWORD_DEFAULT)) {
            (new AdminRepository())->updatePasswordHash((int) $admin['id'], password_hash($password, PASSWORD_DEFAULT));
        }

        return true;
    }

    public static function logout(): void
    {
        Session::forget(self::SESSION_KEY);
        Session::regenerate();
    }

    public static function check(): bool
    {
        return Session::get(self::SESSION_KEY) !== null;
    }

    public static function id(): ?int
    {
        $id = Session::get(self::SESSION_KEY);
        return $id === null ? null : (int) $id;
    }

    public static function user(): ?array
    {
        $id = self::id();
        if ($id === null) {
            return null;
        }
        return (new AdminRepository())->findById($id);
    }
}
