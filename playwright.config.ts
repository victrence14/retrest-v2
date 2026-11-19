import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173', headless: true },
  webServer: [
    { command: 'npm run preview:frontend', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview:landing', url: 'http://localhost:4174', reuseExistingServer: !process.env.CI },
  ],
});
