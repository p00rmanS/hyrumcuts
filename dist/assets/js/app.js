import { initMobileNav } from './modules/nav.js';
import { initStickyHeader, initStickyBookingCta } from './modules/sticky-header.js';
import { initHeroVideo } from './modules/hero-video.js';
import { initGallery } from './modules/gallery.js';
import { initAccordion } from './modules/accordion.js';
import { initBookingForm } from './modules/booking-form.js';
import { initCalendlyPopup } from './modules/calendly-popup.js';

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initStickyHeader();
  initStickyBookingCta();
  initHeroVideo();
  initGallery();
  initAccordion();
  initBookingForm();
  initCalendlyPopup();
});
