import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/** Remove the temporary users (their rows cascade) and every file in the owner's folder. */
export default async function globalTeardown() {
  if (!existsSync('e2e/.auth/creds.json')) return;
  const creds = JSON.parse(readFileSync('e2e/.auth/creds.json', 'utf8'));
  const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  const s = JSON.parse(out.slice(out.indexOf('{')));
  const admin = createClient(creds.url, s.SECRET_KEY ?? s.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const walk = async (prefix) => {
    const { data } = await admin.storage.from('site-media').list(prefix, { limit: 1000 });
    const files = [];
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) files.push(path);
      else files.push(...(await walk(path)));
    }
    return files;
  };
  const files = await walk(creds.ownerId);
  if (files.length) await admin.storage.from('site-media').remove(files);
  for (const id of [creds.ownerId, creds.otherId]) await admin.auth.admin.deleteUser(id).catch(() => {});
  rmSync('e2e/.auth', { recursive: true, force: true });
}
