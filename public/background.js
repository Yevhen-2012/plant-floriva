(() => {
  'use strict';
  const background = document.querySelector('img.background-img[data-plant-background-src]');
  if (!background) return;

  const desktop = window.matchMedia('(min-width: 992px)');
  const connection = navigator.connection;
  let pageLoaded = document.readyState === 'complete';
  let scheduled = false;
  let started = false;
  const eligible = () => desktop.matches && !document.hidden && !connection?.saveData &&
    !['slow-2g', '2g'].includes(connection?.effectiveType);

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
      if (!eligible()) { started = false; return; }

      const image = new Image();
      image.className = 'background-img plant-background-hires';
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.width = 3840;
      image.height = 1920;
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
    // Let the first screen paint, then use an idle slot with a bounded wait.
    window.setTimeout(() => {
      if (window.requestIdleCallback) window.requestIdleCallback(upgrade, { timeout: 2000 });
      else upgrade();
    }, 300);
  };
  window.addEventListener('load', () => { pageLoaded = true; schedule(); }, { once: true });
  document.addEventListener('visibilitychange', schedule);
  desktop.addEventListener('change', schedule);
  connection?.addEventListener('change', schedule);
  schedule();
})();
