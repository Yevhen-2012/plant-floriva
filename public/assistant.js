(() => {
  'use strict';
  const assistant = document.getElementById('floriva-assistant');
  if (!assistant) return;
  const launcher = assistant.querySelector('.floriva-assistant-launcher');
  const panel = assistant.querySelector('.floriva-assistant-panel');
  const close = assistant.querySelector('[data-assistant-close]');
  const restart = assistant.querySelector('[data-assistant-new]');
  const reconnect = assistant.querySelector('[data-assistant-retry]');
  const content = assistant.querySelector('.floriva-assistant-content');
  const form = assistant.querySelector('form');
  const input = form.querySelector('input');
  const send = form.querySelector('button');
  const status = assistant.querySelector('[data-assistant-status]');
  const api = assistant.dataset.apiUrl;
  const storageKey = 'floriva.website.session.v1';
  let token = '';
  try { token = sessionStorage.getItem(storageKey) || ''; } catch { /* Session stays in memory if storage is unavailable. */ }
  let connected = false;
  let busy = false;
  let messages = [];
  let uncertainMessage = '';

  function saveToken(value) {
    token = value;
    try {
      if (value) sessionStorage.setItem(storageKey, value);
      else sessionStorage.removeItem(storageKey);
    } catch { /* Storage restrictions do not prevent chatting. */ }
  }

  function controls() {
    input.disabled = send.disabled = restart.disabled = busy || !connected;
    reconnect.disabled = busy;
    content.setAttribute('aria-busy', String(busy));
  }

  function showStatus(text, retry = false) {
    status.textContent = text;
    reconnect.hidden = !retry;
  }

  function render(history) {
    const fragment = document.createDocumentFragment();
    for (const message of history) {
      if (!['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') continue;
      const bubble = document.createElement('div');
      bubble.className = 'floriva-assistant-message';
      bubble.dataset.role = message.role;
      const speaker = document.createElement('span');
      speaker.className = 'floriva-assistant-speaker';
      speaker.textContent = message.role === 'user' ? 'You' : 'Floriva';
      const text = document.createElement('p');
      // Replies are untrusted text, never injected HTML or executable Markdown.
      text.textContent = message.content;
      bubble.append(speaker, text);
      fragment.append(bubble);
    }
    content.replaceChildren(fragment);
    content.scrollTop = content.scrollHeight;
  }

  async function request(path, { method = 'POST', body = {}, timeout = 90000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (method === 'POST') headers['Content-Type'] = 'application/json';
      const response = await fetch(api + path, {
        method, headers, mode: 'cors', credentials: 'omit', cache: 'no-store',
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(typeof data.detail === 'string' ? data.detail : 'Chat is temporarily unavailable. Please try again later.');
        error.status = response.status;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function connect() {
    if (busy || connected) return;
    busy = true;
    controls();
    showStatus('Connecting to Floriva… The first connection may take a moment.');
    try {
      let data;
      try { data = await request('/session'); }
      catch (error) {
        if (error.status !== 401) throw error;
        saveToken('');
        data = await request('/session');
      }
      if (typeof data.token !== 'string' || !Array.isArray(data.messages)) throw new Error('Could not load this conversation.');
      saveToken(data.token);
      messages = data.messages;
      // A timed-out request may already have completed on the server. Restore
      // its saved reply instead of resending a message or confirming twice.
      const lastUser = messages.findLast(message => message.role === 'user');
      if (uncertainMessage && lastUser?.content === uncertainMessage) input.value = '';
      uncertainMessage = '';
      render(messages);
      connected = true;
      showStatus('Replies in English · Requests need your confirmation.');
    } catch (error) {
      showStatus(error.status ? error.message : 'Could not connect to Floriva. Please reconnect in a moment.', true);
    } finally {
      busy = false;
      controls();
      if (connected && !panel.hidden) input.focus({ preventScroll: true });
    }
  }

  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    assistant.toggleAttribute('data-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Minimize Floriva chat' : 'Open Floriva chat');
    if (open) {
      (connected && !busy ? input : close).focus({ preventScroll: true });
      void connect();
    }
    else if (restoreFocus) launcher.focus({ preventScroll: true });
  }
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false, true));
  reconnect.addEventListener('click', connect);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || message.length > 2000 || busy || !connected) return;
    busy = true;
    controls();
    input.value = '';
    render([...messages, { role: 'user', content: message }]);
    showStatus('Floriva is thinking…');
    try {
      const data = await request('/message', { body: { message }, timeout: 300000 });
      if (!Array.isArray(data.messages)) throw new Error('Could not load the reply.');
      messages = data.messages;
      render(messages);
      showStatus('Replies in English · Requests need your confirmation.');
    } catch (error) {
      connected = false;
      uncertainMessage = message;
      input.value = message;
      if (error.status === 401) saveToken('');
      const detail = error.status ? error.message : 'The connection was interrupted.';
      showStatus(`${detail} Reconnect to refresh your conversation before sending again.`, true);
    } finally {
      busy = false;
      controls();
      if (connected && !panel.hidden) input.focus({ preventScroll: true });
    }
  });

  restart.addEventListener('click', async () => {
    if (busy || !connected) return;
    busy = true;
    controls();
    showStatus('Starting a new conversation…');
    try {
      const data = await request('/new');
      if (!Array.isArray(data.messages)) throw new Error('Could not start a new conversation.');
      messages = data.messages;
      input.value = '';
      render(messages);
      showStatus('Replies in English · Requests need your confirmation.');
    } catch (error) {
      connected = false;
      if (error.status === 401) saveToken('');
      showStatus(error.status ? error.message : 'Could not start a new conversation. Reconnect to refresh the chat.', true);
    } finally {
      busy = false;
      controls();
      if (connected && !panel.hidden) input.focus({ preventScroll: true });
    }
  });
  assistant.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, true);
    }
  });
})();
