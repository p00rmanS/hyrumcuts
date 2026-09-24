import { h, mount } from '../lib/dom.js';
import { signOut } from './services/auth.js';
import { confirmDialog, toast } from './ui.js';

/**
 * The signed-in frame: sidebar on large screens, a top bar + bottom tab bar +
 * "More" drawer on phones. Navigation follows the agreed admin structure.
 */

export const NAV = [
  { label: 'Dashboard', href: '/admin', key: 'dashboard' },
  {
    group: 'Portfolio',
    items: [
      { label: 'Add Work', href: '/admin/portfolio/add', key: 'portfolio-add' },
      { label: 'Manage Work', href: '/admin/portfolio', key: 'portfolio' },
      { label: 'Categories', href: '/admin/portfolio/categories', key: 'categories' },
    ],
  },
  {
    group: 'Media',
    items: [
      { label: 'Hero Video', href: '/admin/media/hero', key: 'hero-media' },
      { label: 'Profile Photo', href: '/admin/media/profile', key: 'profile' },
    ],
  },
  {
    group: 'Website Content',
    items: [
      { label: 'Hero', href: '/admin/content/hero', key: 'content-hero' },
      { label: 'About', href: '/admin/content/about', key: 'content-about' },
      { label: 'FAQ', href: '/admin/content/faq', key: 'faq' },
      { label: 'Announcement', href: '/admin/content/announcement', key: 'announcement' },
    ],
  },
  { label: 'Reviews', href: '/admin/reviews', key: 'reviews' },
  {
    group: 'Settings',
    items: [
      { label: 'Booking Link', href: '/admin/settings/booking', key: 'booking' },
      { label: 'Services', href: '/admin/settings/services', key: 'services' },
      { label: 'Contact', href: '/admin/settings/contact', key: 'contact' },
      { label: 'Social Links', href: '/admin/settings/social', key: 'social' },
      { label: 'SEO', href: '/admin/settings/seo', key: 'seo' },
    ],
  },
  {
    group: 'Account',
    items: [{ label: 'Password & Security', href: '/admin/account', key: 'account' }],
  },
];

const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  work: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5',
  plus: 'M12 5v14M5 12h14',
  video: 'M4 6h11v12H4zM15 10l5-3v10l-5-3',
  more: 'M4 6h16M4 12h16M4 18h16',
};

function icon(pathData, size = 22) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' })) svg.setAttribute(k, String(v));
  const p = document.createElementNS(ns, 'path');
  for (const [k, v] of Object.entries({ d: pathData, stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) p.setAttribute(k, v);
  svg.appendChild(p);
  return svg;
}

function navLink(item, activeKey, { compact = false } = {}) {
  const active = item.key === activeKey;
  return h(
    'a',
    {
      href: item.href,
      'aria-current': active ? 'page' : undefined,
      class: `flex items-center min-h-[44px] px-3 ${compact ? 'text-base' : 'text-sm'} ${active ? 'bg-ink text-ivory font-semibold' : 'text-ink hover:bg-ink/5'}`,
    },
    item.label,
  );
}

function navTree(activeKey, opts) {
  return NAV.map((entry) =>
    entry.group
      ? h('div', { class: 'mt-4' }, h('p', { class: 'px-3 pb-1 text-xs uppercase tracking-widest2 text-muted font-semibold' }, entry.group), entry.items.map((i) => navLink(i, activeKey, opts)))
      : navLink(entry, activeKey, opts),
  );
}

async function handleSignOut() {
  const ok = await confirmDialog({ title: 'Sign out?', message: 'You\'ll need your email and password to sign back in.', confirmLabel: 'Sign out' });
  if (!ok) return;
  try {
    await signOut();
  } catch (error) {
    toast(error.message, { type: 'error' });
    return;
  }
  location.assign('/admin/login');
}

/**
 * Build (or refresh) the shell and return the element where a page should render.
 * @param {HTMLElement} root #app
 * @param {{ user: { email?: string }, activeKey: string }} ctx
 */
export function renderShell(root, { user, activeKey }) {
  let frame = root.querySelector('[data-shell]');
  if (!frame) {
    frame = h('div', { dataset: { shell: '' }, class: 'min-h-screen lg:flex' });
    mount(root, frame);
  }

  const drawerId = 'more-drawer';
  const drawer = h('div', { id: drawerId, class: 'hidden fixed inset-0 z-50 lg:hidden', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'All sections' });
  const closeDrawer = () => {
    drawer.classList.add('hidden');
    moreBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
    moreBtn.focus();
  };
  const openDrawer = () => {
    drawer.classList.remove('hidden');
    moreBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
    drawer.querySelector('a, button')?.focus();
  };
  mount(
    drawer,
    h('div', { class: 'absolute inset-0 bg-ink/60', onClick: closeDrawer }),
    h(
      'div',
      { class: 'absolute inset-y-0 right-0 w-[85%] max-w-sm bg-paper overflow-y-auto p-4', onClick: (e) => e.target.closest('a') && closeDrawer() },
      h('div', { class: 'flex items-center justify-between mb-2' }, h('p', { class: 'font-display text-lg' }, 'All sections'), h('button', { type: 'button', class: 'a-btn-ghost', 'aria-label': 'Close menu', onClick: closeDrawer }, '×')),
      h('nav', { 'aria-label': 'All sections' }, navTree(activeKey, { compact: true })),
      h('button', { type: 'button', class: 'a-btn-secondary w-full mt-6', onClick: handleSignOut }, 'Sign out'),
    ),
  );
  drawer.addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());

  const tab = (label, href, key, pathData) =>
    h(
      'a',
      { href, 'aria-current': key === activeKey ? 'page' : undefined, class: `flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs ${key === activeKey ? 'text-ink font-bold' : 'text-muted'}` },
      icon(pathData),
      label,
    );
  const moreBtn = h('button', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': drawerId, class: 'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs text-muted', onClick: openDrawer }, icon(ICONS.more), 'More');

  const sidebar = h(
    'aside',
    { class: 'hidden lg:flex lg:w-64 shrink-0 flex-col border-r border-ink/10 bg-paper min-h-screen sticky top-0 self-start max-h-screen overflow-y-auto p-4' },
    h('p', { class: 'font-display text-xl mb-1' }, 'HyrumHaircuts'),
    h('p', { class: 'text-xs text-muted mb-4' }, 'Site manager'),
    h('nav', { 'aria-label': 'Admin' }, navTree(activeKey)),
    h('div', { class: 'mt-auto pt-6' }, h('p', { class: 'text-xs text-muted mb-2 break-all' }, user.email ?? ''), h('a', { href: '/', target: '_blank', rel: 'noopener noreferrer', class: 'a-btn-secondary w-full mb-2' }, 'View website'), h('button', { type: 'button', class: 'a-btn-secondary w-full', onClick: handleSignOut }, 'Sign out')),
  );

  const topbar = h(
    'header',
    { class: 'lg:hidden sticky top-0 z-30 flex items-center justify-between bg-paper border-b border-ink/10 px-4 h-14' },
    h('p', { class: 'font-display text-lg' }, 'HyrumHaircuts'),
    h('a', { href: '/', target: '_blank', rel: 'noopener noreferrer', class: 'a-btn-ghost a-btn-sm' }, 'View site'),
  );

  const main = h('main', { id: 'main-content', class: 'flex-1 min-w-0', tabindex: '-1' });
  const tabbar = h(
    'nav',
    { 'aria-label': 'Main', class: 'lg:hidden fixed inset-x-0 bottom-0 z-40 flex bg-paper border-t border-ink/10 pb-[env(safe-area-inset-bottom)]' },
    tab('Home', '/admin', 'dashboard', ICONS.home),
    tab('Work', '/admin/portfolio', 'portfolio', ICONS.work),
    tab('Add', '/admin/portfolio/add', 'portfolio-add', ICONS.plus),
    tab('Hero', '/admin/media/hero', 'hero-media', ICONS.video),
    moreBtn,
  );

  mount(
    frame,
    h('a', { href: '#main-content', class: 'sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-ink focus:text-ivory focus:px-4 focus:py-2' }, 'Skip to content'),
    sidebar,
    h('div', { class: 'flex-1 min-w-0 flex flex-col' }, topbar, main),
    tabbar,
    drawer,
  );
  return main;
}
