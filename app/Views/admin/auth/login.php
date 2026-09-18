<?php
/** @var ?string $notice */
/** @var ?string $loginError */
?>
<div class="w-full max-w-sm">
  <p class="font-display text-2xl mb-8 text-center">HyrumHaircuts <span class="text-copper">Admin</span></p>

  <?php if ($notice): ?>
    <div class="mb-6 border border-ink/15 bg-paper px-4 py-3 text-sm"><?= e($notice) ?></div>
  <?php endif; ?>
  <?php if ($loginError): ?>
    <div class="mb-6 border border-red-800/40 bg-red-50 text-red-900 px-4 py-3 text-sm" role="alert"><?= e($loginError) ?></div>
  <?php endif; ?>

  <form method="post" action="/admin/login" class="bg-paper border border-ink/10 p-6 space-y-5">
    <?= csrf_field() ?>
    <div>
      <label for="email" class="block text-sm font-semibold mb-2">Email</label>
      <input type="email" id="email" name="email" required autofocus autocomplete="username" class="w-full border border-ink/20 px-4 py-3 focus:border-ink">
    </div>
    <div>
      <label for="password" class="block text-sm font-semibold mb-2">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password" class="w-full border border-ink/20 px-4 py-3 focus:border-ink">
    </div>
    <button type="submit" class="btn-primary w-full">Log In</button>
  </form>

  <p class="mt-6 text-center text-sm"><a href="/" class="text-stone hover:text-ink">&larr; Back to site</a></p>
</div>
