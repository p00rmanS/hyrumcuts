<?php
/** @var array $settings */
$brand = $settings['brand_name'] ?? 'HyrumHaircuts';
$instagram = $settings['instagram_url'] ?? '';
$facebook = $settings['facebook_url'] ?? '';
$phone = $settings['phone'] ?? '';
$email = $settings['email'] ?? '';
$location = $settings['location_general'] ?? '';
$credit = $settings['credit_text'] ?? '';
?>
<footer class="bg-ink text-ivory">
  <div class="container-editorial py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
    <div>
      <p class="font-display text-xl mb-3"><?= e($brand) ?></p>
      <?php if ($location !== ''): ?>
        <p class="text-sm text-ivory/70"><?= e($location) ?></p>
      <?php endif; ?>
    </div>

    <nav aria-label="Footer">
      <p class="eyebrow mb-3">Explore</p>
      <ul class="space-y-2 text-sm">
        <li><a href="/#work" class="hover:text-copper">Work</a></li>
        <li><a href="/#about" class="hover:text-copper">About</a></li>
        <li><a href="/#reviews" class="hover:text-copper">Reviews</a></li>
        <li><a href="/#faq" class="hover:text-copper">FAQ</a></li>
        <li><a href="/privacy" class="hover:text-copper">Privacy Notice</a></li>
      </ul>
    </nav>

    <?php if ($phone !== '' || $email !== ''): ?>
      <div>
        <p class="eyebrow mb-3">Contact</p>
        <ul class="space-y-2 text-sm">
          <?php if ($phone !== ''): ?>
            <li><a href="tel:<?= e(preg_replace('/[^0-9+]/', '', $phone)) ?>" class="hover:text-copper"><?= e($phone) ?></a></li>
          <?php endif; ?>
          <?php if ($email !== ''): ?>
            <li><a href="mailto:<?= e($email) ?>" class="hover:text-copper"><?= e($email) ?></a></li>
          <?php endif; ?>
        </ul>
      </div>
    <?php endif; ?>

    <?php if ($instagram !== '' || $facebook !== ''): ?>
      <div>
        <p class="eyebrow mb-3">Follow</p>
        <div class="flex flex-row items-center gap-4">
          <?= \App\Core\View::partial('partials.social-icons', ['instagram' => $instagram, 'facebook' => $facebook, 'tone' => 'dark']) ?>
        </div>
      </div>
    <?php endif; ?>

    <div>
      <a href="/booking" class="btn-ghost">Book Your Next Cut</a>
    </div>
  </div>

  <div class="border-t border-ivory/10">
    <div class="container-editorial py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ivory/60">
      <p>&copy; <?= date('Y') ?> <?= e($brand) ?>. All rights reserved.</p>
      <?php if ($credit !== ''): ?>
        <p><?= e($credit) ?></p>
      <?php endif; ?>
    </div>
  </div>
</footer>
