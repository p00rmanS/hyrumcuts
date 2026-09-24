<?php
/**
 * @var array $bookings
 * @var int $total
 * @var int $page
 * @var int $perPage
 * @var ?string $status
 * @var array $statuses
 */
$statusLabels = ['pending' => 'Pending', 'confirmed' => 'Confirmed', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'no_show' => 'No-show'];
$totalPages = max(1, (int) ceil($total / $perPage));
?>
<div class="flex flex-wrap gap-2 mb-6">
  <a href="/admin/bookings" class="filter-pill" aria-pressed="<?= $status === null ? 'true' : 'false' ?>">All</a>
  <?php foreach ($statuses as $s): ?>
    <a href="/admin/bookings?status=<?= e($s) ?>" class="filter-pill" aria-pressed="<?= $status === $s ? 'true' : 'false' ?>"><?= e($statusLabels[$s] ?? $s) ?></a>
  <?php endforeach; ?>
</div>

<?php if ($bookings === []): ?>
  <p class="text-stone">No bookings found for this filter.</p>
<?php else: ?>
  <div class="overflow-x-auto border border-ink/10 bg-paper">
    <table class="w-full text-sm">
      <thead class="bg-ivory text-left">
        <tr>
          <th class="px-4 py-3">Reference</th>
          <th class="px-4 py-3">Client</th>
          <th class="px-4 py-3">Date</th>
          <th class="px-4 py-3">Service</th>
          <th class="px-4 py-3">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-ink/10">
        <?php foreach ($bookings as $booking): ?>
          <tr class="hover:bg-ivory cursor-pointer" onclick="window.location='/admin/bookings/<?= (int) $booking['id'] ?>'">
            <td class="px-4 py-3 font-mono text-xs"><?= e($booking['reference_code']) ?></td>
            <td class="px-4 py-3">
              <a href="/admin/bookings/<?= (int) $booking['id'] ?>" class="hover:underline"><?= e($booking['full_name']) ?></a>
            </td>
            <td class="px-4 py-3"><?= e($booking['preferred_date']) ?> &middot; <?= e($booking['preferred_time_slot']) ?></td>
            <td class="px-4 py-3"><?= e($booking['service_name'] ?? '—') ?></td>
            <td class="px-4 py-3"><span class="text-xs uppercase tracking-wide px-2 py-1 border border-ink/20"><?= e($statusLabels[$booking['status']] ?? $booking['status']) ?></span></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <?php if ($totalPages > 1): ?>
    <nav class="flex gap-2 mt-6" aria-label="Pagination">
      <?php for ($p = 1; $p <= $totalPages; $p++): ?>
        <a href="/admin/bookings?<?= http_build_query(array_filter(['status' => $status, 'page' => $p])) ?>" class="filter-pill" aria-pressed="<?= $p === $page ? 'true' : 'false' ?>"><?= $p ?></a>
      <?php endfor; ?>
    </nav>
  <?php endif; ?>
<?php endif; ?>
