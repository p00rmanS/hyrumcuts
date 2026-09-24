<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Csrf;
use Tests\TestCase;

final class CsrfTest extends TestCase
{
    public function test_generated_token_verifies_successfully(): void
    {
        $token = Csrf::token();
        $this->assertTrue(Csrf::verify($token));
    }

    public function test_tampered_token_is_rejected(): void
    {
        Csrf::token();
        $this->assertFalse(Csrf::verify('not-the-real-token'));
    }

    public function test_missing_token_is_rejected(): void
    {
        Csrf::token();
        $this->assertFalse(Csrf::verify(null));
        $this->assertFalse(Csrf::verify(''));
    }

    public function test_token_is_stable_across_calls_in_same_session(): void
    {
        $first = Csrf::token();
        $second = Csrf::token();
        $this->assertSame($first, $second);
    }
}
