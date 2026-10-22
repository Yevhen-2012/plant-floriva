import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { request } from './http.mjs';

const siteId = '69f48a4e4dbe9b9b439df8b4';
const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'data');
const nonce = crypto.randomBytes(24).toString('hex');
let progress = { state: 'waiting', message: 'Ready for read-only Webflow access' };
let running = false;
let migrationToken = '';

async function exportSite(token) {
  const api = async route => JSON.parse(await request(`https://api.webflow.com/v2/${route}`, { token }));
  const paginated = async (route, key) => {
    const all = [];
    for (let offset = 0; ; offset += 100) {
      const result = await api(`${route}${route.includes('?') ? '&' : '?'}limit=100&offset=${offset}`);
      const batch = result[key] ?? [];
      all.push(...batch);
      if (batch.length < 100 || all.length >= (result.pagination?.total ?? Infinity)) break;
    }
    return all;
  };
  const save = async (name, value) => fs.writeFile(path.join(dataDir, name), JSON.stringify(value, null, 2) + '\n');
  await fs.mkdir(path.join(dataDir, 'collections'), { recursive: true });
  progress = { state: 'running', message: 'Reading site settings' };
  const site = await api(`sites/${siteId}`);
  await save('site.json', site);
  for (const [route, key] of [['pages', 'pages'], ['assets', 'assets'], ['collections', 'collections']]) {
    progress.message = `Reading ${key}`;
    const entries = await paginated(`sites/${siteId}/${route}`, key);
    await save(`${key}.json`, entries);
  }
  const collections = JSON.parse(await fs.readFile(path.join(dataDir, 'collections.json'), 'utf8'));
  let count = 0;
  for (const collection of collections) {
    progress.message = `Reading collection: ${collection.displayName}`;
    const schema = await api(`collections/${collection.id}`);
    const items = await paginated(`collections/${collection.id}/items`, 'items');
    count += items.length;
    await save(`collections/${collection.id}.json`, { schema, items });
  }
  progress.message = 'Reading products and variants';
  try {
    await save('products.json', await paginated(`sites/${siteId}/products`, 'items'));
  } catch (error) {
    await save('ecommerce-status.json', { error: error.message });
  }
  await save('export.json', { exportedAt: new Date().toISOString(), siteId, collections: collections.length, items: count });
  progress = { state: 'complete', message: `Saved ${collections.length} collections and ${count} items. The API token was not saved.` };
  console.log(progress.message);
}

const server = http.createServer(async (req, res) => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'GET' && req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="uk"><meta charset="utf-8"><title>Plant — API import</title><style>body{font:18px system-ui;max-width:680px;margin:80px auto;background:#f4f6f1;color:#173827}input,button{font:inherit;padding:12px;margin:8px 0}input{width:100%;box-sizing:border-box}button{cursor:pointer}pre{white-space:pre-wrap}</style><h1>Plant: імпорт Webflow</h1><p>Локальний інструмент. Токен використовується лише для читання api.webflow.com і не зберігається у файлах.</p><form><label for="token">Webflow API token</label><input id="token" name="token" type="password" autocomplete="off" required><button>Імпортувати дані</button></form><pre id="status">Очікування токена</pre><script>const f=document.querySelector('form'),s=document.querySelector('#status');f.onsubmit=async e=>{e.preventDefault();let token=f.token.value;f.token.value='';f.hidden=true;const r=await fetch('/export',{method:'POST',headers:{'Content-Type':'application/json','X-Migration-Nonce':'${nonce}'},body:JSON.stringify({token})});token='';s.textContent=await r.text()};setInterval(async()=>{const r=await fetch('/status');const p=await r.json();s.textContent=p.message},1500)</script></html>`);
  } else if (req.method === 'GET' && req.url === '/status') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(progress));
  } else if (req.method === 'POST' && req.url === '/export' && req.headers.origin === origin && req.headers['x-migration-nonce'] === nonce && !running) {
    running = true;
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 8192) throw new Error('Request too large');
      }
      let { token } = JSON.parse(body);
      if (typeof token !== 'string' || token.length < 20 || token.length > 4096) throw new Error('Invalid token');
      body = '';
      res.end('Імпорт розпочато');
      migrationToken = token;
      exportSite(migrationToken).catch(error => { progress = { state: 'error', message: error.message }; console.error(error.message); }).finally(() => { token = ''; running = false; });
    } catch (error) {
      running = false;
      res.statusCode = 400;
      res.end(error.message);
    }
  } else {
    res.statusCode = 403;
    res.end('Forbidden');
  }
});
server.listen(4186, '127.0.0.1', () => console.log('Plant import: http://127.0.0.1:4186/'));
