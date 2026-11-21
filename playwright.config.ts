import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: 'product.spec.ts',
  workers: 1,
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173', headless: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: 'npm run preview:starter-frontend', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview:starter-landing', url: 'http://localhost:4174', reuseExistingServer: !process.env.CI },
  ],
});
