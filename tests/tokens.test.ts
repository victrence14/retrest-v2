import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-expect-error The dependency-free generator is JavaScript.
import { flatten, generateCss, resolve } from '../design-tokens/scripts/build.mjs';

test('all theme aliases resolve and the generated CSS matches Tokens Studio source', () => {
  const tokens = JSON.parse(readFileSync(new URL('../design-tokens/tokens.json', import.meta.url), 'utf8'));
  const css = generateCss(tokens);
  assert.equal(css, readFileSync(new URL('../design-tokens/generated/theme.css', import.meta.url), 'utf8'));
  assert.equal(resolve('{color.accent}', { ...flatten(tokens.global), ...flatten(tokens.dark) }), '#c7dda7');
  assert.match(css, /prefers-color-scheme: dark/);
});

test('invalid aliases and divergent themes fail before shipping broken CSS', () => {
  assert.throws(() => resolve('{missing}', {}), /Unknown token/);
  assert.throws(() => resolve('{a}', { a: '{b}', b: '{a}' }), /Circular token/);
  assert.throws(() => generateCss({ global: {}, light: { a: { value: 'red' } }, dark: {} }), /same tokens/);
});
