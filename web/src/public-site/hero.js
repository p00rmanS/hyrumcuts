import { resolveHero } from '../lib/content.js';
import { setVisible } from '../lib/dom.js';

/**
 * Hero video.
 *
 *  - Starts as a plain dark hero with the heading text (fast, no layout shift).
 *  - Attaches the owner's video + poster once known (or the bundled fallbacks
 *    if Supabase is unreachable), then fades it in.
 *  - Never forces audio (always muted), never preloads more than metadata.
 *  - prefers-reduced-motion: shows the poster only; the play button lets the
 *    visitor start it deliberately.
 *  - Missing / blocked / broken video: falls back to the poster image.
 *  - An always-visible, keyboard-operable play/pause button.
 */
export function initHero(settings) {
  const video = document.querySelector('[data-hero-video]');
  const fallback = document.querySelector('[data-hero-fallback]');
  const toggle = document.querySelector('[data-hero-toggle]');
  if (!video) return;

  const hero = resolveHero(settings);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showPosterOnly() {
    video.classList.add('hidden');
    if (fallback) {
      fallback.src = hero.poster;
      fallback.classList.remove('hidden');
      requestAnimationFrame(() => fallback.classList.add('is-ready'));
    }
    setVisible(toggle, false);
  }

  function setToggleState(isPlaying) {
    if (!toggle) return;
    toggle.setAttribute('aria-label', isPlaying ? 'Pause background video' : 'Play background video');
    toggle.setAttribute('aria-pressed', String(!isPlaying));
    toggle.querySelector('[data-icon-pause]')?.classList.toggle('hidden', !isPlaying);
    toggle.querySelector('[data-icon-play]')?.classList.toggle('hidden', isPlaying);
  }

  // Broken or unsupported video: fall back to the poster with no dead controls.
  video.addEventListener('error', showPosterOnly, true);

  video.poster = hero.poster;
  video.muted = true;
  const source = document.createElement('source');
  source.src = hero.video;
  source.type = hero.video.endsWith('.webm') ? 'video/webm' : 'video/mp4';
  video.appendChild(source);
  video.load();
  requestAnimationFrame(() => video.classList.add('is-ready'));

  if (toggle) {
    setVisible(toggle, true);
    toggle.classList.add('flex');
  }

  if (reduceMotion) {
    video.removeAttribute('autoplay');
    setToggleState(false);
  } else {
    const attempt = video.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(() => setToggleState(true)).catch(() => {
        // Autoplay was refused (very common on mobile). That is not a broken
        // video: keep the poster and let a tap start it.
        setToggleState(false);
      });
    }
  }

  toggle?.addEventListener('click', () => {
    if (video.paused) {
      video.play().then(() => setToggleState(true)).catch(showPosterOnly);
    } else {
      video.pause();
      setToggleState(false);
    }
  });
}
