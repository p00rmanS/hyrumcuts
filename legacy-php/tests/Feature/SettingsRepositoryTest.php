<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Repositories\SettingsRepository;
use Tests\TestCase;

final class SettingsRepositoryTest extends TestCase
{
    public function test_get_returns_default_when_unset(): void
    {
        $repo = new SettingsRepository();
        $this->assertSame('fallback', $repo->get('does_not_exist', 'fallback'));
    }

    public function test_set_then_get_round_trips(): void
    {
        $repo = new SettingsRepository();
        $repo->set('brand_name', 'HyrumHaircuts');

        $this->assertSame('HyrumHaircuts', $repo->get('brand_name'));
    }

    public function test_set_is_idempotent_via_upsert(): void
    {
        $repo = new SettingsRepository();
        $repo->set('phone', '555-0100');
        $repo->set('phone', '555-0199');

        $this->assertSame('555-0199', $repo->get('phone'));
    }

    public function test_set_many_writes_all_values(): void
    {
        $repo = new SettingsRepository();
        $repo->setMany(['a' => '1', 'b' => '2']);

        $all = $repo->all();
        $this->assertSame('1', $all['a']);
        $this->assertSame('2', $all['b']);
    }
}
