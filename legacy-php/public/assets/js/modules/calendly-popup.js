/**
 * Turns every "Book a Haircut"-style link marked data-calendly-trigger into
 * a Calendly popup instead of a page navigation. Each trigger still has a
 * real href="/booking" in the markup (server-rendered, no JS required), so:
 *   - with JS and Calendly's widget script loaded: opens the popup inline.
 *   - with JS but the widget script not yet ready: falls through to the
 *     normal link, landing on /booking's own embedded calendar + form.
 *   - with JS disabled entirely: it's just a normal link the whole time.
 */
export function initCalendlyPopup() {
  const triggers = document.querySelectorAll('[data-calendly-trigger]');
  if (triggers.length === 0) return;

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      const url = trigger.getAttribute('data-calendly-url');
      if (!url || !window.Calendly || typeof window.Calendly.initPopupWidget !== 'function') {
        return; // let the normal <a href="/booking"> navigation happen
      }
      event.preventDefault();
      window.Calendly.initPopupWidget({ url });
    });
  });
}
