<?php
/**
 * @var array $settings
 * @var string $calendlyUrl
 */
$calendlyUrl ??= '';
$brand = $settings['brand_name'] ?? 'HyrumHaircuts';
$hasContactInfo = !empty($settings['location_general']) || !empty($settings['phone']) || !empty($settings['email']);
$navLinks = [
    '/#work' => 'Work',
    '/#about' => 'About',
    '/#reviews' => 'Reviews',
    '/#faq' => 'FAQ',
];
if ($hasContactInfo) {
    $navLinks['/#contact'] = 'Contact';
}
?>
<header id="site-header" data-site-header class="fixed inset-x-0 top-0 z-50 border-b border-ink/10 bg-paper/95 backdrop-blur transition-shadow duration-200">
  <div class="container-editorial flex h-16 items-center justify-between sm:h-20">
    <a href="/" class="font-display text-lg sm:text-xl tracking-tight">
      <?= e($brand) ?>
    </a>

    <nav class="hidden lg:flex items-center gap-8" aria-label="Primary">
      <?php foreach ($navLinks as $href => $label): ?>
        <a href="<?= e($href) ?>" class="text-sm font-medium tracking-wide hover:text-copper transition-colors"><?= e($label) ?></a>
      <?php endforeach; ?>
    </nav>

    <div class="hidden lg:flex items-center gap-4">
      <a href="/booking" class="btn-primary"<?= calendly_attrs($calendlyUrl) ?>>Book Your Next Cut</a>
    </div>

    <button
      type="button"
      class="lg:hidden inline-flex h-11 w-11 items-center justify-center"
      data-mobile-menu-toggle
      aria-expanded="false"
      aria-controls="mobile-menu"
      aria-label="Open menu"
    >
      <svg data-menu-icon-open width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
      <svg data-menu-icon-close width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="hidden"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
    </button>
  </div>
</header>

<!--
  Deliberately a sibling of <header>, not nested inside it: <header> uses
  backdrop-blur, and per the CSS Filter Effects spec an element with a
  backdrop-filter becomes a new containing block for its position:fixed
  descendants. A fixed menu nested inside it would be positioned relative
  to the header's own (short) box instead of the viewport and collapse to
  zero height — invisible despite every class being "correct".
-->
<div
  id="mobile-menu"
  data-mobile-menu
  class="hidden lg:hidden fixed inset-0 top-16 sm:top-20 z-40 bg-paper overflow-y-auto"
>
  <nav class="container-editorial flex flex-col gap-1 py-6" aria-label="Mobile">
    <?php foreach ($navLinks as $href => $label): ?>
      <a href="<?= e($href) ?>" data-mobile-link class="py-4 text-xl font-display border-b border-ink/10"><?= e($label) ?></a>
    <?php endforeach; ?>
    <a href="/booking" class="btn-primary mt-6 w-full"<?= calendly_attrs($calendlyUrl) ?>>Book Your Next Cut</a>
  </nav>
</div>

<a
  href="/booking"
  data-sticky-booking-cta
  class="lg:hidden fixed inset-x-0 bottom-0 z-40 btn-primary rounded-none justify-center py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
  <?= calendly_attrs($calendlyUrl) ?>
>
  Book Your Next Cut
</a>
