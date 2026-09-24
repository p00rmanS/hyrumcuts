import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeWarnings } from '../src/admin/pages/dashboard-logic.js';
import { fetchPublicContent, normalizeItems, resolveHero, resolveSettings, visibleCategories } from '../src/lib/content.js';
import { readImageSize } from '../src/lib/media.js';
import { publicMediaUrl } from '../src/lib/media-url.js';
import {
  isPlaceholderBio,
  isPlaceholderFaq,
  isPlaceholderPath,
  isPlaceholderPortrait,
  isPlaceholderReview,
  itemHasPlaceholderMedia,
  summarizePlaceholders,
} from '../src/lib/placeholders.js';
import {
  STARTER_BIO,
  STARTER_CATEGORIES,
  STARTER_FAQS,
  STARTER_IMAGE_DIR,
  STARTER_ITEMS,
  STARTER_PORTRAIT,
  STARTER_PORTRAIT_SIZE,
  STARTER_REVIEWS,
  STARTER_SERVICES,
  starterPublicContent,
} from '../src/lib/starter-content.js';

const publicDir = path.resolve(import.meta.dirname, '../public');
const headOf = (rel) => {
  const buf = readFileSync(path.join(publicDir, rel.replace(/^\//, '')));
  return new Uint8Array(buf.buffer, buf.byteOffset, Math.min(buf.length, 64 * 1024));
};

describe('starter content matches what the original site launched with', () => {
  it('has the original 13 portfolio items: 11 photos + 2 before/after', () => {
    expect(STARTER_ITEMS).toHaveLength(13);
    expect(STARTER_ITEMS.filter((i) => i.kind === 'transformation')).toHaveLength(2);
    expect(STARTER_ITEMS.filter((i) => i.featured)).toHaveLength(5);
  });
  it('has the six original categories, five FAQs, three reviews and seven booking options', () => {
    expect(STARTER_CATEGORIES.map((c) => c.name)).toEqual(['Fades', 'Tapers', 'Textured', 'Long Hair', 'Beards', 'Transformations']);
    expect(STARTER_FAQS).toHaveLength(5);
    expect(STARTER_REVIEWS).toHaveLength(3);
    expect(STARTER_SERVICES).toHaveLength(7);
  });
  it('is honest: photos, reviews and unfinished answers are labelled as placeholders', () => {
    for (const item of STARTER_ITEMS) expect(item.alt).toMatch(/placeholder/i);
    for (const r of STARTER_REVIEWS) expect(r.quote).toMatch(/^\[Placeholder review\]/);
    expect(STARTER_FAQS.filter((f) => f.answer.startsWith('[Owner to review'))).toHaveLength(2);
  });
  it('invents no facts: no contact details, prices or ratings anywhere', () => {
    const all = JSON.stringify([STARTER_ITEMS, STARTER_FAQS, STARTER_REVIEWS, STARTER_SERVICES, STARTER_BIO]);
    expect(all).not.toMatch(/\$\d|\d\s?stars?|@\w+\.\w+|\(\d{3}\)/i);
  });
  it('every starter image exists on disk with the dimensions the layout assumes', () => {
    for (const item of STARTER_ITEMS) {
      const files = item.kind === 'transformation' ? [item.before, item.after] : [item.file];
      for (const file of files) {
        const size = readImageSize(headOf(`${STARTER_IMAGE_DIR}${file}`));
        expect(size, file).toEqual({ width: item.width, height: item.height });
      }
    }
    expect(readImageSize(headOf(STARTER_PORTRAIT))).toEqual(STARTER_PORTRAIT_SIZE);
  });
});

describe('the SQL seed and the bundled starter content stay word-for-word identical', () => {
  const sql = readFileSync(path.resolve(import.meta.dirname, '../../supabase/migrations/20260919000500_owner_bootstrap.sql'), 'utf8');
  const inSql = (text) => sql.includes(text.replace(/'/g, "''"));
  it('bio, FAQs, reviews and booking options', () => {
    expect(inSql(STARTER_BIO)).toBe(true);
    for (const f of STARTER_FAQS) {
      expect(inSql(f.question), f.question).toBe(true);
      expect(inSql(f.answer), f.answer).toBe(true);
    }
    for (const r of STARTER_REVIEWS) expect(inSql(r.quote), r.quote).toBe(true);
    for (const s of STARTER_SERVICES) expect(inSql(s.name), s.name).toBe(true);
  });
});

describe('when no backend is connected the site still looks complete', () => {
  it('fetchPublicContent(null) returns the starter content', async () => {
    const c = await fetchPublicContent(null);
    expect(c.starter).toBe(true);
    expect(c.reachable).toBe(true);
    expect(c.items).toHaveLength(13);
    expect(c.reviews).toHaveLength(3);
    expect(c.faqs).toHaveLength(5);
  });
  it('renders as 13 gallery cards with the right kinds, categories and bundled image URLs', () => {
    const c = starterPublicContent();
    const items = normalizeItems(c.items, c.categories);
    expect(items).toHaveLength(13);
    expect(items.filter((i) => i.kind === 'transformation')).toHaveLength(2);
    expect(items[0].image.full).toBe('/assets/images/gallery/1_primary.jpg');
    expect(visibleCategories(c.categories, items).map((x) => x.slug)).toEqual(['fades', 'tapers', 'textured', 'long-hair', 'beards', 'transformations']);
  });
  it('shows the About section content: the bio and the portrait', () => {
    const s = resolveSettings(starterPublicContent().settings);
    expect(s.about_bio).toBe(STARTER_BIO);
    expect(publicMediaUrl(s.profile_photo_path)).toBe(STARTER_PORTRAIT);
    expect(s.profile_photo_alt).toMatch(/placeholder/i);
  });
  it('keeps the bundled hero video until a real one is uploaded', () => {
    expect(resolveHero(resolveSettings(null)).video).toBe('/assets/video/hyrum1.mp4');
  });
});

describe('bundled paths can never be mistaken for storage paths', () => {
  it('only /assets/ paths are served directly; everything else goes through Storage', () => {
    expect(publicMediaUrl('/assets/images/gallery/1_primary.jpg')).toBe('/assets/images/gallery/1_primary.jpg');
    expect(publicMediaUrl('/etc/passwd')).toContain('/storage/v1/object/public/');
    expect(publicMediaUrl('/etc/passwd')).not.toBe('/etc/passwd');
  });
});

describe('placeholder detection (no flags to keep in sync)', () => {
  const OWNER = '11111111-1111-4111-8111-111111111111';
  it('recognises starter files by name, and stops once they are replaced', () => {
    expect(isPlaceholderPath(`${OWNER}/gallery/i/${OWNER}-starter.jpg`)).toBe(true);
    expect(isPlaceholderPath(`${OWNER}/gallery/i/abc-full.webp`)).toBe(false);
    expect(isPlaceholderPath('/assets/images/gallery/1_primary.jpg')).toBe(true);
    expect(isPlaceholderPath(null)).toBe(false);
  });
  it('a before/after item stays a placeholder until BOTH photos are replaced', () => {
    const half = { media: [{ storage_path: `${OWNER}/g/x-starter.jpg` }, { storage_path: `${OWNER}/g/y-full.webp` }] };
    const done = { media: [{ storage_path: `${OWNER}/g/x-full.webp` }, { storage_path: `${OWNER}/g/y-full.webp` }] };
    expect(itemHasPlaceholderMedia(half)).toBe(true);
    expect(itemHasPlaceholderMedia(done)).toBe(false);
  });
  it('reviews, FAQs and the bio stop being placeholders as soon as the text changes', () => {
    expect(isPlaceholderReview(STARTER_REVIEWS[0])).toBe(true);
    expect(isPlaceholderReview({ quote: 'Best fade ever, thanks Hyrum!' })).toBe(false);
    expect(isPlaceholderFaq(STARTER_FAQS[2])).toBe(true);
    expect(isPlaceholderFaq({ answer: 'Bring a photo or two.' })).toBe(false);
    expect(isPlaceholderBio(STARTER_BIO)).toBe(true);
    expect(isPlaceholderBio(`${STARTER_BIO} `)).toBe(true); // whitespace only: still the placeholder
    expect(isPlaceholderBio('I have been cutting hair for years.')).toBe(false);
    expect(isPlaceholderPortrait({ profile_photo_path: `${OWNER}/profile/z-starter.jpg` })).toBe(true);
    expect(isPlaceholderPortrait({ profile_photo_path: `${OWNER}/profile/z-portrait.webp` })).toBe(false);
  });
  it('summarises everything still to replace', () => {
    const c = starterPublicContent();
    const s = summarizePlaceholders({ items: c.items.map((i) => ({ media: i.gallery_media })), reviews: c.reviews, faqs: c.faqs, settings: { about_bio: STARTER_BIO, profile_photo_path: STARTER_PORTRAIT } });
    expect(s).toMatchObject({ photos: 13, reviews: 3, faqs: 2, bio: true, portrait: true, total: 20 });
    expect(summarizePlaceholders({}).total).toBe(0);
  });
});

describe('dashboard checklist for replacing placeholders', () => {
  const settings = { hero_video_path: 'o/h.mp4', hero_poster_path: 'o/p.webp', booking_provider: 'none', phone: '1', about_bio: 'x', profile_photo_path: 'o/p.webp', instagram_url: 'https://instagram.com/x' };
  it('lists what is left in plain words, and links to the filter', () => {
    const w = computeWarnings(settings, { published: 13 }, { photos: 13, reviews: 3, faqs: 2, bio: true, portrait: true, total: 20 });
    const ph = w.find((x) => x.id === 'placeholders');
    expect(ph.message).toMatch(/13 portfolio items, 3 reviews, 2 FAQ answers, your biography, your portrait/);
    expect(ph.href).toBe('/admin/portfolio?status=placeholder');
  });
  it('disappears once everything is replaced', () => {
    const w = computeWarnings(settings, { published: 13 }, { photos: 0, reviews: 0, faqs: 0, bio: false, portrait: false, total: 0 });
    expect(w.find((x) => x.id === 'placeholders')).toBeUndefined();
  });
  it('uses singular wording for a single item', () => {
    const w = computeWarnings(settings, { published: 1 }, { photos: 1, reviews: 1, faqs: 1, bio: false, portrait: false, total: 3 });
    expect(w[0].message).toMatch(/1 portfolio item, 1 review, 1 FAQ answer\./);
  });
});
