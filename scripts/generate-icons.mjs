// Small code-drawn shield icons: no image service or binary dependency required.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const tokens = JSON.parse(readFileSync(new URL('../design-tokens/tokens.json', import.meta.url), 'utf8'));
const hex = (value) => value.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
const background = hex(tokens.global.palette.forest.value);
const foreground = hex(tokens.global.palette.sage.value);
const output = new URL('../frontend/public/icons/', import.meta.url);
mkdirSync(output, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([size, label, data, crc]);
}
function inPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distance(x, y, ax, ay, bx, by) {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
}
function icon(size, scale) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  const shield = [[.5, .2], [.74, .3], [.74, .5], [.7, .64], [.6, .74], [.5, .8], [.4, .74], [.3, .64], [.26, .5], [.26, .3]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x / size - .5) / scale + .5; const ny = (y / size - .5) / scale + .5;
    const check = Math.min(distance(nx, ny, .38, .48, .47, .57), distance(nx, ny, .47, .57, .64, .38)) < .025;
    const color = inPolygon(nx, ny, shield) && !check ? foreground : background;
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    rows.set([...color, 255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size, scale] of [['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['maskable-512.png', 512, .8], ['apple-touch-icon.png', 180, 1]]) {
  writeFileSync(new URL(name, output), icon(size, scale));
}
console.log('Generated 192px, 512px, maskable and Apple touch icons.');
