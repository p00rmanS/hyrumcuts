<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Repositories\GalleryRepository;
use Tests\TestCase;

final class GalleryRepositoryTest extends TestCase
{
    private function seedCategoriesAndItems(GalleryRepository $repo): array
    {
        $fadesId = $repo->createCategory('Fades', 'fades');
        $beardsId = $repo->createCategory('Beards', 'beards');

        $itemA = $repo->create([
            'category_id' => $fadesId, 'title' => 'Skin Fade', 'description' => '',
            'alt_text' => 'Skin fade', 'is_featured' => false, 'is_transformation' => false,
        ]);
        $itemB = $repo->create([
            'category_id' => $beardsId, 'title' => 'Beard Trim', 'description' => '',
            'alt_text' => 'Beard trim', 'is_featured' => false, 'is_transformation' => false,
        ]);

        return compact('fadesId', 'beardsId', 'itemA', 'itemB');
    }

    public function test_public_items_with_no_filter_returns_everything(): void
    {
        $repo = new GalleryRepository();
        $this->seedCategoriesAndItems($repo);

        $this->assertCount(2, $repo->publicItems());
    }

    public function test_public_items_filtered_by_category_slug(): void
    {
        $repo = new GalleryRepository();
        $this->seedCategoriesAndItems($repo);

        $fades = $repo->publicItems('fades');

        $this->assertCount(1, $fades);
        $this->assertSame('Skin Fade', $fades[0]['title']);
    }

    public function test_public_items_for_unknown_category_returns_empty(): void
    {
        $repo = new GalleryRepository();
        $this->seedCategoriesAndItems($repo);

        $this->assertSame([], $repo->publicItems('does-not-exist'));
    }

    public function test_deleting_category_with_items_is_refused(): void
    {
        $repo = new GalleryRepository();
        $ids = $this->seedCategoriesAndItems($repo);

        $this->assertFalse($repo->deleteCategory($ids['fadesId']));
    }

    public function test_deleting_empty_category_succeeds(): void
    {
        $repo = new GalleryRepository();
        $emptyId = $repo->createCategory('Textured', 'textured');

        $this->assertTrue($repo->deleteCategory($emptyId));
        $this->assertNull($repo->findCategory($emptyId));
    }

    public function test_transformation_item_carries_before_and_after_media(): void
    {
        $repo = new GalleryRepository();
        $categoryId = $repo->createCategory('Transformations', 'transformations');

        $itemId = $repo->create([
            'category_id' => $categoryId, 'title' => 'Big Change', 'description' => '',
            'alt_text' => 'Before and after', 'is_featured' => false, 'is_transformation' => true,
        ]);
        $repo->saveMedia($itemId, 'before', 'uploads/gallery/before.jpg', 900, 1200);
        $repo->saveMedia($itemId, 'after', 'uploads/gallery/after.jpg', 900, 1200);

        $item = $repo->find($itemId);

        $this->assertArrayHasKey('before', $item['media']);
        $this->assertArrayHasKey('after', $item['media']);
        $this->assertSame('uploads/gallery/after.jpg', $item['media']['after']['image_path']);
    }
}
