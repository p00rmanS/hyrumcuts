import '../styles/app.css';
import { activeAnnouncement, fetchPublicContent, resolveSettings, sectionAvailability } from '../lib/content.js';
import { setVisible } from '../lib/dom.js';
import { applySettings } from './bind.js';
import { applyBookingCtas, initCalendlyClicks } from './calendly.js';
import { initMobileNav, initStickyBookingCta, initStickyHeader } from './chrome.js';
import { renderAnnouncement, renderSocial } from './sections.js';

/** Behaviour every public page needs, before any data arrives. */
export function initChrome() {
  initMobileNav();
  initStickyHeader();
  initStickyBookingCta();
  initCalendlyClicks();
}

/**
 * Fetch published content and apply the parts every page shares: brand name,
 * header/footer contact details, social links and the Book buttons.
 *
 * If Supabase is unreachable the bundled brand-critical copy is used, so the
 * page still renders and the Book buttons still go to /booking/.
 */
export async function loadSite() {
  const content = await fetchPublicContent();
  const settings = resolveSettings(content.reachable ? content.settings : null);
  applySettings(settings);
  applyBookingCtas(settings);
  renderSocial(settings);
  renderAnnouncement(activeAnnouncement(settings));
  // Nav links to optional home sections, on every page (the sections themselves live on the home page).
  for (const [name, available] of Object.entries(sectionAvailability(settings, content))) {
    for (const el of document.querySelectorAll(`[data-nav-${name}]`)) setVisible(el, available);
  }
  return { content, settings };
}
