import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';

const zip = readFileSync(new URL('../../exports/retrest-ui-export.zip', import.meta.url));
const entries = unzipSync(zip);
const prefix = 'retrest-ui-export/';
const manifest = JSON.parse(Buffer.from(entries[prefix + 'EXPORT-MANIFEST.json']).toString('utf8'));
assert.equal(manifest.screen_count, 12);
assert.equal(manifest.capture_count, 24);
assert.equal(manifest.native_figma_document, false);
for (const file of manifest.files) {
  const data = entries[prefix + file.path];
  assert.ok(data, `Missing file: ${file.path}`);
  assert.equal(data.length, file.bytes);
  assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256);
}
for (const capture of manifest.captures) {
  const png = Buffer.from(entries[prefix + capture.file]);
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(png.readUInt32BE(16), capture.width, `Unexpected capture width: ${capture.file}`);
  assert.ok(png.readUInt32BE(20) > 0);
}
for (const screen of manifest.screens) {
  const html = Buffer.from(entries[prefix + screen.html]).toString('utf8');
  assert.ok(!/<script\b|@import\s|fonts\.googleapis\.com/i.test(html));
  assert.ok(!/<form(?! inert)[\s>]/.test(html), `Interactive form in ${screen.id}`);
}
assert.ok(!Object.keys(entries).some((name) => /(?:^|\/)(?:\.env[^/]*|\.git|node_modules|data)(?:\/|$)|\.(?:sqlite|db)$/i.test(name)));
console.log(`Verified ZIP: ${manifest.screen_count} HTML screens, ${manifest.capture_count} PNGs, ${manifest.files.length} checksummed files; no private environment/database files.`);
