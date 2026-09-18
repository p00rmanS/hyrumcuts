/** Subtle header shadow/shrink after scrolling, without changing layout height. */
export function initStickyHeader() {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;

  const applyState = () => {
    if (window.scrollY > 12) {
      header.classList.add('shadow-sm');
    } else {
      header.classList.remove('shadow-sm');
    }
  };

  applyState();
  window.addEventListener('scroll', applyState, { passive: true });
}

/**
 * The persistent mobile "Book a Haircut" bar hides itself whenever a
 * section that already has its own prominent "Book a Haircut" CTA is on
 * screen — the hero, and the closing booking banner — so it never sits
 * directly next to (or on top of) a duplicate of itself.
 */
export function initStickyBookingCta() {
  const cta = document.querySelector('[data-sticky-booking-cta]');
  const hideZones = document.querySelectorAll('[data-hero], [data-hide-sticky-cta]');
  if (!cta || hideZones.length === 0) return;

  cta.classList.add('sticky-cta-hidden');

  if (!('IntersectionObserver' in window)) {
    cta.classList.remove('sticky-cta-hidden');
    return;
  }

  const intersecting = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          intersecting.add(entry.target);
        } else {
          intersecting.delete(entry.target);
        }
      });
      cta.classList.toggle('sticky-cta-hidden', intersecting.size > 0);
    },
    { rootMargin: '-90% 0px 0px 0px' }
  );
  hideZones.forEach((zone) => observer.observe(zone));
}
