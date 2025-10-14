import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__',
  testMatch: '**/*.playwright.test.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 3000 --strictPort',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
