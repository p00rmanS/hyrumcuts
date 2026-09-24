import { describe, expect, it } from 'vitest';
import {
  CATEGORY_FIELDS,
  FAQ_FIELDS,
  REVIEW_FIELDS,
  SETTINGS_SECTIONS,
  cleanValue,
  displayValue,
  normalizeUrl,
  slugify,
  uniqueSlug,
  validateItemFields,
  validateRecord,
  validateSection,
} from '../src/admin/validation/settings.js';

describe('normalizeUrl', () => {
  it('adds https:// when it is missing and upgrades http', () => {
    expect(normalizeUrl('instagram.com/hyrum')).toBe('https://instagram.com/hyrum');
    expect(normalizeUrl('http://calendly.com/x')).toBe('https://calendly.com/x');
    expect(normalizeUrl('  https://a.co/b  ')).toBe('https://a.co/b');
    expect(normalizeUrl('')).toBe('');
  });
  it('leaves dangerous schemes to be rejected by validation, never "fixing" them', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
    expect(validateSection('booking', { booking_provider: 'calendly', booking_url: 'javascript:alert(1)' }).errors.booking_url).toBeTruthy();
  });
});

describe('social links', () => {
  it('accepts real profile links and fixes a missing scheme', () => {
    const r = validateSection('social', { instagram_url: 'instagram.com/hyrumhaircuts', facebook_url: 'https://www.facebook.com/hyrum' });
    expect(r.ok).toBe(true);
    expect(r.cleaned.instagram_url).toBe('https://instagram.com/hyrumhaircuts');
  });
  it('rejects a link on the wrong site, including look-alike hosts', () => {
    expect(validateSection('social', { instagram_url: 'https://facebook.com/x' }).errors.instagram_url).toMatch(/instagram\.com/);
    expect(validateSection('social', { instagram_url: 'https://instagram.com.evil.example/x' }).errors.instagram_url).toBeTruthy();
    expect(validateSection('social', { instagram_url: 'https://evil.example/instagram.com/x' }).errors.instagram_url).toBeTruthy();
  });
  it('lets fields stay empty (they are hidden on the site)', () => {
    expect(validateSection('social', { instagram_url: '', facebook_url: '' }).ok).toBe(true);
  });
});

describe('contact', () => {
  it('validates email and phone', () => {
    expect(validateSection('contact', { phone: '(801) 555-0123', email: 'a@b.co', map_url: '', privacy_contact_email: '' }).ok).toBe(true);
    expect(validateSection('contact', { phone: 'call me', email: '', map_url: '', privacy_contact_email: '' }).errors.phone).toBeTruthy();
    expect(validateSection('contact', { phone: '', email: 'not-an-email', map_url: '', privacy_contact_email: '' }).errors.email).toMatch(/email/);
  });
});

describe('booking', () => {
  it('requires a link unless the provider is "none"', () => {
    expect(validateSection('booking', { booking_provider: 'calendly', booking_url: '', booking_time_windows: '' }).errors.booking_url).toMatch(/booking link/i);
    expect(validateSection('booking', { booking_provider: 'none', booking_url: '', booking_time_windows: '' }).ok).toBe(true);
  });
  it('accepts a Calendly link and turns time windows into a clean list', () => {
    const r = validateSection('booking', { booking_provider: 'calendly', booking_url: 'calendly.com/hyrum/cut', booking_time_windows: ' Morning \n\n Evening \r\n' });
    expect(r.ok).toBe(true);
    expect(r.cleaned.booking_url).toBe('https://calendly.com/hyrum/cut');
    expect(r.cleaned.booking_time_windows).toEqual(['Morning', 'Evening']);
  });
  it('rejects unknown providers and too many time windows', () => {
    expect(validateSection('booking', { booking_provider: 'hacker', booking_url: '', booking_time_windows: '' }).errors.booking_provider).toBeTruthy();
    const many = Array.from({ length: 9 }, (_, i) => `w${i}`).join('\n');
    expect(validateSection('booking', { booking_provider: 'none', booking_url: '', booking_time_windows: many }).errors.booking_time_windows).toBeTruthy();
  });
});

describe('required fields, limits and time zones', () => {
  it('requires the main button label and page title', () => {
    const hero = Object.fromEntries(SETTINGS_SECTIONS.hero.fields.map((f) => [f.key, 'ok']));
    expect(validateSection('hero', { ...hero, cta_book_label: '   ' }).errors.cta_book_label).toMatch(/required/i);
    const seo = { seo_title: '', seo_description: '', canonical_url: '', timezone: 'America/Denver', credit_text: '' };
    expect(validateSection('seo', seo).errors.seo_title).toMatch(/required/i);
  });
  it('enforces the same length limits as the database', () => {
    expect(validateSection('about', { barber_name: 'H', about_heading: '', about_bio: 'x'.repeat(3001), about_specialties: '', location_general: '', availability_note: '', preferred_contact: '' }).errors.about_bio).toMatch(/3000/);
  });
  it('checks the time zone', () => {
    const base = { seo_title: 'T', seo_description: '', canonical_url: '', credit_text: '' };
    expect(validateSection('seo', { ...base, timezone: 'America/Denver' }).ok).toBe(true);
    expect(validateSection('seo', { ...base, timezone: 'Mars/Olympus' }).errors.timezone).toBeTruthy();
  });
  it('rejects a non-https canonical URL', () => {
    const base = { seo_title: 'T', seo_description: '', timezone: 'America/Denver', credit_text: '' };
    expect(validateSection('seo', { ...base, canonical_url: 'ftp://x.com' }).errors.canonical_url).toBeTruthy();
  });
});

describe('cleanValue / displayValue', () => {
  const lines = SETTINGS_SECTIONS.booking.fields.find((f) => f.key === 'booking_time_windows');
  it('round-trips a list through a textarea', () => {
    expect(displayValue(lines, ['A', 'B'])).toBe('A\nB');
    expect(cleanValue(lines, 'A\nB')).toEqual(['A', 'B']);
    expect(displayValue(lines, null)).toBe('');
  });
});

describe('portfolio item fields', () => {
  it('lets a draft be saved without alt text', () => {
    expect(validateItemFields({ title: 'Fade', alt_text: '' }).ok).toBe(true);
  });
  it('needs alt text (with an explanation) to publish', () => {
    const r = validateItemFields({ title: 'Fade', alt_text: '  ' }, { publishing: true });
    expect(r.ok).toBe(false);
    expect(r.errors.alt_text).toMatch(/can't see it/);
  });
  it('needs a title and enforces limits', () => {
    expect(validateItemFields({ title: '' }).errors.title).toBeTruthy();
    expect(validateItemFields({ title: 'x'.repeat(121) }).errors.title).toBeTruthy();
    expect(validateItemFields({ title: 't', description: 'x'.repeat(1001) }).errors.description).toBeTruthy();
  });
});

describe('records: reviews, FAQs, categories', () => {
  it('requires a reviewer and a quote', () => {
    expect(validateRecord(REVIEW_FIELDS, { reviewer_name: '', quote: '' }).ok).toBe(false);
    expect(validateRecord(REVIEW_FIELDS, { reviewer_name: 'Marcus T.', quote: 'Great cut.', haircut_type: '' }).ok).toBe(true);
    expect(validateRecord(REVIEW_FIELDS, { reviewer_name: 'M', quote: 'x'.repeat(601) }).errors.quote).toMatch(/600/);
  });
  it('requires both FAQ parts', () => {
    expect(validateRecord(FAQ_FIELDS, { question: 'Q', answer: '' }).errors.answer).toBeTruthy();
  });
  it('requires a category name', () => {
    expect(validateRecord(CATEGORY_FIELDS, { name: ' ' }).errors.name).toBeTruthy();
  });
});

describe('slugs', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Long Hair!')).toBe('long-hair');
    expect(slugify('Fades & Tapers')).toBe('fades-and-tapers');
    expect(slugify('  Café  Cuts ')).toBe('cafe-cuts');
    expect(slugify('***')).toBe('');
  });
  it('makes slugs unique', () => {
    expect(uniqueSlug('fades', ['tapers'])).toBe('fades');
    expect(uniqueSlug('fades', ['fades'])).toBe('fades-2');
    expect(uniqueSlug('fades', ['fades', 'fades-2'])).toBe('fades-3');
  });
});
