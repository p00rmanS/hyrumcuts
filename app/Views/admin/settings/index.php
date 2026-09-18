<?php
/** @var array $settings */
$v = static fn (string $key) => e($settings[$key] ?? '');
?>
<form method="post" action="/admin/settings" class="max-w-3xl space-y-12">
  <?= csrf_field() ?>

  <section>
    <h2 class="font-display text-lg mb-4">Brand &amp; hero</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <div><label class="block text-sm font-semibold mb-2">Brand name</label><input type="text" name="brand_name" value="<?= $v('brand_name') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Barber name</label><input type="text" name="barber_name" value="<?= $v('barber_name') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div class="sm:col-span-2"><label class="block text-sm font-semibold mb-2">Hero eyebrow</label><input type="text" name="hero_eyebrow" value="<?= $v('hero_eyebrow') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div class="sm:col-span-2"><label class="block text-sm font-semibold mb-2">Hero heading</label><input type="text" name="hero_heading" value="<?= $v('hero_heading') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div class="sm:col-span-2"><label class="block text-sm font-semibold mb-2">Hero supporting line</label><input type="text" name="hero_subheading" value="<?= $v('hero_subheading') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
    </div>
  </section>

  <section>
    <h2 class="font-display text-lg mb-4">About</h2>
    <div class="grid gap-4">
      <div><label class="block text-sm font-semibold mb-2">Biography</label><textarea name="about_bio" rows="4" class="w-full border border-ink/20 px-4 py-3"><?= $v('about_bio') ?></textarea></div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="block text-sm font-semibold mb-2">Specialties <span class="text-stone font-normal">(leave blank to hide)</span></label><input type="text" name="about_specialties" value="<?= $v('about_specialties') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
        <div><label class="block text-sm font-semibold mb-2">Service area / location note</label><input type="text" name="about_location" value="<?= $v('about_location') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
        <div><label class="block text-sm font-semibold mb-2">Availability note</label><input type="text" name="about_availability_note" value="<?= $v('about_availability_note') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
        <div><label class="block text-sm font-semibold mb-2">Preferred contact method</label><input type="text" name="about_contact_method" value="<?= $v('about_contact_method') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      </div>
    </div>
  </section>

  <section>
    <h2 class="font-display text-lg mb-4">Contact &amp; social</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <div><label class="block text-sm font-semibold mb-2">Phone</label><input type="text" name="phone" value="<?= $v('phone') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Email</label><input type="email" name="email" value="<?= $v('email') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">General location</label><input type="text" name="location_general" value="<?= $v('location_general') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Full address <span class="text-stone font-normal">(only shown if you want it public)</span></label><input type="text" name="address_full" value="<?= $v('address_full') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Map URL</label><input type="url" name="map_url" value="<?= $v('map_url') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Timezone</label><input type="text" name="timezone" value="<?= $v('timezone') ?>" class="w-full border border-ink/20 px-4 py-3" placeholder="America/Denver"></div>
      <div><label class="block text-sm font-semibold mb-2">Instagram URL</label><input type="url" name="instagram_url" value="<?= $v('instagram_url') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Facebook URL</label><input type="url" name="facebook_url" value="<?= $v('facebook_url') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
    </div>
  </section>

  <section>
    <h2 class="font-display text-lg mb-4">Booking</h2>
    <div class="grid gap-4">
      <div>
        <label class="block text-sm font-semibold mb-2">Calendly (or Google Calendar Appointment Schedule) URL</label>
        <input type="url" name="calendly_url" value="<?= $v('calendly_url') ?>" class="w-full border border-ink/20 px-4 py-3">
        <p class="text-xs text-stone mt-1">Leave blank to hide the live calendar and show only the request form.</p>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-2">Preferred time windows <span class="text-stone font-normal">(one per line)</span></label>
        <textarea id="preferred_time_windows_display" rows="4" class="w-full border border-ink/20 px-4 py-3"><?= e(implode("\n", array_filter(explode('|', $settings['preferred_time_windows'] ?? '')))) ?></textarea>
        <input type="hidden" name="preferred_time_windows" id="preferred_time_windows" value="<?= $v('preferred_time_windows') ?>">
      </div>
      <div><label class="block text-sm font-semibold mb-2">Booking / cancellation policy</label><textarea name="booking_policy" rows="3" class="w-full border border-ink/20 px-4 py-3"><?= $v('booking_policy') ?></textarea></div>
    </div>
  </section>

  <section>
    <h2 class="font-display text-lg mb-4">FAQ answers</h2>
    <div class="grid gap-4">
      <div><label class="block text-sm font-semibold mb-2">How do I book?</label><textarea name="faq_book" rows="2" class="w-full border border-ink/20 px-4 py-3"><?= $v('faq_book') ?></textarea></div>
      <div><label class="block text-sm font-semibold mb-2">Is my appointment confirmed right away?</label><textarea name="faq_confirmed" rows="2" class="w-full border border-ink/20 px-4 py-3"><?= $v('faq_confirmed') ?></textarea></div>
      <div><label class="block text-sm font-semibold mb-2">What should I bring for a reference?</label><textarea name="faq_reference" rows="2" class="w-full border border-ink/20 px-4 py-3"><?= $v('faq_reference') ?></textarea></div>
      <div><label class="block text-sm font-semibold mb-2">What if I need to reschedule or cancel?</label><textarea name="faq_reschedule" rows="2" class="w-full border border-ink/20 px-4 py-3"><?= $v('faq_reschedule') ?></textarea></div>
      <div><label class="block text-sm font-semibold mb-2">Where will I receive confirmation?</label><textarea name="faq_confirmation" rows="2" class="w-full border border-ink/20 px-4 py-3"><?= $v('faq_confirmation') ?></textarea></div>
    </div>
  </section>

  <section>
    <h2 class="font-display text-lg mb-4">SEO &amp; footer</h2>
    <div class="grid gap-4">
      <div><label class="block text-sm font-semibold mb-2">SEO title</label><input type="text" name="seo_title" value="<?= $v('seo_title') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">SEO description</label><textarea name="seo_description" rows="2" class="w-full border border-ink/20 px-4 py-3"><?= $v('seo_description') ?></textarea></div>
      <div><label class="block text-sm font-semibold mb-2">Privacy contact email <span class="text-stone font-normal">(falls back to contact email above)</span></label><input type="email" name="privacy_contact_email" value="<?= $v('privacy_contact_email') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Footer credit <span class="text-stone font-normal">(optional, leave blank to hide)</span></label><input type="text" name="credit_text" value="<?= $v('credit_text') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
    </div>
  </section>

  <section>
    <h2 class="font-display text-lg mb-4">Analytics <span class="text-sm font-normal text-stone">(off unless configured)</span></h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <div><label class="block text-sm font-semibold mb-2">Provider</label><input type="text" name="analytics_provider" value="<?= $v('analytics_provider') ?>" placeholder="e.g. plausible" class="w-full border border-ink/20 px-4 py-3"></div>
      <div><label class="block text-sm font-semibold mb-2">Site ID</label><input type="text" name="analytics_site_id" value="<?= $v('analytics_site_id') ?>" class="w-full border border-ink/20 px-4 py-3"></div>
    </div>
  </section>

  <button type="submit" class="btn-primary">Save Settings</button>
</form>

<script type="module">
  const display = document.getElementById('preferred_time_windows_display');
  const hidden = document.getElementById('preferred_time_windows');
  const form = display.closest('form');
  form.addEventListener('submit', () => {
    hidden.value = display.value.split('\n').map((line) => line.trim()).filter(Boolean).join('|');
  });
</script>
