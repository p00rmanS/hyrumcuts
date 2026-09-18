<?php

declare(strict_types=1);

/**
 * SVG source: github.com/simple-icons/simple-icons (CC0-1.0 / public domain
 * — confirmed via the GitHub API before use). Files live locally at
 * public/assets/icons/social/*.svg and are optimized with SVGO; see
 * THIRD_PARTY_NOTICES.md. The build brief's originally-requested repository
 * (gauravghongde/social-icons) has no license and was not used — see the
 * same notice for that history.
 *
 * Icons are inlined (not <img>) so `fill="currentColor"` can pick up the
 * link's text color for hover/focus states, matching the rest of the site.
 * These SVG files are static trusted project assets read from disk, not
 * user input.
 *
 * @var string $instagram
 * @var string $facebook
 * @var string $tone 'light' (default, near-black icons for a light background) or 'dark' (ivory icons for the dark footer/hero)
 */

$tone ??= 'light';
$colorClasses = $tone === 'dark'
    ? 'text-ivory hover:text-copper focus-visible:text-copper'
    : 'text-ink hover:text-copper focus-visible:text-copper';
$iconPath = static fn (string $name): string => dirname(__DIR__, 3) . '/public/assets/icons/social/' . $name . '.svg';
?>
<?php if ($instagram !== ''): ?>
  <a
    href="<?= e($instagram) ?>"
    class="inline-flex h-9 w-9 items-center justify-center transition-colors <?= $colorClasses ?>"
    aria-label="Visit HyrumHaircuts on Instagram"
    target="_blank"
    rel="noopener noreferrer"
  ><span class="h-5 w-5"><?= file_get_contents($iconPath('instagram')) ?></span></a>
<?php endif; ?>
<?php if ($facebook !== ''): ?>
  <a
    href="<?= e($facebook) ?>"
    class="inline-flex h-9 w-9 items-center justify-center transition-colors <?= $colorClasses ?>"
    aria-label="Visit HyrumHaircuts on Facebook"
    target="_blank"
    rel="noopener noreferrer"
  ><span class="h-5 w-5"><?= file_get_contents($iconPath('facebook')) ?></span></a>
<?php endif; ?>
