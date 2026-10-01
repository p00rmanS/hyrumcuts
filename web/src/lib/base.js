/**
 * The site can live at the domain root ("/") or under a sub-path such as
 * "/hyrumcuts/" on GitHub Pages. Inside the code every page and file is
 * written as an *app path* starting at "/" ("/admin/portfolio", "/booking/",
 * "/assets/..."); these helpers convert at the edges, where a real URL is
 * needed (links, navigation, redirects) or read (location.pathname).
 *
 * Set at build time with VITE_BASE_PATH (see vite.config.js).
 */

/** Normalise any base to "/" or "/segment/.../". */
export function normalizeBase(base) {
  const trimmed = String(base ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

export const BASE = normalizeBase(import.meta.env?.BASE_URL ?? '/');

/**
 * App path -> URL path under the base. Leaves full URLs ("https://…",
 * "//host", "mailto:", "#hash", "blob:") alone, and never prefixes twice.
 */
export function toUrl(path, base = BASE) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  if (base === '/') return path;
  if (path === base.slice(0, -1) || path.startsWith(base)) return path;
  return base + path.slice(1);
}

/** URL path (location.pathname) -> app path. Anything outside the base is returned unchanged. */
export function toAppPath(pathname, base = BASE) {
  if (typeof pathname !== 'string' || base === '/') return pathname;
  if (pathname === base.slice(0, -1)) return '/';
  return pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname;
}

/** sessionStorage key 404.html uses to hand a deep admin URL to the admin shell (GitHub Pages). */
export const SPA_REDIRECT_KEY = 'hh-spa-path';
