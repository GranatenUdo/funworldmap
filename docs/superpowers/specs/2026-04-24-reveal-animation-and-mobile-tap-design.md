# Animated Reveal, Mobile Tap Reliability, and Expanded Playwright Coverage — Design

**Status:** approved
**Date:** 2026-04-24
**Scope:** One branch, one PR, three commits.

> **Revision note (2026-04-24):** Earlier drafts of this spec identified the
> mobile-tap bug as a "dual click-handler collision" and proposed a handler
> unification refactor. Research into MapLibre 5.23.0 source (see `src/ui/handler/map_event.ts`,
> `_createDelegatedListener` in `src/ui/map.ts`) showed this was wrong:
> layer-scoped and map-wide click handlers are siblings on the same event,
> cannot collide, and both fail together when MapLibre's `clickTolerance`
> gate rejects the click upstream. This spec reflects the corrected diagnosis.
> The same revision pass dropped `mobile-firefox` from the Playwright matrix
> (Firefox hard-rejects `isMobile: true`) and dropped the `d3-geo` /
> great-circle helper language (MapLibre renders Mercator-straight lines;
> tessellation is purely a globe-projection visual-fidelity concern).

## Problem

Two reported gameplay bugs and one test-coverage gap:

1. **No distance line on wrong country guesses.** Today a wrong country-pinning guess pulses only the target border. Players have no way to *see* how far off they were.
2. **Mobile taps silently fail on Firefox-Android.** A clear tap on Italy (a large polygon) on Pixel 9 Pro Firefox does not register. Works fine on mobile Chromium.
3. **Playwright suite has no mobile coverage.** The reported bug would have been caught earlier by even a minimal mobile-viewport project. Broader mobile coverage also protects future mobile regressions generically.

## Goals

- Wrong country-pinning guesses and city-guessing guesses both animate a dashed line from guess → target while the globe fits bounds to frame both endpoints.
- Mobile taps on country polygons register reliably on mobile Firefox and mobile Chromium.
- Playwright suite gains first-class mobile-viewport coverage that runs on every PR.

## Non-goals

- No changes to scoring, daily puzzle pipeline, retention scaffolding, or analytics.
- No iOS Safari / WebKit mobile project beyond Playwright's bundled `webkit` (Playwright's WebKit emulation is imperfect for iOS touch; defer until iOS bug reports arrive if they do).
- No Firefox-Android testing in CI — Playwright cannot run Firefox-Android. Real-device verification is a manual-QA checklist item.
- No custom `touchend` gesture handler (MapLibre already synthesizes `click` from touch; re-implementing would fight the library).
- No unified click handler refactor (the two sibling listeners work fine; refactor is stylistic only).

## Root-cause analysis: the mobile tap bug

`MapEventHandler.click` in `maplibre-gl@5.23.0` gates every click on the delta between `mousedown` and `click`:

```ts
click(e, point) {
  if (this._mousedownPos && this._mousedownPos.dist(point) >= this._clickTolerance) return
  this._map.fire(new MapMouseEvent(e.type, this._map, e))
}
```

`MapOptions.clickTolerance` defaults to `3` pixels. On touch devices:

- Touch-synthesized `mousedown` fires at the touchstart point.
- Touch-synthesized `click` fires at the touchend point.
- A user's finger rolls 5–10 px between touchstart and touchend on a phone. This is normal.

Firefox-Android's touch→mouse synthesis preserves this delta; Chromium's synthesis aligns mousedown and click more aggressively, which is why the bug is Firefox-specific.

When the delta exceeds `clickTolerance`, the click is silently dropped — no layer-scoped handler fires, no map-wide handler fires, nothing runs. This matches the user's report exactly.

**Fix:** raise `clickTolerance` to `8` px. Mapbox's official examples use `6–10` px for the same reason. `dragPan` uses a separate, higher threshold, so drag detection is unaffected.

## Design

### Architecture

One branch, one PR, three atomic commits. No new modules or architectural layers.

| Commit | Surface |
| --- | --- |
| 1 — Animated reveal | `src/game/shared/distance.ts` (slerp + tessellation helpers), `src/game/GameController.tsx` (extend existing reveal-geometry effect) |
| 2 — Mobile tap reliability | `src/hooks/useMapInstance.ts` (one-line `clickTolerance: 8`), `src/hooks/useMapInteractions.ts` (4 px `queryRenderedFeatures` bbox polish) |
| 3 — Playwright mobile coverage | `playwright.config.ts`, new `e2e/*.spec.ts` specs, `docs/testing/playwright-matrix.md` |

The three commits are ordered so that later commits' tests exercise earlier commits' code: commit 3's mobile-tap spec is the regression proof for commit 2, and commit 3's reveal-animation spec is the regression proof for commit 1.

### Commit 1 — Animated reveal

**Trigger conditions.** Runs when `session.status === 'round-ended'` and `session.lastOutcome` satisfies either:

- `reveal.kind === 'country' && !reveal.correct && reveal.clickedCca3 !== null`, OR
- `reveal.kind === 'point' && reveal.clickedPoint !== null`.

Correct country guesses retain the current border-pulse behaviour (no line). Skipped rounds (no click registered) retain the current no-line behaviour.

**Helper — `computeRevealAnimationPlan`.** Pure function extracted for unit testing:

```ts
interface RevealAnimationPlan {
  from: [number, number]
  to: [number, number]
  durationMs: number
}

function computeRevealAnimationPlan(
  reveal: Reveal,
  byCca3: Map<string, CountryLike>,
): RevealAnimationPlan | null
```

Duration formula: `Math.max(400, Math.min(1200, distanceKm / 10_000 * 1200))`. A 10,000 km miss animates over the full 1.2 s; short misses are quicker. `prefers-reduced-motion: reduce` short-circuits to `durationMs = 0` (instant).

**Helpers in `src/game/shared/distance.ts`:**

```ts
/** Spherical linear interpolation between two [lng, lat] points. t ∈ [0, 1]. */
function slerpLngLat(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number]

/** Sample slerp at (n + 1) evenly-spaced t values; returns a polyline. */
function tessellateArc(
  from: [number, number],
  to: [number, number],
  n: number = 64,
): Array<[number, number]>
```

`slerpLngLat` is ~12 lines of spherical-slerp math:

1. Convert both endpoints to radians.
2. Compute angular distance `d` via haversine (already in the file).
3. If `d` is near zero, return `from` unchanged.
4. Otherwise `a = sin((1 - t) * d) / sin(d)` and `b = sin(t * d) / sin(d)` scale the Cartesian components; result converted back to lngLat.

Unit tests: `t = 0` → `from`, `t = 1` → `to`, `t = 0.5` yields a midpoint whose haversine distance to both endpoints is within 1 km.

**Why tessellate at all?** MapLibre renders a 2-vertex LineString as a geographically-straight path (Mercator straight-line between the points). On the globe projection (which this app uses), that straight-line interpretation warps visibly at long distances — e.g. a London→Tokyo line would look "wrong" compared to the great-circle arc planes fly. A 64-vertex tessellated polyline follows the geodesic arc closely enough to look correct on the globe. For short distances (<2000 km) the difference is imperceptible; tessellating unconditionally costs ~60 cheap `sin`/`cos` calls per frame (negligible at 60 Hz).

**Line draw.** On each `requestAnimationFrame` tick:

1. Compute progress `p = clamp(elapsed / durationMs, 0, 1)`.
2. Compute the tessellated arc: `arc = tessellateArc(from, to, 64)` (computed once per animation; stable across frames).
3. Slice the arc to the current progress: `visible = arc.slice(0, Math.ceil(p * arc.length))` with `[from, slerpLngLat(from, to, p)]` appended for sub-frame smoothness when the last segment is partial.
4. Set the source data to a `LineString` with `coordinates = visible` via `setData`.

Line grows from guess toward target along the geodesic arc. The dashed pattern (`line-dasharray: [2, 2]`) is preserved naturally because the paint expression is never mutated. Reduced-motion → skip rAF loop, set the full `arc` in one shot.

**Camera.** `map.fitBounds([from, to], { duration: durationMs, padding: fitPadding(), maxZoom: 6 })` runs in parallel with the line-draw animation. Both finish together. Reduced-motion → `duration: 0`.

**Auto-advance timing.** Replaces the current `REVEAL_MS_COUNTRY = 1200` / `REVEAL_MS_CITY = 2000` constants with `Math.max(durationMs + 300, 1800)` when an animation plan exists, so the user sees the settled frame for ~300 ms after the line finishes. Correct country guesses keep the existing 1200 ms / 3000 ms timing paths.

**Edge cases:**

- `clickedCca3` not in `byCca3`: `computeRevealAnimationPlan` returns `null`, falls back to border pulse. Log via `console.warn`.
- Effect re-run during animation: cleanup calls `cancelAnimationFrame` on the outstanding handle and clears sources via the existing `clearRevealSources`.
- Style not yet loaded on slow CI when `round-ended` first fires: existing `try/catch` around source/layer mutations stays.

**Tests:**

- Unit: `slerpLngLat` — boundary cases (t=0, t=1), midpoint reciprocal-distance check, near-zero-distance degenerate case.
- Unit: `tessellateArc` — length = n+1, endpoints match exactly, monotonic in t.
- Unit: `computeRevealAnimationPlan` — duration-scaling formula, null on missing centroid, null on skipped round, `durationMs = 0` under reduced-motion.
- E2E: see commit 3.

### Commit 2 — Mobile tap reliability

**Primary fix — `clickTolerance: 8`.** In `src/hooks/useMapInstance.ts`, add `clickTolerance: 8` to the `new maplibregl.Map({...})` call. One-line change at map construction.

Rationale: root-cause fix against `MapEventHandler.click`'s mousedown→click delta gate. Eight pixels is within the range production map apps use (Mapbox's examples run 6–10 px). Drag detection is unaffected because `dragPan` uses a separate, higher threshold.

**Secondary polish — bbox in `queryRenderedFeatures`.** In `src/hooks/useMapInteractions.ts`, expand both `queryRenderedFeatures` calls to use a 4 px bbox around the click point instead of a single point:

```ts
const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
  [e.point.x - 4, e.point.y - 4],
  [e.point.x + 4, e.point.y + 4],
]
const features = map.queryRenderedFeatures(bbox, { layers: [LAYER.fill] })
```

This is the Mapbox-recommended pattern for hit-testing at a click point. Helps users tap coastline-adjacent tiny islands without changing behavior for large polygons. Not scoped to mobile — applies uniformly.

**Deferred (explicit YAGNI).** No unified handler refactor (stylistic only, doesn't fix the bug). No `touch`-event custom listener (bypasses MapLibre's gesture classifier and would create new bugs). No buffered hit-layer or spiral sampling.

**Validation caveat.** The `clickTolerance: 8` fix is a code-level root-cause fix derived from MapLibre source analysis. It has not been empirically reproduced on a Pixel 9 Pro Firefox before ship. Playwright's `desktop-firefox-touch` project exercises the same Gecko engine with synthesized touch events and should catch any regression, but does not guarantee behavior on Firefox-Android. **PR description must include a real-device verification checklist** — the bug cannot be closed until confirmed on the reporter's device.

**Tests:**

- Unit: simulate `mousedown` → `mouseup` with a 7 px delta on a mocked MapLibre instance, assert click handler fires (would have been suppressed at tolerance=3).
- Unit: 12 px delta does not fire a click (above tolerance).
- Unit: `queryRenderedFeatures` bbox variant returns features for a 2 px miss on a known polygon.
- E2E: see commit 3.

### Commit 3 — Playwright mobile coverage

**Config.** Add three projects to `playwright.config.ts`:

```ts
{
  name: 'mobile-chromium',
  use: {
    ...devices['Pixel 7'],
    launchOptions: { args: ['--use-gl=angle', '--use-angle=default'] },
  },
  testMatch: [/* map-interaction specs + new mobile specs */],
},
{
  name: 'mobile-webkit',
  use: { ...devices['iPhone 14'] },
  testMatch: [/* subset that doesn't need Chromium-specific flags */],
},
{
  name: 'desktop-firefox-touch',
  use: {
    defaultBrowserType: 'firefox',
    viewport: { width: 412, height: 839 },
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
  },
  testMatch: [/* gecko-engine touch proxy specs */],
},
```

Note: the Firefox project explicitly does NOT spread `devices['Pixel 7']` because that descriptor sets `isMobile: true`, which Firefox hard-rejects (`Error: options.isMobile is not supported in Firefox` — verified at `node_modules/playwright-core/lib/server/firefox/ffBrowser.js:91-92`).

**GPU-config spike.** Before writing the full specs, first step of commit 3 is a 1-test smoke spike: each mobile project loads the app and asserts `[data-map-loaded]` appears. WebKit and Firefox have their own WebGL initialisation paths in Playwright — both *should* work headless but the assumption needs verification. If any project fails the spike, narrow the project set and document why in `docs/testing/playwright-matrix.md`.

**New specs:**

1. **`e2e/mobile-tap.spec.ts`** — regression for the Italy tap bug. Starts country-pinning free-play, calls `window.__funworldmap_game.setRound('ITA')`, simulates a `page.mouse.down()` at Italy's centre, `page.mouse.move()` by +7 px (mimicking a finger roll), `page.mouse.up()` — asserts the guess registers. Without the `clickTolerance: 8` fix, this assertion fails. Runs under `mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`.
2. **`e2e/reveal-animation.spec.ts`** — both modes. Country-pinning: pin Italy, submit France via `__funworldmap_game.submitCountryGuess('FRA')`, assert `window.__funworldmap_map.getSource('game-reveal-line').serialize().data.features[0].geometry.coordinates.length > 2` (tessellated polyline, not a 2-vertex straight line) and endpoints are within 10⁻⁴ degrees of France's and Italy's centroids. City-guessing: pin a known city via `setRound(cityId)`, submit a point guess, assert the line geometry. Both assertions poll with `waitForFunction` until `round-ended` propagates.
3. **`e2e/reveal-animation-reduced-motion.spec.ts`** — same assertions under `reducedMotion: 'reduce'`. Line is present at full tessellated length immediately after `round-ended`.
4. **`e2e/mobile-daily-flow.spec.ts`** — full daily city round on mobile viewport: tap `Play · 3 attempts` on the city mode card, make one wrong tap, one correct tap, assert game-over appears and the streak pill advances.
5. **`e2e/mobile-free-play.spec.ts`** — country-pinning and city-guessing free-play rounds on mobile viewport. Asserts taps register, reveal animations fire, rounds advance.

**Matrix doc — `docs/testing/playwright-matrix.md`.** One-page table: which specs run under which projects and why. Explicit note that real Pixel 9 Pro Firefox-Android reproduction is a manual-QA step — Playwright cannot run Firefox-Android in CI.

**PR description real-device checklist.** Before merging, the reporter (the project owner) confirms on actual Pixel 9 Pro Firefox that:

- Tapping Italy in country-pinning free-play registers a guess.
- Wrong country guess animates a dashed line from guess to target.
- Wrong city guess animates a dashed line from guess point to target.

## Data flow

**Animated reveal:**

```
session.status='round-ended' + lastOutcome
  → computeRevealAnimationPlan(reveal, byCca3) returns {from, to, durationMs} | null
  → null:   current behaviour (border pulse for country, no-op for skipped city)
  → plan:   arc = tessellateArc(from, to, 64) computed once
            rAF loop updates geojson source with arc.slice(0, currentIdx),
            fitBounds runs in parallel with matching duration,
            setTimeout(advanceNow, max(durationMs + 300, 1800)) schedules auto-advance
  → effect cleanup: cancelAnimationFrame + clearRevealSources on unmount/re-run
```

**Mobile tap:**

```
touch on canvas
  → touchstart records mousedown position
  → touchend fires synthesized click at touchend position
  → MapEventHandler.click: if delta ≥ clickTolerance (was 3, now 8), silently drop
  → if within tolerance: both sibling handlers fire — clickCountry (layer-scoped)
    and clickMap (map-wide) — each runs queryRenderedFeatures (now with 4 px bbox)
  → feature? onSelect(cca3) : onDeselect()
```

## Error handling

- MapLibre source/layer not yet initialised when `round-ended` fires on slow CI: existing `try/catch` around reveal-geometry stays; animated path adds the same guard.
- Country centroid lookup fails: `computeRevealAnimationPlan` returns `null`, falls back to border-pulse-only. Log via `console.warn`, don't throw.
- `requestAnimationFrame` running after unmount: effect cleanup cancels the handle and clears sources via `clearRevealSources`.
- `queryRenderedFeatures` called before the fill layer is added (startup race): returns `[]`, falls back to `onDeselect` (no crash).
- Playwright Webkit/Firefox headless WebGL init failure: caught by the GPU-config spike at the start of commit 3; project is dropped or run under a minimal-coverage scope.

## Testing summary

| Layer | Commit | Coverage |
| --- | --- | --- |
| Unit (Vitest) | 1 | `slerpLngLat`, `tessellateArc`, `computeRevealAnimationPlan` |
| Unit (Vitest) | 2 | 7 px and 12 px mousedown→click delta behavior; `queryRenderedFeatures` bbox coastline miss |
| E2E (Playwright) | 3 | `mobile-tap` (regression for commit 2), `reveal-animation` + `reduced-motion` (regression for commit 1), `mobile-daily-flow`, `mobile-free-play` — all under `mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch` (where the spike proves each is stable) |

## Rollout

All three commits ship in one PR. No feature flags. No migration. CI runs all projects; PR blocks on all green. Manual verification on Pixel 9 Pro Firefox before merge closes the bug.

## Open questions

None — all resolved during brainstorming and critical-review passes.
