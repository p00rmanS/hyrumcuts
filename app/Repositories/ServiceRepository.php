<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class ServiceRepository
{
    public function active(): array
    {
        return Database::connection()
            ->query('SELECT * FROM services WHERE is_active = 1 ORDER BY display_order ASC, id ASC')
            ->fetchAll();
    }

    public function all(): array
    {
        return Database::connection()
            ->query('SELECT * FROM services ORDER BY display_order ASC, id ASC')
            ->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM services WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function create(array $data): int
    {
        $pdo = Database::connection();
        $order = (int) $pdo->query('SELECT COALESCE(MAX(display_order), -1) + 1 FROM services')->fetchColumn();
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $pdo->prepare(
            'INSERT INTO services (name, description, is_active, display_order, created_at, updated_at)
             VALUES (:name, :description, :active, :order, :now, :now)'
        );
        $stmt->execute([
            'name' => $data['name'],
            'description' => $data['description'] !== '' ? $data['description'] : null,
            'active' => $data['is_active'] ? 1 : 0,
            'order' => $order,
            'now' => $now,
        ]);
        return (int) $pdo->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE services SET name = :name, description = :description, is_active = :active, updated_at = :now WHERE id = :id'
        );
        $stmt->execute([
            'name' => $data['name'],
            'description' => $data['description'] !== '' ? $data['description'] : null,
            'active' => $data['is_active'] ? 1 : 0,
            'now' => gmdate('Y-m-d H:i:s'),
            'id' => $id,
        ]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM services WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }
}
