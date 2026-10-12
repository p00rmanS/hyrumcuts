/**
 * Field definitions and validation for the "Website content" and "Settings"
 * pages. One place describes each field (label, help, example, limit, rule),
 * and both the form renderer and the validator read it, so the screen and the
 * rules can't drift apart. The limits mirror the CHECK constraints in
 * supabase/migrations/*_cms_core_schema.sql; the database still has the final say.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+()./ -]{0,40}$/;

const isHttpsUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !/\s/.test(v);
  } catch {
    return false;
  }
};

/** "instagram.com/x" -> "https://instagram.com/x". Leaves anything else alone. */
export function normalizeUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://');
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v; // some other scheme: leave it for validation to reject
  return `https://${v}`;
}

const hostMatches = (value, pattern) => {
  try {
    return pattern.test(new URL(value).hostname);
  } catch {
    return false;
  }
};

/** A real calendar date written as YYYY-MM-DD (what <input type="date"> produces). */
const isIsoDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

const validTimeZone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * @typedef {{
 *   key: string, label: string, type: 'text'|'textarea'|'url'|'email'|'tel'|'select'|'lines'|'date',
 *   max?: number, required?: boolean, help?: string, example?: string,
 *   options?: Array<[string, string]>, host?: RegExp, hostName?: string, rows?: number, maxLines?: number,
 * }} FieldSpec
 */

/** @type {Record<string, { title: string, description: string, fields: FieldSpec[] }>} */
export const SETTINGS_SECTIONS = {
  hero: {
    title: 'Hero',
    description: 'The big message at the top of your home page.',
    fields: [
      { key: 'hero_eyebrow', label: 'Small line above the heading', type: 'text', max: 120, example: 'Precision cuts. Personal style.' },
      { key: 'hero_heading', label: 'Main heading', type: 'text', max: 160, example: 'A sharper look, cut for you.' },
      { key: 'hero_subheading', label: 'Supporting sentence', type: 'textarea', rows: 3, max: 300, example: 'Modern cuts, clean fades, and detail-first grooming.' },
      { key: 'cta_book_label', label: 'Booking button text', type: 'text', max: 40, required: true, help: 'Used on every Book button on your website (and read aloud for the scissors icon at the top).', example: 'Book Your Next Cut' },
      { key: 'cta_view_work_label', label: '"See my work" button', type: 'text', max: 40, required: true, example: 'View My Work' },
      { key: 'gallery_all_label', label: 'Label for "show everything" in the gallery filters', type: 'text', max: 40, required: true, example: 'All Cuts' },
    ],
  },
  about: {
    title: 'About',
    description: 'Your story. Fields you leave empty are simply hidden on the site.',
    fields: [
      { key: 'barber_name', label: 'Your name', type: 'text', max: 80, required: true, example: 'Hyrum' },
      { key: 'about_heading', label: 'Heading', type: 'text', max: 160, example: 'The barber behind the chair.' },
      { key: 'about_bio', label: 'Biography', type: 'textarea', rows: 8, max: 3000, help: 'Plain text. A blank line starts a new paragraph.' },
      { key: 'about_specialties', label: 'Specialties', type: 'text', max: 300, example: 'Skin fades, tapers, textured crops' },
      { key: 'location_general', label: 'General location', type: 'text', max: 200, help: 'A city or area is fine. Only add a street address if you want the public to see it.', example: 'Salt Lake City, UT' },
      { key: 'availability_note', label: 'Availability note', type: 'text', max: 200, example: 'Tuesday–Saturday' },
      { key: 'preferred_contact', label: 'Preferred way to be contacted', type: 'text', max: 120, example: 'Text is fastest' },
    ],
  },
  announcement: {
    title: 'Announcement',
    description: 'A short notice across the top of every page, like time away or holiday hours. Leave the message empty to turn it off.',
    fields: [
      { key: 'announcement_text', label: 'Message', type: 'text', max: 200, example: 'Away Oct 3–10. Booking reopens Oct 11.' },
      { key: 'announcement_link_label', label: 'Link text (optional)', type: 'text', max: 40, example: 'Book now' },
      { key: 'announcement_link_url', label: 'Link (optional)', type: 'url', max: 500, help: 'Where the link text goes. Leave empty for no link.', example: 'https://calendly.com/your-name/haircut' },
      { key: 'announcement_starts_on', label: 'Show from (optional)', type: 'date', help: 'Leave empty to show it straight away.' },
      { key: 'announcement_ends_on', label: 'Show until (optional)', type: 'date', help: 'The last day it shows. Leave empty to keep it up until you remove it.' },
    ],
  },
  hours: {
    title: 'Opening hours',
    description: 'When you take clients. Shown in the Contact section of your website. Leave a day empty to leave it out.',
    fields: [
      { key: 'hours_mon', label: 'Monday', type: 'text', max: 40, example: '9am–6pm' },
      { key: 'hours_tue', label: 'Tuesday', type: 'text', max: 40, example: '9am–6pm' },
      { key: 'hours_wed', label: 'Wednesday', type: 'text', max: 40, example: '9am–6pm' },
      { key: 'hours_thu', label: 'Thursday', type: 'text', max: 40, example: '9am–8pm' },
      { key: 'hours_fri', label: 'Friday', type: 'text', max: 40, example: '9am–8pm' },
      { key: 'hours_sat', label: 'Saturday', type: 'text', max: 40, example: '10am–4pm' },
      { key: 'hours_sun', label: 'Sunday', type: 'text', max: 40, example: 'Closed' },
      { key: 'hours_note', label: 'Note under the hours (optional)', type: 'text', max: 160, example: 'By appointment only. Walk-ins when there is space.' },
    ],
  },
  booking: {
    title: 'Booking link',
    description: 'Where the "Book" buttons send people. Your booking provider stays exactly as it is; this only changes the link.',
    fields: [
      {
        key: 'booking_provider',
        label: 'Booking provider',
        type: 'select',
        required: true,
        options: [
          ['calendly', 'Calendly'],
          ['google_calendar', 'Google Calendar appointment page'],
          ['other', 'Another booking website'],
          ['none', 'None (use the request form only)'],
        ],
      },
      { key: 'booking_url', label: 'Booking link', type: 'url', max: 500, help: 'Paste the full link from your booking provider. Google Calendar: open your appointment schedule, choose Open booking page (or Share), and copy the link. Calendly: copy your event link.', example: 'https://calendar.app.google/AbCd1234' },
      { key: 'booking_time_windows', label: 'Time choices on the request form', type: 'lines', maxLines: 8, max: 60, help: 'One per line. These are the "preferred time" choices people can pick when sending a request.', example: 'Morning (9am–12pm)' },
    ],
  },
  contact: {
    title: 'Contact',
    description: 'Public contact details. Anything you leave empty is hidden.',
    fields: [
      { key: 'phone', label: 'Phone number', type: 'tel', max: 40, example: '(801) 555-0123' },
      { key: 'email', label: 'Public email address', type: 'email', max: 254, example: 'hello@example.com' },
      { key: 'map_url', label: 'Directions link', type: 'url', max: 500, help: 'A Google Maps (or similar) link. Adds a "Get directions" link.', example: 'https://maps.google.com/?q=...' },
      { key: 'privacy_contact_email', label: 'Email for privacy requests', type: 'email', max: 254, help: 'Optional. Shown on the privacy page. Uses your public email if left empty.' },
    ],
  },
  social: {
    title: 'Social links',
    description: 'Links to your profiles. Icons appear in the footer only for the ones you fill in.',
    fields: [
      { key: 'instagram_url', label: 'Instagram link', type: 'url', max: 300, host: /(^|\.)instagram\.com$/i, hostName: 'instagram.com', example: 'https://www.instagram.com/yourname' },
      { key: 'facebook_url', label: 'Facebook link', type: 'url', max: 300, host: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, hostName: 'facebook.com', example: 'https://www.facebook.com/yourpage' },
    ],
  },
  seo: {
    title: 'Search & sharing (SEO)',
    description: 'How your site appears in Google and when a link is shared. Only fill in what you know is true.',
    fields: [
      { key: 'seo_title', label: 'Page title', type: 'text', max: 70, required: true, help: 'Aim for under 60 characters.', example: 'HyrumHaircuts — Precision Cuts, Personal Style' },
      { key: 'seo_description', label: 'Description', type: 'textarea', rows: 3, max: 320, help: 'One or two sentences. Aim for under 160 characters.', example: 'Fades, tapers and textured cuts by Hyrum. Book your next haircut online.' },
      { key: 'canonical_url', label: 'Main website address', type: 'url', max: 300, help: 'Your real web address, once your domain is live.', example: 'https://hyrumhaircuts.com/' },
      { key: 'timezone', label: 'Time zone', type: 'text', max: 64, required: true, help: 'A standard time zone name.', example: 'America/Denver' },
      { key: 'credit_text', label: 'Optional credit line in the footer', type: 'text', max: 120, help: 'For example a website designer credit. Leave empty for none.' },
    ],
  },
};

/** Normalise one raw form value for storage. */
export function cleanValue(spec, raw) {
  if (spec.type === 'lines') {
    return String(raw ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (spec.type === 'url') return normalizeUrl(raw);
  if (spec.type === 'select') return String(raw ?? '');
  if (spec.type === 'date') return String(raw ?? '').trim() || null; // empty date column = NULL, not ''
  return String(raw ?? '').trim();
}

/**
 * Validate one already-cleaned value. Returns '' when fine, else a helpful sentence.
 * @param {FieldSpec} spec
 */
export function validateField(spec, value) {
  const label = spec.label.replace(/\?$/, '');

  if (spec.type === 'lines') {
    if (value.length > (spec.maxLines ?? 8)) return `Please use no more than ${spec.maxLines} lines.`;
    const long = value.find((l) => l.length > (spec.max ?? 60));
    return long ? `Each line must be ${spec.max} characters or fewer.` : '';
  }

  if (spec.type === 'date') {
    if (value === null) return spec.required ? `${label} is required.` : '';
    return isIsoDate(value) ? '' : 'Pick a date from the calendar.';
  }

  if (spec.required && value === '') return `${label} is required.`;
  if (value === '') return '';

  if (spec.max && value.length > spec.max) return `${label} must be ${spec.max} characters or fewer (currently ${value.length}).`;

  switch (spec.type) {
    case 'email':
      return EMAIL_RE.test(value) ? '' : 'Enter a full email address, like name@example.com.';
    case 'tel':
      return PHONE_RE.test(value) ? '' : 'Use only numbers and the characters + ( ) - . / and spaces.';
    case 'url':
      if (!isHttpsUrl(value)) return 'Enter a full web address starting with https://';
      if (spec.host && !hostMatches(value, spec.host)) return `This link needs to be on ${spec.hostName}.`;
      return '';
    case 'select':
      return spec.options.some(([v]) => v === value) ? '' : 'Choose one of the options.';
    default:
      break;
  }

  if (spec.key === 'timezone' && !validTimeZone(value)) return 'That isn\'t a recognised time zone. Try a name like America/Denver.';
  return '';
}

/**
 * Validate a whole section.
 * @param {keyof typeof SETTINGS_SECTIONS} sectionKey
 * @param {Record<string, any>} rawValues
 * @returns {{ ok: boolean, errors: Record<string, string>, cleaned: Record<string, any> }}
 */
export function validateSection(sectionKey, rawValues) {
  const section = SETTINGS_SECTIONS[sectionKey];
  const errors = {};
  const cleaned = {};
  for (const spec of section.fields) {
    const value = cleanValue(spec, rawValues[spec.key]);
    cleaned[spec.key] = value;
    const problem = validateField(spec, value);
    if (problem) errors[spec.key] = problem;
  }
  // A booking link is needed for any provider except "none".
  if (sectionKey === 'booking' && cleaned.booking_provider !== 'none' && !cleaned.booking_url && !errors.booking_url) {
    errors.booking_url = 'Add your booking link, or choose "None" as the provider.';
  }
  if (sectionKey === 'booking' && cleaned.booking_url && !errors.booking_url) {
    const problem = bookingLinkProblem(cleaned.booking_provider, cleaned.booking_url);
    if (problem) errors.booking_url = problem;
  }
  if (sectionKey === 'announcement') {
    const { announcement_starts_on: from, announcement_ends_on: until } = cleaned;
    if (from && until && !errors.announcement_ends_on && until < from) errors.announcement_ends_on = 'The last day can\'t be before the first day.';
    if (cleaned.announcement_link_url && !cleaned.announcement_link_label && !errors.announcement_link_label) {
      errors.announcement_link_label = 'Add the words to show for the link, like "Book now".';
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}

/**
 * Where each booking provider's links live. "Another booking website" accepts
 * any https link; the named providers are checked so a pasted link from the
 * wrong service (or a typo'd page) never silently becomes the Book button.
 */
export const BOOKING_HOSTS = Object.freeze({
  calendly: { host: /(^|\.)calendly\.com$/i, name: 'Calendly', example: 'https://calendly.com/your-name/haircut' },
  google_calendar: { host: /^(calendar\.app\.google|calendar\.google\.com)$/i, name: 'Google Calendar', example: 'https://calendar.app.google/AbCd1234' },
});

/** '' when the link fits the chosen provider, else a sentence saying what to do. */
export function bookingLinkProblem(provider, url) {
  const rule = BOOKING_HOSTS[provider];
  if (!rule) return '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return '';
  }
  if (rule.host.test(host)) return '';
  const actual = Object.entries(BOOKING_HOSTS).find(([, r]) => r.host.test(host));
  if (actual) return `That's a ${actual[1].name} link. Change "Booking provider" to ${actual[1].name}, or paste your ${rule.name} link.`;
  return `That doesn't look like a ${rule.name} booking link. It should look like ${rule.example}`;
}

/** The value a field shows in its input (arrays become one line each). */
export function displayValue(spec, stored) {
  if (spec.type === 'lines') return Array.isArray(stored) ? stored.join('\n') : '';
  return stored ?? '';
}

// ---------------------------------------------------------------------------
// Other content types
// ---------------------------------------------------------------------------

/** Portfolio item text fields. `publishing` = the owner is making it public. */
export function validateItemFields({ title, alt_text, description, service_label }, { publishing = false } = {}) {
  const errors = {};
  const t = String(title ?? '').trim();
  const alt = String(alt_text ?? '').trim();
  if (!t) errors.title = 'Give this work a title.';
  else if (t.length > 120) errors.title = 'The title must be 120 characters or fewer.';
  if (alt.length > 300) errors.alt_text = 'Alt text must be 300 characters or fewer.';
  if (publishing && !alt) errors.alt_text = 'Add alt text before publishing: a short description of what the photo shows, for people who can\'t see it.';
  if (String(description ?? '').length > 1000) errors.description = 'The description must be 1,000 characters or fewer.';
  if (String(service_label ?? '').length > 80) errors.service_label = 'The haircut label must be 80 characters or fewer.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Category name -> URL-safe slug ("Long Hair!" -> "long-hair"). */
export function slugify(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/** Make a slug unique among existing ones by adding -2, -3, ... */
export function uniqueSlug(base, existing) {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export const REVIEW_FIELDS = [
  { key: 'reviewer_name', label: 'Reviewer\'s first name or initial', type: 'text', max: 60, required: true, help: 'Only use a first name or initial, and only with the client\'s permission.', example: 'Marcus T.' },
  { key: 'quote', label: 'What they said', type: 'textarea', rows: 4, max: 600, required: true, help: 'Only add real reviews you have permission to share.' },
  { key: 'haircut_type', label: 'Haircut (optional)', type: 'text', max: 80, example: 'Skin fade' },
];

export const FAQ_FIELDS = [
  { key: 'question', label: 'Question', type: 'text', max: 200, required: true, example: 'How far in advance should I book?' },
  { key: 'answer', label: 'Answer', type: 'textarea', rows: 5, max: 2000, required: true },
];

export const SERVICE_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', max: 80, required: true, help: 'Shown in the Services section of your home page and in the request form. Don\'t include prices.', example: 'Skin Fade' },
  { key: 'description', label: 'Short description (optional)', type: 'text', max: 300, help: 'One sentence shown under the name in your Services section.', example: 'A close, blended fade from skin to length on top.' },
];

export const CATEGORY_FIELDS = [
  { key: 'name', label: 'Category name', type: 'text', max: 60, required: true, example: 'Fades' },
  { key: 'description', label: 'Description (optional)', type: 'text', max: 300 },
];

/** Validate a simple record against a list of FieldSpecs. */
export function validateRecord(fields, raw) {
  const errors = {};
  const cleaned = {};
  for (const spec of fields) {
    const value = cleanValue(spec, raw[spec.key]);
    cleaned[spec.key] = value;
    const problem = validateField(spec, value);
    if (problem) errors[spec.key] = problem;
  }
  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}
