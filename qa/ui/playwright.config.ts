import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for UI Visual QA
 *
 * Runs visual tests across 3 viewports: desktop, tablet, mobile
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // Run sequentially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for consistent screenshots
  reporter: [
    ['html', { outputFolder: '../../playwright-report' }],
    ['json', { outputFile: '../../playwright-results.json' }],
  ],
  timeout: 60000, // 60s per test
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: process.env.APP_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop viewport (1440x900)
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    // Tablet viewport (834x1194 - iPad Pro dimensions, Chromium engine)
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 834, height: 1194 },
        isMobile: true,
        hasTouch: true,
      },
    },
    // Mobile viewport (390x844 - iPhone 14 Pro dimensions, Chromium engine)
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
