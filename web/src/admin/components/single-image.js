import { h } from '../../lib/dom.js';
import { buildObjectPath } from '../../lib/media.js';
import { IMAGE } from '../../lib/media-config.js';
import { publicMediaUrl } from '../../lib/media-url.js';
import { inspectImageFile } from '../services/image-processing.js';
import { updateSettings } from '../services/data.js';
import { removeObjects, uploadObject } from '../services/storage.js';
import { replaceMedia } from '../services/uploads.js';
import { confirmDialog, field, toast, withBusy } from '../ui.js';
import { filePicker } from './file-picker.js';

/**
 * Edit one image stored on the settings row (profile photo, sharing image).
 *
 * Replacement is safe: the new file is uploaded to a new unique path first,
 * the settings row is switched only after that succeeds, and only then is the
 * old file removed (or queued for cleanup). A failure at any step leaves the
 * current image exactly as it was.
 *
 * @param {{
 *   ownerId: string, settings: Record<string, any>, folder: 'profile'|'seo', pathKey: string, altKey?: string,
 *   heading: string, help: string, aspect: string, objectName: string,
 *   process: (file: File) => Promise<{ image: { blob: Blob, mime: string }, warnings: string[] }>,
 *   requireAlt?: boolean, altHelp?: string,
 * }} o
 */
export function singleImageCard(o) {
  let currentPath = o.settings[o.pathKey] ?? null;
  let pending = null; // { image, previewUrl, warnings }
  let altChanged = false;

  const preview = h('div', { class: `${o.aspect} w-full max-w-xs bg-ivory border border-ink/10 overflow-hidden flex items-center justify-center text-muted text-sm` });
  const status = h('div', { class: 'hidden mb-3', role: 'status', 'aria-live': 'polite' });
  const progress = h('div', { class: 'a-progress hidden my-3', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Upload progress' }, h('span'));
  const bar = progress.firstElementChild;
  const setProgress = (f) => {
    progress.classList.toggle('hidden', f === null);
    if (f === null) return;
    bar.style.width = `${Math.round(f * 100)}%`;
    progress.setAttribute('aria-valuenow', String(Math.round(f * 100)));
  };
  const alt = o.altKey ? field({ key: o.altKey, label: 'Describe the photo (alt text)', type: 'text', max: 250, help: o.altHelp, example: 'Portrait of Hyrum smiling, standing beside his barber chair' }, o.settings[o.altKey] ?? '') : null;

  const save = h('button', { type: 'button', class: 'a-btn-primary', disabled: true }, 'Save changes');
  alt?.input.addEventListener('input', () => {
    altChanged = true;
    save.disabled = false;
  });
  const remove = h('button', { type: 'button', class: 'a-btn-secondary hidden' }, 'Remove photo');

  const say = (message, type = 'info') => {
    status.className = `${{ info: 'a-alert-info', error: 'a-alert-error', ok: 'a-alert-ok', warn: 'a-alert-warn' }[type]} mb-3`;
    status.textContent = message;
    status.setAttribute('role', type === 'error' ? 'alert' : 'status');
  };

  function drawPreview() {
    preview.replaceChildren();
    const src = pending?.previewUrl ?? publicMediaUrl(currentPath);
    if (src) preview.appendChild(h('img', { src, alt: '', class: 'h-full w-full object-cover' }));
    else preview.textContent = 'No image yet';
    remove.classList.toggle('hidden', !currentPath || Boolean(pending));
    save.disabled = !pending && !altChanged;
  }

  const picker = filePicker({
    accept: IMAGE.acceptAttribute,
    label: currentPath ? 'Choose a new photo' : 'Choose a photo',
    hint: 'JPEG, PNG or WebP. Photos are resized and location data is removed before upload.',
    onFiles: async ([file]) => {
      status.classList.add('hidden');
      const verdict = await inspectImageFile(file);
      if (!verdict.ok) return say(verdict.message, 'error');
      say('Preparing your photo…');
      try {
        const { image, warnings } = await o.process(file);
        if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
        pending = { image, previewUrl: URL.createObjectURL(image.blob), warnings };
        say(warnings.length ? warnings.join(' ') : 'Looks good. Check the preview, then press Save changes.', warnings.length ? 'warn' : 'ok');
        drawPreview();
      } catch (error) {
        say(error.message === 'too-large-after-processing' ? 'That photo is too large even after shrinking it. Please choose a smaller one.' : 'Sorry, that photo couldn\'t be processed. Try a different one.', 'error');
      }
      return undefined;
    },
  });

  save.addEventListener('click', () =>
    withBusy(save, async () => {
      if (alt && o.requireAlt && !alt.get().trim()) {
        alt.setError('Describe the photo so people who can\'t see it know what it shows.');
        alt.input.focus();
        return;
      }
      if (!pending) {
        // Only the description changed: no upload needed.
        try {
          await updateSettings(o.ownerId, { [o.altKey]: alt.get().trim() });
          altChanged = false;
          save.disabled = true;
          say('Saved.', 'ok');
        } catch (error) {
          say(error.message, 'error');
        }
        return;
      }
      const path = buildObjectPath(o.ownerId, o.folder, { name: o.objectName, mime: pending.image.mime });
      try {
        await replaceMedia(
          { uploadObject, removeObjects },
          {
            ownerId: o.ownerId,
            uploads: [{ path, blob: pending.image.blob, mime: pending.image.mime }],
            oldPaths: [currentPath],
            onProgress: setProgress,
            commit: async () => {
              const patch = { [o.pathKey]: path };
              if (o.altKey) patch[o.altKey] = alt.get().trim();
              await updateSettings(o.ownerId, patch);
            },
          },
        );
        currentPath = path;
        URL.revokeObjectURL(pending.previewUrl);
        pending = null;
        altChanged = false;
        setProgress(null);
        say('Saved. It will appear on your website the next time it loads.', 'ok');
        toast('Photo saved.');
        drawPreview();
      } catch (error) {
        setProgress(null);
        say(`${error.message} Your current photo hasn't been changed.`, 'error');
      }
    }, 'Saving…'),
  );

  remove.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Remove this photo?', message: 'It will disappear from your website. You can upload another any time.', confirmLabel: 'Remove photo', danger: true });
    if (!ok) return;
    try {
      const old = currentPath;
      await updateSettings(o.ownerId, { [o.pathKey]: null });
      currentPath = null;
      await removeObjects(o.ownerId, [old], 'removed');
      say('Photo removed.', 'ok');
      drawPreview();
    } catch (error) {
      say(error.message, 'error');
    }
  });

  drawPreview();
  const el = h('section', { class: 'a-card max-w-2xl mb-6' }, h('h2', { class: 'text-xl mb-1' }, o.heading), h('p', { class: 'text-muted text-sm mb-4' }, o.help), preview, h('div', { class: 'mt-4' }, status, picker.el), alt ? h('div', { class: 'mt-4' }, alt.el) : null, progress, h('div', { class: 'mt-4 flex flex-wrap gap-2' }, save, remove));
  return { el };
}
