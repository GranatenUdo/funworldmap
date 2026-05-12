# Playwright Project Matrix

Which Playwright project runs which spec, and why. Kept in sync with `playwright.config.ts`.

## Projects

| Project | Engine | Viewport | Touch | GPU | Purpose |
| --- | --- | --- | --- | --- | --- |
| `chromium` | Chromium | Desktop | No | SwiftShader | DOM-only specs that need no WebGL |
| `chromium-gpu` | Chromium | Desktop | No | ANGLE | Map-interaction specs that need a real WebGL context |
| `mobile-chromium` | Chromium | Pixel 7 (412×915) | Yes | ANGLE | Mobile-viewport regression coverage |
| `mobile-webkit` | WebKit | iPhone 14 | Yes | Native | Second mobile engine |
| `desktop-firefox-touch` | Firefox | 412×839 + `hasTouch: true` | Yes | Native | Gecko-engine touch-event proxy. NOT a real Pixel 9 Pro Firefox repro — Playwright cannot run Firefox-Android |

### Known config caveats

- **`permissions: ['clipboard-read', 'clipboard-write']`** at the top-level `use` block is Chromium-only. Both `mobile-webkit` and `desktop-firefox-touch` override to `permissions: []` because WebKit and Firefox reject these strings with `Unknown permission`. No spec in those projects exercises clipboard, so the override has no functional impact.
- **`test.use({ reducedMotion: 'reduce' })` did not propagate** when combined with the `chromium-gpu` project's `launchOptions.args: ['--use-gl=angle', ...]`. Workaround used in `reveal-animation-reduced-motion.spec.ts`: call `await page.emulateMedia({ reducedMotion: 'reduce' })` explicitly in the test body and assert `matchMedia('(prefers-reduced-motion: reduce)').matches === true` before proceeding. Follow this pattern for any future GPU spec that depends on reduced-motion emulation.
- **Daily-mode date handling in specs:** the app compares `puzzle.date` against the browser's **local** date via `toLocalDateString()`. Always compute `today` as a local-date string (`now.getFullYear()`-`getMonth()+1`-`getDate()`) — do NOT use `new Date().toISOString().slice(0,10)`, which produces a UTC date and mis-classifies the puzzle as "in the past" in any positive-offset timezone late in the day, redirecting to `/reveal` and failing the test. See `e2e/mobile-daily-flow.spec.ts` for the canonical pattern.

## Spec assignment

| Spec | chromium | chromium-gpu | mobile-chromium | mobile-webkit | desktop-firefox-touch |
| --- | :-: | :-: | :-: | :-: | :-: |
| `scaffold`, `search`, `theme-and-responsive`, `accessibility`, `panel-*`, `meta-and-static`, `satellite-default`, `a11y-*`, `launcher*`, `daily-*` | ✓ | | | | |
| `map-and-countries`, `map-reliability`, `keyboard-map-nav`, `game-country-pinning`, `game-city-guessing`, `compare-view-dimming` | | ✓ | | | |
| `reveal-animation`, `reveal-animation-reduced-motion` | | ✓ | | | |
| `mobile-smoke` | | | ✓ | ✓ | ✓ |
| `mobile-tap` | | | ✓ | ✓ | ✓ |
| `mobile-daily-flow`, `mobile-free-play` | | | ✓ | | |

## Why some specs do not run under every mobile project

- `mobile-daily-flow` and `mobile-free-play` rely on tile-stubbed renders and Chromium-specific `--use-gl=angle` WebGL init. Running them under WebKit and Firefox would require separate GPU-config validation and adds low incremental signal.
- `reveal-animation` specs need a real WebGL context AND are about the animation pipeline, not mobile touch — desktop `chromium-gpu` is sufficient.

## Manual QA — out of CI scope

Real Pixel 9 Pro **Firefox-for-Android** reproduction is NOT runnable in Playwright CI. The `desktop-firefox-touch` project exercises the same Gecko rendering engine with synthetic touch, which proves the `clickTolerance: 8` code path in that engine, but does not emulate Fennec/GeckoView's fuzzy-tap redirection or Android viewport meta-tag behaviour.

Before closing tickets that reference mobile Firefox, the reporter must verify on the original device:

- Country-pinning free-play: tap a known country, guess registers.
- City-guessing free-play: tap anywhere on the map, guess registers.
- Reveal animations play as expected on both modes.

Record the verification in the PR thread alongside screenshots.

## Latent issue to fix later

The timezone bug noted under "Known config caveats" likely exists in several other daily-mode specs (`daily-puzzle.spec.ts`, `daily-deep-link.spec.ts`, `daily-streak.spec.ts`, `daily-reveal.spec.ts`, `daily-share.spec.ts`). They currently pass because CI and dev often run when local and UTC dates coincide, but a run at 23:00–24:00 local time in a positive-offset zone would fail them. Worth a dedicated sweep.
