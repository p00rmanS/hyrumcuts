import { describe, expect, it } from 'vitest';
import { announcementStatus, formatDay } from '../src/lib/content.js';
import { matchesSearch, portfolioQuery, searchPreview, SECTION_PUBLIC_PATH } from '../src/admin/pages/settings-helpers.js';
import { SETTINGS_SECTIONS } from '../src/admin/validation/settings.js';
import { matchRoute } from '../src/admin/router.js';

describe('announcement status for the admin', () => {
  const base = { announcement_text: 'Away', timezone: 'America/Denver' };
  const now = new Date('2026-10-05T18:00:00Z');

  it('reports off, live, scheduled and ended', () => {
    expect(announcementStatus({ ...base, announcement_text: '' }, now).state).toBe('off');
    expect(announcementStatus(base, now).state).toBe('live');
    expect(announcementStatus({ ...base, announcement_starts_on: '2026-10-07' }, now).state).toBe('scheduled');
    expect(announcementStatus({ ...base, announcement_ends_on: '2026-10-04' }, now).state).toBe('ended');
    expect(announcementStatus({ ...base, announcement_starts_on: '2026-10-03', announcement_ends_on: '2026-10-10' }, now).state).toBe('live');
  });
  it('explains itself in plain words with readable dates', () => {
    expect(announcementStatus({ ...base, announcement_starts_on: '2026-10-07', announcement_ends_on: '2026-10-10' }, now).message).toBe('Scheduled. It starts showing on Wed, Oct 7 and stops after Sat, Oct 10.');
    expect(announcementStatus(base, now).message).toMatch(/until you turn it off/);
  });
  it('formats calendar dates without shifting them', () => {
    expect(formatDay('2026-01-01')).toBe('Thu, Jan 1');
    expect(formatDay('nonsense')).toBe('nonsense');
  });
});

describe('Google search preview', () => {
  it('shows the title, host and description', () => {
    const p = searchPreview({ seo_title: 'HyrumHaircuts — Precision Cuts', seo_description: 'Fades and tapers by Hyrum.', canonical_url: 'https://hyrumhaircuts.com/' });
    expect(p).toEqual({ title: 'HyrumHaircuts — Precision Cuts', description: 'Fades and tapers by Hyrum.', url: 'hyrumhaircuts.com', tips: [] });
  });
  it('clips long text on a word boundary and says why', () => {
    const p = searchPreview({ seo_title: 'Word '.repeat(20), seo_description: 'x '.repeat(100), canonical_url: '' });
    expect(p.title.length).toBeLessThanOrEqual(60);
    expect(p.title.endsWith('…')).toBe(true);
    expect(p.tips).toHaveLength(2);
  });
  it('asks for a description when there is none and falls back to the brand name', () => {
    const p = searchPreview({ seo_title: '', seo_description: '', canonical_url: 'not a url' }, { fallbackTitle: 'HyrumHaircuts' });
    expect(p.title).toBe('HyrumHaircuts');
    expect(p.url).toBe('hyrumhaircuts.com');
    expect(p.tips[0]).toMatch(/Add a description/);
  });
});

describe('Manage Work search and filters', () => {
  const item = { title: 'Skin Fade, Crème Top', service_label: 'Skin fade', description: '', category: { name: 'Fades' } };
  it('matches every word, ignoring case and accents', () => {
    expect(matchesSearch(item, '')).toBe(true);
    expect(matchesSearch(item, 'creme')).toBe(true);
    expect(matchesSearch(item, 'FADES skin')).toBe(true);
    expect(matchesSearch(item, 'taper')).toBe(false);
  });
  it('keeps filters in the URL, omitting defaults', () => {
    expect(portfolioQuery({ status: 'all', categoryId: '', search: '  ' })).toBe('');
    expect(portfolioQuery({ status: 'draft', categoryId: 'c1', search: 'fade' })).toBe('?status=draft&category=c1&q=fade');
  });
});

describe('"See it on your website" links', () => {
  it('cover every settings page and point at real public pages', () => {
    for (const key of Object.keys(SETTINGS_SECTIONS)) expect(SECTION_PUBLIC_PATH, key).toHaveProperty(key);
    for (const path of Object.values(SECTION_PUBLIC_PATH).filter(Boolean)) expect(path).toMatch(/^\/(booking\/|#[a-z]+)?$/);
  });
  it('dashboard filter links resolve to the Manage Work page', () => {
    expect(matchRoute('/admin/portfolio')?.route.key).toBe('portfolio');
  });
});
