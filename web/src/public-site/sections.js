import instagramSvg from '../assets/icons/instagram.svg?raw';
import facebookSvg from '../assets/icons/facebook.svg?raw';
import { h, mount, setVisible } from '../lib/dom.js';
import { hasAboutContent, openingHours, usableFaqs, usableReviews, usableServices } from '../lib/content.js';
import { publicMediaUrl } from '../lib/media-url.js';
import { safeHttpUrl } from '../lib/urls.js';
import { setSectionVisible } from './bind.js';

/**
 * Renderers for the below-the-fold sections. Each hides its section (and the
 * matching nav links) when there is nothing published, instead of showing a
 * "coming soon" stub.
 */

export function renderReviews(reviews) {
  const list = usableReviews(reviews);
  setSectionVisible('reviews', list.length > 0);
  const target = document.querySelector('[data-reviews-list]');
  if (!target || list.length === 0) return;
  mount(
    target,
    list.map((r) =>
      h(
        'figure',
        { class: 'border border-ink/10 p-6 flex flex-col justify-between' },
        h('blockquote', { class: 'text-lg leading-relaxed mb-4' }, `“${r.quote.trim()}”`),
        h(
          'figcaption',
          { class: 'text-sm text-muted' },
          h('span', { class: 'font-semibold text-ink' }, r.reviewer_name.trim()),
          r.haircut_type?.trim() ? ` · ${r.haircut_type.trim()}` : null,
        ),
      ),
    ),
  );
}

/** Opening hours in the Contact section; neighbouring days with the same hours are grouped. */
export function renderHours(settings) {
  const wrap = document.querySelector('[data-hours]');
  const list = document.querySelector('[data-hours-list]');
  const note = document.querySelector('[data-hours-note]');
  if (!wrap || !list) return;
  const lines = openingHours(settings);
  const noteText = settings.hours_note?.trim() ?? '';
  setVisible(wrap, lines.length > 0 || Boolean(noteText));
  mount(
    list,
    lines.flatMap((line) => [
      // "Tue–Sat" on screen, "Tuesday to Saturday" for screen readers.
      h('dt', { class: 'font-semibold' }, h('span', { 'aria-hidden': 'true' }, line.days), h('span', { class: 'sr-only' }, line.label)),
      h('dd', { class: 'text-muted' }, line.hours),
    ]),
  );
  if (note) {
    note.textContent = noteText;
    setVisible(note, Boolean(noteText));
  }
}

/** The cuts Hyrum offers (the same list as the request form). Names and descriptions only, never prices. */
export function renderServices(services) {
  const list = usableServices(services);
  setSectionVisible('services', list.length > 0);
  const target = document.querySelector('[data-services-list]');
  if (!target || list.length === 0) return;
  mount(
    target,
    list.map((s) =>
      h(
        'li',
        { class: 'border-t border-ink/15 pt-5' },
        h('h3', { class: 'text-xl font-display mb-2' }, s.name.trim()),
        s.description?.trim() ? h('p', { class: 'text-muted leading-relaxed' }, s.description.trim()) : null,
      ),
    ),
  );
}

export function renderFaqs(faqs) {
  const list = usableFaqs(faqs);
  setSectionVisible('faq', list.length > 0);
  const target = document.querySelector('[data-faq] [data-accordion]');
  if (!target || list.length === 0) return;
  mount(
    target,
    list.map((f, i) => {
      const n = i + 1;
      return h(
        'div',
        { class: 'border-b border-ink/10' },
        h(
          'h3',
          {},
          h(
            'button',
            { type: 'button', class: 'accordion-trigger', 'aria-expanded': 'false', 'aria-controls': `faq-panel-${n}`, id: `faq-trigger-${n}`, dataset: { accordionTrigger: '' } },
            h('span', {}, f.question.trim()),
            plusIcon(),
          ),
        ),
        h('div', { id: `faq-panel-${n}`, role: 'region', 'aria-labelledby': `faq-trigger-${n}`, class: 'hidden pb-5 text-muted leading-relaxed whitespace-pre-line', dataset: { accordionPanel: '' } }, f.answer.trim()),
      );
    }),
  );
}

function plusIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ width: '18', height: '18', viewBox: '0 0 18 18', fill: 'none', 'aria-hidden': 'true', class: 'shrink-0 transition-transform duration-200', 'data-accordion-icon': '' })) svg.setAttribute(k, v);
  const path = document.createElementNS(ns, 'path');
  for (const [k, v] of Object.entries({ d: 'M9 3v12M3 9h12', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })) path.setAttribute(k, v);
  svg.appendChild(path);
  return svg;
}

export function renderAbout(settings) {
  const photoPath = settings.profile_photo_path;
  const photo = publicMediaUrl(photoPath);
  const show = hasAboutContent(settings);
  setSectionVisible('about', show);
  if (!show) return;

  const wrap = document.querySelector('[data-about-photo-wrap]');
  const img = document.querySelector('[data-about-photo]');
  if (wrap && img) {
    setVisible(wrap, Boolean(photo));
    if (photo) {
      img.setAttribute('src', photo);
      // Meaningful alt text comes from the owner; without it the image is decorative.
      img.setAttribute('alt', settings.profile_photo_alt?.trim() || '');
    }
  }
  // Without a photo the text column simply takes the full width.
  const text = document.querySelector('[data-about-text]');
  if (text) text.classList.toggle('lg:col-span-2', !photo);
}

const DISMISS_KEY = 'hh-announcement-dismissed';

/** Keep anchor jumps and the mobile menu clear of the (now taller) fixed header. */
function syncHeaderOffset() {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  const height = header.offsetHeight;
  document.documentElement.style.scrollPaddingTop = `${height + 16}px`;
  const menu = document.querySelector('[data-mobile-menu]');
  if (menu) menu.style.top = `${height}px`;
  // Push the page down by the bar's own height so it never covers a heading, however many lines it wraps to.
  const bar = document.querySelector('[data-announcement]');
  const main = document.querySelector('main');
  if (main) main.style.paddingTop = bar && !bar.classList.contains('hidden') ? `${bar.offsetHeight}px` : '';
}

/** The owner's announcement bar at the top of every page (scheduled by date, dismissible per visit). */
export function renderAnnouncement(announcement) {
  const bar = document.querySelector('[data-announcement]');
  if (!bar) return;
  let dismissed = '';
  try {
    dismissed = sessionStorage.getItem(DISMISS_KEY) ?? '';
  } catch {
    // Storage blocked (private mode, etc.): simply never remember a dismissal.
  }
  const show = Boolean(announcement) && dismissed !== announcement.text;
  setVisible(bar, show);
  if (!show) return;

  bar.querySelector('[data-announcement-text]').textContent = announcement.text;
  const link = bar.querySelector('[data-announcement-link]');
  setVisible(link, Boolean(announcement.link));
  if (announcement.link) {
    link.textContent = announcement.link.label;
    link.setAttribute('href', announcement.link.href);
  }
  bar.querySelector('[data-announcement-dismiss]')?.addEventListener('click', () => {
    setVisible(bar, false);
    syncHeaderOffset();
    try {
      sessionStorage.setItem(DISMISS_KEY, announcement.text);
    } catch {
      // ignore
    }
  });
  syncHeaderOffset();
  window.addEventListener('resize', syncHeaderOffset, { passive: true });
}

/** Instagram / Facebook icon links in the footer. */
export function renderSocial(settings) {
  const target = document.querySelector('[data-social-icons]');
  const wrap = document.querySelector('[data-footer-social]');
  if (!target || !wrap) return;

  const links = [
    { url: safeHttpUrl(settings.instagram_url, { httpsOnly: true }), svg: instagramSvg, label: `Visit ${settings.brand_name} on Instagram` },
    { url: safeHttpUrl(settings.facebook_url, { httpsOnly: true }), svg: facebookSvg, label: `Visit ${settings.brand_name} on Facebook` },
  ].filter((l) => l.url);

  setVisible(wrap, links.length > 0);
  mount(
    target,
    links.map((l) => {
      const icon = h('span', { class: 'h-5 w-5 block' });
      // Trusted, developer-supplied SVG files bundled at build time (not user content).
      icon.innerHTML = l.svg;
      return h(
        'a',
        { href: l.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${l.label} (opens in a new tab)`, class: 'inline-flex h-11 w-11 items-center justify-center text-ivory hover:text-copper transition-colors' },
        icon,
      );
    }),
  );
}

/** "See more on Instagram" buttons plus an optional photo strip from published work. */
export function renderInstagram(settings, items) {
  const url = safeHttpUrl(settings.instagram_url, { httpsOnly: true });
  const section = document.querySelector('[data-instagram]');
  setVisible(section, Boolean(url));
  for (const cta of document.querySelectorAll('[data-instagram-cta]')) {
    setVisible(cta, Boolean(url));
    if (url) cta.setAttribute('href', url);
  }
  if (!url) return;

  const grid = document.querySelector('[data-instagram-grid]');
  const shots = items.filter((i) => i.kind === 'image').slice(0, 6);
  if (!grid || shots.length === 0) return;
  setVisible(grid, true);
  mount(
    grid,
    shots.map((s) =>
      h(
        'a',
        { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'group relative block aspect-square overflow-hidden', 'aria-label': `${s.title} — see more on Instagram (opens in a new tab)` },
        h('img', { src: s.image.thumb, alt: '', loading: 'lazy', decoding: 'async', width: s.image.thumbWidth, height: s.image.thumbHeight, class: 'h-full w-full object-cover transition-transform duration-300 group-hover:scale-105' }),
      ),
    ),
  );
}
