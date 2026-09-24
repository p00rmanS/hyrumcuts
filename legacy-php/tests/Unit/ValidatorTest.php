<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Validator;
use Tests\TestCase;

final class ValidatorTest extends TestCase
{
    public function test_required_field_fails_when_blank(): void
    {
        $v = Validator::make(['name' => ''], ['name' => 'required']);
        $this->assertTrue($v->fails());
        $this->assertArrayHasKey('name', $v->errors());
    }

    public function test_email_rule_rejects_invalid_address(): void
    {
        $v = Validator::make(['email' => 'not-an-email'], ['email' => 'required|email']);
        $this->assertTrue($v->fails());
    }

    public function test_email_rule_accepts_valid_address(): void
    {
        $v = Validator::make(['email' => 'client@example.com'], ['email' => 'required|email']);
        $this->assertFalse($v->fails());
    }

    public function test_future_date_rejects_past_date(): void
    {
        $v = Validator::make(['preferred_date' => '2000-01-01'], ['preferred_date' => 'required|date|future_date']);
        $this->assertTrue($v->fails());
    }

    public function test_future_date_accepts_tomorrow(): void
    {
        $tomorrow = (new \DateTime('tomorrow'))->format('Y-m-d');
        $v = Validator::make(['preferred_date' => $tomorrow], ['preferred_date' => 'required|date|future_date']);
        $this->assertFalse($v->fails());
    }

    public function test_phone_rule_rejects_too_short_number(): void
    {
        $v = Validator::make(['phone' => '123'], ['phone' => 'required|phone']);
        $this->assertTrue($v->fails());
    }

    public function test_accepted_rule_requires_truthy_value(): void
    {
        $v = Validator::make(['consent' => '0'], ['consent' => 'accepted']);
        $this->assertTrue($v->fails());

        $v = Validator::make(['consent' => '1'], ['consent' => 'accepted']);
        $this->assertFalse($v->fails());
    }

    public function test_in_rule_restricts_to_allowlist(): void
    {
        $v = Validator::make(['client_type' => 'vip'], ['client_type' => 'required|in:first_time,returning']);
        $this->assertTrue($v->fails());
    }

    public function test_max_length_rule(): void
    {
        $v = Validator::make(['title' => str_repeat('a', 10)], ['title' => 'max:5']);
        $this->assertTrue($v->fails());
    }

    public function test_validated_only_returns_ruled_fields(): void
    {
        $v = Validator::make(['name' => 'Hyrum', 'extra' => 'ignored'], ['name' => 'required']);
        $this->assertSame(['name' => 'Hyrum'], $v->validated());
    }
}
