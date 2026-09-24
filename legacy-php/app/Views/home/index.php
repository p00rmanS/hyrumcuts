<?php
/**
 * @var array $settings
 * @var array $categories
 * @var array $items
 * @var array $reviews
 */
$brand = $settings['brand_name'] ?? 'HyrumHaircuts';
$barber = $settings['barber_name'] ?? 'Hyrum';
$calendlyUrl ??= '';
?>

<!-- ===================== HERO ===================== -->
<section data-hero class="relative h-[92vh] min-h-[560px] w-full overflow-hidden bg-ink text-ivory grain-overlay">
  <video
    data-hero-video
    class="absolute inset-0 h-full w-full object-cover"
    poster="/assets/images/placeholders/hero-poster.jpg"
    preload="metadata"
    muted
    loop
    playsinline
    autoplay
  >
    <source src="/assets/video/hyrum1.mp4" type="video/mp4">
  </video>
  <img
    data-hero-fallback
    src="/assets/images/placeholders/hero-poster.jpg"
    alt=""
    class="absolute inset-0 h-full w-full object-cover hidden"
  >

  <div class="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-ink/50"></div>

  <div class="relative z-10 flex h-full flex-col justify-end pb-24 sm:pb-28">
    <div class="container-editorial">
      <p class="eyebrow text-ivory mb-4"><?= e($settings['hero_eyebrow'] ?? 'Precision cuts. Personal style.') ?></p>
      <h1 class="text-4xl sm:text-6xl lg:text-7xl leading-[1.05] max-w-3xl mb-5">
        <?= e($settings['hero_heading'] ?? 'A sharper look, cut for you.') ?>
      </h1>
      <p class="text-base sm:text-lg text-ivory/85 max-w-xl mb-8">
        <?= e($settings['hero_subheading'] ?? 'Modern cuts, clean fades, and detail-first grooming by ' . $barber . '.') ?>
      </p>
      <div class="flex flex-wrap items-center gap-4">
        <a href="/booking" class="btn-primary"<?= calendly_attrs($calendlyUrl) ?>>Book Your Next Cut</a>
        <a href="#work" class="btn-ghost">View My Work</a>
      </div>
    </div>
  </div>

  <button
    type="button"
    data-hero-toggle
    class="absolute bottom-6 right-5 sm:right-8 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-ivory/40 text-ivory hover:bg-ivory hover:text-ink transition-colors"
    aria-label="Pause background video"
    aria-pressed="false"
  >
    <svg data-icon-pause width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3" height="12"/><rect x="10" y="2" width="3" height="12"/></svg>
    <svg data-icon-play width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="hidden"><path d="M4 2l10 6-10 6V2z"/></svg>
  </button>
</section>

<!-- ===================== GALLERY ===================== -->
<section id="work" class="py-20 sm:py-28">
  <div class="container-editorial">
    <div class="max-w-2xl mb-10">
      <p class="eyebrow mb-3">Featured Work</p>
      <h2 class="text-3xl sm:text-4xl">Every cut tells the fit, not just the trend.</h2>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-2 mb-10 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap" role="group" aria-label="Filter gallery by category" data-gallery-filters>
      <button type="button" class="filter-pill" data-filter="all" aria-pressed="true">All Cuts</button>
      <?php foreach ($categories as $category): ?>
        <button type="button" class="filter-pill" data-filter="<?= e($category['slug']) ?>" aria-pressed="false"><?= e($category['name']) ?></button>
      <?php endforeach; ?>
    </div>

    <?php if ($items === []): ?>
      <p class="text-stone py-16 text-center">The gallery is empty right now. Check back soon.</p>
    <?php else: ?>
      <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5" data-gallery-grid>
        <?php foreach ($items as $index => $item): ?>
          <?php if ($index === 6): ?>
            <div data-hide-sticky-cta class="col-span-2 sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row items-center justify-between gap-4 bg-ivory px-6 py-8 my-2 text-center sm:text-left">
              <p class="text-xl font-display">Ready for your next look?</p>
              <a href="/booking" class="btn-primary"<?= calendly_attrs($calendlyUrl) ?>>Let's Get You Fresh</a>
            </div>
          <?php endif; ?>

          <?php if ((int) $item['is_transformation'] === 1 && isset($item['media']['before'], $item['media']['after'])): ?>
            <a
              href="/<?= e($item['media']['after']['image_path']) ?>"
              class="gallery-figure group col-span-2 sm:col-span-1"
              data-gallery-item
              data-category="<?= e($item['category_slug']) ?>"
              data-lightbox-transformation
              data-before="/<?= e($item['media']['before']['image_path']) ?>"
              data-after="/<?= e($item['media']['after']['image_path']) ?>"
              data-caption="<?= e($item['title']) ?>"
            >
              <span class="grid grid-cols-2 gap-0.5">
                <span class="relative block aspect-[3/4] overflow-hidden">
                  <img src="/<?= e($item['media']['before']['image_path']) ?>" alt="<?= e($item['title']) ?> — before" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]">
                  <span class="absolute bottom-2 left-2 bg-ink/80 text-ivory text-[11px] uppercase tracking-wide px-2 py-1">Before</span>
                </span>
                <span class="relative block aspect-[3/4] overflow-hidden">
                  <img src="/<?= e($item['media']['after']['image_path']) ?>" alt="<?= e($item['title']) ?> — after" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]">
                  <span class="absolute bottom-2 left-2 bg-copper text-ivory text-[11px] uppercase tracking-wide px-2 py-1">After</span>
                </span>
              </span>
              <span class="block py-2 text-sm font-medium"><?= e($item['title']) ?></span>
            </a>
          <?php elseif (isset($item['media']['primary'])): ?>
            <?php
              $ratio = 'aspect-[3/4]';
              if (($item['media']['primary']['width'] ?? 0) > 0 && ($item['media']['primary']['height'] ?? 0) > 0) {
                  $w = (int) $item['media']['primary']['width'];
                  $h = (int) $item['media']['primary']['height'];
                  $ratio = $w === $h ? 'aspect-square' : ($w > $h ? 'aspect-[4/3]' : 'aspect-[3/4]');
              }
            ?>
            <a
              href="/<?= e($item['media']['primary']['image_path']) ?>"
              class="gallery-figure group"
              data-gallery-item
              data-category="<?= e($item['category_slug']) ?>"
              data-lightbox-image="/<?= e($item['media']['primary']['image_path']) ?>"
              data-caption="<?= e($item['title']) ?>"
            >
              <span class="relative block <?= $ratio ?> overflow-hidden">
                <img
                  src="/<?= e($item['media']['primary']['image_path']) ?>"
                  alt="<?= e($item['alt_text']) ?>"
                  loading="lazy"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  <?php if (($item['media']['primary']['width'] ?? null) && ($item['media']['primary']['height'] ?? null)): ?>
                    width="<?= (int) $item['media']['primary']['width'] ?>" height="<?= (int) $item['media']['primary']['height'] ?>"
                  <?php endif; ?>
                >
                <?php if ((int) $item['is_featured'] === 1): ?>
                  <span class="sr-only">Featured work</span>
                <?php endif; ?>
              </span>
              <span class="block py-2 text-sm font-medium"><?= e($item['title']) ?></span>
            </a>
          <?php endif; ?>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<!-- Lightbox (single instance, populated by JS) -->
<div
  id="lightbox"
  data-lightbox
  class="fixed inset-0 z-[60] hidden bg-ink/95"
  role="dialog"
  aria-modal="true"
  aria-label="Gallery image viewer"
>
  <button type="button" data-lightbox-close class="absolute top-4 right-4 sm:top-6 sm:right-6 h-11 w-11 flex items-center justify-center text-ivory hover:text-copper" aria-label="Close image viewer">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
  </button>
  <button type="button" data-lightbox-prev class="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-ivory hover:text-copper" aria-label="Previous image">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <button type="button" data-lightbox-next class="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-ivory hover:text-copper" aria-label="Next image">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>

  <div class="flex h-full items-center justify-center px-4 sm:px-20">
    <figure class="max-h-[80vh] max-w-full text-center">
      <div data-lightbox-media class="flex items-center justify-center gap-2 max-h-[70vh]"></div>
      <figcaption data-lightbox-caption class="mt-4 text-ivory text-sm sm:text-base"></figcaption>
    </figure>
  </div>
</div>

<!-- ===================== ABOUT ===================== -->
<section id="about" class="py-20 sm:py-28 bg-ivory">
  <div class="container-editorial grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
    <div class="relative aspect-[4/5] overflow-hidden order-2 lg:order-1">
      <img src="/assets/images/placeholders/about-portrait.jpg" alt="Placeholder portrait of <?= e($barber) ?> — replace with a real photo before launch." loading="lazy" class="h-full w-full object-cover">
    </div>
    <div class="order-1 lg:order-2">
      <p class="eyebrow mb-3">About <?= e($barber) ?></p>
      <h2 class="text-3xl sm:text-4xl mb-6">The barber behind the chair.</h2>
      <p class="text-lg leading-relaxed mb-6"><?= nl2br(e($settings['about_bio'] ?? '')) ?></p>

      <dl class="space-y-3 mb-8 text-sm">
        <?php if (!empty($settings['about_specialties'])): ?>
          <div><dt class="font-semibold inline">Specialties: </dt><dd class="inline text-stone"><?= e($settings['about_specialties']) ?></dd></div>
        <?php endif; ?>
        <?php if (!empty($settings['about_location'])): ?>
          <div><dt class="font-semibold inline">Location: </dt><dd class="inline text-stone"><?= e($settings['about_location']) ?></dd></div>
        <?php endif; ?>
        <?php if (!empty($settings['about_availability_note'])): ?>
          <div><dt class="font-semibold inline">Availability: </dt><dd class="inline text-stone"><?= e($settings['about_availability_note']) ?></dd></div>
        <?php endif; ?>
        <?php if (!empty($settings['about_contact_method'])): ?>
          <div><dt class="font-semibold inline">Preferred contact: </dt><dd class="inline text-stone"><?= e($settings['about_contact_method']) ?></dd></div>
        <?php endif; ?>
      </dl>

      <?php if (!empty($settings['instagram_url'])): ?>
        <a href="<?= e($settings['instagram_url']) ?>" target="_blank" rel="noopener noreferrer" class="btn-secondary">See More Cuts on Instagram</a>
      <?php endif; ?>
    </div>
  </div>
</section>

<!-- ===================== REVIEWS ===================== -->
<section id="reviews" class="py-20 sm:py-28">
  <div class="container-editorial">
    <div class="max-w-2xl mb-10">
      <p class="eyebrow mb-3">Reviews</p>
      <h2 class="text-3xl sm:text-4xl">What clients say.</h2>
    </div>

    <?php if ($reviews === []): ?>
      <p class="text-stone">No reviews are published yet.</p>
    <?php else: ?>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <?php foreach ($reviews as $review): ?>
          <figure class="border border-ink/10 p-6 flex flex-col justify-between">
            <blockquote class="text-lg leading-relaxed mb-4">&ldquo;<?= e($review['quote']) ?>&rdquo;</blockquote>
            <figcaption class="text-sm text-stone">
              <span class="font-semibold text-ink"><?= e($review['client_label']) ?></span>
              <?php if (!empty($review['haircut_type'])): ?>
                &middot; <?= e($review['haircut_type']) ?>
              <?php endif; ?>
            </figcaption>
          </figure>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if (!empty($settings['instagram_url'])): ?>
<!-- ===================== INSTAGRAM ===================== -->
<section class="py-20 sm:py-28 bg-ivory">
  <div class="container-editorial text-center">
    <p class="eyebrow mb-3">Instagram</p>
    <h2 class="text-3xl sm:text-4xl mb-8">Follow along for more.</h2>

    <?php
      $instaShots = array_values(array_filter($items, static fn ($item) => isset($item['media']['primary'])));
      $instaShots = array_slice($instaShots, 0, 6);
    ?>
    <?php if ($instaShots !== []): ?>
      <div class="grid grid-cols-3 gap-1 sm:gap-2 mb-8">
        <?php foreach ($instaShots as $shot): ?>
          <a href="<?= e($settings['instagram_url']) ?>" target="_blank" rel="noopener noreferrer" class="group relative block aspect-square overflow-hidden">
            <img src="/<?= e($shot['media']['primary']['image_path']) ?>" alt="" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105">
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <a href="<?= e($settings['instagram_url']) ?>" target="_blank" rel="noopener noreferrer" class="btn-secondary">Visit Instagram</a>
  </div>
</section>
<?php endif; ?>

<!-- ===================== BOOKING BANNER ===================== -->
<section data-hide-sticky-cta class="py-20 sm:py-24 bg-ink text-ivory grain-overlay">
  <div class="container-editorial text-center max-w-2xl mx-auto">
    <h2 class="text-3xl sm:text-4xl mb-8">Ready for a fresh cut?</h2>
    <a href="/booking" class="btn-primary"<?= calendly_attrs($calendlyUrl) ?>>Reserve Your Chair</a>
  </div>
</section>

<!-- ===================== FAQ ===================== -->
<section id="faq" class="py-20 sm:py-28">
  <div class="container-editorial max-w-3xl">
    <p class="eyebrow mb-3">FAQ</p>
    <h2 class="text-3xl sm:text-4xl mb-8">Good to know before you book.</h2>

    <div data-accordion class="border-t border-ink/10">
      <?php
      $faqs = [
          'How do I book?' => $settings['faq_book'] ?? '',
          'Is my appointment confirmed right away?' => $settings['faq_confirmed'] ?? '',
          'What should I bring for a reference?' => $settings['faq_reference'] ?? '',
          'What if I need to reschedule or cancel?' => $settings['faq_reschedule'] ?? '',
          'Where will I receive confirmation?' => $settings['faq_confirmation'] ?? '',
      ];
      ?>
      <?php $i = 0; foreach ($faqs as $question => $answer): $i++; ?>
        <div class="border-b border-ink/10">
          <h3>
            <button type="button" class="accordion-trigger" aria-expanded="false" aria-controls="faq-panel-<?= $i ?>" id="faq-trigger-<?= $i ?>" data-accordion-trigger>
              <span><?= e($question) ?></span>
              <svg data-accordion-icon width="18" height="18" viewBox="0 0 18 18" fill="none" class="shrink-0 transition-transform duration-200" aria-hidden="true"><path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </h3>
          <div id="faq-panel-<?= $i ?>" role="region" aria-labelledby="faq-trigger-<?= $i ?>" data-accordion-panel class="hidden pb-5 text-stone leading-relaxed">
            <?= e($answer) ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if (!empty($settings['location_general']) || !empty($settings['phone']) || !empty($settings['email'])): ?>
<!-- ===================== CONTACT ===================== -->
<section id="contact" class="py-20 sm:py-28 bg-ivory">
  <div class="container-editorial max-w-2xl">
    <p class="eyebrow mb-3">Contact</p>
    <h2 class="text-3xl sm:text-4xl mb-6">Find <?= e($barber) ?>.</h2>
    <ul class="space-y-3 text-lg">
      <?php if (!empty($settings['location_general'])): ?>
        <li><?= e($settings['location_general']) ?></li>
      <?php endif; ?>
      <?php if (!empty($settings['phone'])): ?>
        <li><a href="tel:<?= e(preg_replace('/[^0-9+]/', '', $settings['phone'])) ?>" class="hover:text-copper"><?= e($settings['phone']) ?></a></li>
      <?php endif; ?>
      <?php if (!empty($settings['email'])): ?>
        <li><a href="mailto:<?= e($settings['email']) ?>" class="hover:text-copper"><?= e($settings['email']) ?></a></li>
      <?php endif; ?>
      <?php if (!empty($settings['map_url'])): ?>
        <li><a href="<?= e($settings['map_url']) ?>" target="_blank" rel="noopener noreferrer" class="hover:text-copper underline">Get directions</a></li>
      <?php endif; ?>
    </ul>
  </div>
</section>
<?php endif; ?>
