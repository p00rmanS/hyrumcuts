import { openingHours } from '../lib/content.js';
import { setVisible } from '../lib/dom.js';
import { mailtoHref, safeHttpUrl, telHref } from '../lib/urls.js';

const HREF_BUILDERS = { tel: telHref, mailto: mailtoHref };

const hasText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Push settings into the page.
 *
 *  data-bind="key"          -> element text (always as text, never as HTML)
 *  data-href-kind="tel|mailto" -> sets href from the same key
 *  data-show-if="key"       -> element visible only when that setting has text
 *
 * Unset optional fields simply disappear; nothing prints "undefined".
 *
 * @param {Record<string, any>} settings resolved settings (see resolveSettings)
 * @param {ParentNode} [root]
 */
export function applySettings(settings, root = document) {
  for (const el of root.querySelectorAll('[data-bind]')) {
    const value = settings[el.dataset.bind];
    if (typeof value !== 'string') continue;
    el.textContent = value;
    const kind = el.dataset.hrefKind;
    if (kind && HREF_BUILDERS[kind]) {
      const href = HREF_BUILDERS[kind](value);
      if (href) el.setAttribute('href', href);
      else el.removeAttribute('href');
    }
  }

  for (const el of root.querySelectorAll('[data-show-if]')) {
    setVisible(el, hasText(settings[el.dataset.showIf]));
  }

  const hasPhone = hasText(settings.phone) && Boolean(telHref(settings.phone));
  const hasEmail = hasText(settings.email) && Boolean(mailtoHref(settings.email));
  const hasLocation = hasText(settings.location_general);
  const mapUrl = safeHttpUrl(settings.map_url, { httpsOnly: true });

  for (const el of root.querySelectorAll('[data-footer-phone], [data-contact-phone]')) setVisible(el, hasPhone);
  for (const el of root.querySelectorAll('[data-footer-email], [data-contact-email]')) setVisible(el, hasEmail);
  for (const el of root.querySelectorAll('[data-footer-contact]')) setVisible(el, hasPhone || hasEmail);
  for (const el of root.querySelectorAll('[data-contact-map]')) {
    setVisible(el, Boolean(mapUrl));
    el.querySelector('[data-map-link]')?.setAttribute('href', mapUrl || '#');
  }
  const hasHours = openingHours(settings).length > 0 || hasText(settings.hours_note);
  const hasContact = hasPhone || hasEmail || hasLocation || Boolean(mapUrl) || hasHours;
  for (const el of root.querySelectorAll('[data-contact]')) setVisible(el, hasContact);
  for (const el of root.querySelectorAll('[data-nav-contact]')) setVisible(el, hasContact);

  for (const el of root.querySelectorAll('[data-year]')) el.textContent = String(new Date().getFullYear());
}

/** Show or hide a page section and every nav link that points at it. */
export function setSectionVisible(name, visible, root = document) {
  for (const el of root.querySelectorAll(`[data-nav-${name}]`)) setVisible(el, visible);
  const section = root.querySelector(`[data-${name}]`);
  if (section) setVisible(section, visible);
}
