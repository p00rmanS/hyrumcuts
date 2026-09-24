#!/usr/bin/env node
/**
 * Create (or re-register) the ONE owner account for a Supabase project.
 *
 * Run by the developer, on their own machine. It uses a privileged key, so
 * that key must come from your shell, NEVER from a .env file that Vite reads
 * and never from a VITE_* variable:
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=sb_secret_... \
 *   OWNER_EMAIL=hyrum@example.com \
 *   node scripts/bootstrap-owner.mjs
 *
 * Optional: OWNER_PASSWORD (otherwise a strong temporary one is generated and
 * printed once; Hyrum should change it on first sign in via "Forgot password").
 *
 * It also loads the starter (placeholder) photos and portrait so the site looks
 * complete from day one; pass --no-starter to skip that.
 *
 * Idempotent: running it again for the same email changes nothing. If a
 * DIFFERENT account is already the owner it stops instead of taking over.
 *
 * Equivalent without this script: create the user in Dashboard >
 * Authentication > Users, then run supabase/bootstrap_owner.sql in the SQL editor.
 */
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { seedStarterContent } from './lib/starter-seed.mjs';

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
const out = (m) => process.stdout.write(`${m}\n`);

/** A problem worth explaining to the person running the script (not a crash). */
class Fatal extends Error {}
function fail(message) {
  throw new Fatal(message);
}

function generatePassword() {
  const sets = ['abcdefghjkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_'];
  const all = sets.join('');
  const chars = sets.map((s) => s[randomInt(s.length)]); // at least one of each kind
  while (chars.length < 24) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function findUser(admin) {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  if (!url || !secret || !email) {
    fail('Missing SUPABASE_URL, SUPABASE_SECRET_KEY or OWNER_EMAIL. See the comment at the top of scripts/bootstrap-owner.mjs.');
  }
  if (secret.startsWith('sb_publishable_')) fail('That is the PUBLISHABLE key. This script needs the secret (service_role) key, and only for this one-off setup.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`"${email}" is not a valid email address.`);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  let user = await findUser(admin);
  let generated = null;
  if (!user) {
    const password = process.env.OWNER_PASSWORD || (generated = generatePassword());
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) fail(`Could not create the user: ${error.message}`);
    user = data.user;
    out(`Created Auth user ${email}`);
  } else {
    out(`Auth user ${email} already exists, keeping it.`);
  }

  const { data: existing, error: readError } = await admin.from('site_owner').select('owner_id').limit(1);
  if (readError) fail(`Could not read site_owner (have the migrations been applied?): ${readError.message}`);

  if (existing?.length && existing[0].owner_id !== user.id) {
    fail(`A different account (${existing[0].owner_id}) is already the site owner. To hand the site over, change THAT account's email and password (see README, "Owner hand-over"); do not create a second owner.`);
  }
  if (!existing?.length) {
    const { error } = await admin.from('site_owner').insert({ owner_id: user.id });
    if (error) fail(`Could not register the owner: ${error.message}`);
    out('Registered as the site owner. Default settings, bio, categories, FAQ answers, placeholder reviews and services were created.');
  } else {
    out('Already registered as the site owner. Nothing to change.');
  }

  // Starter (placeholder) photos + portrait, so the site looks complete straight away.
  if (!process.argv.includes('--no-starter')) {
    await seedStarterContent(admin, { ownerId: user.id, log: out });
  }

  out(`\nOwner user id: ${user.id}`);
  if (generated) {
    out(`\nTemporary password (shown once, not stored anywhere): ${generated}\nGive it to the owner privately, and ask them to use "Forgot your password?" on /admin/login to choose their own.`);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`\n${error instanceof Fatal ? '' : 'Unexpected problem: '}${error.message}\n\n`);
  // Set the exit code and let Node finish on its own. Calling process.exit() while
  // network handles are still closing crashes with a libuv assertion on Windows.
  process.exitCode = 1;
}
