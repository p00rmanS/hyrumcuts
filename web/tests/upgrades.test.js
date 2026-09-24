import { describe, expect, it } from 'vitest';
import { activeAnnouncement, resolveSettings, sectionAvailability, todayIn, usableServices } from '../src/lib/content.js';
import { isSafeUrlAttribute } from '../src/lib/dom.js';
import { starterPublicContent } from '../src/lib/starter-content.js';
import { matchRoute } from '../src/admin/router.js';
import { cleanValue, SETTINGS_SECTIONS, validateSection } from '../src/admin/validation/settings.js';
import { idFromHash, workHash } from '../src/public-site/gallery.js';

describe('dom: URL attribute guard', () => {
  it('allows normal links', () => {
    expect(isSafeUrlAttribute('https://example.com/a.jpg')).toBe(true);
    expect(isSafeUrlAttribute('/booking/')).toBe(true);
    expect(isSafeUrlAttribute('#work')).toBe(true);
  });
  it('refuses script schemes, including ones hidden with whitespace or control characters', () => {
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', '\u0001javascript:alert(1)', 'vbscript:x', 'data:text/html,<b>']) {
      expect(isSafeUrlAttribute(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('router: malformed URLs', () => {
  it('treats a broken percent-escape as "not found" instead of throwing', () => {
    expect(() => matchRoute('/admin/portfolio/%E0%A4%A')).not.toThrow();
    expect(matchRoute('/admin/portfolio/%E0%A4%A')).toBeNull();
  });
  it('still decodes valid escapes', () => {
    expect(matchRoute('/admin/portfolio/a%20b')?.params.id).toBe('a b');
  });
});

describe('gallery: shareable "#work/<id>" links', () => {
  it('round-trips ids', () => {
    for (const id of ['0f8e-4c1a', 'starter-item-3', 'odd id/with?chars']) expect(idFromHash(workHash(id))).toBe(id);
  });
  it('ignores other hashes and bad escapes', () => {
    expect(idFromHash('#work')).toBe('');
    expect(idFromHash('#faq')).toBe('');
    expect(idFromHash('')).toBe('');
    expect(idFromHash(undefined)).toBe('');
    expect(idFromHash('#work/%E0%A4%A')).toBe('');
  });
});

describe('announcement bar', () => {
  const base = resolveSettings({ announcement_text: 'Away Oct 3–10', timezone: 'America/Denver' });
  // 2026-10-11 03:00 UTC is still Oct 10 in Denver.
  const lateOct10Denver = new Date('2026-10-11T03:00:00Z');

  it('is off when there is no message', () => {
    expect(activeAnnouncement(resolveSettings({}))).toBeNull();
    expect(activeAnnouncement(resolveSettings({ announcement_text: '   ' }))).toBeNull();
  });
  it('shows with no dates', () => {
    expect(activeAnnouncement(base)).toEqual({ text: 'Away Oct 3–10', link: null });
  });
  it('respects inclusive start/end dates in the site time zone', () => {
    const s = { ...base, announcement_starts_on: '2026-10-03', announcement_ends_on: '2026-10-10' };
    expect(activeAnnouncement(s, new Date('2026-10-02T12:00:00Z'))).toBeNull();
    expect(activeAnnouncement(s, new Date('2026-10-03T12:00:00Z'))).not.toBeNull();
    expect(activeAnnouncement(s, lateOct10Denver)).not.toBeNull();
    expect(activeAnnouncement(s, new Date('2026-10-11T12:00:00Z'))).toBeNull();
  });
  it('only links to https URLs, and only with link text', () => {
    expect(activeAnnouncement({ ...base, announcement_link_url: 'https://calendly.com/x', announcement_link_label: 'Book' }).link).toEqual({ href: 'https://calendly.com/x', label: 'Book' });
    expect(activeAnnouncement({ ...base, announcement_link_url: 'javascript:alert(1)', announcement_link_label: 'Book' }).link).toBeNull();
    expect(activeAnnouncement({ ...base, announcement_link_url: 'https://calendly.com/x', announcement_link_label: '' }).link).toBeNull();
  });
  it('todayIn falls back to UTC for an unknown zone', () => {
    expect(todayIn('Not/AZone', new Date('2026-01-02T05:00:00Z'))).toBe('2026-01-02');
    expect(todayIn('America/Denver', new Date('2026-01-02T05:00:00Z'))).toBe('2026-01-01');
  });
});

describe('announcement settings validation', () => {
  const valid = { announcement_text: 'Away', announcement_link_label: '', announcement_link_url: '', announcement_starts_on: '', announcement_ends_on: '' };

  it('stores empty dates as NULL', () => {
    const r = validateSection('announcement', valid);
    expect(r.ok).toBe(true);
    expect(r.cleaned.announcement_starts_on).toBeNull();
    expect(r.cleaned.announcement_ends_on).toBeNull();
  });
  it('rejects an end date before the start date', () => {
    const r = validateSection('announcement', { ...valid, announcement_starts_on: '2026-10-10', announcement_ends_on: '2026-10-03' });
    expect(r.errors.announcement_ends_on).toMatch(/before/);
  });
  it('rejects impossible dates', () => {
    expect(validateSection('announcement', { ...valid, announcement_starts_on: '2026-02-30' }).errors.announcement_starts_on).toBeTruthy();
  });
  it('needs link text when a link is given, and adds https://', () => {
    const r = validateSection('announcement', { ...valid, announcement_link_url: 'calendly.com/x' });
    expect(r.cleaned.announcement_link_url).toBe('https://calendly.com/x');
    expect(r.errors.announcement_link_label).toBeTruthy();
  });
  it('date fields clean to null or the trimmed value', () => {
    const spec = SETTINGS_SECTIONS.announcement.fields.find((f) => f.type === 'date');
    expect(cleanValue(spec, '')).toBeNull();
    expect(cleanValue(spec, ' 2026-10-03 ')).toBe('2026-10-03');
  });
});

describe('services section and nav links', () => {
  it('drops blank services', () => {
    expect(usableServices([{ name: 'Fade' }, { name: '  ' }, {}])).toEqual([{ name: 'Fade' }]);
  });
  it('starter content ships service descriptions for the public Services section', () => {
    const { services } = starterPublicContent();
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((s) => s.description?.trim())).toBe(true);
  });
  it('reports which optional sections exist, so subpages can show their nav links', () => {
    const starter = starterPublicContent();
    expect(sectionAvailability(resolveSettings(starter.settings), starter)).toEqual({ about: true, services: true, reviews: true, faq: true });
    expect(sectionAvailability(resolveSettings(null), { services: [], reviews: [], faqs: [] })).toEqual({ about: false, services: false, reviews: false, faq: false });
  });
});
