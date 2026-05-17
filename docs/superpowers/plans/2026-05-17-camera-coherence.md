# Camera coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the camera obey one rule — preserve the user's view on every game lifecycle event (start, round advance, end). The reveal animation is the only place the camera intentionally moves.

**Architecture:** Four independently revertable commits on `feat/ux-phase2-pr1a`. Commit 1 deletes two `flyTo(DEFAULT_*)` effects (App-level game-start and reveal-hook round-start). Commit 2 removes the now-orphan `initialCameraView` mode property and the now-unused `mode` parameter on `useRevealMapEffects`. Commit 3 rewrites the reveal animation's per-frame cost: line growth via `line-gradient` paint property on a once-loaded source, camera via a single `easeTo`. Commit 4 extends the round-ended cleanup to fire artifact clearing at the round boundary.

**Tech Stack:** TypeScript, React, MapLibre-GL (`line-gradient` + `line-progress`, `easeTo` interpolated camera, `lineMetrics: true` on GeoJSON sources), Vitest (unit tests), Playwright (e2e regression check).

Spec: `docs/superpowers/specs/2026-05-17-camera-coherence-design.md`.

---

## File Structure

**Modify:**

- `src/App.tsx:232-244` — delete the game-start `flyTo`, slim down the side-effects in this effect.
- `src/game/hooks/useRevealMapEffects.ts` — three change zones (described per task):
  - lines 36-51 (`ensureRevealSources`): add `lineMetrics: true` and `line-gradient`.
  - lines 148-218 (round-ended geometry effect's rAF loop): replace per-frame `setData` + `jumpTo` with one-shot full-arc `setData` + `easeTo` + per-frame `setPaintProperty('line-gradient', …)`.
  - lines 223-232 (round-ended cleanup): extend to call `clearRevealSources` for city reveals.
  - lines 332-339 (round-start camera reset effect): delete.
- `src/game/shared/types.ts:119` — delete `initialCameraView` property.
- `src/game/modes/country-pinning/index.tsx:14` — delete `initialCameraView: 'preserve'` line.
- `src/game/modes/city-guessing/index.tsx:30` — delete `initialCameraView: 'world'` line.
- `src/game/GameController.tsx:57` — drop `mode` from the `useRevealMapEffects` call site after commit 2.
- `src/game/hooks/__tests__/useRevealMapEffects.test.tsx:199-220` — rewrite the round-start `flyTo` test as an _anti-test_ that asserts `flyTo` is not called on game start.
- `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` — add new tests for `easeTo` invocation, single-shot `setData` arc, gradient progress updates, reduced-motion shortcut, and city-reveal cleanup on round transition.
- `src/game/hooks/__tests__/useGameTestSeams.test.tsx:30` — delete the `initialCameraView: 'world'` line in the test fixture.
- `e2e/reveal-animation.spec.ts` — extend the existing wrong-country test to assert reveal-marker source is empty after advancing the round.

No new files. The plan operates within the existing module boundaries.

---

## Task 1: Delete game-start and round-start camera resets

**Files:**

- Modify: `src/App.tsx:232-244`
- Modify: `src/game/hooks/useRevealMapEffects.ts:332-339`
- Test: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx:199-220` (existing test rewritten as anti-test)

This task lands the behavior change. The `mode.initialCameraView` field is still referenced inside the round-start effect _at the moment of edit_; we delete the entire block including the read, so the field becomes orphan after this commit. Commit 2 cleans up the orphan.

- [ ] **Step 1: Rewrite the failing test (inverted assertion)**

Open `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`, replace the existing test at lines 199-220 with the inverted version:

```ts
it('does NOT flyTo at round-start (camera is preserved across game lifecycle)', () => {
  const fake = createFakeMapRef()
  const session = makeSession({
    status: 'playing',
    modeId: 'city-guessing',
    currentRound: makeCityRound(),
  })
  renderRevealHook(
    buildRevealArgs({
      session,
      mode: getMode('city-guessing', POOLS),
      mapRef: fake.ref,
    }),
  )
  expect(fake.calls.flyTo).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx -t "does NOT flyTo" --reporter=verbose`

Expected: FAIL with `expected "flyTo" to not have been called, but it was called 1 time with: ...`.

If it passes immediately, stop — something else has already removed the effect; re-read `useRevealMapEffects.ts:332-339` and reconcile.

- [ ] **Step 3: Delete the round-start camera reset effect**

Open `src/game/hooks/useRevealMapEffects.ts`. Locate the block at lines 332-339:

```ts
// Camera reset on round start when mode requests it.
useEffect(() => {
  if (session.status !== 'playing' || !mode) return
  if (mode.initialCameraView !== 'world') return
  const map = mapRef.current
  if (!map) return
  const reduced = prefersReducedMotion()
  map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: reduced ? 0 : 700 })
}, [session.status, session.roundIndex, mode])
```

Delete it entirely, including the comment line above. The hook still uses the surrounding helper functions; do not remove the file-level imports of `DEFAULT_CENTER` / `DEFAULT_ZOOM` yet — they will be cleaned up automatically by the lint/typecheck step in commit 2 if no remaining call site uses them. (Quick check: `Grep` confirms the only other reference in this file is the one we just removed, so the imports become unused now.)

Remove the unused imports too in this step to avoid an ESLint failure on commit:

```ts
// Before (top of file, line 10):
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../../lib/mapStyles'

// After:
// (delete the line entirely — both constants were used only by the deleted effect)
```

Verify: `npx eslint src/game/hooks/useRevealMapEffects.ts` should return clean.

- [ ] **Step 4: Slim the App.tsx game-start effect (delete the flyTo, keep side-effects)**

Open `src/App.tsx`. Locate the effect at lines 232-244:

```ts
useEffect(() => {
  if (session.status !== 'playing' || session.roundIndex !== 0) return
  if (selected) deselect()
  setComparePickingMode(false)
  const reduced = prefersReducedMotion()
  mapRef.current?.flyTo({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    duration: reduced ? 0 : 700,
  })
  // Fires on the very first round of each new game — covers idle→playing
  // and game-over→Play-again transitions without needing a prev-status ref.
}, [session.status, session.roundIndex, selected, deselect, mapRef])
```

Replace with the camera-free version:

```ts
useEffect(() => {
  if (session.status !== 'playing' || session.roundIndex !== 0) return
  if (selected) deselect()
  setComparePickingMode(false)
  // No camera reset — user's view is preserved at game start.
  // Fires on the very first round of each new game — covers idle→playing
  // and game-over→Play-again transitions without needing a prev-status ref.
}, [session.status, session.roundIndex, selected, deselect])
```

Note the deps array drops `mapRef` (no longer read).

If `prefersReducedMotion` is no longer referenced anywhere else in App.tsx, remove its import. Check with `Grep "prefersReducedMotion" src/App.tsx` — if only the removed `flyTo` block referenced it, drop the import line near the top:

```ts
// Before (line 29):
import { prefersReducedMotion } from './lib/motion'

// After: (delete the line)
```

Same for `DEFAULT_CENTER`, `DEFAULT_ZOOM`, and `mapRef` if those become unused. Verify with `Grep` per identifier inside `src/App.tsx`. Be precise — don't blindly delete; only remove imports that have zero remaining references.

- [ ] **Step 5: Re-run the test, confirm it passes**

Run: `npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx -t "does NOT flyTo" --reporter=verbose`

Expected: PASS.

- [ ] **Step 6: Run the full unit suite**

Run: `npx vitest run --reporter=dot`

Expected: all tests pass. Test count = previous total (currently 461) since we replaced an existing test rather than added one.

If any other test fails, it's likely a test that was implicitly relying on the now-deleted camera reset (e.g. checking `flyTo` was called as part of a larger assertion). Read the failure and update the assertion to match the new contract.

- [ ] **Step 7: Typecheck + lint touched files**

Run: `npm run typecheck && npx eslint src/App.tsx src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx`

Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx
git commit -m "$(cat <<'EOF'
fix(game): preserve user view at game start and between rounds

Delete the App.tsx game-start flyTo and the useRevealMapEffects
round-start camera reset. Both unconditionally flew to DEFAULT_CENTER /
DEFAULT_ZOOM, overriding the user's view on every transition into
'playing'. After this change the camera moves on its own only during
the reveal animation; lifecycle transitions preserve whatever the user
had on screen.

The App.tsx effect retains its non-camera side-effects (deselect any
selected country, exit compare-picking mode). The
useRevealMapEffects round-start effect is deleted entirely — it was
the sole reader of mode.initialCameraView, which becomes orphan and is
removed in the next commit.

Spec: docs/superpowers/specs/2026-05-17-camera-coherence-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit hook (lint-staged + prettier + eslint) runs clean; new commit lands on the branch.

---

## Task 2: Remove vestigial `initialCameraView` property + unused `mode` prop

**Files:**

- Modify: `src/game/shared/types.ts:119`
- Modify: `src/game/modes/country-pinning/index.tsx:14`
- Modify: `src/game/modes/city-guessing/index.tsx:30`
- Modify: `src/game/hooks/useRevealMapEffects.ts` (signature: drop `mode` from `UseRevealMapEffectsArgs`)
- Modify: `src/game/GameController.tsx:57` (call site: drop `mode` arg)
- Modify: `src/game/hooks/__tests__/useGameTestSeams.test.tsx:30` (fixture: drop `initialCameraView` line)
- Modify: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` (testers' fixture: drop `mode` from `BuildRevealArgsOverrides` / `buildRevealArgs`)

No test changes needed beyond the fixture cleanups — Task 1 already rewrote the only behavior-asserting test that depended on `initialCameraView`.

- [ ] **Step 1: Remove the property from the type**

Open `src/game/shared/types.ts`. Locate line 119 (`initialCameraView: 'world' | 'preserve'`) and delete it.

After edit, the `GameMode` type runs from line 113 through 124, one line shorter.

- [ ] **Step 2: Remove the property from country-pinning mode**

Open `src/game/modes/country-pinning/index.tsx`. Locate line 14 (`initialCameraView: 'preserve',`) and delete it.

- [ ] **Step 3: Remove the property from city-guessing mode**

Open `src/game/modes/city-guessing/index.tsx`. Locate line 30 (`initialCameraView: 'world',`) and delete it.

- [ ] **Step 4: Remove `mode` from `UseRevealMapEffectsArgs`**

Open `src/game/hooks/useRevealMapEffects.ts`. In the args interface (around lines 66-72), drop the `mode` field:

```ts
// Before:
export interface UseRevealMapEffectsArgs {
  session: GameSession
  mode: GameMode | null
  mapRef: RefObject<maplibregl.Map | null>
  byCca3: Map<string, CountryLike>
  submitGuessInput: (input: GuessInput) => void
}

// After:
export interface UseRevealMapEffectsArgs {
  session: GameSession
  mapRef: RefObject<maplibregl.Map | null>
  byCca3: Map<string, CountryLike>
  submitGuessInput: (input: GuessInput) => void
}
```

In the destructure on lines 81-87 (or wherever it lives after Task 1's edits), drop `mode`:

```ts
// Before:
export function useRevealMapEffects({
  session,
  mode,
  mapRef,
  byCca3,
  submitGuessInput,
}: UseRevealMapEffectsArgs): void {

// After:
export function useRevealMapEffects({
  session,
  mapRef,
  byCca3,
  submitGuessInput,
}: UseRevealMapEffectsArgs): void {
```

If the unused `GameMode` type import becomes orphan (it was only referenced through `mode: GameMode | null`), remove it too:

```ts
// Before (line 3):
import type { CountryLike, GameMode, GameSession, GuessInput } from '../shared/types'

// After:
import type { CountryLike, GameSession, GuessInput } from '../shared/types'
```

- [ ] **Step 5: Update the `GameController.tsx` call site**

Open `src/game/GameController.tsx`. Locate line 57:

```ts
// Before:
useRevealMapEffects({ session, mode, mapRef, byCca3, submitGuessInput })

// After:
useRevealMapEffects({ session, mapRef, byCca3, submitGuessInput })
```

- [ ] **Step 6: Update the seam test fixture**

Open `src/game/hooks/__tests__/useGameTestSeams.test.tsx`. Locate line 30 (`initialCameraView: 'world',`) inside `makeMode` and delete it.

- [ ] **Step 7: Update the reveal-effect test fixture**

Open `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`. The `BuildRevealArgsOverrides` interface (around lines 26-32) and the `buildRevealArgs` function (around 34-42) both reference `mode`. Remove the field:

```ts
// Before:
interface BuildRevealArgsOverrides {
  session?: RevealArgs['session']
  mode?: RevealArgs['mode']
  mapRef?: RevealArgs['mapRef']
  byCca3?: RevealArgs['byCca3']
  submitGuessInput?: RevealArgs['submitGuessInput']
}

function buildRevealArgs(overrides: BuildRevealArgsOverrides = {}): RevealArgs {
  return {
    session: overrides.session ?? makeSession(),
    mode: overrides.mode ?? getMode('country-pinning', POOLS),
    mapRef: overrides.mapRef ?? createFakeMapRef().ref,
    byCca3: overrides.byCca3 ?? byCca3Fixture,
    submitGuessInput: overrides.submitGuessInput ?? vi.fn(),
  }
}

// After:
interface BuildRevealArgsOverrides {
  session?: RevealArgs['session']
  mapRef?: RevealArgs['mapRef']
  byCca3?: RevealArgs['byCca3']
  submitGuessInput?: RevealArgs['submitGuessInput']
}

function buildRevealArgs(overrides: BuildRevealArgsOverrides = {}): RevealArgs {
  return {
    session: overrides.session ?? makeSession(),
    mapRef: overrides.mapRef ?? createFakeMapRef().ref,
    byCca3: overrides.byCca3 ?? byCca3Fixture,
    submitGuessInput: overrides.submitGuessInput ?? vi.fn(),
  }
}
```

Then walk the existing test cases — anywhere `buildRevealArgs({ ..., mode: getMode(...) })` appears, drop the `mode:` line. The Task-1 anti-test no longer needs the `mode` either; remove it from that call too:

```ts
// Task 1's anti-test, after this step:
renderRevealHook(
  buildRevealArgs({
    session,
    mapRef: fake.ref,
  }),
)
```

If `getMode` and `POOLS` are no longer referenced after dropping `mode:` from every call site, remove their imports/definitions at the top of the file.

- [ ] **Step 8: Run the full unit suite**

Run: `npx vitest run --reporter=dot`

Expected: all tests pass, same count as Task 1.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`

Expected: clean. The typecheck enforces that no other file is still reading `initialCameraView`. If it fails with `Property 'initialCameraView' does not exist on type 'GameMode'`, fix the reader (probably a test fixture missed by the file list above; grep for `initialCameraView` to find it).

- [ ] **Step 10: Lint touched files**

Run: `npx eslint src/game/shared/types.ts src/game/modes/country-pinning/index.tsx src/game/modes/city-guessing/index.tsx src/game/hooks/useRevealMapEffects.ts src/game/GameController.tsx src/game/hooks/__tests__/useGameTestSeams.test.tsx src/game/hooks/__tests__/useRevealMapEffects.test.tsx`

Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add src/game/shared/types.ts src/game/modes/country-pinning/index.tsx src/game/modes/city-guessing/index.tsx src/game/hooks/useRevealMapEffects.ts src/game/GameController.tsx src/game/hooks/__tests__/useGameTestSeams.test.tsx src/game/hooks/__tests__/useRevealMapEffects.test.tsx
git commit -m "$(cat <<'EOF'
refactor(game): remove vestigial initialCameraView + unused mode prop

The initialCameraView property on GameMode was only read by the
round-start camera reset effect deleted in the previous commit. Drop
the field from the type, both mode configs, and the test fixtures.
Same for the now-unused `mode` prop on useRevealMapEffects — no
remaining effect in the hook reads it, so the parameter is dead.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit hooks clean; commit lands.

---

## Task 3: Smooth the reveal animation (`easeTo` camera, `line-gradient` line)

**Files:**

- Modify: `src/game/hooks/useRevealMapEffects.ts` (the round-ended geometry effect + `ensureRevealSources`)
- Test: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` (add new test cases)

- [ ] **Step 1: Write failing tests for the new mechanics**

Open `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`. Inside the existing `describe('useRevealMapEffects', …)` block, add these tests. They go near the bottom of the file, just above the closing brace of the `describe`. Reuse the existing helpers (`buildRevealArgs`, `renderRevealHook`, `createFakeMapRef`, `makeCityRound`, etc.).

```ts
it('calls easeTo once on city wrong-guess reveal (not jumpTo per frame)', () => {
  const fake = createFakeMapRef()
  // Wrong guess with a known clicked point (not at the target). Triggers
  // the arc-animation branch of the round-ended geometry effect.
  const clickedPoint: [number, number] = [-10, 40]
  const reveal: {
    kind: 'point'
    targetCentroid: [number, number]
    clickedPoint: [number, number]
    distanceKm: number
  } = {
    kind: 'point',
    targetCentroid: [2.3522, 48.8566], // Paris
    clickedPoint,
    distanceKm: 1500,
  }
  const session = makeSession({
    status: 'round-ended',
    modeId: 'city-guessing',
    lastOutcome: makeOutcome(reveal),
  })
  renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

  // easeTo should be called exactly once with center = target.
  expect(fake.calls.easeTo).toHaveBeenCalledTimes(1)
  const arg = fake.calls.easeTo.mock.calls[0][0] as { center: [number, number]; duration: number }
  expect(arg.center).toEqual([2.3522, 48.8566])
  expect(arg.duration).toBeGreaterThan(0)

  // jumpTo should still be called once (to snap to the guess start), but
  // NOT per frame.
  expect(fake.calls.jumpTo.mock.calls.length).toBeLessThanOrEqual(1)
})

it('calls setData on the line source exactly once with the full tessellated arc', () => {
  const fake = createFakeMapRef()
  const reveal: {
    kind: 'point'
    targetCentroid: [number, number]
    clickedPoint: [number, number]
    distanceKm: number
  } = {
    kind: 'point',
    targetCentroid: [2.3522, 48.8566],
    clickedPoint: [-10, 40],
    distanceKm: 1500,
  }
  const session = makeSession({
    status: 'round-ended',
    modeId: 'city-guessing',
    lastOutcome: makeOutcome(reveal),
  })
  renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

  // The line source's setData should be called for the LineString — once
  // with the full arc (65 vertices = 64 tessellated segments).
  const lineSetDataCalls = fake.calls.setData.mock.calls.filter(
    (c) =>
      (c[0] as { features?: Array<{ geometry?: { type: string } }> }).features?.[0]?.geometry
        ?.type === 'LineString',
  )
  expect(lineSetDataCalls).toHaveLength(1)
  const data = lineSetDataCalls[0][0] as {
    features: Array<{ geometry: { coordinates: number[][] } }>
  }
  expect(data.features[0].geometry.coordinates).toHaveLength(65)
})

it('drives line growth via line-gradient paint property (animated path)', () => {
  const fake = createFakeMapRef()
  const reveal: {
    kind: 'point'
    targetCentroid: [number, number]
    clickedPoint: [number, number]
    distanceKm: number
  } = {
    kind: 'point',
    targetCentroid: [2.3522, 48.8566],
    clickedPoint: [-10, 40],
    distanceKm: 1500,
  }
  const session = makeSession({
    status: 'round-ended',
    modeId: 'city-guessing',
    lastOutcome: makeOutcome(reveal),
  })
  renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

  // The gradient must be set at least once — on entry, with progress 0
  // (the start of the animation). Test environments may or may not pump
  // rAF; the entry call is the deterministic checkpoint.
  const gradientCalls = fake.calls.setPaintProperty.mock.calls.filter(
    (c) => c[1] === 'line-gradient',
  )
  expect(gradientCalls.length).toBeGreaterThanOrEqual(1)
})

it('reduced-motion: no easeTo, jumpTo target, gradient fully revealed', () => {
  // Override the matchMedia mock to report reduced-motion preference.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  })
  const fake = createFakeMapRef()
  const reveal: {
    kind: 'point'
    targetCentroid: [number, number]
    clickedPoint: [number, number]
    distanceKm: number
  } = {
    kind: 'point',
    targetCentroid: [2.3522, 48.8566],
    clickedPoint: [-10, 40],
    distanceKm: 1500,
  }
  const session = makeSession({
    status: 'round-ended',
    modeId: 'city-guessing',
    lastOutcome: makeOutcome(reveal),
  })
  renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

  expect(fake.calls.easeTo).not.toHaveBeenCalled()
  expect(fake.calls.jumpTo).toHaveBeenCalled()
  const lastJumpTo = fake.calls.jumpTo.mock.calls.at(-1)?.[0] as
    | { center: [number, number] }
    | undefined
  expect(lastJumpTo?.center).toEqual([2.3522, 48.8566])

  // Gradient set to progress=1 (full line) at least once.
  const fullGradient = fake.calls.setPaintProperty.mock.calls.find((c) => {
    if (c[1] !== 'line-gradient') return false
    const expr = c[2] as Array<unknown>
    // ['step', ['line-progress'], color, boundary, transparent]
    return Array.isArray(expr) && expr[0] === 'step' && expr[3] === 1
  })
  expect(fullGradient).toBeDefined()
})
```

Also extend `createFakeMapRef` in `src/test/fakeMapRef.ts` to expose `easeTo`:

```ts
// src/test/fakeMapRef.ts — add easeTo alongside flyTo
const easeTo = vi.fn()
// ...
const map = {
  // ...existing fields...
  easeTo,
  flyTo,
  jumpTo,
} as unknown as maplibregl.Map
return {
  ref,
  calls: {
    // ...existing fields...
    easeTo,
    flyTo,
    jumpTo,
    setData,
  },
}
```

- [ ] **Step 2: Run the new tests, confirm they fail**

Run: `npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx --reporter=verbose`

Expected: the 4 new tests fail. Specific expected failures:

- `calls easeTo once …` → FAIL with `expected "easeTo" to have been called 1 times, but it was called 0 times`.
- `calls setData on the line source exactly once …` → FAIL with `expected length 1 but got <N>` where N > 1 (today's per-frame setData fires multiple times).
- `drives line growth via line-gradient paint property …` → FAIL with `expected length >= 1 but got 0`.
- `reduced-motion …` → FAIL on the gradient check (no gradient paint property is set today).

If any of these pass already, stop — the implementation may have drifted from the spec.

- [ ] **Step 3: Apply the source/layer changes (`lineMetrics` + `line-gradient`)**

Open `src/game/hooks/useRevealMapEffects.ts`. In `ensureRevealSources` (around lines 18-52), modify the line source and layer:

```ts
// Before (current code):
if (!map.getSource(REVEAL_LINE_SOURCE)) {
  map.addSource(REVEAL_LINE_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: REVEAL_LINE_LAYER,
    type: 'line',
    source: REVEAL_LINE_SOURCE,
    paint: {
      'line-color': REVEAL_WRONG,
      'line-width': 3,
      'line-dasharray': [2, 2],
    },
  })
}

// After:
if (!map.getSource(REVEAL_LINE_SOURCE)) {
  map.addSource(REVEAL_LINE_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    lineMetrics: true,
  })
  map.addLayer({
    id: REVEAL_LINE_LAYER,
    type: 'line',
    source: REVEAL_LINE_SOURCE,
    paint: {
      'line-color': REVEAL_WRONG, // base; overridden by line-gradient per frame
      'line-width': 3,
      'line-dasharray': [2, 2],
      'line-gradient': ['step', ['line-progress'], REVEAL_WRONG, 0, 'rgba(0,0,0,0)'],
    },
  })
}
```

- [ ] **Step 4: Rewrite the rAF loop (one-shot setData + easeTo + per-frame gradient)**

Open `src/game/hooks/useRevealMapEffects.ts`. Locate the rAF section inside the round-ended geometry effect (approximately lines 148-218). Replace it with:

```ts
const arc = tessellateArc(plan.from, plan.to, 64)
let frameId: number | null = null

try {
  ensureRevealSources(map)
  const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
  const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource

  // Target marker goes in first so it is visible from t=0.
  markerSrc.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: plan.to },
        properties: {},
      },
    ],
  })

  // Full arc loaded ONCE — line-gradient masks the visible portion per
  // frame, so no per-frame setData / tile rebuild.
  lineSrc.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: arc },
        properties: {},
      },
    ],
  })

  if (plan.durationMs === 0) {
    // Reduced-motion: snap line fully visible, jump camera to target.
    map.setPaintProperty(REVEAL_LINE_LAYER, 'line-gradient', [
      'step',
      ['line-progress'],
      REVEAL_WRONG,
      1,
      'rgba(0,0,0,0)',
    ])
    map.jumpTo({ center: plan.to })
  } else {
    // Snap camera to the wrong-guess start so easeTo has a deterministic
    // starting position regardless of where the user was looking.
    map.jumpTo({ center: plan.from })
    map.easeTo({
      center: plan.to,
      duration: plan.durationMs,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    })
    const start = performance.now()
    let lastProgress = -1
    const step = (now: number) => {
      const linear = Math.min(1, (now - start) / plan.durationMs)
      const eased = 1 - Math.pow(1 - linear, 3)
      // Quantise progress to 1/64 increments to skip redundant paint-property
      // updates when rAF fires faster than a visible change.
      const quantised = Math.round(eased * 64) / 64
      if (quantised !== lastProgress) {
        lastProgress = quantised
        try {
          map.setPaintProperty(REVEAL_LINE_LAYER, 'line-gradient', [
            'step',
            ['line-progress'],
            REVEAL_WRONG,
            quantised,
            'rgba(0,0,0,0)',
          ])
        } catch {
          /* layer torn down */
        }
      }
      frameId = linear < 1 ? window.requestAnimationFrame(step) : null
    }
    frameId = window.requestAnimationFrame(step)
  }
} catch (err) {
  console.warn('reveal geometry skipped:', err)
}

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

The cleanup at the end stays unchanged for now (Task 4 extends it).

The `totalPoints` and `lastIdx` locals from the old loop are gone — replaced by `lastProgress` quantisation. The hand-written ease-out cubic is now used both as the index quantiser AND as the `easing` argument to `easeTo`, so line growth and camera motion follow the same curve.

- [ ] **Step 5: Re-run the new tests, confirm they pass**

Run: `npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx --reporter=verbose`

Expected: all tests pass (existing tests + the 4 new ones).

- [ ] **Step 6: Run the full unit suite**

Run: `npx vitest run --reporter=dot`

Expected: all tests pass. Count = previous total + 4 new tests.

- [ ] **Step 7: Typecheck + lint touched files**

Run: `npm run typecheck && npx eslint src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx src/test/fakeMapRef.ts`

Expected: clean.

- [ ] **Step 8: Run the existing e2e reveal-animation spec**

Run: `npx playwright test e2e/reveal-animation.spec.ts --project=chromium --reporter=list`

Expected: passes. The test asserts the line has 65 vertices (matches our one-shot full-arc setData) and the camera ends near the target (matches `easeTo({ center: plan.to })`). It does NOT assert specific intermediate frames, so the gradient-vs-slice change is invisible to it.

If it fails, read the failure. Likeliest cause: maplibre version may handle `line-gradient` + `lineMetrics` differently than the spec assumes — see the "Risks" section of the spec for the fallback (throttled setData) approach.

- [ ] **Step 9: Browser smoke check (per CLAUDE.md)**

If a dev server is not running, start one: `npm run dev`. Open the page.

1. **Open the launcher, ensure last-mode is country-pinning** (or use the unlimited link with the country-pinning card). Make a deliberately wrong guess on a known target (e.g. set lastMode to country-pinning, search for "France" via search bar, then click on a country far away — the reveal arc should grow from your clicked country to France smoothly, the camera should glide along the arc on an ease-out curve. **Expected:** no jumpy / choppy camera, no visible per-frame source rebuild flicker on the line.
2. **Switch to city-guessing** via the unlimited link (set lastMode in DevTools localStorage: `localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')` then reload). Make a wrong guess. **Expected:** same smooth arc + camera glide.
3. **Reduced-motion:** in DevTools → ⋮ → More tools → Rendering → Emulate CSS media feature: `prefers-reduced-motion: reduce`. Make another wrong guess. **Expected:** instant line + camera jump to target, no animation.

If any of these don't match, fix before committing.

- [ ] **Step 10: Commit**

```bash
git add src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx src/test/fakeMapRef.ts
git commit -m "$(cat <<'EOF'
perf(reveal): drive line growth via line-gradient, camera via easeTo

Today the reveal animation called lineSrc.setData per rAF tick with a
growing arc slice, plus map.jumpTo on the new tail point. Both were
heavy: setData rebuilds the source / re-tiles, jumpTo teleports the
camera (no interpolation). At 60 Hz the camera looked choppy and the
line growth lagged the camera.

Load the full tessellated arc once, then animate visible progress via
line-gradient on line-progress with a step expression. The rAF loop
only updates one paint property (cheap). Camera handled by a single
easeTo with a matching ease-out-cubic curve, so maplibre interpolates
between the start and target positions in a single call.

Reduced-motion path keeps its existing shortcut: full line visible
instantly, camera jumps to target, no animation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Clear reveal artifacts on round transition

**Files:**

- Modify: `src/game/hooks/useRevealMapEffects.ts` (the round-ended cleanup)
- Test: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` (add new test)
- Test: `e2e/reveal-animation.spec.ts` (extend wrong-country test with post-round assertion)

- [ ] **Step 1: Write the failing unit test for round-transition cleanup**

Add this test to `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`, inside the existing `describe`:

```ts
it('clears city reveal artifacts when round transitions from round-ended to playing', () => {
  const fake = createFakeMapRef()
  const reveal: {
    kind: 'point'
    targetCentroid: [number, number]
    clickedPoint: [number, number]
    distanceKm: number
  } = {
    kind: 'point',
    targetCentroid: [2.3522, 48.8566],
    clickedPoint: [-10, 40],
    distanceKm: 1500,
  }
  const roundEndedSession = makeSession({
    status: 'round-ended',
    modeId: 'city-guessing',
    lastOutcome: makeOutcome(reveal),
  })
  const { rerender } = renderHook((args: RevealArgs) => useRevealMapEffects(args), {
    initialProps: buildRevealArgs({ session: roundEndedSession, mapRef: fake.ref }),
  })

  // Reset the setData spy so we only observe what happens on cleanup.
  fake.calls.setData.mockClear()

  // Rerender with the next round playing — this triggers the round-ended
  // effect cleanup.
  const playingSession = makeSession({
    status: 'playing',
    modeId: 'city-guessing',
    roundIndex: 1,
    currentRound: makeCityRound({ targetId: 'GBR-london' }),
  })
  rerender(buildRevealArgs({ session: playingSession, mapRef: fake.ref }))

  // After the transition, the marker AND line sources should have been
  // setData()'d to empty FeatureCollections (clearRevealSources behavior).
  const emptySetDataCalls = fake.calls.setData.mock.calls.filter((c) => {
    const arg = c[0] as { features?: unknown[] }
    return Array.isArray(arg.features) && arg.features.length === 0
  })
  expect(emptySetDataCalls.length).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx -t "clears city reveal artifacts" --reporter=verbose`

Expected: FAIL with `expected length >= 2 but got <N>` where N < 2 (today's cleanup only handles country mode).

- [ ] **Step 3: Extend the round-ended cleanup**

Open `src/game/hooks/useRevealMapEffects.ts`. Locate the return-cleanup block at the end of the round-ended geometry effect (post-Task-3, this is the small block at the bottom of the long try/catch):

```ts
// Before:
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

// After:
return () => {
  if (frameId !== null) window.cancelAnimationFrame(frameId)
  if (reveal.kind === 'country') {
    try {
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
    } catch {
      /* no-op */
    }
  } else {
    // Mirror the city setup: when the round transitions off 'round-ended',
    // clear the marker + line sources so the next round starts clean.
    clearRevealSources(map)
  }
}
```

`clearRevealSources` is the existing helper at line 54 — already swallows errors. No new imports needed.

- [ ] **Step 4: Re-run the unit test, confirm it passes**

Run: `npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx -t "clears city reveal artifacts" --reporter=verbose`

Expected: PASS.

- [ ] **Step 5: Extend the e2e wrong-country test with the post-round assertion**

Open `e2e/reveal-animation.spec.ts`. The test at line 9 (`wrong country guess renders a tessellated line from guess → target`) already advances through the reveal animation and asserts camera state. Add a follow-up block at the end of that test, after the existing camera assertion (after line 45):

```ts
// Advance to the next round and confirm reveal artifacts cleared.
await page.evaluate(() => {
  // For country-pinning best-of-1, the panel opens on round-end. Closing
  // it advances to the next round.
  const closeBtn = document.querySelector<HTMLButtonElement>('[data-testid="panel-close"]')
  closeBtn?.click()
})
await expect
  .poll(
    async () =>
      await page.evaluate(() => {
        type Hook = { getSession?: () => { status: string } }
        const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
        return g?.getSession?.()?.status
      }),
    { timeout: 5_000 },
  )
  .toBe('playing')

// The reveal line source should now be empty (zero features).
const lineFeatureCount = await page.evaluate(() => {
  const src = window.__funworldmap_map?.getSource('reveal-line') as
    | { _data?: { features?: unknown[] } }
    | undefined
  return src?._data?.features?.length ?? -1
})
expect(lineFeatureCount).toBe(0)
```

The literal source ID `'reveal-line'` matches `REVEAL_LINE_SOURCE` in `src/game/shared/revealLayers.ts` — confirm with `Grep "REVEAL_LINE_SOURCE" src/` if uncertain. If the constant has a different value, substitute it in the test.

- [ ] **Step 6: Run the unit suite**

Run: `npx vitest run --reporter=dot`

Expected: all tests pass. Count = Task 3 total + 1 new test.

- [ ] **Step 7: Run the e2e reveal-animation spec**

Run: `npx playwright test e2e/reveal-animation.spec.ts --project=chromium --reporter=list`

Expected: all reveal-animation tests pass, including the extended assertion.

If the new assertion fails (e.g. source ID doesn't match), inspect with `npx playwright test ... --debug` and reconcile.

- [ ] **Step 8: Run the broader e2e regression sweep**

Run: `npx playwright test e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts e2e/map-and-countries.spec.ts e2e/satellite-default.spec.ts --project=chromium --reporter=list`

Expected: all _previously-passing_ specs still pass. The 5 pre-existing `setRound`-returning-false failures in `game-city-guessing.spec.ts` stay red — they're out of scope (verified on `main`).

- [ ] **Step 9: Browser smoke check**

If a dev server is not already running, start one: `npm run dev`. Open the page.

1. **Set lastMode to city-guessing, start unlimited.** Click somewhere wrong. Wait for the reveal arc to complete. **Expected:** marker and dashed line visible. Wait for auto-advance to next round (~600 ms hold). **Expected:** marker and line **disappear** when the next round begins. Without this fix they linger into the next round.
2. **Repeat for country-pinning.** Wrong guess on France (clicking somewhere far). Reveal plays out, the round-end target panel opens. Click the panel's Continue / close button to advance. **Expected:** the country highlight border clears (this was already today's behavior — sanity check it still works).
3. **End the game from round-ended state** (Escape, or End game button). **Expected:** no leftover marker / line / border. The legacy "clear on idle" effect provides defense-in-depth here.

- [ ] **Step 10: Commit**

```bash
git add src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx e2e/reveal-animation.spec.ts
git commit -m "$(cat <<'EOF'
fix(reveal): clear reveal artifacts on round transition

The round-ended geometry effect's cleanup previously only cleared the
country-mode hover-border filter. City-mode reveal (marker + dashed
line) was left in place until the user ended the game — so the
previous round's guess + target visibly lingered into the next round.

Extend the cleanup: when the round transitions off 'round-ended' for a
city reveal, clearRevealSources runs. The existing 'clear on idle'
effect at line 357 stays as defense-in-depth for end-game-from-
round-ended-state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (run after writing, before handing off)

- **Spec coverage:** Every spec item maps to a task.
  - Item 1 (remove `initialCameraView`) → Task 2.
  - Item 2 (preserve user view at game/round start) → Task 1.
  - Item 3 (smooth reveal animation) → Task 3.
  - Item 4 (clear reveal artifacts on transition) → Task 4.
  - Spec Branch & PR commit order (1 fix-game, 2 refactor, 3 perf-reveal, 4 fix-reveal-cleanup) → matches Task 1 → Task 2 → Task 3 → Task 4 here.
  - Spec testing requirements (rewrite the round-start anti-test, add easeTo / setData / gradient / reduced-motion / cleanup tests, extend e2e) → all covered with full code in the steps above.
- **Placeholder scan:** No "TBD", "TODO", "similar to", "fill in" patterns. Every code-changing step has explicit before/after blocks.
- **Type consistency:**
  - `UseRevealMapEffectsArgs` definition in Task 2 step 4 matches the destructure in step 4 and the call site in step 5.
  - The reveal-arg-fixture in Task 2 step 7 strips `mode` consistently with the interface change.
  - `createFakeMapRef`'s added `easeTo` mock is consumed by Task 3 tests.
  - Source ID `'reveal-line'` and layer ID `'reveal-line-layer'` aren't hard-coded — Task 3 uses the existing `REVEAL_LINE_SOURCE` / `REVEAL_LINE_LAYER` constants from `src/game/shared/revealLayers.ts`; Task 4 step 5's e2e literal `'reveal-line'` is gated by a runtime check in the same step ("substitute if the constant has a different value").
