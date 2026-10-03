import { describe, expect, it } from 'vitest';
import { openingHours, resolveSettings } from '../src/lib/content.js';
import { SETTINGS_SECTIONS, validateSection } from '../src/admin/validation/settings.js';
import { computeWarnings } from '../src/admin/pages/dashboard-logic.js';
import { matchRoute } from '../src/admin/router.js';
import { SECTION_PUBLIC_PATH } from '../src/admin/pages/settings-helpers.js';

const week = (o) => resolveSettings(o);

describe('opening hours', () => {
  it('groups neighbouring days with the same hours', () => {
    const lines = openingHours(week({ hours_tue: '9am–6pm', hours_wed: '9am–6pm', hours_thu: '9AM–6PM', hours_fri: '9am–8pm', hours_sat: '10am–4pm', hours_sun: 'Closed' }));
    expect(lines).toEqual([
      { days: 'Tue–Thu', label: 'Tuesday to Thursday', hours: '9am–6pm' },
      { days: 'Fri', label: 'Friday', hours: '9am–8pm' },
      { days: 'Sat', label: 'Saturday', hours: '10am–4pm' },
      { days: 'Sun', label: 'Sunday', hours: 'Closed' },
    ]);
  });
  it('skips empty days and never joins across a gap', () => {
    expect(openingHours(week({ hours_mon: '9–5', hours_wed: '9–5' })).map((l) => l.days)).toEqual(['Mon', 'Wed']);
  });
  it('is empty when nothing is filled in', () => {
    expect(openingHours(week({}))).toEqual([]);
    expect(openingHours(week({ hours_mon: '   ' }))).toEqual([]);
  });
  it('validates the 40-character limit per day', () => {
    const r = validateSection('hours', { hours_mon: 'x'.repeat(41) });
    expect(r.errors.hours_mon).toMatch(/40 characters/);
    expect(validateSection('hours', { hours_mon: '9am–6pm', hours_sun: 'Closed' }).ok).toBe(true);
  });
  it('has an admin page that links to the Contact section', () => {
    expect(SETTINGS_SECTIONS.hours.fields).toHaveLength(8);
    expect(matchRoute('/admin/settings/hours')?.route.key).toBe('hours');
    expect(SECTION_PUBLIC_PATH.hours).toBe('/#contact');
  });
  it('the dashboard nudges until hours are added', () => {
    const base = { hero_video_path: 'x', hero_poster_path: 'y', booking_provider: 'none', phone: '1', about_bio: 'b', profile_photo_path: 'p', instagram_url: 'i' };
    expect(computeWarnings(base, { published: 1 }).some((w) => w.id === 'hours')).toBe(true);
    expect(computeWarnings({ ...base, hours_sat: '10–4' }, { published: 1 }).some((w) => w.id === 'hours')).toBe(false);
  });
});
