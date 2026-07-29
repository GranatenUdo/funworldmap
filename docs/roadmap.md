# Roadmap — Deferred Work

Running list of items deliberately deferred from shipped specs, grouped by area. Each item cites the spec that deferred it so the rationale is recoverable.

This is **not** a product backlog — it's a parking lot for ideas that were scoped out during brainstorming. Promote an item to a spec (and link back here from that spec) when the time is right to build it.

## How to use this doc

- When a spec calls out out-of-scope items, add them here with a back-link to the source spec.
- When picking up an item, open a spec under `docs/superpowers/specs/`, cross-reference this roadmap, and strike the item out here with the spec link.
- Don't add items that are already implemented, already scheduled, or that nobody has proposed. This file is for intentional deferrals only.

---

## Games

### Country Pinning mode

Source: [`2026-04-18-satellite-default-and-game-modes-design.md`](superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md)

- **Share-score image / OG card / tweet card** — generating a social-media preview after a good game.
- **Sound effects** — audio for correct/wrong guess, game over.
- **Multiplayer or online leaderboard** — would require a backend; conflicts with the no-backend principle.
- **Region / difficulty filters for the country pool** — "Europe only", "UN member states only", etc.
- **Neighbour-graph scoring bonus** — adjacency-based partial credit (clicking Portugal when target is Spain scores higher than distance alone implies).
- **i18n of game strings** — English only for v1; strings are routed through each mode's `messages.ts` to enable a mechanical swap later.
- **Mode-picker expansion beyond a single item** — superseded by the City Guessing spec below.

### City Guessing mode

Source: [`2026-04-19-city-guessing-mode-design.md`](superpowers/specs/2026-04-19-city-guessing-mode-design.md)

- **Region / difficulty filters** — "Europe only", "Capitals only", "Africa only".
- **Multiplayer or online leaderboard** — same no-backend constraint as Country Pinning.
- **Share-score image / OG card** — post-game social preview.
- **Sound effects** — audio feedback for guesses and game-over.
- **i18n of game strings** — English-only; wired through `messages.ts` for future swap.
- **Adjustable round count** — fixed at 10 in v1.
- **Population / tooltips / metadata on the reveal marker** — clicking the correct-city marker could open a tooltip with population, country-panel link, etc.
- **Per-round timer** — e.g. "You have 15 seconds to guess."
- **Difficulty tiers** — beginner pool of ~50 capitals, hard pool of lesser-known cities.
- **Camera animation knob** — user-facing slider beyond the `prefers-reduced-motion` branch.
- **Reveal marker animation** (pulse / breathing effect) — v1 uses a static warm-accent circle. Can land later without framework changes.
- **Runtime country-data join for `cities.json`** — v1 inlines country name + flag path per city (~25 KB overhead) for simplicity. If `cities.json` grows, switch to joining against `countries.json`'s `byCca3` at load time.

## Satellite basemap

Source: [`2026-04-18-satellite-default-and-game-modes-design.md`](superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md)

- **Persist the user's toggle choice in `localStorage`** — v1 resets to satellite-default on each fresh visit.
- **Loading skeleton / shimmer for first satellite-tile load** — not built because MapLibre handles partial-load gracefully in practice.
- **Swap to a commercially-licensed tile source if the site ever monetises** — EOX Sentinel-2 is CC BY-NC-SA 4.0; acceptable today, blocks future monetisation without a swap.

## Build / CI

Sources: [`2026-04-16-fix-ci-bugs-and-perf.md`](superpowers/plans/archive/2026-04-16-fix-ci-bugs-and-perf.md) (plan) and the 2026-04-18 PR; [`2026-04-19-assessment-remediation-design.md`](superpowers/specs/2026-04-19-assessment-remediation-design.md) for the three 2026-04-19 entries.

- **Network-stubbed tile mocks for e2e** — removes external-network variance. Worth doing after CI stabilises if residual flake appears.
- ~~**Bundle-size budgets in CI** — `size-limit` or similar to catch silent regressions. The 2026-04-19 assessment noted the `<700 KB` target drifted with Sentry + `cities.json`; enforcing a re-baselined target in CI would have caught it.~~ **Done** (PR #50, 2026-05-14): `scripts/bundle-budget/check.ts` enforces `budgets.json` via `npm run bundle:budget` in CI.
- **Self-hosted GPU runner** — the single `chromium` project runs under `--use-gl=angle --use-angle=default`, which falls back to software rendering on shared Ubuntu runners (no real GPU); several specs are effectively software-renderer-only there. A self-hosted runner with a real GPU would let the CI-skipped specs (see the item below) run in CI again.
- **Flaky-on-free-CI specs (need GPU runner).** The specs in `playwright.config.ts`'s `chromium` project's `testIgnore` (CI-only) consistently flake on GitHub-hosted ubuntu-latest because cold-WebGL on SwiftShader/llvmpipe takes 30–90s for what's near-instant locally — `waitForMapLoaded` and animation-state waits time out before the GPU has finished rasterizing. Mitigations attempted in PR #36 (Mesa/llvmpipe install, Playwright "new headless" mode via `channel: 'chromium'`, 4-way sharding, raised `BASEMAP_LOAD_TIMEOUT_MS` to 30s, fast-fail watchdog wait) reduced but didn't eliminate the flakes. Current state: the listed specs are skipped in CI but run locally; the goal is to put them back into CI once a self-hosted GPU runner exists. Skip list: `label-contrast`, `header-play-reopens-launcher`, `panel-focus`, `accessibility`, `axe-snapshot`, `reveal-animation`, `search`, `game-country-pinning`, `theme-and-responsive`. See [`docs/superpowers/specs/2026-05-05-flake-triage-design.md`](superpowers/specs/2026-05-05-flake-triage-design.md) (option D escalation), [`docs/superpowers/notes/2026-05-05-flake-watch.md`](superpowers/notes/2026-05-05-flake-watch.md).
- ~~**Firefox and Safari e2e projects** — cross-browser coverage from the original Phase 7 exit criteria.~~ **Done** (PR #36 / Phase 5.x): `playwright.config.ts` now has `mobile-webkit` (WebKit/Safari engine) and `desktop-firefox-touch` (Firefox) projects alongside `chromium` and `mobile-chromium`. The legacy `chromium` / `chromium-gpu` split was consolidated into a single `chromium` project on 2026-05-02 (Software ANGLE drop).
- **Lazy Sentry.** The current static `import * as Sentry from '@sentry/react'` in `main.tsx` bundles Sentry regardless of whether a DSN is set. Move to dynamic `import()` inside `initSentry` so a DSN-less build drops the library entirely.

## Rendering

Source: [`2026-04-19-assessment-remediation-design.md`](superpowers/specs/2026-04-19-assessment-remediation-design.md).

- **Revisit atmospheric fog.** `useMapTheme`'s sky call covers atmosphere; a previously-documented `setFog` call was a Mapbox-only API and never ran under MapLibre. A real fog effect would need a deliberate spec.

## Accessibility

- **Color-contrast pass on `GameOverOverlay`.** An axe audit on the overlay state (attempted during the 2026-04-19 remediation and dropped as too flaky to land) reported WCAG 2 AA color-contrast violations in the overlay's subtitle / score / button copy. Needs a dedicated styling pass. The focus-management fix is already landed.

## Cross-browser CI failures from 2026-05-05 PR #36

PR #36 added three new e2e projects to the matrix: `mobile-chromium`, `mobile-webkit`, and `desktop-firefox-touch` (Phase 5.2 expansion). First CI run exposed 8 distinct failures across non-chromium projects, hypothesized to be real CSS/rendering bugs rather than test flakes (per Phase 5.5 plan). Each item describes the symptom, hypothesis, acceptance criteria for fix.

### Theme bootstrap timing on mobile-webkit (3 failures)

- **Symptom:** All three `theme-and-responsive.spec.ts` failures on `mobile-webkit` only. Theme system tests pass on all chromium projects.
  - `theme-and-responsive.spec.ts:15` — defaults to system theme (no dark class if system is light)
  - `theme-and-responsive.spec.ts:28` — dark class is applied to html when dark mode active
  - `theme-and-responsive.spec.ts:46` — respects prefers-color-scheme: dark when in system mode
- **Hypothesis:** The inline theme-bootstrap script in `index.html` (lines ~15–40) reads `localStorage.getItem('funworldmap-theme')` and checks `window.matchMedia('(prefers-color-scheme: dark)')` to set the root `<html>` class before React mounts. On WebKit, Playwright's `colorScheme` fixture may be applied AFTER the bootstrap runs (or overrides it), causing the script to read stale values. The spec expects bootstrap-then-fixture order; WebKit may reverse it.
- **Acceptance criteria:** Each test passes 10/10 on `--project=mobile-webkit --repeat-each=10`. Add a minimal tracing call in the spec to log the order: `console.log('bootstrap:', await page.evaluate(() => document.documentElement.className))` before and after fixture application.
- **Reference:** [`index.html`](../index.html) lines 15–40; test file [`e2e/theme-and-responsive.spec.ts`](../e2e/theme-and-responsive.spec.ts); PR #36 added `mobile-webkit` to `playwright.config.ts` projects.

### Mobile click-tolerance failures on mobile-chromium and desktop-firefox-touch (2 failures, pre-existing in spec)

- **Symptom:** `mobile-tap.spec.ts` two failures (both on `mobile-chromium` and `desktop-firefox-touch`):
  - `mobile-tap.spec.ts:48` — 5 px finger-roll tap is accepted (within tolerance)
  - `mobile-tap.spec.ts:61` — 12 px drag is NOT accepted as a click (above tolerance)
- **Hypothesis:** The spec tests `clickTolerance: 8` in `useMapInstance.ts`. These tests likely authored and run locally against desktop chromium viewport; when emulated on mobile viewport (320px-ish width), the 5–12 px movements scale differently or the pointer-event order changes. Desktop and mobile may have different baseline movement thresholds before a `pointerup` is classified as a drag vs. a tap. Worth checking: does Playwright's `mobile-chromium` emulation match the actual browser's behavior? Possible real bug: the tap-tolerance calculation may be viewport-blind or use `window.devicePixelRatio` incorrectly.
- **Acceptance criteria:** Spec passes 10/10 on `--project=mobile-chromium --repeat-each=10` and `--project=desktop-firefox-touch --repeat-each=10`. Confirm the tolerance logic in `useMapInstance.ts` accounts for viewport width or pixel-ratio scaling.
- **Reference:** [`e2e/mobile-tap.spec.ts`](../e2e/mobile-tap.spec.ts) lines 48 and 61; [`src/hooks/useMapInstance.ts`](../src/hooks/useMapInstance.ts) `clickTolerance` definition.

### Map loading failure on desktop-firefox-touch (1 failure, GPU stack divergence)

- **Symptom:** `mobile-smoke.spec.ts:7` — app loads and map reaches loaded state. Failed on `desktop-firefox-touch` only; chromium variants all pass.
  - Map did not emit the `data-map-loaded` attribute within the test timeout.
- **Hypothesis:** Firefox uses a different WebGL2 driver stack than Chromium (no ANGLE available on Linux headless). Under headless Firefox CI, the GL context may not initialize, or tile rendering may timeout. The test calls `gotoAndWaitForMap(page, '/')` which waits for `[data-map-loaded]`; if Firefox's MapLibre never fires the ready event, the wait times out. This is not a flake — it's a real rendering blocker on Firefox.
- **Acceptance criteria:** Map loads and fires `data-map-loaded` consistently on `--project=desktop-firefox-touch` (10/10 repeats). May require disabling WebGL2 fallback or adjusting the timeout; if Firefox never initializes WebGL2, the map canvas may be blank and that needs a dedicated Firefox code path.
- **Reference:** [`e2e/mobile-smoke.spec.ts`](../e2e/mobile-smoke.spec.ts) line 7; [`e2e/helpers.ts`](../e2e/helpers.ts) `gotoAndWaitForMap` call; `src/hooks/useMapInstance.ts` `onLoadComplete` signal.

---

## Test coverage gaps

### Reduced-motion variants

- Use Playwright's `page.emulateMedia({ reducedMotion: 'reduce' })` against the reveal animation, country fly-to, and modal transitions.
- Verify animations are skipped/shortened, not jarring.

### Per-event telemetry verification

- For each event in the analytics schema (`free_started`, `launcher_dismissed`, `header_cta_clicked`):
  - Fires once on its trigger.
  - Carries the documented props.
  - Network capture via `page.on('request')` against `/api/event`.

---

## Deferred from the 2026-06 cleanup

Source: [`2026-06-11-repo-cleanup-and-fixes-design.md`](superpowers/specs/2026-06-11-repo-cleanup-and-fixes-design.md)

- ~~**Shared unit-test utilities** — one `CountryData` factory + one matchMedia stub in `src/test/` to replace the five per-file factories and six bespoke matchMedia stubs.~~ **Done** (#123): `countryFixtures`, `matchMediaStub`, `fakeMapHooks` in `src/test/`; 13 sites migrated (`motion.test.ts` keeps its bespoke live-getter mock by design).
- ~~**`waitForMapLoaded(page)` e2e helper** — consolidate the ~9 hand-rolled `waitForSelector('[data-map-loaded]')` preambles; parameterise `routeMapTiles` with a style stub so `label-contrast.spec.ts` can drop its 70-line interceptor copy.~~ **Done** (#119).
- **Search match highlighting** — re-introduce Fuse `includeMatches` only together with a UI that renders it (the plumbing was removed as dead).
- **Route game announcement strings through `messages.ts`** — `useGameAnnouncements` inlines its prompt strings; restore the i18n routing when i18n work starts.
- ~~**Unit-test gaps** — `useSatelliteMode`, `useMapTheme`, `GameSessionProvider` pool/status guards, reducer `endGame`/`overrideRound` actions.~~ **Done** (#118).
- ~~**Pre-load `'style'` error latching** — a transient pre-load tile error latches `mapError='style'` permanently even when the map then loads fine (`useMapInstance`'s error handler never clears it on successful load); visible on every stubbed e2e load via `data-map-error="style"`. Found during the 2026-06 webgl-retry fix. Clear or downgrade `'style'` on `load`.~~ **Done** (#115): cleared on `load`; unit + e2e regression tests added. A residual re-latch window (an `error` between `load` firing and `onLoad` resolving) is tracked in #121.
- ~~**`eslint-plugin-playwright` on the e2e lint block** — `missing-playwright-await` catches unawaited `expect()` syntactically (the classic e2e flake source, invisible to the current non-type-checked lint), and `no-wait-for-timeout` / `no-force-option` would mechanize two of CLAUDE.md's hand-enforced forbidden patterns. Alternative: type-checked lint via `tsconfig.e2e.json` (declined in the 2026-06 cleanup for pre-commit latency).~~ **Done** (#120): the two flake-ban rules are at `error` severity (type-checked e2e lint stays deferred for pre-commit latency).

## Rejected (won't build)

Nothing here yet. Items that were considered and explicitly rejected (not just deferred) would go here with a one-line reason.
