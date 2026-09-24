/**
 * Hero video: respects prefers-reduced-motion (shows the poster instead of
 * autoplaying), falls back to a static image only if the video is genuinely
 * missing/unsupported, and exposes a visible play/pause control.
 *
 * Mobile browsers reject autoplay far more often than desktop (iOS Low
 * Power Mode, Android Data Saver, or simply not yet trusting the page) even
 * with muted+playsinline set correctly — that's expected, not a broken
 * video. When that happens we must NOT hide the play button along with the
 * video, or there's no way left to ever start it. The <video> keeps
 * showing its poster attribute (visually identical to the dedicated
 * fallback image) and the toggle stays live so a real tap — which counts
 * as a user gesture — can start playback.
 */
export function initHeroVideo() {
  const video = document.querySelector('[data-hero-video]');
  const fallback = document.querySelector('[data-hero-fallback]');
  const toggle = document.querySelector('[data-hero-toggle]');
  if (!video) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showBrokenVideoFallback() {
    // Only for a genuinely unplayable video (bad file, unsupported codec,
    // network failure) — swaps to a plain static image with no play control,
    // since there is nothing a tap could do at that point.
    video.classList.add('hidden');
    fallback?.classList.remove('hidden');
    toggle?.classList.add('hidden');
  }

  function setToggleState(isPlaying) {
    if (!toggle) return;
    const iconPause = toggle.querySelector('[data-icon-pause]');
    const iconPlay = toggle.querySelector('[data-icon-play]');
    toggle.setAttribute('aria-label', isPlaying ? 'Pause background video' : 'Play background video');
    toggle.setAttribute('aria-pressed', String(!isPlaying));
    iconPause?.classList.toggle('hidden', !isPlaying);
    iconPlay?.classList.toggle('hidden', isPlaying);
  }

  if (prefersReducedMotion) {
    video.removeAttribute('autoplay');
    video.pause();
    setToggleState(false);
    return;
  }

  video.addEventListener('error', showBrokenVideoFallback, true);

  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      // Autoplay was blocked (very common on mobile) — not a broken video.
      // Leave it as a tappable, paused video showing its poster frame.
      setToggleState(false);
    });
  }

  if (!toggle) return;

  toggle.addEventListener('click', () => {
    if (video.paused) {
      video.play().then(() => setToggleState(true)).catch(showBrokenVideoFallback);
    } else {
      video.pause();
      setToggleState(false);
    }
  });
}
