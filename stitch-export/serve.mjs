import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safePath, validatePackage } from './package.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.ttf': 'font/ttf', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

export async function startPreviewServer({ root = dirname(fileURLToPath(import.meta.url)), port = 4401, strictPort = false, log = console.log } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('STITCH_PREVIEW_PORT must be an integer from 0 to 65535.');
  const manifest = validatePackage(root);
  const allowed = new Set(['manifest.json', ...manifest.files.map((file) => file.path)]);
  const server = createServer((request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname).slice(1) || 'index.html';
      if (!allowed.has(path)) { response.writeHead(404).end('Not found'); return; }
      const body = readFileSync(safePath(root, path));
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'text/plain', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(body);
    } catch { response.writeHead(404).end('Not found'); }
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await new Promise((ready, reject) => {
        const onError = (error) => { server.removeListener('listening', onReady); reject(error); };
        const onReady = () => { server.removeListener('error', onError); ready(); };
        server.once('error', onError);
        server.once('listening', onReady);
        server.listen(port, '127.0.0.1');
      });
      const origin = `http://localhost:${server.address().port}`;
      log(`RETREST Stitch references: ${origin}/screens/login-light-desktop.html\nGallery: ${origin}\nPress Ctrl+C to stop this preview.`);
      return server;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      if (strictPort || attempt === 9 || port === 65535) throw new Error(`Port ${port} is already in use. Open an existing preview if it is yours, or choose another port with STITCH_PREVIEW_PORT=4402 node serve.mjs.`);
      log(`Port ${port} is already in use; trying ${port + 1}.`);
      port++;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const configured = process.env.STITCH_PREVIEW_PORT;
    await startPreviewServer({ port: Number(configured || 4401), strictPort: Boolean(configured) });
  } catch (error) {
    console.error(`Stitch preview: ${error.message}`);
    process.exitCode = 1;
  }
}
