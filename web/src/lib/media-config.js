/**
 * Upload rules shared by the uploader and its tests.
 *
 * The bucket also enforces a hard cap and an allowed-MIME list on the server
 * (see supabase/migrations/*_storage_media.sql), so bypassing this file in
 * dev tools does not bypass the limits.
 */

const MB = 1024 * 1024;

export const IMAGE = Object.freeze({
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  // File-picker hint. HEIC is listed so phones offer their photos, then the
  // uploader explains that HEIC must be converted (browsers cannot decode it).
  acceptAttribute: 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif',
  maxBytes: 25 * MB, // the original the owner picks (phone photos are often 5-12 MB)
  maxBytesAfterProcessing: 8 * MB, // what is actually uploaded
  minSide: 400, // px, shortest side of the original
  maxSide: 12000, // px, longest side of the original (guards against decompression bombs)
  maxPixels: 100_000_000,
  // Pre-generated responsive variants (no paid image transformations needed).
  card: { longestSide: 800, quality: 0.82 },
  full: { longestSide: 2000, quality: 0.86 },
  hero: { longestSide: 1920, quality: 0.86 },
  portrait: { longestSide: 1600, quality: 0.86 },
  share: { width: 1200, height: 630, quality: 0.86 },
});

export const VIDEO = Object.freeze({
  acceptedMimeTypes: ['video/mp4', 'video/webm'],
  acceptAttribute: 'video/mp4,video/webm,.mp4,.webm',
  // Files above this use resumable (TUS) uploads with progress and retry.
  resumableThresholdBytes: 6 * MB,
  hero: { warnBytes: 20 * MB, maxBytes: 50 * MB, maxSeconds: 30, recommendedSeconds: [10, 20] },
  clip: { warnBytes: 15 * MB, maxBytes: 30 * MB, maxSeconds: 90 }, // 90 s fits a full phone reel
  // TUS chunk size is fixed by Supabase Storage. Do not change it.
  tusChunkBytes: 6 * MB,
  tusRetryDelays: [0, 3000, 5000, 10000, 20000],
});

export const HERO_GUIDANCE = Object.freeze([
  'Landscape 16:9',
  '10–20 seconds',
  'MP4 (H.264) preferred; WebM optional',
  'Muted / no audio needed',
  '1920×1080 maximum recommended',
  'Under 20 MB recommended',
]);

/** Object-path building blocks. Every path starts with the owner's uid. */
export const STORAGE_FOLDERS = Object.freeze({
  gallery: 'gallery',
  hero: 'hero',
  profile: 'profile',
  seo: 'seo',
});

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}
