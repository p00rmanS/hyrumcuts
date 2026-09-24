/**
 * Gallery filtering (client-side, instant) and an accessible lightbox with
 * keyboard navigation, a focus trap, and Escape-to-close. Every gallery item
 * is a real <a href="/image.jpg">, so without JavaScript the grid still
 * shows every photo and clicking one simply opens the image directly.
 */
export function initGallery() {
  const grid = document.querySelector('[data-gallery-grid]');
  const filterGroup = document.querySelector('[data-gallery-filters]');
  const lightbox = document.querySelector('[data-lightbox]');
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll('[data-gallery-item]'));

  // ---- Filtering ----------------------------------------------------
  if (filterGroup) {
    const buttons = Array.from(filterGroup.querySelectorAll('[data-filter]'));
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.filter;
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        items.forEach((item) => {
          const matches = filter === 'all' || item.dataset.category === filter;
          item.classList.toggle('hidden', !matches);
        });
      });
    });
  }

  if (!lightbox) return;

  // ---- Lightbox -------------------------------------------------------
  const mediaContainer = lightbox.querySelector('[data-lightbox-media]');
  const caption = lightbox.querySelector('[data-lightbox-caption]');
  const closeBtn = lightbox.querySelector('[data-lightbox-close]');
  const prevBtn = lightbox.querySelector('[data-lightbox-prev]');
  const nextBtn = lightbox.querySelector('[data-lightbox-next]');

  let currentIndex = -1;
  let lastFocused = null;

  function visibleItems() {
    return items.filter((item) => !item.classList.contains('hidden'));
  }

  function renderItem(item) {
    mediaContainer.innerHTML = '';
    if (item.hasAttribute('data-lightbox-transformation')) {
      const wrap = document.createElement('div');
      wrap.className = 'flex gap-2 max-h-[70vh]';
      [
        ['Before', item.dataset.before],
        ['After', item.dataset.after],
      ].forEach(([label, src]) => {
        const figure = document.createElement('div');
        figure.className = 'relative';
        const img = document.createElement('img');
        img.src = src;
        img.alt = `${item.dataset.caption || ''} — ${label}`;
        img.className = 'max-h-[70vh] w-auto object-contain';
        const tag = document.createElement('span');
        tag.textContent = label;
        tag.className = 'absolute bottom-2 left-2 bg-ink/80 text-ivory text-xs uppercase tracking-wide px-2 py-1';
        figure.appendChild(img);
        figure.appendChild(tag);
        wrap.appendChild(figure);
      });
      mediaContainer.appendChild(wrap);
    } else {
      const img = document.createElement('img');
      img.src = item.dataset.lightboxImage;
      img.alt = item.dataset.caption || '';
      img.className = 'max-h-[70vh] w-auto object-contain';
      mediaContainer.appendChild(img);
    }
    caption.textContent = item.dataset.caption || '';
  }

  function openAt(index) {
    const visible = visibleItems();
    if (visible.length === 0) return;
    currentIndex = (index + visible.length) % visible.length;
    renderItem(visible[currentIndex]);
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowRight') {
      openAt(currentIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      openAt(currentIndex - 1);
    } else if (event.key === 'Tab') {
      const focusable = [prevBtn, nextBtn, closeBtn].filter(Boolean);
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

  items.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      lastFocused = item;
      const visible = visibleItems();
      openAt(visible.indexOf(item));
    });
  });

  closeBtn?.addEventListener('click', close);
  prevBtn?.addEventListener('click', () => openAt(currentIndex - 1));
  nextBtn?.addEventListener('click', () => openAt(currentIndex + 1));
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) close();
  });
}
