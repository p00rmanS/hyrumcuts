<?php
/** @var string $content */
$title = ($pageTitle ?? 'Dashboard') . ' — Admin — ' . ($brandName ?? 'HyrumHaircuts');
$navItems = [
    '/admin' => 'Dashboard',
    '/admin/bookings' => 'Bookings',
    '/admin/gallery' => 'Gallery',
    '/admin/reviews' => 'Reviews',
    '/admin/services' => 'Services',
    '/admin/settings' => 'Settings',
];
$currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
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
<body class="bg-ivory text-ink min-h-screen">
  <div class="lg:flex">
    <aside class="lg:w-64 shrink-0 bg-ink text-ivory lg:min-h-screen">
      <div class="container-editorial lg:px-6 py-6 flex items-center justify-between lg:block">
        <a href="/admin" class="font-display text-lg">HyrumHaircuts</a>
        <p class="text-xs uppercase tracking-widest2 text-ivory/50 hidden lg:block mt-1">Admin</p>
      </div>
      <nav class="lg:px-3 pb-6" aria-label="Admin">
        <div class="flex lg:flex-col overflow-x-auto lg:overflow-visible container-editorial lg:px-3 gap-1">
          <?php foreach ($navItems as $href => $label): ?>
            <a
              href="<?= e($href) ?>"
              class="px-3 py-2 text-sm whitespace-nowrap lg:whitespace-normal rounded <?= $currentPath === $href ? 'bg-ivory text-ink font-semibold' : 'text-ivory/80 hover:bg-ivory/10' ?>"
            >
              <?= e($label) ?>
            </a>
          <?php endforeach; ?>
        </div>
      </nav>
      <div class="container-editorial lg:px-6 pb-6 hidden lg:block">
        <a href="/" class="text-xs text-ivory/60 hover:text-ivory">&larr; View public site</a>
      </div>
    </aside>

    <div class="flex-1 min-w-0">
      <header class="border-b border-ink/10 bg-paper">
        <div class="container-editorial py-4 flex items-center justify-between">
          <h1 class="font-display text-xl"><?= e($pageTitle ?? 'Dashboard') ?></h1>
          <form method="post" action="/admin/logout">
            <?= csrf_field() ?>
            <button type="submit" class="text-sm text-stone hover:text-ink">Log out</button>
          </form>
        </div>
      </header>
      <main class="container-editorial py-8">
        <?php if ($notice = \App\Core\Session::getFlash('notice')): ?>
          <div class="mb-6 border border-ink/15 bg-paper px-4 py-3 text-sm"><?= e($notice) ?></div>
        <?php endif; ?>
        <?php if ($error = \App\Core\Session::getFlash('admin_error')): ?>
          <div class="mb-6 border border-red-800/40 bg-red-50 text-red-900 px-4 py-3 text-sm" role="alert"><?= e($error) ?></div>
        <?php endif; ?>
        <?= $content ?>
      </main>
    </div>
  </div>
</body>
</html>
