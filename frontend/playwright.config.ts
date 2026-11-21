import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: { baseURL: process.env.TEST_ORIGIN ?? "http://localhost:3000", headless: true },
});
