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
      // ANGLE renderer — real GPU locally; software fallback on GitHub-hosted CI (see the 2026-05-05 note below). Software ANGLE was dropped 2026-05-02
      // per docs/superpowers/notes/2026-04-28-flake-regression-analysis.md
      // recommendation D: it was the documented largest single contributor
      // to the flake rate and ran ~8 min for tests that don't need GPU at all.
      //
      // 2026-05-05 follow-up (PR #36 flake-triage): on GitHub-hosted ubuntu-latest
      // there's no real GPU, so `--use-angle=default` falls back to SwiftShader
      // (Chromium's slow built-in software renderer). Mitigations:
      //   1. Install Mesa/llvmpipe via apt in CI (see .github/workflows/ci.yml).
      //   2. Use Playwright v1.49+'s "new headless" via `channel: 'chromium'`
      //      so GPU/WebGL handling matches headed mode (chromium-headless-shell
      //      is more aggressive about disabling GPU, which compounds with
      //      software-rendering slowness).
      timeout: isCi ? 120_000 : 60_000,
      expect: { timeout: isCi ? 15_000 : 5_000 },
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        actionTimeout: isCi ? 20_000 : 5_000,
        // Emulate prefers-reduced-motion: reduce so the existing
        // `@media (prefers-reduced-motion: reduce)` rule in src/index.css
        // collapses every animation to ~0ms. Eliminates the entire
        // animation-driven actionability flake class on Linux/ANGLE CI.
        // See docs/superpowers/notes/2026-05-04-bug-31-diagnosis.md.
        //
        // Playwright 1.59 has no dedicated `reducedMotion` test option — a bare
        // `reducedMotion: 'reduce'` here is silently dropped. The supported
        // route is `contextOptions` (see the testOptions.contextOptions docs).
        contextOptions: { reducedMotion: 'reduce' },
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      // Combined testMatch: every spec previously in chromium + chromium-gpu.
      testMatch: [
        // formerly chromium-gpu (real-GPU-needing):
        'animation-interrupt.spec.ts',
        'webgl-context-loss.spec.ts',
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
        // formerly chromium (DOM-only, run on real-GPU now to consolidate):
        'scaffold.spec.ts',
        'canonical-195.spec.ts',
        'cold-load-deep-link.spec.ts',
        'search.spec.ts',
        'theme-and-responsive.spec.ts',
        'accessibility.spec.ts',
        'panel-and-deeplink.spec.ts',
        'meta-and-static.spec.ts',
        'panel-focus.spec.ts',
        'satellite-default.spec.ts',
        'a11y-contrast.spec.ts',
        'a11y-keyboard-smoke.spec.ts',
        'launcher.spec.ts',
        'launcher-focus-order.spec.ts',
        'launcher-card-loading-states.spec.ts',
        'launcher-backdrop-dismiss.spec.ts',
        'axe-snapshot.spec.ts',
        'label-contrast.spec.ts',
        'mobile-panel-header.spec.ts',
        'compare-source-attribution.spec.ts',
        'source-tooltip-edge.spec.ts',
        'source-tooltip-keyboard.spec.ts',
        'header-play-reopens-launcher.spec.ts',
      ],
      // Specs that consistently flake on free GitHub-hosted ubuntu-latest runners
      // due to cold-WebGL slowness (no real GPU; SwiftShader/llvmpipe is 5-10x
      // slower than headed local). They run reliably locally — only excluded in CI.
      // Documented in docs/superpowers/notes/2026-05-05-flake-watch.md and
      // docs/roadmap.md § "Flaky-on-free-CI specs (need GPU runner)". Removing
      // this list once we move to a self-hosted GPU runner is the exit criterion.
      // Tracking issue: #106
      testIgnore: isCi
        ? [
            'label-contrast.spec.ts',
            'header-play-reopens-launcher.spec.ts',
            'panel-focus.spec.ts',
            'accessibility.spec.ts',
            'axe-snapshot.spec.ts',
            'reveal-animation.spec.ts',
            'search.spec.ts',
            'game-country-pinning.spec.ts',
            'theme-and-responsive.spec.ts',
            'source-tooltip-edge.spec.ts',
          ]
        : [],
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      testMatch: [
        'mobile-smoke.spec.ts',
        'mobile-tap.spec.ts',
        'mobile-free-play.spec.ts',
        'tutorial-first-click.spec.ts',
      ],
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
      testMatch: [
        'mobile-smoke.spec.ts',
        'mobile-tap.spec.ts',
        // Phase 5.5 — canonical DOM specs added to surface WebKit CSS/DOM regressions.
        // No clipboard (permissions:[]), no GPU/map interaction — safe on WebKit.
        // panel-and-deeplink.spec.ts excluded: its `Country Panel` describe block
        // assumes a desktop viewport (≥1024px) for secondary fields (Government,
        // border chips). This project uses iPhone 14 (390px) — secondary fields are
        // hidden behind the expand button on mobile, causing 2/7 tests to fail.
        // Those tests pass on the `chromium` project (desktop viewport); the mobile-
        // specific bottom-sheet tests are already in the chromium testMatch too.
        'theme-and-responsive.spec.ts',
        'launcher-card-loading-states.spec.ts',
      ],
    },
    {
      name: 'desktop-firefox-touch',
      use: {
        defaultBrowserType: 'firefox',
        viewport: { width: 412, height: 839 },
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
        // Firefox rejects 'clipboard-read'/'clipboard-write' from the
        // top-level `use.permissions` (Unknown permission). Override to empty
        // for this project — the mobile smoke spec doesn't use clipboard.
        permissions: [],
      },
      testMatch: [
        'mobile-smoke.spec.ts',
        'mobile-tap.spec.ts',
        // Phase 5.5 — canonical DOM specs added to surface Firefox CSS/DOM regressions.
        // No clipboard (permissions:[]), no GPU/map interaction — safe on Firefox.
        // panel-and-deeplink.spec.ts excluded: same reason as mobile-webkit —
        // this project uses a 412px viewport (below the 1024px desktop cutoff),
        // so the `Country Panel` describe block's desktop-assumption tests fail.
        'theme-and-responsive.spec.ts',
        'launcher-card-loading-states.spec.ts',
      ],
    },
  ],
  webServer: {
    command: 'npm run build:e2e && npm run preview -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
