import { SPA_REDIRECT_KEY, toAppPath, toUrl } from '../lib/base.js';

/**
 * GitHub Pages has no rewrite rules: a direct visit or refresh of
 * /admin/portfolio/123 lands on this 404 page. Hand the address to the admin
 * shell (/admin/), which puts it back in the address bar and routes to it.
 * Hosts with rewrites (Netlify, `vite preview`) never reach this.
 */

const appPath = toAppPath(location.pathname);
if (appPath === '/admin' || appPath.startsWith('/admin/')) {
  try {
    sessionStorage.setItem(SPA_REDIRECT_KEY, appPath + location.search + location.hash);
  } catch {
    // Storage blocked: the dashboard opens instead of the exact page. Still usable.
  }
  location.replace(toUrl('/admin/'));
}
