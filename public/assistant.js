(() => {
  'use strict';
  const assistant = document.getElementById('floriva-assistant');
  if (!assistant) return;
  const launcher = assistant.querySelector('.floriva-assistant-launcher');
  const panel = assistant.querySelector('.floriva-assistant-panel');
  const close = assistant.querySelector('[data-assistant-close]');
  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    assistant.toggleAttribute('data-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Minimize Floriva chat' : 'Open Floriva chat');
    if (open) close.focus({ preventScroll: true });
    else if (restoreFocus) launcher.focus({ preventScroll: true });
  }
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false, true));
  assistant.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, true);
    }
  });
})();
