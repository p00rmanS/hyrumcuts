import { getAdminClient } from '../../lib/supabase-admin-client.js';
import { AppError, friendlyError } from './errors.js';
import { toUrl } from '../../lib/base.js';

/**
 * Sign-in, sign-out and "who am I" for the admin.
 *
 * SECURITY NOTE: everything here is user experience. The real boundary is
 * PostgreSQL Row Level Security and the Storage policies. A signed-out visitor
 * who edits this JavaScript in dev tools still gets nothing from the database.
 *
 * For "who is signed in" the UI uses auth.getUser(), which asks the Auth
 * server to validate the token, rather than trusting the locally stored
 * (and therefore editable) session.
 */

const OWNER_CACHE_MS = 60_000;
let ownerCache = null; // { userId, ok, at }

export function clearAuthCache() {
  ownerCache = null;
}

/** Sign in with email + password. Errors are deliberately generic. */
export async function signIn(email, password) {
  const client = getAdminClient();
  clearAuthCache();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    const status = Number(error.status ?? 0);
    if (status === 429 || /rate limit/i.test(error.message)) {
      throw new AppError('Too many sign-in attempts. Please wait a few minutes and try again.', { code: '429', retryable: true });
    }
    if (status >= 500 || /fetch|network/i.test(error.message)) throw friendlyError(error);
    // Same message whether the email or the password was wrong: never reveal which accounts exist.
    throw new AppError('That email and password don\'t match. Please check them and try again.', { code: 'invalid-credentials' });
  }
  return data.user;
}

export async function signOut({ everywhere = false } = {}) {
  clearAuthCache();
  const { error } = await getAdminClient().auth.signOut({ scope: everywhere ? 'global' : 'local' });
  if (error && !/session/i.test(error.message)) throw friendlyError(error);
}

/**
 * The server-verified signed-in user, or null.
 * (getSession() would only read local storage and must not be trusted here.)
 */
export async function getVerifiedUser() {
  const { data, error } = await getAdminClient().auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Route guard: resolves to { user } for the registered site owner, or
 * { user: null | user, reason } otherwise. Cached briefly so navigating
 * between pages doesn't ask the server every time.
 */
export async function checkOwner({ force = false } = {}) {
  if (!force && ownerCache && Date.now() - ownerCache.at < OWNER_CACHE_MS) {
    return ownerCache.ok ? { user: ownerCache.user } : { user: ownerCache.user, reason: ownerCache.reason };
  }
  const user = await getVerifiedUser();
  if (!user) {
    ownerCache = null;
    return { user: null, reason: 'signed-out' };
  }
  const { data, error } = await getAdminClient().from('site_owner').select('owner_id').eq('owner_id', user.id).maybeSingle();
  if (error) throw friendlyError(error);
  const ok = Boolean(data);
  ownerCache = { user, ok, reason: ok ? undefined : 'not-owner', at: Date.now() };
  return ok ? { user } : { user, reason: 'not-owner' };
}

/** Always succeeds from the caller's point of view: never reveal whether an email has an account. */
export async function sendPasswordReset(email) {
  const redirectTo = `${window.location.origin}${toUrl('/admin/reset-password')}`;
  const { error } = await getAdminClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error && (Number(error.status) === 429 || /rate limit/i.test(error.message))) {
    throw new AppError('Too many requests. Please wait a few minutes before asking for another link.', { code: '429', retryable: true });
  }
  if (error && /fetch|network/i.test(error.message)) throw friendlyError(error);
  // Any other error is swallowed on purpose.
}

export async function updatePassword(newPassword) {
  const { error } = await getAdminClient().auth.updateUser({ password: newPassword });
  if (error) {
    if (/same.*password|different from the old/i.test(error.message)) {
      throw new AppError('Your new password must be different from your current one.', { code: 'same-password' });
    }
    if (/weak|password/i.test(error.message) && Number(error.status) === 422) {
      throw new AppError('That password isn\'t strong enough. Use at least 12 characters with upper and lower case letters and a number.', { code: 'weak-password' });
    }
    throw friendlyError(error);
  }
  clearAuthCache();
}

/** Confirm the current password (a fresh sign-in) before allowing a change. */
export async function verifyCurrentPassword(email, password) {
  const { error } = await getAdminClient().auth.signInWithPassword({ email, password });
  if (error) throw new AppError('Your current password isn\'t right.', { code: 'invalid-credentials' });
}

/** Subscribe to sign-in/out/recovery events from Supabase Auth. Returns an unsubscribe function. */
export function onAuthEvent(callback) {
  const { data } = getAdminClient().auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

/** Password rules, matching supabase/config.toml (12+, upper, lower, digit). */
export function passwordProblems(password) {
  const problems = [];
  if (password.length < 12) problems.push('at least 12 characters');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/[0-9]/.test(password)) problems.push('a number');
  return problems;
}
