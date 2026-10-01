import { toUrl } from './base.js';
import { config } from './env.js';

/**
 * Public URL for an object in the `site-media` bucket.
 *
 * Built by hand (rather than through the Storage client) so the public site
 * does not need to ship the Storage SDK. Each path segment is encoded; the
 * "/" separators are kept.
 *
 * @param {string | null | undefined} path e.g. "<owner-uuid>/hero/abc-poster.webp"
 * @param {{ supabaseUrl?: string, bucket?: string }} [options]
 * @returns {string} '' when there is no path
 */
export function publicMediaUrl(path, options = {}) {
  if (!path || typeof path !== 'string') return '';
  // Bundled starter files are served from this site itself. A real Storage path can
  // never start with "/" (the database requires the owner id first).
  if (path.startsWith('/assets/')) return toUrl(path);
  const base = (options.supabaseUrl ?? config.supabaseUrl).replace(/\/+$/, '');
  const bucket = options.bucket ?? config.bucket;
  if (!base) return '';
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** Reverse of publicMediaUrl: the object path, or '' if the URL is not ours. */
export function objectPathFromPublicUrl(url, options = {}) {
  const base = (options.supabaseUrl ?? config.supabaseUrl).replace(/\/+$/, '');
  const bucket = options.bucket ?? config.bucket;
  const prefix = `${base}/storage/v1/object/public/${bucket}/`;
  if (!url || !url.startsWith(prefix)) return '';
  return url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
}
