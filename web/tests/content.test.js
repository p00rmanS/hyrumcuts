import { describe, expect, it } from 'vitest';
import {
  HERO_FALLBACK,
  SETTINGS_FALLBACK,
  buildStructuredData,
  fetchPublicContent,
  filterItems,
  normalizeItems,
  resolveHero,
  resolveSettings,
  usableFaqs,
  usableReviews,
  visibleCategories,
} from '../src/lib/content.js';

const OWNER = '11111111-1111-1111-1111-111111111111';
const categories = [
  { id: 'c-fades', name: 'Fades', slug: 'fades', sort_order: 2 },
  { id: 'c-tapers', name: 'Tapers', slug: 'tapers', sort_order: 1 },
  { id: 'c-empty', name: 'Beards', slug: 'beards', sort_order: 3 },
];

const img = (over = {}) => ({
  id: `m-${Math.random()}`,
  media_type: 'image',
  role: 'cover',
  storage_path: `${OWNER}/gallery/i/full.webp`,
  card_path: `${OWNER}/gallery/i/card.webp`,
  poster_path: null,
  width: 800,
  height: 1000,
  mime_type: 'image/webp',
  sort_order: 0,
  ...over,
});

const item = (over = {}) => ({
  id: `i-${Math.random()}`,
  category_id: 'c-fades',
  title: 'Skin fade',
  description: '',
  alt_text: 'A skin fade',
  service_label: '',
  is_featured: false,
  is_transformation: false,
  sort_order: 0,
  gallery_media: [img()],
  ...over,
});

describe('normalizeItems', () => {
  it('builds a display model with card thumbnail and full image', () => {
    const [it1] = normalizeItems([item()], categories);
    expect(it1.kind).toBe('image');
    expect(it1.categorySlug).toBe('fades');
    expect(it1.image.full).toContain('/site-media/');
    expect(it1.image.thumb).not.toBe(it1.image.full);
  });

  it('drops items with nothing renderable instead of showing broken cards', () => {
    expect(normalizeItems([item({ gallery_media: [] })], categories)).toHaveLength(0);
    // video without a poster is not renderable
    const noPoster = item({ gallery_media: [img({ media_type: 'video', mime_type: 'video/mp4', role: 'gallery' })] });
    expect(normalizeItems([noPoster], categories)).toHaveLength(0);
  });

  it('renders a video item when it has a poster', () => {
    const v = item({ gallery_media: [img({ media_type: 'video', mime_type: 'video/mp4', role: 'gallery', poster_path: `${OWNER}/gallery/i/p.webp` })] });
    const [out] = normalizeItems([v], categories);
    expect(out.kind).toBe('video');
    expect(out.video.poster).toContain('p.webp');
  });

  it('builds a before/after transformation only when both images exist', () => {
    const pair = item({ is_transformation: true, gallery_media: [img({ role: 'before' }), img({ role: 'after' })] });
    expect(normalizeItems([pair], categories)[0].kind).toBe('transformation');
    const half = item({ is_transformation: true, gallery_media: [img({ role: 'before' })] });
    expect(normalizeItems([half], categories)).toHaveLength(0);
  });

  it('sorts by owner order, then title, deterministically', () => {
    const items = [
      item({ id: 'a', title: 'Zed', sort_order: 1 }),
      item({ id: 'b', title: 'Alpha', sort_order: 2 }),
      item({ id: 'c', title: 'Beta', sort_order: 1 }),
    ];
    expect(normalizeItems(items, categories).map((i) => i.title)).toEqual(['Beta', 'Zed', 'Alpha']);
  });

  it('tolerates an uncategorised item', () => {
    const [out] = normalizeItems([item({ category_id: null })], categories);
    expect(out.categorySlug).toBe('');
  });
});

describe('gallery filtering', () => {
  const items = normalizeItems(
    [item({ id: '1', category_id: 'c-fades' }), item({ id: '2', category_id: 'c-tapers' }), item({ id: '3', category_id: null })],
    categories,
  );
  it('"all" shows every item', () => {
    expect(filterItems(items, 'all')).toHaveLength(3);
    expect(filterItems(items, '')).toHaveLength(3);
  });
  it('filters by category slug', () => {
    expect(filterItems(items, 'fades')).toHaveLength(1);
    expect(filterItems(items, 'tapers')[0].id).toBe('2');
    expect(filterItems(items, 'nope')).toHaveLength(0);
  });
  it('only offers filters that would show something, in owner order', () => {
    expect(visibleCategories(categories, items).map((c) => c.slug)).toEqual(['tapers', 'fades']);
  });
});

describe('settings', () => {
  it('never leaks undefined/null into text fields', () => {
    const s = resolveSettings({ hero_heading: null, phone: undefined, about_bio: 42 });
    expect(s.hero_heading).toBe(SETTINGS_FALLBACK.hero_heading);
    expect(s.phone).toBe('');
    expect(typeof s.about_bio).toBe('string');
    for (const [k, v] of Object.entries(s)) expect(v, k).not.toBeUndefined();
  });
  it('falls back to brand-critical copy when the database is unavailable', () => {
    const s = resolveSettings(null);
    expect(s.brand_name).toBe('HyrumHaircuts');
    expect(s.phone).toBe('');
    expect(s.instagram_url).toBe('');
  });
  it('ignores unknown columns', () => {
    expect(resolveSettings({ owner_id: 'x', evil: '<script>' })).not.toHaveProperty('evil');
  });
});

describe('hero media', () => {
  it('uses bundled fallbacks until the owner uploads media', () => {
    const hero = resolveHero(resolveSettings({}));
    expect(hero.video).toBe(HERO_FALLBACK.video);
    expect(hero.poster).toBe(HERO_FALLBACK.poster);
    expect(hero.isCustom).toBe(false);
  });
});

describe('reviews and FAQs', () => {
  it('drops blank rows', () => {
    expect(usableReviews([{ quote: ' ', reviewer_name: 'A' }, { quote: 'Great', reviewer_name: 'A' }])).toHaveLength(1);
    expect(usableFaqs([{ question: 'Q', answer: '' }, { question: 'Q', answer: 'A' }])).toHaveLength(1);
  });
});

describe('structured data', () => {
  it('only includes facts the owner entered', () => {
    const data = buildStructuredData(resolveSettings({}), 'https://hyrumhaircuts.com');
    expect(data['@type']).toBe('BarberShop');
    expect(data.name).toBe('HyrumHaircuts');
    for (const invented of ['address', 'aggregateRating', 'priceRange', 'telephone', 'review', 'foundingDate']) {
      expect(data).not.toHaveProperty(invented);
    }
  });
  it('adds contact and social links when present, https only', () => {
    const data = buildStructuredData(
      resolveSettings({ phone: '801-555-0100', instagram_url: 'https://instagram.com/h', facebook_url: 'javascript:alert(1)' }),
      'https://hyrumhaircuts.com',
    );
    expect(data.telephone).toBe('801-555-0100');
    expect(data.sameAs).toEqual(['https://instagram.com/h']);
  });
});

/** A minimal PostgREST-like fake that records the filters it was given. */
function fakeClient(tables, { failing = [] } = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const q = { table, filters: [], order: null };
      const chain = {
        select() { return chain; },
        eq(col, val) { q.filters.push(['eq', col, val]); return chain; },
        is(col, val) { q.filters.push(['is', col, val]); return chain; },
        order(col) { q.order = col; return chain; },
        limit() { return chain; },
        maybeSingle() { q.single = true; return chain; },
        abortSignal() { return chain; },
        then(resolve) {
          calls.push(q);
          if (failing.includes(table)) return resolve({ data: null, error: { message: 'boom' } });
          const rows = tables[table] ?? [];
          resolve({ data: q.single ? rows[0] ?? null : rows, error: null });
        },
      };
      return chain;
    },
  };
  return client;
}

describe('fetchPublicContent', () => {
  it('asks only for published, non-archived rows', async () => {
    const client = fakeClient({ site_settings: [{ brand_name: 'X' }], gallery_items: [], faqs: [], reviews: [], gallery_categories: [], services: [] });
    await fetchPublicContent(client);
    const byTable = Object.fromEntries(client.calls.map((c) => [c.table, c.filters]));
    expect(byTable.gallery_items).toEqual(expect.arrayContaining([['eq', 'is_published', true], ['is', 'archived_at', null]]));
    expect(byTable.reviews).toEqual(expect.arrayContaining([['eq', 'is_published', true], ['is', 'archived_at', null]]));
    expect(byTable.faqs).toEqual(expect.arrayContaining([['eq', 'is_published', true], ['is', 'archived_at', null]]));
    expect(byTable.gallery_categories).toEqual(expect.arrayContaining([['eq', 'is_published', true]]));
    expect(byTable.services).toEqual(expect.arrayContaining([['eq', 'is_published', true]]));
  });

  it('never queries private tables', async () => {
    const client = fakeClient({});
    await fetchPublicContent(client);
    const tables = client.calls.map((c) => c.table);
    for (const priv of ['admin_audit_log', 'site_owner', 'storage_cleanup_queue']) expect(tables).not.toContain(priv);
  });

  it('one failing section does not break the rest', async () => {
    const client = fakeClient({ site_settings: [{ brand_name: 'X' }], reviews: [{ id: 1 }] }, { failing: ['gallery_items'] });
    const out = await fetchPublicContent(client);
    expect(out.reachable).toBe(true);
    expect(out.items).toEqual([]);
    expect(out.reviews).toHaveLength(1);
    expect(out.errors).toContain('items');
  });

  it('reports unreachable when core settings fail, so bundled copy is used', async () => {
    const out = await fetchPublicContent(fakeClient({}, { failing: ['site_settings'] }));
    expect(out.reachable).toBe(false);
  });

  it('shows the bundled starter content when no backend is configured (never when one is merely unreachable)', async () => {
    const out = await fetchPublicContent(null);
    expect(out.starter).toBe(true);
    expect(out.items.length).toBeGreaterThan(0);
    const down = await fetchPublicContent(fakeClient({}, { failing: ['site_settings'] }));
    expect(down.starter).toBeUndefined();
    expect(down.items).toEqual([]);
  });
});
