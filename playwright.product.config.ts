import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Never run destructive demo resets against the user's normal server.
if (!process.env.FE2_DISPOSABLE_APP || !existsSync(join(process.env.FE2_DISPOSABLE_APP, '.fe2-disposable')) || !process.env.TEST_ORIGIN) {
  throw new Error('Run npm run test:product. It creates a disposable app/database before browser verification.');
}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'product.spec.ts',
  outputDir: './test-results/fe2-product',
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: { baseURL: process.env.TEST_ORIGIN, headless: true, trace: 'retain-on-failure', video: 'on' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
