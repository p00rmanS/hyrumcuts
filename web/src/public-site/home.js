import { normalizeItems } from '../lib/content.js';
import { setVisible } from '../lib/dom.js';
import { applyBookingCtas } from './calendly.js';
import { initAccordion } from './chrome.js';
import { initGallery } from './gallery.js';
import { initHero } from './hero.js';
import { applySeo } from './seo.js';
import { renderAbout, renderFaqs, renderInstagram, renderReviews, renderServices } from './sections.js';
import { initChrome, loadSite } from './site.js';

initChrome();

function showGalleryError() {
  const grid = document.querySelector('[data-gallery-grid]');
  grid?.replaceChildren();
  setVisible(grid, false);
  setVisible(document.querySelector('[data-gallery-filters]'), false);
  setVisible(document.querySelector('[data-gallery-error]'), true);
}

const { content, settings } = await loadSite();

applySeo(settings, { home: true });
initHero(settings);
renderAbout(settings);

if (!content.reachable || content.errors.includes('items')) {
  showGalleryError();
} else {
  const items = normalizeItems(content.items, content.categories);
  initGallery({
    items,
    categories: content.categories,
    settings,
    // The mid-gallery band is rendered after load and needs its Book behaviour applied.
    onRender: (root) => applyBookingCtas(settings, root),
  });
  renderInstagram(settings, items);
}

renderServices(content.services);
renderReviews(content.reviews);
renderFaqs(content.faqs);
initAccordion();

// Links like /#reviews from other pages arrive before that section is un-hidden,
// so the browser's own jump found nothing. Jump now that it exists.
const target = /^#[\w-]+$/.test(location.hash) ? document.getElementById(location.hash.slice(1)) : null;
if (target && !target.classList.contains('hidden')) target.scrollIntoView({ behavior: 'instant' });
