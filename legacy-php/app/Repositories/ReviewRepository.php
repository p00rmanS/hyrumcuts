<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class ReviewRepository
{
    public function approved(): array
    {
        return Database::connection()
            ->query('SELECT * FROM reviews WHERE is_approved = 1 ORDER BY display_order ASC, id ASC')
            ->fetchAll();
    }

    public function all(): array
    {
        return Database::connection()
            ->query('SELECT * FROM reviews ORDER BY display_order ASC, id ASC')
            ->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM reviews WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function create(array $data): int
    {
        $pdo = Database::connection();
        $order = (int) $pdo->query('SELECT COALESCE(MAX(display_order), -1) + 1 FROM reviews')->fetchColumn();
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $pdo->prepare(
            'INSERT INTO reviews (client_label, quote, haircut_type, is_approved, display_order, created_at, updated_at)
             VALUES (:label, :quote, :type, :approved, :order, :now, :now)'
        );
        $stmt->execute([
            'label' => $data['client_label'],
            'quote' => $data['quote'],
            'type' => $data['haircut_type'] !== '' ? $data['haircut_type'] : null,
            'approved' => $data['is_approved'] ? 1 : 0,
            'order' => $order,
            'now' => $now,
        ]);
        return (int) $pdo->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE reviews SET client_label = :label, quote = :quote, haircut_type = :type, is_approved = :approved, updated_at = :now
             WHERE id = :id'
        );
        $stmt->execute([
            'label' => $data['client_label'],
            'quote' => $data['quote'],
            'type' => $data['haircut_type'] !== '' ? $data['haircut_type'] : null,
            'approved' => $data['is_approved'] ? 1 : 0,
            'now' => gmdate('Y-m-d H:i:s'),
            'id' => $id,
        ]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM reviews WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }
}
