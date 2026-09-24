<?php
/** @var array $reviews */
$errors = errors();
?>
<div class="flex items-center justify-between mb-6">
  <h2 class="font-display text-lg">Reviews (<?= count($reviews) ?>)</h2>
</div>

<?php if ($errors !== []): ?>
  <div class="mb-6 border border-red-800/40 bg-red-50 text-red-900 px-4 py-3 text-sm">
    <ul class="list-disc list-inside"><?php foreach ($errors as $error): ?><li><?= e($error) ?></li><?php endforeach; ?></ul>
  </div>
<?php endif; ?>

<div class="space-y-4 mb-12">
  <?php foreach ($reviews as $review): ?>
    <form method="post" action="/admin/reviews/<?= (int) $review['id'] ?>" class="border border-ink/10 bg-paper p-4 grid gap-3 sm:grid-cols-2">
      <?= csrf_field() ?>
      <div>
        <label class="block text-xs font-semibold mb-1">Client label</label>
        <input type="text" name="client_label" value="<?= e($review['client_label']) ?>" maxlength="60" required class="w-full border border-ink/20 px-3 py-2 text-sm">
      </div>
      <div>
        <label class="block text-xs font-semibold mb-1">Haircut type</label>
        <input type="text" name="haircut_type" value="<?= e($review['haircut_type'] ?? '') ?>" maxlength="80" class="w-full border border-ink/20 px-3 py-2 text-sm">
      </div>
      <div class="sm:col-span-2">
        <label class="block text-xs font-semibold mb-1">Quote</label>
        <textarea name="quote" rows="2" maxlength="1000" required class="w-full border border-ink/20 px-3 py-2 text-sm"><?= e($review['quote']) ?></textarea>
      </div>
      <div class="flex items-center justify-between sm:col-span-2">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_approved" value="1" <?= (int) $review['is_approved'] === 1 ? 'checked' : '' ?>>
          Approved (visible on the site)
        </label>
        <div class="flex items-center gap-3 text-sm">
          <button type="submit" class="underline hover:text-copper">Save</button>
        </div>
      </div>
    </form>
    <form method="post" action="/admin/reviews/<?= (int) $review['id'] ?>/delete" onsubmit="return confirm('Delete this review?');" class="-mt-3 mb-4">
      <?= csrf_field() ?>
      <button type="submit" class="text-xs text-red-800 underline hover:no-underline">Delete this review</button>
    </form>
  <?php endforeach; ?>
</div>

<div class="border-t border-ink/10 pt-8 max-w-xl">
  <h2 class="font-display text-lg mb-4">Add a review</h2>
  <form method="post" action="/admin/reviews" class="space-y-4">
    <?= csrf_field() ?>
    <div>
      <label class="block text-sm font-semibold mb-2">Client label <span class="text-stone font-normal">(first name or initial)</span></label>
      <input type="text" name="client_label" maxlength="60" required class="w-full border border-ink/20 px-4 py-3">
    </div>
    <div>
      <label class="block text-sm font-semibold mb-2">Haircut type <span class="text-stone font-normal">(optional)</span></label>
      <input type="text" name="haircut_type" maxlength="80" class="w-full border border-ink/20 px-4 py-3">
    </div>
    <div>
      <label class="block text-sm font-semibold mb-2">Quote</label>
      <textarea name="quote" rows="3" maxlength="1000" required class="w-full border border-ink/20 px-4 py-3"></textarea>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" name="is_approved" value="1">
      Approved (visible on the site immediately)
    </label>
    <button type="submit" class="btn-primary">Add Review</button>
  </form>
</div>
