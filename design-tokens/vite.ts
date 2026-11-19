import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export function themeBootstrap(): Plugin {
  return {
    name: 'retrest-theme-bootstrap',
    transformIndexHtml() {
      return [{
        tag: 'script',
        children: readFileSync(new URL('./src/theme-init.js', import.meta.url), 'utf8'),
        injectTo: 'head-prepend',
      }];
    },
  };
}
