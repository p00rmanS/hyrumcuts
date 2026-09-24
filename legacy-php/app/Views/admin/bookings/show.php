<?php
/**
 * @var array $booking
 * @var ?array $service
 * @var array $history
 * @var array $statuses
 */
$statusLabels = ['pending' => 'Pending', 'confirmed' => 'Confirmed', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'no_show' => 'No-show'];
?>
<a href="/admin/bookings" class="text-sm text-stone hover:text-ink">&larr; All bookings</a>

<div class="grid gap-8 lg:grid-cols-3 mt-4">
  <div class="lg:col-span-2 space-y-8">
    <div class="border border-ink/10 bg-paper p-6">
      <h2 class="font-display text-lg mb-4">Request details</h2>
      <dl class="divide-y divide-ink/10">
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Reference</dt><dd class="col-span-2 font-mono"><?= e($booking['reference_code']) ?></dd></div>
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Name</dt><dd class="col-span-2"><?= e($booking['full_name']) ?></dd></div>
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Phone</dt><dd class="col-span-2"><a href="tel:<?= e($booking['phone']) ?>" class="hover:underline"><?= e($booking['phone']) ?></a></dd></div>
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Email</dt><dd class="col-span-2"><a href="mailto:<?= e($booking['email']) ?>" class="hover:underline"><?= e($booking['email']) ?></a></dd></div>
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Service</dt><dd class="col-span-2"><?= e($service['name'] ?? '—') ?></dd></div>
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Requested</dt><dd class="col-span-2"><?= e($booking['preferred_date']) ?> &middot; <?= e($booking['preferred_time_slot']) ?></dd></div>
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Client type</dt><dd class="col-span-2"><?= $booking['client_type'] === 'first_time' ? 'First-time' : 'Returning' ?></dd></div>
        <?php if (!empty($booking['notes'])): ?>
          <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Client notes</dt><dd class="col-span-2"><?= nl2br(e($booking['notes'])) ?></dd></div>
        <?php endif; ?>
        <div class="grid grid-cols-3 gap-4 py-3"><dt class="text-stone">Submitted</dt><dd class="col-span-2"><?= e($booking['created_at']) ?> UTC</dd></div>
      </dl>
    </div>

    <div class="border border-ink/10 bg-paper p-6">
      <h2 class="font-display text-lg mb-4">Internal notes <span class="text-xs font-normal text-stone">(never shown publicly)</span></h2>
      <form method="post" action="/admin/bookings/<?= (int) $booking['id'] ?>/notes" class="space-y-3">
        <?= csrf_field() ?>
        <textarea name="admin_notes" rows="4" class="w-full border border-ink/20 px-4 py-3"><?= e($booking['admin_notes'] ?? '') ?></textarea>
        <button type="submit" class="btn-secondary">Save Notes</button>
      </form>
    </div>

    <div class="border border-ink/10 bg-paper p-6">
      <h2 class="font-display text-lg mb-4">Status history</h2>
      <ul class="space-y-3 text-sm">
        <?php foreach ($history as $entry): ?>
          <li class="border-b border-ink/10 pb-3">
            <span class="font-medium"><?= e($entry['old_status'] ?? 'created') ?> &rarr; <?= e($entry['new_status']) ?></span>
            <span class="block text-stone text-xs">
              <?= e($entry['created_at']) ?> UTC
              <?php if (!empty($entry['admin_name'])): ?> &middot; by <?= e($entry['admin_name']) ?><?php endif; ?>
              <?php if (!empty($entry['note'])): ?> &middot; <?= e($entry['note']) ?><?php endif; ?>
            </span>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>
  </div>

  <div>
    <div class="border border-ink/10 bg-paper p-6">
      <h2 class="font-display text-lg mb-4">Update status</h2>
      <form method="post" action="/admin/bookings/<?= (int) $booking['id'] ?>/status" class="space-y-3" onsubmit="return confirm('Update this booking status?');">
        <?= csrf_field() ?>
        <select name="status" class="w-full border border-ink/20 px-4 py-3 bg-paper">
          <?php foreach ($statuses as $s): ?>
            <option value="<?= e($s) ?>" <?= $booking['status'] === $s ? 'selected' : '' ?>><?= e($statusLabels[$s] ?? $s) ?></option>
          <?php endforeach; ?>
        </select>
        <button type="submit" class="btn-primary w-full">Update Status</button>
      </form>
    </div>
  </div>
</div>
