import { STARTER_BIO } from './starter-content.js';

/**
 * How the admin knows something is still starter/placeholder content.
 *
 * There is deliberately NO flag to keep in sync: the marker lives in the
 * content itself, so it disappears the moment Hyrum replaces it.
 *   - photos:  the file name ends in "-starter.<ext>" (or is a bundled "/assets" file)
 *   - reviews: the text still starts with "[Placeholder review]"
 *   - FAQs:    the answer still starts with "[Owner to review"
 *   - bio:     the text is still exactly the starter paragraph
 */

/** A Storage/bundled path that belongs to the starter set. */
export function isPlaceholderPath(path) {
  return typeof path === 'string' && (/-starter\.[a-z0-9]+$/i.test(path) || path.startsWith('/assets/'));
}

/** An item is a placeholder while any of its images is still a starter image. */
export function itemHasPlaceholderMedia(item) {
  return (item?.media ?? item?.gallery_media ?? []).some((m) => isPlaceholderPath(m.storage_path));
}

export const isPlaceholderReview = (review) => /^\s*\[placeholder review\]/i.test(review?.quote ?? '');
export const isPlaceholderFaq = (faq) => /^\s*\[owner to review/i.test(faq?.answer ?? '');
export const isPlaceholderBio = (bio) => (bio ?? '').trim() === STARTER_BIO;
export const isPlaceholderPortrait = (settings) => isPlaceholderPath(settings?.profile_photo_path);

/**
 * Summarise what is still placeholder, for the dashboard.
 * @returns {{ photos: number, reviews: number, faqs: number, bio: boolean, portrait: boolean, total: number }}
 */
export function summarizePlaceholders({ items = [], reviews = [], faqs = [], settings = {} }) {
  const photos = items.filter(itemHasPlaceholderMedia).length;
  const r = reviews.filter(isPlaceholderReview).length;
  const f = faqs.filter(isPlaceholderFaq).length;
  const bio = isPlaceholderBio(settings.about_bio);
  const portrait = isPlaceholderPortrait(settings);
  return { photos, reviews: r, faqs: f, bio, portrait, total: photos + r + f + (bio ? 1 : 0) + (portrait ? 1 : 0) };
}
