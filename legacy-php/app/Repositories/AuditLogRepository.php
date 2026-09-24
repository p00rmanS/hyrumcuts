<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class AuditLogRepository
{
    public function log(?int $adminId, string $action, ?string $entityType = null, ?int $entityId = null, ?string $details = null): void
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details, created_at)
             VALUES (:admin_id, :action, :entity_type, :entity_id, :details, :now)'
        );
        $stmt->execute([
            'admin_id' => $adminId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'details' => $details,
            'now' => gmdate('Y-m-d H:i:s'),
        ]);
    }

    public function recent(int $limit = 50): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT l.*, a.name AS admin_name FROM admin_audit_log l
             LEFT JOIN admins a ON a.id = l.admin_id
             ORDER BY l.created_at DESC LIMIT :limit'
        );
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
