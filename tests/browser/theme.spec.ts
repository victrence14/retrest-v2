import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { flatten, resolve } from '../../design-tokens/scripts/build.mjs';

type Theme = 'light' | 'dark';
const tokens = JSON.parse(readFileSync(new URL('../../design-tokens/tokens.json', import.meta.url), 'utf8'));
const global = flatten(tokens.global);
const color = (theme: Theme, name: string) => resolve(`{color.${name}}`, { ...global, ...flatten(tokens[theme]) });
const rgb = (hex: string) => `rgb(${hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16)).join(', ')})`;

// Theme verification does not depend on the PWA or a Supabase project.
test.use({ serviceWorkers: 'block' });

async function expectTheme(page: Page, theme: Theme, rendered = true) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', color(theme, 'accent'));
  await expect.poll(() => page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return { background: body.backgroundColor, text: body.color, scheme: root.colorScheme };
  })).toEqual({ background: rgb(color(theme, 'background')), text: rgb(color(theme, 'text')), scheme: theme });
  if (!rendered) return;
  await expect(page.getByLabel('Theme preference')).toBeVisible();
  await expect.poll(() => page.getByLabel('Theme preference').evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, text: style.color, accent: style.accentColor };
  })).toEqual({ background: rgb(color(theme, 'background')), text: rgb(color(theme, 'text')), accent: rgb(color(theme, 'accent')) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const [site, url] of [['frontend', 'http://localhost:4173'], ['landing', 'http://localhost:4174']] as const) {
  test.describe(site, () => {
    for (const system of ['light', 'dark'] as const) {
      test(`uses the ${system} system preference and follows live changes`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: system });
        await page.goto(url);
        await expectTheme(page, system);
        await expect(page.getByLabel('Theme preference')).toHaveValue('system');
        const opposite = system === 'dark' ? 'light' : 'dark';
        await page.emulateMedia({ colorScheme: opposite });
        await expectTheme(page, opposite);
        expect(await page.evaluate(() => localStorage.getItem('retrest.theme'))).toBeNull();
      });

      test(`restores saved ${system} mode before the application JavaScript loads`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: system === 'dark' ? 'light' : 'dark' });
        await page.addInitScript((choice) => localStorage.setItem('retrest.theme', choice), system);
        await page.route('**/assets/*.js', (route) => route.abort());
        await page.goto(url);
        await expectTheme(page, system, false);
        await expect(page.locator('html')).toHaveAttribute('data-theme-preference', system);
        await expect(page.locator('#root')).toBeEmpty();
      });
    }

    test('manual overrides persist, ignore OS changes and can return to System', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(url);
      await page.getByRole('button', { name: 'Switch to light mode' }).click();
      await expectTheme(page, 'light');
      expect(await page.evaluate(() => localStorage.getItem('retrest.theme'))).toBe('light');
      await page.reload();
      await expectTheme(page, 'light');
      await expect(page.getByLabel('Theme preference')).toHaveValue('light');
      await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      await expectTheme(page, 'dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await expectTheme(page, 'dark');
      await page.reload();
      await expectTheme(page, 'dark');
      await page.getByLabel('Theme preference').selectOption('system');
      await expectTheme(page, 'light');
      expect(await page.evaluate(() => localStorage.getItem('retrest.theme'))).toBeNull();
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectTheme(page, 'dark');
    });

    test('same-origin tabs synchronize saved choices and removal', async ({ page, context }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(url);
      const other = await context.newPage();
      try {
        await other.emulateMedia({ colorScheme: 'dark' });
        await other.goto(url);
        await expectTheme(other, 'dark');
        await page.getByLabel('Theme preference').selectOption('light');
        await expectTheme(other, 'light');
        await expect(other.getByLabel('Theme preference')).toHaveValue('light');
        await other.getByLabel('Theme preference').selectOption('system');
        await expectTheme(page, 'dark');
        await expect(page.getByLabel('Theme preference')).toHaveValue('system');
        await other.getByLabel('Theme preference').selectOption('light');
        await expectTheme(page, 'light');
        await other.evaluate(() => localStorage.clear());
        await expectTheme(page, 'dark');
        await expect(page.getByLabel('Theme preference')).toHaveValue('system');
      } finally { await other.close(); }
    });

    test('the toggle remains usable when persistent storage is blocked', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.addInitScript(() => {
        for (const method of ['getItem', 'setItem', 'removeItem']) {
          Object.defineProperty(Storage.prototype, method, { configurable: true, value: () => { throw new DOMException('Storage disabled', 'SecurityError'); } });
        }
      });
      await page.goto(url);
      await expectTheme(page, 'dark');
      await page.getByRole('button', { name: 'Switch to light mode' }).click();
      await expectTheme(page, 'light');
      await page.getByLabel('Theme preference').selectOption('system');
      await expectTheme(page, 'dark');
      await page.reload();
      await expectTheme(page, 'dark');
    });

    test('invalid saved preferences fall back to the system safely', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.addInitScript(() => localStorage.setItem('retrest.theme', 'invalid-choice'));
      await page.goto(url);
      await expectTheme(page, 'dark');
      await expect(page.getByLabel('Theme preference')).toHaveValue('system');
    });
  });
}
