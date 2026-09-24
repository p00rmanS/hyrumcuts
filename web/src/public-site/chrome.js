/**
 * Site chrome shared by every page: mobile menu, sticky header, sticky mobile
 * booking bar, and the FAQ accordion.
 */

const FOCUSABLE = 'a[href], button:not([disabled])';

export function initMobileNav() {
  const toggle = document.querySelector('[data-mobile-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!toggle || !menu) return;

  const iconOpen = toggle.querySelector('[data-menu-icon-open]');
  const iconClose = toggle.querySelector('[data-menu-icon-close]');
  const stickyCta = document.querySelector('[data-sticky-booking-cta]');
  let lastFocused = null;

  const visibleFocusable = () => [...menu.querySelectorAll(FOCUSABLE)].filter((el) => !el.classList.contains('hidden'));

  function open() {
    lastFocused = document.activeElement;
    menu.classList.remove('hidden');
    // The bottom Book bar would otherwise duplicate the menu's own Book button.
    stickyCta?.classList.add('sticky-cta-hidden');
    // aria-expanded carries the state; the label stays constant so screen
    // readers do not announce both a new name and a new state.
    toggle.setAttribute('aria-expanded', 'true');
    iconOpen?.classList.add('hidden');
    iconClose?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    visibleFocusable()[0]?.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function close({ restoreFocus = true } = {}) {
    menu.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    iconOpen?.classList.remove('hidden');
    iconClose?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.removeEventListener('keydown', onKeydown);
    if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      close();
      toggle.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    // The toggle stays part of the loop so the menu can always be closed by keyboard.
    const focusable = [toggle, ...visibleFocusable()];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  toggle.addEventListener('click', () => (toggle.getAttribute('aria-expanded') === 'true' ? close() : open()));
  menu.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) close({ restoreFocus: false });
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
    if (event.matches) close({ restoreFocus: false });
  });
}

export function initStickyHeader() {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  const apply = () => header.classList.toggle('shadow-sm', window.scrollY > 12);
  apply();
  window.addEventListener('scroll', apply, { passive: true });
}

/**
 * The mobile "Book" bar hides while a section with its own prominent Book
 * button is on screen (hero, mid-gallery band, closing banner). Zones are
 * looked up on every observation pass so late-rendered ones are included.
 */
export function initStickyBookingCta() {
  const cta = document.querySelector('[data-sticky-booking-cta]');
  if (!cta) return;

  const zones = () => document.querySelectorAll('[data-hero], [data-hide-sticky-cta]');
  if (!('IntersectionObserver' in window)) return; // stays visible: safe default

  const visible = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      cta.classList.toggle('sticky-cta-hidden', visible.size > 0);
    },
    { rootMargin: '-90% 0px 0px 0px' },
  );

  const observed = new WeakSet();
  const scan = () => {
    for (const zone of zones()) {
      if (!observed.has(zone)) {
        observed.add(zone);
        observer.observe(zone);
      }
    }
  };
  scan();
  // Re-scan when the gallery renders its mid-page band.
  new MutationObserver(scan).observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });
  if (zones().length > 0) cta.classList.add('sticky-cta-hidden');
}

/** Accessible accordion: real buttons, aria-expanded / aria-controls, keyboard operable. */
export function initAccordion(root = document.querySelector('[data-accordion]')) {
  if (!root) return;
  root.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-accordion-trigger]') : null;
    if (!trigger) return;
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!expanded));
    panel?.classList.toggle('hidden', expanded);
    trigger.querySelector('[data-accordion-icon]')?.classList.toggle('rotate-45', !expanded);
  });
}
