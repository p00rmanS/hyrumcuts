<?php
/** @var string $content */
$title = ($seoTitle ?? 'Admin Login') . ' — ' . ($brandName ?? 'HyrumHaircuts');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title><?= e($title) ?></title>
  <link rel="icon" type="image/png" href="/assets/images/favicon.png">
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="bg-ivory text-ink min-h-screen flex items-center justify-center px-4">
  <?= $content ?>
</body>
</html>
