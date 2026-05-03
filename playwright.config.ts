import { defineConfig, devices } from '@playwright/test'
const isCi = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  // Per-project overrides take precedence; the chromium project bumps these on CI.
  timeout: 60_000,
  expect: { timeout: isCi ? 10_000 : 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
    actionTimeout: isCi ? 15_000 : 5_000,
  },
  projects: [
    {
      name: 'chromium',
      // Real-GPU-backed ANGLE renderer. Software ANGLE was dropped 2026-05-02
      // per docs/superpowers/notes/2026-04-28-flake-regression-analysis.md
      // recommendation D: it was the documented largest single contributor
      // to the flake rate and ran ~8 min for tests that don't need GPU at all.
      timeout: isCi ? 120_000 : 60_000,
      expect: { timeout: isCi ? 15_000 : 5_000 },
      use: {
        ...devices['Desktop Chrome'],
        actionTimeout: isCi ? 20_000 : 5_000,
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      // Combined testMatch: every spec previously in chromium + chromium-gpu.
      testMatch: [
        // formerly chromium-gpu (real-GPU-needing):
        'map-and-countries.spec.ts',
        'map-reliability.spec.ts',
        'keyboard-map-nav.spec.ts',
        'game-country-pinning.spec.ts',
        'game-city-guessing.spec.ts',
        'game-over-mode-switch.spec.ts',
        'compare-view-dimming.spec.ts',
        'reveal-animation.spec.ts',
        'reveal-animation-reduced-motion.spec.ts',
        'tutorial-first-click.spec.ts',
        'daily-share-block-immediate.spec.ts',
        'daily-survives-ocean-click.spec.ts',
        'daily-reveal-on-final-attempt.spec.ts',
        // formerly chromium (DOM-only, run on real-GPU now to consolidate):
        'scaffold.spec.ts',
        'canonical-195.spec.ts',
        'search.spec.ts',
        'theme-and-responsive.spec.ts',
        'accessibility.spec.ts',
        'panel-and-deeplink.spec.ts',
        'meta-and-static.spec.ts',
        'panel-focus.spec.ts',
        'satellite-default.spec.ts',
        'a11y-contrast.spec.ts',
        'a11y-keyboard-smoke.spec.ts',
        'country-news.spec.ts',
        'launcher.spec.ts',
        'daily-puzzle.spec.ts',
        'daily-best-of-3.spec.ts',
        'daily-streak.spec.ts',
        'daily-reveal.spec.ts',
        'daily-share.spec.ts',
        'daily-deep-link.spec.ts',
        'launcher-history.spec.ts',
        'telemetry-deep-link.spec.ts',
      ],
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      testMatch: ['mobile-smoke.spec.ts', 'mobile-tap.spec.ts', 'mobile-daily-flow.spec.ts', 'mobile-free-play.spec.ts', 'tutorial-first-click.spec.ts'],
    },
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 14'],
        // WebKit rejects 'clipboard-read'/'clipboard-write' from the top-level
        // `use.permissions` (Unknown permission). Override to empty for the
        // mobile-webkit project — the mobile smoke spec doesn't use clipboard.
        permissions: [],
      },
      testMatch: ['mobile-smoke.spec.ts', 'mobile-tap.spec.ts'],
    },
    {
      name: 'desktop-firefox-touch',
      use: {
        defaultBrowserType: 'firefox',
        viewport: { width: 412, height: 839 },
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
        // Firefox rejects 'clipboard-read'/'clipboard-write' from the
        // top-level `use.permissions` (Unknown permission). Override to empty
        // for this project — the mobile smoke spec doesn't use clipboard.
        permissions: [],
      },
      testMatch: ['mobile-smoke.spec.ts', 'mobile-tap.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run build:e2e && npm run preview -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
