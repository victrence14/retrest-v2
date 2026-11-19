import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { compile } from '@tailwindcss/node';
import { chromium } from '@playwright/test';
import { zipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const original = join(root, 'archive/next-app');
const destination = join(root, 'exports/retrest-ui-export');
const zipPath = join(root, 'exports/retrest-ui-export.zip');
for (const folder of ['screens', 'screenshots', 'fonts', 'tokens', 'source/components', 'source/lib', 'source/styles']) mkdirSync(join(destination, folder), { recursive: true });
mkdirSync(join(root, 'node_modules/.cache'), { recursive: true });
const work = mkdtempSync(join(root, 'node_modules/.cache/retrest-ui-export-'));
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function download(url, filename) {
  const path = join(destination, 'fonts', filename);
  if (existsSync(path)) return;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Unable to bundle ${filename}: HTTP ${response.status}`);
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
}

function fontCss(prefix = '') {
  return `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url('${prefix}fonts/Inter.ttf') format('truetype')}\n@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:200 800;font-display:swap;src:url('${prefix}fonts/PlusJakartaSans.ttf') format('truetype')}\n`;
}

function allFiles(folder, prefix = '') {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? allFiles(join(folder, entry.name), relative) : [relative];
  });
}

let browser;
let server;
try {
  console.log('Bundling the original React screens with static navigation…');
  await build({
    entryPoints: [join(root, 'scripts/ui-export/render.tsx')], outfile: join(work, 'render.mjs'),
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external',
    alias: { '@': join(original, 'src'), 'next/link': join(root, 'scripts/ui-export/link.tsx'), 'next/navigation': join(root, 'scripts/ui-export/navigation.ts') },
  });
  const { renderScreens } = await import(pathToFileURL(join(work, 'render.mjs')).href);
  const screens = renderScreens(readFileSync(join(original, 'db/schema.sql'), 'utf8'));

  console.log('Bundling licensed fonts for offline review…');
  await Promise.all([
    download('https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf', 'Inter.ttf'),
    download('https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt', 'Inter-OFL.txt'),
    download('https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf', 'PlusJakartaSans.ttf'),
    download('https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt', 'PlusJakartaSans-OFL.txt'),
  ]);
  const authoredCss = readFileSync(join(original, 'src/app/globals.css'), 'utf8');
  const withoutRemoteFonts = authoredCss.replace(/@import\s+url\([^)]*\)\s*;/g, '');
  const compiler = await compile(withoutRemoteFonts, { base: original, onDependency() {} });
  const css = compiler.build([]);
  if (/url\(['"]?https?:/i.test(css)) throw new Error('Export styles still depend on remote assets.');
  for (const screen of screens) {
    const markup = screen.markup.replace(/<form(?=[\s>])/g, '<form inert');
    writeFileSync(join(destination, 'screens', `${screen.id}.html`), `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>RETREST · ${escape(screen.title)} · UI export</title><style>${fontCss('../')}${css}\n*,*::before,*::after{animation:none!important;transition:none!important}</style></head><body>${markup}</body></html>\n`);
  }

  // Explicitly copy presentation files; never include env, databases, backend
  // routes, session code, build caches or source control metadata in the archive.
  for (const name of readdirSync(join(original, 'src/components'))) {
    if (name.endsWith('.tsx') && name !== 'dashboard-page.tsx') copyFileSync(join(original, 'src/components', name), join(destination, 'source/components', name));
  }
  for (const name of ['format.ts', 'types.ts', 'navigation.ts', 'preview-account.ts']) copyFileSync(join(original, 'src/lib', name), join(destination, 'source/lib', name));
  copyFileSync(join(original, 'src/app/globals.css'), join(destination, 'source/styles/globals.css'));
  copyFileSync(join(root, 'scripts/ui-export/serve.mjs'), join(destination, 'serve.mjs'));
  copyFileSync(join(root, 'design-tokens/tokens.json'), join(destination, 'tokens/starter-themes.tokens.json'));

  const properties = [...authoredCss.match(/:root\s*\{([\s\S]*?)\}/)[1].matchAll(/--([a-z-]+)\s*:\s*([^;]+);/g)];
  const colors = Object.fromEntries(properties.filter(([_, name]) => name !== 'font').map(([_, name, value]) => [name, { value: value.trim(), type: 'color' }]));
  const originalTokens = {
    original: { color: colors, font: {
      bodyFamily: { value: 'Inter', type: 'fontFamilies' }, headingFamily: { value: 'Plus Jakarta Sans', type: 'fontFamilies' },
      bodySize: { value: '13px', type: 'fontSizes' }, bodyLineHeight: { value: '150%', type: 'lineHeights' },
    } },
    $themes: [{ id: 'retrest-original', name: 'Original dark UI', selectedTokenSets: { original: 'enabled' } }],
    $metadata: { tokenSetOrder: ['original'] },
  };
  writeFileSync(join(destination, 'tokens/original-ui.tokens.json'), JSON.stringify(originalTokens, null, 2) + '\n');

  const mime = { '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png' };
  server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
      const path = resolve(destination, '.' + pathname);
      if (!path.startsWith(destination + sep)) { response.writeHead(403).end(); return; }
      const body = readFileSync(path);
      response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'text/plain' }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1, colorScheme: 'dark' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const captures = [];
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const screen of screens) {
      const response = await page.goto(`${origin}/screens/${screen.id}.html`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`Cannot open ${screen.id} for capture.`);
      await page.evaluate(async () => {
        await document.fonts.load('400 13px Inter');
        await document.fonts.load('600 24px "Plus Jakarta Sans"');
        await document.fonts.ready;
      });
      const state = await page.evaluate(() => ({
        bodyFont: document.fonts.check('400 13px Inter'), headingFont: document.fonts.check('600 24px "Plus Jakarta Sans"'),
        width: innerWidth, height: document.documentElement.scrollHeight, text: document.body.innerText.trim().length,
        controls: document.querySelectorAll('svg').length, scripts: document.scripts.length,
      }));
      if (!state.bodyFont || !state.headingFont || state.text < 50 || state.scripts) throw new Error(`Invalid standalone render: ${screen.id}`);
      const file = `screenshots/${screen.id}-${viewport.name}.png`;
      await page.screenshot({ path: join(destination, file), fullPage: true });
      captures.push({ screen: screen.id, viewport: viewport.name, width: viewport.width, height: state.height, file });
      console.log(`Captured ${screen.id} · ${viewport.name}`);
    }
  }
  if (errors.length) throw new Error(`Rendered pages have browser errors: ${errors.join(', ')}`);

  const cards = screens.map((screen) => `<article><a href="screens/${screen.id}.html"><img src="screenshots/${screen.id}-desktop.png" alt="${escape(screen.title)} preview" loading="lazy"><h2>${escape(screen.title)}</h2></a><p><a href="screens/${screen.id}.html">Open HTML for Figma import ↗</a> · <a href="screenshots/${screen.id}-desktop.png">Desktop PNG</a> · <a href="screenshots/${screen.id}-mobile.png">Mobile PNG</a></p></article>`).join('\n');
  writeFileSync(join(destination, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RETREST · Team UI export</title><style>${fontCss()}*{box-sizing:border-box}body{margin:0;padding:48px 24px;background:#090d16;color:#f1f4fa;font:15px/1.6 Inter,system-ui,sans-serif}main{max-width:1120px;margin:auto}h1{font:700 42px/1.15 'Plus Jakarta Sans',sans-serif}h2{font-size:18px;margin:16px 0 0}p{color:#9aa7bd}a{color:#b8baff;text-underline-offset:4px}header{margin-bottom:40px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}article{padding:18px;background:#111827;border:1px solid #243047;border-radius:16px}article>a{text-decoration:none;color:inherit}img{width:100%;height:230px;object-fit:cover;object-position:top;border-radius:8px}article p{font-size:12px}code{color:#f1f4fa}</style></head><body><main><header><p>RETREST / ORIGINAL UI / TEAM HANDOFF</p><h1>RETREST screen gallery.</h1><p>12 original screens. The cards below are PNG previews for review.</p><p><strong>For Figma: <a href="screens/shield.html">open the full Shield dashboard</a> before capturing with html.to.design.</strong></p><p>Run <code>node serve.mjs</code>, open <code>http://localhost:4400/screens/shield.html</code>, and capture that screen. Capturing this gallery imports the thumbnail images.</p><p><a href="README.md">Handoff guide</a> · <a href="tokens/original-ui.tokens.json">Original UI tokens</a> · <a href="tokens/starter-themes.tokens.json">Monorepo Light/Dark tokens</a></p></header><section class="grid">${cards}</section></main></body></html>\n`);

  copyFileSync(join(root, 'scripts/ui-export/HANDOFF.md'), join(destination, 'README.md'));
  writeFileSync(join(destination, 'IMPORT-URLS.txt'), 'Open an individual HTML screen before capturing with html.to.design.\nThe root URL is a PNG review gallery.\n\n' + screens.map((screen) => `http://localhost:4400/screens/${screen.id}.html`).join('\n') + '\n');
  const files = allFiles(destination).filter((file) => file !== 'EXPORT-MANIFEST.json');
  if (files.some((file) => /(^|\/)(?:\.env[^/]*|\.git|node_modules|data)(?:\/|$)|\.(?:sqlite|db)$/i.test(file))) throw new Error('Disallowed private file in UI export.');
  const manifest = {
    name: 'RETREST original UI team export', created_at: new Date().toISOString(), format: 'HTML + PNG + Tokens Studio JSON + React source',
    native_figma_document: false, data_source: 'Fresh in-memory demo seed only', screen_count: screens.length, capture_count: captures.length,
    screens: screens.map(({ id, title }) => ({ id, title, html: `screens/${id}.html` })), captures,
    source_css_sha256: sha256(Buffer.from(authoredCss)), files: files.map((file) => {
      const bytes = readFileSync(join(destination, file)); return { path: file, bytes: bytes.length, sha256: sha256(bytes) };
    }),
  };
  writeFileSync(join(destination, 'EXPORT-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  const entries = Object.fromEntries([...files, 'EXPORT-MANIFEST.json'].map((file) => [`retrest-ui-export/${file}`, new Uint8Array(readFileSync(join(destination, file)))]));
  writeFileSync(zipPath, zipSync(entries, { level: 6 }));
  console.log(`Created ${zipPath} (${(readFileSync(zipPath).length / 1024 / 1024).toFixed(1)} MB).`);
} finally {
  if (browser) await browser.close();
  if (server?.listening) await new Promise((done) => server.close(done));
  rmSync(work, { recursive: true, force: true });
}
