import { config } from '../../lib/env.js';
import { VIDEO } from '../../lib/media-config.js';
import { isOwnedPath } from '../../lib/media.js';
import { getAdminClient } from '../../lib/supabase-admin-client.js';
import { AppError, friendlyError } from './errors.js';

const CACHE_CONTROL = '31536000'; // object names are unique, so they can be cached "forever"

/**
 * Resumable (TUS) upload endpoint.
 * Hosted projects use the direct Storage hostname (recommended by Supabase
 * for large files); local development uses the normal API URL.
 * @param {string} supabaseUrl
 */
export function tusEndpoint(supabaseUrl) {
  const url = new URL(supabaseUrl);
  if (url.hostname.endsWith('.supabase.co')) {
    const ref = url.hostname.slice(0, -'.supabase.co'.length);
    return `https://${ref}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${url.origin}/storage/v1/upload/resumable`;
}

/** Standard upload for small files (photos, posters). */
async function uploadStandard(path, blob, contentType) {
  const { error } = await getAdminClient().storage.from(config.bucket).upload(path, blob, { contentType, cacheControl: CACHE_CONTROL, upsert: false });
  if (error) throw friendlyError(error, 'The upload failed. Please try again.');
}

/**
 * Resumable upload with progress and automatic retries. If the connection
 * drops it keeps retrying; if it gives up, calling this again resumes from
 * where it stopped rather than starting over.
 */
async function uploadResumable(path, file, contentType, { onProgress, signal } = {}) {
  const tus = await import('tus-js-client');
  const client = getAdminClient();

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint(config.supabaseUrl),
      retryDelays: VIDEO.tusRetryDelays,
      chunkSize: VIDEO.tusChunkBytes, // must stay 6 MB (Supabase requirement)
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: { 'x-upsert': 'false' },
      metadata: { bucketName: config.bucket, objectName: path, contentType, cacheControl: CACHE_CONTROL },
      // Attach the *current* access token on every request, so a long upload survives token refresh.
      onBeforeRequest: async (req) => {
        const { data } = await client.auth.getSession(); // token is only forwarded, never trusted for a decision
        if (!data.session) throw new Error('signed-out');
        req.setHeader('Authorization', `Bearer ${data.session.access_token}`);
        req.setHeader('apikey', config.publishableKey);
      },
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
      onError: (error) => reject(friendlyTusError(error)),
    });

    signal?.addEventListener('abort', () => {
      upload.abort(true).finally(() => reject(new AppError('Upload cancelled.', { code: 'cancelled' })));
    });

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}

function friendlyTusError(error) {
  const status = error?.originalResponse?.getStatus?.() ?? 0;
  const body = error?.originalResponse?.getBody?.() ?? '';
  const synthetic = { message: `${error?.message ?? ''} ${body}`, status };
  if (/signed-out/.test(error?.message ?? '')) return new AppError('You were signed out during the upload. Please sign in and try again.', { code: 'signed-out' });
  return friendlyError(synthetic, 'The video upload was interrupted. Tap Retry to continue where it stopped.');
}

/**
 * Upload one object. Files over the resumable threshold use TUS.
 * @param {string} path owner-scoped object path
 * @param {Blob|File} blob
 * @param {{ contentType: string, onProgress?: (fraction: number) => void, signal?: AbortSignal }} options
 */
export async function uploadObject(path, blob, { contentType, onProgress, signal }) {
  if (signal?.aborted) throw new AppError('Upload cancelled.', { code: 'cancelled' });
  if (blob.size > VIDEO.resumableThresholdBytes) {
    await uploadResumable(path, blob, contentType, { onProgress, signal });
  } else {
    await uploadStandard(path, blob, contentType);
    onProgress?.(1);
  }
}

/**
 * Delete objects. Anything that can't be deleted right now goes on the
 * cleanup queue instead of being forgotten, so no orphaned files pile up.
 * Never throws: cleanup problems must not fail the owner's action.
 */
export async function removeObjects(ownerId, paths, reason = '') {
  const unique = [...new Set((paths ?? []).filter((p) => isOwnedPath(ownerId, p)))];
  if (unique.length === 0) return { removed: [], queued: [] };
  try {
    // remove() lists only objects it deleted; ones that were already gone need no retry.
    const { error } = await getAdminClient().storage.from(config.bucket).remove(unique);
    if (error) throw error;
    return { removed: unique, queued: [] };
  } catch {
    await enqueueCleanup(ownerId, unique, reason);
    return { removed: [], queued: unique };
  }
}

export async function enqueueCleanup(ownerId, paths, reason = '') {
  const rows = [...new Set(paths)].filter((p) => isOwnedPath(ownerId, p)).map((object_path) => ({ owner_id: ownerId, object_path, reason: reason.slice(0, 120) }));
  if (rows.length === 0) return;
  // Ignore duplicates; a failure here must not break the caller.
  await getAdminClient().from('storage_cleanup_queue').upsert(rows, { onConflict: 'owner_id,object_path', ignoreDuplicates: true }).then(
    () => {},
    () => {},
  );
}

/** Retry queued deletions. Called every time the admin opens. Returns how many were cleaned. */
export async function runCleanupQueue() {
  const client = getAdminClient();
  const { data, error } = await client.from('storage_cleanup_queue').select('id,object_path,attempts').order('created_at').limit(50);
  if (error || !data?.length) return 0;

  const { error: removeError } = await client.storage.from(config.bucket).remove(data.map((r) => r.object_path));
  if (removeError) {
    // Still failing (offline?): count the attempt and try again next time.
    await Promise.all(data.map((r) => client.from('storage_cleanup_queue').update({ attempts: r.attempts + 1 }).eq('id', r.id)));
    return 0;
  }
  await client.from('storage_cleanup_queue').delete().in('id', data.map((r) => r.id));
  return data.length;
}
