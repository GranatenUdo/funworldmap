# Camera coherence — design

**Date:** 2026-05-17
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

A constellation of camera-behavior complaints surfaced during in-session testing on 2026-05-17 after the preserve-zoom-on-country-click fix landed (`f82fd4d`):

1. Starting a game still zoomed the user out to the world view — country-pinning's per-mode `initialCameraView: 'preserve'` contract was being overridden by an unconditional `flyTo` in `App.tsx`.
2. Between rounds in city-guessing, the camera flew back to default world view on every new round.
3. The reveal-line animation between the user's guess and the target city felt choppy (per-frame `setData` + `jumpTo`).
4. The previous round's reveal marker and dashed line lingered into the next round instead of being cleared.

This spec consolidates all four into one rule and one implementation pass: **the user's view is preserved everywhere except during the reveal animation, which is the only place the camera intentionally moves on its own.**

Total surface: delete two `flyTo`-to-default effects, delete the `initialCameraView` mode property, rework the reveal animation's per-frame work (camera via single `easeTo`, line via `line-gradient` paint property), extend cleanup to fire on round transitions instead of only on game end.

## Goals & non-goals

**Goals**

- One coherent rule: user's view is preserved on every game lifecycle event (start, round advance, end). The reveal animation is the sole exception.
- Reveal animation no longer rebuilds the line GeoJSON every frame; camera moves are interpolated rather than teleported.
- Reveal artifacts (target marker, dashed arc) are cleared the moment the next round begins, not held until game-over.
- Dead state is removed — the now-vestigial `initialCameraView` mode property goes; both modes effectively become `'preserve'`.

**Non-goals**

- No change to user-initiated camera motion (drag, scroll-zoom, Home key, reset-view control).
- No change to `flyToCountry` (the country-selection clamp from `f82fd4d` stays as-is).
- No change to country-pinning's round-end target panel or its `flyTo` behavior — those don't go through the lifecycle camera path.
- No "skip the reveal" interaction added.
- The pre-existing `setRound`-returning-false e2e flakiness in `e2e/game-city-guessing.spec.ts` is out of scope; verified to exist on `main` before any of this work.

## Branch & PR

- **Branch:** continue on `feat/ux-phase2-pr1a` (this work is contiguous with the preserve-zoom commit `f82fd4d`).
- **Commits, in load-bearing order:**
  1. `fix(game): preserve user view at game start and between rounds` (deletes both `flyTo(DEFAULT_*)` effects; the round-start effect was the sole reader of `mode.initialCameraView`, so the property becomes orphan in this commit)
  2. `refactor(game): remove vestigial initialCameraView property and unused mode prop` (deletes the now-orphan `initialCameraView` from the `GameMode` type, both mode configs, and the `mode` parameter on `useRevealMapEffects` which is no longer read)
  3. `perf(reveal): drive line growth via line-gradient, camera via easeTo`
  4. `fix(reveal): clear reveal artifacts on round transition`

Commit 1 must land before commit 2 — if the property is removed first, the reader in `useRevealMapEffects:334` would break the typecheck. Commits 3 and 4 are independent of each other but both depend on commit 2's simpler structure to avoid merge churn.

---

## Item 1 — Remove `initialCameraView` mode property

### Where

- `src/game/shared/types.ts:119` (the property declaration on `GameMode`)
- `src/game/modes/country-pinning/index.tsx:14` (currently `'preserve'`)
- `src/game/modes/city-guessing/index.tsx:30` (currently `'world'`)
- `src/game/hooks/useRevealMapEffects.ts:334` (the only reader)
- `src/game/hooks/__tests__/useRevealMapEffects.test.tsx:199-216` (test of the readers)
- `src/game/hooks/__tests__/useGameTestSeams.test.tsx:30` (test fixture)

### What

Delete the `initialCameraView` property everywhere. Both modes effectively become `'preserve'`. The reader in `useRevealMapEffects` (Item 3) is removed in the same step.

The mode-config files lose one line each, the type loses one property, and the dependent tests are either rewritten (the `flyTo on round-start` test in `useRevealMapEffects.test.tsx`) or simplified (the seam test fixture no longer needs to set the field).

### Why not keep the field as documentation

Per the project memory ("Remove obsolete code and tests"): deleting code with no reader is the rule, not the exception. A field that exists only to satisfy an old type contract is dead weight.

---

## Item 2 — Preserve user view at game start and between rounds

### Where

- `src/App.tsx:232-244` — delete the entire `useEffect`. (The block that calls `mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, … })` on `session.status === 'playing' && roundIndex === 0`.)
- `src/game/hooks/useRevealMapEffects.ts:332-339` — delete the entire round-start camera reset effect. The `mode` parameter on `useRevealMapEffects` was its only consumer; after deletion the parameter is unused and is removed from `UseRevealMapEffectsArgs` (and the call site `src/game/GameController.tsx:57`) in commit 2.
- The `selected → deselect` and `setComparePickingMode(false)` calls that were inside the App.tsx effect must still run on game start (they're not camera-related — they're "clean up the non-game UI state for the playing surface"). Either keep them in a slimmed-down effect, or fold them into the existing game-active state handling. Recommend: a new minimal effect that ONLY handles the non-camera side-effects.

### What

```ts
// src/App.tsx — replacement for lines 232-244
useEffect(() => {
  if (session.status !== 'playing' || session.roundIndex !== 0) return
  if (selected) deselect()
  setComparePickingMode(false)
  // No camera reset — user's view is preserved at game start.
}, [session.status, session.roundIndex, selected, deselect])

// src/game/hooks/useRevealMapEffects.ts — lines 332-339 deleted entirely.
// The `mode` parameter on UseRevealMapEffectsArgs is now unused by any effect
// in this hook (the round-end geometry, intermediate flash, city click, and
// idle cleanup effects all read only `session.*` and `byCca3`). It is removed
// in commit 2 of the load-bearing order — see the GameMode-property cleanup.
```

### Edge cases

- **Reduced-motion path.** The App.tsx effect's previous behavior was `duration: 0` under `prefersReducedMotion()`. With no `flyTo`, reduced-motion is a no-op too. No change in behavior for reduced-motion users.
- **Daily resume.** When a user reloads mid-daily and the session resumes (`useDailyResumePersistence`), `roundIndex` may be > 0. The deleted effect was guarded by `roundIndex !== 0`, so it never ran on resume anyway. No regression.
- **Browser back/forward.** Game state transitions driven by hash changes don't go through these effects' deps differently. No regression.

---

## Item 3 — Smooth reveal animation: `easeTo` camera, `line-gradient` line

### Where

`src/game/hooks/useRevealMapEffects.ts:148-218` — the round-ended geometry effect's rAF loop.

### What today

```ts
// Today's per-frame work (line 187-215, simplified):
const step = (now) => {
  const idx = Math.ceil(easedProgress * (totalPoints - 1))
  if (idx !== lastIdx) {
    lineSrc.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: arc.slice(0, idx + 1) },
          properties: {},
        },
      ],
    })
    map.jumpTo({ center: arc[idx] })
  }
  frameId = linear < 1 ? requestAnimationFrame(step) : null
}
```

`setData` triggers source/tile rebuild on every changed frame. `jumpTo` is a teleport with no interpolation — the cubic-ease the code computes by hand only affects which arc index is selected, not how the camera moves between indices.

### What changes

**Source instantiation** (in `ensureRevealSources`, `useRevealMapEffects.ts:36-51`): add `lineMetrics: true` to the line source so `['line-progress']` is available in paint expressions.

**Layer creation**: add a `line-gradient` paint property that masks the line via a step on `['line-progress']` with a single variable boundary (initially `0`).

```ts
map.addLayer({
  id: REVEAL_LINE_LAYER,
  type: 'line',
  source: REVEAL_LINE_SOURCE,
  paint: {
    'line-color': REVEAL_WRONG, // base color, overridden by gradient below
    'line-width': 3,
    'line-dasharray': [2, 2],
    'line-gradient': [
      'step',
      ['line-progress'],
      REVEAL_WRONG, // 0 → progress: visible
      0, // boundary at 0 initially — nothing visible
      'rgba(0,0,0,0)', // beyond progress: transparent
    ],
  },
})
```

**rAF loop**: replace per-frame `setData` + `jumpTo` with a single `easeTo` for the camera and per-frame `setPaintProperty` on the gradient stop.

```ts
const arc = tessellateArc(plan.from, plan.to, 64)
ensureRevealSources(map)
const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource

markerSrc.setData({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: plan.to }, properties: {} },
  ],
})
lineSrc.setData({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: arc }, properties: {} },
  ],
})

if (plan.durationMs === 0) {
  // Reduced-motion shortcut: line fully visible, camera jumps to target.
  map.setPaintProperty(REVEAL_LINE_LAYER, 'line-gradient', [
    'step',
    ['line-progress'],
    REVEAL_WRONG,
    1,
    'rgba(0,0,0,0)',
  ])
  map.jumpTo({ center: plan.to })
} else {
  map.jumpTo({ center: plan.from })
  map.easeTo({
    center: plan.to,
    duration: plan.durationMs,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
  const start = performance.now()
  const step = (now: number) => {
    const linear = Math.min(1, (now - start) / plan.durationMs)
    const eased = 1 - Math.pow(1 - linear, 3)
    try {
      map.setPaintProperty(REVEAL_LINE_LAYER, 'line-gradient', [
        'step',
        ['line-progress'],
        REVEAL_WRONG,
        eased,
        'rgba(0,0,0,0)',
      ])
    } catch {
      /* layer torn down */
    }
    frameId = linear < 1 ? window.requestAnimationFrame(step) : null
  }
  frameId = window.requestAnimationFrame(step)
}
```

### Why this is faster

- **`setData` once instead of per-frame**: the source/tile-rebuild path runs once, not 60 times.
- **`setPaintProperty('line-gradient', …)` is a paint update**, not a source invalidation — MapLibre only re-renders the existing tiles, doesn't re-tile.
- **`easeTo` handles the camera animation internally** with maplibre's own interpolation. The rAF loop no longer touches the camera at all; it only updates the gradient mask. The camera is therefore guaranteed smooth, decoupled from any JS frame jitter.

### Correctness

- The visible result is identical: a dashed arc that grows from `plan.from` to `plan.to` over `plan.durationMs`, with the camera tracking the line head along the arc on an ease-out-cubic curve.
- The arc passed to `easeTo` is the great-circle endpoint; maplibre interpolates the camera _along the projection's natural path_ between current center and target. On a globe projection, this follows the great-circle arc visually, matching what the line draws. (The line itself follows the tessellated arc points exactly.)
- Reduced-motion preserves its existing shortcut behavior — full line visible instantly, camera jumps to target. No animation regression for that audience.

### Failure modes handled

- Source/layer torn down mid-animation: existing try/catch covers the new `setPaintProperty` call site the same way it covered `setData`.
- Map removed during reveal: rAF cleanup function still cancels the frame.
- Multiple rapid rounds (resume mid-flight): the round-ended effect's cleanup cancels the prior rAF before the new one starts; `easeTo` calls overwrite each other (maplibre handles this — the latest `easeTo` wins).

---

## Item 4 — Clear reveal artifacts on round transition

### Where

`src/game/hooks/useRevealMapEffects.ts:223-232` — the cleanup of the round-ended geometry effect.

### What today

```ts
return () => {
  if (frameId !== null) window.cancelAnimationFrame(frameId)
  if (reveal.kind === 'country') {
    try {
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
    } catch {
      /* no-op */
    }
  }
}
```

The cleanup only clears the country-mode hover-border filter. The marker and line sources are left in place, lingering visually into the next round until the user ends the game (the separate "clear on idle" effect at line 357 fires). This affects _both modes_: city-guessing reveals draw a point marker + dashed arc; country-pinning wrong-guesses with a known `clickedCca3` also draw the same marker + arc via `computeRevealAnimationPlan`.

### What changes

```ts
return () => {
  if (frameId !== null) window.cancelAnimationFrame(frameId)
  if (reveal.kind === 'country') {
    try {
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
    } catch {
      /* no-op */
    }
  }
  // Always clear the marker + line sources — both country wrong-guesses
  // (when clickedCca3 is known) and city reveals draw them via
  // computeRevealAnimationPlan, so the cleanup must be mode-neutral.
  clearRevealSources(map)
}
```

The country-only `hoverBorder` filter clear stays for the country highlight effect (lines 103-112 of the same effect set the filter on round-ended; cleanup undoes it). `clearRevealSources` runs unconditionally because its no-op when sources weren't instantiated is cheap (the helper already null-checks via `map.getSource(...)?.setData(...)`).

The effect's cleanup now mirrors its setup: whatever the round-ended effect drew, it tears down when status leaves `'round-ended'`. The existing "clear on idle" effect at line 357 stays as a defense-in-depth safety net for the user-ends-game-while-in-round-ended-state edge case — harmless if it runs twice.

### Boundary: when does this fire?

The effect's deps are `[session.status, session.lastOutcome, byCca3]`. The cleanup runs when:

1. `session.status` changes off `'round-ended'` (the round advances OR the game ends), OR
2. `session.lastOutcome` changes (next round-ended reveal replaces this one), OR
3. The component unmounts.

All three are correct moments to clear. The user's "remove when next round starts" case is covered by (1) and (2).

---

## Testing

### Unit (vitest)

- **`src/game/hooks/__tests__/useRevealMapEffects.test.tsx`** — rewrite the existing `flyTo on round-start when initialCameraView === 'world'` test:
  - **Now asserts:** the round-start camera-reset effect is _removed_ (fakeMap.calls.flyTo from round-start path is empty across a `status: 'idle' → 'playing'` transition for both modes).
  - **Add:** when round-ended fires with a city reveal, `easeTo` is called once with `center: plan.to` and `duration: plan.durationMs`.
  - **Add:** the line source's `setData` is called exactly once (the full arc), not per frame.
  - **Add:** when the effect cleanup runs after a city reveal, `clearRevealSources` is invoked (marker + line sources have empty `FeatureCollection`).
  - **Add:** reduced-motion path — `easeTo` is _not_ called; `jumpTo({ center: plan.to })` is called; line gradient is set to fully-visible.
- **`src/game/hooks/__tests__/useGameTestSeams.test.tsx`** — remove `initialCameraView: 'world'` from the test fixture (line 30).
- **`src/App.tsx`** test (if one exists for the game-start camera effect — check `src/__tests__/` or App-related test files). If none exists, this is a one-line behavior change verified by the existing e2e flow (panel + selection unchanged).
- **Typecheck enforces** removal of `initialCameraView` from the mode configs once the property is deleted from the `GameMode` interface.

### E2E (Playwright)

- `e2e/game-city-guessing.spec.ts` and `e2e/game-country-pinning.spec.ts` exist and exercise full game flows. They don't assert specific camera state, so they should pass unchanged.
- **Extend `e2e/reveal-animation.spec.ts`**: add an assertion that after the reveal completes and the round advances, `map.getSource(REVEAL_MARKER_SOURCE).serialize().data.features.length === 0` (and same for line). Confirms artifact cleanup happens at the round boundary.
- The 5 pre-existing `setRound`-returning-false failures in `e2e/game-city-guessing.spec.ts` are out of scope (verified on `main`).

### Browser smoke check (per CLAUDE.md)

Add to the implementation plan, not the spec — covered there as the last step before commit.

---

## Risks

- **Globe-projection visual mismatch.** `easeTo` interpolates the camera center along maplibre's projection-natural path; the dashed line we draw follows the tessellated great-circle arc. On a globe projection, these are visually the same (great-circle = shortest path). Verified by reading the maplibre source: globe projection's camera interpolation uses spherical-linear interpolation, which is the great-circle. Should match the tessellated arc within sub-pixel tolerance over a 1.4 s animation.
- **`line-gradient` paint property requires `lineMetrics: true` on the source.** Setting this on the existing source is fine; it adds a small computational cost on `setData` to compute per-vertex distances. One-time per reveal, negligible.
- **Removing `initialCameraView` is a wider blast radius than the other items** (touches type, two mode configs, two test files). Mitigated by keeping it as its own first commit so any regression is bisectable.

## Rollback

`git revert` each commit independently. Each lands clean. No data, storage, or config impact.

## Open questions (not in scope)

- **Daily-already-played UX** (separate task): tapping a daily mode card when the daily is done routes silently to the reveal overlay. Looks like "the game instantly ended." Separate spec.
- **`setRound`-returning-false e2e flakiness**: 5 of 9 tests in `e2e/game-city-guessing.spec.ts` fail on the seam returning false. Exists on `main`. Separate investigation.
