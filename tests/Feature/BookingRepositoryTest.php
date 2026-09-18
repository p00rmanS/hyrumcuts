<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Core\Database;
use App\Repositories\BookingRepository;
use Tests\TestCase;

final class BookingRepositoryTest extends TestCase
{
    private function sampleData(array $overrides = []): array
    {
        return array_merge([
            'full_name' => 'Jamie Client',
            'phone' => '555-123-4567',
            'email' => 'jamie@example.com',
            'service_id' => null,
            'preferred_date' => (new \DateTime('+3 days'))->format('Y-m-d'),
            'preferred_time_slot' => 'Morning (9am-12pm)',
            'client_type' => 'first_time',
            'notes' => '',
            'request_ip' => '127.0.0.1',
        ], $overrides);
    }

    public function test_create_returns_reference_code_and_plaintext_token(): void
    {
        $repo = new BookingRepository();
        $result = $repo->create($this->sampleData());

        $this->assertMatchesRegularExpression('/^HH-[A-Z2-9]{6}$/', $result['reference_code']);
        $this->assertSame(64, strlen($result['token'])); // 32 random bytes, hex-encoded
    }

    public function test_plaintext_token_is_never_stored(): void
    {
        $repo = new BookingRepository();
        $result = $repo->create($this->sampleData());

        $stmt = Database::connection()->prepare('SELECT token_hash FROM bookings WHERE id = :id');
        $stmt->execute(['id' => $result['id']]);
        $storedHash = $stmt->fetchColumn();

        $this->assertNotSame($result['token'], $storedHash);
        $this->assertSame(hash('sha256', $result['token']), $storedHash);
    }

    public function test_find_by_token_returns_the_matching_booking(): void
    {
        $repo = new BookingRepository();
        $result = $repo->create($this->sampleData(['full_name' => 'Alex Example']));

        $found = $repo->findByToken($result['token']);

        $this->assertNotNull($found);
        $this->assertSame('Alex Example', $found['full_name']);
    }

    public function test_find_by_token_rejects_wrong_token(): void
    {
        $repo = new BookingRepository();
        $repo->create($this->sampleData());

        $this->assertNull($repo->findByToken(bin2hex(random_bytes(32))));
    }

    public function test_new_booking_starts_pending(): void
    {
        $repo = new BookingRepository();
        $result = $repo->create($this->sampleData());
        $booking = $repo->find($result['id']);

        $this->assertSame('pending', $booking['status']);
    }

    public function test_update_status_records_history(): void
    {
        $repo = new BookingRepository();
        $result = $repo->create($this->sampleData());

        $repo->updateStatus($result['id'], 'confirmed', null, 'Confirmed by phone.');

        $booking = $repo->find($result['id']);
        $this->assertSame('confirmed', $booking['status']);

        $history = $repo->history($result['id']);
        $this->assertCount(2, $history); // initial "pending" + the update
        $this->assertSame('confirmed', $history[1]['new_status']);
        $this->assertSame('pending', $history[1]['old_status']);
    }

    public function test_update_status_rejects_invalid_status(): void
    {
        $repo = new BookingRepository();
        $result = $repo->create($this->sampleData());

        $this->expectException(\InvalidArgumentException::class);
        $repo->updateStatus($result['id'], 'not-a-real-status', null);
    }

    public function test_reference_codes_are_unique_across_many_bookings(): void
    {
        $repo = new BookingRepository();
        $codes = [];
        for ($i = 0; $i < 25; $i++) {
            $codes[] = $repo->create($this->sampleData())['reference_code'];
        }

        $this->assertCount(25, array_unique($codes));
    }
}
