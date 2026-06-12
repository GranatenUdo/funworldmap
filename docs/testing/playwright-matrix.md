# Playwright Project Matrix

Which Playwright project runs which spec, and why. Kept in sync with
`playwright.config.ts` — if you change a `testMatch`/`testIgnore` there,
update this file in the same PR.

## Projects

| Project                 | Engine   | Viewport                   | Touch | GPU                                               | Purpose                                                                    |
| ----------------------- | -------- | -------------------------- | ----- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `chromium`              | Chromium | Desktop                    | No    | ANGLE (real GPU locally; software fallback on CI) | All desktop specs; consolidated from chromium + chromium-gpu on 2026-05-02 |
| `mobile-chromium`       | Chromium | Pixel 7 (412×915)          | Yes   | ANGLE                                             | Mobile-viewport regression coverage                                        |
| `mobile-webkit`         | WebKit   | iPhone 14                  | Yes   | Native                                            | Second mobile engine                                                       |
| `desktop-firefox-touch` | Firefox  | 412×839 + `hasTouch: true` | Yes   | Native                                            | Gecko touch-event proxy. NOT a real Firefox-Android repro                  |

CI runs **chromium only** (4-way sharded). The other three projects are
local opt-in via `--project=<name>`. See `docs/systems/testing.md`
§ "What Runs in CI".

### Known config caveats

- `permissions: ['clipboard-read', 'clipboard-write']` in the top-level `use`
  block is Chromium-only; `mobile-webkit` and `desktop-firefox-touch` override
  to `permissions: []` (both engines reject the strings). No spec in those
  projects exercises clipboard.
- The `chromium` project sets `reducedMotion: 'reduce'` globally so the
  `prefers-reduced-motion` CSS rule collapses animations — this removed the
  animation-actionability flake class. A spec that needs rich-motion behavior
  must opt back in per test via `page.emulateMedia(...)` (see
  `animation-interrupt.spec.ts`'s `emulateMedia({ reducedMotion: 'no-preference' })` for the pattern).

## Spec assignment

| Spec                                                                                                                             | chromium | mobile-chromium | mobile-webkit | desktop-firefox-touch |
| -------------------------------------------------------------------------------------------------------------------------------- | :------: | :-------------: | :-----------: | :-------------------: |
| scaffold, canonical-195, meta-and-static, cold-load-deep-link                                                                    |    ✓     |                 |               |                       |
| search\*, theme-and-responsive\*, accessibility\*, a11y-contrast, a11y-keyboard-smoke, axe-snapshot\*, label-contrast\*          |    ✓     |                 |      ✓¹       |          ✓¹           |
| panel-and-deeplink, panel-focus\*, satellite-default, compare-source-attribution, source-tooltip-edge\*, source-tooltip-keyboard |    ✓     |                 |               |                       |
| launcher, launcher-focus-order, launcher-card-loading-states, launcher-backdrop-dismiss, header-play-reopens-launcher\*          |    ✓     |                 |      ✓²       |          ✓²           |
| map-and-countries, map-reliability, keyboard-map-nav, webgl-context-loss, compare-view-dimming, tutorial-first-click             |    ✓     |       ✓³        |               |                       |
| game-country-pinning\*, game-city-guessing, game-over-mode-switch, animation-interrupt                                           |    ✓     |                 |               |                       |
| reveal-animation\*, reveal-animation-reduced-motion                                                                              |    ✓     |                 |               |                       |
| mobile-panel-header                                                                                                              |    ✓     |                 |               |                       |
| mobile-smoke, mobile-tap                                                                                                         |          |        ✓        |       ✓       |           ✓           |
| mobile-free-play                                                                                                                 |          |        ✓        |               |                       |

¹ only `theme-and-responsive`. ² only `launcher-card-loading-states`.
³ only `tutorial-first-click`.
`*` = in the chromium `testIgnore` list on CI (runs locally only — see below).

New specs default to the `chromium` project. Add a mobile project only when
touch or viewport behavior is itself under test; the ✓¹/✓² entries are
cross-engine DOM smoke runs, not full-suite coverage.

## CI testIgnore (chromium, CI-only)

These 10 specs are excluded on CI pending a self-hosted GPU runner (tracking
issue [#106](https://github.com/GranatenUdo/funworldmap/issues/106); `docs/roadmap.md` § "Flaky-on-free-CI specs (need GPU runner)").
They run locally.

label-contrast · header-play-reopens-launcher · panel-focus · accessibility ·
axe-snapshot · reveal-animation · search · game-country-pinning ·
theme-and-responsive · source-tooltip-edge

Exit criterion: when the GPU runner lands, delete the `testIgnore` block and
this section.

## Quarantined tests (test.fixme on CI)

| Test                                                     | Spec file                           | Issue                                                       |
| -------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| rapid Continue click during panel slide-in (wrong guess) | `e2e/animation-interrupt.spec.ts`   | [#47](https://github.com/GranatenUdo/funworldmap/issues/47) |
| Escape mid-reveal (correct guess) skips the hold         | `e2e/animation-interrupt.spec.ts`   | [#47](https://github.com/GranatenUdo/funworldmap/issues/47) |
| Escape mid-panel-slide-in (wrong guess) skips the hold   | `e2e/animation-interrupt.spec.ts`   | [#47](https://github.com/GranatenUdo/funworldmap/issues/47) |
| game-over → hash-mode-switch race                        | `e2e/game-over-mode-switch.spec.ts` | [#32](https://github.com/GranatenUdo/funworldmap/issues/32) |

## Manual QA — out of CI scope

Real Firefox-for-Android cannot run in Playwright. `desktop-firefox-touch`
exercises the Gecko `clickTolerance: 8` path with synthetic touch only.
Before closing tickets that reference mobile Firefox, verify on a real
device: country-pinning tap registers, city-guessing tap registers, reveal
animations play. Record the verification in the PR thread.
