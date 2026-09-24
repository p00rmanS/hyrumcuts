import { h, mount } from '../lib/dom.js';
import { mailtoHref } from '../lib/urls.js';
import { applySeo } from './seo.js';
import { initChrome, loadSite } from './site.js';

initChrome();
const { settings } = await loadSite();
applySeo(settings, { title: `Privacy notice — ${settings.brand_name}`, path: '/privacy/' });

// Point privacy requests at a real address when the owner has entered one.
const contact = settings.privacy_contact_email?.trim() || settings.email?.trim();
const href = mailtoHref(contact);
const target = document.querySelector('[data-privacy-contact]');
if (target && href) {
  mount(
    target,
    'To view, correct or delete the information tied to a request, email ',
    h('a', { href, class: 'underline hover:text-ink' }, contact),
    ' with your name and the date of your request.',
  );
}
