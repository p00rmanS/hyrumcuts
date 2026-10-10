import { h } from '../../lib/dom.js';
import { checkVideoMetadata, readHead, sniffBytes, titleFromFilename, validateVideo } from '../../lib/media.js';
import { IMAGE, VIDEO, formatBytes } from '../../lib/media-config.js';
import { filePicker } from '../components/file-picker.js';
import { itemFields } from '../components/item-fields.js';
import { captureVideoFrame, inspectImageFile, processGalleryImage, processSingleImage, readVideoMetadata } from '../services/image-processing.js';
import { categoriesApi, itemsApi, mediaApi, nextSortOrder } from '../services/data.js';
import { removeObjects, uploadObject } from '../services/storage.js';
import { createPhotoItem, createTransformationItem, createVideoItem } from '../services/uploads.js';
import { pageHeader, toast, uid, withBusy } from '../ui.js';

const deps = {
  uploadObject,
  removeObjects,
  insertItem: (values) => itemsApi.create(values),
  insertMedia: (values) => mediaApi.insert(values),
  removeItem: (id) => itemsApi.remove(id),
};

const bar = () => {
  const fill = h('span');
  const el = h('div', { class: 'a-progress my-2', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Upload progress' }, fill);
  return {
    el,
    set(fraction) {
      fill.style.width = `${Math.round(fraction * 100)}%`;
      el.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    },
  };
};

/**
 * Add Work: several photos at once, a before/after pair, or a video clip.
 * Files are prepared and previewed first; nothing is written to the database
 * until its uploads have succeeded, and a failure in one photo never loses
 * the others.
 */
export default async function portfolioAdd({ ownerId, setGuard }) {
  const categories = await categoriesApi.list();
  let nextOrder = await nextSortOrder('gallery_items');
  let lastCategory = '';
  const savedIds = [];

  const summary = h('div', { class: 'hidden mb-4', role: 'status', 'aria-live': 'polite' });
  const say = (message, type = 'info') => {
    summary.className = `${{ info: 'a-alert-info', ok: 'a-alert-ok', error: 'a-alert-error', warn: 'a-alert-warn' }[type]} mb-4`;
    summary.textContent = message;
    summary.setAttribute('role', type === 'error' ? 'alert' : 'status');
  };

  // Anything prepared but not yet saved is protected by the "leave without saving?" prompt.
  const unsaved = new Set();
  setGuard(() => unsaved.size > 0);

  // =====================================================================
  // Photos (batch)
  // =====================================================================
  const entries = [];
  const entryList = h('ul', { class: 'space-y-4 mt-5' });
  const saveAll = h('button', { type: 'button', class: 'a-btn-primary hidden' }, 'Save all');
  const cancelAll = h('button', { type: 'button', class: 'a-btn-secondary hidden' }, 'Stop after this one');
  let stopRequested = false;
  let currentAbort = null;

  const photoPicker = filePicker({
    accept: IMAGE.acceptAttribute,
    multiple: true,
    label: 'Choose photos',
    hint: 'Pick several at once. JPEG, PNG or WebP. Each photo is resized, straightened and stripped of location data before it is uploaded.',
    onFiles: (files) => files.forEach(addPhoto),
  });

  function addPhoto(file) {
    const entry = { id: uid('photo'), file, status: 'processing', message: '', variants: null, previewUrl: '', fields: null, progress: bar() };
    entries.push(entry);
    unsaved.add(entry.id);
    entry.root = h('li', { class: 'a-card' });
    entryList.appendChild(entry.root);
    draw(entry);
    prepare(entry);
  }

  async function prepare(entry) {
    const verdict = await inspectImageFile(entry.file);
    if (!verdict.ok) {
      entry.status = 'rejected';
      entry.message = verdict.message;
      unsaved.delete(entry.id);
      return draw(entry);
    }
    try {
      const variants = await processGalleryImage(entry.file);
      entry.variants = variants;
      entry.previewUrl = URL.createObjectURL(variants.card.blob);
      entry.fields = itemFields({ categories, values: { title: titleFromFilename(entry.file.name) }, defaultCategoryId: lastCategory });
      entry.fields.inputs.category.addEventListener('change', (e) => { lastCategory = e.target.value; });
      entry.status = 'ready';
      entry.message = variants.warnings.join(' ');
    } catch (error) {
      entry.status = 'rejected';
      entry.message = error.message === 'too-large-after-processing' ? `"${entry.file.name}" is still too large after shrinking it. Please choose a smaller photo.` : `"${entry.file.name}" couldn't be processed. Try exporting it again as a JPEG.`;
      unsaved.delete(entry.id);
    }
    draw(entry);
    return undefined;
  }

  function remove(entry) {
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    entries.splice(entries.indexOf(entry), 1);
    unsaved.delete(entry.id);
    entry.root.remove();
    refreshButtons();
  }

  function draw(entry) {
    const head = h('p', { class: 'text-xs text-muted mb-2 break-all' }, `${entry.file.name} · ${formatBytes(entry.file.size)}`);
    const removeBtn = h('button', { type: 'button', class: 'a-btn-ghost a-btn-sm', onClick: () => remove(entry) }, entry.status === 'saved' ? 'Dismiss' : 'Remove');
    let body;
    if (entry.status === 'processing') body = h('p', { role: 'status' }, 'Preparing this photo…');
    else if (entry.status === 'rejected') body = h('div', {}, h('div', { class: 'a-alert-error', role: 'alert' }, entry.message), h('div', { class: 'mt-3' }, removeBtn));
    else if (entry.status === 'saved') body = h('div', {}, h('div', { class: 'a-alert-ok' }, `Saved${entry.published ? ' and published' : ' as a draft'} ✓`), h('div', { class: 'mt-3 flex gap-2' }, h('a', { href: `/admin/portfolio/${entry.savedId}`, class: 'a-btn-secondary a-btn-sm' }, 'Edit'), removeBtn));
    else {
      body = h(
        'div',
        { class: 'grid gap-4 sm:grid-cols-[10rem_1fr]' },
        h('img', { src: entry.previewUrl, alt: `Preview of ${entry.file.name}`, class: 'w-full max-w-[10rem] bg-ivory' }),
        h(
          'div',
          {},
          entry.message ? h('div', { class: 'a-alert-warn mb-3' }, entry.message) : null,
          entry.status === 'error' ? h('div', { class: 'a-alert-error mb-3', role: 'alert' }, `${entry.error} Nothing was saved for this photo. Press Save all to try it again.`) : null,
          entry.fields.el,
          entry.status === 'saving' ? entry.progress.el : null,
          entry.status === 'saving' ? h('p', { class: 'text-sm', role: 'status' }, 'Saving…') : removeBtn,
        ),
      );
    }
    entry.root.replaceChildren(head, body);
    refreshButtons();
  }

  function refreshButtons() {
    const pending = entries.filter((e) => e.status === 'ready' || e.status === 'error');
    saveAll.classList.toggle('hidden', pending.length === 0 && !entries.some((e) => e.status === 'saving'));
    saveAll.textContent = pending.length === 1 ? 'Save this photo' : `Save all (${pending.length})`;
  }

  saveAll.addEventListener('click', () =>
    withBusy(saveAll, async () => {
      const queue = entries.filter((e) => e.status === 'ready' || e.status === 'error');
      // Validate everything first so no photo is left half-finished.
      const invalid = queue.filter((e) => !e.fields.validate());
      if (invalid.length) {
        say(`${invalid.length} photo${invalid.length === 1 ? ' needs' : 's need'} a little more information (highlighted below). Nothing has been saved yet.`, 'warn');
        return;
      }
      stopRequested = false;
      cancelAll.classList.remove('hidden');
      let ok = 0;
      let failed = 0;
      for (const entry of queue) {
        if (stopRequested) break;
        entry.status = 'saving';
        draw(entry);
        const f = entry.fields.get();
        currentAbort = new AbortController();
        try {
          const result = await createPhotoItem(deps, {
            ownerId,
            item: { ...f, sort_order: nextOrder },
            card: entry.variants.card,
            full: entry.variants.full,
            onProgress: (p) => entry.progress.set(p),
            signal: currentAbort.signal,
          });
          nextOrder += 1;
          entry.status = 'saved';
          entry.savedId = result.itemId;
          entry.published = f.is_published;
          savedIds.push(result.itemId);
          unsaved.delete(entry.id);
          URL.revokeObjectURL(entry.previewUrl);
          ok += 1;
        } catch (error) {
          entry.status = 'error';
          entry.error = error.message;
          failed += 1;
        }
        draw(entry);
      }
      cancelAll.classList.add('hidden');
      const left = entries.filter((e) => e.status === 'ready' || e.status === 'error').length;
      if (failed) say(`Saved ${ok}, but ${failed} didn't save. Nothing was lost: the others are safe, and the rest are still here so you can try again.`, 'warn');
      else if (left) say(`Saved ${ok}. ${left} left, press Save all when you're ready.`, 'info');
      else say(`All done: ${ok} saved. `, 'ok');
      if (ok && !failed && !left) toast(`${ok} saved.`);
    }, 'Saving…'),
  );
  cancelAll.addEventListener('click', () => {
    stopRequested = true;
    currentAbort?.abort();
  });

  const photosPanel = h('div', {}, photoPicker.el, entryList, h('div', { class: 'mt-5 flex flex-wrap gap-2' }, saveAll, cancelAll));

  // =====================================================================
  // Before & after pair
  // =====================================================================
  const pair = { before: null, after: null };
  const pairFields = itemFields({ categories, values: {} });
  const pairSave = h('button', { type: 'button', class: 'a-btn-primary' }, 'Save before & after');
  const pairProgress = bar();
  pairProgress.el.classList.add('hidden');
  const pairStatus = h('div', { class: 'hidden mb-3', role: 'status' });
  const sideUi = {};

  function sidePicker(role, label) {
    const preview = h('div', { class: 'aspect-[3/4] w-full bg-ivory border border-ink/10 flex items-center justify-center text-sm text-muted overflow-hidden' }, 'No photo yet');
    const msg = h('p', { class: 'a-error hidden', role: 'alert' });
    const picker = filePicker({
      accept: IMAGE.acceptAttribute,
      label,
      onFiles: async ([file]) => {
        msg.classList.add('hidden');
        const verdict = await inspectImageFile(file);
        if (!verdict.ok) {
          msg.textContent = verdict.message;
          msg.classList.remove('hidden');
          return;
        }
        try {
          const variants = await processGalleryImage(file);
          if (pair[role]?.url) URL.revokeObjectURL(pair[role].url);
          pair[role] = { variants, url: URL.createObjectURL(variants.card.blob) };
          preview.replaceChildren(h('img', { src: pair[role].url, alt: `${role} preview`, class: 'h-full w-full object-cover' }));
          unsaved.add('pair');
        } catch {
          msg.textContent = 'That photo couldn\'t be processed. Try a different one.';
          msg.classList.remove('hidden');
        }
      },
    });
    sideUi[role] = { preview };
    return h('div', {}, h('p', { class: 'a-label capitalize' }, role), preview, msg, picker.el);
  }

  pairSave.addEventListener('click', () =>
    withBusy(pairSave, async () => {
      if (!pair.before || !pair.after) {
        pairStatus.className = 'a-alert-warn mb-3';
        pairStatus.textContent = 'Choose both a "before" and an "after" photo.';
        return;
      }
      if (!pairFields.validate()) return;
      pairProgress.el.classList.remove('hidden');
      try {
        const item = { ...pairFields.get(), sort_order: nextOrder };
        const { itemId } = await createTransformationItem(deps, { ownerId, item, before: pair.before.variants, after: pair.after.variants, onProgress: pairProgress.set });
        nextOrder += 1;
        savedIds.push(itemId);
        unsaved.delete('pair');
        resetPair();
        done('Before & after saved.', itemId, item.is_published);
      } catch (error) {
        pairStatus.className = 'a-alert-error mb-3';
        pairStatus.textContent = `${error.message} Nothing was saved. You can try again.`;
        pairStatus.setAttribute('role', 'alert');
      } finally {
        pairProgress.el.classList.add('hidden');
      }
    }, 'Saving…'),
  );

  /** Clear both photos and the fields after a successful save. */
  function resetPair() {
    for (const role of ['before', 'after']) {
      if (pair[role]?.url) URL.revokeObjectURL(pair[role].url);
      pair[role] = null;
      sideUi[role]?.preview.replaceChildren('No photo yet');
    }
    pairFields.reset();
    pairStatus.className = 'hidden mb-3';
  }

  const pairPanel = h('div', {}, h('p', { class: 'text-muted mb-4' }, 'Show a transformation: one "before" photo and one "after" photo, saved together as a single piece of work.'), pairStatus, h('div', { class: 'grid grid-cols-2 gap-4 mb-6' }, sidePicker('before', 'Choose "before"'), sidePicker('after', 'Choose "after"')), pairFields.el, pairProgress.el, pairSave);

  // =====================================================================
  // Video clip
  // =====================================================================
  let clip = null; // { file, mime, meta, url }
  let clipPoster = null; // { image, url }
  let videoAbort = null;
  const videoFields = itemFields({ categories, values: {} });
  const videoStatus = h('div', { class: 'hidden mb-3', role: 'status' });
  const videoWarn = h('ul', { class: 'a-alert-warn hidden list-disc list-inside mb-3' });
  const videoPreview = h('div', { class: 'mb-4 hidden' });
  const videoProgress = bar();
  videoProgress.el.classList.add('hidden');
  const videoSave = h('button', { type: 'button', class: 'a-btn-primary' }, 'Save video');
  const videoCancel = h('button', { type: 'button', class: 'a-btn-secondary hidden' }, 'Cancel upload');
  const vSay = (m, t = 'info') => {
    videoStatus.className = `${{ info: 'a-alert-info', ok: 'a-alert-ok', error: 'a-alert-error', warn: 'a-alert-warn' }[t]} mb-3`;
    videoStatus.textContent = m;
    videoStatus.setAttribute('role', t === 'error' ? 'alert' : 'status');
  };

  function drawVideo() {
    videoPreview.classList.toggle('hidden', !clip);
    if (!clip) return;
    videoPreview.replaceChildren(h('video', { src: clip.url, poster: clipPoster?.url, controls: true, muted: true, playsinline: true, preload: 'metadata', class: 'w-full max-h-[50vh] bg-ink', 'aria-label': 'Video preview' }), clipPoster ? h('p', { class: 'a-help' }, 'The poster image is the still picture shown before the video plays.') : null);
  }

  const clipPicker = filePicker({
    accept: VIDEO.acceptAttribute,
    label: 'Choose a video clip',
    hint: `MP4 or WebM, up to ${formatBytes(VIDEO.clip.maxBytes)} and ${VIDEO.clip.maxSeconds} seconds.`,
    onFiles: async ([file]) => {
      const sniffed = sniffBytes(await readHead(file, 64));
      const verdict = validateVideo(file, sniffed, 'clip');
      if (!verdict.ok) return vSay(verdict.message, 'error');
      vSay('Checking your video…');
      const meta = await readVideoMetadata(file);
      const extra = meta ? checkVideoMetadata(meta, 'clip') : { ok: true, warnings: [] };
      if (!extra.ok) return vSay(extra.message, 'error');
      if (clip) URL.revokeObjectURL(clip.url);
      clip = { file, meta, mime: sniffed === 'webm' ? 'video/webm' : 'video/mp4', url: URL.createObjectURL(file) };
      const warnings = [...verdict.warnings, ...extra.warnings];
      videoWarn.replaceChildren(...warnings.map((w) => h('li', {}, w)));
      videoWarn.classList.toggle('hidden', warnings.length === 0);
      const frame = await captureVideoFrame(file, 1);
      if (frame) setClipPoster(frame);
      vSay(clipPoster ? 'Ready. A poster image was picked from the video. You can choose your own below.' : 'Video ready, but a poster couldn\'t be made automatically. Please choose one below.', clipPoster ? 'ok' : 'warn');
      unsaved.add('video');
      drawVideo();
      return undefined;
    },
  });

  function setClipPoster(image) {
    if (clipPoster) URL.revokeObjectURL(clipPoster.url);
    clipPoster = { image, url: URL.createObjectURL(image.blob) };
  }

  const clipPosterPicker = filePicker({
    accept: IMAGE.acceptAttribute,
    label: 'Choose a poster image (optional if one was picked automatically)',
    onFiles: async ([file]) => {
      const verdict = await inspectImageFile(file);
      if (!verdict.ok) return vSay(verdict.message, 'error');
      try {
        const { image } = await processSingleImage(file, IMAGE.hero);
        setClipPoster(image);
        vSay('Poster ready.', 'ok');
        drawVideo();
      } catch {
        vSay('That image couldn\'t be processed.', 'error');
      }
      return undefined;
    },
  });

  videoSave.addEventListener('click', () =>
    withBusy(videoSave, async () => {
      if (!clip) return vSay('Choose a video first.', 'warn');
      if (!clipPoster) return vSay('Please add a poster image.', 'warn');
      if (!videoFields.validate()) return undefined;
      videoAbort = new AbortController();
      videoCancel.classList.remove('hidden');
      videoProgress.el.classList.remove('hidden');
      try {
        const item = { ...videoFields.get(), sort_order: nextOrder };
        const { itemId } = await createVideoItem(deps, {
          ownerId,
          item,
          video: { file: clip.file, mime: clip.mime, width: clip.meta?.width, height: clip.meta?.height, duration: clip.meta ? Math.round(clip.meta.duration * 100) / 100 : null },
          poster: clipPoster.image,
          onProgress: videoProgress.set,
          signal: videoAbort.signal,
        });
        nextOrder += 1;
        savedIds.push(itemId);
        unsaved.delete('video');
        resetVideo();
        done('Video saved.', itemId, item.is_published);
      } catch (error) {
        vSay(error.code === 'cancelled' ? 'Cancelled. Nothing was saved.' : `${error.message} Nothing was saved. You can press Save video to try again.`, error.code === 'cancelled' ? 'info' : 'error');
      } finally {
        videoProgress.el.classList.add('hidden');
        videoCancel.classList.add('hidden');
      }
      return undefined;
    }, 'Saving…'),
  );
  videoCancel.addEventListener('click', () => videoAbort?.abort());

  /** Clear the clip, its poster and the fields after a successful save. */
  function resetVideo() {
    if (clip?.url) URL.revokeObjectURL(clip.url);
    if (clipPoster?.url) URL.revokeObjectURL(clipPoster.url);
    clip = null;
    clipPoster = null;
    videoFields.reset();
    videoWarn.classList.add('hidden');
    videoStatus.className = 'hidden mb-3';
    drawVideo();
  }

  const videoPanel = h('div', {}, h('p', { class: 'text-muted mb-4' }, 'Add a short clip of a cut. Long videos upload in pieces and pick up where they left off if your connection drops.'), videoStatus, videoWarn, clipPicker.el, videoPreview, h('div', { class: 'mt-4 mb-6' }, clipPosterPicker.el), videoFields.el, videoProgress.el, h('div', { class: 'flex flex-wrap gap-2' }, videoSave, videoCancel));

  // =====================================================================
  // Tabs and success
  // =====================================================================
  const panels = { photos: photosPanel, pair: pairPanel, video: videoPanel };
  const tabs = h('div', { class: 'flex gap-1 border-b border-ink/20 mb-6 overflow-x-auto', role: 'tablist', 'aria-label': 'What are you adding?' });
  const tabBtns = {};
  for (const [key, label] of [['photos', 'Photos'], ['pair', 'Before & after'], ['video', 'Video clip']]) {
    const btn = h('button', { type: 'button', role: 'tab', id: `tab-${key}`, 'aria-controls': `panel-${key}`, class: 'a-btn-ghost whitespace-nowrap border-b-2 border-transparent', onClick: () => select(key) }, label);
    btn.addEventListener('keydown', (e) => {
      const keys = Object.keys(panels);
      const i = keys.indexOf(key);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        select(keys[(i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length], true);
      }
    });
    tabBtns[key] = btn;
    tabs.appendChild(btn);
    panels[key].setAttribute('role', 'tabpanel');
    panels[key].id = `panel-${key}`;
    panels[key].setAttribute('aria-labelledby', `tab-${key}`);
  }
  function select(key, focus = false) {
    for (const [k, panel] of Object.entries(panels)) {
      panel.classList.toggle('hidden', k !== key);
      tabBtns[k].setAttribute('aria-selected', String(k === key));
      tabBtns[k].setAttribute('tabindex', k === key ? '0' : '-1');
      tabBtns[k].classList.toggle('border-ink', k === key);
      tabBtns[k].classList.toggle('font-bold', k === key);
    }
    if (focus) tabBtns[key].focus();
  }

  const container = h('div', { class: 'a-page' });
  const success = h('div', { class: 'hidden a-card text-center py-8 mb-6', role: 'status' });
  function done(message, itemId, published = false) {
    success.classList.remove('hidden');
    const next = published ? 'It\'s live on your website now.' : 'It\'s saved as a draft. Publish it from Manage Work whenever you\'re ready.';
    success.replaceChildren(h('h2', { class: 'text-xl mb-2' }, message), h('p', { class: 'text-muted mb-4' }, next), h('div', { class: 'flex flex-wrap justify-center gap-2' }, h('a', { href: `/admin/portfolio/${itemId}`, class: 'a-btn-secondary' }, 'Edit it'), h('a', { href: '/admin/portfolio', class: 'a-btn-primary' }, 'Go to Manage Work'), h('a', { href: '/admin/portfolio/add', class: 'a-btn-secondary' }, 'Add more')));
    success.setAttribute('tabindex', '-1');
    success.focus();
    toast(message);
    setGuard(() => unsaved.size > 0);
  }

  select('photos');
  container.append(pageHeader('Add work', 'Upload photos or a video, add a title and a short description, then publish it or keep it as a draft.'), success, summary, tabs, photosPanel, pairPanel, videoPanel);
  select('photos');
  return { node: container, cleanup: () => setGuard(null) };
}
