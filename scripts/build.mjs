import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { responsiveImages } from './images.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/capture.json'), 'utf8'));
for (const url of Object.keys(manifest.assets)) if (new URL(url).hostname === 'www.google.com' && new URL(url).pathname.startsWith('/maps/embed')) delete manifest.assets[url];
const collections = JSON.parse(await fs.readFile(path.join(root, 'content/collections.json'), 'utf8'));
const assistantTemplate = await fs.readFile(path.join(root, 'templates/assistant.html'), 'utf8');
const imageManifest = JSON.parse(await fs.readFile(path.join(root, 'content/responsive-images.json'), 'utf8'));
const revisedAssets = await Promise.all([
  ['assets/ec31a84704f2-webflow.schunk.ea430c4ee63e06c2.js', 'assets/ec31a84704f2-webflow.schunk.ea430c4ee63e06c2.js'],
  ['js/migration.css', 'public/migration.css'],
  ['js/assistant.css', 'public/assistant.css'],
  ['js/video.js', 'public/video.js']
].map(async ([file, source]) => [file, createHash('sha256').update(await fs.readFile(path.join(root, source))).digest('hex').slice(0, 10)]));
const collection = name => collections.find(item => item.schema.slug === name)?.items ?? [];
await fs.mkdir(output, { recursive: true });
await fs.cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
await fs.cp(path.join(root, 'public'), path.join(output, 'js'), { recursive: true });
await fs.writeFile(path.join(output, '.nojekyll'), '');
manifest.assets['https://cdn.prod.website-files.com/blur.svg'] = 'assets/blur.svg';
await fs.writeFile(path.join(output, 'assets/blur.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><filter id="blur"><feGaussianBlur stdDeviation="20"/></filter></svg>');
const relative = (from, to) => path.posix.relative(path.posix.dirname(from), to) || './';
const target = route => route === '/' ? 'index.html' : `${route.replace(/^\/|\/$/g, '')}/index.html`;
const routes = new Set([...Object.keys(manifest.pages), '/cart', ...collection('category').map(item => `/category/${item.fieldData.slug}`)]);
const localUrl = (value, from) => {
  if (!value || /^(?:#|data:|tel:|mailto:|javascript:)/i.test(value)) return value;
  const absolute = new URL(value, 'https://plant-f81e0d.webflow.io/');
  if (manifest.assets[absolute.href]) return relative(from, manifest.assets[absolute.href]);
  if (absolute.hostname === 'plant-f81e0d.webflow.io') {
    let route = absolute.pathname.replace(/\/$/, '') || '/';
    if (/checkout|order-confirmation/.test(route)) route = '/cart';
    if (routes.has(route)) return relative(from, target(route)).replace(/index\.html$/, '') + absolute.search + absolute.hash;
  }
  return value;
};
const replaceAssets = (text, from) => {
  for (const [url, file] of Object.entries(manifest.assets).sort((a,b) => b[0].length - a[0].length)) text = text.replaceAll(url, relative(from, file)).replaceAll(url.replaceAll('&', '&amp;'), relative(from, file));
  return text;
};
for (const [url, file] of Object.entries(manifest.assets)) {
  if (!file.endsWith('.css')) continue;
  const source = await fs.readFile(path.join(root, file), 'utf8');
  const css = source.replace(/url\((["']?)([^)'"\s]+)\1\)/g, (all, quote, value) => {
    if (value.startsWith('data:') || value.startsWith('#')) return all;
    const absolute = new URL(value, url);
    const fragment = absolute.hash; absolute.hash = '';
    const mapped = manifest.assets[absolute.href];
    return mapped ? `url(${quote}${relative(file, mapped)}${fragment}${quote})` : all;
  });
  await fs.writeFile(path.join(output, file), css);
}
const catalog = collection('product').filter(item => !item.isDraft && !item.isArchived).map(product => {
  const sku = collection('sku').find(item => item.id === product.fieldData['default-sku']);
  const image = product.fieldData['main-img']?.url ?? sku?.fieldData['main-image']?.url;
  if (!manifest.assets[image]) throw new Error(`Missing product image: ${product.fieldData.name}`);
  const thumbnail = imageManifest[manifest.assets[image]]?.variants.find(variant => variant.width >= 160)?.file ?? manifest.assets[image];
  return { id: product.id, name: product.fieldData.name, slug: product.fieldData.slug, image: thumbnail, price: sku?.fieldData.price?.value ?? 0 };
});
await fs.mkdir(path.join(output, 'data'), { recursive: true });
await fs.writeFile(path.join(output, 'data/catalog.json'), JSON.stringify(catalog, null, 2));
for (const route of routes) {
  const from = target(route);
  let source = manifest.pages[route];
  if (route === '/cart') source = manifest.pages['/contact'];
  if (route.startsWith('/category/')) source = manifest.pages['/shop'];
  let html = await fs.readFile(path.join(root, 'snapshots', source), 'utf8');
  const $ = load(html);
  $('html').attr('lang', 'en').removeAttr('data-wf-domain data-wf-status');
  $('link[rel="preconnect"],link[rel="dns-prefetch"],script[type="text/x-wf-template"]').remove();
  $('script').each((_, element) => {
    const script = $(element);
    if (/webfont/i.test(script.attr('src') ?? '') || script.text().includes('WebFont.load') || /gsap@3\.13/.test(script.attr('src') ?? '')) script.remove();
  });
  $('[data-node-type="commerce-cart-wrapper"]').each((_, element) => {
    const original = $(element);
    original.remove();
  });
  $('.nav-ico-link-search').attr('data-open-cart', '').attr('role','button').attr('aria-label','Open cart').attr('aria-haspopup','dialog').removeAttr('data-w-id');
  $('.quantity-cart').attr('data-cart-count','').attr('hidden','').text('0');
  $('[data-node-type="commerce-add-to-cart-form"]').each((_, element) => {
    const form = $(element);
    form.attr('data-plant-add', '').attr('data-product-id', form.attr('data-commerce-product-id'));
    form.find('[data-node-type="commerce-buy-now-button"]').attr('data-buy-now', '').attr('href', localUrl('/cart', from)).text('View cart');
  });
  $('[data-node-type]').each((_, element) => {
    const el = $(element);
    if ((el.attr('data-node-type') ?? '').startsWith('commerce')) el.removeAttr('data-node-type');
  });
  $('form').not('[data-plant-add]').each((_, element) => {
    const form = $(element);
    form.attr('data-plant-newsletter', '').removeAttr('data-wf-page-id data-wf-element-id');
    form.append('<p class="plant-newsletter-status" role="status" aria-live="polite"></p>');
    form.parent('.w-form').removeClass('w-form');
  });
  $('.w-form-done,.w-form-fail').remove();
  $('head').append(`<link rel="stylesheet" href="${relative(from, 'js/migration.css')}">`);
  const font = Object.entries(manifest.assets).find(([url]) => url.startsWith('https://fonts.googleapis.com/css2'));
  if (font) $('head').append(`<link rel="stylesheet" href="${relative(from, font[1])}">`);
  if (route === '/') {
    $('.hero__btn-wrapper a[href="#"]').not('.video-link').attr('href', '/shop');
    $('.hero__content a').filter((_, el) => $(el).text().trim() === 'Explore').attr('href', '/shop');
  }
  if (route === '/shop' || route.startsWith('/category/')) {
    const template = $('.catalog__item').first().clone();
    const list = $('.catalog__item').first().parent();
    list.empty();
    for (const product of catalog) {
      const record = collection('product').find(item => item.id === product.id);
      const card = template.clone();
      card.find('.h3-card').text(product.name);
      card.find('.card-text-wraper').text(record.fieldData.description || record.fieldData['short-descr'] || '');
      card.find('.card-img').attr('src', record.fieldData['main-img'].url).attr('alt',product.name).removeAttr('srcset sizes');
      card.find('.text-block-2').text((product.price / 100).toFixed(2));
      card.find('a[href^="/product/"]').attr('href', `/product/${product.slug}`);
      const categories = card.find('.product__categories-list').empty();
      for (const id of record.fieldData.category ?? []) {
        const cat = collection('category').find(item => item.id === id);
        if (cat) categories.append($('<div role="listitem" class="product__category w-dyn-item">').append($('<div>').text(cat.fieldData.name)));
      }
      list.append(card);
    }
    $('.w-pagination-wrapper').remove();
  }
  if (route.startsWith('/category/')) {
    const slug = route.split('/').pop();
    const cat = collection('category').find(item => item.fieldData.slug === slug);
    const ids = new Set(collection('product').filter(product => (product.fieldData.category ?? []).includes(cat.id)).map(product => product.fieldData.slug));
    $('.catalog__item').each((_, el) => { const href = $(el).find('a[href^="/product/"]').attr('href'); if (!ids.has(href?.split('/').pop())) $(el).remove(); });
    $('title').text(`${cat.fieldData.name} — Floriva`);
  }
  if (route === '/cart') {
    $('title').text('Your cart — Floriva');
    $('main').html('<section class="plant-cart-page"><h1>Your plant collection</h1><p>Keep your favourites together. Your selection is saved in this browser. Online checkout is coming soon.</p><button class="button-main_btn w-button" data-open-cart>View cart</button> <a href="/shop">Continue shopping</a></section>');
    $('body').attr('data-open-cart', 'true');
  }
  const description = route.startsWith('/product/') ? collection('product').find(p => p.fieldData.slug === route.split('/').pop())?.fieldData['short-descr'] : 'Floriva — indoor plants, botanical inspiration and care advice.';
  if (description && !$('meta[name="description"]').length) $('head').append($('<meta>').attr('name','description').attr('content',description));
  $('a[href]').each((_, element) => { const el = $(element); el.attr('href', localUrl(el.attr('href'), from)); });
  $('[src],[poster],[data-poster-url],[data-video-urls],link[href]').each((_, element) => {
    const el = $(element);
    if (el.is('iframe')) return;
    for (const a of ['src', 'poster', 'data-poster-url', 'href']) { if (el.attr(a)) el.attr(a, localUrl(el.attr(a), from)); }
    if (el.attr('data-video-urls')) el.attr('data-video-urls', el.attr('data-video-urls').split(',').map(value => localUrl(value, from)).join(','));
    el.removeAttr('integrity crossorigin');
  });
  $('[srcset]').each((_, element) => { const el = $(element); el.attr('srcset', el.attr('srcset').split(',').map(part => { const [url,...sizes] = part.trim().split(/\s+/); return [localUrl(url, from),...sizes].join(' '); }).join(', ')); });
  $('video').each((_, element) => {
    const video = $(element);
    if (!video.closest('.demo-video-wrapper').length) return;
    video.attr('data-plant-video', '').attr('preload', 'none').removeAttr('autoplay');
    video.parent().removeAttr('data-video-urls data-autoplay');
    video.find('source[src]').each((_, source) => {
      const el = $(source), src = el.attr('src');
      el.attr('data-plant-src', src).attr('type', src.endsWith('.webm') ? 'video/webm' : 'video/mp4').removeAttr('src');
    });
  });
  $('body').append(`<dialog class="plant-cart" id="plant-cart" aria-labelledby="plant-cart-title"><div class="plant-cart-header"><h2 id="plant-cart-title">Your Cart</h2><button type="button" data-close-cart aria-label="Close cart">✕</button></div><div data-cart-items></div><div class="plant-cart-total"><span>Subtotal</span><strong data-cart-total>€0.00</strong></div><p class="plant-cart-note">Your selection is saved in this browser. Online checkout is not available yet.</p><div class="plant-cart-links"><a href="${localUrl('/shop',from)}">Continue shopping</a><a href="${localUrl('/contact',from)}">Contact us</a></div></dialog><script src="${relative(from, 'js/runtime.js')}"></script>`);
  $('head').append(`<link rel="stylesheet" href="${relative(from, 'js/assistant.css')}">`);
  $('body').append(assistantTemplate
    .replaceAll('{{plantImage}}', relative(from, 'assets/021953adb952-69f9c9e7e9bc2ec60810028a_Alocasia-planty-2.webp'))
    .replaceAll('{{shopUrl}}', localUrl('/shop', from))
    .replaceAll('{{blogUrl}}', localUrl('/blog', from)));
  $('body').append(`<script src="${relative(from, 'js/assistant.js')}"></script>`);
  if ($('video[data-plant-video]').length) $('body').append(`<script src="${relative(from, 'js/video.js')}"></script>`);
  responsiveImages($, from, imageManifest);
  for (const [file, revision] of revisedAssets) {
    const url = relative(from, file);
    $('script[src],link[href]').each((_, element) => {
      const el = $(element), attr = el.is('script') ? 'src' : 'href';
      if (el.attr(attr) === url) el.attr(attr, `${url}?v=${revision}`);
    });
  }
  html = replaceAssets($.html(), from);
  await fs.mkdir(path.dirname(path.join(output, from)), { recursive: true });
  await fs.writeFile(path.join(output, from), html);
}
await fs.writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Page not found — Floriva</title><body style="font:20px system-ui;background:#172218;color:white;padding:10vw"><h1>This page is taking root elsewhere.</h1><a href="./" style="color:inherit">Return to Floriva</a></body></html>');
console.log(`Built ${routes.size} pages, ${catalog.length} products, ${Object.keys(manifest.assets).length} local assets.`);
