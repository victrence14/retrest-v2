import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sha256, privatePath, hasExternalStyles, safePath, validatePackage } from './package.mjs';
import { startPreviewServer } from './serve.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'retrest-stitch-test-'));
  mkdirSync(join(root, 'screens'));
  const files = { 'tokens.json': '{}\n', 'DESIGN.md': '# Test fixture\n', 'stitch-prompts.md': 'Test reference\n', 'screens/test.html': '<!doctype html><p>Fictional reference</p>', 'test.png': 'PNG fixture' };
  for (const [path, bytes] of Object.entries(files)) writeFileSync(join(root, path), bytes);
  const fingerprint = sha256(files['tokens.json']);
  const manifest = { schema_version: 1, tokens_sha256: fingerprint, screens: [{ html: 'screens/test.html', screenshot: 'test.png', title: 'Test screen', tokens_sha256: fingerprint }], files: Object.entries(files).map(([path, data]) => ({ path, bytes: Buffer.byteLength(data), sha256: sha256(data) })) };
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}

test('portable validation rejects traversal, private files, external styles and modified references', () => {
  const { root, manifest } = fixture();
  try {
    assert.equal(validatePackage(root).tokens_sha256, manifest.tokens_sha256);
    for (const path of ['../outside', '/etc/passwd', 'screens/../../outside', 'screens\\test.html', '.env', '.env.local', '.git/config']) assert.throws(() => safePath(root, path));
    assert.equal(privatePath('.env.example'), false);
    assert.equal(privatePath('folder/.env.example'), false);
    assert.equal(privatePath('folder/.env.example.backup'), true);
    assert.equal(hasExternalStyles("@font-face{src:url('data:font/ttf;base64,abc')};a{background:url(data:image/png;base64,abc)}"), false);
    for (const css of ["url('../font.ttf')", 'url(https://example.test/font.ttf)', '@import "theme.css"', "url('//example.test/font.ttf')"]) assert.equal(hasExternalStyles(css), true);
    symlinkSync(join(root, '..'), join(root, 'escape'));
    assert.throws(() => safePath(root, 'escape'), /escapes/);
    writeFileSync(join(root, 'screens/test.html'), '<p>Changed after review</p>');
    assert.throws(() => validatePackage(root), /Export changed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('preview tries another port without disrupting the existing server and respects a fixed port', async () => {
  const { root } = fixture();
  const occupied = createServer((_request, response) => response.end('Existing server'));
  let preview;
  try {
    await new Promise((ready) => occupied.listen(0, '127.0.0.1', ready));
    const port = occupied.address().port;
    const messages = [];
    preview = await startPreviewServer({ root, port, log: (message) => messages.push(message) });
    const previewPort = preview.address().port;
    assert.ok(previewPort > port);
    assert.ok(messages.some((message) => message.includes(`Port ${port} is already in use`)));
    assert.ok(messages.some((message) => message.includes(`http://localhost:${previewPort}/screens/login-light-desktop.html`)));
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'Existing server');
    const screen = await fetch(`http://127.0.0.1:${previewPort}/screens/test.html`);
    assert.equal(screen.status, 200);
    assert.match(await screen.text(), /Fictional reference/);
    writeFileSync(join(root, '.env'), 'STITCH_API_KEY=fixture_private_key');
    assert.equal((await fetch(`http://127.0.0.1:${previewPort}/.env`)).status, 404);
    await assert.rejects(startPreviewServer({ root, port, strictPort: true, log: () => {} }), /already in use.*choose another port/);
    await assert.rejects(startPreviewServer({ root, port: NaN, log: () => {} }), /must be an integer/);
  } finally {
    for (const server of [preview, occupied]) if (server?.listening) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('upload defaults to no network; explicit upload sends verified reference documents and stops on failure', () => {
  const { root } = fixture();
  try {
    for (const name of ['upload.mjs', 'package.mjs']) copyFileSync(new URL(name, import.meta.url), join(root, name));
    writeFileSync(join(root, '.env'), 'STITCH_API_KEY=fixture_private_key\nSTITCH_PROJECT_ID=fixture_project\n');
    const moduleUrl = pathToFileURL(join(root, 'upload.mjs')).href;
    const base = `import assert from 'node:assert/strict';
      delete process.env.STITCH_API_KEY; delete process.env.STITCH_PROJECT_ID; delete process.env.STITCH_API_BASE_URL;
      process.argv = ['node', 'upload.mjs'];`;
    const run = (code) => spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 15_000 });
    const dry = run(`${base} globalThis.fetch = () => { throw new Error('Unexpected network request'); }; await import(${JSON.stringify(moduleUrl)});`);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Dry run: no credentials loaded and no network requests/);
    assert.ok(!dry.stdout.includes('fixture_private_key'));
    const upload = run(`${base}
      process.argv.push('--upload'); let count = 0;
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://stitch.googleapis.com/v1/projects/fixture_project/screens:batchCreate');
        assert.equal(options.headers['X-Goog-Api-Key'], 'fixture_private_key');
        const body = JSON.parse(options.body); assert.equal(body.parent, 'projects/fixture_project'); assert.equal(body.createScreenInstances, true);
        const screen = body.requests[0].screen; assert.equal(screen.screenType, 'DOCUMENT'); assert.equal(screen.isCreatedByClient, true);
        assert.equal(screen.generatedBy, count ? 'UserUploadedHtml' : 'UserUploadedDesignMd');
        assert.equal(screen.htmlCode.mimeType, count ? 'text/html' : 'text/markdown');
        assert.ok(Buffer.from(screen.htmlCode.fileContentBase64, 'base64').toString().includes(count ? 'Fictional reference' : 'Test fixture'));
        count++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
      };
      await import(${JSON.stringify(moduleUrl)}); assert.equal(count, 2);`);
    assert.equal(upload.status, 0, upload.stderr);
    assert.ok(!upload.stdout.includes('fixture_private_key'));
    const failure = run(`${base} process.argv.push('--upload'); let count = 0;
      globalThis.fetch = async () => { count++; return { ok: count === 1, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }; };
      await assert.rejects(import(${JSON.stringify(moduleUrl)}), /HTTP 503.*earlier documents may already exist/); assert.equal(count, 2);`);
    assert.equal(failure.status, 0, failure.stderr);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
