/**
 * Pure media helpers (no DOM, no network) so they can be unit tested.
 *
 * Nothing here trusts a file's name or its browser-reported MIME type on its
 * own: the first bytes are checked ("magic numbers"), so a renamed executable
 * or a HEIC photo saved as .jpg is caught before any upload starts.
 */

import { IMAGE, VIDEO, STORAGE_FOLDERS, formatBytes } from './media-config.js';

// ---------------------------------------------------------------------------
// Type sniffing
// ---------------------------------------------------------------------------

const ascii = (bytes, start, end) => String.fromCharCode(...bytes.slice(start, end));

/**
 * Identify a file from its first bytes.
 * @param {Uint8Array} bytes at least the first 32 bytes
 * @returns {'jpeg'|'png'|'webp'|'gif'|'heic'|'mp4'|'webm'|'unknown'}
 */
export function sniffBytes(bytes) {
  if (!bytes || bytes.length < 12) return 'unknown';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 3) === 'GIF') return 'gif';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    // HEIC/HEIF still images, which browsers cannot decode.
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic';
    return 'mp4'; // isom, mp41, mp42, avc1, M4V, qt, ...
  }
  return 'unknown';
}

export const SNIFF_TO_MIME = Object.freeze({
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
});

/** Read the first bytes of a File/Blob. */
export async function readHead(file, length = 64) {
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}

// ---------------------------------------------------------------------------
// Image dimensions straight from the file header (before decoding anything)
// ---------------------------------------------------------------------------

/**
 * Read width/height from a JPEG, PNG or WebP header without decoding pixels.
 * Used to reject absurdly large images before the browser tries to decode
 * them. Returns null if the size cannot be determined.
 * @param {Uint8Array} bytes
 */
export function readImageSize(bytes) {
  const kind = sniffBytes(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (kind === 'png' && bytes.length >= 24) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (kind === 'webp' && bytes.length >= 30) {
    const chunk = ascii(bytes, 12, 16);
    if (chunk === 'VP8X') {
      return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    }
    if (chunk === 'VP8 ') {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === 'VP8L') {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return null;
  }

  if (kind === 'jpeg') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = view.getUint16(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      offset += 2 + length;
    }
    return null;
  }
  return null;
}

/**
 * Remove metadata segments (EXIF incl. GPS location, XMP, IPTC, comments) from
 * a JPEG without re-encoding it. Used only as a fallback when the browser
 * cannot re-encode through a canvas. Note: dropping EXIF also drops the
 * orientation flag, which is why the canvas path is preferred.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array}
 */
export function stripJpegMetadata(bytes) {
  if (sniffBytes(bytes) !== 'jpeg') return bytes;
  const out = [bytes[0], bytes[1]];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xda) break; // start of scan: the rest is image data
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const end = offset + 2 + length;
    // APP1..APP15 (EXIF, XMP, ICC excluded below) and COM carry metadata.
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    // Keep APP2 (ICC colour profile): it affects how colours look and holds no personal data.
    const keep = marker === 0xe2;
    if (!isMetadata || keep) for (let i = offset; i < end; i += 1) out.push(bytes[i]);
    offset = end;
  }
  const result = new Uint8Array(out.length + (bytes.length - offset));
  result.set(out, 0);
  result.set(bytes.subarray(offset), out.length);
  return result;
}

// ---------------------------------------------------------------------------
// Validation (pure: takes what has already been read from the file)
// ---------------------------------------------------------------------------

/**
 * @param {{ name: string, size: number, type?: string }} file
 * @param {string} sniffed result of sniffBytes()
 * @param {{ width: number, height: number } | null} size from readImageSize()
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateImage(file, sniffed, size) {
  if (sniffed === 'heic') {
    return {
      ok: false,
      code: 'heic',
      message:
        'This looks like an iPhone HEIC photo, which browsers can\'t process. On iPhone, open Settings > Camera > Formats and choose "Most Compatible", or share the photo as a JPEG (in Photos, choose Share > Options > Most Compatible).',
    };
  }
  if (sniffed === 'gif') return { ok: false, code: 'gif', message: 'GIF images aren\'t supported. Please use a JPEG, PNG or WebP photo.' };
  if (!['jpeg', 'png', 'webp'].includes(sniffed)) {
    return { ok: false, code: 'type', message: `"${file.name}" isn't a JPEG, PNG or WebP image. Only real photos in those formats can be uploaded.` };
  }
  // The bytes are the source of truth. A reported type that is not an image at all
  // (e.g. an .exe renamed to .jpg) is refused; a reported "image/heic" over real
  // JPEG bytes is fine, as some phones label converted photos that way.
  if (file.type && !file.type.startsWith('image/')) {
    return { ok: false, code: 'mime-mismatch', message: `"${file.name}" says it is ${file.type}, not an image.` };
  }
  if (file.size > IMAGE.maxBytes) {
    return { ok: false, code: 'too-big', message: `"${file.name}" is ${formatBytes(file.size)}. Please choose a photo under ${formatBytes(IMAGE.maxBytes)}.` };
  }
  if (!size) {
    return { ok: false, code: 'unreadable', message: `"${file.name}" couldn't be read as an image. Try exporting it again as a JPEG.` };
  }
  const { width, height } = size;
  if (Math.min(width, height) < IMAGE.minSide) {
    return { ok: false, code: 'too-small', message: `"${file.name}" is only ${width}×${height} pixels. Please use a photo at least ${IMAGE.minSide} pixels on its shortest side.` };
  }
  if (Math.max(width, height) > IMAGE.maxSide || width * height > IMAGE.maxPixels) {
    return { ok: false, code: 'too-large-dimensions', message: `"${file.name}" is ${width}×${height} pixels, which is larger than this tool can safely process. Please resize it first.` };
  }
  return { ok: true };
}

/**
 * @param {{ name: string, size: number, type?: string }} file
 * @param {string} sniffed
 * @param {'hero' | 'clip'} purpose
 * @returns {{ ok: true, warnings: string[] } | { ok: false, code: string, message: string }}
 */
export function validateVideo(file, sniffed, purpose = 'hero') {
  const rules = VIDEO[purpose];
  if (!['mp4', 'webm'].includes(sniffed)) {
    const hint = file.name.toLowerCase().endsWith('.mov')
      ? ' iPhone .MOV files usually need converting first: in Photos choose Share > Options > "Most Compatible", or export as MP4.'
      : '';
    return { ok: false, code: 'type', message: `"${file.name}" isn't an MP4 or WebM video.${hint}` };
  }
  if (file.type && !VIDEO.acceptedMimeTypes.includes(file.type)) {
    return { ok: false, code: 'mime-mismatch', message: `"${file.name}" says it is ${file.type}, but only MP4 or WebM videos are allowed.` };
  }
  if (file.size > rules.maxBytes) {
    return {
      ok: false,
      code: 'too-big',
      message: `"${file.name}" is ${formatBytes(file.size)}, over the ${formatBytes(rules.maxBytes)} limit. Shorten the clip to 10–20 seconds and export at 1080p, or run it through a free compressor such as HandBrake, then try again.`,
    };
  }
  const warnings = [];
  if (file.size > rules.warnBytes) {
    warnings.push(`This video is ${formatBytes(file.size)}. Files under ${formatBytes(rules.warnBytes)} load much faster for visitors on phones.`);
  }
  return { ok: true, warnings };
}

/** Extra checks once the browser has read the video's metadata. */
export function checkVideoMetadata(meta, purpose = 'hero') {
  const rules = VIDEO[purpose];
  const warnings = [];
  if (Number.isFinite(meta.duration)) {
    if (meta.duration > rules.maxSeconds) {
      return { ok: false, message: `This video is ${Math.round(meta.duration)} seconds long. Please trim it to under ${rules.maxSeconds} seconds.` };
    }
    if (purpose === 'hero' && meta.duration > VIDEO.hero.recommendedSeconds[1]) {
      warnings.push(`Hero videos work best at ${VIDEO.hero.recommendedSeconds[0]}–${VIDEO.hero.recommendedSeconds[1]} seconds; this one is ${Math.round(meta.duration)}.`);
    }
  }
  if (purpose === 'hero' && meta.width && meta.height) {
    if (meta.height > meta.width) warnings.push('This video is vertical. The hero is a wide, landscape area, so a landscape (16:9) video will look better.');
    if (Math.max(meta.width, meta.height) > 1920) warnings.push('This video is larger than 1920×1080. It will work, but a 1080p export will load faster.');
  }
  return { ok: true, warnings };
}

// ---------------------------------------------------------------------------
// Variants and object paths
// ---------------------------------------------------------------------------

/** Longest side to output, never enlarging the original. */
export function targetSize(width, height, longestSide) {
  const ratio = Math.min(1, longestSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/** Cover-crop: the source rectangle that fills width×height with the target aspect ratio. */
export function coverCrop(srcW, srcH, dstW, dstH) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const w = Math.round(srcH * dstRatio);
    return { sx: Math.round((srcW - w) / 2), sy: 0, sw: w, sh: srcH };
  }
  const h = Math.round(srcW / dstRatio);
  return { sx: 0, sy: Math.round((srcH - h) / 2), sw: srcW, sh: h };
}

const EXTENSIONS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'video/webm': 'webm' };
export const extensionFor = (mime) => EXTENSIONS[mime] ?? 'bin';

/** A collision-proof object name. Never derived from the user's filename. */
export function randomToken() {
  return globalThis.crypto.randomUUID();
}

/**
 * Build an owner-scoped object path. Every path starts with the owner's uid,
 * which is what the Storage policies check.
 *
 * @param {string} ownerId
 * @param {'gallery'|'hero'|'profile'|'seo'} folder
 * @param {{ itemId?: string, name: string, mime: string, token?: string }} parts name like "card", "full", "hero", "poster"
 */
export function buildObjectPath(ownerId, folder, { itemId, name, mime, token = randomToken() }) {
  if (!Object.values(STORAGE_FOLDERS).includes(folder)) throw new Error(`Unknown storage folder: ${folder}`);
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error('Invalid owner id');
  if (folder === STORAGE_FOLDERS.gallery && !/^[0-9a-f-]{36}$/i.test(itemId ?? '')) throw new Error('Gallery paths need an item id');
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error('Invalid object name');
  const dir = folder === STORAGE_FOLDERS.gallery ? `${ownerId}/${folder}/${itemId}` : `${ownerId}/${folder}`;
  return `${dir}/${token}-${name}.${extensionFor(mime)}`;
}

/** True if `path` is inside the owner's own folder (mirrors the Storage policy). */
export function isOwnedPath(ownerId, path) {
  return typeof path === 'string' && path.startsWith(`${ownerId}/`) && !path.includes('..');
}

/** Filename to a readable default title: "IMG_2041-fade_low.JPG" -> "IMG 2041 fade low". */
export function titleFromFilename(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
