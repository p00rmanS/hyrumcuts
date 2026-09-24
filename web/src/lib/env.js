/**
 * Client-safe configuration.
 *
 * Only the project URL and the *publishable* key ever reach the browser. This
 * module refuses to run with anything that looks like a privileged key, so a
 * mistake in .env or in Netlify's settings fails loudly instead of shipping a
 * secret inside the JavaScript bundle.
 */

/** Decode the payload of a JWT-style key without verifying it. Never used for auth. */
function jwtRole(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Throws if `key` is a privileged Supabase credential.
 * @param {string} key
 */
export function assertBrowserSafeKey(key) {
  if (!key) return;
  if (key.startsWith('sb_secret_')) {
    throw new Error('A Supabase SECRET key was supplied to browser code. Use the publishable key (sb_publishable_...).');
  }
  if (jwtRole(key) === 'service_role') {
    throw new Error('A Supabase service_role key was supplied to browser code. Use the publishable (or legacy anon) key.');
  }
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function readConfig(env) {
  const supabaseUrl = String(env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const publishableKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  const siteSlug = String(env.VITE_SITE_SLUG ?? 'hyrumhaircuts').trim() || 'hyrumhaircuts';
  assertBrowserSafeKey(publishableKey);
  return Object.freeze({
    supabaseUrl,
    publishableKey,
    siteSlug,
    isConfigured: Boolean(supabaseUrl && publishableKey),
    // Name of the public bucket (see supabase/migrations/*_storage_media.sql).
    bucket: 'site-media',
  });
}

export const config = readConfig(import.meta.env);
