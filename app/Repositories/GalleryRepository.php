<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class GalleryRepository
{
    // -- Categories ----------------------------------------------------

    public function categories(): array
    {
        return Database::connection()
            ->query('SELECT * FROM gallery_categories ORDER BY display_order ASC, name ASC')
            ->fetchAll();
    }

    public function findCategory(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM gallery_categories WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function createCategory(string $name, string $slug): int
    {
        $pdo = Database::connection();
        $order = (int) $pdo->query('SELECT COALESCE(MAX(display_order), -1) + 1 FROM gallery_categories')->fetchColumn();
        $stmt = $pdo->prepare(
            'INSERT INTO gallery_categories (slug, name, display_order, created_at, updated_at)
             VALUES (:slug, :name, :order, :now, :now)'
        );
        $stmt->execute(['slug' => $slug, 'name' => $name, 'order' => $order, 'now' => gmdate('Y-m-d H:i:s')]);
        return (int) $pdo->lastInsertId();
    }

    public function updateCategory(int $id, string $name, string $slug): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE gallery_categories SET name = :name, slug = :slug, updated_at = :now WHERE id = :id'
        );
        $stmt->execute(['name' => $name, 'slug' => $slug, 'now' => gmdate('Y-m-d H:i:s'), 'id' => $id]);
    }

    public function deleteCategory(int $id): bool
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM gallery_items WHERE category_id = :id');
        $stmt->execute(['id' => $id]);
        if ((int) $stmt->fetchColumn() > 0) {
            return false; // Refuse to delete a category that still has items.
        }
        $del = $pdo->prepare('DELETE FROM gallery_categories WHERE id = :id');
        $del->execute(['id' => $id]);
        return true;
    }

    // -- Items -----------------------------------------------------------

    /** Public-facing items, optionally filtered by category slug, with media attached. */
    public function publicItems(?string $categorySlug = null): array
    {
        $pdo = Database::connection();
        $sql = 'SELECT gi.*, gc.slug AS category_slug, gc.name AS category_name
                FROM gallery_items gi
                JOIN gallery_categories gc ON gc.id = gi.category_id';
        $params = [];
        if ($categorySlug !== null) {
            $sql .= ' WHERE gc.slug = :slug';
            $params['slug'] = $categorySlug;
        }
        $sql .= ' ORDER BY gi.display_order ASC, gi.id ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        return $this->attachMedia($items);
    }

    public function adminItems(): array
    {
        $items = Database::connection()->query(
            'SELECT gi.*, gc.name AS category_name
             FROM gallery_items gi
             JOIN gallery_categories gc ON gc.id = gi.category_id
             ORDER BY gi.display_order ASC, gi.id ASC'
        )->fetchAll();

        return $this->attachMedia($items);
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM gallery_items WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $item = $stmt->fetch();
        if ($item === false) {
            return null;
        }
        $withMedia = $this->attachMedia([$item]);
        return $withMedia[0];
    }

    private function attachMedia(array $items): array
    {
        if ($items === []) {
            return [];
        }

        $ids = array_column($items, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT * FROM gallery_media WHERE gallery_item_id IN ($placeholders) ORDER BY display_order ASC, id ASC"
        );
        $stmt->execute($ids);
        $media = $stmt->fetchAll();

        $byItem = [];
        foreach ($media as $row) {
            $byItem[(int) $row['gallery_item_id']][$row['role']] = $row;
        }

        foreach ($items as &$item) {
            $item['media'] = $byItem[(int) $item['id']] ?? [];
        }

        return $items;
    }

    public function create(array $data): int
    {
        $pdo = Database::connection();
        $order = (int) $pdo->query('SELECT COALESCE(MAX(display_order), -1) + 1 FROM gallery_items')->fetchColumn();
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $pdo->prepare(
            'INSERT INTO gallery_items (category_id, title, description, alt_text, is_featured, is_transformation, display_order, created_at, updated_at)
             VALUES (:category_id, :title, :description, :alt_text, :featured, :transformation, :order, :now, :now)'
        );
        $stmt->execute([
            'category_id' => $data['category_id'],
            'title' => $data['title'],
            'description' => $data['description'] !== '' ? $data['description'] : null,
            'alt_text' => $data['alt_text'],
            'featured' => $data['is_featured'] ? 1 : 0,
            'transformation' => $data['is_transformation'] ? 1 : 0,
            'order' => $order,
            'now' => $now,
        ]);

        return (int) $pdo->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE gallery_items SET category_id = :category_id, title = :title, description = :description,
                alt_text = :alt_text, is_featured = :featured, is_transformation = :transformation, updated_at = :now
             WHERE id = :id'
        );
        $stmt->execute([
            'category_id' => $data['category_id'],
            'title' => $data['title'],
            'description' => $data['description'] !== '' ? $data['description'] : null,
            'alt_text' => $data['alt_text'],
            'featured' => $data['is_featured'] ? 1 : 0,
            'transformation' => $data['is_transformation'] ? 1 : 0,
            'now' => gmdate('Y-m-d H:i:s'),
            'id' => $id,
        ]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM gallery_items WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public function reorder(array $orderedIds): void
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare('UPDATE gallery_items SET display_order = :order WHERE id = :id');
        $pdo->beginTransaction();
        try {
            foreach ($orderedIds as $position => $id) {
                $stmt->execute(['order' => $position, 'id' => (int) $id]);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function saveMedia(int $itemId, string $role, string $path, ?int $width, ?int $height): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO gallery_media (gallery_item_id, role, image_path, width, height, display_order, created_at)
             VALUES (:item_id, :role, :path, :width, :height, 0, :now)
             ON CONFLICT(gallery_item_id, role) DO UPDATE SET image_path = excluded.image_path, width = excluded.width, height = excluded.height'
        );
        $stmt->execute([
            'item_id' => $itemId,
            'role' => $role,
            'path' => $path,
            'width' => $width,
            'height' => $height,
            'now' => gmdate('Y-m-d H:i:s'),
        ]);
    }
}
