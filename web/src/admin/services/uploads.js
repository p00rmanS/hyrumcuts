import { buildObjectPath, randomToken } from '../../lib/media.js';
import { AppError } from './errors.js';

/**
 * Orchestration for saving portfolio media WITHOUT leaving orphans.
 *
 * Order matters and is the same everywhere:
 *   1. upload files to brand-new unique paths
 *   2. only if every upload succeeded, write the database rows
 *   3. if any step fails, remove what was uploaded (or queue it for cleanup)
 *      and remove any row that was created
 *
 * The functions take their collaborators as `deps` so the failure paths can be
 * tested without a network (see web/tests/uploads.test.js).
 *
 * @typedef {{
 *   uploadObject: (path: string, blob: Blob, opts: object) => Promise<void>,
 *   removeObjects: (ownerId: string, paths: string[], reason?: string) => Promise<any>,
 *   insertItem: (values: object) => Promise<{ id: string }>,
 *   insertMedia: (values: object) => Promise<any>,
 *   removeItem: (id: string) => Promise<void>,
 * }} UploadDeps
 */

const cancelled = () => new AppError('Cancelled.', { code: 'cancelled' });

/**
 * Create one photo item (card + full variants + database rows).
 *
 * @param {UploadDeps} deps
 * @param {{
 *   ownerId: string, item: object,
 *   card: { blob: Blob, mime: string, width: number, height: number },
 *   full: { blob: Blob, mime: string, width: number, height: number },
 *   onProgress?: (fraction: number) => void, signal?: AbortSignal,
 * }} input
 */
export async function createPhotoItem(deps, { ownerId, item, card, full, onProgress, signal }) {
  const itemId = randomToken();
  const token = randomToken();
  const cardPath = buildObjectPath(ownerId, 'gallery', { itemId, name: 'card', mime: card.mime, token });
  const fullPath = buildObjectPath(ownerId, 'gallery', { itemId, name: 'full', mime: full.mime, token });
  const uploaded = [];
  let rowCreated = false;

  try {
    if (signal?.aborted) throw cancelled();
    await deps.uploadObject(cardPath, card.blob, { contentType: card.mime, signal });
    uploaded.push(cardPath);
    onProgress?.(0.4);
    await deps.uploadObject(fullPath, full.blob, { contentType: full.mime, signal });
    uploaded.push(fullPath);
    onProgress?.(0.8);
    if (signal?.aborted) throw cancelled();

    await deps.insertItem({ ...item, id: itemId });
    rowCreated = true;
    await deps.insertMedia({
      item_id: itemId,
      media_type: 'image',
      role: 'cover',
      storage_path: fullPath,
      card_path: cardPath,
      width: full.width,
      height: full.height,
      mime_type: full.mime,
      byte_size: full.blob.size,
      sort_order: 0,
    });
    onProgress?.(1);
    return { itemId, cardPath, fullPath };
  } catch (error) {
    // Roll back: no item row without media, no files without an item.
    if (rowCreated) await deps.removeItem(itemId).catch(() => {});
    if (uploaded.length) await deps.removeObjects(ownerId, uploaded, 'failed-upload');
    throw error;
  }
}

/**
 * Create one before/after item (two images -> one transformation).
 * @param {UploadDeps} deps
 */
export async function createTransformationItem(deps, { ownerId, item, before, after, onProgress, signal }) {
  const itemId = randomToken();
  const paths = { before: {}, after: {} };
  const uploaded = [];
  let rowCreated = false;
  const sides = [
    ['before', before],
    ['after', after],
  ];

  try {
    let step = 0;
    for (const [role, side] of sides) {
      const token = randomToken();
      paths[role].card = buildObjectPath(ownerId, 'gallery', { itemId, name: `${role}-card`, mime: side.card.mime, token });
      paths[role].full = buildObjectPath(ownerId, 'gallery', { itemId, name: `${role}-full`, mime: side.full.mime, token });
      for (const kind of ['card', 'full']) {
        if (signal?.aborted) throw cancelled();
        await deps.uploadObject(paths[role][kind], side[kind].blob, { contentType: side[kind].mime, signal });
        uploaded.push(paths[role][kind]);
        step += 1;
        onProgress?.((step / 4) * 0.85);
      }
    }
    await deps.insertItem({ ...item, id: itemId, is_transformation: true });
    rowCreated = true;
    for (const [i, [role, side]] of sides.entries()) {
      await deps.insertMedia({
        item_id: itemId,
        media_type: 'image',
        role,
        storage_path: paths[role].full,
        card_path: paths[role].card,
        width: side.full.width,
        height: side.full.height,
        mime_type: side.full.mime,
        byte_size: side.full.blob.size,
        sort_order: i,
      });
    }
    onProgress?.(1);
    return { itemId };
  } catch (error) {
    if (rowCreated) await deps.removeItem(itemId).catch(() => {});
    if (uploaded.length) await deps.removeObjects(ownerId, uploaded, 'failed-upload');
    throw error;
  }
}

/**
 * Create a video-clip item: the video (resumable for large files) plus its poster.
 * @param {UploadDeps} deps
 */
export async function createVideoItem(deps, { ownerId, item, video, poster, onProgress, signal }) {
  const itemId = randomToken();
  const token = randomToken();
  const videoPath = buildObjectPath(ownerId, 'gallery', { itemId, name: 'clip', mime: video.mime, token });
  const posterPath = buildObjectPath(ownerId, 'gallery', { itemId, name: 'poster', mime: poster.mime, token });
  const uploaded = [];
  let rowCreated = false;

  try {
    await deps.uploadObject(posterPath, poster.blob, { contentType: poster.mime, signal });
    uploaded.push(posterPath);
    await deps.uploadObject(videoPath, video.file, { contentType: video.mime, signal, onProgress: (f) => onProgress?.(0.1 + f * 0.8) });
    uploaded.push(videoPath);
    if (signal?.aborted) throw cancelled();

    await deps.insertItem({ ...item, id: itemId });
    rowCreated = true;
    await deps.insertMedia({
      item_id: itemId,
      media_type: 'video',
      role: 'gallery',
      storage_path: videoPath,
      poster_path: posterPath,
      width: video.width ?? null,
      height: video.height ?? null,
      duration_seconds: video.duration ?? null,
      mime_type: video.mime,
      byte_size: video.file.size,
      sort_order: 0,
    });
    onProgress?.(1);
    return { itemId };
  } catch (error) {
    if (rowCreated) await deps.removeItem(itemId).catch(() => {});
    if (uploaded.length) await deps.removeObjects(ownerId, uploaded, 'failed-upload');
    throw error;
  }
}

/**
 * Replace a media file on an EXISTING record.
 *   1. upload the new file(s) to new unique paths
 *   2. update the database row to point at them
 *   3. only then remove the old objects (queued for retry if that fails)
 * If step 1 or 2 fails, the new upload is removed and the old media is untouched.
 *
 * @param {{ uploadObject: Function, removeObjects: Function }} deps
 * @param {{ ownerId: string, uploads: Array<{ path: string, blob: Blob, mime: string }>, commit: () => Promise<void>, oldPaths: string[], signal?: AbortSignal, onProgress?: Function }} input
 */
export async function replaceMedia(deps, { ownerId, uploads, commit, oldPaths, signal, onProgress }) {
  const uploaded = [];
  try {
    for (const [i, u] of uploads.entries()) {
      await deps.uploadObject(u.path, u.blob, {
        contentType: u.mime,
        signal,
        onProgress: (f) => onProgress?.((i + f) / uploads.length),
      });
      uploaded.push(u.path);
    }
    if (signal?.aborted) throw cancelled();
    await commit();
  } catch (error) {
    if (uploaded.length) await deps.removeObjects(ownerId, uploaded, 'failed-replace');
    throw error;
  }
  // The new media is live; the old files are now garbage.
  const stale = oldPaths.filter((p) => p && !uploaded.includes(p));
  if (stale.length) await deps.removeObjects(ownerId, stale, 'replaced');
}
