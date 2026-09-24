import { h } from '../../lib/dom.js';
import { publicMediaUrl } from '../../lib/media-url.js';
import { itemsApi } from '../services/data.js';
import { removeObjects } from '../services/storage.js';
import { confirmDialog, openDialog, toast } from '../ui.js';

/** Helpers shared by the portfolio list and edit pages. */

/** The picture to show as this item's thumbnail in the admin. */
export function thumbUrl(item) {
  const media = [...(item.media ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const pick = media.find((m) => m.role === 'cover') ?? media.find((m) => m.role === 'after') ?? media.find((m) => m.media_type === 'image') ?? media[0];
  if (!pick) return '';
  return publicMediaUrl(pick.media_type === 'video' ? pick.poster_path : pick.card_path || pick.storage_path);
}

/** Every Storage path used by an item (for cleanup on delete). */
export function allPaths(item) {
  return (item.media ?? []).flatMap((m) => [m.storage_path, m.card_path, m.poster_path]).filter(Boolean);
}

export function kindLabel(item) {
  if (item.is_transformation) return 'Before & after';
  if ((item.media ?? []).some((m) => m.media_type === 'video')) return 'Video';
  return 'Photo';
}

/** Permanently delete an item after an explicit confirmation. Row first, files second. */
export async function deleteItemFlow(item, ownerId) {
  const ok = await confirmDialog({
    title: 'Delete this work permanently?',
    message: h('div', {}, h('p', { class: 'font-semibold mb-2' }, item.title), h('p', {}, 'The photos and details will be erased and can\'t be recovered. If you might want it back, choose Archive instead.')),
    confirmLabel: 'Delete permanently',
    danger: true,
  });
  if (!ok) return false;
  try {
    await itemsApi.remove(item.id); // media rows go with it (ON DELETE CASCADE)
    await removeObjects(ownerId, allPaths(item), 'item-deleted'); // never throws; queues on failure
    toast('Deleted.');
    return true;
  } catch (error) {
    toast(error.message, { type: 'error' });
    return false;
  }
}

/** Show the item roughly as visitors will see it. */
export function previewItem(item) {
  const media = item.media ?? [];
  const url = (m) => publicMediaUrl(m.storage_path);
  const body = [];
  if (!item.is_published || item.archived_at) {
    body.push(h('div', { class: 'a-alert-warn' }, item.archived_at ? 'This item is archived. Visitors can\'t see it.' : 'This is a draft. Visitors can\'t see it until you publish it.'));
  }
  const cover = media.find((m) => m.role === 'cover') ?? media.find((m) => m.media_type === 'image');
  const before = media.find((m) => m.role === 'before');
  const after = media.find((m) => m.role === 'after');
  const video = media.find((m) => m.media_type === 'video');
  if (item.is_transformation && before && after) {
    body.push(h('div', { class: 'grid grid-cols-2 gap-1' }, h('img', { src: url(before), alt: `${item.alt_text} — before`, class: 'w-full' }), h('img', { src: url(after), alt: `${item.alt_text} — after`, class: 'w-full' })));
  } else if (video) {
    body.push(h('video', { src: url(video), poster: publicMediaUrl(video.poster_path), controls: true, playsinline: true, preload: 'metadata', class: 'w-full max-h-[60vh]' }));
  } else if (cover) {
    body.push(h('img', { src: url(cover), alt: item.alt_text, class: 'w-full max-h-[60vh] object-contain bg-ivory' }));
  }
  body.push(h('p', { class: 'font-semibold' }, item.title), item.description ? h('p', { class: 'text-muted' }, item.description) : null, item.alt_text ? h('p', { class: 'text-xs text-muted' }, `Alt text: ${item.alt_text}`) : h('p', { class: 'text-xs text-amber-900' }, 'No alt text yet.'));
  openDialog({ title: 'Preview', wide: true, body, actions: [{ label: 'Close', variant: 'secondary', autofocus: true }] });
}
