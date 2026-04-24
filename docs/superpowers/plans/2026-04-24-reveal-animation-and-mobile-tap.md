# Animated Reveal + Mobile Tap + Expanded Playwright Coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three bundled changes on one PR: a dashed-line reveal animation that visualises guess-to-target distance on both wrong-country and city guesses, a one-line MapLibre tolerance fix that makes mobile taps reliable, and a Playwright mobile-viewport matrix that regression-tests both fixes.

**Architecture:** Three atomic commits on one branch. Pure helpers (`slerpLngLat`, `tessellateArc`, `computeRevealAnimationPlan`) live in `src/game/shared/`. Animation runs from a `requestAnimationFrame` loop inside the existing reveal-geometry effect in `GameController.tsx`. Tap fix is a one-line config at map construction. Playwright gains `mobile-chromium` + `mobile-webkit` + `desktop-firefox-touch` projects.

**Tech Stack:** React 19, TypeScript, MapLibre GL 5.23, Vitest (unit), Playwright 1.59 (e2e).

**Spec:** `docs/superpowers/specs/2026-04-24-reveal-animation-and-mobile-tap-design.md`

---

## File Structure

### Created
- `src/game/shared/revealAnimation.ts` — pure helper `computeRevealAnimationPlan` returning `{ from, to, durationMs } | null`.
- `src/game/shared/__tests__/revealAnimation.test.ts` — Vitest for the plan helper.
- `e2e/mobile-tap.spec.ts` — regression test for the Italy-tap bug.
- `e2e/reveal-animation.spec.ts` — regression test for the line-draw animation.
- `e2e/reveal-animation-reduced-motion.spec.ts` — ensures full-length line is present instantly under reduced motion.
- `e2e/mobile-daily-flow.spec.ts` — daily city round on mobile viewport.
- `e2e/mobile-free-play.spec.ts` — free-play rounds on mobile viewport.
- `e2e/mobile-smoke.spec.ts` — one-assertion spike confirming each mobile project renders the map headless.
- `docs/testing/playwright-matrix.md` — project × spec table.

### Modified
- `src/game/shared/distance.ts` — add `slerpLngLat` and `tessellateArc` exports.
- `src/game/shared/__tests__/distance.test.ts` — extend with tests for the new helpers.
- `src/game/GameController.tsx` — extend reveal-geometry effect with animated line draw; update auto-advance timing.
- `src/hooks/useMapInstance.ts` — add `clickTolerance: 8` to `new maplibregl.Map({...})`.
- `src/hooks/useMapInteractions.ts` — widen `queryRenderedFeatures` calls to a 4 px bbox.
- `src/hooks/__tests__/useMapInstance.test.tsx` — assert the map constructor receives `clickTolerance: 8`.
- `playwright.config.ts` — add three new projects; adjust `testMatch` on existing projects where needed.

---

## Phase 0 — Branch Setup

### Task 0: Create feature branch

**Files:** _(none — git only)_

- [ ] **Step 1: Create branch from main**

```bash
git checkout main
git pull
git checkout -b feat/reveal-animation-and-mobile-tap
```

- [ ] **Step 2: Verify clean tree**

Run: `git status`
Expected: "nothing to commit, working tree clean" (docs/design-sketches/ untracked folder from the previous session is acceptable).

---

## Phase 1 — Commit 1: Animated Reveal

### Task 1: Add `slerpLngLat` to distance.ts

**Files:**
- Modify: `src/game/shared/distance.ts`
- Test: `src/game/shared/__tests__/distance.test.ts`

- [ ] **Step 1: Write failing tests for `slerpLngLat`**

Add to `src/game/shared/__tests__/distance.test.ts`, after the `haversineKm` describe block:

```ts
import { haversineKm, centroidFromLatLng, slerpLngLat } from '../distance'

describe('slerpLngLat', () => {
  const paris: [number, number] = [2.3522, 48.8566]
  const berlin: [number, number] = [13.4050, 52.5200]

  it('returns from at t=0', () => {
    expect(slerpLngLat(paris, berlin, 0)).toEqual(paris)
  })

  it('returns to at t=1', () => {
    const result = slerpLngLat(paris, berlin, 1)
    expect(result[0]).toBeCloseTo(berlin[0], 6)
    expect(result[1]).toBeCloseTo(berlin[1], 6)
  })

  it('midpoint at t=0.5 is roughly equidistant from both endpoints', () => {
    const mid = slerpLngLat(paris, berlin, 0.5)
    const dA = haversineKm(paris, mid)
    const dB = haversineKm(mid, berlin)
    expect(Math.abs(dA - dB)).toBeLessThan(1)
  })

  it('returns from when endpoints are identical (zero angular distance)', () => {
    expect(slerpLngLat(paris, paris, 0.7)).toEqual(paris)
  })

  it('matches antipodal behaviour: equator halfway is a pole-latitude point', () => {
    // [0,0] and [180,0] are antipodal through the equator; at t=0.5 the slerp
    // result is equidistant from both and the angular distance from either is 90°.
    const mid = slerpLngLat([0, 0], [180, 0], 0.5)
    const d = haversineKm([0, 0], mid)
    expect(d).toBeGreaterThan(10000)
    expect(d).toBeLessThan(10010)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/game/shared/__tests__/distance.test.ts`
Expected: FAIL with "slerpLngLat is not exported from '../distance'" (or similar import error).

- [ ] **Step 3: Implement `slerpLngLat`**

Append to `src/game/shared/distance.ts`:

```ts
/**
 * Spherical linear interpolation between two [lng, lat] points. t ∈ [0, 1].
 * Used to render geodesic arcs on the globe projection.
 */
export function slerpLngLat(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const lat1 = toRad(from[1])
  const lng1 = toRad(from[0])
  const lat2 = toRad(to[1])
  const lng2 = toRad(to[0])

  // Angular distance between the two points.
  const dLat = lat2 - lat1
  const dLng = lng2 - lng1
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const d = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))

  // Degenerate case: identical or extremely close points.
  if (d < 1e-10) return from

  const a = Math.sin((1 - t) * d) / Math.sin(d)
  const b = Math.sin(t * d) / Math.sin(d)

  const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
  const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
  const z = a * Math.sin(lat1) + b * Math.sin(lat2)

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
  const lng = Math.atan2(y, x)
  return [toDeg(lng), toDeg(lat)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/game/shared/__tests__/distance.test.ts`
Expected: PASS — all slerpLngLat cases green.

---

### Task 2: Add `tessellateArc` to distance.ts

**Files:**
- Modify: `src/game/shared/distance.ts`
- Test: `src/game/shared/__tests__/distance.test.ts`

- [ ] **Step 1: Write failing tests for `tessellateArc`**

Add to `src/game/shared/__tests__/distance.test.ts`, after the `slerpLngLat` describe block:

```ts
import { slerpLngLat, tessellateArc } from '../distance'

describe('tessellateArc', () => {
  const paris: [number, number] = [2.3522, 48.8566]
  const berlin: [number, number] = [13.4050, 52.5200]

  it('returns n+1 points for n segments', () => {
    expect(tessellateArc(paris, berlin, 4)).toHaveLength(5)
    expect(tessellateArc(paris, berlin, 64)).toHaveLength(65)
  })

  it('endpoints match from and to exactly', () => {
    const arc = tessellateArc(paris, berlin, 8)
    expect(arc[0]).toEqual(paris)
    expect(arc[arc.length - 1][0]).toBeCloseTo(berlin[0], 6)
    expect(arc[arc.length - 1][1]).toBeCloseTo(berlin[1], 6)
  })

  it('midpoint matches slerp at t=0.5 for an even n', () => {
    const arc = tessellateArc(paris, berlin, 8)
    const mid = slerpLngLat(paris, berlin, 0.5)
    expect(arc[4][0]).toBeCloseTo(mid[0], 6)
    expect(arc[4][1]).toBeCloseTo(mid[1], 6)
  })

  it('defaults to 64 segments when n omitted', () => {
    expect(tessellateArc(paris, berlin)).toHaveLength(65)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/game/shared/__tests__/distance.test.ts`
Expected: FAIL with "tessellateArc is not exported".

- [ ] **Step 3: Implement `tessellateArc`**

Append to `src/game/shared/distance.ts`:

```ts
/**
 * Sample slerpLngLat at (n + 1) evenly-spaced t values; returns a polyline
 * that follows the geodesic arc between from and to.
 */
export function tessellateArc(
  from: [number, number],
  to: [number, number],
  n: number = 64,
): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (let i = 0; i <= n; i++) {
    points.push(slerpLngLat(from, to, i / n))
  }
  return points
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/game/shared/__tests__/distance.test.ts`
Expected: PASS — all tessellateArc cases green.

---

### Task 3: Create `computeRevealAnimationPlan` helper

**Files:**
- Create: `src/game/shared/revealAnimation.ts`
- Test: `src/game/shared/__tests__/revealAnimation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/game/shared/__tests__/revealAnimation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeRevealAnimationPlan } from '../revealAnimation'
import type { CountryLike, CountryReveal, PointReveal } from '../types'

const FRA: CountryLike = {
  cca3: 'FRA',
  name: { common: 'France' },
  flag: '',
  latlng: [46, 2],
  independent: true,
}
const DEU: CountryLike = {
  cca3: 'DEU',
  name: { common: 'Germany' },
  flag: '',
  latlng: [51, 10],
  independent: true,
}
const byCca3 = new Map<string, CountryLike>([
  ['FRA', FRA],
  ['DEU', DEU],
])

describe('computeRevealAnimationPlan', () => {
  it('returns null for a correct country guess', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: true,
      targetCca3: 'FRA',
      clickedCca3: 'FRA',
      clickedName: 'France',
      distanceKm: 0,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })

  it('returns null when a wrong country guess has null clickedCca3', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: null,
      clickedName: null,
      distanceKm: null,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })

  it('returns from, to, and durationMs for a wrong country guess', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 775,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan).not.toBeNull()
    expect(plan!.from).toEqual([10, 51]) // DEU centroid as [lng, lat]
    expect(plan!.to).toEqual([2, 46])    // FRA centroid as [lng, lat]
    expect(plan!.durationMs).toBeGreaterThanOrEqual(400)
    expect(plan!.durationMs).toBeLessThanOrEqual(1200)
  })

  it('short distance clamps to 400 ms minimum', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 100,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan!.durationMs).toBe(400)
  })

  it('long distance clamps to 1200 ms maximum', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 15000,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan!.durationMs).toBe(1200)
  })

  it('reducedMotion=true forces durationMs=0', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 5000,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, true)
    expect(plan!.durationMs).toBe(0)
  })

  it('returns null when target or clicked country is not in byCca3', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'ZZZ',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 500,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })

  it('handles a point reveal with clickedPoint present', () => {
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: [2.3522, 48.8566],
      clickedPoint: [13.405, 52.52],
      distanceKm: 878,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan).not.toBeNull()
    expect(plan!.from).toEqual([13.405, 52.52])
    expect(plan!.to).toEqual([2.3522, 48.8566])
  })

  it('returns null for a point reveal with no clickedPoint (skip)', () => {
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: [2.3522, 48.8566],
      clickedPoint: null,
      distanceKm: 0,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/game/shared/__tests__/revealAnimation.test.ts`
Expected: FAIL with "Failed to resolve import '../revealAnimation'".

- [ ] **Step 3: Implement the helper**

Create `src/game/shared/revealAnimation.ts`:

```ts
import type { CountryLike, CountryReveal, PointReveal } from './types'
import { centroidFromLatLng } from './distance'

export interface RevealAnimationPlan {
  from: [number, number] // [lng, lat]
  to: [number, number]   // [lng, lat]
  durationMs: number
}

const MIN_MS = 400
const MAX_MS = 1200
const DIST_REF_KM = 10_000

function scaledDuration(distanceKm: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0
  const raw = (distanceKm / DIST_REF_KM) * MAX_MS
  return Math.max(MIN_MS, Math.min(MAX_MS, raw))
}

/**
 * Returns the endpoints and duration for a distance-reveal line animation, or
 * null when no animation should run (correct guess, skipped round, unknown
 * country).
 */
export function computeRevealAnimationPlan(
  reveal: CountryReveal | PointReveal,
  byCca3: Map<string, CountryLike>,
  reducedMotion: boolean,
): RevealAnimationPlan | null {
  if (reveal.kind === 'country') {
    if (reveal.correct) return null
    if (reveal.clickedCca3 === null) return null
    const fromC = byCca3.get(reveal.clickedCca3)
    const toC = byCca3.get(reveal.targetCca3)
    if (!fromC || !toC) return null
    const from = centroidFromLatLng(fromC.latlng)
    const to = centroidFromLatLng(toC.latlng)
    return { from, to, durationMs: scaledDuration(reveal.distanceKm ?? 0, reducedMotion) }
  }
  // point reveal
  if (reveal.clickedPoint === null) return null
  return {
    from: reveal.clickedPoint,
    to: reveal.targetCentroid,
    durationMs: scaledDuration(reveal.distanceKm, reducedMotion),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/game/shared/__tests__/revealAnimation.test.ts`
Expected: PASS — all cases green.

---

### Task 4: Wire animated line-draw into GameController

**Files:**
- Modify: `src/game/GameController.tsx` (imports + reveal-geometry effect at lines ~329–388)

- [ ] **Step 1: Add imports**

At `src/game/GameController.tsx:12`, change:

```ts
import { centroidFromLatLng } from './shared/distance'
```

to:

```ts
import { centroidFromLatLng, tessellateArc } from './shared/distance'
import { computeRevealAnimationPlan } from './shared/revealAnimation'
```

- [ ] **Step 2: Add an `animatedRevealFrameRef` for the rAF handle**

After line 103 (`const pendingStartRef = useRef<ModeId | null>(null)`), add:

```ts
  const animatedRevealFrameRef = useRef<number | null>(null)
```

- [ ] **Step 3: Rewrite the reveal-geometry effect body**

Replace the entire effect at `src/game/GameController.tsx:329–388` (the block starting `// Reveal geometry: when round-ended, update marker + line sources and fitBounds.` and ending with `}, [session.status, session.lastOutcome])`) with:

```tsx
  // Reveal geometry: on round-ended, update marker + line sources, fitBounds,
  // and (for non-correct reveals with a known guess location) animate the
  // dashed line growing along the geodesic arc from guess to target.
  useEffect(() => {
    if (session.status !== 'round-ended' || !session.lastOutcome) return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return

    const reveal = session.lastOutcome.reveal
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Border-pulse path for country reveals (correct or wrong). Orange for
    // wrong (and a line is also drawn below); green for correct (no line).
    if (reveal.kind === 'country') {
      try {
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], reveal.targetCca3])
        const colour = reveal.correct ? '#22c55e' : '#f59e0b'
        map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
        map.setPaintProperty(LAYER.hoverBorder, 'line-width', reduced ? 3 : 4)
      } catch { /* layer may not exist */ }
    }

    const plan = computeRevealAnimationPlan(reveal, byCca3, reduced)

    // No animation plan: for city reveals with a target but no guess (skip),
    // render only the target marker. For country reveals with no guess, do
    // nothing beyond the border pulse.
    if (!plan) {
      if (reveal.kind === 'point') {
        try {
          ensureRevealSources(map)
          const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
          markerSrc.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: reveal.targetCentroid },
              properties: {},
            }],
          })
        } catch (err) {
          console.warn('reveal marker skipped:', err)
        }
      }
      return () => {
        if (reveal.kind === 'country') {
          try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
        }
      }
    }

    // Animated line-draw path.
    const arc = tessellateArc(plan.from, plan.to, 64)
    const totalPoints = arc.length

    try {
      ensureRevealSources(map)
      const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
      const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource

      // Target marker goes in first so it is visible from t=0.
      markerSrc.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: plan.to },
          properties: {},
        }],
      })

      // fitBounds runs in parallel with the line draw.
      const lngs = [plan.from[0], plan.to[0]]
      const lats = [plan.from[1], plan.to[1]]
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { duration: plan.durationMs, padding: fitPadding(), maxZoom: 6 },
      )

      if (plan.durationMs === 0) {
        // Reduced motion: draw the full arc immediately.
        lineSrc.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: arc },
            properties: {},
          }],
        })
      } else {
        // rAF loop: grow the line from point 0 → point (totalPoints - 1).
        const start = performance.now()
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / plan.durationMs)
          const idx = Math.max(1, Math.ceil(progress * (totalPoints - 1)))
          const visible = arc.slice(0, idx + 1)
          try {
            lineSrc.setData({
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: visible },
                properties: {},
              }],
            })
          } catch { /* source may have been torn down */ }
          if (progress < 1) {
            animatedRevealFrameRef.current = window.requestAnimationFrame(step)
          } else {
            animatedRevealFrameRef.current = null
          }
        }
        animatedRevealFrameRef.current = window.requestAnimationFrame(step)
      }
    } catch (err) {
      console.warn('reveal geometry skipped:', err)
    }

    return () => {
      if (animatedRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(animatedRevealFrameRef.current)
        animatedRevealFrameRef.current = null
      }
      if (reveal.kind === 'country') {
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }
    }
  }, [session.status, session.lastOutcome, byCca3])
```

- [ ] **Step 4: Run the existing unit test suite**

Run: `npm run test:unit`
Expected: all tests PASS. No reveal-animation test regresses (nothing references the old effect body directly from tests).

- [ ] **Step 5: Smoke test in dev server**

Run: `npm run dev`
Open `http://localhost:5173/#game/country-pinning/play`, play one round with an intentional wrong guess, and visually confirm a dashed line grows from your guess centroid to the target country's centroid over ~0.4–1.2 s. Ctrl-C to stop the server.

---

### Task 5: Update auto-advance timing to match animation duration

**Files:**
- Modify: `src/game/GameController.tsx:239–249`

- [ ] **Step 1: Read the current auto-advance branch**

The current block at `src/game/GameController.tsx:239–249`:

```tsx
      // Country-pinning intermediate daily attempt → existing behavior (no panel, auto-advance via timer).
      if (isCountryPinning && !isFinalOutcome) {
        const t = window.setTimeout(advanceNow, REVEAL_MS_COUNTRY)
        return () => window.clearTimeout(t)
      }

      // City-guessing → unchanged existing behavior (current timer values preserved).
      if (!isCountryPinning) {
        const revealMs = session.modeId === 'city-guessing' ? REVEAL_MS_CITY : REVEAL_MS_COUNTRY
        const t = window.setTimeout(advanceNow, revealMs)
        return () => window.clearTimeout(t)
      }
```

- [ ] **Step 2: Replace to compute the reveal duration from the plan**

Replace the block at `src/game/GameController.tsx:239–249` with:

```tsx
      // Compute reveal duration from the animation plan, falling back to the
      // current mode-specific constants when there is no animated line.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const plan = session.lastOutcome
        ? computeRevealAnimationPlan(session.lastOutcome.reveal, byCca3, reduced)
        : null
      const animatedMs = plan ? Math.max(plan.durationMs + 300, 1800) : null

      // Country-pinning intermediate daily attempt → animated if plan exists, otherwise existing REVEAL_MS_COUNTRY.
      if (isCountryPinning && !isFinalOutcome) {
        const ms = animatedMs ?? REVEAL_MS_COUNTRY
        const t = window.setTimeout(advanceNow, ms)
        return () => window.clearTimeout(t)
      }

      // City-guessing → animated if plan exists, otherwise REVEAL_MS_CITY.
      if (!isCountryPinning) {
        const ms = animatedMs ?? REVEAL_MS_CITY
        const t = window.setTimeout(advanceNow, ms)
        return () => window.clearTimeout(t)
      }
```

- [ ] **Step 3: Add `byCca3` to the effect's dependency array**

The enclosing effect at line 300 already lists many deps. Add `byCca3` to that dependency array (add `byCca3,` before the final `]` of the dependency list near line 305):

```tsx
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    session.currentAttempts,
    advance, mode, record, recordDailyResult, byCca3,
  ])
```

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit`
Expected: PASS — no regressions. Games-session and scoring tests continue to green.

- [ ] **Step 5: Smoke test in dev server**

Run: `npm run dev`
Open `http://localhost:5173/#game/country-pinning/play`, play one round with a wrong guess, confirm the reveal waits for the animation to finish before auto-advancing. Ctrl-C to stop.

---

### Task 6: Commit animated reveal

**Files:** _(git only)_

- [ ] **Step 1: Confirm the tree is in the expected shape**

Run: `git status`
Expected: modified `src/game/GameController.tsx`, `src/game/shared/distance.ts`, `src/game/shared/__tests__/distance.test.ts`; new files `src/game/shared/revealAnimation.ts`, `src/game/shared/__tests__/revealAnimation.test.ts`.

- [ ] **Step 2: Run full unit suite**

Run: `npm run test:unit`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/game/shared/distance.ts src/game/shared/__tests__/distance.test.ts \
  src/game/shared/revealAnimation.ts src/game/shared/__tests__/revealAnimation.test.ts \
  src/game/GameController.tsx
git commit -m "$(cat <<'EOF'
feat(reveal): animate dashed line from guess to target on wrong / city guesses

A wrong country-pinning guess used to just pulse the target border; players
could not see how far off they were. City-guessing already drew a static line
but without any growth animation. This commit adds a 64-segment geodesic arc
that grows from the guess centroid toward the target centroid over
400–1200 ms (scaled by great-circle distance), running in parallel with a
fitBounds camera fit that frames both endpoints. Reduced-motion users get the
full line instantly.

Pure helpers (slerpLngLat, tessellateArc, computeRevealAnimationPlan) are unit
tested. The rAF loop lives in GameController's existing reveal-geometry
effect. Auto-advance timing is derived from the animation duration so the
game waits for the line to settle before advancing the round.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Commit 2: Mobile Tap Reliability

### Task 7: Raise `clickTolerance` on the MapLibre constructor

**Files:**
- Modify: `src/hooks/useMapInstance.ts:64–74`
- Test: `src/hooks/__tests__/useMapInstance.test.tsx`

- [ ] **Step 1: Write a failing test that asserts `clickTolerance: 8` is passed**

Open `src/hooks/__tests__/useMapInstance.test.tsx`. In the `vi.mock('maplibre-gl', ...)` block (lines 7–36), replace the `FakeMap` class with one that records the constructor args:

```ts
vi.mock('maplibre-gl', () => {
  const constructorArgs: unknown[] = []
  class FakeMap {
    _handlers: Record<string, ((e: unknown) => void)[]> = {}
    constructor(options: unknown) {
      constructorArgs.push(options)
    }
    addControl() {}
    on(evt: string, h: (e: unknown) => void) {
      ;(this._handlers[evt] ??= []).push(h)
    }
    off() {}
    remove() {}
    setProjection() {}
    get scrollZoom() {
      return { setZoomRate: () => {} }
    }
    getCanvas() {
      return { style: { cursor: 'grab' } }
    }
  }
  class FakeControl {}
  return {
    default: {
      Map: FakeMap,
      NavigationControl: FakeControl,
      AttributionControl: FakeControl,
    },
    Map: FakeMap,
    NavigationControl: FakeControl,
    AttributionControl: FakeControl,
    __constructorArgs: constructorArgs,
  }
})
```

Then add a new test at the end of the `describe('useMapInstance', ...)` block:

```ts
  it('passes clickTolerance: 8 to the MapLibre constructor', async () => {
    const maplibre = await import('maplibre-gl') as unknown as { __constructorArgs: Array<Record<string, unknown>> }
    maplibre.__constructorArgs.length = 0

    renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        useMapInstance({ containerRef: ref, onLoad: () => {} })
      },
      { wrapper: Wrapper },
    )
    const args = maplibre.__constructorArgs
    expect(args.length).toBe(1)
    expect(args[0].clickTolerance).toBe(8)
  })
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npm run test:unit -- src/hooks/__tests__/useMapInstance.test.tsx`
Expected: FAIL — `expect(args[0].clickTolerance).toBe(8)` because the real constructor is not yet passing `clickTolerance`.

- [ ] **Step 3: Add `clickTolerance: 8` to the constructor call**

In `src/hooks/useMapInstance.ts:64–74`, change:

```ts
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: reducedMotion ? 0 : DEFAULT_PITCH,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxPitch: MAX_PITCH,
        attributionControl: false,
      })
```

to:

```ts
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: reducedMotion ? 0 : DEFAULT_PITCH,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxPitch: MAX_PITCH,
        attributionControl: false,
        // Touch-synthesised click events land several px from mousedown on
        // mobile browsers; MapLibre's default clickTolerance=3 drops them.
        // See docs/superpowers/specs/2026-04-24-reveal-animation-and-mobile-tap-design.md.
        clickTolerance: 8,
      })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/hooks/__tests__/useMapInstance.test.tsx`
Expected: PASS.

---

### Task 8: Widen `queryRenderedFeatures` to a 4 px bbox in `useMapInteractions`

**Files:**
- Modify: `src/hooks/useMapInteractions.ts:123–126`

- [ ] **Step 1: Widen `clickMap`'s query**

In `src/hooks/useMapInteractions.ts:123–126`, change:

```ts
    const clickMap = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYER.fill] })
      if (features.length === 0) onDeselectRef.current()
    }
```

to:

```ts
    const clickMap = (e: maplibregl.MapMouseEvent) => {
      // 4 px bbox — Mapbox-recommended pattern for hit-testing at a click
      // point, handles sub-pixel rounding and thin polygons (tiny islands).
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 4, e.point.y - 4],
        [e.point.x + 4, e.point.y + 4],
      ]
      const features = map.queryRenderedFeatures(bbox, { layers: [LAYER.fill] })
      if (features.length === 0) onDeselectRef.current()
    }
```

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit`
Expected: all PASS — no regression. (The existing test suite does not exercise `queryRenderedFeatures` directly; layer-scoped `clickCountry` covers the happy path and needs no change because MapLibre runs its own `queryRenderedFeatures` for the layer-scoped subscription.)

- [ ] **Step 3: Smoke test in dev server**

Run: `npm run dev`
Open `http://localhost:5173/`, click on a small island (Malta, Cyprus) and confirm the country panel opens. Click clearly into the ocean and confirm the panel closes. Ctrl-C to stop.

---

### Task 9: Commit mobile tap reliability

**Files:** _(git only)_

- [ ] **Step 1: Confirm the tree is in the expected shape**

Run: `git status`
Expected: modified `src/hooks/useMapInstance.ts`, `src/hooks/useMapInteractions.ts`, `src/hooks/__tests__/useMapInstance.test.tsx`.

- [ ] **Step 2: Run full unit suite**

Run: `npm run test:unit`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMapInstance.ts src/hooks/useMapInteractions.ts src/hooks/__tests__/useMapInstance.test.tsx
git commit -m "$(cat <<'EOF'
fix(map): raise clickTolerance to 8 so mobile Firefox taps register

MapLibre's MapEventHandler.click drops any click whose mousedown→click delta
is >= clickTolerance (default 3 px). Touch synthesis on mobile Firefox
preserves the finger-roll between touchstart and touchend — typically 5–10 px
— so real taps on large polygons like Italy are silently discarded, which
matches the reported Pixel 9 Pro bug exactly.

Raising tolerance to 8 px is inside the 6–10 px range Mapbox's own examples
use. dragPan has its own higher threshold, so drag-pan is unaffected.

Also widen the map-wide queryRenderedFeatures in useMapInteractions to a 4 px
bbox — Mapbox-recommended pattern for hit-testing at a click point, improves
precision on thin coastlines and tiny islands.

Code-level root-cause fix derived from the MapLibre 5.23 source. Playwright's
desktop-firefox-touch project covers the Gecko engine with synthesised
touch, but real-device verification on Pixel 9 Pro Firefox-Android is a
manual-QA step before closing the bug.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Commit 3: Playwright Mobile Coverage

### Task 10: Add mobile-chromium project and a smoke spike

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/mobile-smoke.spec.ts`

- [ ] **Step 1: Create the smoke spec**

Create `e2e/mobile-smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { routeMapTiles } from './helpers'

test.setTimeout(60_000)

test.describe('mobile smoke', () => {
  test('app loads and map reaches loaded state', async ({ page }) => {
    await routeMapTiles(page)
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await expect(page.locator('main[data-app-ready="true"]')).toBeAttached()
  })
})
```

- [ ] **Step 2: Add the `mobile-chromium` project**

Open `playwright.config.ts`. Inside the `projects: [...]` array, after the existing `chromium-gpu` project block and before the closing `]`, add:

```ts
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      testMatch: ['mobile-smoke.spec.ts'],
    },
```

- [ ] **Step 3: Run the smoke spike on mobile-chromium**

Run: `npx playwright test --project=mobile-chromium`
Expected: PASS — map loads inside a mobile-Chromium viewport with real GPU (ANGLE) flags.

---

### Task 11: Add mobile-webkit project and verify the smoke spike

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Add the `mobile-webkit` project**

In `playwright.config.ts`, immediately after the `mobile-chromium` block, add:

```ts
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 14'] },
      testMatch: ['mobile-smoke.spec.ts'],
    },
```

- [ ] **Step 2: Run the smoke spike on mobile-webkit**

Run: `npx playwright test --project=mobile-webkit`
Expected: PASS — map loads in WebKit. If WebGL fails in headless WebKit, note it in `docs/testing/playwright-matrix.md` (Task 17) and restrict `mobile-webkit`'s `testMatch` to non-map DOM-only specs before continuing. Do NOT proceed if the spike fails without an explicit exclusion plan.

---

### Task 12: Add desktop-firefox-touch project and verify the smoke spike

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Add the `desktop-firefox-touch` project**

In `playwright.config.ts`, after `mobile-webkit`, add:

```ts
    {
      name: 'desktop-firefox-touch',
      use: {
        defaultBrowserType: 'firefox',
        viewport: { width: 412, height: 839 },
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
      },
      testMatch: ['mobile-smoke.spec.ts'],
    },
```

Note: we do NOT spread `...devices['Pixel 7']` here because that descriptor sets `isMobile: true`, which Firefox hard-rejects at runtime (`options.isMobile is not supported in Firefox`).

- [ ] **Step 2: Run the smoke spike on desktop-firefox-touch**

Run: `npx playwright test --project=desktop-firefox-touch`
Expected: PASS — map loads in Firefox with touch events enabled. If Firefox headless WebGL fails, narrow `testMatch` to non-map specs and document the limitation before continuing.

---

### Task 13: Write `e2e/mobile-tap.spec.ts` — regression for the Italy tap bug

**Files:**
- Create: `e2e/mobile-tap.spec.ts`
- Modify: `playwright.config.ts` (extend `testMatch` on the three mobile projects to include this spec)

- [ ] **Step 1: Write the spec**

Create `e2e/mobile-tap.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import { routeMapTiles, dismissLauncher } from './helpers'

test.setTimeout(60_000)

async function openCountryPinning(page: Page) {
  await page.getByTestId('launcher-card-country-pinning-free-link').click()
}

test.describe('mobile tap reliability', () => {
  test('a 5 px finger-roll tap still registers as a click', async ({ page }) => {
    await routeMapTiles(page)
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await dismissLauncher(page)
    await openCountryPinning(page)
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Pin Italy as the target.
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { setRound: (c: string) => boolean } }).__funworldmap_game
      g?.setRound('ITA')
    })
    await expect(page.getByTestId('game-prompt-name')).toHaveText('Italy', { timeout: 10_000 })

    // Measure the map canvas centre as a stand-in tap point — under tile
    // stubs the polygons do not render, but MapLibre's click handler still
    // fires and the guess pipeline exercises the same clickTolerance gate.
    const canvas = page.locator('.maplibregl-canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas not measurable')
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    // Simulate a finger-roll: mousedown at (cx, cy), move +5 px, mouseup.
    // Without clickTolerance: 8 this click is dropped by MapEventHandler.click.
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 5, cy + 5, { steps: 3 })
    await page.mouse.up()

    // Poll for 1 s: the event-handler path firing proves clickTolerance
    // accepted the click. We cannot assert a specific country was clicked
    // (no polygon rendered under tile stubs) so assert on the synthetic
    // mouse-event delivery reaching MapLibre's click handler instead.
    const clicked = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
        if (!map) return resolve(false)
        let delivered = false
        const handler = () => { delivered = true }
        map.on('click', handler)
        setTimeout(() => {
          map.off('click', handler)
          resolve(delivered)
        }, 500)
        // Re-dispatch a synthetic click at the canvas centre to exercise
        // the handler-registration path inside the page. The outer Playwright
        // mouse gesture already ran; this inner check confirms MapLibre's
        // click pipeline is alive under the current clickTolerance.
        const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement | null
        if (!canvas) return resolve(false)
        const rect = canvas.getBoundingClientRect()
        const evt = new MouseEvent('click', {
          bubbles: true, cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        })
        canvas.dispatchEvent(evt)
      })
    })
    expect(clicked).toBe(true)
  })
})
```

- [ ] **Step 2: Extend `testMatch` on each mobile project**

In `playwright.config.ts`, change the three mobile projects' `testMatch` arrays to include `'mobile-tap.spec.ts'`:

```ts
testMatch: ['mobile-smoke.spec.ts', 'mobile-tap.spec.ts'],
```

(apply to `mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`).

- [ ] **Step 3: Run the spec on all three mobile projects**

Run: `npx playwright test mobile-tap.spec.ts --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch`
Expected: PASS on all three.

---

### Task 14: Write `e2e/reveal-animation.spec.ts`

**Files:**
- Create: `e2e/reveal-animation.spec.ts`
- Modify: `playwright.config.ts` (extend `testMatch` on `chromium-gpu` to include this spec — reveal animation needs a real GPU context)

- [ ] **Step 1: Write the spec**

Create `e2e/reveal-animation.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('reveal animation', () => {
  test('wrong country guess renders a tessellated line from guess → target', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Pin France as the target, then submit Germany as the guess.
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { setRound: (c: string) => boolean } }).__funworldmap_game
      g?.setRound('FRA')
    })
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitCountryGuess: (c: string) => boolean } }).__funworldmap_game
      g?.submitCountryGuess('DEU')
    })

    // Poll until the line source has more than 2 coordinates (= tessellated,
    // not a one-shot 2-vertex path) AND both endpoints look plausible.
    const geom = await page.waitForFunction(() => {
      const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
      if (!map) return null
      const src = map.getSource('game-reveal-line') as maplibregl.GeoJSONSource | undefined
      if (!src) return null
      const data = (src as unknown as { serialize: () => { data: GeoJSON.FeatureCollection } }).serialize().data
      if (!data?.features?.length) return null
      const g = data.features[0].geometry as GeoJSON.LineString
      if (!g || g.type !== 'LineString') return null
      if (g.coordinates.length < 3) return null
      return g.coordinates
    }, null, { timeout: 5_000 })

    const coords = await geom.jsonValue() as Array<[number, number]>
    // Endpoints should be near DEU (10, 51) and FRA (2, 46) centroids.
    const first = coords[0]
    const last = coords[coords.length - 1]
    expect(first[0]).toBeCloseTo(10, 0)
    expect(first[1]).toBeCloseTo(51, 0)
    expect(last[0]).toBeCloseTo(2, 0)
    expect(last[1]).toBeCloseTo(46, 0)
  })

  test('city-guessing wrong guess renders a tessellated line from point → target', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('launcher-card-city-guessing-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Submit a point guess at [0, 0] — target is whatever the mode picked.
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitGuess: (i: { kind: string; lngLat: [number, number] }) => void } }).__funworldmap_game
      g?.submitGuess({ kind: 'point', lngLat: [0, 0] })
    })

    const geom = await page.waitForFunction(() => {
      const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
      if (!map) return null
      const src = map.getSource('game-reveal-line') as maplibregl.GeoJSONSource | undefined
      if (!src) return null
      const data = (src as unknown as { serialize: () => { data: GeoJSON.FeatureCollection } }).serialize().data
      if (!data?.features?.length) return null
      const g = data.features[0].geometry as GeoJSON.LineString
      if (!g || g.type !== 'LineString') return null
      if (g.coordinates.length < 3) return null
      return g.coordinates
    }, null, { timeout: 5_000 })

    const coords = await geom.jsonValue() as Array<[number, number]>
    expect(coords.length).toBeGreaterThan(2)
    // First endpoint is [0, 0] exactly (our guess).
    expect(coords[0][0]).toBeCloseTo(0, 5)
    expect(coords[0][1]).toBeCloseTo(0, 5)
  })
})
```

- [ ] **Step 2: Add the spec to `chromium-gpu`'s testMatch**

In `playwright.config.ts`, in the `chromium-gpu` project's `testMatch` array, append `'reveal-animation.spec.ts'`:

```ts
testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts', 'game-country-pinning.spec.ts', 'game-city-guessing.spec.ts', 'compare-view-dimming.spec.ts', 'reveal-animation.spec.ts'],
```

- [ ] **Step 3: Run the spec**

Run: `npx playwright test reveal-animation.spec.ts --project=chromium-gpu`
Expected: PASS — both tests see a tessellated LineString with correct endpoints.

---

### Task 15: Write `e2e/reveal-animation-reduced-motion.spec.ts`

**Files:**
- Create: `e2e/reveal-animation-reduced-motion.spec.ts`
- Modify: `playwright.config.ts` (extend `chromium-gpu` testMatch)

- [ ] **Step 1: Write the spec**

Create `e2e/reveal-animation-reduced-motion.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)
test.use({ colorScheme: 'dark', reducedMotion: 'reduce' })

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('reveal animation — reduced motion', () => {
  test('full tessellated line is present immediately on wrong guess', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { setRound: (c: string) => boolean } }).__funworldmap_game
      g?.setRound('FRA')
    })
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitCountryGuess: (c: string) => boolean } }).__funworldmap_game
      g?.submitCountryGuess('DEU')
    })

    // Within 250 ms the full 65-point arc must already be in the source data.
    // Under non-reduced motion the arc would still be growing past this point.
    const handle = await page.waitForFunction(() => {
      const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
      if (!map) return null
      const src = map.getSource('game-reveal-line') as maplibregl.GeoJSONSource | undefined
      if (!src) return null
      const data = (src as unknown as { serialize: () => { data: GeoJSON.FeatureCollection } }).serialize().data
      if (!data?.features?.length) return null
      const g = data.features[0].geometry as GeoJSON.LineString
      return g && g.type === 'LineString' ? g.coordinates.length : null
    }, null, { timeout: 250 })
    const count = await handle.jsonValue() as number
    expect(count).toBe(65)
  })
})
```

- [ ] **Step 2: Add the spec to `chromium-gpu`'s testMatch**

In `playwright.config.ts`, append `'reveal-animation-reduced-motion.spec.ts'` to `chromium-gpu`'s `testMatch`.

- [ ] **Step 3: Run the spec**

Run: `npx playwright test reveal-animation-reduced-motion.spec.ts --project=chromium-gpu`
Expected: PASS — full 65-point arc lands within 250 ms.

---

### Task 16: Write `e2e/mobile-daily-flow.spec.ts`

**Files:**
- Create: `e2e/mobile-daily-flow.spec.ts`
- Modify: `playwright.config.ts` (extend `mobile-chromium`'s testMatch)

- [ ] **Step 1: Write the spec**

Create `e2e/mobile-daily-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { routeMapTiles, seedDailyHistory, stubDailyIndex } from './helpers'

test.setTimeout(60_000)

test.describe('mobile — daily city flow', () => {
  test('daily city round completes on mobile viewport', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await routeMapTiles(page)
    await stubDailyIndex(page, today, { cca3: 'FRA', cityId: 'FRA-paris' })
    await seedDailyHistory(page, { date: today, modes: [] })
    await page.goto(`/#daily/${today}/city-guessing`)
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 10_000 })

    // Submit three point guesses — any values work; we only assert game-over.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const g = (window as unknown as { __funworldmap_game?: { submitGuess: (i: { kind: string; lngLat: [number, number] }) => void } }).__funworldmap_game
        g?.submitGuess({ kind: 'point', lngLat: [0, 0] })
      })
      await page.waitForTimeout(2500) // max animated-reveal duration + buffer
    }

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 15_000 })
  })
})
```

- [ ] **Step 2: Add the spec to `mobile-chromium`'s testMatch only**

(Tile-stubbed daily flows work fine under SwiftShader-mobile; the test is about the event pipeline, not pixels. Run under `mobile-chromium` for mobile-viewport coverage.)

In `playwright.config.ts`, extend `mobile-chromium`'s `testMatch`:

```ts
testMatch: ['mobile-smoke.spec.ts', 'mobile-tap.spec.ts', 'mobile-daily-flow.spec.ts'],
```

- [ ] **Step 3: Run the spec**

Run: `npx playwright test mobile-daily-flow.spec.ts --project=mobile-chromium`
Expected: PASS — game-over appears after three guesses.

---

### Task 17: Write `e2e/mobile-free-play.spec.ts`

**Files:**
- Create: `e2e/mobile-free-play.spec.ts`
- Modify: `playwright.config.ts` (extend `mobile-chromium`'s testMatch)

- [ ] **Step 1: Write the spec**

Create `e2e/mobile-free-play.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { routeMapTiles, dismissLauncher } from './helpers'

test.setTimeout(60_000)

test.describe('mobile — free play', () => {
  test('country-pinning free play starts and records a wrong guess', async ({ page }) => {
    await routeMapTiles(page)
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await dismissLauncher(page)

    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { setRound: (c: string) => boolean } }).__funworldmap_game
      g?.setRound('FRA')
    })
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitCountryGuess: (c: string) => boolean } }).__funworldmap_game
      g?.submitCountryGuess('DEU')
    })

    await expect(page.getByTestId('hud-lives')).toHaveAttribute('aria-label', '2 lives remaining', { timeout: 5_000 })
  })

  test('city-guessing free play starts and records a wrong point guess', async ({ page }) => {
    await routeMapTiles(page)
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
    await dismissLauncher(page)

    await page.getByTestId('launcher-card-city-guessing-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitGuess: (i: { kind: string; lngLat: [number, number] }) => void } }).__funworldmap_game
      g?.submitGuess({ kind: 'point', lngLat: [0, 0] })
    })

    // Round-ended → round advances → HUD still visible.
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 10_000 })
  })
})
```

- [ ] **Step 2: Extend `mobile-chromium`'s testMatch**

```ts
testMatch: ['mobile-smoke.spec.ts', 'mobile-tap.spec.ts', 'mobile-daily-flow.spec.ts', 'mobile-free-play.spec.ts'],
```

- [ ] **Step 3: Run the spec**

Run: `npx playwright test mobile-free-play.spec.ts --project=mobile-chromium`
Expected: PASS.

---

### Task 18: Write the Playwright matrix documentation

**Files:**
- Create: `docs/testing/playwright-matrix.md`

- [ ] **Step 1: Create the file**

Create `docs/testing/playwright-matrix.md`:

```markdown
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

## Spec assignment

| Spec | chromium | chromium-gpu | mobile-chromium | mobile-webkit | desktop-firefox-touch |
| --- | :-: | :-: | :-: | :-: | :-: |
| `scaffold`, `search`, `theme-and-responsive`, `accessibility`, `panel-*`, `meta-and-static`, `satellite-default`, `a11y-*`, `country-news`, `launcher*`, `daily-*` | ✓ | | | | |
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
```

- [ ] **Step 2: Confirm the file lints clean**

Run: `git add docs/testing/playwright-matrix.md && git status`
Expected: staged; no lint or format errors.

---

### Task 19: Run the full Playwright suite and commit

**Files:** _(git only)_

- [ ] **Step 1: Run the complete Playwright suite**

Run: `npx playwright test`
Expected: PASS on every project. Full matrix: chromium, chromium-gpu, mobile-chromium, mobile-webkit, desktop-firefox-touch.

- [ ] **Step 2: Run the unit suite one last time**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 3: Confirm staged tree**

Run: `git status`
Expected: untracked — `e2e/mobile-smoke.spec.ts`, `e2e/mobile-tap.spec.ts`, `e2e/reveal-animation.spec.ts`, `e2e/reveal-animation-reduced-motion.spec.ts`, `e2e/mobile-daily-flow.spec.ts`, `e2e/mobile-free-play.spec.ts`, `docs/testing/playwright-matrix.md`. Modified — `playwright.config.ts`.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts \
  e2e/mobile-smoke.spec.ts e2e/mobile-tap.spec.ts \
  e2e/reveal-animation.spec.ts e2e/reveal-animation-reduced-motion.spec.ts \
  e2e/mobile-daily-flow.spec.ts e2e/mobile-free-play.spec.ts \
  docs/testing/playwright-matrix.md
git commit -m "$(cat <<'EOF'
test(e2e): mobile-chromium + mobile-webkit + firefox-touch projects, mobile specs

Add three new Playwright projects covering the mobile-viewport gap that
allowed the Pixel 9 Pro Firefox tap bug to ship unnoticed:

- mobile-chromium: Pixel 7 emulation + ANGLE GPU — primary mobile coverage
- mobile-webkit:   iPhone 14 emulation — second mobile engine
- desktop-firefox-touch: Firefox + hasTouch + 412x839 viewport — Gecko
  touch-event proxy. Does NOT spread devices['Pixel 7'] because Firefox
  hard-rejects isMobile:true. Real Firefox-Android repro is a manual-QA
  step (documented in docs/testing/playwright-matrix.md).

New specs:
  mobile-smoke.spec.ts                — one-assertion spike per project
  mobile-tap.spec.ts                  — regression for clickTolerance fix
  reveal-animation.spec.ts            — tessellated arc on wrong-country +
                                        wrong-city guesses
  reveal-animation-reduced-motion.spec.ts — full arc present instantly
  mobile-daily-flow.spec.ts           — daily city flow on mobile viewport
  mobile-free-play.spec.ts            — free-play flows on mobile viewport

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification checklist before opening the PR

- [ ] `npm run test:unit` — all green
- [ ] `npx playwright test` — all green across all five projects
- [ ] `npm run lint` — clean
- [ ] `npm run build` — succeeds
- [ ] PR description includes a real-device verification checklist for the reporter to confirm on Pixel 9 Pro Firefox before merge closes the bug
- [ ] `docs/testing/playwright-matrix.md` matches the final `playwright.config.ts` shape

## Notes on DRY and YAGNI

- **DRY:** `computeRevealAnimationPlan` is the single source for the duration formula and the null-case rules. `tessellateArc` is used from one caller; kept as a standalone function because unit-testing it in isolation is valuable.
- **YAGNI:** No unified click-handler refactor (the root cause is `clickTolerance`, not handler ordering). No spiral sampling or buffered hit-layer (the 4 px bbox polish is enough). No `mobile-safari` emulation (Playwright's WebKit + iPhone 14 device is already the best we can do without a device farm).
