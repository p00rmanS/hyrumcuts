<?php
/**
 * @var array $counts
 * @var array $recentBookings
 * @var array $recentActivity
 */
$statusLabels = ['pending' => 'Pending', 'confirmed' => 'Confirmed', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'no_show' => 'No-show'];
?>
<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-10">
  <?php foreach ($statusLabels as $key => $label): ?>
    <a href="/admin/bookings?status=<?= e($key) ?>" class="block border border-ink/10 bg-paper p-5 hover:border-ink transition-colors">
      <p class="text-3xl font-display"><?= (int) ($counts[$key] ?? 0) ?></p>
      <p class="text-sm text-stone"><?= e($label) ?></p>
    </a>
  <?php endforeach; ?>
</div>

<div class="grid gap-8 lg:grid-cols-3">
  <div class="lg:col-span-2">
    <h2 class="font-display text-lg mb-4">Recent booking requests</h2>
    <?php if ($recentBookings === []): ?>
      <p class="text-stone">No booking requests yet.</p>
    <?php else: ?>
      <div class="border border-ink/10 divide-y divide-ink/10 bg-paper">
        <?php foreach ($recentBookings as $booking): ?>
          <a href="/admin/bookings/<?= (int) $booking['id'] ?>" class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ivory">
            <span>
              <span class="font-medium"><?= e($booking['full_name']) ?></span>
              <span class="text-stone text-sm block"><?= e($booking['preferred_date']) ?> &middot; <?= e($booking['preferred_time_slot']) ?></span>
            </span>
            <span class="text-xs uppercase tracking-wide px-2 py-1 border border-ink/20"><?= e($statusLabels[$booking['status']] ?? $booking['status']) ?></span>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
    <a href="/admin/bookings" class="inline-block mt-4 text-sm underline hover:text-copper">View all bookings &rarr;</a>
  </div>

  <div>
    <h2 class="font-display text-lg mb-4">Recent activity</h2>
    <?php if ($recentActivity === []): ?>
      <p class="text-stone text-sm">No activity logged yet.</p>
    <?php else: ?>
      <ul class="space-y-3 text-sm">
        <?php foreach ($recentActivity as $entry): ?>
          <li class="border-b border-ink/10 pb-3">
            <span class="font-medium"><?= e($entry['admin_name'] ?? 'System') ?></span>
            <?= e(str_replace('.', ' ', $entry['action'])) ?>
            <span class="block text-stone text-xs"><?= e($entry['created_at']) ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </div>
</div>
