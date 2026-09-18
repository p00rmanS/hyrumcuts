<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\RateLimiter;
use Tests\TestCase;

final class RateLimiterTest extends TestCase
{
    public function test_not_limited_before_max_attempts(): void
    {
        $key = 'test:' . uniqid();
        for ($i = 0; $i < 4; $i++) {
            $this->assertFalse(RateLimiter::tooManyAttempts($key, 5, 15));
            RateLimiter::hit($key);
        }
    }

    public function test_limited_after_max_attempts(): void
    {
        $key = 'test:' . uniqid();
        for ($i = 0; $i < 5; $i++) {
            RateLimiter::hit($key);
        }
        $this->assertTrue(RateLimiter::tooManyAttempts($key, 5, 15));
    }

    public function test_different_keys_are_independent(): void
    {
        $keyA = 'test:a:' . uniqid();
        $keyB = 'test:b:' . uniqid();

        for ($i = 0; $i < 5; $i++) {
            RateLimiter::hit($keyA);
        }

        $this->assertTrue(RateLimiter::tooManyAttempts($keyA, 5, 15));
        $this->assertFalse(RateLimiter::tooManyAttempts($keyB, 5, 15));
    }
}
