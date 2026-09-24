import { IMAGE } from '../../lib/media-config.js';
import { coverCrop, readHead, readImageSize, sniffBytes, stripJpegMetadata, targetSize, validateImage } from '../../lib/media.js';

/**
 * Browser-side image preparation.
 *
 * Every photo is decoded (with its camera orientation applied), redrawn on a
 * canvas and re-encoded as WebP. That single step:
 *   - normalises rotation (a phone photo taken sideways is upright),
 *   - strips ALL metadata, including GPS location, because a canvas export
 *     carries none,
 *   - produces the small "card" and larger "full" versions the site serves,
 *     so nothing depends on paid image transformations.
 *
 * If a browser cannot re-encode (very old engines), JPEGs fall back to
 * metadata stripping without re-encoding; the caller is told via `warnings`.
 */

/** Read + validate a chosen file. Resolves to { ok, ... } and never throws. */
export async function inspectImageFile(file) {
  try {
    const head = await readHead(file, 64 * 1024); // JPEG SOF can sit after large EXIF blocks
    const sniffed = sniffBytes(head);
    const size = readImageSize(head);
    const verdict = validateImage(file, sniffed, size);
    return verdict.ok ? { ok: true, sniffed, size } : verdict;
  } catch {
    return { ok: false, code: 'unreadable', message: `"${file.name}" couldn't be read. Please try choosing it again.` };
  }
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' applies the EXIF orientation while decoding.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode(); // browsers honour EXIF orientation for <img> by default
    return img;
  } finally {
    // Revoke after the decode promise has settled; the bitmap keeps its own pixels.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

const dims = (source) => ({ width: source.naturalWidth ?? source.width, height: source.naturalHeight ?? source.height });

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/** Draw `source` (optionally cropped) at the given size and encode it. */
async function encode(source, { sx, sy, sw, sh }, outW, outH, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff'; // transparent PNGs flatten onto white rather than black
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);

  let blob = await toBlob(canvas, 'image/webp', quality);
  // Browsers that can't encode WebP silently hand back a PNG; use JPEG instead.
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
  if (!blob) throw new Error('encode-failed');
  canvas.width = canvas.height = 0; // release memory promptly
  return blob;
}

/**
 * @typedef {{ blob: Blob, mime: string, width: number, height: number }} Variant
 */

/**
 * Produce the gallery variants for one photo.
 * @param {File} file already validated with inspectImageFile
 * @returns {Promise<{ card: Variant, full: Variant, warnings: string[] }>}
 */
export async function processGalleryImage(file) {
  return processVariants(file, { card: IMAGE.card, full: IMAGE.full });
}

/** A single re-encoded image (portrait, hero poster, etc.), longest side capped. */
export async function processSingleImage(file, spec) {
  const { full, warnings } = await processVariants(file, { full: spec });
  return { image: full, warnings };
}

/** A 1200×630 social-sharing image, centre-cropped. */
export async function processShareImage(file) {
  const source = await decode(file);
  try {
    const { width, height } = dims(source);
    const { width: outW, height: outH, quality } = IMAGE.share;
    const blob = await encode(source, coverCrop(width, height, outW, outH), outW, outH, quality);
    return { image: { blob, mime: blob.type, width: outW, height: outH }, warnings: [] };
  } finally {
    source.close?.();
  }
}

async function processVariants(file, specs) {
  const warnings = [];
  let source;
  try {
    source = await decode(file);
  } catch {
    return fallbackOriginal(file, specs, warnings);
  }
  try {
    const { width, height } = dims(source);
    const out = {};
    for (const [name, spec] of Object.entries(specs)) {
      const size = targetSize(width, height, spec.longestSide);
      const blob = await encode(source, { sx: 0, sy: 0, sw: width, sh: height }, size.width, size.height, spec.quality);
      if (blob.size > IMAGE.maxBytesAfterProcessing) {
        throw new Error('too-large-after-processing');
      }
      out[name] = { blob, mime: blob.type, width: size.width, height: size.height };
    }
    return { ...out, warnings };
  } catch (error) {
    if (error.message === 'too-large-after-processing') throw error;
    return fallbackOriginal(file, specs, warnings);
  } finally {
    source.close?.();
  }
}

/** Last resort when the browser can't re-encode: strip metadata from a JPEG, else pass through. */
async function fallbackOriginal(file, specs, warnings) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffBytes(bytes);
  let blob;
  if (kind === 'jpeg') {
    blob = new Blob([stripJpegMetadata(bytes)], { type: 'image/jpeg' });
    warnings.push('Your browser couldn\'t optimise this photo, so it was uploaded at its original size. Location data was removed, but the photo may appear rotated.');
  } else {
    blob = new Blob([bytes], { type: file.type || 'image/png' });
    warnings.push('Your browser couldn\'t optimise this photo, so it was uploaded at its original size.');
  }
  if (blob.size > IMAGE.maxBytesAfterProcessing) {
    throw Object.assign(new Error('too-large-after-processing'), { fallback: true });
  }
  const size = readImageSize(bytes.slice(0, 64 * 1024)) ?? { width: null, height: null };
  const one = { blob, mime: blob.type, width: size.width, height: size.height };
  return Object.fromEntries([...Object.keys(specs).map((k) => [k, one]), ['warnings', warnings]]);
}

// ---------------------------------------------------------------------------
// Video helpers
// ---------------------------------------------------------------------------

/** Load duration and dimensions from a video file. Resolves null if the browser can't read it. */
export function readVideoMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const done = (value) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };
    video.onloadedmetadata = () => done({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => done(null);
    setTimeout(() => done(null), 10_000);
    video.src = url;
  });
}

/**
 * Grab a still frame from a video file to use as a default poster image.
 * @param {File} file
 * @param {number} [atSeconds]
 * @returns {Promise<Variant | null>}
 */
export function captureVideoFrame(file, atSeconds = 1) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const finish = (value) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, (video.duration || 1) / 2));
    };
    video.onseeked = async () => {
      try {
        const { videoWidth: w, videoHeight: h } = video;
        const size = targetSize(w, h, IMAGE.hero.longestSide);
        const blob = await encode(video, { sx: 0, sy: 0, sw: w, sh: h }, size.width, size.height, IMAGE.hero.quality);
        finish({ blob, mime: blob.type, width: size.width, height: size.height });
      } catch {
        finish(null);
      }
    };
    setTimeout(() => finish(null), 15_000);
    video.src = url;
  });
}
