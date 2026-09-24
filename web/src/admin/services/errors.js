/**
 * Turn database / Auth / Storage errors into sentences the owner can act on.
 * Technical detail is kept on `.detail` for support, never shown as the message.
 */

/** Constraint name -> what it means for a person. Mirrors supabase/migrations. */
const CONSTRAINT_MESSAGES = {
  gallery_items_published_needs_alt: 'Add alt text (a short description of the photo) before publishing this work.',
  gallery_items_title_length: 'The title must be between 1 and 120 characters.',
  gallery_items_alt_length: 'Alt text must be 300 characters or fewer.',
  gallery_items_description_length: 'The description must be 1,000 characters or fewer.',
  gallery_items_service_length: 'The haircut label must be 80 characters or fewer.',
  gallery_items_archived_not_published: 'An archived item can\'t be published. Restore it first.',
  gallery_categories_slug_unique: 'You already have a category with that name. Choose a different name.',
  gallery_categories_name_length: 'The category name must be between 1 and 60 characters.',
  gallery_categories_slug_format: 'That category name can\'t be turned into a web address. Use letters and numbers.',
  reviews_quote_length: 'The review must be between 1 and 600 characters.',
  reviews_name_length: 'The reviewer name must be between 1 and 60 characters.',
  faqs_question_length: 'The question must be between 1 and 200 characters.',
  faqs_answer_length: 'The answer must be between 1 and 2,000 characters.',
  services_name_length: 'The name must be between 1 and 80 characters.',
  site_settings_urls: 'One of the web addresses isn\'t valid. Addresses must start with https:// and Instagram/Facebook links must point at those sites.',
  site_settings_contact_format: 'The phone number or email address isn\'t in a valid format.',
  site_settings_text_lengths: 'One of the text fields is too long.',
  site_settings_media_paths: 'That file isn\'t in your media folder. Please upload it again.',
  site_settings_booking_provider: 'Choose a booking provider from the list.',
  gallery_media_paths: 'That file isn\'t in the right folder. Please upload it again.',
  gallery_media_mime: 'That file type isn\'t allowed here.',
};

const CODE_MESSAGES = {
  '23503': 'That item is still being used somewhere else, so it can\'t be changed this way.',
  '23505': 'That already exists. Try a different name.',
  '23514': 'One of the values isn\'t allowed. Please check the fields and try again.',
  '42501': 'You don\'t have permission to do that. If you\'re signed in as the site owner, sign out and back in.',
  PGRST301: 'Your session has expired. Please sign in again.',
  PGRST303: 'Your session has expired. Please sign in again.',
};

export class AppError extends Error {
  /**
   * @param {string} message friendly text
   * @param {{ code?: string, detail?: string, retryable?: boolean }} [meta]
   */
  constructor(message, { code = '', detail = '', retryable = false } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
    this.retryable = retryable;
  }
}

function looksOffline(error) {
  const text = `${error?.message ?? ''}`.toLowerCase();
  return (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('network request failed') ||
    text.includes('load failed') ||
    error?.name === 'AbortError'
  );
}

/**
 * @param {any} error a PostgREST / Auth / Storage / fetch error
 * @returns {AppError}
 */
export function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof AppError) return error;
  if (!error) return new AppError(fallback);

  const detail = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' | ');

  if (looksOffline(error)) {
    return new AppError('You appear to be offline, or the connection dropped. Check your internet and try again.', { code: 'offline', detail, retryable: true });
  }

  // Postgres check/unique/foreign-key violations name the constraint in the message.
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  for (const [name, message] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (text.includes(`"${name}"`) || text.includes(`'${name}'`)) return new AppError(message, { code: error.code ?? '', detail });
  }

  if (error.code === '23503' && /gallery_items_category_id_fkey/.test(text)) {
    return new AppError('This category still has portfolio items in it. Move those items to another category first.', { code: '23503', detail });
  }
  if (error.code && CODE_MESSAGES[error.code]) return new AppError(CODE_MESSAGES[error.code], { code: error.code, detail });

  // Storage API errors
  const status = Number(error.statusCode ?? error.status ?? 0);
  if (status === 413 || /exceeded the maximum allowed size/i.test(error.message ?? '')) {
    return new AppError('That file is too large for the server. Please choose a smaller one.', { code: '413', detail });
  }
  if (status === 415 || /mime type .* is not supported/i.test(error.message ?? '')) {
    return new AppError('That file type isn\'t allowed. Use JPEG, PNG or WebP for photos and MP4 or WebM for video.', { code: '415', detail });
  }
  if (status === 401 || status === 403 || /jwt|not authorized|unauthorized/i.test(error.message ?? '')) {
    return new AppError('You\'re signed out or don\'t have permission. Please sign in again.', { code: String(status || 'auth'), detail });
  }
  if (status === 429) {
    return new AppError('Too many attempts. Please wait a few minutes and try again.', { code: '429', detail, retryable: true });
  }
  if (status >= 500) {
    return new AppError('The server had a problem. Please try again in a minute.', { code: String(status), detail, retryable: true });
  }

  return new AppError(fallback, { code: error.code ?? '', detail });
}

/** Unwrap a `{ data, error }` result, throwing a friendly AppError. */
export function unwrap(result, fallback) {
  if (result?.error) throw friendlyError(result.error, fallback);
  return result?.data;
}
