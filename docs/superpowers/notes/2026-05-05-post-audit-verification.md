# Post-audit verification — 2026-05-05

Phase 2 of the vision-audit remediation plan. Each section captures the result of a verification step.

## 2.1 — axe-core sweep

Spec: `e2e/axe-snapshot.spec.ts` — collect-not-fail (baseline, not a build gate).
Run: 2026-05-05, chromium project (real-GPU ANGLE), `reducedMotion: reduce`.
All 5 tests passed in 11 s.

### Cold launcher

Tested at: `/` with cleared localStorage, daily content stubbed to `FRA/FRA-paris` for today.

No violations.

### In-game HUD

Tested at: `/#daily/<today>/country-pinning`, after one country guess (mid-game, attempt 2 of 3 visible in the HUD).

| Rule | Impact | Count | Brief |
|---|---|---|---|
| `aria-prohibited-attr` | serious | 1 | `aria-label` attribute cannot be used on a `<div>` with no valid role attribute |

**Offending element:** `<div class="flex gap-1.5" aria-label="Attempt 2 of 3">`

The HUD attempt-indicator row uses `aria-label` on a plain `<div>` to describe the current attempt number to screen-reader users. ARIA 1.2 prohibits `aria-label` on elements that do not have an implicit or explicit ARIA role (generic `<div>` has role `generic`, which is in the prohibited list). Fix: add `role="group"` (or use `<fieldset>`/`<p>`) so the labelling attribute is permitted.

**Suggested fix:** `<div role="group" class="flex gap-1.5" aria-label="Attempt 2 of 3">` or convert to a `<p aria-live="polite">` that announces the attempt count.

### Country panel open

Tested at: `/#FRA`.

No violations.

### Game-over modal

Tested at: `/#daily/<today>/country-pinning`, driven to game-over via three guesses + `finalizeGame()` seam.

No violations.

### Reveal modal

Tested at: `/#daily/<past>/reveal` (3 days prior, history seeded for `country-pinning` mode).

No violations.

---

### Summary

| State | Violations | Highest impact |
|---|---|---|
| Cold launcher | 0 | — |
| In-game HUD | 1 | serious |
| Country panel open | 0 | — |
| Game-over modal | 0 | — |
| Reveal modal | 0 | — |
| **Total** | **1** | **serious** |

The single finding (`aria-prohibited-attr` on the HUD attempt-indicator row) is isolated to the in-game surface and has a straightforward fix. No `critical` violations were found across any of the five states.

## 2.2 — Cross-browser parity

Run date: 2026-05-05.

The non-chromium Playwright projects have a dedicated testMatch that covers only mobile-oriented specs
(app load, tap reliability, free-play, daily flow, tutorial). The suggested DOM-only specs
(`scaffold.spec.ts`, `launcher.spec.ts`, `launcher-card-loading-states.spec.ts`) are intentionally
excluded from those projects' testMatch — they are chromium-only by design (see `playwright.config.ts`
lines 43–83 vs 86–120). The canonical cross-browser coverage is therefore the specs that each project
actually runs.

Specs exercised per project:

| Project | Specs run |
|---|---|
| mobile-webkit | `mobile-smoke.spec.ts`, `mobile-tap.spec.ts` |
| desktop-firefox-touch | `mobile-smoke.spec.ts`, `mobile-tap.spec.ts` |
| mobile-chromium | `mobile-smoke.spec.ts`, `mobile-tap.spec.ts`, `mobile-free-play.spec.ts`, `mobile-daily-flow.spec.ts`, `tutorial-first-click.spec.ts` |

### Results

| Project | Total | Passed | Failed | Notes |
|---|---|---|---|---|
| mobile-webkit | 3 | 3 | 0 | iPhone 14 device profile |
| desktop-firefox-touch | 3 | 3 | 0 | Firefox/Android UA, touch viewport |
| mobile-chromium | 7 | 7 | 0 | Pixel 7 device profile |

All 13 tests passed across all three projects. Local dev server reused (`reuseExistingServer: true`).

### Coverage vs intent

The non-chromium projects cover:

- **App boot / map load** (`mobile-smoke`): verified on WebKit, Firefox, Chromium mobile.
- **MapLibre click-tolerance gate** (`mobile-tap`): the 5 px / 12 px threshold tests pass on both WebKit
  and Firefox, confirming the `clickTolerance=8` fix is not Chromium-specific.
- **Free-play launcher → game flow** (`mobile-free-play`): country-pinning and city-guessing start and
  accept guesses correctly on Chromium mobile.
- **Daily city flow** (`mobile-daily-flow`): three-guess completion + `finalizeGame()` seam works on
  Chromium mobile.
- **Tutorial first-click** (`tutorial-first-click`): tutorial dismisses correctly on Chromium mobile.

### Findings

No browser-specific bugs surfaced. Specific observations:

1. **`mobile-tap` passes on WebKit** (low severity, positive finding). WebKit historically tolerates
   larger finger-roll deltas (per the comment in `mobile-tap.spec.ts`), but because the tests dispatch
   synthetic DOM events directly on the canvas rather than using real pointer gestures, the test is
   browser-agnostic. Both the 5 px (accepted) and 12 px (rejected) threshold tests pass consistently
   on WebKit. No action needed.

2. **`desktop-firefox-touch` clipboard permissions** (low severity, configuration note). The project
   overrides `permissions: []` because Firefox rejects `clipboard-read`/`clipboard-write` from the
   top-level config. No mobile spec exercises clipboard, so no coverage gap today. If a future
   cross-browser share-toast test is added for Firefox, it will need a browser-specific permissions
   approach or must use a clipboard-stub route handler. Document as a constraint when implementing
   Phase 2.4 verification.

3. **DOM-only specs not covered on non-chromium projects** (medium severity, coverage gap). `scaffold`,
   `launcher`, `launcher-card-loading-states`, `panel-and-deeplink`, etc. run only on `chromium`.
   These exercise the launcher card render states (shimmer, loaded, cta count, link routing) and are
   the highest-value surfaces for cross-browser layout regressions. There is no current mechanism to
   run them on mobile-webkit or desktop-firefox-touch. If a future regression affects WebKit-specific
   CSS (e.g. `gap` in a flex container with `safe` alignment, or a `-webkit-` prefix gap), it would
   not be caught by CI. This is a backlog item, not a blocker.

### Backlog items from this phase

- **[backlog]** Add `launcher.spec.ts` and `scaffold.spec.ts` to `mobile-webkit` testMatch once the
  launcher is confirmed stable on real iOS Safari (blocked on human-in-the-loop verification).
- **[backlog]** Document the Firefox clipboard-permissions constraint in `e2e/helpers.ts` for
  whoever implements Phase 2.4 (share-toast verification).

## 2.3 — Production daily-index check

Live `/daily/index.json` window ends 2026-05-04 (today is 2026-05-05). Generated at 2026-05-04T08:42:44Z. One day behind today's date, within tolerance for the ~6h GHA cadence. No action needed.

## 2.4 — Real-browser share toast (deferred)

Needs human-in-the-loop verification. Phase 1.6 raised Toast z-index above modals; theory: `dispatchToast('Copied!')` from clipboard fallback now renders above the game-over modal. Confirm by playing a daily in real Chrome and clicking Share.

## 2.5 — Label-contrast measurement

(Pending.)
