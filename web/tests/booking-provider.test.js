import { describe, expect, it } from 'vitest';
import { bookingLinkProblem, validateSection } from '../src/admin/validation/settings.js';
import { bookingAction } from '../src/lib/urls.js';

const booking = (provider, url) => validateSection('booking', { booking_provider: provider, booking_url: url, booking_time_windows: 'Morning' });

describe('booking link matches the chosen provider', () => {
  it('accepts Google Calendar appointment pages (short and long links)', () => {
    expect(booking('google_calendar', 'https://calendar.app.google/AbCd1234').ok).toBe(true);
    expect(booking('google_calendar', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abc').ok).toBe(true);
    expect(booking('google_calendar', 'calendar.app.google/AbCd1234').cleaned.booking_url).toBe('https://calendar.app.google/AbCd1234');
  });
  it('accepts Calendly links', () => {
    expect(booking('calendly', 'https://calendly.com/hyrum/haircut').ok).toBe(true);
  });
  it('says which provider to pick when the link belongs to the other one', () => {
    expect(bookingLinkProblem('calendly', 'https://calendar.app.google/AbCd1234')).toMatch(/That's a Google Calendar link\. Change "Booking provider" to Google Calendar/);
    expect(bookingLinkProblem('google_calendar', 'https://calendly.com/x')).toMatch(/That's a Calendly link/);
  });
  it('refuses unrelated sites for a named provider, with an example', () => {
    const r = booking('google_calendar', 'https://example.com/book');
    expect(r.ok).toBe(false);
    expect(r.errors.booking_url).toMatch(/calendar\.app\.google/);
    expect(booking('google_calendar', 'https://calendar.google.com.evil.example/x').ok).toBe(false);
  });
  it('lets "Another booking website" use any https link', () => {
    expect(booking('other', 'https://booksy.com/hyrum').ok).toBe(true);
  });
  it('Google links open in a new tab from every Book button (no Calendly script)', () => {
    expect(bookingAction({ booking_provider: 'google_calendar', booking_url: 'https://calendar.app.google/AbCd1234' })).toEqual({ kind: 'link', url: 'https://calendar.app.google/AbCd1234' });
  });
});
