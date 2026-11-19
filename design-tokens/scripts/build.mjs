import { readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const kebab = (value) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export function flatten(group, prefix = '', output = {}) {
  for (const [name, token] of Object.entries(group)) {
    if (name.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if ('value' in token) output[path] = token.value;
    else flatten(token, path, output);
  }
  return output;
}

export function resolve(value, tokens, chain = []) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Only scalar tokens are supported.');
  return String(value).replace(/\{([^}]+)\}/g, (_, name) => {
    if (!(name in tokens)) throw new Error(`Unknown token: ${name}`);
    if (chain.includes(name)) throw new Error(`Circular token: ${name}`);
    return resolve(tokens[name], tokens, [...chain, name]);
  });
}

export function generateCss(document) {
  const global = flatten(document.global);
  const light = flatten(document.light);
  const dark = flatten(document.dark);
  if (Object.keys(light).sort().join() !== Object.keys(dark).sort().join()) throw new Error('Light and Dark must define the same tokens.');
  const declarations = (set) => Object.entries(set).map(([name, value]) => {
    const resolved = resolve(value, { ...global, ...set }, [name]);
    return `  --${name.split('.').map(kebab).join('-')}: ${resolved};`;
  }).join('\n');
  return `/* Generated from tokens.json. Run npm run tokens:build. */\n:root {\n${declarations(global)}\n${declarations(light)}\n  color-scheme: light;\n}\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${declarations(dark)}\n    color-scheme: dark;\n  }\n}\n:root[data-theme="dark"] {\n${declarations(dark)}\n  color-scheme: dark;\n}\n`;
}

function build() {
  const tokens = JSON.parse(readFileSync(`${root}tokens.json`, 'utf8'));
  mkdirSync(`${root}generated`, { recursive: true });
  writeFileSync(`${root}generated/theme.css`, generateCss(tokens));
  const global = flatten(tokens.global);
  const light = flatten(tokens.light);
  writeFileSync(new URL('../../frontend/public/manifest.json', import.meta.url), JSON.stringify({
    id: '/', name: 'RETREST — Your money. Your rules.', short_name: 'RETREST',
    description: 'Your personal space for recurring payments and financial peace.',
    lang: 'en', start_url: '/', scope: '/', display: 'standalone',
    theme_color: resolve(light['color.accent'], { ...global, ...light }),
    background_color: resolve(light['color.background'], { ...global, ...light }),
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }, null, 2) + '\n');
  console.log('Built shared theme CSS and PWA manifest.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build();
  if (process.argv.includes('--watch')) {
    watch(`${root}tokens.json`, () => { try { build(); } catch (error) { console.error(error); } });
  }
}
