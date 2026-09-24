<?php
/** @var array $settings */
$contact = $settings['privacy_contact_email'] ?: ($settings['email'] ?? '');
?>
<section class="pt-32 pb-20 sm:pt-40 sm:pb-28">
  <div class="container-editorial max-w-2xl prose-content">
    <p class="eyebrow mb-3">Privacy</p>
    <h1 class="text-3xl sm:text-4xl mb-8">Privacy notice</h1>

    <div class="space-y-6 text-stone leading-relaxed">
      <p>This page explains what information is collected through the <?= e($settings['brand_name'] ?? 'HyrumHaircuts') ?> website and how it's used. It applies to the appointment-request form and is not a legal document tailored to every jurisdiction.</p>

      <h2 class="text-xl font-display text-ink mt-8 mb-2">What is collected</h2>
      <p>When you request an appointment we collect your name, phone number, email address, requested date and time window, client type, any optional notes you add, and the fact that you agreed to be contacted. We also record the IP address a request was sent from, which is used only to prevent spam and abuse.</p>

      <h2 class="text-xl font-display text-ink mt-8 mb-2">Why it's collected</h2>
      <p>This information is used only to schedule, confirm, and manage your appointment, and to contact you about it by text or email. It is not sold, and it is not used for marketing you haven't asked for.</p>

      <h2 class="text-xl font-display text-ink mt-8 mb-2">Live calendar scheduling</h2>
      <p>If you choose to book through the embedded calendar instead of the request form, that scheduling happens directly with our calendar provider (Calendly), under its own privacy policy, not through this website's database.</p>

      <h2 class="text-xl font-display text-ink mt-8 mb-2">How long it's kept</h2>
      <p>Appointment records are kept as a booking history rather than deleted automatically, so past appointments remain visible to the business. You can ask for your information to be deleted at any time using the contact method below, and it will be removed unless there's a legitimate reason (such as an unresolved dispute) to keep it.</p>

      <h2 class="text-xl font-display text-ink mt-8 mb-2">Your request, deletion, or questions</h2>
      <?php if ($contact !== ''): ?>
        <p>To view, correct, or delete the information tied to a request, email <a href="mailto:<?= e($contact) ?>" class="underline hover:text-ink"><?= e($contact) ?></a> with your name and the reference code from your confirmation.</p>
      <?php else: ?>
        <p>[Owner to review: add a contact email here for privacy/data requests.]</p>
      <?php endif; ?>

      <h2 class="text-xl font-display text-ink mt-8 mb-2">Analytics</h2>
      <p>No analytics or tracking scripts are loaded by default. If an analytics tool is ever enabled, this page will be updated to name it.</p>
    </div>
  </div>
</section>
