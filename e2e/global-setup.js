import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { solidPng } from '../scripts/lib/png.mjs';

/**
 * Creates a temporary owner + a second (non-owner) user in the LOCAL stack,
 * plus one published and one draft portfolio item, and records the details
 * for the specs. Refuses anything that isn't a local Supabase.
 */
function stack() {
  const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  const s = JSON.parse(out.slice(out.indexOf('{')));
  return { url: s.API_URL, secret: s.SECRET_KEY ?? s.SERVICE_ROLE_KEY };
}

export default async function globalSetup() {
  const { url, secret } = stack();
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url.replace(/\/+$/, ''))) throw new Error(`e2e refuses to run against ${url}`);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing } = await admin.from('site_owner').select('owner_id').limit(1);
  if (existing?.length) throw new Error('A site owner already exists. Run `npm run db:reset` first: the e2e tests need a clean local database.');

  const stamp = randomBytes(4).toString('hex');
  const password = `E2e-${randomBytes(9).toString('hex')}-Aa1`;
  const mk = async (email) => {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(error.message);
    return data.user;
  };
  const owner = await mk(`owner-${stamp}@example.test`);
  const other = await mk(`other-${stamp}@example.test`);
  const reg = await admin.from('site_owner').insert({ owner_id: owner.id });
  if (reg.error) throw new Error(reg.error.message);

  const { data: cats } = await admin.from('gallery_categories').select('id').order('sort_order').limit(1);
  const seedItem = async (title, published) => {
    const id = randomUUID();
    const folder = `${owner.id}/gallery/${id}`;
    const png = solidPng(800, 1000, [50, 50, 60]);
    const full = `${folder}/${randomUUID()}-full.png`;
    const card = `${folder}/${randomUUID()}-card.png`;
    for (const p of [full, card]) {
      const up = await admin.storage.from('site-media').upload(p, png, { contentType: 'image/png' });
      if (up.error) throw new Error(up.error.message);
    }
    const i = await admin.from('gallery_items').insert({ id, owner_id: owner.id, category_id: cats[0].id, title, alt_text: published ? `${title} alt text` : '', is_published: published, sort_order: published ? 1 : 2 });
    if (i.error) throw new Error(i.error.message);
    const m = await admin.from('gallery_media').insert({ owner_id: owner.id, item_id: id, media_type: 'image', role: 'cover', storage_path: full, card_path: card, width: 800, height: 1000, mime_type: 'image/png', byte_size: png.length });
    if (m.error) throw new Error(m.error.message);
  };
  await seedItem('E2E Published Cut', true);
  await seedItem('E2E Secret Draft', false);

  mkdirSync('e2e/.auth', { recursive: true });
  writeFileSync('e2e/.auth/creds.json', JSON.stringify({ url, ownerId: owner.id, ownerEmail: owner.email, otherId: other.id, otherEmail: other.email, password }));
}
