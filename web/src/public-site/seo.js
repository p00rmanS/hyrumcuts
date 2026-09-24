import { buildStructuredData } from '../lib/content.js';
import { publicMediaUrl } from '../lib/media-url.js';
import { safeHttpUrl } from '../lib/urls.js';

function setMeta(selector, attr, value) {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    const m = selector.match(/\[(\w+)="([^"]+)"\]/);
    if (m) el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/**
 * Apply the editable SEO settings. Search engines that run JavaScript (Google,
 * Bing) read these; the HTML already ships sensible defaults for everyone else.
 *
 * @param {Record<string, any>} settings
 * @param {{ home?: boolean, title?: string, path?: string }} [page]
 */
export function applySeo(settings, { home = false, title, path = location.pathname } = {}) {
  const pageTitle = title ?? (settings.seo_title || settings.brand_name);
  document.title = pageTitle;

  const description = settings.seo_description?.trim();
  if (description && home) {
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:description"]', 'content', description);
  }

  const canonicalBase = safeHttpUrl(settings.canonical_url, { httpsOnly: true });
  const origin = canonicalBase ? new URL(canonicalBase).origin : location.origin;
  const canonical = home && canonicalBase ? canonicalBase : new URL(path, origin).toString();
  setMeta('link[rel="canonical"]', 'href', canonical);
  setMeta('meta[property="og:url"]', 'content', canonical);
  setMeta('meta[property="og:title"]', 'content', pageTitle);
  setMeta('meta[property="og:site_name"]', 'content', settings.brand_name);

  const image = publicMediaUrl(settings.seo_image_path);
  if (image) {
    setMeta('meta[property="og:image"]', 'content', image);
    setMeta('meta[name="twitter:image"]', 'content', image);
  }

  if (home) {
    const existing = document.getElementById('structured-data');
    existing?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'structured-data';
    // JSON.stringify output is data, not markup; "<" is escaped so it can never close the tag.
    script.textContent = JSON.stringify(buildStructuredData(settings, canonical)).replace(/</g, '\\u003c');
    document.head.appendChild(script);
  }
}
