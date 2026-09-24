/** Accessible FAQ accordion: keyboard-operable buttons with correct ARIA state. */
export function initAccordion() {
  const root = document.querySelector('[data-accordion]');
  if (!root) return;

  const triggers = Array.from(root.querySelectorAll('[data-accordion-trigger]'));

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      const icon = trigger.querySelector('[data-accordion-icon]');
      const expanded = trigger.getAttribute('aria-expanded') === 'true';

      trigger.setAttribute('aria-expanded', String(!expanded));
      panel?.classList.toggle('hidden', expanded);
      icon?.classList.toggle('rotate-45', !expanded);
    });
  });
}
