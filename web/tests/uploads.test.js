import { describe, expect, it, vi } from 'vitest';
import { createPhotoItem, createTransformationItem, createVideoItem, replaceMedia } from '../src/admin/services/uploads.js';
import { AppError, friendlyError, unwrap } from '../src/admin/services/errors.js';
import { passwordProblems } from '../src/admin/services/auth.js';
import { tusEndpoint } from '../src/admin/services/storage.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const blob = (n = 10) => new Blob([new Uint8Array(n)]);
const variant = (mime = 'image/webp') => ({ blob: blob(), mime, width: 800, height: 1000 });

/** A fake backend that records everything and can be told to fail at a chosen step. */
function makeDeps({ failUploadAt, failInsertItem, failInsertMedia } = {}) {
  const state = { uploaded: [], removed: [], items: [], media: [], uploadCalls: 0 };
  const deps = {
    uploadObject: vi.fn(async (path) => {
      state.uploadCalls += 1;
      if (failUploadAt === state.uploadCalls) throw new AppError('upload failed');
      state.uploaded.push(path);
    }),
    removeObjects: vi.fn(async (_owner, paths) => {
      state.removed.push(...paths);
    }),
    insertItem: vi.fn(async (values) => {
      if (failInsertItem) throw new AppError('insert item failed');
      state.items.push(values);
      return { id: values.id };
    }),
    insertMedia: vi.fn(async (values) => {
      if (failInsertMedia) throw new AppError('insert media failed');
      state.media.push(values);
    }),
    removeItem: vi.fn(async (id) => {
      state.items = state.items.filter((i) => i.id !== id);
    }),
  };
  return { deps, state };
}

const photoInput = (over = {}) => ({ ownerId: OWNER, item: { title: 'Fade', alt_text: 'A fade', is_published: false }, card: variant(), full: variant(), ...over });

describe('createPhotoItem', () => {
  it('uploads both variants first, then writes the rows', async () => {
    const { deps, state } = makeDeps();
    const { itemId } = await createPhotoItem(deps, photoInput());
    expect(state.uploaded).toHaveLength(2);
    expect(state.items).toHaveLength(1);
    expect(state.media).toHaveLength(1);
    // Order: uploads happen before any database write.
    expect(deps.uploadObject.mock.invocationCallOrder.at(-1)).toBeLessThan(deps.insertItem.mock.invocationCallOrder[0]);
    // Paths are owner-scoped, item-scoped and unique.
    for (const p of state.uploaded) expect(p).toMatch(new RegExp(`^${OWNER}/gallery/${itemId}/[0-9a-f-]{36}-(card|full)\\.webp$`));
    expect(state.media[0]).toMatchObject({ item_id: itemId, role: 'cover', media_type: 'image', mime_type: 'image/webp' });
  });

  it('writes NOTHING to the database if an upload fails, and cleans up what was uploaded', async () => {
    const { deps, state } = makeDeps({ failUploadAt: 2 }); // the "full" upload fails
    await expect(createPhotoItem(deps, photoInput())).rejects.toThrow('upload failed');
    expect(deps.insertItem).not.toHaveBeenCalled();
    expect(deps.insertMedia).not.toHaveBeenCalled();
    expect(state.removed).toEqual(state.uploaded); // the card that DID upload is removed
    expect(state.removed).toHaveLength(1);
  });

  it('removes the item row and both files if saving the media row fails', async () => {
    const { deps, state } = makeDeps({ failInsertMedia: true });
    await expect(createPhotoItem(deps, photoInput())).rejects.toThrow('insert media failed');
    expect(state.items).toHaveLength(0); // no orphan row
    expect(state.removed.sort()).toEqual([...state.uploaded].sort()); // no orphan files
  });

  it('removes uploaded files if creating the item row fails', async () => {
    const { deps, state } = makeDeps({ failInsertItem: true });
    await expect(createPhotoItem(deps, photoInput())).rejects.toThrow('insert item failed');
    expect(deps.removeItem).not.toHaveBeenCalled(); // there was no row to remove
    expect(state.removed).toHaveLength(2);
  });

  it('a cancelled batch leaves nothing behind', async () => {
    const { deps, state } = makeDeps();
    const controller = new AbortController();
    controller.abort();
    await expect(createPhotoItem(deps, photoInput({ signal: controller.signal }))).rejects.toMatchObject({ code: 'cancelled' });
    expect(state.uploaded).toHaveLength(0);
    expect(state.items).toHaveLength(0);
  });

  it('reports progress up to 100%', async () => {
    const { deps } = makeDeps();
    const onProgress = vi.fn();
    await createPhotoItem(deps, photoInput({ onProgress }));
    expect(onProgress.mock.calls.at(-1)[0]).toBe(1);
  });
});

describe('createTransformationItem', () => {
  const pair = () => ({ card: variant(), full: variant() });
  it('saves before and after as one item', async () => {
    const { deps, state } = makeDeps();
    await createTransformationItem(deps, { ownerId: OWNER, item: { title: 'T', alt_text: 'T' }, before: pair(), after: pair() });
    expect(state.uploaded).toHaveLength(4);
    expect(state.items[0].is_transformation).toBe(true);
    expect(state.media.map((m) => m.role).sort()).toEqual(['after', 'before']);
  });
  it('cleans up everything if the fourth upload fails', async () => {
    const { deps, state } = makeDeps({ failUploadAt: 4 });
    await expect(createTransformationItem(deps, { ownerId: OWNER, item: { title: 'T', alt_text: 'T' }, before: pair(), after: pair() })).rejects.toThrow();
    expect(state.items).toHaveLength(0);
    expect(state.removed).toHaveLength(3);
  });
});

describe('createVideoItem', () => {
  const video = () => ({ file: blob(1000), mime: 'video/mp4', width: 1920, height: 1080, duration: 12 });
  it('saves the video with its poster', async () => {
    const { deps, state } = makeDeps();
    await createVideoItem(deps, { ownerId: OWNER, item: { title: 'Clip', alt_text: 'Clip' }, video: video(), poster: variant() });
    expect(state.media[0]).toMatchObject({ media_type: 'video', mime_type: 'video/mp4', duration_seconds: 12 });
    expect(state.media[0].poster_path).toMatch(/-poster\.webp$/);
  });
  it('removes the already-uploaded poster if the video upload fails', async () => {
    const { deps, state } = makeDeps({ failUploadAt: 2 });
    await expect(createVideoItem(deps, { ownerId: OWNER, item: { title: 'C', alt_text: 'C' }, video: video(), poster: variant() })).rejects.toThrow();
    expect(state.items).toHaveLength(0);
    expect(state.removed).toHaveLength(1);
  });
});

describe('replaceMedia (upload new, switch, then remove old)', () => {
  const upload = (n) => ({ path: `${OWNER}/hero/new-${n}.webp`, blob: blob(), mime: 'image/webp' });

  it('switches the row and only then removes the old files', async () => {
    const { deps, state } = makeDeps();
    const commit = vi.fn(async () => {});
    await replaceMedia(deps, { ownerId: OWNER, uploads: [upload(1)], commit, oldPaths: [`${OWNER}/hero/old.webp`] });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(state.removed).toEqual([`${OWNER}/hero/old.webp`]);
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(deps.removeObjects.mock.invocationCallOrder[0]);
  });

  it('keeps the OLD media untouched if the upload fails', async () => {
    const { deps, state } = makeDeps({ failUploadAt: 1 });
    const commit = vi.fn();
    await expect(replaceMedia(deps, { ownerId: OWNER, uploads: [upload(1)], commit, oldPaths: [`${OWNER}/hero/old.webp`] })).rejects.toThrow();
    expect(commit).not.toHaveBeenCalled();
    expect(state.removed).not.toContain(`${OWNER}/hero/old.webp`);
  });

  it('removes the NEW files and keeps the old ones if saving the database row fails', async () => {
    const { deps, state } = makeDeps();
    const commit = vi.fn(async () => {
      throw new AppError('save failed');
    });
    await expect(replaceMedia(deps, { ownerId: OWNER, uploads: [upload(1), upload(2)], commit, oldPaths: [`${OWNER}/hero/old.webp`] })).rejects.toThrow('save failed');
    expect(state.removed.sort()).toEqual([`${OWNER}/hero/new-1.webp`, `${OWNER}/hero/new-2.webp`]);
    expect(state.removed).not.toContain(`${OWNER}/hero/old.webp`);
  });

  it('does not fail the owner\'s action when old-file cleanup has to be queued', async () => {
    const { deps } = makeDeps();
    deps.removeObjects.mockResolvedValue({ removed: [], queued: ['x'] });
    await expect(replaceMedia(deps, { ownerId: OWNER, uploads: [upload(1)], commit: async () => {}, oldPaths: [`${OWNER}/hero/old.webp`] })).resolves.toBeUndefined();
  });
});

describe('friendlyError', () => {
  it('explains the alt-text rule instead of showing a constraint name', () => {
    const e = friendlyError({ code: '23514', message: 'new row for relation "gallery_items" violates check constraint "gallery_items_published_needs_alt"' });
    expect(e.message).toMatch(/alt text/i);
    expect(e.message).not.toMatch(/constraint|gallery_items/);
  });
  it('explains a category that is still in use', () => {
    const e = friendlyError({ code: '23503', message: 'update or delete on table "gallery_categories" violates foreign key constraint "gallery_items_category_id_fkey" on table "gallery_items"' });
    expect(e.message).toMatch(/category still has/i);
  });
  it('explains a duplicate category', () => {
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "gallery_categories_slug_unique"' }).message).toMatch(/already have a category/i);
  });
  it('flags offline failures as retryable', () => {
    const e = friendlyError(new TypeError('Failed to fetch'));
    expect(e.retryable).toBe(true);
    expect(e.message).toMatch(/offline|connection/i);
  });
  it('turns permission and session problems into plain language', () => {
    expect(friendlyError({ code: '42501', message: 'permission denied' }).message).toMatch(/permission/i);
    expect(friendlyError({ status: 401, message: 'JWT expired' }).message).toMatch(/sign in again/i);
  });
  it('explains storage size and type rejections', () => {
    expect(friendlyError({ statusCode: '413', message: 'The object exceeded the maximum allowed size' }).message).toMatch(/too large/i);
    expect(friendlyError({ statusCode: '415', message: 'mime type text/html is not supported' }).message).toMatch(/isn't allowed/i);
  });
  it('never leaks raw technical text as the message, but keeps it as detail', () => {
    const e = friendlyError({ code: 'XX000', message: 'internal explosion at line 42' });
    expect(e.message).not.toMatch(/explosion/);
    expect(e.detail).toMatch(/explosion/);
  });
  it('passes AppErrors through and unwraps results', () => {
    const app = new AppError('mine');
    expect(friendlyError(app)).toBe(app);
    expect(() => unwrap({ error: { message: 'x', code: '42501' } })).toThrow(/permission/);
    expect(unwrap({ data: [1], error: null })).toEqual([1]);
  });
});

describe('passwordProblems', () => {
  it('lists what is missing', () => {
    expect(passwordProblems('short')).toEqual(expect.arrayContaining(['at least 12 characters', 'an uppercase letter', 'a number']));
    expect(passwordProblems('alllowercase123')).toEqual(['an uppercase letter']);
  });
  it('accepts a strong password', () => {
    expect(passwordProblems('Correct-Horse-Battery-9')).toEqual([]);
  });
});

describe('tusEndpoint', () => {
  it('uses the direct Storage hostname for hosted projects', () => {
    expect(tusEndpoint('https://abcdefgh.supabase.co')).toBe('https://abcdefgh.storage.supabase.co/storage/v1/upload/resumable');
  });
  it('uses the API URL for local development', () => {
    expect(tusEndpoint('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321/storage/v1/upload/resumable');
  });
});
