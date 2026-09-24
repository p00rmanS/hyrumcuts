import { PostgrestClient } from '@supabase/postgrest-js';
import { config } from './env.js';

/**
 * PUBLIC client, for the visitor-facing website.
 *
 * It deliberately uses only the PostgREST client (a few KB) instead of the
 * full supabase-js bundle, and it never carries a user session: every request
 * is sent as the `anon` role. That matters because the owner may be signed in
 * to /admin in the same browser; the public pages must still show exactly what
 * a stranger would see, never drafts.
 *
 * Row Level Security decides what `anon` can read. The filters in content.js
 * (`is_published = true`) are a second, independent layer.
 */
let publicClient;
export function getPublicClient() {
  if (!config.isConfigured) return null;
  publicClient ??= new PostgrestClient(`${config.supabaseUrl}/rest/v1`, {
    headers: {
      apikey: config.publishableKey,
      // New-style publishable keys are not JWTs, so they must not be sent as
      // a bearer token. The gateway applies the anon role from the apikey.
    },
  });
  return publicClient;
}
