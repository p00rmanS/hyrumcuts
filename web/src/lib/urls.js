/**
 * URL and contact-link helpers. Everything that ends up in an href goes
 * through one of these, so a bad value stored in the database can never
 * become a `javascript:` link.
 */

/**
 * Returns a normalized absolute http(s) URL, or '' if the value is not one.
 * @param {unknown} value
 * @param {{ httpsOnly?: boolean }} [options]
 */
export function safeHttpUrl(value, { httpsOnly = false } = {}) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return '';
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return '';
  }
  if (url.protocol === 'https:' || (!httpsOnly && url.protocol === 'http:')) return url.toString();
  return '';
}

/** `tel:` href for a display phone number, or '' when there are no digits. */
export function telHref(phone) {
  if (typeof phone !== 'string') return '';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  return /\d/.test(cleaned) ? `tel:${cleaned}` : '';
}

/** `mailto:` href, or '' when the value is not a plausible address. */
export function mailtoHref(email) {
  if (typeof email !== 'string') return '';
  const trimmed = email.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) ? `mailto:${trimmed}` : '';
}

/**
 * Decide what a "Book" button does, from the booking settings.
 *  - calendly + URL      -> open the Calendly popup (href still works as a fallback)
 *  - other provider + URL-> plain external link
 *  - anything else       -> the on-site appointment-request page
 *
 * @param {{ booking_provider?: string, booking_url?: string }} settings
 * @returns {{ kind: 'calendly' | 'link' | 'form', url: string }}
 */
export function bookingAction(settings) {
  const url = safeHttpUrl(settings?.booking_url ?? '', { httpsOnly: true });
  const provider = settings?.booking_provider ?? 'none';
  if (!url || provider === 'none') return { kind: 'form', url: '' };
  if (provider === 'calendly') return { kind: 'calendly', url };
  return { kind: 'link', url };
}
