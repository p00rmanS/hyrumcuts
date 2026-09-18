<?php
/**
 * @var array $settings
 * @var array $services
 * @var string $calendlyUrl
 * @var array $timeWindows
 */
$errors = errors();
$bookingError = \App\Core\Session::getFlash('booking_error');
// Calendly's widget.css/widget.js are loaded globally by layouts/site.php
// whenever a Calendly URL is configured, so every "Book Your Next Cut" CTA
// site-wide can trigger the popup, not just this page's inline embed.
?>

<section class="pt-32 pb-16 sm:pt-40 sm:pb-20 bg-ivory">
  <div class="container-editorial max-w-3xl text-center">
    <p class="eyebrow mb-3">Booking</p>
    <h1 class="text-4xl sm:text-5xl mb-5">Request an appointment.</h1>
    <p class="text-stone text-lg">
      Pick a time below, or send your details — <?= e($settings['barber_name'] ?? 'Hyrum') ?> personally confirms every booking by text or email.
    </p>
  </div>
</section>

<?php if ($calendlyUrl !== ''): ?>
<section id="calendar" class="py-16 sm:py-20 border-b border-ink/10 scroll-mt-24">
  <div class="container-editorial max-w-3xl text-center">
    <p class="eyebrow mb-3">Option 1</p>
    <h2 class="text-2xl sm:text-3xl mb-2">Check live availability</h2>
    <p class="text-stone mb-6">Opens the calendar in its own window — pick an open time and you're done.</p>
    <a href="/booking" class="btn-primary"<?= calendly_attrs($calendlyUrl) ?>>Check Live Availability</a>
  </div>
</section>
<?php endif; ?>

<section id="request-form" class="py-16 sm:py-20 scroll-mt-24">
  <div class="container-editorial max-w-2xl">
    <p class="eyebrow mb-3"><?= $calendlyUrl !== '' ? 'Option 2' : '' ?></p>
    <h2 class="text-2xl sm:text-3xl mb-2">Send an appointment request</h2>
    <p class="text-stone mb-8">Don't see a time that works? Send the details and <?= e($settings['barber_name'] ?? 'Hyrum') ?> will follow up.</p>

    <?php if ($bookingError): ?>
      <div class="mb-6 border border-red-800/40 bg-red-50 text-red-900 px-4 py-3 text-sm" role="alert"><?= e($bookingError) ?></div>
    <?php endif; ?>
    <?php if ($errors !== []): ?>
      <div class="mb-6 border border-red-800/40 bg-red-50 text-red-900 px-4 py-3 text-sm" role="alert">
        <p class="font-semibold mb-1">Please fix the following:</p>
        <ul class="list-disc list-inside">
          <?php foreach ($errors as $error): ?>
            <li><?= e($error) ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php endif; ?>

    <form method="post" action="/booking" novalidate class="space-y-6">
      <?= csrf_field() ?>
      <?= \App\Core\SpamGuard::honeypotField() ?>
      <?= \App\Core\SpamGuard::timingField() ?>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <label for="full_name" class="block text-sm font-semibold mb-2">Full name</label>
          <input type="text" id="full_name" name="full_name" required maxlength="120" value="<?= e(old('full_name')) ?>" class="w-full border border-ink/20 px-4 py-3 focus:border-ink" autocomplete="name">
        </div>
        <div>
          <label for="phone" class="block text-sm font-semibold mb-2">Mobile number</label>
          <input type="tel" id="phone" name="phone" required maxlength="30" value="<?= e(old('phone')) ?>" class="w-full border border-ink/20 px-4 py-3 focus:border-ink" autocomplete="tel">
        </div>
      </div>

      <div>
        <label for="email" class="block text-sm font-semibold mb-2">Email address</label>
        <input type="email" id="email" name="email" required maxlength="190" value="<?= e(old('email')) ?>" class="w-full border border-ink/20 px-4 py-3 focus:border-ink" autocomplete="email">
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <label for="service_id" class="block text-sm font-semibold mb-2">Service / cut type</label>
          <select id="service_id" name="service_id" class="w-full border border-ink/20 px-4 py-3 bg-paper focus:border-ink">
            <option value="">No preference</option>
            <?php foreach ($services as $service): ?>
              <option value="<?= (int) $service['id'] ?>" <?= (string) old('service_id') === (string) $service['id'] ? 'selected' : '' ?>><?= e($service['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div>
          <label for="client_type" class="block text-sm font-semibold mb-2">Are you a...</label>
          <select id="client_type" name="client_type" required class="w-full border border-ink/20 px-4 py-3 bg-paper focus:border-ink">
            <option value="">Select one</option>
            <option value="first_time" <?= old('client_type') === 'first_time' ? 'selected' : '' ?>>First-time client</option>
            <option value="returning" <?= old('client_type') === 'returning' ? 'selected' : '' ?>>Returning client</option>
          </select>
        </div>
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <label for="preferred_date" class="block text-sm font-semibold mb-2">Preferred date</label>
          <input type="date" id="preferred_date" name="preferred_date" required data-min-today value="<?= e(old('preferred_date')) ?>" class="w-full border border-ink/20 px-4 py-3 focus:border-ink">
        </div>
        <div>
          <label for="preferred_time_slot" class="block text-sm font-semibold mb-2">Preferred time window</label>
          <select id="preferred_time_slot" name="preferred_time_slot" required class="w-full border border-ink/20 px-4 py-3 bg-paper focus:border-ink">
            <option value="">Select a window</option>
            <?php foreach ($timeWindows as $window): ?>
              <option value="<?= e($window) ?>" <?= old('preferred_time_slot') === $window ? 'selected' : '' ?>><?= e($window) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>

      <div>
        <label for="notes" class="block text-sm font-semibold mb-2">Notes <span class="text-stone font-normal">(optional — current hair, desired look, accommodations)</span></label>
        <textarea id="notes" name="notes" maxlength="1000" rows="4" class="w-full border border-ink/20 px-4 py-3 focus:border-ink"><?= e(old('notes')) ?></textarea>
      </div>

      <div class="flex items-start gap-3">
        <input type="checkbox" id="consent" name="consent" value="1" required class="mt-1 h-5 w-5" <?= old('consent') ? 'checked' : '' ?>>
        <label for="consent" class="text-sm text-stone">
          I'd like <?= e($settings['barber_name'] ?? 'Hyrum') ?> to confirm this by text or email, and I've read the
          <a href="/privacy" class="underline hover:text-ink">privacy notice</a>.
        </label>
      </div>

      <button type="submit" class="btn-primary w-full sm:w-auto">Request Appointment</button>
    </form>
  </div>
</section>
