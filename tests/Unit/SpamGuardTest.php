<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use App\Core\Request;
use App\Core\SpamGuard;
use Tests\TestCase;

final class SpamGuardTest extends TestCase
{
    private function signedField(int $timestamp): string
    {
        $signature = hash_hmac('sha256', (string) $timestamp, (string) Config::get('app.key', ''));
        return $timestamp . '.' . $signature;
    }

    public function test_honeypot_tripped_when_field_filled(): void
    {
        $request = new Request(body: ['website' => 'http://spam.example']);
        $this->assertTrue(SpamGuard::honeypotTripped($request));
    }

    public function test_honeypot_not_tripped_when_empty(): void
    {
        $request = new Request(body: ['website' => '']);
        $this->assertFalse(SpamGuard::honeypotTripped($request));
    }

    public function test_timing_valid_after_plausible_delay(): void
    {
        $request = new Request(body: ['form_issued' => $this->signedField(time() - 5)]);
        $this->assertTrue(SpamGuard::timingValid($request));
    }

    public function test_timing_invalid_when_submitted_instantly(): void
    {
        $request = new Request(body: ['form_issued' => $this->signedField(time())]);
        $this->assertFalse(SpamGuard::timingValid($request));
    }

    public function test_timing_invalid_when_far_too_old(): void
    {
        $request = new Request(body: ['form_issued' => $this->signedField(time() - 100000)]);
        $this->assertFalse(SpamGuard::timingValid($request));
    }

    public function test_timing_invalid_when_signature_tampered(): void
    {
        $request = new Request(body: ['form_issued' => (time() - 5) . '.tampered-signature']);
        $this->assertFalse(SpamGuard::timingValid($request));
    }

    public function test_timing_invalid_when_field_missing(): void
    {
        $request = new Request(body: []);
        $this->assertFalse(SpamGuard::timingValid($request));
    }
}
