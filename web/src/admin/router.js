/**
 * Minimal History-API router for /admin/*.
 *
 * Direct visits and refreshes of any admin URL work on every host: Netlify
 * rewrites /admin/* to the admin shell (netlify.toml), Vite does the same in
 * dev, and on GitHub Pages 404.html hands the address over (spa-redirect.js).
 */

import { toAppPath, toUrl } from '../lib/base.js';

/** @type {Array<{ path: string, key: string, title: string, public?: boolean, load: () => Promise<any> }>} */
export const ROUTES = [
  { path: '/admin', key: 'dashboard', title: 'Dashboard', load: () => import('./pages/dashboard.js') },
  { path: '/admin/login', key: 'login', title: 'Sign in', public: true, load: () => import('./pages/login.js') },
  { path: '/admin/reset-password', key: 'reset', title: 'Set a new password', public: true, load: () => import('./pages/reset-password.js') },
  { path: '/admin/requests', key: 'requests', title: 'Requests', load: () => import('./pages/requests.js') },
  { path: '/admin/portfolio', key: 'portfolio', title: 'Manage work', load: () => import('./pages/portfolio-list.js') },
  { path: '/admin/portfolio/add', key: 'portfolio-add', title: 'Add work', load: () => import('./pages/portfolio-add.js') },
  { path: '/admin/portfolio/categories', key: 'categories', title: 'Categories', load: () => import('./pages/categories.js') },
  { path: '/admin/portfolio/:id', key: 'portfolio', title: 'Edit work', load: () => import('./pages/portfolio-edit.js') },
  { path: '/admin/media/hero', key: 'hero-media', title: 'Hero video', load: () => import('./pages/hero-media.js') },
  { path: '/admin/media/profile', key: 'profile', title: 'Profile photo', load: () => import('./pages/profile-photo.js') },
  { path: '/admin/content/hero', key: 'content-hero', title: 'Hero text', load: () => import('./pages/settings-page.js').then((m) => m.forSection('hero', 'content-hero')) },
  { path: '/admin/content/about', key: 'content-about', title: 'About', load: () => import('./pages/settings-page.js').then((m) => m.forSection('about', 'content-about')) },
  { path: '/admin/content/announcement', key: 'announcement', title: 'Announcement', load: () => import('./pages/settings-page.js').then((m) => m.forSection('announcement', 'announcement')) },
  { path: '/admin/content/faq', key: 'faq', title: 'FAQ', load: () => import('./pages/list-editor.js').then((m) => m.forFaqs()) },
  { path: '/admin/reviews', key: 'reviews', title: 'Reviews', load: () => import('./pages/list-editor.js').then((m) => m.forReviews()) },
  { path: '/admin/settings/booking', key: 'booking', title: 'Booking link', load: () => import('./pages/settings-page.js').then((m) => m.forSection('booking', 'booking')) },
  { path: '/admin/settings/services', key: 'services', title: 'Services', load: () => import('./pages/list-editor.js').then((m) => m.forServices()) },
  { path: '/admin/settings/contact', key: 'contact', title: 'Contact', load: () => import('./pages/settings-page.js').then((m) => m.forSection('contact', 'contact')) },
  { path: '/admin/settings/social', key: 'social', title: 'Social links', load: () => import('./pages/settings-page.js').then((m) => m.forSection('social', 'social')) },
  { path: '/admin/settings/seo', key: 'seo', title: 'Search & sharing', load: () => import('./pages/settings-page.js').then((m) => m.forSection('seo', 'seo')) },
  { path: '/admin/account', key: 'account', title: 'Account', load: () => import('./pages/account.js') },
];

/**
 * Match a pathname to a route. Static segments beat ":param" segments, so
 * "/admin/portfolio/add" is never mistaken for an item id.
 * @returns {{ route: (typeof ROUTES)[number], params: Record<string, string> } | null}
 */
export function matchRoute(pathname, routes = ROUTES) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const segments = clean.split('/');
  let best = null;
  for (const route of routes) {
    const parts = route.path.split('/');
    if (parts.length !== segments.length) continue;
    const params = {};
    let score = 0;
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i].startsWith(':')) {
        if (!segments[i]) ok = false;
        try {
          params[parts[i].slice(1)] = decodeURIComponent(segments[i] ?? '');
        } catch {
          ok = false; // a malformed escape such as "%E0" is "no match", not a crash
        }
      } else if (parts[i] === segments[i]) {
        score += 1;
      } else {
        ok = false;
      }
    }
    if (ok && (!best || score > best.score)) best = { route, params, score };
  }
  return best ? { route: best.route, params: best.params } : null;
}

/** Only same-site admin paths may be used as a post-login destination (prevents open redirects). */
export function safeNextPath(next) {
  if (typeof next !== 'string') return '/admin';
  const isAdminPath = next === '/admin' || next.startsWith('/admin/') || next.startsWith('/admin?');
  if (!isAdminPath || next.includes('\\')) return '/admin';
  if (/^\/admin\/(login|reset-password)/.test(next)) return '/admin';
  return next;
}

let dirtyGuard = null;
let onRoute = null;

/** Register "are there unsaved changes?" (or null to clear). */
export function setDirtyGuard(fn) {
  dirtyGuard = fn;
}

async function confirmLeave() {
  if (!dirtyGuard?.()) return true;
  const { confirmDialog } = await import('./ui.js');
  return confirmDialog({
    title: 'Leave without saving?',
    message: 'You have changes that haven\'t been saved. If you leave now they will be lost.',
    confirmLabel: 'Leave without saving',
    cancelLabel: 'Keep editing',
    danger: true,
  });
}

/** Go to another admin page. Returns false if the owner chose to stay. */
export async function navigate(path, { replace = false, force = false } = {}) {
  if (!force && !(await confirmLeave())) return false;
  dirtyGuard = null;
  if (replace) history.replaceState({}, '', toUrl(path));
  else history.pushState({}, '', toUrl(path));
  await onRoute?.();
  return true;
}

export function startRouter(handler) {
  onRoute = handler;

  // Same-site admin links navigate without a full page load.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    const appPath = toAppPath(url.pathname);
    if (url.origin !== location.origin || !(appPath === '/admin' || appPath.startsWith('/admin/'))) return;
    event.preventDefault();
    navigate(appPath + url.search);
  });

  window.addEventListener('popstate', async () => {
    if (dirtyGuard?.() && !(await confirmLeave())) {
      // Undo the browser's back/forward by re-pushing the page we were on.
      history.pushState({}, '', toUrl(currentUrl));
      return;
    }
    dirtyGuard = null;
    await onRoute?.();
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirtyGuard?.()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

let currentUrl = '/admin';
export function rememberCurrentUrl() {
  currentUrl = toAppPath(location.pathname) + location.search;
}
