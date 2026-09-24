#!/usr/bin/env node
/**
 * End-to-end security verification against a REAL Supabase stack (the local
 * one from `supabase start`, or a throwaway project). It exercises the
 * Data API and Storage exactly as a browser would, as three different people:
 *
 *   anon   a visitor with no account
 *   owner  Hyrum (the registered site owner)
 *   other  a second, valid Supabase user who is NOT the owner
 *
 * It creates temporary users and content, and deletes them afterwards.
 * NEVER run it against the production project.
 *
 *   npm run db:start        # once
 *   npm run test:rls        # reads keys from `supabase status`
 *
 * or pass SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) and
 * SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in the environment.
 */
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
function localStack() {
  try {
    const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    const s = JSON.parse(out.slice(out.indexOf('{')));
    return { url: s.API_URL, anon: s.PUBLISHABLE_KEY ?? s.ANON_KEY, secret: s.SECRET_KEY ?? s.SERVICE_ROLE_KEY };
  } catch {
    return {};
  }
}
const local = process.env.SUPABASE_URL ? {} : localStack();
const url = (process.env.SUPABASE_URL ?? local.url ?? '').replace(/\/+$/, '');
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? local.anon;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? local.secret;

if (!url || !anonKey || !secretKey) {
  process.stderr.write('Could not find a Supabase stack. Start one with `npm run db:start`, or set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.\n');
  process.exit(2);
}
if (/supabase\.co/.test(url) && !process.env.I_UNDERSTAND_THIS_CREATES_TEST_DATA) {
  process.stderr.write('Refusing to run against a hosted project without I_UNDERSTAND_THIS_CREATES_TEST_DATA=1 (use a throwaway project, never production).\n');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, anonKey, opts);
const admin = createClient(url, secretKey, opts);

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(name);
  }
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `\n        -> ${detail}` : ''}\n`);
}
const section = (title) => process.stdout.write(`\n== ${title}\n`);
const denied = (res) => Boolean(res.error) || (Array.isArray(res.data) && res.data.length === 0);

// A valid 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// ---------------------------------------------------------------------------
// Arrange
// ---------------------------------------------------------------------------
const stamp = randomBytes(4).toString('hex');
const ownerEmail = `owner-${stamp}@example.test`;
const otherEmail = `other-${stamp}@example.test`;
const password = `Tmp-${randomBytes(9).toString('hex')}-Aa1`;
const created = [];
const uploaded = [];

async function makeUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  created.push(data.user.id);
  return data.user;
}
async function signedIn(email) {
  const client = createClient(url, anonKey, opts);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client, token: data.session.access_token };
}

let exitCode = 0;
try {
  const { data: existingOwner } = await admin.from('site_owner').select('owner_id').limit(1);
  if (existingOwner?.length) throw new Error('A site owner already exists in this database. Run `npm run db:reset` first: this test needs a clean database.');

  const ownerUser = await makeUser(ownerEmail);
  const otherUser = await makeUser(otherEmail);
  const OWNER = ownerUser.id;
  const OTHER = otherUser.id;
  const ins = await admin.from('site_owner').insert({ owner_id: OWNER });
  if (ins.error) throw new Error(`could not register the owner: ${ins.error.message}`);
  const { client: owner, token: ownerToken } = await signedIn(ownerEmail);
  const { client: other, token: otherToken } = await signedIn(otherEmail);

  // -------------------------------------------------------------------------
  section('Owner bootstrap');
  const settingsRow = await admin.from('site_settings').select('*');
  check('registering the owner created exactly one settings row', settingsRow.data?.length === 1);
  const cats = await admin.from('gallery_categories').select('id,slug').order('sort_order');
  check('six starter categories were created', cats.data?.length === 6);
  const bio = await admin.from('site_settings').select('about_bio').single();
  check('the starter biography was created', (bio.data?.about_bio ?? '').startsWith('Hyrum approaches every appointment'));
  const second = await admin.from('site_owner').insert({ owner_id: OTHER });
  check('a second owner cannot be registered', Boolean(second.error), second.error?.message);

  // -------------------------------------------------------------------------
  // A draft FAQ next to the five published starter FAQs, so "drafts stay hidden" is a real test.
  await admin.from('faqs').insert({ owner_id: OWNER, question: 'Draft question', answer: 'Draft answer', is_published: false, sort_order: 99 });

  section('Anonymous visitor (no account)');
  const aSettings = await anon.from('site_settings').select('*');
  check('can read the public settings', aSettings.data?.length === 1);
  const aFaqs = await anon.from('faqs').select('id,is_published');
  check('sees only published FAQs, never drafts (5 of 6)', aFaqs.data?.length === 5 && aFaqs.data.every((f) => f.is_published), JSON.stringify(aFaqs.data?.length));
  const aRev = await anon.from('reviews').select('quote');
  check('sees the 3 starter reviews, all labelled as placeholders', aRev.data?.length === 3 && aRev.data.every((r) => r.quote.startsWith('[Placeholder review]')), JSON.stringify(aRev.data?.length));
  for (const table of ['site_owner', 'admin_audit_log', 'storage_cleanup_queue']) {
    const r = await anon.from(table).select('*');
    check(`cannot read ${table}`, Boolean(r.error) || r.data?.length === 0, JSON.stringify(r.data));
  }
  const aIns = await anon.from('reviews').insert({ reviewer_name: 'x', quote: 'y' });
  check('cannot insert content', Boolean(aIns.error));
  const aUpd = await anon.from('site_settings').update({ brand_name: 'HACKED' }).eq('owner_id', OWNER).select();
  check('cannot update settings', denied(aUpd));
  const aDel = await anon.from('faqs').delete().gte('sort_order', 0).select();
  check('cannot delete FAQs', denied(aDel));
  const aRpc = await anon.rpc('reorder_content', { p_kind: 'faqs', p_ids: [] });
  check('cannot call the reorder function', Boolean(aRpc.error));
  const aPrivate = await anon.schema('private').from('anything').select('*');
  check('the private schema is not reachable over the API', Boolean(aPrivate.error));

  // -------------------------------------------------------------------------
  section('Owner (Hyrum)');
  const catId = cats.data[0].id;
  const mk = await owner.from('gallery_items').insert({ category_id: catId, title: 'Test cut', alt_text: '' }).select('id, owner_id').single();
  check('creates a draft (owner_id filled in automatically)', !mk.error && mk.data.owner_id === OWNER, mk.error?.message);
  const itemId = mk.data?.id;
  const noAlt = await owner.from('gallery_items').update({ is_published: true }).eq('id', itemId).select();
  check('cannot publish without alt text', Boolean(noAlt.error), JSON.stringify(noAlt.data));
  const folder = `${OWNER}/gallery/${itemId}`;
  const media = await owner.from('gallery_media').insert({ item_id: itemId, media_type: 'image', role: 'cover', storage_path: `${folder}/a-full.webp`, card_path: `${folder}/a-card.webp`, mime_type: 'image/webp', width: 800, height: 1000 }).select('id').single();
  check('attaches media inside their own folder', !media.error, media.error?.message);
  const evilMedia = await owner.from('gallery_media').insert({ item_id: itemId, media_type: 'image', role: 'gallery', storage_path: `${OTHER}/gallery/${itemId}/x.webp`, mime_type: 'image/webp' });
  check("rejects media pointing at someone else's folder", Boolean(evilMedia.error));
  check('anon still cannot see the draft', (await anon.from('gallery_items').select('id')).data?.length === 0);
  const pub = await owner.from('gallery_items').update({ is_published: true, alt_text: 'A fade' }).eq('id', itemId).select();
  check('publishes with alt text', !pub.error && pub.data.length === 1, pub.error?.message);
  check('anon now sees the published item', (await anon.from('gallery_items').select('id,title')).data?.length === 1);
  check('anon sees its media', (await anon.from('gallery_media').select('id')).data?.length === 1);
  const embedded = await anon.from('gallery_items').select('id,gallery_media(id,role)');
  check('the public embedded query (site content query) works', embedded.data?.[0]?.gallery_media?.length === 1, embedded.error?.message);

  const catDel = await owner.from('gallery_categories').delete().eq('id', catId);
  check('a category still in use cannot be deleted', Boolean(catDel.error));
  const badUrl = await owner.from('site_settings').update({ instagram_url: 'http://not-https.example' }).eq('owner_id', OWNER).select();
  check('rejects a non-https / wrong-host social link', Boolean(badUrl.error));
  const goodUrl = await owner.from('site_settings').update({ instagram_url: 'https://www.instagram.com/hyrum', phone: '(801) 555-0100' }).eq('owner_id', OWNER).select();
  check('accepts valid settings', !goodUrl.error && goodUrl.data.length === 1, goodUrl.error?.message);
  const it2 = await owner.from('gallery_items').insert({ title: 'Second', alt_text: 'Second' }).select('id').single();
  const reorder = await owner.rpc('reorder_content', { p_kind: 'gallery_items', p_ids: [it2.data.id, itemId] });
  check('reorders atomically', !reorder.error, reorder.error?.message);
  const ordered = await owner.from('gallery_items').select('id').order('sort_order');
  check('the new order was saved', ordered.data?.[0]?.id === it2.data.id);
  const archived = await owner.from('gallery_items').update({ is_published: false, archived_at: new Date().toISOString() }).eq('id', itemId).select();
  check('archives an item', !archived.error, archived.error?.message);
  check('an archived item disappears for the public', (await anon.from('gallery_items').select('id')).data?.length === 0);

  const audit = await owner.from('admin_audit_log').select('action,entity_type,metadata').order('id');
  const actions = new Set(audit.data?.map((a) => a.action));
  check('the audit log recorded create/publish/archive', ['create', 'publish', 'archive'].every((a) => actions.has(a)), [...actions].join(','));
  check('the audit log holds column names, never values', !JSON.stringify(audit.data).includes('Test cut') && !JSON.stringify(audit.data).includes('555-0100'));
  const forge = await owner.from('admin_audit_log').insert({ action: 'create', entity_type: 'x' });
  check('even the owner cannot forge audit entries', Boolean(forge.error));
  const wipe = await owner.from('admin_audit_log').delete().gte('id', 0).select();
  check('even the owner cannot erase the audit log', denied(wipe));

  // -------------------------------------------------------------------------
  section('A different signed-in user (not the owner)');
  const oIns = await other.from('gallery_items').insert({ title: 'evil', alt_text: 'evil' });
  check('cannot create content (not the registered owner)', Boolean(oIns.error), oIns.error?.message);
  const oUpd = await other.from('gallery_items').update({ title: 'HACKED' }).eq('id', itemId).select();
  check("cannot edit the owner's items", denied(oUpd));
  const oDel = await other.from('gallery_items').delete().eq('id', itemId).select();
  check("cannot delete the owner's items", denied(oDel));
  const oSet = await other.from('site_settings').update({ brand_name: 'HACKED' }).eq('owner_id', OWNER).select();
  check("cannot edit the owner's settings", denied(oSet));
  check("cannot read the owner's drafts", (await other.from('gallery_items').select('id')).data?.length === 0);
  check('cannot see the site_owner row', (await other.from('site_owner').select('*')).data?.length === 0);
  check('cannot read the audit log', (await other.from('admin_audit_log').select('*')).data?.length === 0);
  const oRpc = await other.rpc('reorder_content', { p_kind: 'gallery_items', p_ids: [itemId, it2.data.id] });
  const after = await owner.from('gallery_items').select('id').order('sort_order');
  check("a reorder by them changes nothing", after.data?.[0]?.id === it2.data.id, oRpc.error?.message);

  // -------------------------------------------------------------------------
  section('Storage (bucket "site-media")');
  const bucket = await admin.storage.getBucket('site-media');
  check('the bucket exists and is public-read', bucket.data?.public === true, bucket.error?.message);
  check('the bucket restricts file types and size', Array.isArray(bucket.data?.allowed_mime_types) && bucket.data.allowed_mime_types.includes('video/mp4') && !bucket.data.allowed_mime_types.includes('text/html') && Number(bucket.data.file_size_limit) > 0);

  const path = `${OWNER}/profile/${randomUUID()}-portrait.png`;
  const up = await owner.storage.from('site-media').upload(path, PNG, { contentType: 'image/png' });
  if (!up.error) uploaded.push(path);
  check('the owner can upload to their own folder', !up.error, up.error?.message);

  const other1 = await other.storage.from('site-media').upload(`${OTHER}/profile/${randomUUID()}.png`, PNG, { contentType: 'image/png' });
  check('another user cannot upload, even to a folder named after themselves', Boolean(other1.error), 'uploaded!');
  const other2 = await other.storage.from('site-media').upload(`${OWNER}/profile/${randomUUID()}.png`, PNG, { contentType: 'image/png' });
  check("another user cannot upload into the owner's folder", Boolean(other2.error));
  const own2 = await owner.storage.from('site-media').upload(`${OTHER}/profile/${randomUUID()}.png`, PNG, { contentType: 'image/png' });
  check('the owner cannot write outside their own folder', Boolean(own2.error));
  const anonUp = await anon.storage.from('site-media').upload(`${OWNER}/profile/${randomUUID()}.png`, PNG, { contentType: 'image/png' });
  check('an anonymous visitor cannot upload', Boolean(anonUp.error));
  const html = await owner.storage.from('site-media').upload(`${OWNER}/profile/${randomUUID()}.html`, Buffer.from('<script>alert(1)</script>'), { contentType: 'text/html' });
  check('a disallowed file type (HTML) is rejected by the bucket', Boolean(html.error), 'accepted!');

  const publicUrl = `${url}/storage/v1/object/public/site-media/${path}`;
  const res = await fetch(publicUrl);
  check("an anonymous visitor can view a published file by its URL", res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('image/png'), `status ${res.status}`);
  const listAnon = await anon.storage.from('site-media').list(`${OWNER}/profile`);
  check('an anonymous visitor cannot LIST the bucket', Boolean(listAnon.error) || listAnon.data?.length === 0);
  const listOther = await other.storage.from('site-media').list(`${OWNER}/profile`);
  check("another user cannot list the owner's folder", Boolean(listOther.error) || listOther.data?.length === 0);
  const rmOther = await other.storage.from('site-media').remove([path]);
  check("another user cannot delete the owner's file", (rmOther.data ?? []).length === 0);
  check('the file is still there after that attempt', (await fetch(publicUrl)).status === 200);

  // Resumable (TUS) upload of a "large" video (7 MB > the 6 MB chunk size).
  const video = randomBytes(7 * 1024 * 1024);
  const tusUpload = (token, objectName) =>
    new Promise((resolve) => {
      const u = new tus.Upload(video, {
        endpoint: `${url}/storage/v1/upload/resumable`,
        retryDelays: [0],
        chunkSize: 6 * 1024 * 1024,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: { authorization: `Bearer ${token}`, apikey: anonKey, 'x-upsert': 'false' },
        metadata: { bucketName: 'site-media', objectName, contentType: 'video/mp4', cacheControl: '31536000' },
        onError: (error) => resolve({ ok: false, error: String(error?.message ?? error).slice(0, 120) }),
        onSuccess: () => resolve({ ok: true }),
      });
      u.start();
    });
  const videoPath = `${OWNER}/hero/${randomUUID()}-hero.mp4`;
  const tusOwner = await tusUpload(ownerToken, videoPath);
  if (tusOwner.ok) uploaded.push(videoPath);
  check('the owner can upload a large video in resumable chunks (TUS)', tusOwner.ok, tusOwner.error);
  const head = await fetch(`${url}/storage/v1/object/public/site-media/${videoPath}`, { method: 'HEAD' });
  check('the resumable upload arrived complete (7 MB)', Number(head.headers.get('content-length')) === video.length, `got ${head.headers.get('content-length')}`);
  const tusOther = await tusUpload(otherToken, `${OWNER}/hero/${randomUUID()}-evil.mp4`);
  check("another user's resumable upload into the owner's folder is refused", !tusOther.ok);
  const tusOtherOwn = await tusUpload(otherToken, `${OTHER}/hero/${randomUUID()}-evil.mp4`);
  check('a non-owner cannot resumable-upload even to their own folder', !tusOtherOwn.ok);

  const ownerRemove = await owner.storage.from('site-media').remove([path, videoPath]);
  check('the owner can delete their own files', (ownerRemove.data ?? []).length === 2, ownerRemove.error?.message);
  check('a deleted file is gone', (await fetch(publicUrl)).status >= 400);

  // Cleanup queue is owner-only.
  const q = await owner.from('storage_cleanup_queue').insert({ object_path: `${OWNER}/gallery/${itemId}/old.webp`, reason: 'test' });
  check('the owner can queue a file for cleanup', !q.error, q.error?.message);
  const queueOther = await other.from('storage_cleanup_queue').select('*');
  const queueAnon = await anon.from('storage_cleanup_queue').select('*');
  check('nobody else can read the cleanup queue', queueOther.data?.length === 0 && (Boolean(queueAnon.error) || queueAnon.data?.length === 0));
} catch (error) {
  process.stderr.write(`\nSETUP ERROR: ${error.message}\n`);
  exitCode = 2;
} finally {
  // Remove the temporary users; foreign keys cascade to all of their rows.
  if (uploaded.length) await admin.storage.from('site-media').remove(uploaded).catch(() => {});
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => {});
}

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.stdout.write(`Failed:\n  - ${failures.join('\n  - ')}\n`);
process.exit(exitCode || (failed ? 1 : 0));
