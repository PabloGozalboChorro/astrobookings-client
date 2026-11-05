import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = 'http://localhost:5174';
const SMOKE_BASE_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/smoke/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: '**/smoke/**',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'smoke',
      testDir: './tests/e2e/smoke',
      use: { ...devices['Desktop Chrome'], baseURL: SMOKE_BASE_URL },
    },
  ],
  webServer: {
    command: 'npx vite --mode e2e --port 5174 --strictPort',
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
