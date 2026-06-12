> **Tombstone (2026-06-12):** the daily-puzzle/retention feature this plan built was removed in PR #97 (2026-05-30, "Remove the daily puzzle"). Kept unmodified for history — do not implement from it.

# Daily-city per-click feedback + reveal-overlay swap — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make daily-city attempts feel registered (per-click distance + points text, persistent click marker) and end on `DailyRevealOverlay` instead of `GameOverOverlay`.

**Architecture:** Three independent, revertable commits. (1) Loosen the city HUD revealLine gate + split the `useRevealMapEffects` intermediate-flash effect so the city branch persists the marker until next click or round-end. (2) Branch `GameController`'s game-over render so daily-city → `DailyRevealOverlay`, everything else → `GameOverOverlay`. (3) Update the daily-puzzle system doc.

**Tech Stack:** React + TypeScript + Vitest + Playwright + MapLibre GL JS. Existing `useReducer`-driven game session unchanged.

**Spec:** [docs/superpowers/specs/2026-05-19-daily-city-feedback-design.md](../specs/2026-05-19-daily-city-feedback-design.md)

---

## File Structure

**Create:**

- `src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx` — unit tests for the loosened revealLine gate.
- `e2e/daily-city-feedback.spec.ts` — golden-path: per-click HUD text + marker persistence + reveal overlay on final attempt.

**Modify:**

- `src/game/modes/city-guessing/CityGuessingHud.tsx` — extract `revealLineFor` helper; loosen the gate to include `playing + best-of-N + ≥1 attempt`.
- `src/game/hooks/useRevealMapEffects.ts` — narrow the intermediate-flash effect to country-only; add a new city-only persistent-marker effect; reset `circle-color` in the round-end geometry effect.
- `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` — replace the "city flash hold" assertion with persistence assertions; add resume + circle-color-reset cases.
- `src/game/GameController.tsx` — import `DailyRevealOverlay`, `toLocalDateString`, `writeHash`; add `onPlayUnlimitedFree` handler; branch the game-over render. (Esc handler stays unchanged — see Task 5 Step 4 for why.)
- `e2e/mobile-daily-flow.spec.ts` — migrate the final `game-over` assertion to `daily-reveal`.
- `docs/systems/daily-puzzle.md` — under Lifecycle §6, note that daily-city game-over renders `DailyRevealOverlay`; daily-country remains `GameOverOverlay`.

**Not touched:** `useGameSession.ts` (reducer), `GameSessionProvider.tsx`, `useHashGameRouter.ts`, `useGameAnnouncements.ts`, `scoreCityGuess`, `messages.ts`, `mapPalette.ts`. Country-mode tests in `useRevealMapEffects.test.tsx` are regression guards — verify they still pass.

---

## Commit 1 — `feat(city): persist intermediate marker + surface per-click HUD text`

This commit ships Items 1 and 2 of the spec together. They share a single user-visible outcome (each click produces legible feedback) and are mutually load-bearing for the new e2e spec.

### Task 1: CityGuessingHud — extract helper + loosen revealLine gate

**Files:**

- Create: `src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx`
- Modify: `src/game/modes/city-guessing/CityGuessingHud.tsx`

**Existing factories** (`src/game/shared/__tests__/factories.ts`):

- `makeSession(overrides)` — returns a default-idle `GameSession`; override `status`, `modeId`, `attemptsPerRound`, `currentAttempts`, `lastOutcome`, `currentRound`.
- `makeCityRound(overrides)` — `targetName: 'Paris'`, `targetCountryName: 'France'`, `targetCentroid: [2.3522, 48.8566]`.
- `makePointReveal(overrides)` — `targetCentroid: [2.3522, 48.8566]`, `clickedPoint: [-74.006, 40.7128]`, `distanceKm: 5800`.

**Reference for expected copy** (`src/game/modes/city-guessing/messages.ts`):

- `revealNear(d, pts, name)` returns `${Math.round(d)} km off. +${pts} points. That was ${name}.` (used for `d < 1000`)
- `revealFar(d, pts, name)` returns `${Math.round(d)} km off. +${pts} points. ${name} was over there.` (used for `d ≥ 1000`)
- `revealCorrect(name)` returns `Spot on! You found ${name}.` (used for `d < 1`)
- `revealSkipped(name)` returns `Skipped. ${name} was there.` (used when `clickedPoint === null`)

- [ ] **Step 1: Write the failing test file**

Create `src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import CityGuessingHud from '../CityGuessingHud'
import {
  makeSession,
  makeCityRound,
  makePointReveal,
  makeOutcome,
} from '../../../shared/__tests__/factories'

afterEach(() => cleanup())

describe('CityGuessingHud — revealLine gate', () => {
  it('renders no game-reveal during playing with attemptsPerRound=1 (free city)', () => {
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 1,
      attemptsRemaining: 1,
      currentAttempts: [],
      currentRound: makeCityRound(),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.queryByTestId('game-reveal')).toBeNull()
  })

  it('renders no game-reveal during playing with attemptsPerRound>1 and no attempts yet', () => {
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 3,
      currentAttempts: [],
      currentRound: makeCityRound(),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.queryByTestId('game-reveal')).toBeNull()
  })

  it('renders game-reveal with latest attempt during playing best-of-N (near band)', () => {
    const reveal = makePointReveal({ clickedPoint: [4, 50], distanceKm: 750 })
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 2,
      currentAttempts: [
        {
          pointsEarned: 22,
          input: { kind: 'point', lngLat: [4, 50] },
          reveal,
        },
      ],
      currentRound: makeCityRound({ targetName: 'Paris' }),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    const el = screen.getByTestId('game-reveal')
    expect(el.textContent).toContain('750 km off')
    expect(el.textContent).toContain('+22 points')
    expect(el.textContent).toContain('Paris')
  })

  it('renders game-reveal with latest attempt during playing best-of-N (far band)', () => {
    const reveal = makePointReveal({ clickedPoint: [-74, 40], distanceKm: 5800 })
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 1,
      currentAttempts: [
        {
          pointsEarned: 0,
          input: { kind: 'point', lngLat: [4, 50] },
          reveal: makePointReveal({ clickedPoint: [4, 50], distanceKm: 750 }),
        },
        {
          pointsEarned: 0,
          input: { kind: 'point', lngLat: [-74, 40] },
          reveal,
        },
      ],
      currentRound: makeCityRound({ targetName: 'Paris' }),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    // Renders the LATEST attempt (the second one — far band), not the first.
    const el = screen.getByTestId('game-reveal')
    expect(el.textContent).toContain('5800 km off')
    expect(el.textContent).toContain('+0 points')
  })

  it('renders game-reveal from outcome on round-ended (unchanged behaviour)', () => {
    const reveal = makePointReveal({ clickedPoint: [4, 50], distanceKm: 750 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 0,
      currentAttempts: [
        {
          pointsEarned: 22,
          input: { kind: 'point', lngLat: [4, 50] },
          reveal,
        },
      ],
      lastOutcome: { pointsEarned: 22, livesDelta: 0, endsGame: true, reveal },
      currentRound: makeCityRound({ targetName: 'Paris' }),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.getByTestId('game-reveal').textContent).toContain('750 km off')
  })
})
```

- [ ] **Step 2: Run the tests, verify all 5 fail (first 4 fail; the 5th already passes since round-ended is the existing behaviour)**

Run: `npm test -- src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx`

Expected: tests 1 and 2 PASS (no game-reveal during playing today), tests 3 and 4 FAIL (no game-reveal rendered yet), test 5 PASS.

(If test 1 or 2 fails, that's a sign the gate is already broken. Stop and investigate.)

- [ ] **Step 3: Implement the helper + loosened gate in CityGuessingHud.tsx**

Replace the contents of `src/game/modes/city-guessing/CityGuessingHud.tsx` with:

```tsx
import { useMemo, type ReactNode } from 'react'
import type { AttemptRecord, GameSession, PointReveal, RoundSpec } from '../../shared/types'
import { MESSAGES } from './messages'

interface Props {
  session: GameSession
  onSkip: () => void
}

function revealLineFor(
  reveal: PointReveal,
  pts: number,
  round: RoundSpec | null,
): ReactNode | null {
  const name = round && round.kind === 'city-guessing' ? round.targetName : 'that city'
  if (reveal.clickedPoint === null) return MESSAGES.revealSkipped(name)
  const d = reveal.distanceKm
  if (d < 1) return MESSAGES.revealCorrect(name)
  if (d < 1000) return MESSAGES.revealNear(d, pts, name)
  return MESSAGES.revealFar(d, pts, name)
}

function latestPointAttempt(
  attempts: readonly AttemptRecord[],
): { reveal: PointReveal; pointsEarned: number } | null {
  if (attempts.length === 0) return null
  const last = attempts[attempts.length - 1]
  if (last.reveal.kind !== 'point') return null
  return { reveal: last.reveal, pointsEarned: last.pointsEarned }
}

function CityGuessingHud({ session, onSkip }: Props) {
  const round = session.currentRound
  const outcome = session.lastOutcome

  const revealLine = useMemo<ReactNode | null>(() => {
    // Round-ended: read from the outcome's best/only attempt reveal.
    if (session.status === 'round-ended' && outcome && outcome.reveal.kind === 'point') {
      return revealLineFor(outcome.reveal, outcome.pointsEarned, round)
    }
    // Playing + best-of-N + ≥1 attempt: read from the latest attempt so each
    // click produces legible feedback before round-ended.
    if (session.status === 'playing' && session.attemptsPerRound > 1) {
      const latest = latestPointAttempt(session.currentAttempts)
      if (latest) return revealLineFor(latest.reveal, latest.pointsEarned, round)
    }
    return null
  }, [session.status, session.attemptsPerRound, session.currentAttempts, outcome, round])

  if (!round || round.kind !== 'city-guessing') return null

  return (
    <div className="flex flex-col items-center gap-2 min-w-[240px]">
      <div className="flex items-center gap-3">
        <img
          src={round.targetCountryFlag}
          alt=""
          className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded shadow-sm shrink-0"
          data-testid="game-prompt-flag"
        />
        <div className="flex flex-col items-start">
          <div
            className="text-base sm:text-lg font-semibold text-sand-900 dark:text-dark-50 leading-tight"
            data-testid="game-prompt-name"
          >
            {round.targetName}
          </div>
          <div className="text-xs text-sand-500 dark:text-dark-100 leading-tight">
            {round.targetCountryName}
          </div>
        </div>
      </div>

      {session.status === 'playing' && session.attemptsPerRound === 1 && (
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
          data-testid="city-skip"
        >
          {MESSAGES.skipButton}
        </button>
      )}

      {revealLine && (
        <div
          className="text-xs sm:text-sm text-sand-700 dark:text-dark-100 text-center"
          data-testid="game-reveal"
          role="status"
        >
          {revealLine}
        </div>
      )}
    </div>
  )
}

export default CityGuessingHud
```

The unused import of `CityRoundSpec` was previously implicit; remove it if eslint flags it. (Today's import line was `import type { GameSession } from '../../shared/types'` — replace with the wider import shown above so the helper signatures resolve.)

- [ ] **Step 4: Run the unit tests, verify all 5 pass**

Run: `npm test -- src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx`

Expected: 5 PASS.

- [ ] **Step 5: Run the wider city-guessing test suite for regressions**

Run: `npm test -- src/game/modes/city-guessing/`

Expected: all existing tests in `roundGenerator.test.ts` and `scoring.test.ts` still pass.

Do not commit yet — Tasks 2 and 3 land in the same commit.

---

### Task 2: useRevealMapEffects — persistent city marker + circle-color reset

**Files:**

- Modify: `src/game/hooks/useRevealMapEffects.ts`
- Modify: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`

**Reference helpers (already in the file):**

- `ensureRevealSources(map)` — idempotent setup for `REVEAL_MARKER_SOURCE`/`LAYER` and `REVEAL_LINE_SOURCE`/`LAYER`.
- `clearRevealSources(map)` — sets both sources' data to empty FeatureCollections.
- `isCityGuessing(modeId)` — predicate from `../shared/modePredicates` (already imported).
- `REVEAL_CORRECT`, `REVEAL_WRONG`, `REVEAL_FAR` — color constants (already imported).
- `prefersReducedMotion()` — already imported.

- [ ] **Step 1: Update the existing intermediate-flash unit tests + add the new persistence tests**

Open `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`. The existing test "flashes clicked country with correctness colour on intermediate attempt (best-of-N)" at line 146 must continue to pass (country branch unchanged).

First, extend the existing palette import at the top of the file. Locate:

```ts
import { REVEAL_CORRECT, REVEAL_WRONG } from '../../../lib/mapPalette'
```

Replace with:

```ts
import { REVEAL_CORRECT, REVEAL_FAR, REVEAL_WRONG } from '../../../lib/mapPalette'
```

Then add a new `describe` block after the existing tests in the outer `describe('useRevealMapEffects', () => { ... })`:

```tsx
describe('useRevealMapEffects — city persistent marker', () => {
  it('renders marker at the latest attempt during playing best-of-N (city)', () => {
    const fake = createFakeMapRef()
    const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 750 })
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 2,
      currentAttempts: [
        {
          pointsEarned: 0,
          input: { kind: 'point', lngLat: [-10, 40] },
          reveal,
        },
      ],
      currentRound: makeCityRound(),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    // Marker source got the latest clickedPoint.
    const markerSetData = fake.calls.setData.mock.calls.find((c) => {
      const arg = c[0] as {
        features?: Array<{ geometry?: { type: string; coordinates?: number[] } }>
      }
      return arg.features?.[0]?.geometry?.type === 'Point'
    })
    expect(markerSetData).toBeDefined()
    const data = markerSetData?.[0] as { features: Array<{ geometry: { coordinates: number[] } }> }
    expect(data.features[0].geometry.coordinates).toEqual([-10, 40])

    // circle-color matches the band (>500km → REVEAL_FAR for 750km).
    expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
      'game-reveal-marker',
      'circle-color',
      REVEAL_FAR,
    )
  })

  it('does NOT schedule a timeout to clear the city intermediate marker', () => {
    vi.useFakeTimers()
    try {
      const fake = createFakeMapRef()
      const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 750 })
      const session = makeSession({
        status: 'playing',
        modeId: 'city-guessing',
        attemptsPerRound: 3,
        attemptsRemaining: 2,
        currentAttempts: [
          {
            pointsEarned: 0,
            input: { kind: 'point', lngLat: [-10, 40] },
            reveal,
          },
        ],
        currentRound: makeCityRound(),
      })
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
      renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))
      // The city branch must not schedule a timeout to clear the marker.
      // (The country branch still does in a separate effect — covered by the
      // existing "flashes clicked country" test.)
      const cityTimeouts = setTimeoutSpy.mock.calls.filter(([, ms]) => ms === 600 || ms === 0)
      expect(cityTimeouts.length).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-paints the marker on resume (initial render with currentAttempts > 0)', () => {
    const fake = createFakeMapRef()
    // Simulates resume: hook mounts directly with status=playing and 2 attempts.
    const reveal = makePointReveal({ clickedPoint: [5, 50], distanceKm: 600 })
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 1,
      currentAttempts: [
        {
          pointsEarned: 0,
          input: { kind: 'point', lngLat: [-10, 40] },
          reveal: makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 }),
        },
        {
          pointsEarned: 0,
          input: { kind: 'point', lngLat: [5, 50] },
          reveal,
        },
      ],
      currentRound: makeCityRound(),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    // Initial mount renders the marker at the LATEST attempt's clickedPoint.
    const markerSetData = fake.calls.setData.mock.calls.find((c) => {
      const arg = c[0] as {
        features?: Array<{ geometry?: { type: string; coordinates?: number[] } }>
      }
      return arg.features?.[0]?.geometry?.type === 'Point'
    })
    const data = markerSetData?.[0] as { features: Array<{ geometry: { coordinates: number[] } }> }
    expect(data.features[0].geometry.coordinates).toEqual([5, 50])
  })

  it('round-end geometry effect resets circle-color to REVEAL_WRONG before painting target marker', () => {
    const fake = createFakeMapRef()
    // City skip-only path: clickedPoint=null, distanceKm=MAX. plan returns null,
    // round-end effect renders the target marker only (no arc).
    const reveal = makePointReveal({ clickedPoint: null, distanceKm: 20015 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    // Reset call must precede or accompany the target-marker setData.
    const resetCall = fake.calls.setPaintProperty.mock.calls.find(
      (c) => c[0] === 'game-reveal-marker' && c[1] === 'circle-color' && c[2] === REVEAL_WRONG,
    )
    expect(resetCall).toBeDefined()
  })
})
```

The first existing test at line 146 (country flash, `REVEAL_WRONG` on hover-border) does NOT change. Verify it still appears in the file with the same assertion.

- [ ] **Step 2: Run the updated hook tests, verify the 4 new tests fail in the expected ways**

Run: `npm test -- src/game/hooks/__tests__/useRevealMapEffects.test.tsx`

Expected new failures:

- "renders marker at the latest attempt during playing best-of-N (city)": FAIL — current code uses the anchor + only-on-increase logic, but the test exercises a single-render path where `prev` and `cur` are computed once on mount. (Depending on initial-render behaviour it may pass; if so, that's fine for this test.)
- "does NOT schedule a timeout to clear the city intermediate marker": FAIL — current city branch schedules a 600ms timeout.
- "re-paints the marker on resume": FAIL — current anchor logic skips the initial render's marker paint.
- "round-end geometry effect resets circle-color to REVEAL_WRONG ...": FAIL — current round-end effect doesn't set circle-color when painting the target marker.

Existing country test must still PASS.

- [ ] **Step 3: Implement the intermediate-effect split and the circle-color reset in `useRevealMapEffects.ts`**

In `src/game/hooks/useRevealMapEffects.ts`, locate the intermediate-flash `useEffect` (starts around line 271 with `useEffect(() => { const enteringPlaying = ...`).

**Before** — the effect looks like this (compressed):

```ts
useEffect(() => {
  // anchor + status-change tracking ...
  if (session.status !== 'playing') return
  if (session.attemptsPerRound <= 1) return
  // attempt-count anchor update + cur/prev checks ...
  const last = session.currentAttempts[cur - 1]
  const map = mapRef.current
  if (!map) return
  const reduced = prefersReducedMotion()
  const holdMs = reduced ? 0 : 600

  if (last.reveal.kind === 'country') {
    // ... country flash: setFilter + setPaintProperty + setTimeout + cleanup return ...
  }

  // City mode: distance-banded marker color.
  // ... full city block from line ~318 through line ~535 ...
  // (setData, setPaintProperty(colour), setTimeout(clear), cleanup return)
}, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])
```

**Edit 1** — insert one line. After `const last = session.currentAttempts[cur - 1]` and **before** `const map = mapRef.current`, add:

```ts
if (last.reveal.kind !== 'country') return // city handled by separate effect below
```

**Edit 2** — delete the city branch entirely. Remove the block starting with the comment `// City mode: distance-banded marker color.` (currently around line 318) through and including its `return () => { ... }` cleanup (around line 535 — about 45 lines of code). The `if (last.reveal.kind === 'country') { ... }` block above it (with its own cleanup return) becomes the only path through the effect; the early-return from Edit 1 makes the wrapper redundant but harmless.

**Verification after Edits 1+2** — the remaining effect body, from `const last` through the closing `}, [...])`, should contain exactly one `if (last.reveal.kind === 'country')` block plus a final implicit fallthrough that never executes (since the early-return caught city attempts). If you see two `return () => { ... }` cleanups, you didn't delete enough.

Immediately after that `useEffect` closes, **add a new `useEffect`** for the city persistent marker:

```ts
// City persistent intermediate marker: renders at the latest attempt's
// clickedPoint, replaced (not accumulated) on each subsequent attempt.
// No timeout — the marker persists until (a) the next click replaces it via
// setData, (b) the round-ended geometry effect overrides with the target
// marker, or (c) the idle-clear effect runs on game end.
useEffect(() => {
  if (session.status !== 'playing') return
  if (session.attemptsPerRound <= 1) return
  if (!isCityGuessing(session.modeId)) return
  if (session.currentAttempts.length === 0) return
  const last = session.currentAttempts[session.currentAttempts.length - 1]
  if (last.reveal.kind !== 'point') return
  const point = last.reveal.clickedPoint
  if (point === null) return
  const map = mapRef.current
  if (!map) return
  const d = last.reveal.distanceKm
  const colour = d < 50 ? REVEAL_CORRECT : d < 500 ? REVEAL_WRONG : REVEAL_FAR
  try {
    ensureRevealSources(map)
    const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
    markerSrc.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: point },
          properties: { intermediate: true },
        },
      ],
    })
    map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', colour)
  } catch {
    /* style may still be resolving */
  }
  // No cleanup, no timeout. Marker persists until externally overridden.
}, [session.status, session.attemptsPerRound, session.modeId, session.currentAttempts])
```

Then locate the **round-end geometry effect** (around line 104, starts with `if (session.status !== 'round-ended' || !session.lastOutcome) return`). Find **both** spots that call `markerSrc.setData(...)` on the target — there are two:

1. The no-animation-plan branch (around line 130-145, inside `if (reveal.kind === 'point')`).
2. The animated branch's marker setData (around line 167-175, inside the `try` block after `ensureRevealSources(map)`).

In **each** spot, immediately before the `markerSrc.setData({ ... })` call, add:

```ts
map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', REVEAL_WRONG)
```

This resets the marker color from whatever band the persistent intermediate marker left it at, so the target marker renders in the documented default (amber).

- [ ] **Step 4: Run the hook tests, verify all pass (4 new + existing country flash + all round-end tests)**

Run: `npm test -- src/game/hooks/__tests__/useRevealMapEffects.test.tsx`

Expected: all tests PASS, including the existing country-flash regression guard.

- [ ] **Step 5: Run the wider game-hooks test suite for regressions**

Run: `npm test -- src/game/hooks/`

Expected: all existing tests still pass.

Do not commit yet — Task 3 lands in the same commit.

---

### Task 3: E2E — daily-city per-click feedback

**Files:**

- Create: `e2e/daily-city-feedback.spec.ts`

**Reference helpers** (`e2e/helpers.ts`):

- `stubDailyIndex(page, today)` — stubs `/daily/index.json` so the test is deterministic.
- `gotoAndWaitForMap(page, path)` — `page.goto(path)` + waits for `data-map-loaded`.
- `waitForGameTestHook(page)` — ensures `__funworldmap_game.*` seam is registered.

**Test seam available** (`src/game/GameSessionProvider.tsx`):

- `window.__funworldmap_game.submitGuess({ kind: 'point', lngLat: [lng, lat] })` — dispatches a city attempt directly without driving the canvas (canvas clicks are camera-dependent; the seam is camera-agnostic).

- [ ] **Step 1: Create the e2e spec**

Create `e2e/daily-city-feedback.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, stubDailyIndex, waitForGameTestHook } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.describe('daily city per-click feedback', () => {
  test('each attempt surfaces distance + points in the HUD; marker persists', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await stubDailyIndex(page, today, { cca3: 'FRA', cityId: 'FRA-paris' })
    await gotoAndWaitForMap(page, `/#daily/${today}/city-guessing`)
    await waitForGameTestHook(page)
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 15_000 })

    // No reveal line before the first attempt.
    await expect(page.getByTestId('game-reveal')).toHaveCount(0)

    // Attempt 1: far from Paris. The HUD must surface "km off" + "+0 points".
    await page.evaluate(() => {
      window.__funworldmap_game?.submitGuess?.({
        kind: 'point',
        lngLat: [-74, 40], // NYC, ~5800 km from Paris
      })
    })
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__funworldmap_game?.getSession?.().currentAttempts.length ?? 0,
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThanOrEqual(1)
    await expect(page.getByTestId('game-reveal')).toBeVisible()
    await expect(page.getByTestId('game-reveal')).toContainText(/km off/)

    // Attempt 2: closer. The HUD reveal text must update.
    await page.evaluate(() => {
      window.__funworldmap_game?.submitGuess?.({
        kind: 'point',
        lngLat: [4, 50], // ~250 km from Paris
      })
    })
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__funworldmap_game?.getSession?.().currentAttempts.length ?? 0,
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThanOrEqual(2)
    // Latest attempt was ~250 km — the text reflects the new distance, not the
    // first one's ~5800 km.
    await expect(page.getByTestId('game-reveal')).not.toContainText('5800')
    await expect(page.getByTestId('game-reveal')).toContainText(/km off/)
  })
})
```

- [ ] **Step 2: Run the e2e spec locally**

Run: `npm run test:e2e -- daily-city-feedback.spec.ts --project=chromium`

Expected: PASS. (If the dev server is already running in the background, kill it first per the project's e2e-dev-server-conflict memory.)

If `gotoAndWaitForMap` isn't exported from `e2e/helpers.ts`, fall back to `page.goto(...)` + `await page.waitForSelector('[data-map-loaded]')`.

Do not commit yet — Task 4 commits all three.

---

### Task 4: Commit 1

- [ ] **Step 1: Stage the commit-1 changes**

Run:

```bash
git add \
  src/game/modes/city-guessing/CityGuessingHud.tsx \
  src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx \
  src/game/hooks/useRevealMapEffects.ts \
  src/game/hooks/__tests__/useRevealMapEffects.test.tsx \
  e2e/daily-city-feedback.spec.ts
```

- [ ] **Step 2: Verify the staged diff is minimal and matches the plan**

Run: `git diff --cached --stat`

Expected: 5 files changed; no unintended files staged.

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 4: Run lint + typecheck**

Run: `npm run lint && npm run typecheck` (or the project's combined gate, typically `npm run check`).

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(city): persist intermediate marker + surface per-click HUD text

Daily city best-of-3 attempts now produce legible feedback: each click
surfaces "X km off · +N points" in the HUD (previously only on round-end)
and the marker persists at the latest guess until the next click or
round-end (previously cleared after 600ms). Country mode best-of-3 keeps
its 600ms hover-border flash — full-country highlights would obscure the
next hover, so the timeout is the right shape for country, not city.

Spec: docs/superpowers/specs/2026-05-19-daily-city-feedback-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 2 — `feat(city): swap daily-city game-over to DailyRevealOverlay`

### Task 5: GameController — overlay branch (Esc handler unchanged)

**Files:**

- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Update imports**

In `src/game/GameController.tsx`, replace:

```ts
import { useEffect, useMemo } from 'react'
```

with:

```ts
import { useCallback, useEffect, useMemo } from 'react'
```

Add `DailyRevealOverlay`, `toLocalDateString`, and `writeHash` imports below the existing `clearResume` import:

```ts
import { DailyRevealOverlay } from '../components/DailyRevealOverlay'
import { toLocalDateString } from './daily/dates'
import { writeHash } from '../lib/hashState'
```

Then locate the existing import line:

```ts
import { isCountryPinning } from './shared/modePredicates'
```

Replace with:

```ts
import { isCityGuessing, isCountryPinning } from './shared/modePredicates'
```

- [ ] **Step 2: Add the `onPlayUnlimitedFree` handler**

Find the existing handler block (currently lines 121-127). After `const onSkip = () => submitGuessInput({ kind: 'skip' })`, add:

```ts
const onPlayUnlimitedFree = useCallback(() => {
  // Mirrors App.tsx's reveal-route handler. The hash-router detects the
  // game-over → playable-route transition and dispatches the atomic `restart`
  // action (bug-#32 path), avoiding the intermediate idle render.
  window.location.hash = writeHash({ kind: 'game', modeId: session.modeId })
}, [session.modeId])
```

- [ ] **Step 3: Branch the game-over render**

Find the existing game-over render (currently lines 146-154):

```tsx
{
  session.status === 'game-over' && (
    <GameOverOverlay
      session={session}
      personalBest={best}
      beatPersonalBest={beatPB}
      onPlayAgain={onPlayAgain}
      onBackToMap={onBackToMap}
    />
  )
}
```

Replace with:

```tsx
{
  session.status === 'game-over' &&
    (session.dailyDate !== null && isCityGuessing(session.modeId) ? (
      <DailyRevealOverlay
        date={session.dailyDate}
        modeId={session.modeId}
        puzzle={dailyPuzzles.byDate(session.dailyDate) ?? null}
        today={toLocalDateString(new Date())}
        countries={countries}
        cities={cities}
        onClose={onBackToMap}
        onPlayUnlimited={onPlayUnlimitedFree}
      />
    ) : (
      <GameOverOverlay
        session={session}
        personalBest={best}
        beatPersonalBest={beatPB}
        onPlayAgain={onPlayAgain}
        onBackToMap={onBackToMap}
      />
    ))
}
```

- [ ] **Step 4: Do NOT change the Esc handler (read-only check)**

The existing Esc handler in `GameController.tsx` (lines 93-107) stays exactly as-is. Both `GameController`'s handler and `DailyRevealOverlay`'s own Esc handler will fire on Esc during daily-city game-over; their side effects (`clearResume` + `endGame` + `writeIdleHash`) are idempotent, so dual-fire is harmless. Narrowing the handler to skip `game-over` would regress Esc-to-close for free-play and daily-country game-over (both still use `GameOverOverlay`, which has no Esc handler of its own). This step is listed explicitly so the implementing agent doesn't "tidy up" what looks like a leftover.

- [ ] **Step 5: Run the GameController-touching test suite**

Run: `npm test -- src/game/`

Expected: all PASS. If a test exists for the existing single-overlay game-over and now fails because the daily-city branch swaps, update that test (rare — search for `getByTestId('game-over')` inside `src/game/`).

Do not commit yet — Task 6 lands in the same commit.

---

### Task 6: E2E migration — mobile-daily-flow

**Files:**

- Modify: `e2e/mobile-daily-flow.spec.ts`

- [ ] **Step 1: Update the daily-city game-over assertion**

In `e2e/mobile-daily-flow.spec.ts`, find line 37:

```ts
await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 15_000 })
```

Replace with:

```ts
await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 15_000 })
```

- [ ] **Step 2: Audit for any other daily-city game-over assertions**

Run:

```bash
git grep -n "city-guessing" e2e/ | grep -v ".test.ts" | head -20
git grep -n 'getByTestId.*game-over' e2e/
```

For each daily-city spec returned, read it. If it asserts `game-over` after a `#daily/<date>/city-guessing` play-through, migrate to `daily-reveal`. Specs that play `country-pinning` keep `game-over` (country daily is unchanged).

Reference audit (from spec writing): the following are country-pinning daily and stay on `game-over`:

- `e2e/daily-best-of-3.spec.ts` (all 3 tests use `submitCountryGuess`)
- `e2e/daily-puzzle.spec.ts` (all `country-pinning`)
- `e2e/daily-reveal-on-final-attempt.spec.ts` (country-pinning)
- `e2e/daily-survives-ocean-click.spec.ts` (country-pinning via `submitCountryGuess`)
- `e2e/daily-share-block-immediate.spec.ts` line 51 (country-pinning; the city case at line 88 doesn't assert game-over)
- `e2e/accessibility.spec.ts` GameOverOverlay axe scan (country-pinning daily)
- `e2e/axe-snapshot.spec.ts` (verify which mode it uses; update only if city-daily)
- `e2e/header-play-reopens-launcher.spec.ts` (verify which mode; update only if city-daily)

If the audit turns up a new city-daily spec, update it the same way as `mobile-daily-flow.spec.ts`. Otherwise no further e2e changes.

- [ ] **Step 3: Run the migrated e2e spec**

Run: `npm run test:e2e -- mobile-daily-flow.spec.ts`

Expected: PASS. (Tests in `mobile-chromium` / `mobile-webkit` projects may run — they all should pass.)

- [ ] **Step 4: Run the broader e2e daily suite**

Run: `npm run test:e2e -- daily`

Expected: all daily-related specs PASS, including the unchanged country specs.

---

### Task 7: Commit 2

- [ ] **Step 1: Stage the commit-2 changes**

Run:

```bash
git add \
  src/game/GameController.tsx \
  e2e/mobile-daily-flow.spec.ts
```

If the audit in Task 6 step 2 turned up additional city-daily specs to migrate, stage those too. `daily-city-feedback.spec.ts` is already in commit 1 — do not re-stage unless Task 6 added city-daily-game-over assertions to it.

- [ ] **Step 2: Verify staged diff**

Run: `git diff --cached --stat`

Expected: GameController.tsx + at least one e2e file.

- [ ] **Step 3: Full test sweep**

Run: `npm test && npm run test:e2e -- daily`

Expected: all PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
feat(city): swap daily-city game-over to DailyRevealOverlay

After the final daily-city attempt, GameController renders DailyRevealOverlay
(city name + dot summary + share + "Play unlimited") instead of
GameOverOverlay (numeric score only). Daily country and free play keep
GameOverOverlay — only the daily-city path swaps. GameController's Esc
handler stays unchanged: it fires alongside DailyRevealOverlay's own Esc
handler, but their side effects (clearResume + endGame + writeIdleHash) are
idempotent, so the dual-fire is harmless. Narrowing would have regressed
Esc-to-close for free + daily-country game-over.

Spec: docs/superpowers/specs/2026-05-19-daily-city-feedback-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 3 — `docs(daily-puzzle): note overlay swap for daily city`

### Task 8: Update daily-puzzle.md

**Files:**

- Modify: `docs/systems/daily-puzzle.md`

- [ ] **Step 1: Edit the Lifecycle section**

In `docs/systems/daily-puzzle.md`, find Lifecycle item 6 (currently around line 29-30):

```markdown
6. **Reveal.** `#daily/YYYY-MM-DD/reveal` (both modes) and
   `#daily/YYYY-MM-DD/<mode>/reveal` routes mount `DailyRevealOverlay`.
```

Append a sentence:

```markdown
6. **Reveal.** `#daily/YYYY-MM-DD/reveal` (both modes) and
   `#daily/YYYY-MM-DD/<mode>/reveal` routes mount `DailyRevealOverlay`. Daily-city game-over also renders `DailyRevealOverlay` directly (the single-attempt-feedback flow needs the reveal's city-name + dot summary, not a numeric `GameOverOverlay`); daily-country game-over continues to render `GameOverOverlay` with the share block.
```

- [ ] **Step 2: Stage and commit**

Run:

```bash
git add docs/systems/daily-puzzle.md
git commit -m "$(cat <<'EOF'
docs(daily-puzzle): note overlay swap for daily city

Daily-city game-over now renders DailyRevealOverlay directly; daily-country
keeps GameOverOverlay. The system doc's Lifecycle §6 (Reveal) needs to
mention this so future readers don't expect a single overlay path for both
daily modes.

Spec: docs/superpowers/specs/2026-05-19-daily-city-feedback-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Manual verification (post-implementation)

Before declaring the branch ready, run through the live UI per CLAUDE.md's "test UI changes in browser" rule. The unit + e2e suites don't catch visual regressions in animation timing or layout.

- [ ] **Step 1: Kill any background dev server** (per the project's e2e-dev-server-conflict memory).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Open `http://localhost:5173` and play daily city**

1. Open the launcher (header play button), click "Play" on the city card.
2. Click off-target. **Expected:** HUD shows "X km off · +N points · ..." text and a colored marker stays visible at the click location.
3. Click closer. **Expected:** HUD text updates (new distance), marker moves to the new click location (the previous marker is replaced, not accumulated).
4. Click a third time. **Expected:** Arc reveal animation from the best-attempt click to Paris (or the day's target), then `DailyRevealOverlay` mounts after ~2s showing the city name, a dot summary of the 3 attempts, the share block, and a "Play unlimited" button.
5. Click "Play unlimited". **Expected:** Free city game starts at `/#game/city-guessing` and runs normally with one-attempt-per-round.

- [ ] **Step 4: Resume mid-attempt check**

1. Open daily city (clear localStorage first if you've already played today).
2. Click off-target once.
3. Refresh the page (F5).
4. **Expected:** Daily city resumes, the persistent marker appears at the previously-clicked location, and the HUD text shows the previous attempt's distance + points.

- [ ] **Step 5: Country daily regression check**

1. Open daily country, play through all 3 attempts.
2. **Expected:** `GameOverOverlay` (numeric score + share block) — NOT `DailyRevealOverlay`. Country daily is unchanged.

- [ ] **Step 6: Free city regression check**

1. Open free city (`/#game/city-guessing` or launcher's "Play unlimited" → city).
2. Click once. **Expected:** Round-end arc + HUD text + advance to next round (no per-click intermediate text because `attemptsPerRound === 1`).
3. Play through 10 rounds. **Expected:** `GameOverOverlay` at the end — NOT `DailyRevealOverlay`.

- [ ] **Step 7: Esc-to-close regression check**

1. Open daily city, complete it. **Expected:** `DailyRevealOverlay`. Press Esc. **Expected:** overlay closes, status returns to bare map, hash cleared.
2. Open daily country, complete it. **Expected:** `GameOverOverlay`. Press Esc. **Expected:** overlay closes, hash cleared.
3. Open free city, complete it. **Expected:** `GameOverOverlay`. Press Esc. **Expected:** overlay closes, hash cleared.

Esc must work in all three game-over states. If it doesn't work in 2 or 3, you accidentally narrowed the Esc handler — undo and re-read Task 5 Step 4.

---

## Self-Review Notes (for the implementing agent)

If any of these fail, stop and re-read the spec — the implementation has drifted:

- The reducer is **never touched.** Search `src/game/shared/useGameSession.ts` for diffs — should be zero.
- The marker-persistence change only removes the city branch's 600ms timeout. The country branch keeps it.
- The overlay branch only fires for `dailyDate !== null && isCityGuessing(modeId)`. Free city and daily country fall through.
- No new analytics events. Search the diff for `track(` — only existing call sites should appear.

If the implementation reveals a spec gap (a requirement that's ambiguous or self-contradictory), surface it before writing more code — do not invent semantics on the fly.
