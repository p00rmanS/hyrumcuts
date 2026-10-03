/**
 * Small pure helpers behind the "easy to use" touches in the admin:
 * where each settings page shows up on the website, the Google-style
 * search preview, and the portfolio search. No DOM, so they are unit-tested.
 */

/** The public page (and section) each settings page changes. null = not visible on a page. */
export const SECTION_PUBLIC_PATH = Object.freeze({
  hero: '/',
  about: '/#about',
  announcement: '/',
  booking: '/booking/',
  hours: '/#contact',
  contact: '/#contact',
  social: '/#contact',
  seo: null,
});

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

function clip(text, limit) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return { text: clean, clipped: false };
  const cut = clean.slice(0, limit - 1);
  // Break on a word boundary when one is reasonably close, like Google does.
  const space = cut.lastIndexOf(' ');
  return { text: `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`, clipped: true };
}

/**
 * Roughly how a search result would look. Google decides the final wording;
 * this only shows length problems early.
 */
export function searchPreview({ seo_title, seo_description, canonical_url }, { fallbackTitle = 'HyrumHaircuts', origin = 'https://hyrumhaircuts.com' } = {}) {
  const title = clip(seo_title || fallbackTitle, TITLE_LIMIT);
  const description = clip(seo_description, DESCRIPTION_LIMIT);
  let shownUrl;
  try {
    const u = new URL(canonical_url || origin);
    shownUrl = `${u.hostname}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`;
  } catch {
    shownUrl = origin.replace(/^https?:\/\//, '');
  }
  const tips = [];
  if (title.clipped) tips.push(`Your title is longer than about ${TITLE_LIMIT} characters, so Google will probably cut it off.`);
  if (!description.text) tips.push('Add a description. Without one, Google picks some text from the page itself.');
  else if (description.clipped) tips.push(`Your description is longer than about ${DESCRIPTION_LIMIT} characters, so the end may be cut off.`);
  return { title: title.text, description: description.text, url: shownUrl, tips };
}

/** Case- and accent-insensitive match on a portfolio item's title, label and category. */
export function matchesSearch(item, query) {
  const fold = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold([item.title, item.service_label, item.description, item.category?.name].join(' '));
  return words.every((w) => haystack.includes(w));
}

/** Filter state -> query string for the Manage Work URL (so a refresh or back keeps the filters). */
export function portfolioQuery({ status = 'all', categoryId = '', search = '' }) {
  const q = new URLSearchParams();
  if (status && status !== 'all') q.set('status', status);
  if (categoryId) q.set('category', categoryId);
  if (search.trim()) q.set('q', search.trim());
  const s = q.toString();
  return s ? `?${s}` : '';
}
