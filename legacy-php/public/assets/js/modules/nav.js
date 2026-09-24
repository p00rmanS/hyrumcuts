/**
 * Mobile menu: accessible open/close, focus management, Escape-to-close,
 * and body scroll locking while open.
 */
export function initMobileNav() {
  const toggle = document.querySelector('[data-mobile-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!toggle || !menu) return;

  const iconOpen = toggle.querySelector('[data-menu-icon-open]');
  const iconClose = toggle.querySelector('[data-menu-icon-close]');
  const links = menu.querySelectorAll('[data-mobile-link], a, button');
  const stickyCta = document.querySelector('[data-sticky-booking-cta]');
  let lastFocused = null;

  function open() {
    lastFocused = document.activeElement;
    menu.classList.remove('hidden');
    // The persistent bottom CTA sits at the same stacking layer as the menu
    // and would otherwise show through/duplicate the menu's own "Book a
    // Haircut" link while the menu is open.
    stickyCta?.classList.add('sticky-cta-hidden');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    iconOpen?.classList.add('hidden');
    iconClose?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const firstLink = menu.querySelector('a, button');
    firstLink?.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function close({ restoreFocus = true } = {}) {
    menu.classList.add('hidden');
    // Deliberately not touched here: the scroll-based IntersectionObserver
    // in sticky-header.js is the source of truth for whether the hero (with
    // its own CTA) is still in view, and closing the menu doesn't change
    // scroll position.
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    iconOpen?.classList.remove('hidden');
    iconClose?.classList.add('hidden');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    if (restoreFocus && lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(menu.querySelectorAll('a, button')).filter((el) => !el.hidden);
      if (focusable.length === 0) return;
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
  }

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    isOpen ? close() : open();
  });

  links.forEach((link) => {
    link.addEventListener('click', () => close({ restoreFocus: false }));
  });

  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
    if (event.matches) close({ restoreFocus: false });
  });
}
