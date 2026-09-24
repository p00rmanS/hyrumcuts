import { describe, expect, it } from 'vitest';
import { assertBrowserSafeKey, readConfig } from '../src/lib/env.js';
import { bookingAction, mailtoHref, safeHttpUrl, telHref } from '../src/lib/urls.js';
import { objectPathFromPublicUrl, publicMediaUrl } from '../src/lib/media-url.js';
import { formatBytes } from '../src/lib/media-config.js';
import { buildCsp, buildHeaders, buildRobots, buildSitemap, supabaseOrigins } from '../../scripts/netlify-headers.js';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const jwt = (role) => `${b64url({ alg: 'HS256' })}.${b64url({ role })}.sig`;

describe('env: privileged keys never reach the browser', () => {
  it('accepts a publishable key', () => {
    expect(() => assertBrowserSafeKey('sb_publishable_abc123')).not.toThrow();
  });
  it('accepts a legacy anon JWT', () => {
    expect(() => assertBrowserSafeKey(jwt('anon'))).not.toThrow();
  });
  it('rejects a secret key', () => {
    expect(() => assertBrowserSafeKey('sb_secret_abc123')).toThrow(/SECRET/);
  });
  it('rejects a service_role JWT', () => {
    expect(() => assertBrowserSafeKey(jwt('service_role'))).toThrow(/service_role/);
  });
  it('readConfig refuses a service_role key', () => {
    expect(() => readConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: jwt('service_role') })).toThrow();
  });
  it('readConfig trims, strips trailing slashes and reports configuration', () => {
    const c = readConfig({ VITE_SUPABASE_URL: ' https://x.supabase.co/// ', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_k' });
    expect(c.supabaseUrl).toBe('https://x.supabase.co');
    expect(c.isConfigured).toBe(true);
    expect(c.siteSlug).toBe('hyrumhaircuts');
  });
  it('readConfig reports unconfigured when values are missing', () => {
    expect(readConfig({}).isConfigured).toBe(false);
  });
});

describe('urls', () => {
  it('accepts http(s) URLs only', () => {
    expect(safeHttpUrl('https://calendly.com/x')).toBe('https://calendly.com/x');
    expect(safeHttpUrl('javascript:alert(1)')).toBe('');
    expect(safeHttpUrl('data:text/html,<script>')).toBe('');
    expect(safeHttpUrl('//evil.example')).toBe('');
    expect(safeHttpUrl('https://a b.com')).toBe('');
    expect(safeHttpUrl(undefined)).toBe('');
  });
  it('httpsOnly rejects plain http', () => {
    expect(safeHttpUrl('http://x.com', { httpsOnly: true })).toBe('');
    expect(safeHttpUrl('http://x.com')).toBe('http://x.com/');
  });
  it('builds tel and mailto links safely', () => {
    expect(telHref('(801) 555-0100')).toBe('tel:8015550100');
    expect(telHref('call me')).toBe('');
    expect(mailtoHref('a@b.co')).toBe('mailto:a@b.co');
    expect(mailtoHref('a@b.co?bcc=x@y.z ')).toBe('');
    expect(mailtoHref('nope')).toBe('');
  });
  it('bookingAction picks the right behaviour', () => {
    expect(bookingAction({ booking_provider: 'calendly', booking_url: 'https://calendly.com/h' })).toEqual({ kind: 'calendly', url: 'https://calendly.com/h' });
    expect(bookingAction({ booking_provider: 'other', booking_url: 'https://cal.example/h' }).kind).toBe('link');
    expect(bookingAction({ booking_provider: 'calendly', booking_url: '' }).kind).toBe('form');
    expect(bookingAction({ booking_provider: 'none', booking_url: 'https://x.com' }).kind).toBe('form');
    expect(bookingAction({ booking_provider: 'calendly', booking_url: 'http://insecure.example' }).kind).toBe('form');
    expect(bookingAction({ booking_provider: 'calendly', booking_url: 'javascript:alert(1)' }).kind).toBe('form');
    expect(bookingAction(undefined).kind).toBe('form');
  });
});

describe('media urls', () => {
  const opts = { supabaseUrl: 'https://abc.supabase.co', bucket: 'site-media' };
  it('builds a public object URL and encodes segments', () => {
    expect(publicMediaUrl('u1/gallery/i1/a b-card.webp', opts)).toBe(
      'https://abc.supabase.co/storage/v1/object/public/site-media/u1/gallery/i1/a%20b-card.webp',
    );
  });
  it('returns empty string for missing paths', () => {
    expect(publicMediaUrl(null, opts)).toBe('');
    expect(publicMediaUrl('', opts)).toBe('');
  });
  it('round-trips a path', () => {
    const url = publicMediaUrl('u1/hero/x y.mp4', opts);
    expect(objectPathFromPublicUrl(url, opts)).toBe('u1/hero/x y.mp4');
    expect(objectPathFromPublicUrl('https://evil.example/x', opts)).toBe('');
  });
});

describe('formatBytes', () => {
  it('formats sizes for humans', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('netlify headers and CSP', () => {
  it('derives the Supabase origins from the project URL', () => {
    const o = supabaseOrigins('https://abcd.supabase.co');
    expect(o.api).toEqual(['https://abcd.supabase.co']);
    expect(o.realtime).toEqual(['wss://abcd.supabase.co']);
    expect(o.storage).toEqual(['https://abcd.storage.supabase.co']);
  });
  it('allows only this project, this site and Calendly', () => {
    const csp = buildCsp('https://abcd.supabase.co');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://abcd.storage.supabase.co');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(csp).not.toMatch(/https:\/\/\*(\s|;|$)/);
    expect(csp).not.toMatch(/ \* /);
  });
  it('does not force https upgrades for a local http Supabase', () => {
    expect(buildCsp('http://127.0.0.1:54321')).not.toContain('upgrade-insecure-requests');
  });
  it('rejects a malformed Supabase URL', () => {
    expect(() => buildCsp('not a url')).toThrow(/VITE_SUPABASE_URL/);
  });
  it('marks admin as noindex and uncached', () => {
    const headers = buildHeaders('https://abcd.supabase.co');
    expect(headers).toMatch(/\/admin\/\*\n\s+X-Robots-Tag: noindex/);
    expect(headers).toContain('Cache-Control: no-store');
  });
  it('blocks indexing of deploy previews everywhere', () => {
    const preview = buildHeaders('https://abcd.supabase.co', { indexable: false });
    // Applies to every path ("/*" block), not just the admin.
    expect(preview.split('\n# The admin')[0]).toContain('X-Robots-Tag: noindex, nofollow, noarchive');
    const production = buildHeaders('https://abcd.supabase.co', { indexable: true });
    expect(production.split('\n# The admin')[0]).not.toContain('X-Robots-Tag');
    expect(buildRobots('https://hyrumhaircuts.com', { indexable: false })).toBe('User-agent: *\nDisallow: /\n');
  });
  it('robots and sitemap use trailing-slash canonical URLs and hide admin', () => {
    expect(buildRobots('https://hyrumhaircuts.com/')).toContain('Disallow: /admin/');
    const sitemap = buildSitemap('https://hyrumhaircuts.com');
    expect(sitemap).toContain('<loc>https://hyrumhaircuts.com/booking/</loc>');
    expect(sitemap).not.toContain('/admin');
  });
});
