import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';
const root = path.resolve(import.meta.dirname, '../dist');
let pages = 0;
const errors = [];
function check(value, file) {
  if (!value || /^(?:https?:|data:|#|mailto:|tel:)/.test(value)) return;
  let target = path.resolve(path.dirname(file), decodeURIComponent(value.split(/[?#]/)[0]));
  if (!target.startsWith(root + path.sep) && target !== root) { errors.push(`Path outside dist: ${value}`); return; }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) errors.push(`${path.relative(root,file)}: missing ${value}`);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file = path.join(dir,entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!file.endsWith('.html')) continue;
    pages++;
    const $ = load(fs.readFileSync(file,'utf8'));
    $('[href],[src],[poster]').each((_, el) => {
      for (const a of ['href','src','poster']) check($(el).attr(a),file);
      if ($(el).attr('src')?.startsWith('https:') && !$(el).is('iframe')) errors.push(`Remote resource: ${$(el).attr('src')}`);
    });
    $('[srcset]').each((_,el) => $(el).attr('srcset').split(',').forEach(part => check(part.trim().split(/\s+/)[0],file)));
  }
}
walk(root);
const catalog = JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8'));
for (const product of catalog) {
  if (!fs.existsSync(path.join(root,'product',product.slug,'index.html'))) errors.push(`Missing product page: ${product.slug}`);
  if (!Number.isInteger(product.price) || product.price < 0) errors.push(`Invalid price: ${product.slug}`);
  check(product.image,path.join(root,'index.html'));
}
const shop = load(fs.readFileSync(path.join(root,'shop/index.html'),'utf8'));
if (shop('.catalog__item').length !== catalog.length) errors.push('Shop does not include every product');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${pages} pages, ${catalog.length} products, internal links and responsive image paths: OK`);
