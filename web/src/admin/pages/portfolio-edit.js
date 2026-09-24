import { h } from '../../lib/dom.js';
import { buildObjectPath, checkVideoMetadata, randomToken, readHead, sniffBytes, validateVideo } from '../../lib/media.js';
import { IMAGE, VIDEO } from '../../lib/media-config.js';
import { publicMediaUrl } from '../../lib/media-url.js';
import { filePicker } from '../components/file-picker.js';
import { itemFields } from '../components/item-fields.js';
import { captureVideoFrame, inspectImageFile, processGalleryImage, processSingleImage, readVideoMetadata } from '../services/image-processing.js';
import { categoriesApi, itemsApi, mediaApi } from '../services/data.js';
import { removeObjects, uploadObject } from '../services/storage.js';
import { replaceMedia } from '../services/uploads.js';
import { confirmDialog, pageHeader, statusBadge, toast, trackDirty, withBusy } from '../ui.js';
import { deleteItemFlow, previewItem } from './portfolio-common.js';

/** Edit one portfolio item: text, category, publish state, and its media. */
export default async function portfolioEdit({ params, ownerId, setGuard, navigate }) {
  const [categories, loaded] = await Promise.all([categoriesApi.list(), itemsApi.get(params.id)]);
  let item = loaded;
  const archived = () => Boolean(item.archived_at);

  const fields = itemFields({ categories, values: item, showPublish: !archived() });
  const errorBox = h('div', { class: 'a-alert-error hidden mb-4', role: 'alert', tabindex: '-1' });
  const save = h('button', { type: 'submit', class: 'a-btn-primary' }, 'Save changes');
  const form = h('form', { class: 'a-card max-w-2xl mb-6', novalidate: true }, errorBox, fields.el);
  const dirty = trackDirty(form, { setGuard });
  form.append(h('div', { class: 'flex flex-wrap items-center gap-4' }, save, dirty.indicator));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.classList.add('hidden');
    if (!fields.validate()) return;
    await withBusy(save, async () => {
      try {
        const values = fields.get();
        if (archived()) values.is_published = false;
        item = { ...item, ...(await itemsApi.update(item.id, values)) };
        dirty.markClean();
        toast(values.is_published ? 'Saved. It\'s live on your website.' : 'Saved.');
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove('hidden');
        errorBox.focus();
      }
    }, 'Saving…');
  });

  // ---- media replacement ---------------------------------------------------
  const mediaHost = h('div', { class: 'space-y-4' });

  /** One replaceable image (cover, before or after). */
  function imageBlock(media, label) {
    const status = h('div', { class: 'hidden mt-3', role: 'status', 'aria-live': 'polite' });
    const say = (m, t = 'info') => {
      status.className = `${{ info: 'a-alert-info', ok: 'a-alert-ok', error: 'a-alert-error' }[t]} mt-3`;
      status.textContent = m;
      status.setAttribute('role', t === 'error' ? 'alert' : 'status');
    };
    const img = h('img', { src: publicMediaUrl(media.card_path || media.storage_path), alt: `${label} (current)`, class: 'w-32 bg-ivory' });
    const picker = filePicker({
      accept: IMAGE.acceptAttribute,
      label: `Replace ${label.toLowerCase()}`,
      onFiles: async ([file]) => {
        const verdict = await inspectImageFile(file);
        if (!verdict.ok) return say(verdict.message, 'error');
        say('Replacing…');
        try {
          const { card, full } = await processGalleryImage(file);
          const token = randomToken();
          const cardPath = buildObjectPath(ownerId, 'gallery', { itemId: item.id, name: `${media.role}-card`, mime: card.mime, token });
          const fullPath = buildObjectPath(ownerId, 'gallery', { itemId: item.id, name: `${media.role}-full`, mime: full.mime, token });
          await replaceMedia(
            { uploadObject, removeObjects },
            {
              ownerId,
              uploads: [
                { path: cardPath, blob: card.blob, mime: card.mime },
                { path: fullPath, blob: full.blob, mime: full.mime },
              ],
              oldPaths: [media.card_path, media.storage_path],
              commit: async () => {
                await mediaApi.update(media.id, { storage_path: fullPath, card_path: cardPath, width: full.width, height: full.height, mime_type: full.mime, byte_size: full.blob.size });
              },
            },
          );
          Object.assign(media, { storage_path: fullPath, card_path: cardPath });
          img.src = publicMediaUrl(cardPath);
          say('Replaced. The old file was removed.', 'ok');
        } catch (error) {
          say(`${error.message} Your current photo hasn't been changed.`, 'error');
        }
        return undefined;
      },
    });
    return h('div', { class: 'flex flex-wrap gap-4 items-start' }, h('div', {}, h('p', { class: 'a-label' }, label), img), h('div', { class: 'flex-1 min-w-[12rem]' }, picker.el, status));
  }

  /** The video file and its poster. */
  function videoBlock(media) {
    const status = h('div', { class: 'hidden mt-3', role: 'status', 'aria-live': 'polite' });
    const say = (m, t = 'info') => {
      status.className = `${{ info: 'a-alert-info', ok: 'a-alert-ok', error: 'a-alert-error' }[t]} mt-3`;
      status.textContent = m;
      status.setAttribute('role', t === 'error' ? 'alert' : 'status');
    };
    const preview = h('video', { src: publicMediaUrl(media.storage_path), poster: publicMediaUrl(media.poster_path), controls: true, muted: true, playsinline: true, preload: 'metadata', class: 'w-full max-w-md bg-ink' });
    const prog = h('div', { class: 'a-progress hidden my-2', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Upload progress' }, h('span'));
    const fill = prog.firstElementChild;

    const videoPicker = filePicker({
      accept: VIDEO.acceptAttribute,
      label: 'Replace the video',
      onFiles: async ([file]) => {
        const sniffed = sniffBytes(await readHead(file, 64));
        const verdict = validateVideo(file, sniffed, 'clip');
        if (!verdict.ok) return say(verdict.message, 'error');
        const meta = await readVideoMetadata(file);
        if (meta) {
          const extra = checkVideoMetadata(meta, 'clip');
          if (!extra.ok) return say(extra.message, 'error');
        }
        const frame = await captureVideoFrame(file, 1);
        const mime = sniffed === 'webm' ? 'video/webm' : 'video/mp4';
        const token = randomToken();
        const videoPath = buildObjectPath(ownerId, 'gallery', { itemId: item.id, name: 'clip', mime, token });
        const uploads = [{ path: videoPath, blob: file, mime }];
        let posterPath = null;
        if (frame) {
          posterPath = buildObjectPath(ownerId, 'gallery', { itemId: item.id, name: 'poster', mime: frame.mime, token });
          uploads.unshift({ path: posterPath, blob: frame.blob, mime: frame.mime });
        }
        prog.classList.remove('hidden');
        say('Uploading…');
        try {
          await replaceMedia(
            { uploadObject, removeObjects },
            {
              ownerId,
              uploads,
              oldPaths: [media.storage_path, posterPath ? media.poster_path : null],
              onProgress: (f) => {
                fill.style.width = `${Math.round(f * 100)}%`;
                prog.setAttribute('aria-valuenow', String(Math.round(f * 100)));
              },
              commit: async () => {
                const patch = { storage_path: videoPath, mime_type: mime, byte_size: file.size, width: meta?.width ?? null, height: meta?.height ?? null, duration_seconds: meta ? Math.round(meta.duration * 100) / 100 : null };
                if (posterPath) patch.poster_path = posterPath;
                await mediaApi.update(media.id, patch);
              },
            },
          );
          Object.assign(media, { storage_path: videoPath, poster_path: posterPath ?? media.poster_path });
          preview.src = publicMediaUrl(videoPath);
          preview.poster = publicMediaUrl(media.poster_path);
          say('Replaced.', 'ok');
        } catch (error) {
          say(`${error.message} Your current video hasn't been changed.`, 'error');
        } finally {
          prog.classList.add('hidden');
        }
        return undefined;
      },
    });

    const posterPicker = filePicker({
      accept: IMAGE.acceptAttribute,
      label: 'Replace the poster image',
      onFiles: async ([file]) => {
        const verdict = await inspectImageFile(file);
        if (!verdict.ok) return say(verdict.message, 'error');
        try {
          const { image } = await processSingleImage(file, IMAGE.hero);
          const posterPath = buildObjectPath(ownerId, 'gallery', { itemId: item.id, name: 'poster', mime: image.mime });
          await replaceMedia({ uploadObject, removeObjects }, { ownerId, uploads: [{ path: posterPath, blob: image.blob, mime: image.mime }], oldPaths: [media.poster_path], commit: async () => { await mediaApi.update(media.id, { poster_path: posterPath }); } });
          media.poster_path = posterPath;
          preview.poster = publicMediaUrl(posterPath);
          say('Poster replaced.', 'ok');
        } catch (error) {
          say(error.message, 'error');
        }
        return undefined;
      },
    });
    return h('div', {}, preview, prog, h('div', { class: 'mt-3' }, videoPicker.el), h('div', { class: 'mt-3' }, posterPicker.el), status);
  }

  function drawMedia() {
    const media = [...(item.media ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const blocks = [];
    for (const m of media) {
      if (m.media_type === 'video') blocks.push(videoBlock(m));
      else blocks.push(imageBlock(m, { cover: 'Photo', before: 'Before photo', after: 'After photo', gallery: 'Photo' }[m.role] ?? 'Photo'));
    }
    mediaHost.replaceChildren(...(blocks.length ? blocks : [h('p', { class: 'text-muted' }, 'This item has no media.')]));
  }
  drawMedia();

  // ---- actions ------------------------------------------------------------
  const act = async (fn, message) => {
    try {
      item = { ...item, ...(await fn()) };
      toast(message);
      dirty.dispose();
      await navigate(`/admin/portfolio/${item.id}`, { replace: true, force: true });
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  };

  const actions = h(
    'div',
    { class: 'a-card max-w-2xl mb-6' },
    h('h2', { class: 'text-xl mb-3' }, 'Actions'),
    h('div', { class: 'flex flex-wrap gap-2' },
      h('button', { type: 'button', class: 'a-btn-secondary', onClick: () => previewItem({ ...item, ...fields.get() }) }, 'Preview'),
      archived()
        ? h('button', { type: 'button', class: 'a-btn-secondary', onClick: () => act(() => itemsApi.restore(item.id), 'Restored as a draft.') }, 'Restore')
        : h('button', { type: 'button', class: 'a-btn-secondary', onClick: async () => {
            if (dirty.isDirty() && !(await confirmDialog({ title: 'Archive without saving?', message: 'You have unsaved edits. Archiving keeps the last saved version.', confirmLabel: 'Archive anyway' }))) return;
            await act(() => itemsApi.archive(item.id), 'Archived. You can restore it any time.');
          } }, 'Archive (hide, keep for later)'),
      h('button', { type: 'button', class: 'a-btn-ghost text-red-800', onClick: async () => {
        dirty.dispose();
        if (await deleteItemFlow(item, ownerId)) await navigate('/admin/portfolio', { force: true });
        else setGuard(() => dirty.isDirty());
      } }, 'Delete permanently'),
    ),
  );

  const node = h(
    'div',
    { class: 'a-page' },
    pageHeader(item.title || 'Edit work', null, [h('a', { href: '/admin/portfolio', class: 'a-btn-secondary' }, '← Back to Manage Work')]),
    h('p', { class: 'mb-4' }, statusBadge(item)),
    archived() ? h('div', { class: 'a-alert-info max-w-2xl mb-4' }, 'This work is archived: visitors can\'t see it. Restore it to edit its publish state.') : null,
    form,
    h('section', { class: 'a-card max-w-2xl mb-6' }, h('h2', { class: 'text-xl mb-3' }, 'Photos & video'), mediaHost),
    actions,
  );
  return { node, cleanup: () => dirty.dispose() };
}
