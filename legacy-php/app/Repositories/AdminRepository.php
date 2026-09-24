<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class AdminRepository
{
    public function findByEmail(string $email): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM admins WHERE email = :email');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM admins WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function updatePasswordHash(int $id, string $hash): void
    {
        $stmt = Database::connection()->prepare('UPDATE admins SET password_hash = :hash, updated_at = :now WHERE id = :id');
        $stmt->execute(['hash' => $hash, 'now' => gmdate('Y-m-d H:i:s'), 'id' => $id]);
    }

    public function count(): int
    {
        return (int) Database::connection()->query('SELECT COUNT(*) FROM admins')->fetchColumn();
    }
}
