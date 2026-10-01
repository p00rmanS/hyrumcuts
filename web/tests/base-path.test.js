import { describe, expect, it } from 'vitest';
import { normalizeBase, toAppPath, toUrl } from '../src/lib/base.js';
import { buildCsp, buildMetaCsp } from '../../scripts/netlify-headers.js';

describe('base path (GitHub Pages sub-path support)', () => {
  it('normalises any spelling of the base', () => {
    expect(normalizeBase('')).toBe('/');
    expect(normalizeBase('/')).toBe('/');
    expect(normalizeBase('hyrumcuts')).toBe('/hyrumcuts/');
    expect(normalizeBase('/hyrumcuts')).toBe('/hyrumcuts/');
    expect(normalizeBase('//hyrumcuts//')).toBe('/hyrumcuts/');
  });

  it('adds the base to app paths, once', () => {
    const b = '/hyrumcuts/';
    expect(toUrl('/booking/', b)).toBe('/hyrumcuts/booking/');
    expect(toUrl('/#work', b)).toBe('/hyrumcuts/#work');
    expect(toUrl('/', b)).toBe('/hyrumcuts/');
    expect(toUrl('/admin/portfolio?q=fade', b)).toBe('/hyrumcuts/admin/portfolio?q=fade');
    expect(toUrl('/hyrumcuts/booking/', b)).toBe('/hyrumcuts/booking/');
    expect(toUrl('/hyrumcuts', b)).toBe('/hyrumcuts');
  });

  it('leaves full URLs, protocol-relative URLs, hashes and other schemes alone', () => {
    const b = '/hyrumcuts/';
    for (const u of ['https://calendly.com/x', '//cdn.example/x', '#faq', 'mailto:a@b.co', 'tel:+1801', 'blob:abc', '', undefined]) {
      expect(toUrl(u, b)).toBe(u);
    }
  });

  it('is a no-op at the domain root', () => {
    expect(toUrl('/booking/', '/')).toBe('/booking/');
    expect(toAppPath('/booking/', '/')).toBe('/booking/');
  });

  it('turns a real pathname back into an app path', () => {
    const b = '/hyrumcuts/';
    expect(toAppPath('/hyrumcuts/admin/portfolio', b)).toBe('/admin/portfolio');
    expect(toAppPath('/hyrumcuts/', b)).toBe('/');
    expect(toAppPath('/hyrumcuts', b)).toBe('/');
    expect(toAppPath('/elsewhere', b)).toBe('/elsewhere');
  });
});

describe('meta Content-Security-Policy for hosts without headers', () => {
  it('is the header policy minus frame-ancestors (ignored in a meta tag)', () => {
    const header = buildCsp('https://abc.supabase.co');
    const meta = buildMetaCsp('https://abc.supabase.co');
    expect(header).toMatch(/frame-ancestors 'none'/);
    expect(meta).not.toMatch(/frame-ancestors/);
    expect(meta).toMatch(/connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co https:\/\/abc\.storage\.supabase\.co/);
    expect(meta).toMatch(/object-src 'none'/);
  });
});
