import { getPublicClient } from './supabase-client.js';
import { publicMediaUrl } from './media-url.js';
import { safeHttpUrl } from './urls.js';
import { IMAGE } from './media-config.js';
import { starterPublicContent } from './starter-content.js';

/**
 * Brand-critical copy used ONLY when the database cannot be reached. It
 * matches the database defaults, contains no invented facts, and no contact
 * details, so a Supabase outage degrades to a clean, honest page.
 */
export const SETTINGS_FALLBACK = Object.freeze({
  brand_name: 'HyrumHaircuts',
  barber_name: 'Hyrum',
  hero_eyebrow: 'Precision cuts. Personal style.',
  hero_heading: 'A sharper look, cut for you.',
  hero_subheading: 'Modern cuts, clean fades, and detail-first grooming by Hyrum.',
  cta_book_label: 'Book Your Next Cut',
  cta_view_work_label: 'View My Work',
  cta_gallery_label: "Let's Get You Fresh",
  cta_banner_label: 'Reserve Your Chair',
  gallery_all_label: 'All Cuts',
  about_heading: 'The barber behind the chair.',
  about_bio: '',
  about_specialties: '',
  location_general: '',
  availability_note: '',
  preferred_contact: '',
  profile_photo_alt: '',
  phone: '',
  email: '',
  instagram_url: '',
  facebook_url: '',
  map_url: '',
  privacy_contact_email: '',
  booking_provider: 'none',
  booking_url: '',
  booking_time_windows: [],
  seo_title: 'HyrumHaircuts — Precision Cuts, Personal Style',
  seo_description: '',
  canonical_url: '',
  timezone: 'America/Denver',
  credit_text: '',
  announcement_text: '',
  announcement_link_url: '',
  announcement_link_label: '',
  announcement_starts_on: null,
  announcement_ends_on: null,
  hero_video_path: null,
  hero_poster_path: null,
  profile_photo_path: null,
  seo_image_path: null,
});

/** Bundled fallbacks for the hero, used until the owner uploads their own. */
export const HERO_FALLBACK = Object.freeze({
  video: '/assets/video/hyrum1.mp4',
  poster: '/assets/images/placeholders/hero-poster.jpg',
});

const SETTINGS_COLUMNS = Object.keys(SETTINGS_FALLBACK).join(',');
const ITEM_COLUMNS =
  'id,category_id,title,description,alt_text,service_label,is_featured,is_transformation,sort_order,' +
  'gallery_media(id,media_type,role,storage_path,card_path,poster_path,width,height,duration_seconds,mime_type,sort_order)';

const REQUEST_TIMEOUT_MS = 10_000;

function timeoutSignal() {
  return typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined;
}

/** Run one query; never throws. Returns { data, error }. */
async function run(build) {
  try {
    const signal = timeoutSignal();
    let query = build();
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    return { data: error ? null : data, error: error ?? null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Fetch everything the public site shows, in parallel. Only published,
 * non-archived rows are requested, and only the columns the page needs.
 * A failure in one section never blocks the others.
 *
 * @param {import('@supabase/postgrest-js').PostgrestClient | null} [client]
 */
export async function fetchPublicContent(client = getPublicClient()) {
  // No backend connected at all (e.g. a preview build before Supabase is set up):
  // show the bundled starter content so the site looks complete. This is NOT used
  // when a backend is configured but unreachable, so an outage can never show
  // placeholder work in place of Hyrum's real content.
  if (!client) return starterPublicContent();

  const [settings, categories, items, reviews, faqs, services] = await Promise.all([
    run(() => client.from('site_settings').select(SETTINGS_COLUMNS).limit(1).maybeSingle()),
    run(() =>
      client.from('gallery_categories').select('id,name,slug,sort_order').eq('is_published', true).order('sort_order', { ascending: true }),
    ),
    run(() =>
      client
        .from('gallery_items')
        .select(ITEM_COLUMNS)
        .eq('is_published', true)
        .is('archived_at', null)
        .order('sort_order', { ascending: true }),
    ),
    run(() =>
      client
        .from('reviews')
        .select('id,reviewer_name,quote,haircut_type,sort_order')
        .eq('is_published', true)
        .is('archived_at', null)
        .order('sort_order', { ascending: true }),
    ),
    run(() =>
      client
        .from('faqs')
        .select('id,question,answer,sort_order')
        .eq('is_published', true)
        .is('archived_at', null)
        .order('sort_order', { ascending: true }),
    ),
    run(() => client.from('services').select('id,name,description,sort_order').eq('is_published', true).order('sort_order', { ascending: true })),
  ]);

  const errors = Object.entries({ settings, categories, items, reviews, faqs, services })
    .filter(([, r]) => r.error)
    .map(([name]) => name);

  return {
    // "Reachable" means the core settings request worked. Without it we fall back to bundled copy.
    reachable: !settings.error,
    settings: settings.data ?? null,
    categories: categories.data ?? [],
    items: items.data ?? [],
    reviews: reviews.data ?? [],
    faqs: faqs.data ?? [],
    services: services.data ?? [],
    errors,
  };
}

/** Merge database settings over the safe fallbacks; unknown/empty types never leak `undefined`. */
export function resolveSettings(dbSettings) {
  const merged = { ...SETTINGS_FALLBACK };
  if (dbSettings && typeof dbSettings === 'object') {
    for (const key of Object.keys(SETTINGS_FALLBACK)) {
      const value = dbSettings[key];
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }
  // Text-ish fields must be strings so templates never print "undefined" or "null".
  for (const [key, fallback] of Object.entries(SETTINGS_FALLBACK)) {
    if (typeof fallback === 'string' && typeof merged[key] !== 'string') merged[key] = fallback;
  }
  if (!Array.isArray(merged.booking_time_windows)) merged.booking_time_windows = [];
  return merged;
}

/** Today's date as YYYY-MM-DD in the given IANA time zone (falls back to UTC for a bad zone). */
export function todayIn(timeZone, now = new Date()) {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * The announcement to show right now, or null. Start and end dates are
 * inclusive and read in the site's own time zone, so "until Oct 10" means
 * the whole of Oct 10 where Hyrum works.
 *
 * @returns {{ text: string, link: { href: string, label: string } | null } | null}
 */
export function activeAnnouncement(settings, now = new Date()) {
  const text = settings.announcement_text?.trim();
  if (!text) return null;
  const today = todayIn(settings.timezone, now);
  if (settings.announcement_starts_on && today < settings.announcement_starts_on) return null;
  if (settings.announcement_ends_on && today > settings.announcement_ends_on) return null;
  const href = safeHttpUrl(settings.announcement_link_url, { httpsOnly: true });
  const label = settings.announcement_link_label?.trim();
  return { text, link: href && label ? { href, label } : null };
}

/** Hero media URLs, with bundled fallbacks. */
export function resolveHero(settings) {
  return {
    video: publicMediaUrl(settings.hero_video_path) || HERO_FALLBACK.video,
    poster: publicMediaUrl(settings.hero_poster_path) || HERO_FALLBACK.poster,
    isCustom: Boolean(settings.hero_video_path),
  };
}

/** Scale (w, h) so the longest side is at most `longest`, never upscaling. */
export function scaleToLongest(w, h, longest) {
  if (!w || !h) return { width: null, height: null };
  const ratio = Math.min(1, longest / Math.max(w, h));
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function mediaView(m) {
  if (!m) return null;
  const full = publicMediaUrl(m.storage_path);
  const thumbSize = m.card_path ? scaleToLongest(m.width, m.height, IMAGE.card.longestSide) : { width: m.width, height: m.height };
  return {
    full,
    thumb: publicMediaUrl(m.card_path) || full,
    thumbWidth: thumbSize.width,
    thumbHeight: thumbSize.height,
    poster: publicMediaUrl(m.poster_path),
    width: m.width ?? null,
    height: m.height ?? null,
    mime: m.mime_type,
    duration: m.duration_seconds ?? null,
  };
}

/**
 * Turn raw gallery rows into display objects. Items that have nothing
 * renderable (no usable image, no complete pair, no video with a poster) are
 * dropped rather than shown as broken cards.
 *
 * @returns {Array<{
 *   id: string, title: string, description: string, altText: string, serviceLabel: string,
 *   featured: boolean, categorySlug: string, kind: 'image'|'transformation'|'video', sortOrder: number,
 *   image: object|null, before: object|null, after: object|null, video: object|null
 * }>}
 */
export function normalizeItems(rawItems, categories = []) {
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  const out = [];

  for (const item of rawItems ?? []) {
    const media = [...(item.gallery_media ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const images = media.filter((m) => m.media_type === 'image');
    const cover = images.find((m) => m.role === 'cover') ?? images.find((m) => m.role === 'gallery') ?? null;
    const before = images.find((m) => m.role === 'before') ?? null;
    const after = images.find((m) => m.role === 'after') ?? null;
    const video = media.find((m) => m.media_type === 'video') ?? null;

    let kind = null;
    if (item.is_transformation && before && after) kind = 'transformation';
    else if (cover) kind = 'image';
    else if (video && video.poster_path) kind = 'video';
    if (!kind) continue;

    out.push({
      id: item.id,
      title: item.title ?? '',
      description: item.description ?? '',
      altText: item.alt_text ?? '',
      serviceLabel: item.service_label ?? '',
      featured: Boolean(item.is_featured),
      categorySlug: slugById.get(item.category_id) ?? '',
      kind,
      sortOrder: item.sort_order ?? 0,
      image: kind === 'image' ? mediaView(cover) : null,
      before: kind === 'transformation' ? mediaView(before) : null,
      after: kind === 'transformation' ? mediaView(after) : null,
      video: kind === 'video' ? mediaView(video) : null,
    });
  }

  return sortItems(out);
}

/** Display order: owner-defined order, ties broken by title so it is always stable. */
export function sortItems(items) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

/** 'all' (or empty) shows everything; otherwise only items in that category. */
export function filterItems(items, slug) {
  if (!slug || slug === 'all') return items;
  return items.filter((item) => item.categorySlug === slug);
}

/** Only offer a filter for categories that would actually show something. */
export function visibleCategories(categories, items) {
  const used = new Set(items.map((i) => i.categorySlug));
  return [...categories].sort((a, b) => a.sort_order - b.sort_order).filter((c) => used.has(c.slug));
}

/** Reviews and FAQs: defensive clean-up so a blank row never renders an empty card. */
export function usableReviews(reviews) {
  return (reviews ?? []).filter((r) => r.quote?.trim() && r.reviewer_name?.trim());
}
export function usableFaqs(faqs) {
  return (faqs ?? []).filter((f) => f.question?.trim() && f.answer?.trim());
}
export function usableServices(services) {
  return (services ?? []).filter((s) => s.name?.trim());
}

const ABOUT_TEXT_KEYS = ['about_bio', 'about_specialties', 'availability_note', 'preferred_contact'];

/** Whether the About section has anything to show. */
export function hasAboutContent(settings) {
  return ABOUT_TEXT_KEYS.some((k) => settings[k]?.trim()) || Boolean(publicMediaUrl(settings.profile_photo_path));
}

/**
 * Which optional home-page sections exist, so every page (not just the home
 * page) can show the matching navigation links.
 */
export function sectionAvailability(settings, content) {
  return {
    about: hasAboutContent(settings),
    services: usableServices(content.services).length > 0,
    reviews: usableReviews(content.reviews).length > 0,
    faq: usableFaqs(content.faqs).length > 0,
  };
}

/**
 * schema.org JSON-LD built ONLY from facts the owner has entered. No address,
 * rating, review count, price range or years of experience is ever invented.
 */
export function buildStructuredData(settings, siteUrl) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BarberShop',
    name: settings.brand_name,
  };
  const url = safeHttpUrl(siteUrl, { httpsOnly: true });
  if (url) data.url = url;
  const phone = settings.phone?.trim();
  if (phone) data.telephone = phone;
  const email = settings.email?.trim();
  if (email) data.email = email;
  const same = [settings.instagram_url, settings.facebook_url].map((u) => safeHttpUrl(u, { httpsOnly: true })).filter(Boolean);
  if (same.length) data.sameAs = same;
  const image = publicMediaUrl(settings.seo_image_path);
  if (image) data.image = image;
  if (settings.seo_description?.trim()) data.description = settings.seo_description.trim();
  return data;
}
