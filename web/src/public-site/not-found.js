import { redirectIfAdmin } from './spa-redirect.js';

// 404.html entry. Admin addresses are redirected first, synchronously; only a
// genuinely missing public page loads the shared header/footer and content.
if (!redirectIfAdmin()) await import('./static-page.js');
