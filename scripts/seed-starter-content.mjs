#!/usr/bin/env node
/**
 * Load the starter (placeholder) photos and portrait into a Supabase project,
 * so the site looks complete and Hyrum only has to replace them.
 *
 * Two ways to run it:
 *
 * 1. AS THE OWNER (no privileged key needed; works for a hosted project):
 *      OWNER_EMAIL=hyrum@example.com OWNER_PASSWORD='...' \
 *        node --env-file=<your .env file> scripts/seed-starter-content.mjs --as-owner
 *    It signs in exactly like the admin does (with the publishable key from
 *    .env), so Row Level Security and the Storage policies are what allow it.
 *
 * 2. WITH THE SECRET KEY (local stack, or a one-off developer script):
 *      SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/seed-starter-content.mjs
 *    (local stack: just `npm run seed:starter`; keys are read from `supabase status`)
 *
 * Safe to re-run: it does nothing if the portfolio already has items
 * (add --force to add them anyway). The owner must be registered first.
 */
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { seedStarterContent } from './lib/starter-seed.mjs';

const asOwner = process.argv.includes('--as-owner');
const force = process.argv.includes('--force');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const log = (m) => process.stdout.write(`${m}\n`);

/** A problem worth explaining to the person running the script (not a crash). */
class Fatal extends Error {}
function fail(message) {
  throw new Fatal(message);
}

/** @returns {Promise<{ client: import('@supabase/supabase-js').SupabaseClient, ownerId: string }>} */
async function connect() {
  if (asOwner) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const email = process.env.OWNER_EMAIL?.trim();
    const password = process.env.OWNER_PASSWORD;
    if (!url || !key) fail('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Run with `node --env-file=<env file> ...` (see the top of this file).');
    if (!email || !password) fail('Set OWNER_EMAIL and OWNER_PASSWORD (the site owner\'s own login) for --as-owner.');
    const client = createClient(url, key, noSession);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) fail(`Could not sign in as ${email}: ${error.message}`);
    const { data: owner, error: ownerError } = await client.from('site_owner').select('owner_id').eq('owner_id', data.user.id).maybeSingle();
    if (ownerError || !owner) fail(`${email} is not the registered site owner yet. Run supabase/bootstrap_owner.sql first (see README).`);
    return { client, ownerId: data.user.id };
  }

  let url = process.env.SUPABASE_URL;
  let secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    try {
      const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
      const s = JSON.parse(out.slice(out.indexOf('{')));
      url = s.API_URL;
      secret = s.SECRET_KEY ?? s.SERVICE_ROLE_KEY;
    } catch {
      /* fall through */
    }
  }
  if (!url || !secret) fail('No Supabase project found. Set SUPABASE_URL and SUPABASE_SECRET_KEY, run `npm run db:start` for a local one, or use --as-owner.');
  const client = createClient(url, secret, noSession);
  const { data: owners, error } = await client.from('site_owner').select('owner_id').limit(1);
  if (error || !owners?.length) fail('No site owner yet. Run scripts/bootstrap-owner.mjs first.');
  return { client, ownerId: owners[0].owner_id };
}

try {
  const { client, ownerId } = await connect();
  const result = await seedStarterContent(client, { ownerId, force, log });
  log(result.skipped ? 'Nothing to do.' : 'Done. Hyrum can now replace each placeholder in /admin.');
} catch (error) {
  process.stderr.write(`${error instanceof Fatal ? '' : 'Unexpected problem: '}${error.message}\n`);
  // Set the exit code and let Node finish on its own. Calling process.exit() while
  // network handles are still closing crashes with a libuv assertion on Windows.
  process.exitCode = 2;
}
