import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-gl=swiftshader'],
        },
      },
      // DOM-only tests work fine with SwiftShader
      testMatch: [
        'scaffold.spec.ts',
        'search.spec.ts',
        'theme-and-responsive.spec.ts',
        'accessibility.spec.ts',
        'panel-and-deeplink.spec.ts',
        'meta-and-static.spec.ts',
        'panel-focus.spec.ts',
        'satellite-default.spec.ts',
        'a11y-contrast.spec.ts',
        'launcher.spec.ts',
        'daily-puzzle.spec.ts',
        'daily-streak.spec.ts',
        'daily-reveal.spec.ts',
        'launcher-history.spec.ts',
      ],
    },
    {
      name: 'chromium-gpu',
      use: {
        ...devices['Desktop Chrome'],
        // No SwiftShader — uses real GPU for WebGL2
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      // Map interaction tests need real GPU
      testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts', 'game-country-pinning.spec.ts', 'game-city-guessing.spec.ts', 'compare-view-dimming.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
