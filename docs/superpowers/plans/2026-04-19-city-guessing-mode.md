# City Guessing Game Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the second game mode — City Guessing — along with the framework generalisations needed to host it (discriminated RoundSpec / GuessInput / GuessOutcome, a mode picker, and a round-count end condition). Fixed 10 rounds, distance-scored via `round(100 * exp(-dKm/500))`, any map click counts, reveal shows marker + line + fitBounds.

**Architecture:** The existing game framework (shipped via the 2026-04-18 Country Pinning PR) needs three minimal generalisations: RoundSpec / GuessOutcome.reveal become discriminated unions, reducer stops hard-coding the lives-based game-over, GameSession gains `maxRounds`. Controller owns `endsGame` computation so modes stay session-state-free. City Guessing mode is self-contained under `src/game/modes/city-guessing/` with its own scoring, round generator, HUD, and messages. Data ships as a bundled `cities.json` generated at build time from Natural Earth Populated Places (public domain). A new `PlayMenu` component lets users choose between the two modes.

**Tech Stack:** React 19, TypeScript, MapLibre GL JS 5.23, Vitest, Playwright, Tailwind 4. New build-time dependency: fetch against the Natural Earth raw-GeoJSON URL (one-time script, not at runtime).

**Spec:** `docs/superpowers/specs/2026-04-19-city-guessing-mode-design.md`.

**Depends on:** Game framework from PR #1 (merged to main on 2026-04-19).

**Scope out of this plan** (see `docs/roadmap.md`): region / difficulty filters, multiplayer, share-score image, sound effects, i18n of game strings, adjustable round count, population tooltips on reveal marker, per-round timer, difficulty tiers, reveal marker pulse animation, runtime country-data join.

---

## File Structure

**Files to create:**

- `src/game/shared/hud/RoundCounter.tsx` — "Round 3 / 10" badge for fixed-round modes.
- `scripts/fetch-cities.ts` — build-time script, downloads Natural Earth data, outputs `cities.json`.
- `src/data/cities.json` — generated artefact, ~75 KB unminified. Committed to the repo.
- `src/game/modes/city-guessing/index.ts` — mode definition + factory (`getCityGuessingMode(cities)`).
- `src/game/modes/city-guessing/messages.ts` — English strings.
- `src/game/modes/city-guessing/scoring.ts` — exponential decay, DECAY_KM=500.
- `src/game/modes/city-guessing/__tests__/scoring.test.ts`.
- `src/game/modes/city-guessing/roundGenerator.ts` — no-repeat picker.
- `src/game/modes/city-guessing/__tests__/roundGenerator.test.ts`.
- `src/game/modes/city-guessing/CityGuessingHud.tsx` — prompt (flag + country + city), skip button, reveal line.
- `src/hooks/useCityData.ts` — loads `cities.json` as a `CityLike[]`.
- `src/components/PlayMenu.tsx` — mode picker popover anchored to the Play button.
- `e2e/game-city-guessing.spec.ts` — e2e for the new mode.

**Files to modify:**

- `src/game/shared/types.ts` — union types, GuessInput, ModeGuessResult vs GuessOutcome, `maxRounds`, `initialCameraView`.
- `src/game/shared/useGameSession.ts` — reducer honours `outcome.endsGame`; `start` action takes `maxRounds`.
- `src/game/shared/hud/HudShell.tsx` — conditional RoundCounter vs LivesIndicator; hide StreakBadge when `maxRounds` is set.
- `src/game/GameController.tsx` — accepts `GuessInput`, computes `endsGame`, adds city-mode map-click handler, reveal-geometry sources + fitBounds, round-start flyTo, pool-load guard, cleanup on idle.
- `src/game/modes/country-pinning/scoring.ts` — returns `ModeGuessResult` (drops `endsGame`).
- `src/game/modes/country-pinning/index.ts` — `onGuess` destructures `{kind: 'country'}`; adds `maxRounds: null`, `initialCameraView: 'preserve'`.
- `src/game/modes/index.ts` — second case in `getMode`; new `listModes` entry.
- `src/components/Header.tsx` — Play button triggers `PlayMenu` instead of directly writing hash.
- `src/App.tsx` — loads cities via `useCityData`; passes both pools and `byCca3` to `GameController`; threads `maxRounds` on game start.
- `playwright.config.ts` — add `game-city-guessing.spec.ts` to the chromium-gpu testMatch.
- `package.json` — new `"fetch-cities": "tsx scripts/fetch-cities.ts"` script.

**Files NOT modified:**

- `src/lib/hashState.ts` — grammar already supports arbitrary `modeId`.
- `src/hooks/useSelectedCountry.ts` — game hashes don't affect country selection.
- Country Pinning's HUD / reveal / round generator — feature-complete.
- `src/game/shared/distance.ts`, `src/game/shared/usePersonalBests.ts`, `src/game/GameSessionProvider.tsx` — reused as-is.

---

## Pre-flight

- [ ] **Step 0.1: Confirm main is clean + country-pinning PR landed**

Run:
```bash
git status --short
git log --oneline origin/main -3
```

Expected: clean tree; top commit is `4167b5d feat(game): country-pinning game mode + shared framework (#1)` (or later). If not, stop — this plan assumes the framework is in place.

- [ ] **Step 0.2: Create feature branch**

Run:
```bash
git checkout -b feat/city-guessing-game
```

Expected: new branch created.

- [ ] **Step 0.3: Baseline tests pass**

Run:
```bash
npm run test:unit
npm run build
npx playwright test --project=chromium --workers=1 --reporter=line
```

Expected: unit tests pass; build succeeds; chromium e2e passes. GPU tests may be skipped locally; they'll run on CI.

---

## Task 1: Extend shared types

**Files:**
- Modify: `src/game/shared/types.ts`

**Rationale:** Every subsequent task consumes these types. Make Country Pinning still compile by wrapping its existing outputs into the new shape.

- [ ] **Step 1.1: Rewrite `src/game/shared/types.ts`**

```ts
import type React from 'react'

export type GameStatus = 'idle' | 'playing' | 'round-ended' | 'game-over'

export type ModeId = 'country-pinning' | 'city-guessing'

// ---- Country pool (existing, unchanged shape) ----
export type CountryLike = {
  cca3: string
  name: { common: string }
  flag: string
  latlng: [number, number]   // [lat, lng] — matches countries.json
  independent: boolean
}

// ---- City pool (new) ----
export type CityLike = {
  id: string                  // `${countryCca3}-${slug(name)}`, unique
  name: string
  countryCca3: string
  countryName: string
  countryFlag: string         // path like "flags/FR.svg"
  latlng: [number, number]    // [lat, lng]
  scalerank: number
}

// ---- Round specs (discriminated union) ----
export type CountryRoundSpec = {
  kind: 'country-pinning'
  targetCca3: string
  targetName: string
  targetFlag: string
  targetCentroid: [number, number]   // [lng, lat] — MapLibre order
}

export type CityRoundSpec = {
  kind: 'city-guessing'
  targetId: string                    // city record id, used for 'used' set
  targetName: string                  // "Paris"
  targetCountryName: string           // "France"
  targetCountryFlag: string           // "flags/FR.svg"
  targetCentroid: [number, number]    // [lng, lat]
}

export type RoundSpec = CountryRoundSpec | CityRoundSpec

// ---- Guess input (discriminated union) ----
export type GuessInput =
  | { kind: 'country'; cca3: string; centroid: [number, number] }
  | { kind: 'point'; lngLat: [number, number] }
  | { kind: 'skip' }

// ---- Reveal (discriminated union) ----
export type CountryReveal = {
  kind: 'country'
  correct: boolean
  targetCca3: string
  clickedCca3: string | null
  distanceKm: number | null
}

export type PointReveal = {
  kind: 'point'
  targetCentroid: [number, number]
  clickedPoint: [number, number] | null
  distanceKm: number
}

// ---- Outcome (mode result vs controller-augmented) ----
export type ModeGuessResult = {
  pointsEarned: number
  livesDelta: -1 | 0
  reveal: CountryReveal | PointReveal
}

export type GuessOutcome = ModeGuessResult & { endsGame: boolean }

// ---- Session state ----
export type GameSession = {
  modeId: ModeId
  status: GameStatus
  lives: 0 | 1 | 2 | 3
  score: number
  streak: number
  bestStreak: number
  roundIndex: number
  maxRounds: number | null           // null = endless (Country Pinning); 10 = City Guessing
  currentRound: RoundSpec | null
  lastOutcome: GuessOutcome | null
  used: Set<string>
}

export type PersonalBest = {
  bestScore: number
  bestStreak: number
  gamesPlayed: number
}

// ---- Mode contract ----
export type GameMode = {
  id: ModeId
  title: string
  description: string
  hashSegment: string
  maxRounds: number | null
  initialCameraView: 'world' | 'preserve'
  HudComponent: React.FC<{ session: GameSession }>
  nextRound(used: Set<string>): RoundSpec
  onGuess(input: GuessInput, round: RoundSpec): ModeGuessResult
}
```

- [ ] **Step 1.2: Typecheck**

Run:
```bash
npx tsc -b
```

Expected: errors in `src/game/modes/country-pinning/` and `src/game/GameController.tsx` because the mode/reducer signatures changed. That's intentional — we fix them in Tasks 2, 5, 6, 7. Proceed.

- [ ] **Step 1.3: Commit**

```bash
git add src/game/shared/types.ts
git commit -m "refactor(game): discriminated types for RoundSpec / GuessInput / reveal

Sets up City Guessing as a second mode by generalising the shared
types. Country Pinning's implementation in Tasks 2+6 will adapt to
this contract; until then the build is red."
```

---

## Task 2: Update useGameSession reducer

**Files:**
- Modify: `src/game/shared/useGameSession.ts`

**Rationale:** The reducer must honour `outcome.endsGame` (controller-computed) instead of hard-coding a lives check. `start` gains `maxRounds`.

- [ ] **Step 2.1: Rewrite `src/game/shared/useGameSession.ts`**

```ts
import { useCallback, useReducer } from 'react'
import type { GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null }
  | { type: 'guess'; outcome: GuessOutcome }
  | { type: 'advance'; nextRound: RoundSpec }
  | { type: 'overrideRound'; round: RoundSpec }
  | { type: 'endGame' }

const EMPTY: GameSession = {
  modeId: 'country-pinning',
  status: 'idle',
  lives: 3,
  score: 0,
  streak: 0,
  bestStreak: 0,
  roundIndex: 0,
  maxRounds: null,
  currentRound: null,
  lastOutcome: null,
  used: new Set(),
}

function roundKey(round: RoundSpec): string {
  return round.kind === 'country-pinning' ? round.targetCca3 : round.targetId
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: action.maxRounds,
        currentRound: action.firstRound,
        used: new Set([roundKey(action.firstRound)]),
      }
    }
    case 'guess': {
      const nextLives = Math.max(0, state.lives + action.outcome.livesDelta) as GameSession['lives']
      const nextStreak = action.outcome.pointsEarned >= 100 ? state.streak + 1 : 0
      return {
        ...state,
        status: action.outcome.endsGame ? 'game-over' : 'round-ended',
        lives: nextLives,
        score: state.score + action.outcome.pointsEarned,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        lastOutcome: action.outcome,
      }
    }
    case 'advance': {
      if (state.status !== 'round-ended') return state
      return {
        ...state,
        status: 'playing',
        currentRound: action.nextRound,
        used: new Set([...state.used, roundKey(action.nextRound)]),
        roundIndex: state.roundIndex + 1,
        lastOutcome: null,
      }
    }
    case 'overrideRound': {
      if (state.status === 'idle') return state
      return {
        ...state,
        status: 'playing',
        currentRound: action.round,
        used: new Set([...state.used, roundKey(action.round)]),
        lastOutcome: null,
      }
    }
    case 'endGame': {
      return { ...EMPTY, used: new Set() }
    }
  }
}

export function useGameSession(): {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
  submitGuess: (outcome: GuessOutcome) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) =>
      dispatch({ type: 'start', modeId, firstRound, maxRounds }),
    [],
  )
  const submitGuess = useCallback((outcome: GuessOutcome) =>
    dispatch({ type: 'guess', outcome }), [])
  const advance = useCallback((nextRound: RoundSpec) =>
    dispatch({ type: 'advance', nextRound }), [])
  const overrideRound = useCallback((round: RoundSpec) =>
    dispatch({ type: 'overrideRound', round }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, submitGuess, advance, overrideRound, endGame }
}
```

- [ ] **Step 2.2: Update existing reducer tests to the new shape**

Update `src/game/shared/__tests__/useGameSession.test.ts`. Key changes:

1. All `result.current.start('country-pinning', round(...))` calls gain a third argument: `null` (country-pinning has no maxRounds).
2. All `GuessOutcome` fixtures gain `endsGame: boolean`.
3. All `RoundSpec` fixtures gain `kind: 'country-pinning'`.
4. The "three wrong guesses end the game" test: `endsGame: true` only on the third miss.

Full new content:

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type { GuessOutcome, RoundSpec } from '../types'

const round = (cca3: string): RoundSpec => ({
  kind: 'country-pinning',
  targetCca3: cca3,
  targetName: cca3,
  targetFlag: `flags/${cca3}.svg`,
  targetCentroid: [0, 0],
})
const exact = (cca3: string, endsGame = false): GuessOutcome => ({
  correct: false, // unused; kept for compat with old helper
  pointsEarned: 100,
  livesDelta: 0,
  endsGame,
  reveal: {
    kind: 'country',
    correct: true,
    targetCca3: cca3,
    clickedCca3: cca3,
    distanceKm: 0,
  },
}) as unknown as GuessOutcome
const miss = (target: string, clicked: string, pts = 20, endsGame = false): GuessOutcome => ({
  pointsEarned: pts,
  livesDelta: -1,
  endsGame,
  reveal: {
    kind: 'country',
    correct: false,
    targetCca3: target,
    clickedCca3: clicked,
    distanceKm: 1000,
  },
})

describe('useGameSession', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.maxRounds).toBeNull()
  })

  it('start() with null maxRounds enters endless mode', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.maxRounds).toBeNull()
    expect(result.current.session.currentRound?.kind).toBe('country-pinning')
  })

  it('start() with maxRounds=10 sets round cap', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('city-guessing', round('FRA'), 10) })
    expect(result.current.session.maxRounds).toBe(10)
  })

  it('submitGuess(correct, endsGame=false) moves to round-ended with score and streak', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(exact('FRA', false)) })
    expect(result.current.session.score).toBe(100)
    expect(result.current.session.streak).toBe(1)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.status).toBe('round-ended')
  })

  it('submitGuess(wrong) decrements lives and resets streak', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(exact('FRA', false)) })
    act(() => { result.current.advance(round('DEU')) })
    act(() => { result.current.submitGuess(miss('DEU', 'FRA', 20, false)) })
    expect(result.current.session.lives).toBe(2)
    expect(result.current.session.streak).toBe(0)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.score).toBe(120)
  })

  it('endsGame flag routes to game-over regardless of lives', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('city-guessing', round('FRA'), 10) })
    // Simulate the 10th round's guess with endsGame=true
    act(() => { result.current.submitGuess({ ...exact('FRA'), endsGame: true }) })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.lives).toBe(3) // lives untouched for city mode
  })

  it('advance() moves from round-ended to playing with the next round', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(exact('FRA', false)) })
    act(() => { result.current.advance(round('DEU')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.currentRound?.kind).toBe('country-pinning')
    expect(result.current.session.roundIndex).toBe(1)
  })

  it('endGame() returns to idle with empty state', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(exact('FRA', false)) })
    act(() => { result.current.endGame() })
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.score).toBe(0)
    expect(result.current.session.maxRounds).toBeNull()
  })
})
```

- [ ] **Step 2.3: Run reducer tests — expect pass**

Run:
```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts
```

Expected: 7/7 pass.

- [ ] **Step 2.4: Commit**

```bash
git add src/game/shared/useGameSession.ts src/game/shared/__tests__/useGameSession.test.ts
git commit -m "refactor(game): reducer honours outcome.endsGame; start takes maxRounds

Mode no longer decides the end condition — controller computes
endsGame from session state (lives or roundIndex). Round key
lookup generalised to work with both country and city rounds."
```

---

## Task 3: Adapt Country Pinning to the new contract

**Files:**
- Modify: `src/game/modes/country-pinning/scoring.ts`
- Modify: `src/game/modes/country-pinning/index.ts`
- Modify: `src/game/modes/country-pinning/__tests__/scoring.test.ts`

- [ ] **Step 3.1: Rewrite `src/game/modes/country-pinning/scoring.ts`**

```ts
import type { CountryRoundSpec, CountryReveal, GuessInput, ModeGuessResult } from '../../shared/types'
import { haversineKm } from '../../shared/distance'

export const EXACT_POINTS = 100
export const DECAY_KM = 3000

export function scoreGuess(
  round: CountryRoundSpec,
  input: GuessInput,
  clickedCentroid: [number, number] | null,
): ModeGuessResult {
  // Country Pinning only cares about country clicks; other kinds are
  // treated as no-ops (defensive — controller won't actually dispatch them).
  if (input.kind === 'skip' || input.kind === 'point') {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: round.targetCca3,
      clickedCca3: null,
      distanceKm: null,
    }
    return { pointsEarned: 0, livesDelta: 0, reveal }
  }
  // input.kind === 'country'
  const clickedCca3 = input.cca3
  if (clickedCca3 === round.targetCca3) {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: true,
      targetCca3: round.targetCca3,
      clickedCca3,
      distanceKm: 0,
    }
    return { pointsEarned: EXACT_POINTS, livesDelta: 0, reveal }
  }
  if (!clickedCentroid) {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: round.targetCca3,
      clickedCca3,
      distanceKm: null,
    }
    return { pointsEarned: 0, livesDelta: -1, reveal }
  }
  const distanceKm = haversineKm(round.targetCentroid, clickedCentroid)
  const pointsEarned = Math.round(EXACT_POINTS * Math.exp(-distanceKm / DECAY_KM))
  const reveal: CountryReveal = {
    kind: 'country',
    correct: false,
    targetCca3: round.targetCca3,
    clickedCca3,
    distanceKm,
  }
  return { pointsEarned, livesDelta: -1, reveal }
}
```

- [ ] **Step 3.2: Rewrite Country Pinning's scoring tests**

Replace `src/game/modes/country-pinning/__tests__/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreGuess, EXACT_POINTS, DECAY_KM } from '../scoring'
import type { CountryRoundSpec } from '../../../shared/types'

const paris: [number, number] = [2.3522, 48.8566]
const round: CountryRoundSpec = {
  kind: 'country-pinning',
  targetCca3: 'FRA',
  targetName: 'France',
  targetFlag: 'flags/FR.svg',
  targetCentroid: paris,
}

describe('scoreGuess', () => {
  it('exact country click awards EXACT_POINTS and no life lost', () => {
    const out = scoreGuess(round, { kind: 'country', cca3: 'FRA', centroid: paris }, paris)
    expect(out.pointsEarned).toBe(EXACT_POINTS)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.kind).toBe('country')
    if (out.reveal.kind === 'country') {
      expect(out.reveal.correct).toBe(true)
      expect(out.reveal.distanceKm).toBe(0)
    }
  })

  it('wrong country ~500 km away scores ~85 and costs a life', () => {
    const brussels: [number, number] = [4.3517, 50.8503]
    const out = scoreGuess(round, { kind: 'country', cca3: 'BEL', centroid: brussels }, brussels)
    expect(out.pointsEarned).toBeGreaterThan(80)
    expect(out.pointsEarned).toBeLessThan(100)
    expect(out.livesDelta).toBe(-1)
  })

  it('wrong country at decay distance scores ~37', () => {
    const farEast: [number, number] = [41, 48.8566]
    const out = scoreGuess(round, { kind: 'country', cca3: 'KAZ', centroid: farEast }, farEast)
    expect(out.pointsEarned).toBeGreaterThanOrEqual(30)
    expect(out.pointsEarned).toBeLessThanOrEqual(45)
  })

  it('antipodal wrong click scores 0', () => {
    const antipode: [number, number] = [-177.6478, -48.8566]
    const out = scoreGuess(round, { kind: 'country', cca3: 'NZL', centroid: antipode }, antipode)
    expect(out.pointsEarned).toBeLessThanOrEqual(1)
  })

  it('point input (from city mode leakage) is a defensive no-op', () => {
    const out = scoreGuess(round, { kind: 'point', lngLat: paris }, null)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('skip input is a defensive no-op (country mode has no skip)', () => {
    const out = scoreGuess(round, { kind: 'skip' }, null)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('DECAY_KM constant is 3000', () => {
    expect(DECAY_KM).toBe(3000)
  })
})
```

- [ ] **Step 3.3: Rewrite `src/game/modes/country-pinning/index.ts`**

```ts
import type { CountryLike, GameMode } from '../../shared/types'
import { scoreGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { MESSAGES } from './messages'

type HudComponent = GameMode['HudComponent']

let attachedHud: HudComponent | null = null

export function registerCountryPinningHud(c: HudComponent): void {
  attachedHud = c
}

export function getCountryPinningMode(pool: CountryLike[]): GameMode {
  if (!attachedHud) {
    throw new Error('country-pinning HUD not registered — import the HUD module before using the mode')
  }
  return {
    id: 'country-pinning',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'country-pinning',
    maxRounds: null,
    initialCameraView: 'preserve',
    HudComponent: attachedHud,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (input, round) => {
      if (round.kind !== 'country-pinning') {
        // Defensive: controller won't dispatch this.
        return {
          pointsEarned: 0,
          livesDelta: 0,
          reveal: { kind: 'country', correct: false, targetCca3: '', clickedCca3: null, distanceKm: null },
        }
      }
      // For country mode, the controller pre-computes clickedCentroid from
      // byCca3. When that wiring lives in GameController (Task 7), we'll
      // pass it via input.centroid for kind:'country'. Until then, derive
      // from input.centroid if present.
      const clickedCentroid =
        input.kind === 'country' ? input.centroid : null
      return scoreGuess(round, input, clickedCentroid)
    },
  }
}
```

- [ ] **Step 3.4: Update Country Pinning's roundGenerator to return `CountryRoundSpec`**

Edit `src/game/modes/country-pinning/roundGenerator.ts`. Find:

```ts
return {
  targetCca3: picked.cca3,
  targetName: picked.name.common,
  targetFlag: picked.flag,
  targetCentroid: centroidFromLatLng(picked.latlng),
}
```

Replace with:

```ts
return {
  kind: 'country-pinning',
  targetCca3: picked.cca3,
  targetName: picked.name.common,
  targetFlag: picked.flag,
  targetCentroid: centroidFromLatLng(picked.latlng),
}
```

- [ ] **Step 3.5: Update Country Pinning's round generator tests**

Edit `src/game/modes/country-pinning/__tests__/roundGenerator.test.ts`. In every assertion like `expect(r.targetCca3).toBe(...)`, precede with a `kind` check:

```ts
expect(r.kind).toBe('country-pinning')
if (r.kind === 'country-pinning') {
  expect(r.targetCca3).toBe('JPN')
  // ...
}
```

Or, simpler, cast in tests (keep production types strict):

```ts
const r = nextRound(new Set(['FRA', 'DEU']), pool, () => 0)
expect(r.kind).toBe('country-pinning')
expect(r.targetCca3).toBe('JPN')
```

Apply this pattern across all four existing tests.

- [ ] **Step 3.6: Update Country Pinning's HUD to discriminate on round kind**

Edit `src/game/modes/country-pinning/CountryPinningHud.tsx`. Find:

```tsx
const round = session.currentRound
// ...
if (!round) return null
```

Replace with:

```tsx
const round = session.currentRound
// ...
if (!round || round.kind !== 'country-pinning') return null
```

Also update the reveal-line rendering. Find:

```ts
const revealLine = useMemo(() => {
  if (session.status !== 'round-ended' || !reveal) return null
  if (reveal.correct) {
    return MESSAGES.correct(reveal.pointsEarned, reveal.reveal.targetCca3)
  }
  return MESSAGES.wrong(
    reveal.pointsEarned,
    reveal.reveal.targetCca3,
    reveal.reveal.clickedCca3,
  )
}, [session.status, reveal])
```

Replace with:

```ts
const revealLine = useMemo(() => {
  if (session.status !== 'round-ended' || !reveal) return null
  if (reveal.reveal.kind !== 'country') return null
  const r = reveal.reveal
  if (r.correct) return MESSAGES.correct(reveal.pointsEarned, r.targetCca3)
  return MESSAGES.wrong(reveal.pointsEarned, r.targetCca3, r.clickedCca3)
}, [session.status, reveal])
```

- [ ] **Step 3.7: Run all country-pinning unit tests — expect pass**

Run:
```bash
npx vitest run src/game/modes/country-pinning src/game/shared
```

Expected: all pass (scoring, roundGenerator, useGameSession, distance, usePersonalBests).

- [ ] **Step 3.8: Commit**

```bash
git add src/game/modes/country-pinning src/game/shared
git commit -m "refactor(country-pinning): adapt to new mode contract

scoreGuess returns ModeGuessResult (controller computes endsGame).
Round generator tags specs with kind. HUD discriminates on round
and reveal kind. onGuess accepts GuessInput union; non-country
inputs are defensive no-ops."
```

---

## Task 4: Shared `RoundCounter` HUD atom

**Files:**
- Create: `src/game/shared/hud/RoundCounter.tsx`

- [ ] **Step 4.1: Write `RoundCounter.tsx`**

```tsx
interface Props {
  current: number  // 1-based
  total: number
}

export function RoundCounter({ current, total }: Props) {
  return (
    <div
      className="flex items-center gap-1 text-xs font-medium text-sand-700 dark:text-dark-100 tabular-nums"
      role="status"
      aria-label={`Round ${current} of ${total}`}
      data-testid="hud-round-counter"
    >
      <span>Round</span>
      <span className="text-sand-900 dark:text-dark-50">{current}</span>
      <span className="text-sand-400 dark:text-dark-200">/</span>
      <span className="text-sand-500 dark:text-dark-100">{total}</span>
    </div>
  )
}
```

- [ ] **Step 4.2: Typecheck**

Run:
```bash
npx tsc -b
```

Expected: compiles. (Some errors elsewhere still expected from Tasks 5+.)

- [ ] **Step 4.3: Commit**

```bash
git add src/game/shared/hud/RoundCounter.tsx
git commit -m "feat(game): RoundCounter HUD atom for fixed-round modes"
```

---

## Task 5: HudShell branches on session.maxRounds

**Files:**
- Modify: `src/game/shared/hud/HudShell.tsx`

- [ ] **Step 5.1: Rewrite `HudShell.tsx`**

```tsx
import type { ReactNode } from 'react'
import { LivesIndicator } from './LivesIndicator'
import { ScoreBadge } from './ScoreBadge'
import { StreakBadge } from './StreakBadge'
import { RoundCounter } from './RoundCounter'
import type { GameSession } from '../types'

interface Props {
  session: GameSession
  onEndGame: () => void
  children: ReactNode
}

export function HudShell({ session, onEndGame, children }: Props) {
  const fixedRounds = session.maxRounds !== null
  return (
    <div
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[95vw]"
      data-testid="game-hud"
      data-game-status={session.status}
      data-game-mode={session.modeId}
    >
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          {fixedRounds && session.maxRounds ? (
            <RoundCounter
              current={Math.min(session.roundIndex + 1, session.maxRounds)}
              total={session.maxRounds}
            />
          ) : (
            <LivesIndicator lives={session.lives} />
          )}
          <div className="flex items-center gap-2">
            <ScoreBadge score={session.score} />
            {fixedRounds ? null : <StreakBadge streak={session.streak} />}
          </div>
          <button
            type="button"
            onClick={onEndGame}
            className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
            data-testid="game-end"
          >
            End game
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/game/shared/hud/HudShell.tsx
git commit -m "feat(game): HudShell branches on maxRounds

Fixed-round modes get the round counter and no streak badge;
endless modes keep the lives indicator and streak badge."
```

---

## Task 6: Fetch-cities build script

**Files:**
- Create: `scripts/fetch-cities.ts`
- Modify: `package.json`

**Rationale:** Generates `src/data/cities.json` at build time from Natural Earth. Run once per data bump; the artefact is committed.

- [ ] **Step 6.1: Write `scripts/fetch-cities.ts`**

```ts
/**
 * Build-time script — downloads Natural Earth Populated Places,
 * takes top 500 by (scalerank ASC, pop_max DESC), joins country
 * name + flag from src/data/countries.json, writes src/data/cities.json.
 *
 * Run:  npm run fetch-cities
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson'

type NeFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }   // [lng, lat]
  properties: {
    name: string
    adm0_a3: string
    scalerank: number
    pop_max: number
    [k: string]: unknown
  }
}

type CountriesEntry = {
  cca3: string
  name: { common: string }
  flag: string
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  console.log('Fetching Natural Earth Populated Places…')
  const resp = await fetch(NE_URL)
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`)
  const fc = (await resp.json()) as { features: NeFeature[] }
  console.log(`Got ${fc.features.length} features`)

  const countriesRaw = await readFile(resolve(ROOT, 'src/data/countries.json'), 'utf-8')
  const countries = JSON.parse(countriesRaw) as CountriesEntry[]
  const byCca3 = new Map(countries.map((c) => [c.cca3, c]))

  // Sort ascending by (scalerank, -pop_max)
  const sorted = [...fc.features].sort((a, b) => {
    if (a.properties.scalerank !== b.properties.scalerank) {
      return a.properties.scalerank - b.properties.scalerank
    }
    return b.properties.pop_max - a.properties.pop_max
  })

  const top500 = sorted.slice(0, 500)
  const records: {
    id: string
    name: string
    countryCca3: string
    countryName: string
    countryFlag: string
    latlng: [number, number]
    scalerank: number
  }[] = []
  const skipped: string[] = []
  const ids = new Set<string>()
  const collisions: string[] = []

  for (const f of top500) {
    const p = f.properties
    const country = byCca3.get(p.adm0_a3)
    if (!country) {
      skipped.push(`${p.name} (${p.adm0_a3} not in countries.json)`)
      continue
    }
    const id = `${country.cca3}-${slug(p.name)}`
    if (ids.has(id)) {
      collisions.push(`${p.name} → ${id}`)
      continue
    }
    ids.add(id)
    const [lng, lat] = f.geometry.coordinates
    records.push({
      id,
      name: p.name,
      countryCca3: country.cca3,
      countryName: country.name.common,
      countryFlag: country.flag,
      latlng: [lat, lng],
      scalerank: p.scalerank,
    })
  }

  if (collisions.length > 0) {
    console.error(`\nERROR: ${collisions.length} id collisions:`)
    collisions.forEach((c) => console.error(`  ${c}`))
    console.error('Disambiguate via ADM1 or manual override before committing.')
    process.exit(1)
  }
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} cities (missing country mapping):`)
    skipped.slice(0, 5).forEach((s) => console.warn(`  ${s}`))
    if (skipped.length > 5) console.warn(`  …and ${skipped.length - 5} more`)
  }

  console.log(`Writing ${records.length} cities to src/data/cities.json`)
  await writeFile(
    resolve(ROOT, 'src/data/cities.json'),
    JSON.stringify(records, null, 2),
    'utf-8',
  )
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 6.2: Add npm script**

Edit `package.json`. Find the `"scripts"` block and add:

```json
"fetch-cities": "tsx scripts/fetch-cities.ts",
```

(Place alongside the existing `"update-data"`.)

- [ ] **Step 6.3: Commit**

```bash
git add scripts/fetch-cities.ts package.json
git commit -m "build(data): fetch-cities script for Natural Earth Populated Places

Downloads top 500 cities sorted by (scalerank ASC, pop_max DESC),
joins country name + flag from countries.json at build time, fails
on id collisions. Run: npm run fetch-cities."
```

---

## Task 7: Generate `cities.json`

**Files:**
- Create: `src/data/cities.json` (generated artefact)

- [ ] **Step 7.1: Run the fetch script**

Run:
```bash
npm run fetch-cities
```

Expected output: "Writing 500 cities to src/data/cities.json" (give or take a handful for missing country mappings — typical count is 485–500).

- [ ] **Step 7.2: Inspect the output**

Run:
```bash
node -e "const c=require('./src/data/cities.json'); console.log('count:', c.length); console.log('first 3:', JSON.stringify(c.slice(0,3), null, 2));"
```

Expected:
- `count:` ≥ 480.
- First three entries are world-capital-calibre cities (Tokyo, New York, London — varies by Natural Earth dataset version).
- Each entry has `id`, `name`, `countryCca3`, `countryName`, `countryFlag` (path starting with `flags/`), `latlng` (two-element array), `scalerank`.

- [ ] **Step 7.3: Commit**

```bash
git add src/data/cities.json
git commit -m "data(cities): generated cities.json from Natural Earth

500 top cities by scalerank. Regenerate with: npm run fetch-cities."
```

---

## Task 8: `useCityData` hook

**Files:**
- Create: `src/hooks/useCityData.ts`

- [ ] **Step 8.1: Write `useCityData.ts`**

```ts
import { useMemo } from 'react'
import citiesJson from '../data/cities.json'
import type { CityLike } from '../game/shared/types'

/** Loads the bundled city dataset as a typed array. Size: ~75 KB raw / ~25 KB gzip. */
export function useCityData(): { cities: CityLike[] } {
  const cities = useMemo<CityLike[]>(
    () =>
      (citiesJson as CityLike[]).map((c) => ({
        id: c.id,
        name: c.name,
        countryCca3: c.countryCca3,
        countryName: c.countryName,
        countryFlag: c.countryFlag,
        latlng: c.latlng as [number, number],
        scalerank: c.scalerank,
      })),
    [],
  )
  return { cities }
}
```

- [ ] **Step 8.2: Typecheck**

Run:
```bash
npx tsc -b
```

Expected: no new errors. Vite handles `import citiesJson from '../data/cities.json'` natively.

- [ ] **Step 8.3: Commit**

```bash
git add src/hooks/useCityData.ts
git commit -m "feat(data): useCityData hook loads bundled cities.json"
```

---

## Task 9: City-guessing scoring + tests

**Files:**
- Create: `src/game/modes/city-guessing/scoring.ts`
- Create: `src/game/modes/city-guessing/__tests__/scoring.test.ts`

- [ ] **Step 9.1: Write the failing tests**

Create `src/game/modes/city-guessing/__tests__/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreCityGuess, DECAY_KM, MAX_DISTANCE_KM } from '../scoring'
import type { CityRoundSpec } from '../../../shared/types'

const paris: [number, number] = [2.3522, 48.8566]
const round: CityRoundSpec = {
  kind: 'city-guessing',
  targetId: 'FRA-paris',
  targetName: 'Paris',
  targetCountryName: 'France',
  targetCountryFlag: 'flags/FR.svg',
  targetCentroid: paris,
}

describe('scoreCityGuess', () => {
  it('exact click returns full score', () => {
    const out = scoreCityGuess({ kind: 'point', lngLat: paris }, round)
    expect(out.pointsEarned).toBe(100)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.kind).toBe('point')
    if (out.reveal.kind === 'point') {
      expect(out.reveal.distanceKm).toBeLessThan(0.01)
    }
  })

  it('~500 km off scores ~37', () => {
    // A point ~500 km south-east of Paris
    const near: [number, number] = [5.0, 45.0]
    const out = scoreCityGuess({ kind: 'point', lngLat: near }, round)
    expect(out.pointsEarned).toBeGreaterThanOrEqual(32)
    expect(out.pointsEarned).toBeLessThanOrEqual(45)
  })

  it('antipodal click scores ~0', () => {
    const antipode: [number, number] = [-177.6478, -48.8566]
    const out = scoreCityGuess({ kind: 'point', lngLat: antipode }, round)
    expect(out.pointsEarned).toBeLessThanOrEqual(1)
  })

  it('skip input returns zero with max distance', () => {
    const out = scoreCityGuess({ kind: 'skip' }, round)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.kind).toBe('point')
    if (out.reveal.kind === 'point') {
      expect(out.reveal.clickedPoint).toBeNull()
      expect(out.reveal.distanceKm).toBe(MAX_DISTANCE_KM)
    }
  })

  it('country input (defensive leakage) returns zero', () => {
    const out = scoreCityGuess({ kind: 'country', cca3: 'FRA', centroid: paris }, round)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('DECAY_KM constant is 500', () => {
    expect(DECAY_KM).toBe(500)
  })
})
```

- [ ] **Step 9.2: Run tests — expect failure**

Run:
```bash
npx vitest run src/game/modes/city-guessing/__tests__/scoring.test.ts
```

Expected: FAIL with `Cannot find module '../scoring'`.

- [ ] **Step 9.3: Write `scoring.ts`**

```ts
import type {
  CityRoundSpec,
  GuessInput,
  ModeGuessResult,
  PointReveal,
} from '../../shared/types'
import { haversineKm } from '../../shared/distance'

export const DECAY_KM = 500
export const MAX_DISTANCE_KM = 20_015

export function scoreCityGuess(
  input: GuessInput,
  round: CityRoundSpec,
): ModeGuessResult {
  if (input.kind === 'skip') {
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: round.targetCentroid,
      clickedPoint: null,
      distanceKm: MAX_DISTANCE_KM,
    }
    return { pointsEarned: 0, livesDelta: 0, reveal }
  }
  if (input.kind !== 'point') {
    // Defensive: city mode should never receive a country click.
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: round.targetCentroid,
      clickedPoint: null,
      distanceKm: 0,
    }
    return { pointsEarned: 0, livesDelta: 0, reveal }
  }
  const distanceKm = haversineKm(round.targetCentroid, input.lngLat)
  const pointsEarned = Math.round(100 * Math.exp(-distanceKm / DECAY_KM))
  const reveal: PointReveal = {
    kind: 'point',
    targetCentroid: round.targetCentroid,
    clickedPoint: input.lngLat,
    distanceKm,
  }
  return { pointsEarned, livesDelta: 0, reveal }
}
```

- [ ] **Step 9.4: Run tests — expect pass**

Run:
```bash
npx vitest run src/game/modes/city-guessing/__tests__/scoring.test.ts
```

Expected: 6/6 pass.

- [ ] **Step 9.5: Commit**

```bash
git add src/game/modes/city-guessing/scoring.ts src/game/modes/city-guessing/__tests__/scoring.test.ts
git commit -m "feat(city-guessing): scoring with exponential decay (DECAY_KM=500)"
```

---

## Task 10: City-guessing round generator + tests

**Files:**
- Create: `src/game/modes/city-guessing/roundGenerator.ts`
- Create: `src/game/modes/city-guessing/__tests__/roundGenerator.test.ts`

- [ ] **Step 10.1: Write failing tests**

Create `src/game/modes/city-guessing/__tests__/roundGenerator.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextRound } from '../roundGenerator'
import type { CityLike } from '../../../shared/types'

const pool: CityLike[] = [
  { id: 'FRA-paris', name: 'Paris', countryCca3: 'FRA', countryName: 'France', countryFlag: 'flags/FR.svg', latlng: [48.8566, 2.3522], scalerank: 1 },
  { id: 'DEU-berlin', name: 'Berlin', countryCca3: 'DEU', countryName: 'Germany', countryFlag: 'flags/DE.svg', latlng: [52.52, 13.405], scalerank: 2 },
  { id: 'JPN-tokyo', name: 'Tokyo', countryCca3: 'JPN', countryName: 'Japan', countryFlag: 'flags/JP.svg', latlng: [35.68, 139.76], scalerank: 0 },
]

describe('nextRound (city-guessing)', () => {
  it('picks a city not in the used set', () => {
    const used = new Set(['FRA-paris', 'DEU-berlin'])
    const r = nextRound(used, pool, () => 0)
    expect(r.kind).toBe('city-guessing')
    if (r.kind === 'city-guessing') {
      expect(r.targetId).toBe('JPN-tokyo')
    }
  })

  it('returns a CityRoundSpec with correctly swapped centroid [lng, lat]', () => {
    const r = nextRound(new Set(), pool, () => 0)
    expect(r.kind).toBe('city-guessing')
    if (r.kind === 'city-guessing') {
      expect(r.targetName).toBe('Paris')
      expect(r.targetCountryName).toBe('France')
      expect(r.targetCountryFlag).toBe('flags/FR.svg')
      expect(r.targetCentroid).toEqual([2.3522, 48.8566])
    }
  })

  it('resets to full pool when used covers everything', () => {
    const used = new Set(['FRA-paris', 'DEU-berlin', 'JPN-tokyo'])
    const r = nextRound(used, pool, () => 1)
    expect(r.kind).toBe('city-guessing')
  })

  it('uses the injected picker to choose the index', () => {
    const r = nextRound(new Set(), pool, () => 1)
    expect(r.kind).toBe('city-guessing')
    if (r.kind === 'city-guessing') {
      expect(r.targetId).toBe('DEU-berlin')
    }
  })
})
```

- [ ] **Step 10.2: Run tests — expect failure**

Run:
```bash
npx vitest run src/game/modes/city-guessing/__tests__/roundGenerator.test.ts
```

Expected: FAIL with `Cannot find module '../roundGenerator'`.

- [ ] **Step 10.3: Write `roundGenerator.ts`**

```ts
import type { CityLike, CityRoundSpec } from '../../shared/types'

type Picker = (max: number) => number
const defaultPicker: Picker = (max) => Math.floor(Math.random() * max)

export function nextRound(
  used: Set<string>,
  pool: CityLike[],
  pick: Picker = defaultPicker,
): CityRoundSpec {
  let available = pool.filter((c) => !used.has(c.id))
  if (available.length === 0) available = pool.slice()
  const picked = available[pick(available.length)]
  return {
    kind: 'city-guessing',
    targetId: picked.id,
    targetName: picked.name,
    targetCountryName: picked.countryName,
    targetCountryFlag: picked.countryFlag,
    targetCentroid: [picked.latlng[1], picked.latlng[0]],   // [lat,lng] → [lng,lat]
  }
}
```

- [ ] **Step 10.4: Run tests — expect pass**

Run:
```bash
npx vitest run src/game/modes/city-guessing/__tests__/roundGenerator.test.ts
```

Expected: 4/4 pass.

- [ ] **Step 10.5: Commit**

```bash
git add src/game/modes/city-guessing/roundGenerator.ts src/game/modes/city-guessing/__tests__/roundGenerator.test.ts
git commit -m "feat(city-guessing): no-repeat round generator"
```

---

## Task 11: City-guessing messages

**Files:**
- Create: `src/game/modes/city-guessing/messages.ts`

- [ ] **Step 11.1: Write `messages.ts`**

```ts
export const MESSAGES = {
  title: 'City Guessing',
  description: 'Click the location of the shown city. 10 rounds per game.',
  prompt: (name: string, country: string) => `Where is ${name}, ${country}?`,
  help: "Click anywhere on the map — ocean counts too.",
  revealCorrect: (name: string) => `Spot on! You found ${name}.`,
  revealNear: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. That was ${name}.`,
  revealFar: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. ${name} was over there.`,
  revealSkipped: (name: string) => `Skipped. ${name} was there.`,
  gameOver: (score: number) => `Game over. ${score} of 1000.`,
  roundStatus: (current: number, total: number, name: string, country: string) =>
    `Round ${current} of ${total}. Where is ${name}, ${country}? Click anywhere on the map.`,
  skipButton: 'Skip round',
}
```

- [ ] **Step 11.2: Commit**

```bash
git add src/game/modes/city-guessing/messages.ts
git commit -m "feat(city-guessing): English strings"
```

---

## Task 12: `CityGuessingHud` component

**Files:**
- Create: `src/game/modes/city-guessing/CityGuessingHud.tsx`

- [ ] **Step 12.1: Write the HUD**

```tsx
import { useMemo } from 'react'
import type { GameSession } from '../../shared/types'
import { MESSAGES } from './messages'

interface Props {
  session: GameSession
  onSkip: () => void
}

function CityGuessingHud({ session, onSkip }: Props) {
  const round = session.currentRound
  const outcome = session.lastOutcome

  const revealLine = useMemo(() => {
    if (session.status !== 'round-ended' || !outcome) return null
    if (outcome.reveal.kind !== 'point') return null
    const d = outcome.reveal.distanceKm
    const pts = outcome.pointsEarned
    const name =
      round && round.kind === 'city-guessing' ? round.targetName : 'that city'
    if (outcome.reveal.clickedPoint === null) return MESSAGES.revealSkipped(name)
    if (d < 1) return MESSAGES.revealCorrect(name)
    if (d < 1000) return MESSAGES.revealNear(d, pts, name)
    return MESSAGES.revealFar(d, pts, name)
  }, [session.status, outcome, round])

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

      {session.status === 'playing' && (
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

- [ ] **Step 12.2: Commit**

```bash
git add src/game/modes/city-guessing/CityGuessingHud.tsx
git commit -m "feat(city-guessing): HUD with prompt, skip button, reveal line"
```

---

## Task 13: City-guessing mode definition + registry

**Files:**
- Create: `src/game/modes/city-guessing/index.ts`
- Modify: `src/game/modes/index.ts`

- [ ] **Step 13.1: Write `src/game/modes/city-guessing/index.ts`**

```ts
import type { CityLike, GameMode } from '../../shared/types'
import { scoreCityGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { MESSAGES } from './messages'
import CityGuessingHud from './CityGuessingHud'

export const CITY_GUESSING_MAX_ROUNDS = 10

export function getCityGuessingMode(pool: CityLike[]): GameMode {
  return {
    id: 'city-guessing',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'city-guessing',
    maxRounds: CITY_GUESSING_MAX_ROUNDS,
    initialCameraView: 'world',
    // The HUD is a simple component with props (session + onSkip). GameController
    // wires onSkip by wrapping the HudComponent before rendering; for the mode
    // contract's HudComponent we expose a session-only wrapper and let the
    // controller use a sibling render path for the skip button. Simpler: expose
    // a thin wrapper that reads onSkip from a context, and let GameController
    // provide that context. For v1 the controller inlines the skip button
    // outside the HUD — see GameController.
    HudComponent: ({ session }) => <CityGuessingHud session={session} onSkip={() => {}} />,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (input, round) => {
      if (round.kind !== 'city-guessing') {
        return {
          pointsEarned: 0,
          livesDelta: 0,
          reveal: {
            kind: 'point',
            targetCentroid: round.targetCentroid,
            clickedPoint: null,
            distanceKm: 0,
          },
        }
      }
      return scoreCityGuess(input, round)
    },
  }
}
```

Wait — the HUD's Skip button needs a callback to the controller. The comment in the HUD references `onSkip` but the mode's `HudComponent` is `React.FC<{ session }>` only. We need to let the HUD reach the controller. Cleanest: expose `onSkip` via a context provided by `GameController`. Do it now:

Replace Step 13.1 with:

Create `src/game/modes/city-guessing/index.ts`:

```ts
import { createContext, useContext } from 'react'
import type { CityLike, GameMode } from '../../shared/types'
import { scoreCityGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { MESSAGES } from './messages'
import CityGuessingHud from './CityGuessingHud'

export const CITY_GUESSING_MAX_ROUNDS = 10

// Controller injects onSkip; the HUD consumes it. Keeps the
// shared GameMode.HudComponent signature simple.
export const CityGuessingHudActionsContext = createContext<{ onSkip: () => void }>({ onSkip: () => {} })

export function useCityGuessingHudActions() {
  return useContext(CityGuessingHudActionsContext)
}

const CityGuessingHudWrapper: GameMode['HudComponent'] = ({ session }) => {
  const { onSkip } = useCityGuessingHudActions()
  return <CityGuessingHud session={session} onSkip={onSkip} />
}

export function getCityGuessingMode(pool: CityLike[]): GameMode {
  return {
    id: 'city-guessing',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'city-guessing',
    maxRounds: CITY_GUESSING_MAX_ROUNDS,
    initialCameraView: 'world',
    HudComponent: CityGuessingHudWrapper,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (input, round) => {
      if (round.kind !== 'city-guessing') {
        return {
          pointsEarned: 0,
          livesDelta: 0,
          reveal: {
            kind: 'point',
            targetCentroid: round.targetCentroid,
            clickedPoint: null,
            distanceKm: 0,
          },
        }
      }
      return scoreCityGuess(input, round)
    },
  }
}
```

- [ ] **Step 13.2: Register in `src/game/modes/index.ts`**

Replace the file with:

```ts
import type { CityLike, CountryLike, GameMode, ModeId } from '../shared/types'
import { getCountryPinningMode } from './country-pinning'
import { getCityGuessingMode } from './city-guessing'

export function getMode(
  id: ModeId,
  pools: { countries: CountryLike[]; cities: CityLike[] },
): GameMode {
  switch (id) {
    case 'country-pinning':
      return getCountryPinningMode(pools.countries)
    case 'city-guessing':
      return getCityGuessingMode(pools.cities)
  }
}

export function listModes(): { id: ModeId; title: string; description: string }[] {
  return [
    { id: 'country-pinning', title: 'Country Pinning', description: 'Click the country from the flag + name prompt.' },
    { id: 'city-guessing', title: 'City Guessing', description: 'Click the location of the city shown. 10 rounds per game.' },
  ]
}
```

- [ ] **Step 13.3: Typecheck**

Run:
```bash
npx tsc -b
```

Expected: errors in `GameController.tsx` because it still calls `getMode('country-pinning', pool)` with the old signature. We fix that in Task 14. Proceed.

- [ ] **Step 13.4: Commit**

```bash
git add src/game/modes/city-guessing/ src/game/modes/index.ts
git commit -m "feat(city-guessing): mode registration with pools argument

getMode now takes { countries, cities } so both modes receive the
right pool without generics. Skip callback flows through a small
context from GameController down to the HUD."
```

---

## Task 14: GameController — the big integration task

**Files:**
- Modify: `src/game/GameController.tsx`

**Rationale:** Rebuilds the controller to (a) accept both pools, (b) compute `endsGame`, (c) handle city-mode map clicks (any-click), (d) manage reveal geometry sources + `fitBounds`, (e) flyTo-world on round start when `initialCameraView === 'world'`, (f) guard against deep-link-before-pool-load, (g) clean up reveal geometry on idle transition, (h) provide the skip callback to the city HUD.

This is one file but many concerns. Split into steps; commit once at the end.

- [ ] **Step 14.1: Rewrite `src/game/GameController.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CityLike, CountryLike, GameMode, GuessInput, GuessOutcome, ModeId, RoundSpec } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { usePersonalBests } from './shared/usePersonalBests'
import { getMode } from './modes'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { GuessByNameButton } from './shared/hud/GuessByNameButton'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { parseHash } from '../lib/hashState'
import { LAYER } from '../lib/mapLayers'
import { centroidFromLatLng } from './shared/distance'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../lib/mapStyles'
import { CityGuessingHudActionsContext } from './modes/city-guessing'

const REVEAL_MS_COUNTRY = 1200
const REVEAL_MS_CITY = 2000
const REVEAL_MARKER_SOURCE = 'game-reveal-marker'
const REVEAL_LINE_SOURCE = 'game-reveal-line'
const REVEAL_MARKER_LAYER = 'game-reveal-marker-layer'
const REVEAL_LINE_LAYER = 'game-reveal-line-layer'

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

function writeIdleHash(): void {
  if (window.location.hash.startsWith('#game')) {
    history.replaceState(null, '', window.location.pathname)
  }
}

function fitPadding(): number {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return Math.max(40, Math.min(120, Math.min(vw, vh) * 0.1))
}

function ensureRevealSources(map: maplibregl.Map): void {
  if (!map.getSource(REVEAL_MARKER_SOURCE)) {
    map.addSource(REVEAL_MARKER_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    map.addLayer({
      id: REVEAL_MARKER_LAYER,
      type: 'circle',
      source: REVEAL_MARKER_SOURCE,
      paint: {
        'circle-radius': 10,
        'circle-color': '#f59e0b',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
  }
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
        'line-color': '#f59e0b',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    })
  }
}

function clearRevealSources(map: maplibregl.Map): void {
  const emptyFc = { type: 'FeatureCollection' as const, features: [] }
  const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource | undefined
  const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource | undefined
  try {
    markerSrc?.setData(emptyFc)
    lineSrc?.setData(emptyFc)
  } catch { /* no-op */ }
}

interface Props {
  countries: CountryLike[]
  cities: CityLike[]
  byCca3: Map<string, CountryLike>
}

export function GameController({ countries, cities, byCca3 }: Props) {
  const { session, start, submitGuess, advance, overrideRound, endGame } = useGameSessionContext()
  const { best, record } = usePersonalBests(session.modeId || 'country-pinning')
  const recordedRef = useRef(false)
  const pendingStartRef = useRef<ModeId | null>(null)   // deferred-start for pool-not-ready

  const pools = useMemo(() => ({ countries, cities }), [countries, cities])
  const mode = useMemo<GameMode | null>(() => {
    if (session.modeId === 'country-pinning' && countries.length === 0) return null
    if (session.modeId === 'city-guessing' && cities.length === 0) return null
    try {
      return getMode(session.modeId, pools)
    } catch {
      return null
    }
  }, [session.modeId, countries.length, cities.length, pools])

  // Hash → session bootstrap. Read status via ref (hashchange closure-staleness fix).
  const statusRef = useRef(session.status)
  statusRef.current = session.status
  useEffect(() => {
    const check = () => {
      const state = parseHash(window.location.hash)
      if (state.kind === 'game' && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (id !== 'country-pinning' && id !== 'city-guessing') return
        const hasPool = id === 'country-pinning' ? countries.length > 0 : cities.length > 0
        if (!hasPool) {
          pendingStartRef.current = id
          return
        }
        const m = getMode(id, pools)
        const firstRound = m.nextRound(new Set())
        start(id, firstRound, m.maxRounds)
      }
      if (state.kind !== 'game' && statusRef.current !== 'idle') {
        endGame()
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, cities.length])

  // Drain deferred start once the relevant pool arrives.
  useEffect(() => {
    const pending = pendingStartRef.current
    if (!pending || session.status !== 'idle') return
    const hasPool = pending === 'country-pinning' ? countries.length > 0 : cities.length > 0
    if (!hasPool) return
    pendingStartRef.current = null
    const m = getMode(pending, pools)
    const firstRound = m.nextRound(new Set())
    start(pending, firstRound, m.maxRounds)
  }, [countries.length, cities.length, session.status, pools, start])

  // Side effects on status change.
  useEffect(() => {
    if (!mode) return
    if (session.status === 'playing' && session.currentRound) {
      if (session.roundIndex === 0) recordedRef.current = false
      if (session.currentRound.kind === 'country-pinning') {
        dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
      } else {
        const r = session.currentRound
        dispatchAnnouncement(`Round ${session.roundIndex + 1}. Where is ${r.targetName}, ${r.targetCountryName}? Click anywhere on the map.`)
      }
    }
    if (session.status === 'round-ended' && session.lastOutcome) {
      const o = session.lastOutcome
      if (o.reveal.kind === 'country') {
        dispatchAnnouncement(
          o.reveal.correct
            ? `Correct. Plus ${o.pointsEarned} points.`
            : `Wrong. Plus ${o.pointsEarned} points. ${session.lives === 1 ? 'One life remaining.' : `${session.lives} lives remaining.`}`,
        )
      } else {
        const d = o.reveal.distanceKm
        if (o.reveal.clickedPoint === null) {
          dispatchAnnouncement(`Skipped round.`)
        } else {
          dispatchAnnouncement(`${Math.round(d)} kilometres off. Plus ${o.pointsEarned} points.`)
        }
      }
      const revealMs = session.modeId === 'city-guessing' ? REVEAL_MS_CITY : REVEAL_MS_COUNTRY
      const t = window.setTimeout(() => {
        const next = mode.nextRound(session.used)
        advance(next)
      }, revealMs)
      return () => window.clearTimeout(t)
    }
    if (session.status === 'game-over' && !recordedRef.current) {
      recordedRef.current = true
      record(session.score, session.bestStreak)
      dispatchAnnouncement(`Game over. Final score ${session.score}.`)
    }
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    advance, mode, record,
  ])

  // Reveal geometry: when round-ended, update marker + line sources and fitBounds.
  useEffect(() => {
    if (session.status !== 'round-ended' || !session.lastOutcome) return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return

    const reveal = session.lastOutcome.reveal

    if (reveal.kind === 'country') {
      // Country Pinning: pulse target border as before.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      try {
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], reveal.targetCca3])
        const colour = reveal.correct ? '#22c55e' : '#f59e0b'
        map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
        map.setPaintProperty(LAYER.hoverBorder, 'line-width', reduced ? 3 : 4)
      } catch { /* layer may not exist */ }
      return () => {
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }
    }

    // City Guessing: marker + line + fitBounds.
    ensureRevealSources(map)
    const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
    const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource
    const target = reveal.targetCentroid
    markerSrc.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: target }, properties: {} }],
    })
    if (reveal.clickedPoint) {
      lineSrc.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [reveal.clickedPoint, target] },
            properties: {},
          },
        ],
      })
      // fitBounds around both points.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const lngs = [reveal.clickedPoint[0], target[0]]
      const lats = [reveal.clickedPoint[1], target[1]]
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { duration: reduced ? 0 : 1000, padding: fitPadding(), maxZoom: 6 },
      )
    } else {
      // Skip: clear line, just show marker.
      lineSrc.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [session.status, session.lastOutcome])

  // Camera reset on round start when mode requests it.
  useEffect(() => {
    if (session.status !== 'playing' || !mode) return
    if (mode.initialCameraView !== 'world') return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: reduced ? 0 : 700 })
  }, [session.status, session.roundIndex, mode])

  // City-mode any-click handler.
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.modeId !== 'city-guessing') return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      submitGuessWithInput({ kind: 'point', lngLat: [e.lngLat.lng, e.lngLat.lat] })
    }
    map.on('click', onClick)
    return () => { map.off('click', onClick) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, session.modeId])

  // Clear reveal geometry on every transition into idle.
  useEffect(() => {
    if (session.status !== 'idle') return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (map) clearRevealSources(map)
  }, [session.status])

  // Submit-guess wrapper that computes endsGame.
  const submitGuessWithInput = useCallback((input: GuessInput) => {
    if (!mode || session.status !== 'playing' || !session.currentRound) return
    const result = mode.onGuess(input, session.currentRound)
    const endsGame = session.maxRounds !== null
      ? session.roundIndex + 1 >= session.maxRounds
      : session.lives + result.livesDelta <= 0
    const outcome: GuessOutcome = { ...result, endsGame }
    submitGuess(outcome)
  }, [mode, session.status, session.currentRound, session.maxRounds, session.roundIndex, session.lives, submitGuess])

  // Expose submitGuess + setRound on window for tests.
  useEffect(() => {
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.submitGuess = (input: GuessInput) => submitGuessWithInput(input)
    w.__funworldmap_game.setRound = (id: string): boolean => {
      if (!mode) return false
      let round: RoundSpec | null = null
      if (session.modeId === 'country-pinning') {
        const country = byCca3.get(id.toUpperCase())
        if (!country) return false
        round = {
          kind: 'country-pinning',
          targetCca3: country.cca3,
          targetName: country.name.common,
          targetFlag: country.flag,
          targetCentroid: centroidFromLatLng(country.latlng),
        }
      } else {
        const city = cities.find((c) => c.id === id)
        if (!city) return false
        round = {
          kind: 'city-guessing',
          targetId: city.id,
          targetName: city.name,
          targetCountryName: city.countryName,
          targetCountryFlag: city.countryFlag,
          targetCentroid: [city.latlng[1], city.latlng[0]],
        }
      }
      if (statusRef.current === 'idle') {
        start(session.modeId, round, mode.maxRounds)
      } else {
        overrideRound(round)
      }
      return true
    }
    return () => {
      if (w.__funworldmap_game) {
        delete w.__funworldmap_game.submitGuess
        delete w.__funworldmap_game.setRound
      }
    }
  }, [mode, session.modeId, byCca3, cities, start, overrideRound, submitGuessWithInput])

  // Legacy alias for Country Pinning e2e tests.
  useEffect(() => {
    ;(window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess = (cca3) => {
      if (session.modeId !== 'country-pinning') return
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return
      submitGuessWithInput({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        centroid: centroidFromLatLng(country.latlng),
      })
    }
    return () => {
      delete (window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess
    }
  }, [session.modeId, byCca3, submitGuessWithInput])

  // Escape exits.
  useEffect(() => {
    if (session.status === 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      endGame()
      writeIdleHash()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.status, endGame])

  const onEndGame = () => { endGame(); writeIdleHash() }
  const onPlayAgain = () => {
    if (!mode) return
    const firstRound = mode.nextRound(new Set())
    start(session.modeId, firstRound, mode.maxRounds)
  }
  const onBackToMap = onEndGame
  const onSkip = () => submitGuessWithInput({ kind: 'skip' })

  if (session.status === 'idle' || !mode) return null

  const Hud = mode.HudComponent
  const beatPB = session.score > best.bestScore || session.bestStreak > best.bestStreak

  return (
    <CityGuessingHudActionsContext.Provider value={{ onSkip }}>
      {(session.status === 'playing' || session.status === 'round-ended') && (
        <FirstSessionTutorial />
      )}
      <HudShell session={session} onEndGame={onEndGame}>
        <Hud session={session} />
        {session.status === 'playing' && session.modeId === 'country-pinning' && (
          <GuessByNameButton
            pool={countries}
            onGuess={(cca3) => {
              const c = byCca3.get(cca3.toUpperCase())
              if (!c) return
              submitGuessWithInput({
                kind: 'country',
                cca3: cca3.toUpperCase(),
                centroid: centroidFromLatLng(c.latlng),
              })
            }}
          />
        )}
      </HudShell>
      {session.status === 'game-over' && (
        <GameOverOverlay
          session={session}
          personalBest={best}
          beatPersonalBest={beatPB}
          onPlayAgain={onPlayAgain}
          onBackToMap={onBackToMap}
        />
      )}
    </CityGuessingHudActionsContext.Provider>
  )
}
```

- [ ] **Step 14.2: Typecheck**

Run:
```bash
npx tsc -b
```

Expected: compiles. If errors, the most likely are:
- `GuessByNameButton` prop mismatch (we passed `pool={countries}` but the component expects `CountryData[]`) — keep the cast; shape is compatible.
- Mode's `HudComponent` mismatch — `CityGuessingHudWrapper` returns `JSX.Element` ≠ `React.ReactElement | null`. Add explicit return type.

- [ ] **Step 14.3: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "feat(game): controller supports both modes

Accepts { countries, cities, byCca3 }; computes endsGame from
session state; adds city-mode any-click handler; renders reveal
marker + line + fitBounds; flies to world view on each round
start when mode.initialCameraView === 'world'; clears reveal
geometry on idle transition; defers start() until pool loads;
exposes __funworldmap_game.submitGuess(input) for e2e."
```

---

## Task 15: App.tsx + Header wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`
- Create: `src/components/PlayMenu.tsx`

- [ ] **Step 15.1: Write `PlayMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { listModes } from '../game/modes'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'

const LAST_MODE_KEY = 'funworldmap-game-last-mode'

function readLastMode(): ModeId {
  try {
    const v = localStorage.getItem(LAST_MODE_KEY)
    if (v === 'country-pinning' || v === 'city-guessing') return v
  } catch { /* ignore */ }
  return 'country-pinning'
}

export function PlayMenu({ open, onClose, triggerRef }: {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [focusedIdx, setFocusedIdx] = useState(0)
  const modes = listModes()
  const lastMode = readLastMode()
  const ordered = [...modes].sort((a, b) => (a.id === lastMode ? -1 : b.id === lastMode ? 1 : 0))

  useEffect(() => {
    if (!open) return
    setFocusedIdx(0)
    const first = containerRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    first?.focus()

    const onOutside = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); triggerRef.current?.focus() }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx((i) => (i + 1) % ordered.length) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx((i) => (i - 1 + ordered.length) % ordered.length) }
      if (e.key === 'Home') { e.preventDefault(); setFocusedIdx(0) }
      if (e.key === 'End') { e.preventDefault(); setFocusedIdx(ordered.length - 1) }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, ordered.length, triggerRef])

  useEffect(() => {
    if (!open) return
    const items = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    items?.[focusedIdx]?.focus()
  }, [focusedIdx, open])

  if (!open) return null

  const selectMode = (id: ModeId) => {
    try { localStorage.setItem(LAST_MODE_KEY, id) } catch { /* ignore */ }
    window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
    onClose()
  }

  return (
    <div
      ref={containerRef}
      id="play-menu"
      role="menu"
      aria-orientation="vertical"
      className="absolute right-0 top-12 w-56 rounded-xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl overflow-hidden z-50"
      data-testid="play-menu"
    >
      {ordered.map((m) => (
        <button
          key={m.id}
          type="button"
          role="menuitem"
          onClick={() => selectMode(m.id)}
          className="w-full text-left px-4 py-3 text-sm hover:bg-sand-200/70 dark:hover:bg-dark-300/70 focus:outline-none focus:bg-sand-200/70 dark:focus:bg-dark-300/70"
          data-testid={`play-menu-${m.id}`}
        >
          <div className="font-semibold text-sand-900 dark:text-dark-50">{m.title}</div>
          <div className="text-xs text-sand-500 dark:text-dark-100 mt-0.5">{m.description}</div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 15.2: Rewrite `src/components/Header.tsx`**

Full rewrite — replace the direct-start Play button with a `PlayMenu` trigger:

```tsx
import { useRef, useState } from 'react'
import SearchBar from './SearchBar'
import ThemeToggle from './ThemeToggle'
import { PlayMenu } from './PlayMenu'
import type { CountryData } from '../lib/types'
import type { Theme } from '../hooks/useTheme'

interface Props {
  countries: CountryData[]
  theme: Theme
  satellite: boolean
  comparePickingMode: boolean
  gameActive: boolean
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
  onSatelliteToggle: () => void
}

export default function Header({
  countries, theme, satellite, comparePickingMode, gameActive,
  onSelect, onThemeCycle, onSatelliteToggle,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto hidden lg:flex items-baseline mr-4 shrink-0">
          <span className="text-lg font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </span>
        </div>

        {!gameActive && (
          <div className="pointer-events-auto flex-1 max-w-md mx-auto lg:mx-0">
            <SearchBar countries={countries} comparePickingMode={comparePickingMode} onSelect={onSelect} />
          </div>
        )}

        <div className="pointer-events-auto ml-3 flex items-center gap-2 relative">
          {!gameActive && (
            <>
              <button
                ref={triggerRef}
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Play a game"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls="play-menu"
                className="w-10 h-10 rounded-xl backdrop-blur-sm border bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-teal dark:text-teal-light hover:bg-sand-200/90 dark:hover:bg-dark-300/80 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
                data-testid="header-play"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <PlayMenu open={menuOpen} onClose={() => setMenuOpen(false)} triggerRef={triggerRef} />
            </>
          )}

          <button
            onClick={onSatelliteToggle}
            aria-label={satellite ? 'Switch to map view' : 'Switch to satellite view'}
            aria-pressed={satellite}
            className={`w-10 h-10 rounded-xl backdrop-blur-sm border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
              satellite
                ? 'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal dark:text-teal-light'
                : 'bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-sand-500 dark:text-dark-100 hover:bg-sand-200/90 dark:hover:bg-dark-300/80'
            }`}
            data-testid="satellite-toggle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.6 9h16.8M3.6 15h16.8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z" />
            </svg>
          </button>

          <ThemeToggle theme={theme} onCycle={onThemeCycle} />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 15.3: Modify `src/App.tsx` to load cities + pass both pools**

Find:

```tsx
import type { CountryLike } from './game/shared/types'
```

Replace with:

```tsx
import { useCityData } from './hooks/useCityData'
import type { CountryLike } from './game/shared/types'
```

Then find `const { countries, byNumeric, byCca3, sources } = useCountryData()` and add right after:

```tsx
const { cities } = useCityData()
```

Replace the `<GameController ... />` call with:

```tsx
<GameController countries={pool} cities={cities} byCca3={poolByCca3} />
```

(Where `pool` is the existing country pool and `poolByCca3` its lookup map. Both already exist in App.tsx from the prior Country Pinning integration.)

Also find `onPlay` — the handler that wrote the hash for country-pinning:

```tsx
const onPlay = useCallback(() => {
  window.location.hash = writeHash({ kind: 'game', modeId: 'country-pinning', playing: true })
}, [])
```

Delete `onPlay` and the corresponding `onPlay={onPlay}` prop on `<Header>` — the PlayMenu now owns mode selection.

- [ ] **Step 15.4: Remove the stale `onPlay` prop from Header (confirm it's gone)**

The Header's Props interface should no longer include `onPlay`. Confirm the `<Header ... />` call site in App.tsx doesn't pass one either.

- [ ] **Step 15.5: Build — expect pass**

Run:
```bash
npm run build
```

Expected: TypeScript compiles; Vite emits bundles. Size should grow by ~75 KB raw / ~25 KB gzip for `cities.json` + mode code.

- [ ] **Step 15.6: Run full unit suite**

Run:
```bash
npm run test:unit
```

Expected: all tests pass (reducer, country-pinning scoring, city-guessing scoring, roundGenerators, distance, usePersonalBests, hashState).

- [ ] **Step 15.7: Smoke-test in dev server**

Run:
```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
1. Normal country selection + panel still works.
2. Header Play button opens a menu with two items (Country Pinning first on fresh localStorage).
3. Country Pinning still works end-to-end.
4. Click City Guessing → HUD appears with "Round 1 / 10" and a city prompt; clicking on the map scores points and shows a line + marker reveal.
5. Skip button advances to the next round with 0 points.
6. After 10 rounds → game-over overlay with total / 1000.
7. Last-played mode (City Guessing) appears first in the menu on subsequent opens.
8. Escape exits the game cleanly.
9. Deep-link `#game/city-guessing/play` boots straight into the game.

If any step fails, stop and debug before e2e tasks.

- [ ] **Step 15.8: Commit**

```bash
git add src/App.tsx src/components/Header.tsx src/components/PlayMenu.tsx
git commit -m "feat(game): header Play menu + App wires both pools

Play button opens a keyboard-accessible menu that starts either
mode via hash. Last-played mode remembered in localStorage, shown
first. App loads cities via useCityData and passes both pools to
GameController."
```

---

## Task 16: E2E spec for city guessing

**Files:**
- Create: `e2e/game-city-guessing.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 16.1: Add the spec to chromium-gpu testMatch**

Edit `playwright.config.ts`, find the chromium-gpu project's testMatch:

```ts
testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts', 'game-country-pinning.spec.ts'],
```

Add `'game-city-guessing.spec.ts'`:

```ts
testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts', 'game-country-pinning.spec.ts', 'game-city-guessing.spec.ts'],
```

- [ ] **Step 16.2: Write `e2e/game-city-guessing.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function openCityGuessing(page: Page) {
  await page.goto('/')
  await waitForMap(page)
  await page.getByTestId('header-play').click()
  await page.getByTestId('play-menu-city-guessing').click()
  await expect(page.getByTestId('game-hud')).toBeVisible()
  await expect(page.getByTestId('hud-round-counter')).toContainText('1')
}

async function setRoundAndWait(page: Page, id: string, expectedName: string) {
  await expect(page.getByTestId('game-prompt-name')).toBeVisible()
  const ok = await page.evaluate((c) => {
    type Hook = { setRound?: (c: string) => boolean }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    if (!g || typeof g.setRound !== 'function') return false
    return g.setRound(c)
  }, id)
  if (!ok) throw new Error(`setRound('${id}') returned false`)
  await expect(page.getByTestId('game-prompt-name')).toHaveText(expectedName, { timeout: 10_000 })
}

async function clickAt(page: Page, lng: number, lat: number) {
  await page.evaluate((p) => {
    type Hook = { submitGuess?: (i: { kind: 'point'; lngLat: [number, number] }) => void }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    g?.submitGuess?.({ kind: 'point', lngLat: [p.lng, p.lat] })
  }, { lng, lat })
}

test.describe('City Guessing game', () => {
  test('enter via Play menu, HUD shows round counter', async ({ page }) => {
    await openCityGuessing(page)
    await expect(page.getByTestId('hud-round-counter')).toContainText('/ 10')
    await expect(page.getByTestId('hud-score')).toHaveText('0')
    await expect(page.getByTestId('city-skip')).toBeVisible()
  })

  test('deep link #game/city-guessing/play boots into playing', async ({ page }) => {
    await page.goto('/#game/city-guessing/play')
    await waitForMap(page)
    await expect(page.getByTestId('game-hud')).toBeVisible()
    await expect(page.getByTestId('hud-round-counter')).toContainText('1')
  })

  test('exact click at target scores 100', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await clickAt(page, 2.3522, 48.8566)
    await expect(page.getByTestId('hud-score')).toHaveText('100', { timeout: 10_000 })
  })

  test('far click scores low and shows distance', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await clickAt(page, 0, 0)   // Gulf of Guinea, ~5400 km from Paris
    await expect(page.getByTestId('game-reveal')).toContainText('km off', { timeout: 10_000 })
    const score = await page.getByTestId('hud-score').innerText()
    expect(Number(score)).toBeGreaterThanOrEqual(0)
    expect(Number(score)).toBeLessThan(30)
  })

  test('skip round scores 0 and advances', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await page.getByTestId('city-skip').click()
    await expect(page.getByTestId('game-reveal')).toContainText('Skipped', { timeout: 10_000 })
    await expect(page.getByTestId('hud-score')).toHaveText('0')
    // Wait past REVEAL_MS_CITY = 2000ms for advance
    await expect
      .poll(
        async () => await page.evaluate(() => {
          type H = { getSession?: () => { roundIndex?: number } }
          return (window as unknown as { __funworldmap_game?: H }).__funworldmap_game?.getSession?.()?.roundIndex
        }),
        { timeout: 10_000 },
      )
      .toBe(1)
  })

  test('ten rounds end the game', async ({ page }) => {
    await openCityGuessing(page)
    // Use skip for speed; ten skips → game-over.
    for (let i = 0; i < 10; i++) {
      await setRoundAndWait(page, 'FRA-paris', 'Paris')
      await page.getByTestId('city-skip').click()
      if (i < 9) {
        await expect
          .poll(
            async () => await page.evaluate(() => {
              type H = { getSession?: () => { status?: string } }
              return (window as unknown as { __funworldmap_game?: H }).__funworldmap_game?.getSession?.()?.status
            }),
            { timeout: 10_000 },
          )
          .toBe('playing')
      }
    }
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('game-over-score')).toHaveText('0')
  })

  test('Play menu shows last-played mode first', async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')
    })
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('header-play').click()
    const menu = page.getByTestId('play-menu')
    const items = menu.getByRole('menuitem')
    await expect(items.first()).toContainText('City Guessing')
  })

  test('Back to map exits cleanly and clears hash', async ({ page }) => {
    await page.goto('/#game/city-guessing/play')
    await waitForMap(page)
    await page.getByTestId('game-end').click()
    await expect(page.getByTestId('game-hud')).toHaveCount(0)
    expect(page.url().endsWith('/')).toBe(true)
  })
})
```

- [ ] **Step 16.3: Run the spec locally**

Run:
```bash
npx playwright test e2e/game-city-guessing.spec.ts --project=chromium-gpu --workers=1 --reporter=line
```

Expected: 7/7 pass. If failures:
- "setRound returned false" — check `cities.json` contains `FRA-paris` (run `node -e "console.log(require('./src/data/cities.json').find(c=>c.id==='FRA-paris'))"` to confirm). If the id slug differs (e.g., due to the normalisation), adjust the test's target id.
- Play menu timing — bump the `expect(page.getByTestId('play-menu')).toBeVisible()` wait.
- Test 6 (ten rounds) flaky — CI-ceiling-style timeout; bump the poll to 15 s.

- [ ] **Step 16.4: Commit**

```bash
git add e2e/game-city-guessing.spec.ts playwright.config.ts
git commit -m "test(e2e): city-guessing end-to-end coverage

Menu entry, deep link, exact click, far click, skip, 10-round
game-over, last-mode persistence, back-to-map exit."
```

---

## Task 17: Regression sweep + push

**Files:** none

- [ ] **Step 17.1: Full unit suite**

Run:
```bash
npm run test:unit
```

Expected: all tests pass, including the updated Country Pinning assertions.

- [ ] **Step 17.2: Full chromium e2e suite**

Run:
```bash
npm run build
npx playwright test --project=chromium --workers=1 --reporter=line
```

Expected: all DOM-level specs pass (including the updated country-pinning + new city-guessing in chromium-gpu — chromium project doesn't match game specs).

Actually: `chromium` project doesn't include game specs (they're GPU-only). This step is the DOM regression (panel, search, theme, a11y, scaffold, meta-and-static, panel-focus, satellite-default).

- [ ] **Step 17.3: Full chromium-gpu e2e suite**

Run:
```bash
npx playwright test --project=chromium-gpu --workers=1 --reporter=line
```

Expected: all GPU specs pass:
- `map-and-countries.spec.ts`
- `map-reliability.spec.ts`
- `keyboard-map-nav.spec.ts`
- `game-country-pinning.spec.ts`
- `game-city-guessing.spec.ts`

If `game-country-pinning.spec.ts` fails: Country Pinning adaptation regressed. Debug by reading the test hook output (`__funworldmap_guess` should still work).

- [ ] **Step 17.4: Push and create PR**

Run:
```bash
git push -u origin feat/city-guessing-game
gh pr create --title "feat(game): city-guessing mode + framework generalisations" --body "$(cat <<'EOF'
## Summary

Second game mode: 10 rounds, click-anywhere map guesses, distance-scored
via `round(100 * exp(-dKm/500))`. Adds a header Play menu so both modes
coexist. Frameworks generalised minimally: RoundSpec / GuessInput /
GuessOutcome.reveal are discriminated unions; reducer honours
`outcome.endsGame`; GameSession gains `maxRounds`.

- Spec: [2026-04-19-city-guessing-mode-design.md](docs/superpowers/specs/2026-04-19-city-guessing-mode-design.md)
- Plan: [2026-04-19-city-guessing-mode.md](docs/superpowers/plans/2026-04-19-city-guessing-mode.md)
- Roadmap: [docs/roadmap.md](docs/roadmap.md) (deferred items)

Data: top 500 Natural Earth Populated Places (public domain), sorted
by `(scalerank ASC, pop_max DESC)`, bundled with country name + flag
path inlined. Run `npm run fetch-cities` to regenerate.

## Test plan

- [x] Unit tests all pass (city-guessing scoring, roundGenerator, reducer)
- [x] Chromium e2e (DOM) all pass
- [x] Chromium-gpu e2e (incl. country-pinning and new city-guessing) all pass
- [ ] Manual smoke-test: Play menu; both modes; skip button; last-mode persistence; deep link

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed; CI starts.

---

## Post-plan

Open the PR URL, monitor CI, address any CI-only flakes using the patterns established in the Country Pinning PR (10 s poll budgets, `force: true` on clicks that race animations, deterministic waits on pool load).

When CI is green, review the PR (either self-review or request code review), then merge.

After merge, update `docs/roadmap.md` — strike the "second game mode landed" line if you added one, and confirm the deferred items listed are still accurate.
