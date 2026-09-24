import { bookingAction } from '../lib/urls.js';

/**
 * "Book" buttons.
 *
 * Every Book button is a real link to /booking/ in the HTML, so it works with
 * no JavaScript. Once the booking settings are known:
 *   calendly -> the button opens Calendly's popup (loaded only when needed)
 *   other    -> the button links straight to the booking URL
 *   none     -> it keeps going to the on-site appointment-request page
 *
 * If Calendly cannot load (blocked, offline), the click falls through to the
 * normal /booking/ link, so a visitor is never stuck.
 */

const WIDGET_JS = 'https://assets.calendly.com/assets/external/widget.js';
const WIDGET_CSS = 'https://assets.calendly.com/assets/external/widget.css';

let loading = null;

export function ensureCalendly() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Calendly?.initPopupWidget) return Promise.resolve(window.Calendly);
  loading ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = WIDGET_CSS;
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = WIDGET_JS;
    script.async = true;
    script.onload = () => (window.Calendly?.initPopupWidget ? resolve(window.Calendly) : reject(new Error('Calendly missing')));
    script.onerror = () => {
      loading = null; // allow a retry on the next click
      reject(new Error('Calendly failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** @param {Record<string, any>} settings @param {ParentNode} [root] */
export function applyBookingCtas(settings, root = document) {
  const action = bookingAction(settings);
  const ctas = root.querySelectorAll('[data-book-cta]');

  for (const cta of ctas) {
    if (cta.dataset.bookingBound === action.kind + action.url) continue;
    cta.dataset.bookingBound = action.kind + action.url;

    if (action.kind === 'link') {
      cta.setAttribute('href', action.url);
      cta.setAttribute('target', '_blank');
      cta.setAttribute('rel', 'noopener noreferrer');
    } else {
      cta.setAttribute('href', '/booking/');
      cta.removeAttribute('target');
      cta.removeAttribute('rel');
    }

    if (action.kind === 'calendly') {
      cta.dataset.calendlyUrl = action.url;
    } else {
      delete cta.dataset.calendlyUrl;
    }
  }

  if (action.kind === 'calendly') warmOnIntent(ctas);
}

let warmed = false;
function warmOnIntent(ctas) {
  if (warmed) return;
  warmed = true;
  // Start downloading the widget the first time someone shows intent to book,
  // so the popup opens instantly without slowing the initial page load.
  const warm = () => ensureCalendly().catch(() => {});
  for (const cta of ctas) {
    for (const type of ['pointerenter', 'focus', 'touchstart']) {
      cta.addEventListener(type, warm, { once: true, passive: true });
    }
  }
}

/** One delegated click handler for every current and future Book button. */
export function initCalendlyClicks() {
  document.addEventListener('click', async (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const cta = event.target instanceof Element ? event.target.closest('[data-book-cta][data-calendly-url]') : null;
    if (!cta) return;

    event.preventDefault();
    const url = cta.dataset.calendlyUrl;
    try {
      const Calendly = await ensureCalendly();
      Calendly.initPopupWidget({ url });
    } catch {
      // Blocked or offline: use the on-site booking page instead.
      window.location.assign(cta.getAttribute('href') || '/booking/');
    }
  });
}
