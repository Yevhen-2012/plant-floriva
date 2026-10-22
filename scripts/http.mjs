import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./http-fetch.ps1', import.meta.url));
export function request(url, { token, output } = {}) {
  if (Number(process.versions.node.split('.')[0]) >= 24) {
    return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(90000) }).then(async response => {
      if (!response.ok) throw new Error(`HTTPS ${response.status}: ${new URL(url).pathname}`);
      if (output) {
        const fs = await import('node:fs/promises');
        await fs.writeFile(output, Buffer.from(await response.arrayBuffer()));
        return '{"saved":true}';
      }
      return response.text();
    });
  }
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', helper], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let errors = '';
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '')) : reject(new Error(`HTTPS request failed for ${new URL(url).hostname}: ${errors.slice(0, 500)}`)));
    child.stdin.end(JSON.stringify({ url, token, output }));
  });
}
