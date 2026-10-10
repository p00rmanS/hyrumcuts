import { SPA_REDIRECT_KEY, toAppPath, toUrl } from '../lib/base.js';

/**
 * GitHub Pages has no rewrite rules: a direct visit or refresh of
 * /admin/portfolio/123 lands on 404.html. Hand the address to the admin shell
 * (/admin/), which puts it back in the address bar and routes to it.
 * Hosts with rewrites (Netlify, `vite preview`) never reach this.
 *
 * A function, not a side effect: not-found.js calls it BEFORE loading anything
 * else, so the redirect never waits on the database (the bundler is free to
 * reorder side-effect imports).
 *
 * @returns {boolean} true when the browser is being sent to the admin
 */
export function redirectIfAdmin() {
  const appPath = toAppPath(location.pathname);
  if (appPath !== '/admin' && !appPath.startsWith('/admin/')) return false;
  try {
    sessionStorage.setItem(SPA_REDIRECT_KEY, appPath + location.search + location.hash);
  } catch {
    // Storage blocked: the dashboard opens instead of the exact page. Still usable.
  }
  location.replace(toUrl('/admin/'));
  return true;
}
