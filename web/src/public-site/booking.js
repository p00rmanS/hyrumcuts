import { h, setVisible } from '../lib/dom.js';
import { bookingAction } from '../lib/urls.js';
import { applyBookingCtas } from './calendly.js';
import { applySeo } from './seo.js';
import { initChrome, loadSite } from './site.js';

initChrome();

const { content, settings } = await loadSite();
applySeo(settings, { title: `Request an appointment — ${settings.brand_name}`, path: '/booking/' });

// Live calendar option only when a booking link is configured.
const action = bookingAction(settings);
const live = document.querySelector('[data-live-booking]');
setVisible(live, action.kind !== 'form');
setVisible(document.querySelector('[data-option-two]'), action.kind !== 'form');
if (live) applyBookingCtas(settings, live);

// Service options come from the CMS ("Services"); no prices anywhere.
const serviceSelect = document.querySelector('[data-service-select]');
if (serviceSelect) {
  for (const s of content.services) {
    // Submit the readable name: Netlify Forms has no database to map an id back.
    if (s.name?.trim()) serviceSelect.appendChild(h('option', { value: s.name.trim() }, s.name.trim()));
  }
}

// Time windows are editable too. If none are configured, the field is hidden and not required.
const windowSelect = document.querySelector('[data-time-window-select]');
const windowField = document.querySelector('[data-time-window-field]');
const windows = settings.booking_time_windows.filter((w) => typeof w === 'string' && w.trim());
if (windowSelect) {
  for (const w of windows) windowSelect.appendChild(h('option', { value: w }, w));
  if (windows.length === 0) {
    windowSelect.required = false;
    windowSelect.disabled = true; // not submitted
    setVisible(windowField, false);
  }
}

// Earliest selectable date is today, in the visitor's own timezone.
const dateInput = document.querySelector('[data-min-today]');
if (dateInput) {
  const now = new Date();
  dateInput.min = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

initFormValidation();

/**
 * Accessible validation: instead of the browser's transient bubbles, show a
 * summary (role="alert") that links to each problem, mark fields
 * aria-invalid, and move focus to the first one.
 */
function initFormValidation() {
  const form = document.querySelector('[data-request-form]');
  const summary = document.querySelector('[data-form-errors]');
  if (!form || !summary) return;

  const fieldLabel = (el) => form.querySelector(`label[for="${el.id}"]`)?.childNodes[0]?.textContent?.trim() || el.name;
  const message = (el) => {
    if (el.validity.valueMissing) return el.type === 'checkbox' ? 'needs to be checked' : 'is required';
    if (el.validity.typeMismatch) return 'is not valid';
    if (el.validity.rangeUnderflow) return 'must be today or later';
    return 'is not valid';
  };

  form.addEventListener('submit', (event) => {
    const invalid = [...form.elements].filter((el) => el.willValidate && !el.validity.valid);
    for (const el of form.elements) el.removeAttribute?.('aria-invalid');
    if (invalid.length === 0) {
      setVisible(summary, false);
      return; // Netlify Forms takes it from here.
    }
    event.preventDefault();
    for (const el of invalid) el.setAttribute('aria-invalid', 'true');
    summary.replaceChildren(
      h('p', { class: 'font-semibold mb-1' }, 'Please fix the following:'),
      h(
        'ul',
        { class: 'list-disc list-inside' },
        invalid.map((el) => h('li', {}, h('a', { href: `#${el.id}`, class: 'underline', onClick: (e) => { e.preventDefault(); el.focus(); } }, fieldLabel(el)), ` ${message(el)}`)),
      ),
    );
    setVisible(summary, true);
    summary.focus();
    invalid[0].focus();
  });

  form.addEventListener('input', (event) => {
    if (event.target instanceof HTMLElement && event.target.validity?.valid) event.target.removeAttribute('aria-invalid');
  });
}
