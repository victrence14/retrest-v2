import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { sha256, validatePackage, privatePath, hasExternalStyles } from './package.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = join(root, 'stitch-export');
const manifest = validatePackage(folder);
assert.equal(manifest.core_screen_count, 6);
assert.equal(manifest.variant_count, 24);
assert.equal(manifest.screens.length, 24);
assert.equal(new Set(manifest.screens.map((screen) => screen.id)).size, 24);
assert.equal(manifest.remote_upload_performed, false);
assert.equal(manifest.native_figma_document, false);
for (const source of manifest.sources) assert.equal(sha256(readFileSync(join(root, source.path))), source.sha256, `Source changed; regenerate the export: ${source.path}`);
assert.equal(readFileSync(join(folder, 'tokens.json'), 'utf8'), readFileSync(join(root, 'design-tokens/tokens.json'), 'utf8'));
for (const screen of manifest.screens) {
  const html = readFileSync(join(folder, screen.html), 'utf8');
  assert.ok(!/<script\b|\bon[a-z]+=/i.test(html) && !hasExternalStyles(html), `Unexpected script or external resource: ${screen.id}`);
  assert.ok(!/<form(?! inert)[\s>]/.test(html), `Interactive form: ${screen.id}`);
  assert.ok(html.includes(`data-theme="${screen.theme}"`));
  assert.ok(html.includes(manifest.tokens_sha256));
  assert.ok(html.includes('data:font/ttf;base64,'));
  const png = readFileSync(join(folder, screen.screenshot));
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(png.readUInt32BE(16), screen.width);
  assert.equal(png.readUInt32BE(20), screen.height);
}
const entries = unzipSync(readFileSync(join(root, 'exports/retrest-stitch-export.zip')));
assert.deepEqual(Object.keys(entries).sort(), [...manifest.files.map((file) => `stitch-export/${file.path}`), 'stitch-export/manifest.json'].sort());
for (const [path, bytes] of Object.entries(entries)) {
  assert.ok(!privatePath(path), `Private file in ZIP: ${path}`);
  assert.equal(sha256(bytes), sha256(readFileSync(join(root, path))), `ZIP differs from the package: ${path}`);
}
const environment = readFileSync(join(folder, '.env.example'), 'utf8');
assert.match(environment, /^STITCH_API_KEY=$/m);
assert.match(environment, /^STITCH_PROJECT_ID=$/m);
assert.ok(!/^VITE_/m.test(environment));
console.log(`Verified ${manifest.variant_count} self-contained HTML references, ${manifest.variant_count} PNGs, source/token fingerprints and ZIP integrity. Private env/database files are excluded.`);
