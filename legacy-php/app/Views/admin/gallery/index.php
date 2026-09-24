<?php
/**
 * @var array $items
 * @var array $categories
 */
?>
<div class="flex items-center justify-between mb-6">
  <h2 class="font-display text-lg">Gallery items (<?= count($items) ?>)</h2>
  <a href="/admin/gallery/create" class="btn-primary">Add Item</a>
</div>

<?php if ($items === []): ?>
  <p class="text-stone mb-10">No gallery items yet.</p>
<?php else: ?>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
    <?php foreach ($items as $item): ?>
      <div class="border border-ink/10 bg-paper">
        <?php $thumb = $item['media']['primary']['image_path'] ?? $item['media']['after']['image_path'] ?? null; ?>
        <?php if ($thumb): ?>
          <img src="/<?= e($thumb) ?>" alt="" class="w-full aspect-[4/3] object-cover">
        <?php endif; ?>
        <div class="p-4">
          <p class="font-semibold"><?= e($item['title']) ?></p>
          <p class="text-sm text-stone mb-3"><?= e($item['category_name']) ?><?php if ((int) $item['is_featured'] === 1): ?> &middot; Featured<?php endif; ?></p>
          <div class="flex items-center gap-3 text-sm">
            <a href="/admin/gallery/<?= (int) $item['id'] ?>/edit" class="underline hover:text-copper">Edit</a>
            <form method="post" action="/admin/gallery/<?= (int) $item['id'] ?>/delete" onsubmit="return confirm('Delete this gallery item and its images?');">
              <?= csrf_field() ?>
              <button type="submit" class="text-red-800 underline hover:no-underline">Delete</button>
            </form>
          </div>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<div class="border-t border-ink/10 pt-8">
  <h2 class="font-display text-lg mb-4">Categories</h2>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
    <?php foreach ($categories as $category): ?>
      <div class="border border-ink/10 bg-paper p-4">
        <form method="post" action="/admin/gallery-categories/<?= (int) $category['id'] ?>" class="flex items-center gap-2 mb-2">
          <?= csrf_field() ?>
          <input type="text" name="name" value="<?= e($category['name']) ?>" class="flex-1 border border-ink/20 px-3 py-2 text-sm">
          <button type="submit" class="text-sm underline hover:text-copper">Save</button>
        </form>
        <form method="post" action="/admin/gallery-categories/<?= (int) $category['id'] ?>/delete" onsubmit="return confirm('Delete this category? Only possible if it has no items.');">
          <?= csrf_field() ?>
          <button type="submit" class="text-xs text-red-800 underline hover:no-underline">Delete category</button>
        </form>
      </div>
    <?php endforeach; ?>
  </div>

  <form method="post" action="/admin/gallery-categories" class="flex items-end gap-3 max-w-sm">
    <?= csrf_field() ?>
    <div class="flex-1">
      <label for="new_category_name" class="block text-sm font-semibold mb-2">New category</label>
      <input type="text" id="new_category_name" name="name" required maxlength="60" class="w-full border border-ink/20 px-3 py-2">
    </div>
    <button type="submit" class="btn-secondary">Add</button>
  </form>
</div>
