# Animated Reveal, Mobile Tap Reliability, and Expanded Playwright Coverage — Design

**Status:** draft
**Date:** 2026-04-24
**Scope:** One branch, one PR, three commits.

## Problem

Two reported gameplay bugs and one test-coverage gap:

1. **No distance line on wrong country guesses.** Today, a wrong country-pinning guess pulses only the target border. Players have no way to *see* how far off they were.
2. **Mobile taps silently fail.** On mobile Firefox (Pixel 9 Pro), a clear tap on a large country like Italy is ignored. The existing click handling uses two overlapping listeners (a layer-scoped click + a map-wide click) which can collide on touch-synthesized click events.
3. **Playwright suite has no mobile coverage.** The reported bug would have been caught earlier by even a minimal mobile-viewport project. Broader mobile coverage also protects future mobile regressions generically.

## Goals

- Wrong country-pinning guesses and city-guessing guesses both animate a dashed line from guess → target while the globe rotates to frame both endpoints.
- Mobile taps on country polygons register reliably on mobile Firefox and mobile Chromium.
- Playwright suite gains first-class mobile-viewport coverage that runs on every PR.

## Non-goals

- No changes to scoring, daily puzzle pipeline, retention scaffolding, or analytics.
- No iOS Safari / WebKit mobile project (Playwright's WebKit emulation is imperfect for iOS touch; defer until iOS bug reports).
- No custom `touchend` gesture handler (MapLibre already synthesizes `click` from touch; re-implementing would fight the library).
- No buffered hit-layer or spiral-sampling fallback (YAGNI; revisit only if D1+D2 below prove insufficient on real devices).

## Design

### Architecture

One branch, one PR, three atomic commits. No new modules or architectural layers.

| Commit | Surface |
| --- | --- |
| 1 — Animated reveal | `src/game/GameController.tsx` (extend existing reveal-geometry effect) |
| 2 — Mobile tap reliability | `src/hooks/useMapInteractions.ts` (unify click handlers) |
| 3 — Playwright mobile coverage | `playwright.config.ts` + new `e2e/*.spec.ts` specs |

The three commits are ordered so that later commits' tests exercise earlier commits' code: commit 3's mobile-tap spec is the regression proof for commit 2, and commit 3's reveal-animation spec is the regression proof for commit 1.

### Commit 1 — Animated reveal

**Trigger conditions.** Runs when `session.status === 'round-ended'` and `session.lastOutcome` satisfies either:
- `reveal.kind === 'country' && !reveal.correct && reveal.clickedCca3 !== null`, OR
- `reveal.kind === 'point' && reveal.clickedPoint !== null`.

Correct country guesses retain the current border-pulse behaviour (no line). Skipped rounds (no click registered) retain the current no-line behaviour.

**Helper — `computeRevealAnimationPlan`.** Pure function extracted for unit testing:

```ts
interface RevealAnimationPlan {
  from: [number, number]   // guess point (lngLat)
  to: [number, number]     // target point (lngLat)
  durationMs: number       // 400..1200, scaled by great-circle distance
}

function computeRevealAnimationPlan(
  reveal: Reveal,
  byCca3: Map<string, CountryLike>,
): RevealAnimationPlan | null
```

Duration formula: `Math.max(400, Math.min(1200, distanceKm / 10_000 * 1200))`. A 10,000 km miss animates over the full 1.2 s; short misses are quicker. `prefers-reduced-motion: reduce` short-circuits to `durationMs = 0` (instant).

**Line draw.** Progressive source-feature geometry — the simplest mechanism that keeps the existing `line-dasharray: [2, 2]` paint untouched. On each `requestAnimationFrame` tick:

1. Compute progress `p = clamp(elapsed / durationMs, 0, 1)`.
2. Compute the intermediate point `mid = interpolateGreatCircle(from, to, p)`. Add `interpolateGreatCircle` to `src/game/shared/distance.ts` — a small spherical-slerp helper (~12 lines of math, no external dependency):
   - Convert both endpoints to radians.
   - Compute angular distance `d` via `haversineKm` / earth radius (already in the file).
   - If `d` is near zero, return `from` unchanged (avoid division by zero).
   - Otherwise `sin((1 - p) * d) / sin(d)` and `sin(p * d) / sin(d)` scale the Cartesian components of the two endpoints; the result is converted back to lngLat.
   - Unit tests: p=0 → from, p=1 → to, p=0.5 → midpoint (verified by re-running haversine to both endpoints, distances within 1 km for typical inputs).
3. Set the source data to a LineString `[from, mid]` via `setData`.

Line grows from guess toward target. The dashed pattern is preserved naturally because nothing about the paint expression changes. No `lineMetrics`, no `line-gradient`, no external libraries. Reduced-motion → skip rAF loop, set the final LineString `[from, to]` in one shot.

**Camera.** `map.fitBounds([from, to], { duration: durationMs, padding: fitPadding(), maxZoom: 6 })` runs in parallel with the line-draw animation. Both finish together. Reduced-motion → `duration: 0`.

**Auto-advance timing.** Replaces the current `REVEAL_MS_COUNTRY = 1200` / `REVEAL_MS_CITY = 2000` constants with `Math.max(durationMs + 300, 1800)` when an animation plan exists, so the user sees the settled frame for ~300 ms after the line finishes. Correct country guesses keep the existing 1200 ms / 3000 ms timing paths.

**Edge cases:**
- `clickedCca3` not in `byCca3` (shouldn't happen — guess was accepted earlier, so country is known): plan returns `null`, falls back to border pulse. Log via `console.warn`.
- Effect re-run during animation (rapid state changes): effect cleanup calls `cancelAnimationFrame` on the outstanding handle and clears sources via the existing `clearRevealSources`.
- Style not yet loaded on slow CI when `round-ended` first fires: existing `try/catch` around source/layer mutations stays, animated path inherits it.

**Tests.**
- Unit: `computeRevealAnimationPlan` — duration-scaling formula, null on missing centroid, null on skipped round, linear interpolation at intermediate progress values.
- Unit: the rAF loop updates source data with monotonically increasing `line-progress` values.
- E2E: see commit 3.

### Commit 2 — Mobile tap reliability

**Root cause.** `src/hooks/useMapInteractions.ts` registers two click listeners:

```ts
map.on('click', LAYER.fill, clickCountry)  // layer-scoped
map.on('click', clickMap)                   // map-wide
```

On touch devices, MapLibre synthesizes `click` from `touchstart`/`touchend`. The synthesized event's dispatch order across layer-scoped and map-wide listeners is undefined — mobile Firefox can drop the layer-scoped callback entirely, so a clear tap on Italy registers no `onSelect` call.

**Fix — D1: Unify click handling.** Replace the two listeners with one:

```ts
const onTap = (e: maplibregl.MapMouseEvent) => {
  const feature = findCountryUnderPoint(map, e.point)
  if (feature) {
    const country = byNumericRef.current.get(String(feature.id))
    if (country) onSelectRef.current(country.cca3)
    return
  }
  onDeselectRef.current()
}
map.on('click', onTap)
```

One code path, no ordering ambiguity, no dropped callbacks.

**Fix — D2: Snap-within-tolerance.** `findCountryUnderPoint` does two passes:

```ts
function findCountryUnderPoint(
  map: maplibregl.Map,
  point: maplibregl.Point,
): maplibregl.MapGeoJSONFeature | null {
  const exact = map.queryRenderedFeatures(point, { layers: [LAYER.fill] })
  if (exact.length > 0) return exact[0]

  const t = window.matchMedia('(pointer: coarse)').matches ? 20 : 0
  if (t === 0) return null
  const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
    [point.x - t, point.y - t],
    [point.x + t, point.y + t],
  ]
  const near = map.queryRenderedFeatures(bbox, { layers: [LAYER.fill] })
  if (near.length === 0) return null
  if (near.length === 1) return near[0]

  // Pick the feature whose projected centroid is nearest to the tap point.
  return pickNearest(near, point, map)
}
```

Desktop (`pointer: fine`) gets `t = 0` → identical behaviour to today. Mobile (`pointer: coarse`) gets a 20 px slop (roughly a fingertip radius at typical phone DPR), large enough for tiny islands, small enough that a clearly-missed tap still registers as a miss.

**Files touched.**
- `src/hooks/useMapInteractions.ts` — replace two handlers with unified `onTap`; extract `findCountryUnderPoint` and `pickNearest` for testing.
- `src/hooks/__tests__/useMapInteractions.test.ts` — new unit tests: exact hit, near-miss within tolerance on coarse pointer, near-miss outside tolerance, multiple candidates picks nearest, no-op on fine pointer near-miss.

### Commit 3 — Playwright mobile coverage

**Config.** Add two mobile projects to `playwright.config.ts`:

```ts
{
  name: 'mobile-chromium',
  use: { ...devices['Pixel 7'] },
},
{
  name: 'mobile-firefox',
  use: {
    ...devices['Pixel 7'],
    defaultBrowserType: 'firefox',
  },
},
```

Both run on every CI invocation alongside the existing `chromium` project. The `Pixel 7` preset is the closest bundled device to Pixel 9 Pro (same 412×915 viewport class, `hasTouch: true`, `isMobile: true`, `deviceScaleFactor: 2.625`).

**New specs.**

1. **`e2e/mobile-tap.spec.ts`** — direct regression for the reported Italy tap bug. Starts country-pinning free-play, calls `window.__funworldmap_game.setRound('ITA')`, resolves Italy's rendered bounding box via `queryRenderedFeatures`, performs `page.tap()` at Italy's centre, asserts the `last-outcome` UI reflects a submitted guess for ITA.
2. **`e2e/reveal-animation.spec.ts`** — both modes. Country-pinning: pin Italy, submit France via `__funworldmap_game.submitCountryGuess('FRA')`, then assert `window.__funworldmap_map.getSource('game-reveal-line').serialize().data.features` contains a `LineString` from France's centroid to Italy's centroid. City-guessing: pin a known city via `setRound(cityId)`, submit a point guess, assert the line geometry. Both assertions poll with `waitForFunction` until the round-ended state propagates.
3. **`e2e/reveal-animation-reduced-motion.spec.ts`** — same assertions with `reducedMotion: 'reduce'` in `test.use()`. The animation resolves instantly; line is present at full length immediately after `round-ended`.
4. **`e2e/mobile-daily-flow.spec.ts`** — full daily city round on mobile viewport: tap `Play · 3 attempts` on the city mode card, make one wrong tap, one correct tap, assert game-over appears and the streak pill advances. Covers the daily scaffolding on mobile end-to-end.
5. **`e2e/mobile-free-play.spec.ts`** — country-pinning and city-guessing free-play rounds on mobile viewport. Asserts taps register, reveal animations fire, rounds advance.

**Matrix doc.** `docs/testing/playwright-matrix.md` — one-page table listing which specs run under which projects and why. Specs that rely on hover tooltips or keyboard-only input paths skip under mobile projects via `test.skip(({ isMobile }) => isMobile, ...)`.

**Why not Mobile Safari.** Playwright's WebKit build doesn't faithfully emulate iOS Safari touch quirks. A third mobile project adds ~2 min of CI time for low incremental signal. Defer until iOS bug reports arrive.

## Data flow

**Animated reveal:**

```
session.status='round-ended' + lastOutcome
  → computeRevealAnimationPlan(reveal, byCca3) returns {from, to, durationMs} | null
  → null:   current behaviour (border pulse for country, no-op for skipped city)
  → plan:   startLineDrawAnimation() updates geojson source via rAF loop,
            fitBounds runs in parallel with matching duration,
            setTimeout(advanceNow, durationMs + 300) schedules auto-advance
  → effect cleanup: cancelAnimationFrame + clearRevealSources on unmount/re-run
```

**Mobile tap:**

```
touch on canvas
  → MapLibre synthesizes 'click'
  → unified onTap handler
  → findCountryUnderPoint(map, e.point):
      exact queryRenderedFeatures → snap-within-tolerance (coarse pointer only) → null
  → feature? onSelect(cca3) : onDeselect()
  → country-pinning mode's submitGuessInput fires via existing useSelectedCountry bridge
```

## Error handling

- MapLibre source/layer not yet initialised when `round-ended` fires on slow CI: existing `try/catch` around reveal-geometry stays; animated path adds the same guard.
- Country centroid lookup fails (clickedCca3 not in `byCca3`): `computeRevealAnimationPlan` returns `null`, falls back to border-pulse-only. Log via `console.warn`, don't throw.
- `requestAnimationFrame` running after unmount: effect cleanup cancels the handle and clears sources via `clearRevealSources`.
- Playwright source-state assertions with style not yet loaded: `waitForFunction` polls `__funworldmap_map.getSource()` until defined, 5 s timeout.
- `findCountryUnderPoint` called before the fill layer is added: `queryRenderedFeatures` returns `[]` on both passes, falls back to `onDeselect` (no crash).

## Testing summary

| Layer | Commit | Coverage |
| --- | --- | --- |
| Unit (Vitest) | 1 | `computeRevealAnimationPlan` duration formula, null cases, intermediate progress values |
| Unit (Vitest) | 2 | `findCountryUnderPoint`: exact hit, near-miss in tolerance, miss outside tolerance, nearest-of-many, fine-pointer parity |
| E2E (Playwright) | 3 | `mobile-tap`, `reveal-animation`, `reveal-animation-reduced-motion`, `mobile-daily-flow`, `mobile-free-play` — all run under `chromium`, `mobile-chromium`, `mobile-firefox` |

## Rollout

All three commits ship together in one PR. No feature flags (changes are universally beneficial). No migration (no stored state touched). CI's three Playwright projects run in parallel; PR blocks on all three green.

## Open questions

None — all resolved during brainstorming.
