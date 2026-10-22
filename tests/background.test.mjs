import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await fs.readFile(new URL('../public/background.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup({ loaded = false, desktop = true, complete = true, hidden = false, saveData = false, effectiveType = '4g', idle = true } = {}) {
  const timers = [], idleTasks = [], frames = [], requests = [], layers = [];
  let resolveImage, rejectImage;
  const decoded = new Promise((resolve, reject) => { resolveImage = resolve; rejectImage = reject; });
  const background = Object.assign(new EventTarget(), {
    complete, naturalWidth: 1280, dataset: { plantBackgroundSrc: '../../assets/full.webp' },
    decode: async () => {}, after: image => layers.push(image)
  });
  const document = Object.assign(new EventTarget(), {
    readyState: loaded ? 'complete' : 'interactive', hidden,
    querySelector: () => background
  });
  const media = Object.assign(new EventTarget(), { matches: desktop });
  const connection = Object.assign(new EventTarget(), { saveData, effectiveType });
  const window = Object.assign(new EventTarget(), {
    matchMedia: () => media,
    setTimeout: callback => timers.push(callback),
    requestAnimationFrame: callback => frames.push(callback)
  });
  if (idle) window.requestIdleCallback = callback => idleTasks.push(callback);
  class Image {
    classList = new Set();
    setAttribute() {}
    set src(value) { requests.push({ value, priority: this.fetchPriority }); }
    decode() { return decoded; }
  }
  vm.runInNewContext(source, { document, window, navigator: { connection }, Image });
  return {
    background, document, media, connection, requests, layers, frames, resolveImage, rejectImage,
    load() { window.dispatchEvent(new Event('load')); },
    async runScheduled() {
      while (timers.length) timers.shift()();
      while (idleTasks.length) idleTasks.shift()();
      await settle();
    }
  };
}

test('waits for page and lightweight image, then fades in only after decoding', async () => {
  const page = setup({ complete: false });
  await page.runScheduled();
  assert.equal(page.requests.length, 0);
  page.load();
  await page.runScheduled();
  assert.equal(page.requests.length, 0);
  page.background.complete = true;
  page.background.dispatchEvent(new Event('load'));
  await settle();
  assert.deepEqual(page.requests, [{ value: '../../assets/full.webp', priority: 'low' }]);
  assert.equal(page.layers.length, 0);
  page.resolveImage();
  await settle();
  assert.equal(page.layers.length, 1);
  assert.equal(page.layers[0].classList.has('is-ready'), false);
  page.frames.shift()();
  assert.equal(page.layers[0].classList.has('is-ready'), false);
  page.frames.shift()();
  assert.equal(page.layers[0].classList.has('is-ready'), true);
  page.document.dispatchEvent(new Event('visibilitychange'));
  page.media.dispatchEvent(new Event('change'));
  await page.runScheduled();
  assert.equal(page.requests.length, 1);
});

for (const [reason, options] of [
  ['mobile', { desktop: false }],
  ['data saver', { saveData: true }],
  ['slow connection', { effectiveType: '2g' }],
  ['hidden tab', { hidden: true }]
]) {
  test(`does not request the large image on ${reason}`, async () => {
    const page = setup({ loaded: true, ...options });
    await page.runScheduled();
    assert.equal(page.requests.length, 0);
  });
}

test('can upgrade after switching from mobile to desktop', async () => {
  const page = setup({ loaded: true, desktop: false });
  page.media.matches = true;
  page.media.dispatchEvent(new Event('change'));
  await page.runScheduled();
  assert.equal(page.requests.length, 1);
});

test('keeps the original layer if the full image fails to load or decode', async () => {
  const page = setup({ loaded: true });
  await page.runScheduled();
  page.rejectImage(new Error('Network failure'));
  await settle();
  assert.equal(page.layers.length, 0);
});

test('works without requestIdleCallback and rechecks conditions before fetching', async () => {
  const page = setup({ loaded: true, complete: false, idle: false });
  await page.runScheduled();
  page.connection.saveData = true;
  page.background.complete = true;
  page.background.dispatchEvent(new Event('load'));
  await settle();
  assert.equal(page.requests.length, 0);
  page.connection.saveData = false;
  page.connection.dispatchEvent(new Event('change'));
  await page.runScheduled();
  assert.equal(page.requests.length, 1);
});
