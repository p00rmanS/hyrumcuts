/**
 * Pure logic for the dashboard: what needs the owner's attention, and how to
 * describe recent changes in plain language.
 */

/**
 * @param {Record<string, any>} settings the site_settings row
 * @param {{ published: number|null, drafts: number|null, reviews: number|null, faqs: number|null }} counts
 * @param {{ photos: number, reviews: number, faqs: number, bio: boolean, portrait: boolean, total: number }} [placeholders]
 * @returns {Array<{ id: string, level: 'warn'|'info', message: string, href: string, cta: string }>}
 */
export function computeWarnings(settings, counts, placeholders) {
  const out = [];
  const empty = (v) => !String(v ?? '').trim();

  // The big one: the site launched with starter content, and this is the to-do list for replacing it.
  if (placeholders?.total > 0) {
    const parts = [
      placeholders.photos ? `${placeholders.photos} portfolio ${placeholders.photos === 1 ? 'item' : 'items'}` : '',
      placeholders.reviews ? `${placeholders.reviews} ${placeholders.reviews === 1 ? 'review' : 'reviews'}` : '',
      placeholders.faqs ? `${placeholders.faqs} FAQ ${placeholders.faqs === 1 ? 'answer' : 'answers'}` : '',
      placeholders.bio ? 'your biography' : '',
      placeholders.portrait ? 'your portrait' : '',
    ].filter(Boolean);
    out.push({
      id: 'placeholders',
      level: 'info',
      message: `Your site still shows starter placeholder content: ${parts.join(', ')}. Replace each with your own. They're marked "Placeholder" so you can see what's left.`,
      href: '/admin/portfolio?status=placeholder',
      cta: 'Start replacing',
    });
  }

  if (!settings.hero_video_path) {
    out.push({ id: 'hero-video', level: 'info', message: 'Your hero video is still the placeholder clip. Upload your own to make the top of your site yours.', href: '/admin/media/hero', cta: 'Replace hero video' });
  } else if (!settings.hero_poster_path) {
    out.push({ id: 'hero-poster', level: 'warn', message: 'Your hero video has no poster image. Visitors on slow connections or with reduced motion will see a placeholder instead.', href: '/admin/media/hero', cta: 'Add a poster' });
  }
  if (settings.booking_provider !== 'none' && empty(settings.booking_url)) {
    out.push({ id: 'booking', level: 'warn', message: 'No booking link is set, so "Book" buttons send people to the request form only.', href: '/admin/settings/booking', cta: 'Add booking link' });
  }
  if (empty(settings.phone) && empty(settings.email)) {
    out.push({ id: 'contact', level: 'warn', message: 'No phone number or email is set, so the Contact section is hidden.', href: '/admin/settings/contact', cta: 'Add contact details' });
  }
  if (empty(settings.about_bio)) {
    out.push({ id: 'about', level: 'info', message: 'Your About section is hidden until you write a biography.', href: '/admin/content/about', cta: 'Write your bio' });
  }
  if (!settings.profile_photo_path) {
    out.push({ id: 'profile', level: 'info', message: 'Add a profile photo to show a portrait in your About section.', href: '/admin/media/profile', cta: 'Add profile photo' });
  }
  if (counts.published === 0) {
    out.push({ id: 'portfolio', level: 'warn', message: 'No portfolio work is published yet, so visitors see an empty gallery.', href: '/admin/portfolio/add', cta: 'Add your first work' });
  }
  if (empty(settings.instagram_url) && empty(settings.facebook_url)) {
    out.push({ id: 'social', level: 'info', message: 'Add your Instagram or Facebook link so people can follow you.', href: '/admin/settings/social', cta: 'Add social links' });
  }
  return out;
}

const NOUNS = {
  gallery_items: 'a portfolio item',
  gallery_media: 'portfolio media',
  gallery_categories: 'a category',
  reviews: 'a review',
  faqs: 'an FAQ',
  services: 'a service',
  site_settings: 'website settings',
};

const FIELD_LABELS = {
  hero_video_path: 'hero video',
  hero_poster_path: 'hero poster',
  profile_photo_path: 'profile photo',
  seo_image_path: 'sharing image',
  hero_heading: 'hero text',
  hero_eyebrow: 'hero text',
  hero_subheading: 'hero text',
  about_bio: 'About text',
  phone: 'phone',
  email: 'email',
  booking_url: 'booking link',
  booking_provider: 'booking provider',
  instagram_url: 'Instagram link',
  facebook_url: 'Facebook link',
  seo_title: 'SEO',
  seo_description: 'SEO',
  announcement_text: 'announcement',
  announcement_link_url: 'announcement',
  announcement_link_label: 'announcement',
  announcement_starts_on: 'announcement dates',
  announcement_ends_on: 'announcement dates',
};

/** "Published a portfolio item", "Updated website settings (phone, booking link)". */
export function describeActivity(row) {
  const noun = NOUNS[row.entity_type] ?? 'content';
  switch (row.action) {
    case 'create':
      return `Added ${noun}`;
    case 'delete':
      return `Deleted ${noun}`;
    case 'publish':
      return `Published ${noun}`;
    case 'unpublish':
      return `Hid ${noun} (now a draft)`;
    case 'archive':
      return `Archived ${noun}`;
    case 'restore':
      return `Restored ${noun}`;
    default: {
      const changed = [...new Set((row.metadata?.changed ?? []).map((c) => FIELD_LABELS[c]).filter(Boolean))];
      return `Updated ${noun}${changed.length ? ` (${changed.slice(0, 3).join(', ')})` : ''}`;
    }
  }
}
