import { h, mount, setVisible, svgIcon } from '../lib/dom.js';
import { filterItems, visibleCategories } from '../lib/content.js';

/**
 * Portfolio grid, category filters and lightbox.
 *
 * Everything from the database is rendered as text or as a validated URL
 * attribute (see lib/dom.js), never as HTML. Each card is a real link to the
 * full image, so the gallery still works if the lightbox script fails.
 */

const PLAY_ICON = 'M8 5v14l11-7z';
const HASH_PREFIX = '#work/';

/** "#work/<id>" is a shareable link that opens one piece of work in the viewer. */
export function workHash(id) {
  return `${HASH_PREFIX}${encodeURIComponent(id)}`;
}

/** The item id in a "#work/<id>" hash, or '' for any other hash. */
export function idFromHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(HASH_PREFIX)) return '';
  try {
    return decodeURIComponent(hash.slice(HASH_PREFIX.length));
  } catch {
    return '';
  }
}

// Every card in a grid has the same shape so rows line up evenly; photos are
// cropped to fill it (object-cover) and open uncropped in the viewer.
const PHOTO_SHAPE = 'aspect-[4/5]';
const VIDEO_SHAPE = 'aspect-[9/16]';

function img(view, alt, { eager = false } = {}) {
  return h('img', {
    src: view.thumb,
    // The card variant (<=800px) for grid tiles, the full variant on large or dense screens.
    srcset: view.thumb !== view.full && view.thumbWidth && view.width ? `${view.thumb} ${view.thumbWidth}w, ${view.full} ${view.width}w` : null,
    sizes: '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
    alt,
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    width: view.thumbWidth ?? view.width,
    height: view.thumbHeight ?? view.height,
    class: 'h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]',
  });
}

function label(text, extra) {
  return h('span', { class: `absolute bottom-2 left-2 text-[11px] uppercase tracking-wide px-2 py-1 ${extra}` }, text);
}

function card(item, index) {
  const title = h('span', { class: 'block py-2 text-sm font-medium' }, item.title);
  const base = { class: 'gallery-figure group', dataset: { galleryItem: '', id: item.id } };

  if (item.kind === 'transformation') {
    return h(
      'a',
      { ...base, href: item.after.full, class: 'gallery-figure group col-span-2' },
      h(
        'span',
        { class: 'grid grid-cols-2 gap-0.5' },
        h('span', { class: `relative block ${PHOTO_SHAPE} overflow-hidden` }, img(item.before, `${item.altText} — before`), label('Before', 'bg-ink/85 text-ivory')),
        h('span', { class: `relative block ${PHOTO_SHAPE} overflow-hidden` }, img(item.after, `${item.altText} — after`), label('After', 'bg-copper-dark text-ivory')),
      ),
      title,
    );
  }

  if (item.kind === 'video') {
    // Videos play right in the grid (no pop-up). Nothing downloads until the
    // visitor taps play: preload="none" with the poster as the cover.
    const video = h(
      'video',
      { poster: item.video.poster, preload: 'none', playsinline: true, class: 'h-full w-full object-cover bg-ink', 'aria-label': item.altText || item.title, dataset: { inlineVideo: '' } },
      h('source', { src: item.video.full, type: item.video.mime }),
    );
    const play = h(
      'button',
      { type: 'button', class: 'absolute inset-0 flex items-center justify-center', 'aria-label': `Play video: ${item.title}`, dataset: { inlinePlay: '' } },
      h('span', { class: 'flex h-14 w-14 items-center justify-center rounded-full bg-ink/70 text-ivory transition-transform group-hover:scale-110' }, svgIcon(PLAY_ICON, { size: 22, fill: 'currentColor', strokeWidth: 0 })),
    );
    return h(
      'div',
      { class: 'gallery-figure group', dataset: { videoItem: '', id: item.id } },
      h('span', { class: `relative block ${VIDEO_SHAPE} overflow-hidden bg-ink` }, video, play),
      title,
    );
  }

  const view = item.image;
  return h(
    'a',
    { ...base, href: view.full },
    h(
      'span',
      { class: `relative block ${PHOTO_SHAPE} overflow-hidden` },
      img(view, item.altText, { eager: index < 2 }),
      item.featured ? h('span', { class: 'sr-only' }, 'Featured work') : null,
    ),
    title,
  );
}

/**
 * @param {{ items: any[], categories: any[], settings: Record<string, any>, onRender?: (root: HTMLElement) => void }} ctx
 */
export function initGallery({ items, categories, settings, onRender }) {
  const grid = document.querySelector('[data-gallery-grid]');
  const videoGrid = document.querySelector('[data-video-grid]');
  const videoBlock = document.querySelector('[data-video-block]');
  const section = grid?.closest('section') ?? document;
  const filters = document.querySelector('[data-gallery-filters]');
  const status = document.querySelector('[data-gallery-status]');
  const emptyMsg = document.querySelector('[data-gallery-empty]');
  if (!grid) return;

  if (items.length === 0) {
    grid.replaceChildren();
    setVisible(grid, false);
    setVisible(videoBlock, false);
    setVisible(filters, false);
    setVisible(emptyMsg, true);
    return;
  }
  setVisible(emptyMsg, false);
  setVisible(grid, true);

  let active = 'all';
  let current = items;

  // The pop-up viewer is for photos; videos play in place in the grid.
  const viewable = () => current.filter((i) => i.kind !== 'video');
  const lightbox = createLightbox(viewable);

  function render() {
    current = filterItems(items, active);
    const photos = current.filter((i) => i.kind !== 'video');
    const videos = current.filter((i) => i.kind === 'video');
    mount(grid, photos.map((item, i) => card(item, i)));
    setVisible(grid, photos.length > 0);
    if (videoGrid) {
      mount(videoGrid, videos.map((item, i) => card(item, i)));
      setVisible(videoBlock, videos.length > 0);
    }
    onRender?.(section);
    if (status) {
      const parts = [photos.length && `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`, videos.length && `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`].filter(Boolean);
      status.textContent = `Showing ${parts.join(' and ')}`;
    }
  }

  const cats = visibleCategories(categories, items);
  if (filters && cats.length > 0) {
    const options = [{ slug: 'all', name: settings.gallery_all_label }, ...cats];
    mount(
      filters,
      options.map((c) =>
        h(
          'button',
          {
            type: 'button',
            class: 'filter-pill',
            'aria-pressed': String(c.slug === active),
            dataset: { filter: c.slug },
            onClick: () => setFilter(c.slug),
          },
          c.name,
        ),
      ),
    );
    setVisible(filters, true);
  } else {
    setVisible(filters, false);
  }

  if (videoGrid) initInlineVideos(videoGrid);

  // One delegated handler survives every re-render.
  grid.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('[data-gallery-item]') : null;
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // let "open in new tab" work
    event.preventDefault();
    const index = viewable().findIndex((i) => i.id === link.dataset.id);
    if (index >= 0) lightbox.open(index, link);
  });

  function setFilter(slug) {
    active = slug;
    for (const b of filters?.querySelectorAll('[data-filter]') ?? []) b.setAttribute('aria-pressed', String(b.dataset.filter === active));
    render();
  }

  /** Open the item named in a shared "#work/<id>" link, if it exists. */
  function openFromHash() {
    const id = idFromHash(location.hash);
    if (!id || lightbox.isOpen()) return;
    if (!items.some((i) => i.id === id)) return;
    if (!current.some((i) => i.id === id)) setFilter('all');
    const el = section.querySelector(`[data-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: 'center' });
    // A shared video link just brings the clip into view, ready to play.
    if (el?.hasAttribute('data-video-item')) {
      el.querySelector('[data-inline-play]')?.focus({ preventScroll: true });
      return;
    }
    const index = viewable().findIndex((i) => i.id === id);
    if (index >= 0) lightbox.open(index, el);
  }

  render();
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
}

/**
 * Tap-to-play videos inside the grid. Only one plays at a time, a video that
 * scrolls out of view pauses, and when it ends the cover and play button
 * come back. While playing, the whole frame is shown (no cropping).
 */
function initInlineVideos(grid) {
  const reset = (video) => {
    video.controls = false;
    video.classList.replace('object-contain', 'object-cover');
    video.parentElement?.querySelector('[data-inline-play]')?.classList.remove('hidden');
  };
  const pauseOthers = (except) => {
    for (const v of grid.querySelectorAll('[data-inline-video]')) if (v !== except && !v.paused) v.pause();
  };
  const offscreen = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) if (!e.isIntersecting && !e.target.paused) e.target.pause();
    }, { threshold: 0.25 })
    : null;

  grid.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-inline-play]') : null;
    if (!button) return;
    const video = button.parentElement?.querySelector('[data-inline-video]');
    if (!video) return;
    pauseOthers(video);
    button.classList.add('hidden');
    video.controls = true;
    video.classList.replace('object-cover', 'object-contain');
    offscreen?.observe(video);
    video.play().catch(() => {
      // Autoplay with sound refused (rare after a tap): leave the native controls showing.
    });
    video.focus({ preventScroll: true });
  });
  // "ended" and "play" don't bubble: listen in the capture phase.
  grid.addEventListener('play', (event) => pauseOthers(event.target), true);
  grid.addEventListener('ended', (event) => {
    const video = event.target;
    reset(video);
    video.load(); // back to the cover image
  }, true);
}

function createLightbox(getItems) {
  const root = document.querySelector('[data-lightbox]');
  if (!root) return { open() {}, isOpen: () => false };

  const media = root.querySelector('[data-lightbox-media]');
  const caption = root.querySelector('[data-lightbox-caption]');
  const detail = root.querySelector('[data-lightbox-detail]');
  const counter = root.querySelector('[data-lightbox-counter]');
  const closeBtn = root.querySelector('[data-lightbox-close]');
  const prevBtn = root.querySelector('[data-lightbox-prev]');
  const nextBtn = root.querySelector('[data-lightbox-next]');
  const backdropFlex = root.querySelector(':scope > div');

  let index = 0;
  let opener = null;
  let touchX = null;
  let inertNodes = [];
  let isOpen = false;
  let returnHash = '';

  const lbImg = (view, alt) => h('img', { src: view.full, alt, class: 'max-h-[70vh] w-auto max-w-full object-contain', decoding: 'async' });
  const tagged = (node, text, cls) => h('div', { class: 'relative' }, node, h('span', { class: `absolute bottom-2 left-2 text-xs uppercase tracking-wide px-2 py-1 ${cls}` }, text));

  function show() {
    const items = getItems();
    const item = items[index];
    if (!item) return;
    stopVideo();
    if (item.kind === 'transformation') {
      mount(
        media,
        h(
          'div',
          { class: 'flex gap-2 max-h-[70vh]' },
          tagged(lbImg(item.before, `${item.altText} — before`), 'Before', 'bg-ink/85 text-ivory'),
          tagged(lbImg(item.after, `${item.altText} — after`), 'After', 'bg-copper-dark text-ivory'),
        ),
      );
    } else if (item.kind === 'video') {
      mount(
        media,
        h(
          'video',
          { controls: true, playsinline: true, preload: 'metadata', poster: item.video.poster, class: 'max-h-[70vh] max-w-full', 'aria-label': item.altText || item.title },
          h('source', { src: item.video.full, type: item.video.mime }),
        ),
      );
    } else {
      mount(media, lbImg(item.image, item.altText));
    }
    caption.textContent = item.title;
    detail.textContent = [item.serviceLabel, item.description].filter(Boolean).join(' · ');
    setVisible(detail, Boolean(detail.textContent));
    const single = items.length < 2;
    setVisible(prevBtn, !single);
    setVisible(nextBtn, !single);
    if (counter) counter.textContent = single ? '' : `${index + 1} / ${items.length}`;
    // Keep the address bar pointing at this piece so it can be copied and shared.
    // replaceState: no history entry per image, and no "hashchange" loop.
    history.replaceState(history.state, '', workHash(item.id));
    if (!single) {
      preload(items[(index + 1) % items.length]);
      preload(items[(index - 1 + items.length) % items.length]);
    }
  }

  /** Warm the browser cache for a neighbour so Next/Previous feel instant. */
  function preload(item) {
    const views = item?.kind === 'transformation' ? [item.before, item.after] : item?.kind === 'image' ? [item.image] : [];
    for (const v of views) {
      const pre = new Image();
      pre.decoding = 'async';
      pre.src = v.full;
    }
  }

  function stopVideo() {
    for (const v of media.querySelectorAll('video')) v.pause();
  }

  function open(i, trigger) {
    index = i;
    isOpen = true;
    returnHash = idFromHash(location.hash) ? '#work' : location.hash;
    opener = trigger;
    show();
    setVisible(root, true);
    document.body.classList.add('overflow-hidden');
    // Everything behind the dialog becomes inert, so keyboard and screen-reader
    // users cannot wander into the page underneath.
    inertNodes = [...document.body.children].filter((el) => el !== root && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName));
    for (const el of inertNodes) el.setAttribute('inert', '');
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    stopVideo();
    history.replaceState(history.state, '', `${location.pathname}${location.search}${returnHash}`);
    setVisible(root, false);
    document.body.classList.remove('overflow-hidden');
    for (const el of inertNodes) el.removeAttribute('inert');
    inertNodes = [];
    document.removeEventListener('keydown', onKey);
    // The grid may have been re-rendered while open; find the card again by id.
    const id = getItems()[index]?.id;
    const target = (id && document.querySelector(`[data-gallery-item][data-id="${CSS.escape(id)}"]`)) || opener;
    if (target instanceof HTMLElement && document.contains(target)) target.focus();
  }

  function step(delta) {
    const n = getItems().length;
    if (n < 2) return;
    index = (index + delta + n) % n;
    show();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowRight') {
      step(1);
    } else if (event.key === 'ArrowLeft') {
      step(-1);
    } else if (event.key === 'Tab') {
      const focusable = [prevBtn, nextBtn, closeBtn, ...root.querySelectorAll('video[controls]')].filter((el) => el && !el.classList.contains('hidden'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  root.addEventListener('click', (event) => {
    // A click on the dark backdrop (not on media or buttons) closes.
    if (event.target === root || event.target === backdropFlex) close();
  });
  root.addEventListener('touchstart', (e) => (touchX = e.changedTouches[0].clientX), { passive: true });
  root.addEventListener(
    'touchend',
    (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  return { open, close, isOpen: () => isOpen };
}
