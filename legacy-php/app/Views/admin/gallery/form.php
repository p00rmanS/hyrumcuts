<?php
/**
 * @var array $categories
 * @var ?array $item
 */
$isEdit = $item !== null;
$errors = errors();
$isTransformation = $isEdit ? (bool) $item['is_transformation'] : (bool) old('is_transformation', false);
$action = $isEdit ? '/admin/gallery/' . (int) $item['id'] : '/admin/gallery';
?>
<a href="/admin/gallery" class="text-sm text-stone hover:text-ink">&larr; All gallery items</a>

<?php if ($errors !== []): ?>
  <div class="mt-4 mb-2 border border-red-800/40 bg-red-50 text-red-900 px-4 py-3 text-sm">
    <ul class="list-disc list-inside">
      <?php foreach ($errors as $error): ?><li><?= e($error) ?></li><?php endforeach; ?>
    </ul>
  </div>
<?php endif; ?>

<form method="post" action="<?= e($action) ?>" enctype="multipart/form-data" class="max-w-2xl space-y-6 mt-6">
  <?= csrf_field() ?>

  <div>
    <label for="category_id" class="block text-sm font-semibold mb-2">Category</label>
    <select id="category_id" name="category_id" required class="w-full border border-ink/20 px-4 py-3 bg-paper">
      <?php foreach ($categories as $category): ?>
        <option value="<?= (int) $category['id'] ?>" <?= (string) ($isEdit ? $item['category_id'] : old('category_id')) === (string) $category['id'] ? 'selected' : '' ?>><?= e($category['name']) ?></option>
      <?php endforeach; ?>
    </select>
  </div>

  <div>
    <label for="title" class="block text-sm font-semibold mb-2">Title</label>
    <input type="text" id="title" name="title" required maxlength="120" value="<?= e($isEdit ? $item['title'] : old('title')) ?>" class="w-full border border-ink/20 px-4 py-3">
  </div>

  <div>
    <label for="alt_text" class="block text-sm font-semibold mb-2">Alt text <span class="text-stone font-normal">(describes the photo for screen readers)</span></label>
    <input type="text" id="alt_text" name="alt_text" required maxlength="200" value="<?= e($isEdit ? $item['alt_text'] : old('alt_text')) ?>" class="w-full border border-ink/20 px-4 py-3">
  </div>

  <div>
    <label for="description" class="block text-sm font-semibold mb-2">Description <span class="text-stone font-normal">(optional)</span></label>
    <textarea id="description" name="description" maxlength="500" rows="3" class="w-full border border-ink/20 px-4 py-3"><?= e($isEdit ? $item['description'] : old('description')) ?></textarea>
  </div>

  <div class="flex items-center gap-3">
    <input type="checkbox" id="is_featured" name="is_featured" value="1" class="h-5 w-5" <?= ($isEdit ? (bool) $item['is_featured'] : (bool) old('is_featured')) ? 'checked' : '' ?>>
    <label for="is_featured" class="text-sm">Feature this item</label>
  </div>

  <?php if (!$isEdit): ?>
    <div class="flex items-center gap-3">
      <input type="checkbox" id="is_transformation" name="is_transformation" value="1" data-transformation-toggle class="h-5 w-5" <?= $isTransformation ? 'checked' : '' ?>>
      <label for="is_transformation" class="text-sm">This is a before/after transformation</label>
    </div>
  <?php endif; ?>

  <div data-single-image class="<?= $isTransformation ? 'hidden' : '' ?>">
    <label for="image" class="block text-sm font-semibold mb-2">Photo <span class="text-stone font-normal">(JPG, PNG, or WebP, under 8MB)</span></label>
    <?php if ($isEdit && isset($item['media']['primary'])): ?>
      <img src="/<?= e($item['media']['primary']['image_path']) ?>" alt="" class="w-32 h-32 object-cover mb-2">
    <?php endif; ?>
    <input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp" class="w-full border border-ink/20 px-4 py-3 bg-paper">
  </div>

  <div data-transformation-images class="<?= $isTransformation ? '' : 'hidden' ?> grid grid-cols-2 gap-4">
    <div>
      <label for="image_before" class="block text-sm font-semibold mb-2">Before photo</label>
      <?php if ($isEdit && isset($item['media']['before'])): ?>
        <img src="/<?= e($item['media']['before']['image_path']) ?>" alt="" class="w-24 h-24 object-cover mb-2">
      <?php endif; ?>
      <input type="file" id="image_before" name="image_before" accept="image/jpeg,image/png,image/webp" class="w-full border border-ink/20 px-3 py-2 bg-paper text-sm">
    </div>
    <div>
      <label for="image_after" class="block text-sm font-semibold mb-2">After photo</label>
      <?php if ($isEdit && isset($item['media']['after'])): ?>
        <img src="/<?= e($item['media']['after']['image_path']) ?>" alt="" class="w-24 h-24 object-cover mb-2">
      <?php endif; ?>
      <input type="file" id="image_after" name="image_after" accept="image/jpeg,image/png,image/webp" class="w-full border border-ink/20 px-3 py-2 bg-paper text-sm">
    </div>
  </div>

  <button type="submit" class="btn-primary"><?= $isEdit ? 'Save Changes' : 'Add Item' ?></button>
</form>

<script type="module">
  const toggle = document.querySelector('[data-transformation-toggle]');
  if (toggle) {
    toggle.addEventListener('change', () => {
      document.querySelector('[data-single-image]')?.classList.toggle('hidden', toggle.checked);
      document.querySelector('[data-transformation-images]')?.classList.toggle('hidden', !toggle.checked);
    });
  }
</script>
