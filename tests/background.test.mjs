import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await fs.readFile(new URL('../public/background.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup({ loaded = false, desktop = true, complete = true, hidden = false, saveData = false, effectiveType = '4g', idle = true, animations = [], tweens = [] } = {}) {
  const timers = [], idleTasks = [], frames = [], requests = [], layers = [];
  let now = 0;
  let resolveImage, rejectImage;
  const decoded = new Promise((resolve, reject) => { resolveImage = resolve; rejectImage = reject; });
  const background = Object.assign(new EventTarget(), {
    complete, naturalWidth: 1280, dataset: { plantBackgroundSrc: '../../assets/full.webp' },
    decode: async () => {}, after: image => layers.push(image)
  });
  const document = Object.assign(new EventTarget(), {
    readyState: loaded ? 'complete' : 'interactive', hidden,
    querySelector: () => background, getAnimations: () => animations
  });
  const media = Object.assign(new EventTarget(), { matches: desktop });
  const connection = Object.assign(new EventTarget(), { saveData, effectiveType });
  const window = Object.assign(new EventTarget(), {
    matchMedia: () => media,
    setTimeout: (callback, delay) => timers.push({ callback, at: now + delay }),
    requestAnimationFrame: callback => frames.push(callback),
    gsap: { globalTimeline: { getChildren: () => tweens } }
  });
  if (idle) window.requestIdleCallback = callback => idleTasks.push(callback);
  class Image {
    classList = new Set();
    setAttribute() {}
    set src(value) { requests.push({ value, priority: this.fetchPriority }); }
    decode() { return decoded; }
  }
  vm.runInNewContext(source, { document, window, navigator: { connection }, Image, performance: { now: () => now } });
  return {
    background, document, media, connection, requests, layers, frames, resolveImage, rejectImage,
    load() { window.dispatchEvent(new Event('load')); },
    async runScheduled(duration = 1200) {
      const end = now + duration;
      await settle();
      while (true) {
        while (idleTasks.length) { idleTasks.shift()(); await settle(); }
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > end) break;
        const task = timers.shift();
        now = task.at;
        task.callback();
        await settle();
      }
      now = end;
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
  await page.runScheduled();
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
  await page.runScheduled();
  assert.equal(page.requests.length, 0);
  page.connection.saveData = false;
  page.connection.dispatchEvent(new Event('change'));
  await page.runScheduled();
  assert.equal(page.requests.length, 1);
});

test('waits for CSS entrance animations and a quiet interval after they finish', async () => {
  const animation = { playState: 'running', effect: { getComputedTiming: () => ({ endTime: 2000 }) } };
  const page = setup({ loaded: true, animations: [animation] });
  await page.runScheduled(2200);
  assert.equal(page.requests.length, 0);
  animation.playState = 'finished';
  await page.runScheduled(300);
  assert.equal(page.requests.length, 0);
  await page.runScheduled(300);
  assert.equal(page.requests.length, 1);
});

const tween = ({ progress = 0, paused = false, repeat = 0, parent } = {}) => ({
  totalProgress: () => progress, paused: () => paused, repeat: () => repeat,
  timeScale: () => 1, parent
});

test('waits for delayed GSAP entrances as well as active ones', async () => {
  const tweens = [tween()];
  const page = setup({ loaded: true, tweens });
  await page.runScheduled(2400);
  assert.equal(page.requests.length, 0);
  tweens[0] = tween({ progress: 1 });
  await page.runScheduled(600);
  assert.equal(page.requests.length, 1);
});

test('ignores infinite animations and reveals paused by a parent timeline', async () => {
  const page = setup({
    loaded: true,
    animations: [{ playState: 'running', effect: { getComputedTiming: () => ({ endTime: Infinity }) } }],
    tweens: [tween({ repeat: -1 }), tween({ parent: tween({ paused: true }) })]
  });
  await page.runScheduled();
  assert.equal(page.requests.length, 1);
});
