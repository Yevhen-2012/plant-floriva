(() => {
  'use strict';
  const video = document.querySelector('video[data-plant-video]');
  if (!video) return;
  const wrapper = video.closest('.demo-video-wrapper');
  const close = wrapper.querySelector('.video-close-button');
  const control = wrapper.querySelector('[data-w-bg-video-control]');
  const syncControl = () => {
    if (!control) return;
    const icons = control.querySelectorAll(':scope > span');
    if (icons[0]) icons[0].hidden = video.paused;
    if (icons[1]) icons[1].hidden = !video.paused;
    control.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
  };
  video.addEventListener('play', syncControl);
  video.addEventListener('pause', syncControl);
  syncControl();
  let open = false;
  document.querySelector('.video-link')?.addEventListener('click', () => {
    open = true;
    if (!video.dataset.loaded) {
      video.querySelectorAll('source[data-plant-src]').forEach(source => {
        source.src = source.dataset.plantSrc;
        delete source.dataset.plantSrc;
      });
      video.dataset.loaded = 'true';
      video.load();
    }
    video.muted = true;
    video.play().then(() => { if (!open) video.pause(); }).catch(() => {
      if (open) video.controls = true;
    });
  });
  close?.addEventListener('click', () => {
    open = false;
    video.pause();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) close?.click();
  });
})();
