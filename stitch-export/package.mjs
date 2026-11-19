import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function hasExternalStyles(css) {
  return /@import\b/i.test(css) || [...css.matchAll(/url\(([^)]*)\)/gi)].some(([, value]) => !value.trim().replace(/^['"]|['"]$/g, '').startsWith('data:'));
}
export const privatePath = (path) => /(?:^|\/)(?:\.env(?!\.example$)[^/]*|\.git|node_modules|data)(?:\/|$)|\.(?:sqlite|db)$/i.test(path);
export function packageFiles(root, prefix = '') {
  return readdirSync(resolve(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (privatePath(path)) return [];
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not permitted in the export: ${path}`);
    return entry.isDirectory() ? packageFiles(root, path) : [path];
  }).sort();
}
export function safePath(root, path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.startsWith('/') || path.split('/').some((part) => part === '.' || part === '..' || !part) || privatePath(path)) throw new Error('Unsafe export path.');
  const resolved = realpathSync(resolve(root, path));
  if (!resolved.startsWith(realpathSync(root) + sep)) throw new Error('Export path escapes the package.');
  return resolved;
}
export function validatePackage(root) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.screens)) throw new Error('Unsupported export manifest.');
  const seen = new Set();
  for (const file of manifest.files) {
    if (seen.has(file.path)) throw new Error(`Duplicate export path: ${file.path}`);
    seen.add(file.path);
    const bytes = readFileSync(safePath(root, file.path));
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Export changed; regenerate or restore before uploading: ${file.path}`);
  }
  for (const path of ['DESIGN.md', 'tokens.json', 'stitch-prompts.md', ...manifest.screens.flatMap((screen) => [screen.html, screen.screenshot])]) if (!seen.has(path)) throw new Error(`Unverified reference: ${path}`);
  if (sha256(readFileSync(safePath(root, 'tokens.json'))) !== manifest.tokens_sha256) throw new Error('Design token fingerprint does not match.');
  if (manifest.screens.some((screen) => screen.tokens_sha256 !== manifest.tokens_sha256)) throw new Error('A screen uses a different design token version.');
  return manifest;
}
