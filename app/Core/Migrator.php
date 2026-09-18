<?php

declare(strict_types=1);

namespace App\Core;

final class Migrator
{
    public function __construct(private readonly \PDO $pdo)
    {
    }

    public function run(string $migrationsPath): array
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration TEXT NOT NULL UNIQUE,
                run_at TEXT NOT NULL
            )'
        );

        $applied = $this->pdo->query('SELECT migration FROM migrations')->fetchAll(\PDO::FETCH_COLUMN);
        $files = glob(rtrim($migrationsPath, '/') . '/*.sql') ?: [];
        sort($files);

        $ran = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $applied, true)) {
                continue;
            }

            $sql = file_get_contents($file);
            if ($sql === false) {
                throw new \RuntimeException("Could not read migration file: {$name}");
            }

            $this->pdo->beginTransaction();
            try {
                $this->pdo->exec($sql);
                $stmt = $this->pdo->prepare('INSERT INTO migrations (migration, run_at) VALUES (:name, :now)');
                $stmt->execute(['name' => $name, 'now' => gmdate('Y-m-d H:i:s')]);
                $this->pdo->commit();
                $ran[] = $name;
            } catch (\Throwable $e) {
                $this->pdo->rollBack();
                throw new \RuntimeException("Migration failed ({$name}): " . $e->getMessage(), 0, $e);
            }
        }

        return $ran;
    }
}
