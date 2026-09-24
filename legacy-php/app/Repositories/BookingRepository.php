<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class BookingRepository
{
    private const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

    /**
     * Creates a booking request and returns [reference_code, plaintext_token].
     * The plaintext token is shown to the client exactly once (in the URL of
     * their manage link); only its hash is ever persisted.
     */
    public function create(array $data): array
    {
        $pdo = Database::connection();
        $now = gmdate('Y-m-d H:i:s');

        do {
            $reference = self::generateReferenceCode();
            $exists = $pdo->prepare('SELECT 1 FROM bookings WHERE reference_code = :ref');
            $exists->execute(['ref' => $reference]);
        } while ($exists->fetchColumn() !== false);

        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);

        $stmt = $pdo->prepare(
            'INSERT INTO bookings (
                reference_code, token_hash, full_name, phone, email, service_id,
                preferred_date, preferred_time_slot, client_type, notes, status,
                consent_at, request_ip, created_at, updated_at
            ) VALUES (
                :reference, :token_hash, :full_name, :phone, :email, :service_id,
                :preferred_date, :preferred_time_slot, :client_type, :notes, \'pending\',
                :consent_at, :request_ip, :now, :now
            )'
        );
        $stmt->execute([
            'reference' => $reference,
            'token_hash' => $tokenHash,
            'full_name' => $data['full_name'],
            'phone' => $data['phone'],
            'email' => $data['email'],
            'service_id' => $data['service_id'] ?: null,
            'preferred_date' => $data['preferred_date'],
            'preferred_time_slot' => $data['preferred_time_slot'],
            'client_type' => $data['client_type'],
            'notes' => !empty($data['notes']) ? $data['notes'] : null,
            'consent_at' => $now,
            'request_ip' => $data['request_ip'] ?? null,
            'now' => $now,
        ]);

        $bookingId = (int) $pdo->lastInsertId();

        $history = $pdo->prepare(
            'INSERT INTO booking_status_history (booking_id, old_status, new_status, note, created_at)
             VALUES (:id, NULL, \'pending\', \'Request submitted by client.\', :now)'
        );
        $history->execute(['id' => $bookingId, 'now' => $now]);

        return ['id' => $bookingId, 'reference_code' => $reference, 'token' => $token];
    }

    private static function generateReferenceCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 to avoid confusion
        $code = 'HH-';
        for ($i = 0; $i < 6; $i++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return $code;
    }

    public function findByToken(string $token): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM bookings WHERE token_hash = :hash');
        $stmt->execute(['hash' => hash('sha256', $token)]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM bookings WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function findByReference(string $reference): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM bookings WHERE reference_code = :ref');
        $stmt->execute(['ref' => $reference]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** @return array{items: array, total: int} */
    public function paginated(?string $status, int $page, int $perPage = 20): array
    {
        $pdo = Database::connection();
        $where = '';
        $params = [];
        if ($status !== null && in_array($status, self::STATUSES, true)) {
            $where = 'WHERE b.status = :status';
            $params['status'] = $status;
        }

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM bookings b {$where}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $offset = max(0, ($page - 1) * $perPage);
        $stmt = $pdo->prepare(
            "SELECT b.*, s.name AS service_name FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             {$where}
             ORDER BY b.created_at DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->bindValue(':limit', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['items' => $stmt->fetchAll(), 'total' => $total];
    }

    public function counts(): array
    {
        $rows = Database::connection()
            ->query('SELECT status, COUNT(*) AS total FROM bookings GROUP BY status')
            ->fetchAll();

        $counts = array_fill_keys(self::STATUSES, 0);
        foreach ($rows as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }
        return $counts;
    }

    public function updateStatus(int $id, string $newStatus, ?int $adminId, ?string $note = null): void
    {
        if (!in_array($newStatus, self::STATUSES, true)) {
            throw new \InvalidArgumentException('Invalid booking status.');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            // Status changes are rare, admin-driven, single-writer actions;
            // the transaction plus SQLite's busy_timeout is the concurrency
            // guard here rather than an explicit row lock.
            $current = $pdo->prepare('SELECT status FROM bookings WHERE id = :id');
            $current->execute(['id' => $id]);
            $oldStatus = $current->fetchColumn();

            if ($oldStatus === false) {
                throw new \RuntimeException('Booking not found.');
            }

            $update = $pdo->prepare('UPDATE bookings SET status = :status, updated_at = :now WHERE id = :id');
            $update->execute(['status' => $newStatus, 'now' => gmdate('Y-m-d H:i:s'), 'id' => $id]);

            $history = $pdo->prepare(
                'INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by_admin_id, note, created_at)
                 VALUES (:id, :old, :new, :admin_id, :note, :now)'
            );
            $history->execute([
                'id' => $id,
                'old' => $oldStatus,
                'new' => $newStatus,
                'admin_id' => $adminId,
                'note' => $note,
                'now' => gmdate('Y-m-d H:i:s'),
            ]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function updateAdminNotes(int $id, string $notes): void
    {
        $stmt = Database::connection()->prepare('UPDATE bookings SET admin_notes = :notes, updated_at = :now WHERE id = :id');
        $stmt->execute(['notes' => $notes !== '' ? $notes : null, 'now' => gmdate('Y-m-d H:i:s'), 'id' => $id]);
    }

    public function history(int $bookingId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT h.*, a.name AS admin_name FROM booking_status_history h
             LEFT JOIN admins a ON a.id = h.changed_by_admin_id
             WHERE h.booking_id = :id ORDER BY h.created_at ASC, h.id ASC'
        );
        $stmt->execute(['id' => $bookingId]);
        return $stmt->fetchAll();
    }
}
