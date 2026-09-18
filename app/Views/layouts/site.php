<?php
/** @var string $content */
/** @var array $settings */
$brand = $settings['brand_name'] ?? ($brandName ?? 'HyrumHaircuts');
$title = isset($seoTitle) && $seoTitle !== '' ? $seoTitle : $brand;
$description = $seoDescription ?? '';
$canonical = url($_SERVER['REQUEST_URI'] ?? '/');
$ogImage = url('/assets/images/placeholders/og-image.jpg');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title) ?></title>
  <?php if ($description !== ''): ?>
  <meta name="description" content="<?= e($description) ?>">
  <?php endif; ?>
  <?php if (!empty($noindex)): ?>
  <meta name="robots" content="noindex">
  <?php endif; ?>
  <link rel="canonical" href="<?= e($canonical) ?>">

  <meta property="og:type" content="website">
  <meta property="og:title" content="<?= e($title) ?>">
  <meta property="og:description" content="<?= e($description) ?>">
  <meta property="og:url" content="<?= e($canonical) ?>">
  <meta property="og:image" content="<?= e($ogImage) ?>">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= e($title) ?>">
  <meta name="twitter:description" content="<?= e($description) ?>">
  <meta name="twitter:image" content="<?= e($ogImage) ?>">

  <link rel="icon" type="image/png" href="/assets/images/favicon.png">
  <link rel="stylesheet" href="/assets/css/app.css">
  <?php if (($calendlyUrl ?? '') !== ''): ?>
  <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet">
  <?php endif; ?>

  <?= trim($extraHead ?? '') ?>
</head>
<body class="bg-paper text-ink">
  <a href="#main-content" class="skip-link">Skip to content</a>

  <?= \App\Core\View::partial('partials.header', ['settings' => $settings ?? [], 'calendlyUrl' => $calendlyUrl ?? '']) ?>

  <main id="main-content">
    <?= $content ?>
  </main>

  <?= \App\Core\View::partial('partials.footer', ['settings' => $settings ?? [], 'calendlyUrl' => $calendlyUrl ?? '']) ?>

  <?php if (($calendlyUrl ?? '') !== ''): ?>
  <script src="https://assets.calendly.com/assets/external/widget.js" async></script>
  <?php endif; ?>
  <script type="module" src="/assets/js/app.js"></script>
  <?= trim($extraScripts ?? '') ?>
</body>
</html>
