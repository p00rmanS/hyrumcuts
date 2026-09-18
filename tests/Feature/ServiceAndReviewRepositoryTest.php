<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Repositories\ReviewRepository;
use App\Repositories\ServiceRepository;
use Tests\TestCase;

final class ServiceAndReviewRepositoryTest extends TestCase
{
    public function test_inactive_services_are_excluded_from_active_list(): void
    {
        $repo = new ServiceRepository();
        $activeId = $repo->create(['name' => 'Skin Fade', 'description' => '', 'is_active' => true]);
        $repo->create(['name' => 'Retired Cut', 'description' => '', 'is_active' => false]);

        $active = $repo->active();

        $this->assertCount(1, $active);
        $this->assertSame($activeId, (int) $active[0]['id']);
    }

    public function test_only_approved_reviews_are_public(): void
    {
        $repo = new ReviewRepository();
        $repo->create(['client_label' => 'J.', 'quote' => 'Great cut', 'haircut_type' => '', 'is_approved' => true]);
        $repo->create(['client_label' => 'M.', 'quote' => 'Unmoderated', 'haircut_type' => '', 'is_approved' => false]);

        $approved = $repo->approved();

        $this->assertCount(1, $approved);
        $this->assertSame('J.', $approved[0]['client_label']);
    }

    public function test_service_can_be_deleted(): void
    {
        $repo = new ServiceRepository();
        $id = $repo->create(['name' => 'Temp Service', 'description' => '', 'is_active' => true]);

        $repo->delete($id);

        $this->assertNull($repo->find($id));
    }
}
