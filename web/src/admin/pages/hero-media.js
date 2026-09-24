import { h } from '../../lib/dom.js';
import { buildObjectPath, checkVideoMetadata, readHead, sniffBytes, validateVideo } from '../../lib/media.js';
import { HERO_GUIDANCE, IMAGE, VIDEO, formatBytes } from '../../lib/media-config.js';
import { HERO_FALLBACK } from '../../lib/content.js';
import { publicMediaUrl } from '../../lib/media-url.js';
import { filePicker } from '../components/file-picker.js';
import { captureVideoFrame, inspectImageFile, processSingleImage, readVideoMetadata } from '../services/image-processing.js';
import { getSettings, updateSettings } from '../services/data.js';
import { removeObjects, uploadObject } from '../services/storage.js';
import { replaceMedia } from '../services/uploads.js';
import { pageHeader, toast, withBusy } from '../ui.js';

/**
 * Replace the hero video and its poster.
 *
 * A new video needs a poster (grabbed automatically from the video, or
 * chosen by the owner). Large videos upload in resumable chunks with
 * progress; the same object path is reused on retry so an interrupted upload
 * genuinely resumes. The site only switches to the new files after they have
 * both uploaded.
 */
export default async function heroMedia({ ownerId }) {
  let settings = await getSettings();
  /** @type {null | { file: File, path: string, mime: string, url: string, meta: any, warnings: string[] }} */
  let video = null;
  /** @type {null | { image: { blob: Blob, mime: string }, path: string, url: string, source: string }} */
  let poster = null;
  let abort = null;

  const currentVideo = () => publicMediaUrl(settings.hero_video_path) || HERO_FALLBACK.video;
  const currentPoster = () => publicMediaUrl(settings.hero_poster_path) || HERO_FALLBACK.poster;
  const usingPlaceholder = () => !settings.hero_video_path;

  const previewBox = h('div', { class: 'aspect-video w-full bg-ink overflow-hidden' });
  const posterBox = h('div', { class: 'aspect-video w-full max-w-sm bg-ivory border border-ink/10 overflow-hidden' });
  const status = h('div', { class: 'hidden mb-4', role: 'status', 'aria-live': 'polite' });
  const warnings = h('ul', { class: 'a-alert-warn hidden list-disc list-inside mb-4' });
  const progress = h('div', { class: 'hidden my-3' }, h('div', { class: 'a-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Upload progress' }, h('span')), h('p', { class: 'text-sm text-muted mt-1', dataset: { progressText: '' } }));
  const bar = progress.querySelector('.a-progress > span');
  const barWrap = progress.querySelector('.a-progress');
  const setProgress = (fraction, text) => {
    progress.classList.toggle('hidden', fraction === null);
    if (fraction === null) return;
    bar.style.width = `${Math.round(fraction * 100)}%`;
    barWrap.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    progress.querySelector('[data-progress-text]').textContent = text ?? `${Math.round(fraction * 100)}%`;
  };

  const save = h('button', { type: 'button', class: 'a-btn-primary', disabled: true }, 'Save hero media');
  const cancel = h('button', { type: 'button', class: 'a-btn-secondary hidden' }, 'Cancel upload');

  function say(message, type = 'info') {
    status.className = `${{ info: 'a-alert-info', error: 'a-alert-error', ok: 'a-alert-ok', warn: 'a-alert-warn' }[type]} mb-4`;
    status.textContent = message;
    status.setAttribute('role', type === 'error' ? 'alert' : 'status');
  }

  function draw() {
    previewBox.replaceChildren(
      h('video', { src: video?.url ?? currentVideo(), poster: poster?.url ?? currentPoster(), controls: true, muted: true, playsinline: true, preload: 'metadata', class: 'h-full w-full object-cover', 'aria-label': 'Hero video preview' }),
    );
    posterBox.replaceChildren(h('img', { src: poster?.url ?? currentPoster(), alt: 'Current poster image', class: 'h-full w-full object-cover' }));
    warnings.replaceChildren(...(video?.warnings ?? []).map((w) => h('li', {}, w)));
    warnings.classList.toggle('hidden', !video?.warnings?.length);
    save.disabled = !(video || poster);
  }

  // ---- choosing a video ------------------------------------------------
  const videoPicker = filePicker({
    accept: VIDEO.acceptAttribute,
    label: 'Choose a new hero video',
    hint: `MP4 or WebM, up to ${formatBytes(VIDEO.hero.maxBytes)}.`,
    onFiles: async ([file]) => {
      status.classList.add('hidden');
      const head = await readHead(file, 64);
      const sniffed = sniffBytes(head);
      const verdict = validateVideo(file, sniffed, 'hero');
      if (!verdict.ok) return say(verdict.message, 'error');
      say('Checking your video…');
      const meta = await readVideoMetadata(file);
      const extra = meta ? checkVideoMetadata(meta, 'hero') : { ok: true, warnings: ['Your browser couldn\'t read this video\'s details. It may still work: check the preview.'] };
      if (!extra.ok) return say(extra.message, 'error');

      if (video) URL.revokeObjectURL(video.url);
      const mime = sniffed === 'webm' ? 'video/webm' : 'video/mp4';
      video = { file, mime, meta, url: URL.createObjectURL(file), path: buildObjectPath(ownerId, 'hero', { name: 'hero', mime }), warnings: [...verdict.warnings, ...extra.warnings] };

      // A poster is needed with a new video: grab one automatically.
      const frame = await captureVideoFrame(file, 1);
      if (frame) setPoster(frame, 'frame');
      else poster = poster?.source === 'file' ? poster : null;
      say(poster ? 'Video ready. A poster image was picked from the video: check it below, or choose your own.' : 'Video ready, but a poster image couldn\'t be created automatically. Please choose one below.', poster ? 'ok' : 'warn');
      draw();
      return undefined;
    },
  });

  function setPoster(image, source) {
    if (poster) URL.revokeObjectURL(poster.url);
    poster = { image, source, url: URL.createObjectURL(image.blob), path: buildObjectPath(ownerId, 'hero', { name: 'poster', mime: image.mime }) };
  }

  const posterPicker = filePicker({
    accept: IMAGE.acceptAttribute,
    label: 'Choose a poster image',
    hint: 'The still picture shown before the video plays, on slow connections, and for people who prefer less motion. A frame from the video works well.',
    onFiles: async ([file]) => {
      const verdict = await inspectImageFile(file);
      if (!verdict.ok) return say(verdict.message, 'error');
      try {
        const { image } = await processSingleImage(file, IMAGE.hero);
        setPoster(image, 'file');
        say('Poster ready.', 'ok');
        draw();
      } catch {
        say('That image couldn\'t be processed. Try a different one.', 'error');
      }
      return undefined;
    },
  });

  const frameBtn = h('button', { type: 'button', class: 'a-btn-secondary', onClick: async () => {
    if (!video) return say('Choose a new video first, then pick a frame from it.', 'info');
    const seconds = Math.max(0, Math.round((video.meta?.duration ?? 4) / 2));
    const frame = await captureVideoFrame(video.file, seconds);
    if (frame) {
      setPoster(frame, 'frame');
      say(`Poster set from ${seconds} seconds into the video.`, 'ok');
      draw();
    } else say('Couldn\'t grab a frame from that video.', 'error');
  } }, 'Use a frame from the middle of the video');

  // ---- saving ------------------------------------------------------------
  save.addEventListener('click', () =>
    withBusy(save, async () => {
      if (video && !poster) return say('Please add a poster image for the new video first.', 'error');
      abort = new AbortController();
      cancel.classList.remove('hidden');
      const uploads = [];
      if (poster) uploads.push({ path: poster.path, blob: poster.image.blob, mime: poster.image.mime });
      if (video) uploads.push({ path: video.path, blob: video.file, mime: video.mime });
      const oldPaths = [poster ? settings.hero_poster_path : null, video ? settings.hero_video_path : null];
      try {
        await replaceMedia(
          { uploadObject, removeObjects },
          {
            ownerId,
            uploads,
            oldPaths,
            signal: abort.signal,
            onProgress: (f) => setProgress(f, video && video.file.size > VIDEO.resumableThresholdBytes ? `Uploading… ${Math.round(f * 100)}%` : 'Uploading…'),
            commit: async () => {
              const patch = {};
              if (poster) patch.hero_poster_path = poster.path;
              if (video) patch.hero_video_path = video.path;
              settings = await updateSettings(ownerId, patch);
            },
          },
        );
        if (video) URL.revokeObjectURL(video.url);
        if (poster) URL.revokeObjectURL(poster.url);
        video = null;
        poster = null;
        setProgress(null);
        say('Saved. Your new hero media will show the next time your website loads.', 'ok');
        toast('Hero media saved.');
      } catch (error) {
        setProgress(null);
        if (error.code === 'cancelled') say('Upload cancelled. Nothing was changed.', 'info');
        else say(`${error.message} Your current hero hasn't been changed. Press Save to try again.${error.retryable ? ' An interrupted video upload picks up where it stopped.' : ''}`, 'error');
      } finally {
        cancel.classList.add('hidden');
        abort = null;
        draw();
      }
      return undefined;
    }, 'Saving…'),
  );
  cancel.addEventListener('click', () => abort?.abort());

  draw();
  return h(
    'div',
    { class: 'a-page' },
    pageHeader('Hero video', 'The full-width video at the very top of your home page.'),
    usingPlaceholder() ? h('div', { class: 'a-alert-info mb-4 max-w-3xl' }, 'You\'re still using the starter video. Upload your own below.') : null,
    h('section', { class: 'a-card max-w-3xl mb-6' }, h('h2', { class: 'text-xl mb-3' }, 'Preview'), previewBox, h('div', { class: 'mt-4' }, h('p', { class: 'a-label' }, 'Poster image'), posterBox)),
    h(
      'section',
      { class: 'a-card max-w-3xl mb-6' },
      h('h2', { class: 'text-xl mb-2' }, 'Replace media'),
      h('div', { class: 'a-alert-info mb-4' }, h('p', { class: 'font-semibold mb-1' }, 'What works best'), h('ul', { class: 'list-disc list-inside' }, HERO_GUIDANCE.map((g) => h('li', {}, g)))),
      status,
      warnings,
      videoPicker.el,
      h('div', { class: 'mt-4' }, posterPicker.el),
      h('div', { class: 'mt-3' }, frameBtn),
      progress,
      h('div', { class: 'mt-5 flex flex-wrap gap-2' }, save, cancel),
    ),
  );
}
