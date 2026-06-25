const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  // Both specs open real WebSocket connections against the live deployed
  // backend and drive real Chromium instances — running them in parallel
  // on a single runner caused resource-contention flakiness in the
  // reconnect test's timing assertions. Only 2 tests total, so serial
  // execution isn't a meaningful time cost.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL, // e.g. https://xxxx.cloudfront.net
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
