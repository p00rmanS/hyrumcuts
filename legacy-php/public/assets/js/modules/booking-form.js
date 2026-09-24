/**
 * Small progressive enhancements for the booking form. All of this is
 * convenience only — every rule here is re-checked server-side.
 */
export function initBookingForm() {
  const dateInput = document.querySelector('[data-min-today]');
  if (dateInput) {
    const today = new Date();
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dateInput.setAttribute('min', iso);
  }

  const backLink = document.querySelector('[data-back-link]');
  if (backLink && window.history.length > 1) {
    backLink.addEventListener('click', (event) => {
      event.preventDefault();
      window.history.back();
    });
  }
}
