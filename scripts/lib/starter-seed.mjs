import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTER_IMAGE_DIR, STARTER_ITEMS, STARTER_PORTRAIT, STARTER_PORTRAIT_ALT, STARTER_PORTRAIT_SIZE } from '../../web/src/lib/starter-content.js';

/**
 * Load the starter photos and portrait into a project as REAL, editable
 * content: files in the `site-media` bucket and ordinary portfolio rows.
 * Hyrum can replace, retitle, reorder, hide or delete any of them from /admin.
 *
 * File names end in "-starter.jpg". That suffix is how the admin knows a photo
 * is still a placeholder; once he replaces it, the new file has a different
 * name and the "Placeholder" flag goes away on its own.
 *
 * (The FAQ answers, reviews, bio and booking options are created by the
 * database itself when the owner is registered; see the owner_bootstrap migration.)
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} admin client using the secret key
 * @param {{ ownerId: string, force?: boolean, log?: (m: string) => void }} options
 * @returns {Promise<{ skipped: boolean, items: number }>}
 */
export async function seedStarterContent(admin, { ownerId, force = false, log = () => {} }) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/public');

  const { count, error: countError } = await admin.from('gallery_items').select('id', { count: 'exact', head: true });
  if (countError) throw new Error(`Could not check existing work: ${countError.message}`);
  if (count && !force) {
    log(`Portfolio already has ${count} item(s): starter photos not added (use --force to add them anyway).`);
    return { skipped: true, items: 0 };
  }

  const { data: cats, error: catError } = await admin.from('gallery_categories').select('id,slug');
  if (catError) throw new Error(`Could not read categories: ${catError.message}`);
  const categoryId = (slug) => cats.find((c) => c.slug === slug)?.id ?? null;

  const upload = async (objectPath, diskPath) => {
    const bytes = readFileSync(path.join(root, diskPath));
    const { error } = await admin.storage.from('site-media').upload(objectPath, bytes, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw new Error(`Upload failed for ${objectPath}: ${error.message}`);
    return bytes.length;
  };

  let order = 1;
  for (const spec of STARTER_ITEMS) {
    const itemId = randomUUID();
    const folder = `${ownerId}/gallery/${itemId}`;
    const uploaded = [];
    try {
      const sides = spec.kind === 'transformation' ? [['before', spec.before], ['after', spec.after]] : [['cover', spec.file]];
      const mediaRows = [];
      for (const [i, [role, file]] of sides.entries()) {
        const objectPath = `${folder}/${randomUUID()}-starter.jpg`;
        const size = await upload(objectPath, `${STARTER_IMAGE_DIR}${file}`.replace(/^\//, ''));
        uploaded.push(objectPath);
        mediaRows.push({ owner_id: ownerId, item_id: itemId, media_type: 'image', role, storage_path: objectPath, width: spec.width, height: spec.height, mime_type: 'image/jpeg', byte_size: size, sort_order: i });
      }
      const item = await admin.from('gallery_items').insert({
        id: itemId,
        owner_id: ownerId,
        category_id: categoryId(spec.category),
        title: spec.title,
        description: '',
        alt_text: spec.alt,
        is_featured: spec.featured,
        is_published: true,
        is_transformation: spec.kind === 'transformation',
        sort_order: order,
      });
      if (item.error) throw new Error(item.error.message);
      const media = await admin.from('gallery_media').insert(mediaRows);
      if (media.error) throw new Error(media.error.message);
    } catch (error) {
      // Leave nothing half-created: no row, no orphan files.
      await admin.from('gallery_items').delete().eq('id', itemId);
      if (uploaded.length) await admin.storage.from('site-media').remove(uploaded);
      throw error;
    }
    order += 1;
  }
  log(`Added ${STARTER_ITEMS.length} starter portfolio items (published, all marked as placeholders).`);

  // Portrait for the About section.
  const portraitPath = `${ownerId}/profile/${randomUUID()}-starter.jpg`;
  await upload(portraitPath, STARTER_PORTRAIT.replace(/^\//, ''));
  const { error: settingsError } = await admin.from('site_settings').update({ profile_photo_path: portraitPath, profile_photo_alt: STARTER_PORTRAIT_ALT }).eq('owner_id', ownerId);
  if (settingsError) {
    await admin.storage.from('site-media').remove([portraitPath]);
    throw new Error(`Could not set the portrait: ${settingsError.message}`);
  }
  log(`Added the placeholder portrait (${STARTER_PORTRAIT_SIZE.width}x${STARTER_PORTRAIT_SIZE.height}).`);
  return { skipped: false, items: STARTER_ITEMS.length };
}
