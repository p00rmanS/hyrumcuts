import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

/**
 * ADMIN client: used only by the /admin bundle. It owns the signed-in
 * session (persisted in localStorage under its own key, refreshed
 * automatically) and sends the owner's access token with every request, so
 * Row Level Security sees the owner as `authenticated`.
 *
 * This client is only ever created with the publishable key. Privileged keys
 * never reach the browser (see env.js).
 */
let adminClient;
export function getAdminClient() {
  if (!config.isConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  adminClient ??= createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // needed for the password-reset link
      flowType: 'pkce',
      storageKey: `sb-${config.siteSlug}-admin-auth`,
    },
  });
  return adminClient;
}
