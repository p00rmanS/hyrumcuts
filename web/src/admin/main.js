import '../styles/admin.css';
import { config } from '../lib/env.js';
import { h, mount } from '../lib/dom.js';
import { matchRoute, navigate, rememberCurrentUrl, setDirtyGuard, startRouter } from './router.js';
import { checkOwner, clearAuthCache, onAuthEvent, signOut } from './services/auth.js';
import { runCleanupQueue } from './services/storage.js';
import { renderShell } from './shell.js';
import { errorPanel, loading } from './ui.js';
import { SPA_REDIRECT_KEY, toAppPath, toUrl } from '../lib/base.js';

/**
 * Admin entry point. Every navigation:
 *   1. finds the route,
 *   2. for protected routes asks the server who is signed in (getUser) and
 *      whether they are the registered owner,
 *   3. renders the page inside the shell.
 *
 * This guard is user experience only. Even if it were bypassed, Row Level
 * Security and the Storage policies would still refuse every read and write.
 */

const app = document.getElementById('app');
let renderToken = 0;
let cleanup = null;
let cleaned = false;

// Never run the admin inside someone else's frame (clickjacking). Hosts that
// can send headers also set X-Frame-Options; GitHub Pages cannot, so check here.
const framed = (() => {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
})();

// A direct visit or refresh of /admin/... on GitHub Pages arrives via 404.html,
// which saved the address (see public-site/spa-redirect.js). Put it back.
try {
  const saved = sessionStorage.getItem(SPA_REDIRECT_KEY);
  sessionStorage.removeItem(SPA_REDIRECT_KEY);
  if (saved && (saved === '/admin' || saved.startsWith('/admin/') || saved.startsWith('/admin?'))) history.replaceState(null, '', toUrl(saved));
} catch {
  // Storage blocked: stay on the dashboard.
}

function setupMissing() {
  mount(
    app,
    h(
      'div',
      { class: 'a-page max-w-xl' },
      h('h1', { class: 'a-h1' }, 'Setup needed'),
      h('div', { class: 'a-alert-warn' }, 'This site isn\'t connected to its database yet. Your developer needs to set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see the README), then redeploy.'),
    ),
  );
}

function notOwner(user) {
  mount(
    app,
    h(
      'div',
      { class: 'a-page max-w-xl' },
      h('h1', { class: 'a-h1', tabindex: '-1' }, 'This account can\'t manage the site'),
      h('p', { class: 'a-sub' }, `You're signed in as ${user.email ?? 'another account'}, which isn't the site owner's account.`),
      h(
        'button',
        {
          type: 'button',
          class: 'a-btn-primary',
          onClick: async () => {
            await signOut();
            location.assign(toUrl('/admin/login'));
          },
        },
        'Sign out and try a different account',
      ),
    ),
  );
}

async function render() {
  const token = (renderToken += 1);
  cleanup?.();
  cleanup = null;
  rememberCurrentUrl();

  if (!config.isConfigured) return setupMissing();

  const match = matchRoute(toAppPath(location.pathname));
  const query = new URLSearchParams(location.search);

  if (!match) {
    const auth = await checkOwner().catch(() => ({ user: null }));
    if (!auth.user || auth.reason) return navigate('/admin/login', { replace: true, force: true });
    document.title = 'Page not found · HyrumHaircuts Admin';
    const main = renderShell(app, { user: auth.user, activeKey: '' });
    mount(main, h('div', { class: 'a-page' }, h('h1', { class: 'a-h1' }, 'Page not found'), h('a', { href: '/admin', class: 'a-btn-primary mt-4' }, 'Back to dashboard')));
    return undefined;
  }

  const { route, params } = match;
  document.title = `${route.title} · HyrumHaircuts Admin`;

  try {
    if (route.public) {
      const mod = await route.load();
      const node = await mod.default({ params, query, navigate });
      if (token !== renderToken) return undefined;
      mount(app, node);
      app.querySelector('[data-page-title]')?.focus();
      return undefined;
    }

    const auth = await checkOwner();
    if (token !== renderToken) return undefined;
    if (auth.reason === 'signed-out') {
      const next = encodeURIComponent(toAppPath(location.pathname) + location.search);
      return navigate(`/admin/login?next=${next}`, { replace: true, force: true });
    }
    if (auth.reason === 'not-owner') return notOwner(auth.user);

    const main = renderShell(app, { user: auth.user, activeKey: route.key });
    mount(main, loading());

    const mod = await route.load();
    const ctx = { params, query, user: auth.user, ownerId: auth.user.id, navigate, setGuard: setDirtyGuard, main };
    const result = await mod.default(ctx);
    if (token !== renderToken) {
      result?.cleanup?.();
      return undefined;
    }
    const node = result?.node ?? result;
    cleanup = result?.cleanup ?? null;
    mount(main, node);
    main.querySelector('[data-page-title]')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });

    // Housekeeping once per visit: retry deleting any files that couldn't be removed earlier.
    if (!cleaned) {
      cleaned = true;
      runCleanupQueue().catch(() => {});
    }
  } catch (error) {
    if (token !== renderToken) return undefined;
    // "Try again" can't help when the thing is gone; offer the way back instead.
    const panel = error?.notFound
      ? h('div', { class: 'a-alert-info', role: 'alert' }, h('p', { class: 'mb-3' }, error.message), h('a', { href: error.notFound.href, class: 'a-btn-primary' }, error.notFound.label))
      : errorPanel(error, () => render());
    const shellMain = app.querySelector('#main-content');
    if (shellMain) mount(shellMain, h('div', { class: 'a-page' }, panel));
    else mount(app, h('div', { class: 'a-page max-w-xl' }, panel));
  }
  return undefined;
}

startRouter(render);

if (config.isConfigured) {
  onAuthEvent((event) => {
    if (event === 'SIGNED_OUT') {
      clearAuthCache();
      const here = toAppPath(location.pathname);
      if (!here.startsWith('/admin/login') && !here.startsWith('/admin/reset-password')) location.assign(toUrl('/admin/login'));
    }
    if (event === 'PASSWORD_RECOVERY' && !toAppPath(location.pathname).startsWith('/admin/reset-password')) navigate('/admin/reset-password', { force: true });
  });
}

if (framed) {
  mount(app, h('p', { class: 'a-page' }, 'For your security, the site manager cannot be shown inside another website. ', h('a', { href: '/admin', target: '_top', class: 'underline' }, 'Open it directly'), '.'));
} else {
  render();
}
