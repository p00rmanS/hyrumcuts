import { applySeo } from './seo.js';
import { initChrome, loadSite } from './site.js';

// Thank-you and 404 pages: shared header/footer and the editable brand details only.
initChrome();
const { settings } = await loadSite();
applySeo(settings, { title: document.title.replace(/HyrumHaircuts$/, settings.brand_name) });
