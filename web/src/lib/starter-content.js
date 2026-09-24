/**
 * Starter (placeholder) content: exactly what the original HyrumHaircuts site
 * shipped with, so the site looks complete from day one. Hyrum replaces each
 * piece in /admin; nothing here needs a developer to change.
 *
 * Used in two places, from this ONE definition:
 *   1. scripts/lib/starter-seed.mjs loads it into the database (as real,
 *      editable rows and real files in Storage), and
 *   2. content.js shows it when the site has no backend connected at all
 *      (for example a preview build before Supabase is set up).
 *
 * It is deliberately honest: photo alt text says they are placeholders, the
 * reviews are labelled "[Placeholder review]", and unfinished FAQ answers say
 * "[Owner to review…]". The admin flags all of it until it is replaced
 * (see placeholders.js).
 *
 * Pure data, no DOM and no Supabase imports, so Node scripts can import it.
 */

export const STARTER_IMAGE_DIR = '/assets/images/gallery/';
export const STARTER_PORTRAIT = '/assets/images/placeholders/about-portrait.jpg';
export const STARTER_PORTRAIT_SIZE = { width: 1000, height: 1250 };

export const STARTER_BIO =
  'Hyrum approaches every appointment with patience, precision, and attention to how the cut fits the person—not just the trend. From clean fades to longer textured styles, the goal is a haircut that looks sharp in the chair and still works in everyday life.';

export const STARTER_PORTRAIT_ALT = 'Placeholder portrait of Hyrum. Replace with a real photo before launch.';

/** Settings that differ from the database defaults on a fresh install. */
export const STARTER_SETTINGS = Object.freeze({
  about_bio: STARTER_BIO,
  profile_photo_alt: STARTER_PORTRAIT_ALT,
});

export const STARTER_CATEGORIES = Object.freeze([
  { slug: 'fades', name: 'Fades' },
  { slug: 'tapers', name: 'Tapers' },
  { slug: 'textured', name: 'Textured' },
  { slug: 'long-hair', name: 'Long Hair' },
  { slug: 'beards', name: 'Beards' },
  { slug: 'transformations', name: 'Transformations' },
]);

const P = (category, title, file, width, height, featured = false) => ({
  kind: 'image',
  category,
  title,
  file,
  width,
  height,
  featured,
  alt: `${title} — placeholder photo, replace before launch.`,
});
const T = (title, before, after) => ({
  kind: 'transformation',
  category: 'transformations',
  title,
  before,
  after,
  width: 900,
  height: 1200,
  featured: true,
  alt: `${title} — placeholder before and after photos, replace before launch.`,
});

/** In display order. */
export const STARTER_ITEMS = Object.freeze([
  P('fades', 'Clean Skin Fade', '1_primary.jpg', 900, 1200, true),
  P('fades', 'High Fade with Hard Part', '2_primary.jpg', 1000, 1000, true),
  P('fades', 'Low Fade, Natural Top', '3_primary.jpg', 900, 1200, true),
  P('tapers', 'Classic Taper', '4_primary.jpg', 900, 1200),
  P('tapers', 'Taper with Beard Lineup', '5_primary.jpg', 1000, 1000),
  P('textured', 'Textured Crop', '6_primary.jpg', 900, 1200),
  P('textured', 'Textured Fringe', '7_primary.jpg', 1000, 1000),
  P('long-hair', 'Longer Textured Style', '8_primary.jpg', 900, 1200),
  P('long-hair', 'Swept-Back Long Style', '9_primary.jpg', 1200, 800),
  P('beards', 'Beard Shape-Up', '10_primary.jpg', 1000, 1000),
  P('beards', 'Full Beard Trim', '11_primary.jpg', 900, 1200),
  T('Fade Transformation', '12_before.jpg', '12_after.jpg'),
  T('Long-to-Short Transformation', '13_before.jpg', '13_after.jpg'),
]);

export const STARTER_REVIEWS = Object.freeze([
  { reviewer_name: 'J.', haircut_type: 'Skin Fade', quote: "[Placeholder review] Walked in unsure what I wanted and walked out with the best fade I've had. Replace with a real approved quote before launch." },
  { reviewer_name: 'M.', haircut_type: 'Taper Fade', quote: '[Placeholder review] Patient, precise, and easy to talk to. Replace with a real approved quote before launch.' },
  { reviewer_name: 'A.', haircut_type: 'Beard Trim & Lineup', quote: '[Placeholder review] My go-to for beard lineups now. Replace with a real approved quote before launch.' },
]);

export const STARTER_FAQS = Object.freeze([
  { question: 'How do I book?', answer: 'Send an appointment request through the booking page, or pick an open time directly on the calendar if one is available. Either way you will hear back to lock in the details.' },
  { question: 'Is my appointment confirmed right away?', answer: 'Hyrum personally reviews and confirms every request by text or email, usually the same day.' },
  { question: 'What should I bring for a reference?', answer: '[Owner to review: what reference photos or details are most helpful before an appointment?]' },
  { question: 'What if I need to reschedule or cancel?', answer: '[Owner to review: reschedule/cancellation policy and how much notice is needed.]' },
  { question: 'Where will I receive confirmation?', answer: 'By the contact method you provide on the request form (text or email).' },
]);

export const STARTER_SERVICES = Object.freeze([
  { name: 'Classic Haircut', description: 'A timeless cut, tailored to face shape and hair type.' },
  { name: 'Skin Fade', description: 'A close, blended fade from skin to length on top.' },
  { name: 'Taper Fade', description: 'A gradual blend that keeps more length through the sides.' },
  { name: 'Textured Crop', description: 'Shorter sides with a textured, low-maintenance top.' },
  { name: 'Beard Trim & Lineup', description: 'Beard shaping and a clean lineup.' },
  { name: 'Haircut + Beard Combo', description: 'A full haircut paired with a beard trim and lineup.' },
  { name: 'Kids Haircut', description: 'A patient, straightforward cut for younger clients.' },
]);

/**
 * The starter content shaped like the rows the public site normally fetches,
 * for use when no backend is connected. Media paths start with "/" so they
 * resolve to the bundled files (a real database path can never start with "/").
 */
export function starterPublicContent() {
  const categories = STARTER_CATEGORIES.map((c, i) => ({ id: `starter-cat-${c.slug}`, name: c.name, slug: c.slug, sort_order: i + 1 }));
  const img = (id, role, file, width, height, order = 0) => ({
    id,
    media_type: 'image',
    role,
    storage_path: `${STARTER_IMAGE_DIR}${file}`,
    card_path: null,
    poster_path: null,
    width,
    height,
    duration_seconds: null,
    mime_type: 'image/jpeg',
    sort_order: order,
  });
  const items = STARTER_ITEMS.map((s, i) => ({
    id: `starter-item-${i + 1}`,
    category_id: `starter-cat-${s.category}`,
    title: s.title,
    description: '',
    alt_text: s.alt,
    service_label: '',
    is_featured: s.featured,
    is_transformation: s.kind === 'transformation',
    sort_order: i + 1,
    gallery_media:
      s.kind === 'transformation'
        ? [img(`starter-m-${i + 1}-b`, 'before', s.before, s.width, s.height, 0), img(`starter-m-${i + 1}-a`, 'after', s.after, s.width, s.height, 1)]
        : [img(`starter-m-${i + 1}`, 'cover', s.file, s.width, s.height)],
  }));
  return {
    reachable: true,
    starter: true,
    settings: { ...STARTER_SETTINGS, profile_photo_path: STARTER_PORTRAIT },
    categories,
    items,
    reviews: STARTER_REVIEWS.map((r, i) => ({ id: `starter-review-${i + 1}`, ...r, sort_order: i + 1 })),
    faqs: STARTER_FAQS.map((f, i) => ({ id: `starter-faq-${i + 1}`, ...f, sort_order: i + 1 })),
    services: STARTER_SERVICES.map((s, i) => ({ id: `starter-service-${i + 1}`, name: s.name, description: s.description, sort_order: i + 1 })),
    errors: [],
  };
}
