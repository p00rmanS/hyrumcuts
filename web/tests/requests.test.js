import { describe, expect, it } from 'vitest';
import { buildRequestRow, countNew, formatRequestDate, isBot, requestErrorMessage } from '../src/lib/requests.js';
import { computeWarnings } from '../src/admin/pages/dashboard-logic.js';
import { matchRoute } from '../src/admin/router.js';

describe('appointment request shaping', () => {
  const form = {
    full_name: '  Marcus T.  ',
    phone: '(801) 555-0142',
    email: ' m@example.com ',
    service: 'Skin Fade',
    client_type: 'returning',
    preferred_date: '2030-01-15',
    preferred_time_slot: 'Morning (9am–12pm)',
    notes: 'x'.repeat(1500),
    consent: true,
    'bot-field': '',
    status: 'booked',
    owner_id: 'someone-else',
  };

  it('keeps only the columns a visitor may insert, trimmed and clipped', () => {
    const row = buildRequestRow(form);
    expect(Object.keys(row).sort()).toEqual(['client_type', 'consent', 'email', 'full_name', 'notes', 'phone', 'preferred_date', 'preferred_time_slot', 'service'].sort());
    expect(row.full_name).toBe('Marcus T.');
    expect(row.email).toBe('m@example.com');
    expect(row.notes).toHaveLength(1000);
    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('owner_id');
  });
  it('only ever sends a known client type, and consent as a real boolean', () => {
    expect(buildRequestRow({ ...form, client_type: 'vip' }).client_type).toBe('first_time');
    expect(buildRequestRow({ ...form, consent: 'on' }).consent).toBe(true);
    expect(buildRequestRow({ ...form, consent: undefined }).consent).toBe(false);
  });
  it('spots the spam honeypot', () => {
    expect(isBot(form)).toBe(false);
    expect(isBot({ ...form, 'bot-field': 'http://spam' })).toBe(true);
  });
});

describe('visitor-facing error messages', () => {
  it('turns database and network errors into calm sentences', () => {
    expect(requestErrorMessage({ message: 'Too many requests right now.' })).toMatch(/few minutes/);
    expect(requestErrorMessage({ message: 'The site is not set up to take requests yet.' })).toMatch(/aren't switched on/);
    expect(requestErrorMessage({ message: 'violates check constraint "appointment_requests_contact_format"' })).toMatch(/phone number and email/);
    expect(requestErrorMessage({ message: 'TypeError: Failed to fetch' })).toMatch(/connection/);
    expect(requestErrorMessage({})).toMatch(/couldn't be sent/);
  });
  it('never echoes raw database text', () => {
    expect(requestErrorMessage({ message: 'permission denied for table appointment_requests' })).not.toMatch(/permission|table/);
  });
});

describe('requests inbox in the admin', () => {
  it('formats requested dates without shifting them', () => {
    expect(formatRequestDate('2030-01-15')).toBe('Tue, Jan 15, 2030');
  });
  it('counts new requests', () => {
    expect(countNew([{ status: 'new' }, { status: 'contacted' }, { status: 'new' }])).toBe(2);
  });
  it('the dashboard puts new requests at the top of "Needs your attention"', () => {
    const settings = { hero_video_path: 'x', hero_poster_path: 'y', booking_provider: 'none', phone: '1', about_bio: 'b', profile_photo_path: 'p', instagram_url: 'i' };
    const w = computeWarnings(settings, { published: 3, newRequests: 2 });
    expect(w[0]).toMatchObject({ id: 'requests', href: '/admin/requests?status=new' });
    expect(w[0].message).toMatch(/2 new appointment requests/);
    expect(computeWarnings(settings, { published: 3, newRequests: 0 }).some((x) => x.id === 'requests')).toBe(false);
  });
  it('has its own admin page', () => {
    expect(matchRoute('/admin/requests')?.route.key).toBe('requests');
  });
});
