<?php
/**
 * @var array $booking
 * @var ?array $service
 * @var string $token
 * @var bool $justCreated
 */
$statusLabels = [
    'pending' => 'Pending review',
    'confirmed' => 'Confirmed',
    'completed' => 'Completed',
    'cancelled' => 'Cancelled',
    'no_show' => 'No-show',
];
$notice = \App\Core\Session::getFlash('notice');
?>
<section class="pt-32 pb-20 sm:pt-40 sm:pb-28">
  <div class="container-editorial max-w-2xl">
    <?php if ($justCreated): ?>
      <div class="mb-8 border border-ink/15 bg-ivory px-5 py-4 text-sm">
        You're all set! Hyrum will personally confirm your exact time by text or email shortly.
      </div>
    <?php endif; ?>
    <?php if ($notice): ?>
      <div class="mb-8 border border-ink/15 bg-ivory px-5 py-4 text-sm"><?= e($notice) ?></div>
    <?php endif; ?>

    <p class="eyebrow mb-3">Reference <?= e($booking['reference_code']) ?></p>
    <h1 class="text-3xl sm:text-4xl mb-2">Your appointment request</h1>
    <p class="mb-8 text-lg">
      Status:
      <span class="font-semibold"><?= e($statusLabels[$booking['status']] ?? $booking['status']) ?></span>
    </p>

    <dl class="divide-y divide-ink/10 border-y border-ink/10 mb-10">
      <div class="grid grid-cols-3 gap-4 py-4">
        <dt class="text-stone">Name</dt><dd class="col-span-2"><?= e($booking['full_name']) ?></dd>
      </div>
      <div class="grid grid-cols-3 gap-4 py-4">
        <dt class="text-stone">Contact</dt><dd class="col-span-2"><?= e($booking['phone']) ?> &middot; <?= e($booking['email']) ?></dd>
      </div>
      <?php if ($service): ?>
      <div class="grid grid-cols-3 gap-4 py-4">
        <dt class="text-stone">Service</dt><dd class="col-span-2"><?= e($service['name']) ?></dd>
      </div>
      <?php endif; ?>
      <div class="grid grid-cols-3 gap-4 py-4">
        <dt class="text-stone">Requested date</dt><dd class="col-span-2"><?= e($booking['preferred_date']) ?> &middot; <?= e($booking['preferred_time_slot']) ?></dd>
      </div>
      <div class="grid grid-cols-3 gap-4 py-4">
        <dt class="text-stone">Client type</dt><dd class="col-span-2"><?= $booking['client_type'] === 'first_time' ? 'First-time client' : 'Returning client' ?></dd>
      </div>
      <?php if (!empty($booking['notes'])): ?>
      <div class="grid grid-cols-3 gap-4 py-4">
        <dt class="text-stone">Notes</dt><dd class="col-span-2"><?= nl2br(e($booking['notes'])) ?></dd>
      </div>
      <?php endif; ?>
    </dl>

    <?php if (in_array($booking['status'], ['pending', 'confirmed'], true)): ?>
      <form method="post" action="/booking/manage/<?= e($token) ?>/cancel" onsubmit="return confirm('Cancel this appointment request?');">
        <?= csrf_field() ?>
        <button type="submit" class="btn-secondary">Cancel This Request</button>
      </form>
    <?php else: ?>
      <p class="text-stone">This request is <?= e(strtolower($statusLabels[$booking['status']] ?? $booking['status'])) ?> and can no longer be changed here.</p>
    <?php endif; ?>

    <p class="mt-10 text-sm text-stone">
      Bookmark this page or save its link to check your request later &mdash; it isn't tied to an account.
    </p>
  </div>
</section>
