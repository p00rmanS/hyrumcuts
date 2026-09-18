<?php
/** @var array $settings */
?>
<section class="min-h-[70vh] flex items-center pt-24">
  <div class="container-editorial text-center py-24 max-w-2xl">
    <p class="eyebrow mb-4">Request sent</p>
    <h1 class="text-3xl sm:text-5xl mb-6">You're all set!</h1>
    <p class="text-stone text-lg mb-8">
      <?= e($settings['barber_name'] ?? 'Hyrum') ?> will personally confirm your exact time by text or email shortly.
    </p>
    <a href="/" class="btn-primary">Back to Home</a>
  </div>
</section>
