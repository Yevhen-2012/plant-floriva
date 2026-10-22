document.querySelectorAll('img[data-plant-background-src]').forEach(background => {
  'use strict';

  const viewport = window.matchMedia(background.dataset.plantBackgroundMedia || '(min-width: 992px)');
  const connection = navigator.connection;
  let pageLoaded = document.readyState === 'complete';
  let scheduled = false;
  let started = false;
  const eligible = () => viewport.matches && !document.hidden && !connection?.saveData &&
    !['slow-2g', '2g'].includes(connection?.effectiveType);

  const animationsPending = () => {
    const cssRunning = document.getAnimations?.().some(animation =>
      animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime));
    if (cssRunning) return true;
    const timeline = window.gsap?.globalTimeline;
    return timeline?.getChildren(true, true, false).some(tween => {
      if (tween.totalProgress() >= 1) return false;
      // Include delayed entrance tweens; ignore paused scroll reveals and loops.
      for (let animation = tween; animation && animation !== timeline; animation = animation.parent) {
        if (animation.paused() || animation.repeat() === -1 || animation.timeScale() === 0) return false;
      }
      return true;
    }) ?? false;
  };
  const waitForAnimations = async () => {
    let quietSince = performance.now();
    while (eligible()) {
      if (animationsPending()) quietSince = performance.now();
      else if (performance.now() - quietSince >= 500) return;
      // A quiet interval also catches chained animations that start later.
      await new Promise(resolve => window.setTimeout(resolve, 100));
    }
  };

  const upgrade = async () => {
    scheduled = false;
    if (started || !eligible()) return;
    started = true;
    try {
      // Lazy images may still be loading after the window's load event.
      if (!background.complete) {
        await new Promise((resolve, reject) => {
          const cleanup = () => {
            background.removeEventListener('load', onLoad);
            background.removeEventListener('error', onError);
          };
          const onLoad = () => { cleanup(); resolve(); };
          const onError = () => { cleanup(); reject(new Error('Background unavailable')); };
          background.addEventListener('load', onLoad);
          background.addEventListener('error', onError);
        });
      }
      if (!background.naturalWidth) return;
      await background.decode();
      await waitForAnimations();
      if (!eligible()) { started = false; return; }

      const image = new Image();
      image.className = `${background.className} plant-background-hires`;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.width = Number(background.dataset.plantBackgroundWidth || 3840);
      image.height = Number(background.dataset.plantBackgroundHeight || 1920);
      image.decoding = 'async';
      image.fetchPriority = 'low';
      image.src = background.dataset.plantBackgroundSrc;
      // Keep the original visible until the full image is ready to paint.
      await image.decode();
      background.after(image);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => image.classList.add('is-ready'));
      });
    } catch {
      // A failed request or decode leaves the original background in place.
    }
  };

  const schedule = () => {
    if (!pageLoaded || scheduled || started || !eligible()) return;
    scheduled = true;
    // After page load, let the first screen paint before checking animations.
    window.setTimeout(() => {
      if (window.requestIdleCallback) window.requestIdleCallback(upgrade, { timeout: 2000 });
      else upgrade();
    }, 300);
  };
  window.addEventListener('load', () => { pageLoaded = true; schedule(); }, { once: true });
  document.addEventListener('visibilitychange', schedule);
  viewport.addEventListener('change', schedule);
  connection?.addEventListener('change', schedule);
  schedule();
});
