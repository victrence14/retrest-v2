import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { zipSync } from 'fflate';
import { generateCss } from '../design-tokens/scripts/build.mjs';
import { sha256, privatePath, hasExternalStyles } from './stitch-export/package.mjs';
import { screens, viewports, designSpec, prompts } from './stitch-export/spec.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = join(root, 'stitch-export');
const zipPath = join(root, 'exports/retrest-stitch-export.zip');
const cache = join(root, 'node_modules/.cache');
mkdirSync(cache, { recursive: true });
const work = mkdtempSync(join(cache, 'retrest-stitch-'));
const generated = new Set();
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function write(path, bytes) {
  if (privatePath(path)) throw new Error('Private files may not be exported.');
  mkdirSync(join(destination, path, '..'), { recursive: true });
  writeFileSync(join(destination, path), bytes);
  generated.add(path);
}
function copy(source, target) { write(target, readFileSync(join(root, source))); }

let browser;
try {
  const tokenBytes = readFileSync(join(root, 'design-tokens/tokens.json'));
  const tokens = JSON.parse(tokenBytes.toString('utf8'));
  const fingerprint = sha256(tokenBytes);
  const themeCss = generateCss(tokens);
  // Keep actual app CSS in sync even when this script is invoked directly.
  writeFileSync(join(root, 'design-tokens/generated/theme.css'), themeCss);
  const base = readFileSync(join(root, 'design-tokens/src/base.css'), 'utf8');
  const frontend = readFileSync(join(root, 'frontend/src/styles.css'), 'utf8');
  const landing = readFileSync(join(root, 'landing-page/src/styles.css'), 'utf8');
  const reference = readFileSync(join(root, 'scripts/stitch-export/reference.css'), 'utf8');
  const font = readFileSync(join(root, 'design-tokens/assets/fonts/Inter.ttf'));
  const inlineBase = base.replace("../assets/fonts/Inter.ttf", `data:font/ttf;base64,${font.toString('base64')}`);
  write('tokens.json', tokenBytes);
  write('DESIGN.md', designSpec(tokens, fingerprint));
  write('styles/theme.css', themeCss);
  write('styles/base.css', base.replace('../assets/fonts/Inter.ttf', '../fonts/Inter.ttf'));
  write('styles/frontend.css', frontend);
  write('styles/landing-page.css', landing);
  write('styles/reference.css', reference);
  copy('design-tokens/assets/fonts/Inter.ttf', 'fonts/Inter.ttf');
  copy('design-tokens/assets/fonts/OFL.txt', 'fonts/OFL.txt');
  for (const name of ['serve.mjs', 'upload.mjs', 'package.mjs', '.env.example']) copy(`scripts/stitch-export/${name}`, name);
  copy('scripts/stitch-export/HANDOFF.md', 'README.md');

  console.log('Rendering the current React/Vite screens with shared Light/Dark tokens…');
  await build({
    entryPoints: [join(root, 'scripts/stitch-export/render.tsx')], outfile: join(work, 'render.mjs'),
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external',
    alias: { '@retrest/design-tokens/react': join(root, 'design-tokens/src/theme.tsx'), 'virtual:pwa-register/react': join(root, 'scripts/stitch-export/pwa.ts') },
    define: { 'import.meta.env.VITE_APP_URL': '"__RETREST_APP_URL__"' },
  });
  const { renderScreen } = await import(pathToFileURL(join(work, 'render.mjs')).href);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const captures = [];
  for (const screen of screens) for (const theme of ['light', 'dark']) for (const viewport of viewports) {
    const id = `${screen.id}-${theme}-${viewport.id}`;
    const title = `RETREST / ${screen.title} / ${theme === 'light' ? 'Light' : 'Dark'} / ${viewport.id}`;
    const css = `${themeCss}\n${inlineBase}\n${screen.id === 'landing' ? landing : frontend}\n${screen.id === 'components' ? reference : ''}\n*,*::before,*::after{animation:none!important;transition:none!important}`;
    if (hasExternalStyles(css)) throw new Error(`External CSS dependency in ${id}`);
    const markup = renderScreen(screen.id, theme).replace(/<form(?=[\s>])/g, '<form inert')
      .replaceAll('__RETREST_APP_URL__', `login-${theme}-${viewport.id}.html`)
      .replaceAll('href="/"', `href="${screen.id === 'landing' ? 'landing' : 'login'}-${theme}-${viewport.id}.html"`)
      .replaceAll('landing-light-desktop.html', `landing-${theme}-${viewport.id}.html`);
    const html = `<!doctype html>\n<html lang="en" data-theme="${theme}" data-screen="${screen.id}" data-viewport="${viewport.id}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="retrest-tokens-sha256" content="${fingerprint}"><meta name="retrest-reference-width" content="${viewport.width}"><title>${escape(title)}</title><style>${css}</style></head><body>${markup}</body></html>\n`;
    const htmlPath = `screens/${id}.html`;
    const screenshot = `screenshots/${id}.png`;
    write(htmlPath, html);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Opposite OS preference proves that each reference's explicit mode wins.
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    const requests = [];
    const onRequest = (request) => { if (/^https?:/i.test(request.url())) requests.push(request.url()); };
    page.on('request', onRequest);
    await page.goto(pathToFileURL(join(destination, htmlPath)).href);
    await page.evaluate(async () => { await document.fonts.load('400 16px Inter'); await document.fonts.ready; });
    const state = await page.evaluate(() => ({
      font: document.fonts.check('400 16px Inter'), scripts: document.scripts.length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      height: Math.max(innerHeight, document.documentElement.scrollHeight), copy: document.body.innerText.trim(),
      background: getComputedStyle(document.body).backgroundColor,
    }));
    page.off('request', onRequest);
    if (!state.font || state.scripts || state.overflow || requests.length || state.copy.length < 100) throw new Error(`Invalid self-contained reference: ${id}`);
    mkdirSync(join(destination, 'screenshots'), { recursive: true });
    await page.screenshot({ path: join(destination, screenshot), fullPage: true });
    generated.add(screenshot);
    captures.push({ ...screen, id, screen: screen.id, title, theme, viewport: viewport.id, width: viewport.width, viewport_height: viewport.height, height: state.height, html: htmlPath, screenshot, tokens_sha256: fingerprint, copy: state.copy });
    console.log(`Captured ${id} (${viewport.width} × ${state.height})`);
  }
  if (errors.length) throw new Error(`Browser errors in the export: ${errors.join(', ')}`);

  const sourceFiles = ['design-tokens/tokens.json', 'design-tokens/src/base.css', 'design-tokens/src/theme.tsx', 'design-tokens/assets/fonts/Inter.ttf', 'frontend/src/components/AuthCard.tsx', 'frontend/src/components/ProfileCard.tsx', 'frontend/src/components/WorkspaceLayout.tsx', 'frontend/src/components/PwaStatus.tsx', 'frontend/src/styles.css', 'landing-page/src/App.tsx', 'landing-page/src/components/FeatureCard.tsx', 'landing-page/src/styles.css', 'scripts/export-stitch.mjs', 'scripts/stitch-export/render.tsx', 'scripts/stitch-export/pwa.ts', 'scripts/stitch-export/reference.css', 'scripts/stitch-export/spec.mjs', 'scripts/stitch-export/HANDOFF.md', 'scripts/stitch-export/upload.mjs', 'scripts/stitch-export/serve.mjs', 'scripts/stitch-export/package.mjs', 'scripts/stitch-export/.env.example'];
  const manifest = {
    schema_version: 1, name: 'RETREST Google Stitch reference export', created_at: new Date().toISOString(),
    source: 'Current frontend and landing-page React/Vite workspaces', data: 'Fictional fixtures; no real sessions, env files or database data',
    tokens_sha256: fingerprint, core_screen_count: screens.length, variant_count: captures.length,
    stitch_mcp_connected: false, remote_upload_performed: false, native_figma_document: false,
    screens: captures, sources: sourceFiles.map((path) => ({ path, sha256: sha256(readFileSync(join(root, path))) })), files: [],
  };
  write('stitch-prompts.md', prompts(manifest));
  write('sync-map.example.json', JSON.stringify({ schema_version: 1, tokens_sha256: fingerprint, stitch_project_url: '', figma_document_url: '', variants: captures.map((screen) => ({ id: screen.id, stitch_screen_url: '', figma_frame_url: '', reviewed_tokens_sha256: '' })) }, null, 2) + '\n');
  write('IMPORT-URLS.txt', 'Open an individual HTML screen before capturing/importing; the root page is a review gallery.\nDesktop capture width: 1440px. Mobile capture width: 390px.\n\n' + captures.map((screen) => `http://localhost:4401/${screen.html}`).join('\n') + '\n');
  const cards = captures.map((screen) => `<article class="panel stack"><a href="${screen.html}"><img src="${screen.screenshot}" alt="${escape(screen.title)} preview" loading="lazy"><h2>${escape(screen.title)}</h2></a><p class="muted">${screen.width}px wide · ${screen.height}px full height</p><div class="row"><a href="${screen.html}">Open full HTML ↗</a><a href="${screen.screenshot}">PNG reference</a></div></article>`).join('\n');
  write('index.html', `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RETREST · Stitch reference gallery</title><style>${themeCss}\n${base.replace('../assets/fonts/Inter.ttf', 'fonts/Inter.ttf')}\nmain{padding-block:var(--space-7)}header{margin-bottom:var(--space-6)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-5)}img{width:100%;height:240px;object-fit:cover;object-position:top;border:1px solid var(--color-border);border-radius:var(--radius-sm)}article>a{color:inherit;text-decoration:none}</style></head><body><main class="shell"><header class="stack"><span class="eyebrow">RETREST / Current app / Team reference</span><h1>Stitch screen references.</h1><p>Six views, Light/Dark, desktop/mobile. Each HTML contains real elements, inline CSS and embedded Inter.</p><p class="notice">For editable layout import, <a href="screens/login-light-desktop.html">open an individual HTML screen</a> before capturing. This gallery contains image thumbnails.</p><div class="row"><a href="DESIGN.md">Design system</a><a href="stitch-prompts.md">Screen prompts</a><a href="README.md">Stitch → Figma guide</a><a href="tokens.json">Tokens Studio JSON</a></div></header><section class="grid">${cards}</section></main></body></html>\n`);
  manifest.files = [...generated].sort().map((path) => { const bytes = readFileSync(join(destination, path)); return { path, bytes: bytes.length, sha256: sha256(bytes) }; });
  write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  mkdirSync(join(root, 'exports'), { recursive: true });
  const entries = Object.fromEntries([...generated].sort().map((path) => [`stitch-export/${path}`, new Uint8Array(readFileSync(join(destination, path)))]));
  writeFileSync(zipPath, zipSync(entries, { level: 6 }));
  console.log(`Created ${zipPath} (${(readFileSync(zipPath).length / 1024 / 1024).toFixed(1)} MB).`);
} finally {
  if (browser) await browser.close();
  rmSync(work, { recursive: true, force: true });
}
