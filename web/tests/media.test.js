import { describe, expect, it } from 'vitest';
import {
  buildObjectPath,
  checkVideoMetadata,
  coverCrop,
  isOwnedPath,
  readImageSize,
  sniffBytes,
  stripJpegMetadata,
  targetSize,
  titleFromFilename,
  validateImage,
  validateVideo,
} from '../src/lib/media.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ITEM = '22222222-2222-4222-8222-222222222222';
const bytes = (...parts) => Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
const pad = (arr, n) => Uint8Array.from([...arr, ...new Array(Math.max(0, n - arr.length)).fill(0)]);

// Minimal but structurally valid headers.
const jpeg = (w, h) => pad(bytes([0xff, 0xd8], [0xff, 0xe0, 0x00, 0x10], 'JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xc0, 0x00, 0x11, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], [0xff, 0xda]), 64);
const png = (w, h) => pad(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], 'IHDR', [w >>> 24, (w >> 16) & 255, (w >> 8) & 255, w & 255, h >>> 24, (h >> 16) & 255, (h >> 8) & 255, h & 255]), 32);
const webpX = (w, h) => pad(bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8X', [10, 0, 0, 0, 0, 0, 0, 0], [(w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255]), 40);
const heic = () => pad(bytes([0, 0, 0, 24], 'ftyp', 'heic', [0, 0, 0, 0]), 32);
const mp4 = () => pad(bytes([0, 0, 0, 32], 'ftyp', 'isom', [0, 0, 2, 0]), 32);
const webm = () => pad(bytes([0x1a, 0x45, 0xdf, 0xa3]), 32);
const exe = () => pad(bytes('MZ', [0x90, 0, 3, 0, 0, 0, 4, 0]), 32);

describe('sniffBytes', () => {
  it('identifies real formats from their magic numbers', () => {
    expect(sniffBytes(jpeg(800, 600))).toBe('jpeg');
    expect(sniffBytes(png(800, 600))).toBe('png');
    expect(sniffBytes(webpX(800, 600))).toBe('webp');
    expect(sniffBytes(mp4())).toBe('mp4');
    expect(sniffBytes(webm())).toBe('webm');
    expect(sniffBytes(heic())).toBe('heic');
  });
  it('does not confuse an executable, or a short/empty file, for an image', () => {
    expect(sniffBytes(exe())).toBe('unknown');
    expect(sniffBytes(new Uint8Array(4))).toBe('unknown');
    expect(sniffBytes(undefined)).toBe('unknown');
  });
});

describe('readImageSize (from the header, no decoding)', () => {
  it('reads JPEG, PNG and WebP dimensions', () => {
    expect(readImageSize(jpeg(4032, 3024))).toEqual({ width: 4032, height: 3024 });
    expect(readImageSize(png(1200, 800))).toEqual({ width: 1200, height: 800 });
    expect(readImageSize(webpX(1600, 900))).toEqual({ width: 1600, height: 900 });
  });
  it('returns null when it cannot tell', () => {
    expect(readImageSize(exe())).toBeNull();
  });
});

describe('validateImage', () => {
  const ok = (over = {}) => ({ name: 'cut.jpg', size: 2_000_000, type: 'image/jpeg', ...over });
  it('accepts a normal phone photo', () => {
    expect(validateImage(ok(), 'jpeg', { width: 3000, height: 4000 })).toEqual({ ok: true });
  });
  it('explains HEIC instead of failing silently', () => {
    const r = validateImage(ok({ name: 'IMG_1.HEIC', type: 'image/heic' }), 'heic', { width: 3000, height: 4000 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('heic');
    expect(r.message).toMatch(/Most Compatible/);
  });
  it('rejects a renamed executable', () => {
    const r = validateImage(ok({ name: 'photo.jpg', type: 'application/x-msdownload' }), 'unknown', null);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('type');
  });
  it('rejects a non-image MIME type even when the bytes look like an image', () => {
    expect(validateImage(ok({ type: 'application/octet-stream' }), 'jpeg', { width: 1000, height: 1000 }).ok).toBe(false);
  });
  it('accepts real JPEG bytes that the phone labelled image/heic', () => {
    expect(validateImage(ok({ type: 'image/heic' }), 'jpeg', { width: 3000, height: 4000 }).ok).toBe(true);
  });
  it('rejects GIFs, oversized files, tiny and gigantic images', () => {
    expect(validateImage(ok(), 'gif', null).code).toBe('gif');
    expect(validateImage(ok({ size: 30 * 1024 * 1024 }), 'jpeg', { width: 3000, height: 4000 }).code).toBe('too-big');
    expect(validateImage(ok(), 'jpeg', { width: 200, height: 300 }).code).toBe('too-small');
    expect(validateImage(ok(), 'jpeg', { width: 20000, height: 20000 }).code).toBe('too-large-dimensions');
    expect(validateImage(ok(), 'jpeg', null).code).toBe('unreadable');
  });
});

describe('validateVideo', () => {
  const file = (over = {}) => ({ name: 'hero.mp4', size: 8 * 1024 * 1024, type: 'video/mp4', ...over });
  it('accepts an MP4 or WebM', () => {
    expect(validateVideo(file(), 'mp4')).toEqual({ ok: true, warnings: [] });
    expect(validateVideo(file({ name: 'a.webm', type: 'video/webm' }), 'webm').ok).toBe(true);
  });
  it('warns above the recommended size but allows it', () => {
    const r = validateVideo(file({ size: 30 * 1024 * 1024 }), 'mp4');
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatch(/faster/);
  });
  it('rejects a video over the hard limit with advice on shrinking it', () => {
    const r = validateVideo(file({ size: 80 * 1024 * 1024 }), 'mp4');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Shorten|compress/i);
  });
  it('explains iPhone .MOV files', () => {
    const r = validateVideo(file({ name: 'clip.MOV', type: 'video/quicktime' }), 'unknown');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Most Compatible|MP4/);
  });
  it('rejects a non-video', () => {
    expect(validateVideo(file({ name: 'x.mp4' }), 'unknown').ok).toBe(false);
  });
  it('uses the smaller clip limits for portfolio videos', () => {
    expect(validateVideo(file({ size: 40 * 1024 * 1024 }), 'mp4', 'clip').ok).toBe(false);
  });
});

describe('checkVideoMetadata', () => {
  it('rejects videos that are far too long', () => {
    expect(checkVideoMetadata({ duration: 120, width: 1920, height: 1080 }, 'hero').ok).toBe(false);
  });
  it('gives friendly guidance for vertical or long-ish hero videos', () => {
    const r = checkVideoMetadata({ duration: 25, width: 1080, height: 1920 }, 'hero');
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/vertical/);
    expect(r.warnings.join(' ')).toMatch(/seconds/);
  });
  it('is quiet for a good hero video', () => {
    expect(checkVideoMetadata({ duration: 12, width: 1920, height: 1080 }, 'hero')).toEqual({ ok: true, warnings: [] });
  });
});

describe('stripJpegMetadata (GPS/EXIF removal fallback)', () => {
  const seg = (marker, payload) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload];
  const text = (s) => [...s].map((c) => c.charCodeAt(0));
  const file = Uint8Array.from([
    0xff, 0xd8,
    ...seg(0xe1, text('Exif\0\0GPSLatitude=40.7')), // EXIF with location
    ...seg(0xe2, text('ICC_PROFILE\0')), // colour profile: kept
    ...seg(0xfe, text('comment')),
    ...seg(0xc0, [8, 0, 10, 0, 10, 1, 1, 0x11, 0]),
    0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 1, 2, 3, 0xff, 0xd9,
  ]);
  const out = stripJpegMetadata(file);
  const asText = String.fromCharCode(...out);
  it('removes EXIF/GPS and comments', () => {
    expect(asText).not.toContain('GPSLatitude');
    expect(asText).not.toContain('Exif');
    expect(asText).not.toContain('comment');
  });
  it('keeps the colour profile, the image structure and the pixel data', () => {
    expect(asText).toContain('ICC_PROFILE');
    expect(Array.from(out.slice(0, 2))).toEqual([0xff, 0xd8]);
    expect(Array.from(out.slice(-2))).toEqual([0xff, 0xd9]);
    expect(out.length).toBeLessThan(file.length);
  });
  it('leaves non-JPEG data alone', () => {
    const p = png(10, 10);
    expect(stripJpegMetadata(p)).toBe(p);
  });
});

describe('sizes and crops', () => {
  it('scales to the longest side and never enlarges', () => {
    expect(targetSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(targetSize(3000, 4000, 800)).toEqual({ width: 600, height: 800 });
    expect(targetSize(500, 400, 2000)).toEqual({ width: 500, height: 400 });
  });
  it('centre-crops to a target aspect ratio', () => {
    expect(coverCrop(2000, 1000, 1200, 630)).toEqual({ sx: 48, sy: 0, sw: 1905, sh: 1000 });
    const c = coverCrop(1000, 2000, 1200, 630);
    expect(c.sw).toBe(1000);
    expect(Math.abs(c.sw / c.sh - 1200 / 630)).toBeLessThan(0.01);
  });
});

describe('object paths', () => {
  it('builds owner-scoped, collision-proof gallery paths', () => {
    const p = buildObjectPath(OWNER, 'gallery', { itemId: ITEM, name: 'card', mime: 'image/webp', token: 'abc' });
    expect(p).toBe(`${OWNER}/gallery/${ITEM}/abc-card.webp`);
    const a = buildObjectPath(OWNER, 'hero', { name: 'hero', mime: 'video/mp4' });
    const b = buildObjectPath(OWNER, 'hero', { name: 'hero', mime: 'video/mp4' });
    expect(a).not.toBe(b);
    expect(a).toMatch(new RegExp(`^${OWNER}/hero/[0-9a-f-]{36}-hero\\.mp4$`));
  });
  it('never uses the visitor-supplied file name', () => {
    expect(() => buildObjectPath(OWNER, 'hero', { name: '../../etc/passwd', mime: 'video/mp4' })).toThrow();
    expect(() => buildObjectPath(OWNER, 'gallery', { name: 'card', mime: 'image/webp' })).toThrow(/item id/);
    expect(() => buildObjectPath('not-a-uuid', 'hero', { name: 'hero', mime: 'video/mp4' })).toThrow();
    expect(() => buildObjectPath(OWNER, 'other', { name: 'hero', mime: 'video/mp4' })).toThrow(/folder/);
  });
  it('recognises only paths inside the owner folder', () => {
    expect(isOwnedPath(OWNER, `${OWNER}/hero/x.mp4`)).toBe(true);
    expect(isOwnedPath(OWNER, `someone-else/hero/x.mp4`)).toBe(false);
    expect(isOwnedPath(OWNER, `${OWNER}/../x`)).toBe(false);
    expect(isOwnedPath(OWNER, null)).toBe(false);
  });
});

describe('titleFromFilename', () => {
  it('makes a readable starting title', () => {
    expect(titleFromFilename('IMG_2041-fade_low.JPG')).toBe('IMG 2041 fade low');
    expect(titleFromFilename('a'.repeat(300) + '.jpg').length).toBe(120);
  });
});
