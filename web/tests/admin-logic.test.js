import { describe, expect, it } from 'vitest';
import { ROUTES, matchRoute, safeNextPath } from '../src/admin/router.js';
import { NAV } from '../src/admin/shell.js';
import { computeWarnings, describeActivity } from '../src/admin/pages/dashboard-logic.js';
import { timeAgo } from '../src/admin/ui.js';

describe('admin routing', () => {
  it('matches every route in the navigation', () => {
    const hrefs = NAV.flatMap((e) => (e.group ? e.items : [e])).map((i) => i.href);
    for (const href of hrefs) expect(matchRoute(href), href).not.toBeNull();
  });
  it('static segments win over :id, so "add" and "categories" are never treated as an item id', () => {
    expect(matchRoute('/admin/portfolio/add').route.key).toBe('portfolio-add');
    expect(matchRoute('/admin/portfolio/categories').route.key).toBe('categories');
    const item = matchRoute('/admin/portfolio/0f8e-4c1a');
    expect(item.route.title).toBe('Edit work');
    expect(item.params.id).toBe('0f8e-4c1a');
  });
  it('tolerates trailing slashes and rejects unknown paths', () => {
    expect(matchRoute('/admin/')?.route.key).toBe('dashboard');
    expect(matchRoute('/admin/reviews/')?.route.key).toBe('reviews');
    expect(matchRoute('/admin/nope')).toBeNull();
    expect(matchRoute('/administrator')).toBeNull();
    expect(matchRoute('/')).toBeNull();
  });
  it('only the sign-in and reset pages are public', () => {
    expect(ROUTES.filter((r) => r.public).map((r) => r.path).sort()).toEqual(['/admin/login', '/admin/reset-password']);
  });
  it('every page has a title', () => {
    for (const r of ROUTES) expect(r.title.length, r.path).toBeGreaterThan(2);
  });
});

describe('safeNextPath (no open redirects after sign-in)', () => {
  it('keeps normal admin destinations', () => {
    expect(safeNextPath('/admin/portfolio?status=draft')).toBe('/admin/portfolio?status=draft');
    expect(safeNextPath('/admin/portfolio/abc')).toBe('/admin/portfolio/abc');
  });
  it('refuses anything that leaves the admin', () => {
    for (const evil of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/etc/passwd', '/adminevil', '', null, undefined, 42]) {
      expect(safeNextPath(evil), String(evil)).toBe(safeNextPath('/admin'));
    }
  });
  it('never bounces back to the login or reset pages', () => {
    expect(safeNextPath('/admin/login')).toBe('/admin');
    expect(safeNextPath('/admin/reset-password?code=x')).toBe('/admin');
  });
});

describe('dashboard warnings', () => {
  const healthy = {
    hero_video_path: 'o/hero/v.mp4',
    hero_poster_path: 'o/hero/p.webp',
    booking_provider: 'calendly',
    booking_url: 'https://calendly.com/x',
    phone: '555',
    email: '',
    about_bio: 'bio',
    profile_photo_path: 'o/profile/x.webp',
    instagram_url: 'https://instagram.com/x',
    facebook_url: '',
  };
  const counts = { published: 5, drafts: 1, reviews: 2, faqs: 3 };
  it('is quiet when everything is set up', () => {
    expect(computeWarnings(healthy, counts)).toEqual([]);
  });
  it('flags a hero video with no poster as a warning', () => {
    const w = computeWarnings({ ...healthy, hero_poster_path: null }, counts);
    expect(w.map((x) => x.id)).toEqual(['hero-poster']);
    expect(w[0].level).toBe('warn');
  });
  it('flags missing hero video, booking link, contact and an empty portfolio', () => {
    const ids = computeWarnings({ ...healthy, hero_video_path: null, booking_url: '', phone: '', email: '  ' }, { ...counts, published: 0 }).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['hero-video', 'booking', 'contact', 'portfolio']));
  });
  it('does not nag about a booking link when the provider is "none"', () => {
    expect(computeWarnings({ ...healthy, booking_provider: 'none', booking_url: '' }, counts).map((x) => x.id)).not.toContain('booking');
  });
  it('every warning links to a real admin page', () => {
    const all = computeWarnings({ hero_video_path: null, booking_provider: 'calendly', booking_url: '', about_bio: '' }, { published: 0 });
    for (const w of all) expect(matchRoute(w.href), w.href).not.toBeNull();
  });
});

describe('activity descriptions', () => {
  it('reads like plain English', () => {
    expect(describeActivity({ action: 'publish', entity_type: 'gallery_items' })).toBe('Published a portfolio item');
    expect(describeActivity({ action: 'archive', entity_type: 'reviews' })).toBe('Archived a review');
    expect(describeActivity({ action: 'unpublish', entity_type: 'faqs' })).toMatch(/draft/);
    expect(describeActivity({ action: 'update', entity_type: 'site_settings', metadata: { changed: ['phone', 'booking_url', 'unknown_col'] } })).toBe('Updated website settings (phone, booking link)');
  });
  it('never shows raw column values or table names for unknown entities', () => {
    expect(describeActivity({ action: 'update', entity_type: 'mystery' })).toBe('Updated content');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-09-19T12:00:00Z').getTime();
  it('formats relative times', () => {
    expect(timeAgo('2026-09-19T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-09-19T11:55:00Z', now)).toBe('5 minutes ago');
    expect(timeAgo('2026-09-19T11:00:00Z', now)).toBe('1 hour ago');
    expect(timeAgo('2026-09-17T12:00:00Z', now)).toBe('2 days ago');
  });
});
