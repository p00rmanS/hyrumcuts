<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

/**
 * Persistent (database-backed) rate limiter. Deliberately not in-memory /
 * session-based, since a limiter that resets per-session or per-process is
 * trivially bypassed by clearing cookies or hitting a load-balanced worker.
 */
final class RateLimiter
{
    public static function tooManyAttempts(string $key, int $maxAttempts, int $windowMinutes): bool
    {
        return self::attempts($key, $windowMinutes) >= $maxAttempts;
    }

    public static function attempts(string $key, int $windowMinutes): int
    {
        $pdo = Database::connection();
        $windowStart = gmdate('Y-m-d H:i:s', time() - $windowMinutes * 60);

        $stmt = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE rate_key = :key AND created_at >= :since');
        $stmt->execute(['key' => $key, 'since' => $windowStart]);

        return (int) $stmt->fetchColumn();
    }

    public static function hit(string $key): void
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare('INSERT INTO rate_limits (rate_key, created_at) VALUES (:key, :now)');
        $stmt->execute(['key' => $key, 'now' => gmdate('Y-m-d H:i:s')]);
    }

    /** Housekeeping: drop rows older than the widest window we ever check. */
    public static function prune(int $olderThanMinutes = 1440): void
    {
        $pdo = Database::connection();
        $cutoff = gmdate('Y-m-d H:i:s', time() - $olderThanMinutes * 60);
        $stmt = $pdo->prepare('DELETE FROM rate_limits WHERE created_at < :cutoff');
        $stmt->execute(['cutoff' => $cutoff]);
    }
}
