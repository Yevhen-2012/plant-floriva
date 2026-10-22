import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { load } from 'cheerio';
import { request } from './http.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = 'https://plant-f81e0d.webflow.io';
const snapshots = path.join(root, 'snapshots');
const assets = path.join(root, 'assets');
await fs.mkdir(snapshots, { recursive: true });
await fs.mkdir(assets, { recursive: true });
const manifestPath = path.join(root, 'data', 'capture.json');
let manifest = { pages: {}, assets: {}, failed: [] };
try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch {}
manifest.failed = [];
const queue = ['/', '/shop', '/blog', '/contact'];
for (const file of await fs.readdir(path.join(root, 'data', 'collections'))) {
  const c = JSON.parse(await fs.readFile(path.join(root, 'data', 'collections', file), 'utf8'));
  if (!['product', 'post'].includes(c.schema.slug)) continue;
  for (const item of c.items.filter(item => !item.isDraft && !item.isArchived)) queue.push(`/${c.schema.slug}/${item.fieldData.slug}`);
}
const visited = new Set();
const resources = new Set();
const includeResource = value => {
  if (!value || value.startsWith('data:')) return;
  try {
    const url = new URL(value.replaceAll('&amp;', '&'), origin);
    if (url.protocol === 'https:' && url.hostname !== new URL(origin).hostname && !url.pathname.includes('...')) resources.add(url.href);
  } catch {}
};
for (let index = 0; index < queue.length; ) {
  const batch = [];
  while (batch.length < 4 && index < queue.length) {
    const route = queue[index++];
    if (!visited.has(route)) { visited.add(route); batch.push(route); }
  }
  await Promise.all(batch.map(async route => {
    const name = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
    const local = path.join(snapshots, name);
    try {
      let html;
      if (manifest.pages[route]) html = await fs.readFile(local, 'utf8');
      else {
        html = await request(origin + route);
        await fs.mkdir(path.dirname(local), { recursive: true });
        await fs.writeFile(local, html);
        manifest.pages[route] = name;
      }
      const $ = load(html);
      $('a[href]').each((_, element) => {
        try {
          const u = new URL($(element).attr('href'), origin);
          if (u.origin === origin && !/\.(?:png|jpe?g|webp|svg|mp4|pdf)$/i.test(u.pathname) && !/checkout|order-confirmation|customer-review|\/sku\//.test(u.pathname)) queue.push(u.pathname.replace(/\/$/, '') || '/');
        } catch {}
      });
      $('[src],[poster],[data-poster-url],[data-video-urls],link[href]').each((_, element) => {
        const el = $(element);
        if (el.is('iframe')) return;
        for (const a of ['src', 'poster', 'data-poster-url']) includeResource(el.attr(a));
        if (el.is('link') && !/preconnect|dns-prefetch/.test(el.attr('rel') ?? '')) includeResource(el.attr('href'));
        for (const url of (el.attr('data-video-urls') ?? '').split(',')) includeResource(url);
      });
      $('[srcset]').each((_, element) => ($(element).attr('srcset') ?? '').split(',').forEach(candidate => includeResource(candidate.trim().split(/\s+/)[0])));
      for (const match of html.matchAll(/url\(["']?(https?:[^\s)'"<>]+)/g)) includeResource(match[1]);
      console.log(`Page ${route}`);
    } catch (error) { manifest.failed.push({ route, error: error.message }); }
  }));
}
includeResource('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
const resourceQueue = [...resources];
for (let index = 0; index < resourceQueue.length; ) {
  const batch = resourceQueue.slice(index, index += 6);
  await Promise.all(batch.map(async url => {
    if (manifest.assets[url]) return;
    try {
      const parsed = new URL(url);
      let base = decodeURIComponent(path.posix.basename(parsed.pathname)).replace(/[^a-zA-Z0-9_.-]/g, '-').slice(-100) || 'resource';
      if (parsed.hostname === 'fonts.googleapis.com') base = 'inter.css';
      const name = `${crypto.createHash('sha256').update(url).digest('hex').slice(0, 12)}-${base}`;
      const output = path.join(assets, name);
      await request(url, { output });
      manifest.assets[url] = `assets/${name}`;
      if (/\.css(?:$|\?)/.test(url) || base.endsWith('.css')) {
        const css = await fs.readFile(output, 'utf8');
        for (const match of css.matchAll(/url\(["']?([^\s)'"<>]+)/g)) {
          const child = new URL(match[1], url).href;
          if (!resources.has(child) && !child.startsWith('data:')) { resources.add(child); resourceQueue.push(child); }
        }
      }
    } catch (error) { manifest.failed.push({ url, error: error.message }); }
  }));
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Resources ${Math.min(index, resourceQueue.length)}/${resourceQueue.length}`);
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Captured ${Object.keys(manifest.pages).length} pages, ${Object.keys(manifest.assets).length} resources; failures: ${manifest.failed.length}`);
if (manifest.failed.length) console.log(JSON.stringify(manifest.failed));
