<?php
/** @var array $services */
$errors = errors();
?>
<div class="mb-6">
  <h2 class="font-display text-lg">Services (<?= count($services) ?>)</h2>
  <p class="text-sm text-stone">No prices are ever shown or stored — this list controls the options on the booking form only.</p>
</div>

<?php if ($errors !== []): ?>
  <div class="mb-6 border border-red-800/40 bg-red-50 text-red-900 px-4 py-3 text-sm">
    <ul class="list-disc list-inside"><?php foreach ($errors as $error): ?><li><?= e($error) ?></li><?php endforeach; ?></ul>
  </div>
<?php endif; ?>

<div class="space-y-4 mb-12">
  <?php foreach ($services as $service): ?>
    <form method="post" action="/admin/services/<?= (int) $service['id'] ?>" class="border border-ink/10 bg-paper p-4 grid gap-3 sm:grid-cols-2 items-end">
      <?= csrf_field() ?>
      <div>
        <label class="block text-xs font-semibold mb-1">Name</label>
        <input type="text" name="name" value="<?= e($service['name']) ?>" maxlength="100" required class="w-full border border-ink/20 px-3 py-2 text-sm">
      </div>
      <div>
        <label class="block text-xs font-semibold mb-1">Description</label>
        <input type="text" name="description" value="<?= e($service['description'] ?? '') ?>" maxlength="300" class="w-full border border-ink/20 px-3 py-2 text-sm">
      </div>
      <div class="flex items-center justify-between sm:col-span-2">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" value="1" <?= (int) $service['is_active'] === 1 ? 'checked' : '' ?>>
          Active (shown on booking form)
        </label>
        <button type="submit" class="underline hover:text-copper text-sm">Save</button>
      </div>
    </form>
    <form method="post" action="/admin/services/<?= (int) $service['id'] ?>/delete" onsubmit="return confirm('Delete this service?');" class="-mt-3 mb-4">
      <?= csrf_field() ?>
      <button type="submit" class="text-xs text-red-800 underline hover:no-underline">Delete this service</button>
    </form>
  <?php endforeach; ?>
</div>

<div class="border-t border-ink/10 pt-8 max-w-xl">
  <h2 class="font-display text-lg mb-4">Add a service</h2>
  <form method="post" action="/admin/services" class="space-y-4">
    <?= csrf_field() ?>
    <div>
      <label class="block text-sm font-semibold mb-2">Name</label>
      <input type="text" name="name" maxlength="100" required class="w-full border border-ink/20 px-4 py-3">
    </div>
    <div>
      <label class="block text-sm font-semibold mb-2">Description <span class="text-stone font-normal">(optional)</span></label>
      <input type="text" name="description" maxlength="300" class="w-full border border-ink/20 px-4 py-3">
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" name="is_active" value="1" checked>
      Active
    </label>
    <button type="submit" class="btn-primary">Add Service</button>
  </form>
</div>
