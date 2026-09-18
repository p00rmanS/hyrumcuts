<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class SettingsRepository
{
    /** @return array<string, string> */
    public function all(): array
    {
        $stmt = Database::connection()->query('SELECT setting_key, setting_value FROM settings');
        $rows = $stmt->fetchAll();

        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
        return $settings;
    }

    public function get(string $key, string $default = ''): string
    {
        $stmt = Database::connection()->prepare('SELECT setting_value FROM settings WHERE setting_key = :key');
        $stmt->execute(['key' => $key]);
        $value = $stmt->fetchColumn();
        return $value === false ? $default : (string) $value;
    }

    public function set(string $key, string $value): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (:key, :value, :now)
             ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at'
        );
        $stmt->execute(['key' => $key, 'value' => $value, 'now' => gmdate('Y-m-d H:i:s')]);
    }

    /** @param array<string, string> $values */
    public function setMany(array $values): void
    {
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            foreach ($values as $key => $value) {
                $this->set($key, $value);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
