import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../dist');
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.ttf':'font/ttf'};
http.createServer(async (req,res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const stat = await fs.stat(file);
    if (stat.isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301,{Location:pathname+'/'}); res.end(); return; }
      file = path.join(file,'index.html');
    }
    res.writeHead(200,{'Content-Type':types[path.extname(file)] ?? 'application/octet-stream'});
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404,{'Content-Type':'text/plain'}); res.end('Not found'); }
}).listen(4175,'127.0.0.1',()=>console.log('Plant: http://127.0.0.1:4175/'));
