import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { flatten, resolve, type TokenDocument } from './scripts/build.mjs';

export function themeBootstrap(): Plugin {
  return {
    name: 'retrest-theme-bootstrap',
    transformIndexHtml() {
      const tokens: TokenDocument = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'));
      const global = flatten(tokens.global);
      const accent = (theme: 'light' | 'dark') => resolve('{color.accent}', { ...global, ...flatten(tokens[theme]) });
      const colors = { light: accent('light'), dark: accent('dark') };
      return [{
        tag: 'meta',
        attrs: { name: 'theme-color', content: colors.light },
        injectTo: 'head-prepend',
      }, {
        tag: 'script',
        children: readFileSync(new URL('./src/theme-init.js', import.meta.url), 'utf8')
          .replace('__RETREST_THEME_COLORS__', JSON.stringify(colors)),
        injectTo: 'head-prepend',
      }];
    },
  };
}
