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

> **Correction (2026-06-12):** §2.2 below is wrong — the 2026-05-04 Phase 5.5
> note had already added `theme-and-responsive` and
> `launcher-card-loading-states` to the mobile-webkit and
> desktop-firefox-touch testMatch, where they remain today. The
> "chromium-only by design" rationale and the backlog item are void.

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

Run date: 2026-05-04.
Spec: `e2e/label-contrast.spec.ts`.
Method: Playwright browser tests + static WCAG math. All four theme × view combinations measured.

All symbol label layers in the OpenFreeMap positron basemap receive a **uniform** `text-color` and
`text-halo-color` from `applyMapTheme` (`src/lib/mapColors.ts`). The halo colour exactly matches the
land background colour in each theme (by design — the halo blends into the land). The decisive
contrast pair is therefore **text vs halo**, which is the immediate background for the glyph.

Tested layers: `place_country`, `place_state`, `place_city`, `place_town`, `place_village`, `place_suburb`
(representative subset of OpenFreeMap positron symbol layers; all receive identical paint values).

Tested combinations: light+map, dark+map, light+satellite, dark+satellite.

### Light + Map view

| Layer | Text colour | Halo / bg | Contrast (text vs halo) | WCAG AA? |
|---|---|---|---|---|
| place_country | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No (< 4.5:1) |
| place_state | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_city | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_town | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_village | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_suburb | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |

Note: `text vs bg` = 3.75:1 (bg === halo in light mode — intentional design). `halo vs bg` = 1.00:1 (same colour).

### Dark + Map view

| Layer | Text colour | Halo / bg | Contrast (text vs halo) | WCAG AA? |
|---|---|---|---|---|
| place_country | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL (< 3:1) |
| place_state | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_city | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_town | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_village | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_suburb | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |

Note: `text vs bg` = 2.44:1 (bg === halo in dark mode — intentional design). `halo vs bg` = 1.00:1.

### Light + Satellite view

Satellite background is variable raster imagery. The halo provides the immediate glyph background —
text-vs-halo is the decisive metric. Background measurement not applicable.

| Layer | Text colour | Halo | Contrast (text vs halo) | WCAG AA? |
|---|---|---|---|---|
| place_country | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No (< 4.5:1) |
| place_state | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_city | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_town | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_village | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |
| place_suburb | `#78716c` | `#e8e3da` | 3.75:1 | ⚠ No |

### Dark + Satellite view

| Layer | Text colour | Halo | Contrast (text vs halo) | WCAG AA? |
|---|---|---|---|---|
| place_country | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL (< 3:1) |
| place_state | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_city | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_town | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_village | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |
| place_suburb | `#475569` | `#10141a` | 2.44:1 | ✗ FAIL |

### Findings

**Worst-case ratio:** 2.44:1 (dark mode, all label layers, all views) — below the WCAG AA minimum of 3:1.

**Audit claim assessment:** The visual audit's claim that "country labels [have] poor contrast in BOTH dark
and light map views" is **SUPPORTED** by measurement:

- **Dark mode:** 2.44:1 — fails WCAG AA (3:1 minimum) in all combinations. The failing contrast is a
  consequence of `text-color: #475569` (slate-600) against `text-halo-color: #10141a` (near-black). The
  two colours are both dark; the halo does not provide sufficient lift for the glyph.

- **Light mode:** 3.75:1 — passes the 3:1 minimum but misses WCAG AA normal-text threshold (4.5:1). This
  is a warning, not a hard failure.

**Root cause:** `applyMapTheme` applies a de-emphasis palette (`#475569` / `#10141a` in dark) to
intentionally push basemap labels into the background so the quiz's country highlights are the visual
focus. This is a deliberate design trade-off, not an oversight. The consequence is that dark mode labels
fail WCAG AA accessibility requirements.

**Backlog items:**

- **[backlog / medium]** Improve dark-mode label contrast: raise `text-color` from `#475569` (slate-600,
  lum 0.097) to at least `#64748b` (slate-500, lum 0.148) and/or lighten `text-halo-color` from
  `#10141a` to `#1e2a3a`. Target ≥ 3:1 minimum; ≥ 4.5:1 preferred. Verify the change does not make
  labels visually compete with country fill/selection highlights.

- **[backlog / low]** Improve light-mode label contrast from 3.75:1 toward 4.5:1 by darkening
  `text-color` slightly (e.g. `#6b6459` → already used in UI, or `#57534e` stone-600).
