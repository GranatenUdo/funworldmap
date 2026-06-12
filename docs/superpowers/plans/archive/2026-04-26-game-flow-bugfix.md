# Game-flow bugfix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 24 verified findings from the 2026-04-25 critical assessment by collapsing the `recordAttempt`/`submitGuess` reducer split into a single `attempt` action, persisting in-progress daily attempts so refresh stops being destructive, redesigning `deep_link_opened` telemetry, and bringing four documentation files back into agreement with code.

**Architecture:** One branch (`game-flow-bugfix` — already created), eleven commits in load-bearing order. Commit 1 is the structural change (reducer collapse) and unblocks commits 2–5. Commits 6–10 are independent cleanup. Commit 11 is documentation.

**Tech Stack:** React 19, TypeScript, Vite 6, MapLibre GL 5.23, Vitest (unit), Playwright 1.59 (e2e).

**Spec:** `docs/superpowers/specs/2026-04-26-game-flow-bugfix-design.md`

---

## File Structure

### Created
- `src/game/shared/hud/AttemptsIndicator.tsx` — three-pip indicator + "Best so far" inline display, rendered when `attemptsPerRound > 1`.
- `src/game/daily/resume.ts` — `readResume() / writeResume() / clearResume()` for the new `funworldmap-daily-resume` localStorage key.
- `src/game/daily/__tests__/resume.test.ts` — round-trip, stale-date, version mismatch, malformed JSON.
- `src/lib/focusTrap.ts` — `installFocusTrap(rootEl): cleanup` shared util used by Launcher and DailyRevealOverlay.
- `src/lib/__tests__/focusTrap.test.ts` — Tab cycle through three focusables; verify focus does not leave root.
- `src/game/shared/__tests__/bestsKeyMigration.test.ts` — v1 wipe on first read; v2 absent → ZERO; v2 round-trip.
- `e2e/daily-best-of-3.spec.ts` — five end-to-end scenarios for the new daily flow.

### Modified
- `src/game/shared/types.ts` — no shape change; add JSDoc note on the unsupported `attemptsPerRound > 1 && maxRounds === null` combination.
- `src/game/shared/useGameSession.ts` — collapse to action set `start | attempt | completeNow | resume | advance | overrideRound | endGame`. Remove `bestPoints` helper.
- `src/game/shared/GameSessionProvider.tsx` — collapse `submitGuessInput` to one path; drop `recordAttempt`, `submitGuess`, `revealEarly` from the public API.
- `src/game/shared/__tests__/useGameSession.test.ts` — rewrite ~60% of tests to exercise `attempt`/`completeNow`/`resume` instead of `recordAttempt`/`submitGuess`/`revealEarly`.
- `src/game/shared/hud/HudShell.tsx` — new selector matrix; render `AttemptsIndicator` and the Done button when `attemptsPerRound > 1`.
- `src/game/GameController.tsx` — adjust intermediate-reveal effect for green/orange/red feedback; wire resume read/write/clear; gate `record(...)` behind non-daily; emit relocated `daily_started`/`free_started` and the redesigned `deep_link_opened` from the bootstrap; convert pool-mismatch throws to null-handling.
- `src/game/shared/hud/GameOverOverlay.tsx` — hide "Play again" when `parseHash(...).kind === 'daily'`.
- `src/game/shared/hud/FirstSessionTutorial.tsx` — copy variants by `attemptsPerRound`.
- `src/game/modes/country-pinning/messages.ts` — add `wrongDaily` variant without "−1 life".
- `src/game/modes/country-pinning/CountryPinningHud.tsx` — pick `wrong` vs `wrongDaily` on `attemptsPerRound`.
- `src/game/modes/city-guessing/CityGuessingHud.tsx` — render skip button only when `attemptsPerRound === 1`.
- `src/game/daily/dailyRound.ts` — `buildCountryDailyRound` and `buildCityDailyRound` return `RoundSpec | null` instead of throwing.
- `src/game/daily/useDailyHistory.ts` — initializer prunes 90+ days; resume key cleared after `writeHistory` returns inside `record`.
- `src/game/shared/usePersonalBests.ts` — bump key to `funworldmap-game-{mode}-bests-v2`; one-time wipe of v1 on first read.
- `src/components/Launcher.tsx` — replace first/last-only Tab handler with `installFocusTrap`; cascading initial focus; drop `daily_started`/`free_started` track calls.
- `src/components/LauncherModeCard.tsx` — header label derived from `anchorDate === today`.
- `src/components/LauncherCalendarCell.tsx` — local-date construction in `ariaLabel`.
- `src/components/DailyRevealOverlay.tsx` — install focus trap; capture/restore previous focus; drop the `track('deep_link_opened', ...)` call.
- `src/components/DailyShareBlock.tsx` — toast on clipboard catch.
- `src/lib/hashState.ts` — drop `playing` from `HashState.game`; `parseHash` accepts both `game/<m>` and `game/<m>/play` (slices); `writeHash` emits short form.
- `src/hooks/useSelectedCountry.ts` — delete both `track('deep_link_opened', ...)` calls.
- `src/lib/analytics.ts` — `deep_link_opened.outcome` enum: `'start' | 'resume' | 'reveal' | 'redirect'`; `dateKind` drops `'invalid'`.
- `src/App.tsx` — delete the deep-link `track(...)` effect (lines 263-277).
- `src/lib/__tests__/analytics.test.ts` — add cases for new outcome enum, country-link silence, single-fire on `/reveal`.
- `docs/systems/daily-puzzle.md` — resume key shape and lifecycle; routing matrix; outcome enum; `pruneOlderThan` claim now true; remove "always length 3" assertion.
- `docs/systems/overview.md` — new "Game system" subsection.
- `docs/index.md` — "Game" link list under Systems.
- `docs/purpose.md` — fix "Not a comparison tool (yet)" line.

### Deleted
- None. Everything is in-place modification or addition.

---

## Phase 0 — Branch verification

### Task 0: Confirm branch state

**Files:** _(none — git only)_

- [ ] **Step 1: Verify on `game-flow-bugfix` branch with spec already committed**

Run: `git log --oneline -3 && git rev-parse --abbrev-ref HEAD`
Expected: top commit is `docs(spec): game-flow bugfix design …`; branch is `game-flow-bugfix`.

- [ ] **Step 2: Verify clean tree (apart from `docs/design-sketches/`)**

Run: `git status -s`
Expected: only `?? docs/design-sketches/` (an unrelated stash).

---

## Phase 1 — Commit 1: Reducer collapse

This is the load-bearing commit. All later commits depend on the new action set.

### Task 1.1: Rewrite the useGameSession test file (TDD anchor)

**Files:**
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type {
  AttemptRecord,
  CountryRoundSpec,
  GuessInput,
  ModeGuessResult,
  RoundSpec,
} from '../types'

const round = (cca3: string): CountryRoundSpec => ({
  kind: 'country-pinning',
  targetCca3: cca3,
  targetName: cca3,
  targetFlag: `flags/${cca3}.svg`,
  targetCentroid: [0, 0],
})
const countryInput = (cca3: string): GuessInput => ({
  kind: 'country',
  cca3,
  name: cca3,
  centroid: [0, 0],
})
const exact = (cca3: string): ModeGuessResult => ({
  pointsEarned: 100,
  livesDelta: 0,
  reveal: {
    kind: 'country',
    correct: true,
    targetCca3: cca3,
    clickedCca3: cca3,
    clickedName: cca3,
    distanceKm: 0,
  },
})
const miss = (target: string, clicked: string, pts = 20): ModeGuessResult => ({
  pointsEarned: pts,
  livesDelta: -1,
  reveal: {
    kind: 'country',
    correct: false,
    targetCca3: target,
    clickedCca3: clicked,
    clickedName: clicked,
    distanceKm: 1000,
  },
})

describe('useGameSession (post-collapse)', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.maxRounds).toBeNull()
  })

  describe('start', () => {
    it('enters playing with attemptsPerRound default 1', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.attemptsPerRound).toBe(1)
      expect(result.current.session.attemptsRemaining).toBe(1)
    })

    it('accepts attemptsPerRound=3 for daily best-of-N', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      expect(result.current.session.attemptsPerRound).toBe(3)
      expect(result.current.session.attemptsRemaining).toBe(3)
    })

    it('rejects (no-op) the unsupported combo attemptsPerRound>1 + maxRounds=null', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null, 3) })
      expect(result.current.session.status).toBe('idle')
    })
  })

  describe('attempt — free-play (attemptsPerRound=1)', () => {
    it('correct guess ends the round with full points', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.score).toBe(100)
      expect(result.current.session.lives).toBe(3)
      expect(result.current.session.streak).toBe(1)
      expect(result.current.session.lastOutcome?.reveal.kind).toBe('country')
      if (result.current.session.lastOutcome?.reveal.kind === 'country') {
        expect(result.current.session.lastOutcome.reveal.correct).toBe(true)
      }
    })

    it('wrong guess decrements lives and resets streak', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      expect(result.current.session.lives).toBe(2)
      expect(result.current.session.streak).toBe(0)
      expect(result.current.session.score).toBe(20)
    })

    it('lives reaching zero ends the game', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 0)) })
      act(() => { result.current.advance(round('GBR')) })
      act(() => { result.current.attempt(countryInput('ESP'), miss('GBR', 'ESP', 0)) })
      act(() => { result.current.advance(round('ITA')) })
      act(() => { result.current.attempt(countryInput('PRT'), miss('ITA', 'PRT', 0)) })
      expect(result.current.session.status).toBe('game-over')
    })
  })

  describe('attempt — daily best-of-3 (attemptsPerRound=3, maxRounds=1)', () => {
    it('first attempt records but does not end the round', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.attemptsRemaining).toBe(2)
      expect(result.current.session.currentAttempts).toHaveLength(1)
      expect(result.current.session.lastOutcome).toBeNull()
    })

    it('three wrong attempts: lastOutcome.reveal matches the BEST attempt, not the final', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('ESP'), miss('FRA', 'ESP', 50)) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 30)) })
      act(() => { result.current.attempt(countryInput('CHN'), miss('FRA', 'CHN', 5)) })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(50)
      expect(result.current.session.lastOutcome?.pointsEarned).toBe(50)
      // The reveal MUST point at ESP (the best wrong guess), not CHN (the final).
      if (result.current.session.lastOutcome?.reveal.kind === 'country') {
        expect(result.current.session.lastOutcome.reveal.clickedCca3).toBe('ESP')
      }
    })

    it('correct first attempt + two wrong: round ends only after attempt 3, but lastOutcome.reveal is the correct one', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      expect(result.current.session.status).toBe('playing')
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 30)) })
      expect(result.current.session.status).toBe('playing')
      act(() => { result.current.attempt(countryInput('CHN'), miss('FRA', 'CHN', 5)) })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(100)
      if (result.current.session.lastOutcome?.reveal.kind === 'country') {
        expect(result.current.session.lastOutcome.reveal.correct).toBe(true)
        expect(result.current.session.lastOutcome.reveal.clickedCca3).toBe('FRA')
      }
    })

    it('lives are NOT decremented in best-of-N regardless of livesDelta', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('CHN'), miss('FRA', 'CHN', 0)) })
      act(() => { result.current.attempt(countryInput('IND'), miss('FRA', 'IND', 0)) })
      act(() => { result.current.attempt(countryInput('AUS'), miss('FRA', 'AUS', 0)) })
      expect(result.current.session.lives).toBe(3)
    })
  })

  describe('completeNow', () => {
    it('after one attempt: ends the round/game with that attempt as best', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(100)
      expect(result.current.session.currentAttempts).toHaveLength(1)
    })

    it('with no attempts: no-op (status stays playing)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.status).toBe('playing')
    })

    it('in free-play (status already non-playing after attempt): no-op', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.status).toBe('round-ended')
    })
  })

  describe('resume', () => {
    it('reconstructs mid-attempt state from saved attempts', () => {
      const { result } = renderHook(() => useGameSession())
      const priorAttempt: AttemptRecord = {
        pointsEarned: 50,
        input: countryInput('ESP'),
        reveal: {
          kind: 'country',
          correct: false,
          targetCca3: 'FRA',
          clickedCca3: 'ESP',
          clickedName: 'ESP',
          distanceKm: 1000,
        },
      }
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: round('FRA'),
          attemptsPerRound: 3,
          attempts: [priorAttempt],
        })
      })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.attemptsRemaining).toBe(2)
      expect(result.current.session.currentAttempts).toHaveLength(1)
    })

    it('rejects (no-op) when attemptsPerRound <= 1', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: round('FRA'),
          attemptsPerRound: 1,
          attempts: [],
        })
      })
      expect(result.current.session.status).toBe('idle')
    })

    it('rejects (no-op) when attempts already complete', () => {
      const { result } = renderHook(() => useGameSession())
      const a = (cca3: string): AttemptRecord => ({
        pointsEarned: 0,
        input: countryInput(cca3),
        reveal: {
          kind: 'country',
          correct: false,
          targetCca3: 'FRA',
          clickedCca3: cca3,
          clickedName: cca3,
          distanceKm: 1000,
        },
      })
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: round('FRA'),
          attemptsPerRound: 3,
          attempts: [a('CHN'), a('IND'), a('AUS')],
        })
      })
      expect(result.current.session.status).toBe('idle')
    })
  })

  describe('advance', () => {
    it('resets attemptsRemaining to attemptsPerRound', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null, 1) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      act(() => { result.current.advance(round('GBR')) })
      expect(result.current.session.attemptsRemaining).toBe(1)
      expect(result.current.session.currentAttempts).toEqual([])
      expect(result.current.session.lastOutcome).toBeNull()
    })
  })

  describe('endGame', () => {
    it('returns to idle from any playing state', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      act(() => { result.current.endGame() })
      expect(result.current.session.status).toBe('idle')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail with the expected import / API errors**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: All tests fail with errors about missing `attempt`, `completeNow`, `resume` methods.

### Task 1.2: Rewrite the reducer with the new action set

**Files:**
- Modify: `src/game/shared/useGameSession.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { useCallback, useReducer } from 'react'
import type { AttemptRecord, GameSession, GuessInput, ModeGuessResult, ModeId, RoundSpec } from './types'

/**
 * Reducer action set. The collapsed `attempt` action subsumes the old
 * `recordAttempt` / `submitGuess` split. `completeNow` is the user-driven
 * early-end for best-of-N rounds. `resume` rehydrates a daily session from
 * persisted state.
 *
 * Configuration guard: the combination `attemptsPerRound > 1 && maxRounds === null`
 * is structurally unsupported (lives never decrement; endsGame falls through
 * to a permanently-false condition). The `start` action rejects this combo.
 */
type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null; attemptsPerRound: number }
  | { type: 'attempt'; input: GuessInput; result: ModeGuessResult }
  | { type: 'completeNow' }
  | { type: 'resume'; modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[] }
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
  attemptsPerRound: 1,
  attemptsRemaining: 1,
  currentAttempts: [],
  currentRound: null,
  lastOutcome: null,
  used: new Set(),
}

function roundKey(round: RoundSpec): string {
  return round.kind === 'country-pinning' ? round.targetCca3 : round.targetId
}

function deriveBest(attempts: AttemptRecord[]): AttemptRecord {
  return attempts.reduce((best, a) => (a.pointsEarned > best.pointsEarned ? a : best), attempts[0])
}

function endOfRound(state: GameSession, attempts: AttemptRecord[], finalResult: ModeGuessResult | null): GameSession {
  const best = deriveBest(attempts)
  const livesDelta = state.attemptsPerRound === 1 && finalResult ? finalResult.livesDelta : 0
  const nextLives = Math.max(0, state.lives + livesDelta) as GameSession['lives']
  const nextStreak = best.pointsEarned >= 100 ? state.streak + 1 : 0
  const endsGame =
    state.maxRounds !== null
      ? state.roundIndex + 1 >= state.maxRounds
      : nextLives <= 0
  return {
    ...state,
    status: endsGame ? 'game-over' : 'round-ended',
    lives: nextLives,
    score: state.score + best.pointsEarned,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    attemptsRemaining: 0,
    currentAttempts: attempts,
    lastOutcome: {
      pointsEarned: best.pointsEarned,
      livesDelta,
      endsGame,
      reveal: best.reveal,
    },
  }
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
      if (action.attemptsPerRound > 1 && action.maxRounds === null) {
        if (typeof console !== 'undefined') {
          console.error('useGameSession: attemptsPerRound>1 with maxRounds=null is unsupported')
        }
        return state
      }
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: action.maxRounds,
        attemptsPerRound: action.attemptsPerRound,
        attemptsRemaining: action.attemptsPerRound,
        currentRound: action.firstRound,
        used: new Set([roundKey(action.firstRound)]),
      }
    }

    case 'attempt': {
      if (state.status !== 'playing' || !state.currentRound) return state
      if (state.attemptsRemaining <= 0) return state
      const newAttempt: AttemptRecord = {
        pointsEarned: action.result.pointsEarned,
        input: action.input,
        reveal: action.result.reveal,
      }
      const attemptsAfter = [...state.currentAttempts, newAttempt]
      const remaining = state.attemptsRemaining - 1
      const roundEnds = state.attemptsPerRound === 1 || remaining === 0
      if (!roundEnds) {
        return {
          ...state,
          currentAttempts: attemptsAfter,
          attemptsRemaining: remaining,
        }
      }
      return endOfRound(state, attemptsAfter, action.result)
    }

    case 'completeNow': {
      if (state.status !== 'playing') return state
      if (state.attemptsPerRound <= 1) return state
      if (state.currentAttempts.length === 0) return state
      return endOfRound(state, state.currentAttempts, null)
    }

    case 'resume': {
      if (action.attemptsPerRound <= 1) return state
      if (action.attempts.length >= action.attemptsPerRound) return state
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: 1,
        attemptsPerRound: action.attemptsPerRound,
        attemptsRemaining: action.attemptsPerRound - action.attempts.length,
        currentAttempts: action.attempts,
        currentRound: action.round,
        used: new Set([roundKey(action.round)]),
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
        attemptsRemaining: state.attemptsPerRound,
        currentAttempts: [],
        lastOutcome: null,
      }
    }

    case 'overrideRound': {
      if (state.status === 'idle') return state
      const isAdvancing = state.status === 'round-ended'
      return {
        ...state,
        status: 'playing',
        currentRound: action.round,
        used: new Set([...state.used, roundKey(action.round)]),
        roundIndex: isAdvancing ? state.roundIndex + 1 : state.roundIndex,
        attemptsRemaining: state.attemptsPerRound,
        currentAttempts: [],
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
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number) => void
  attempt: (input: GuessInput, result: ModeGuessResult) => void
  completeNow: () => void
  resume: (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[] }) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound = 1) =>
      dispatch({ type: 'start', modeId, firstRound, maxRounds, attemptsPerRound }),
    [],
  )
  const attempt = useCallback(
    (input: GuessInput, result: ModeGuessResult) => dispatch({ type: 'attempt', input, result }),
    [],
  )
  const completeNow = useCallback(() => dispatch({ type: 'completeNow' }), [])
  const resume = useCallback(
    (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[] }) =>
      dispatch({ type: 'resume', ...payload }),
    [],
  )
  const advance = useCallback((nextRound: RoundSpec) => dispatch({ type: 'advance', nextRound }), [])
  const overrideRound = useCallback((round: RoundSpec) => dispatch({ type: 'overrideRound', round }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, attempt, completeNow, resume, advance, overrideRound, endGame }
}
```

- [ ] **Step 2: Run reducer tests to verify they pass**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: All tests pass.

### Task 1.3: Update GameSessionProvider to use the new API

**Files:**
- Modify: `src/game/shared/GameSessionProvider.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useGameSession } from './useGameSession'
import type { AttemptRecord, CityLike, CountryLike, GameMode, GameSession, GuessInput, ModeId, RoundSpec } from './types'
import { getMode } from '../modes'

export type GameSessionApi = {
  session: GameSession
  mode: GameMode | null
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number) => void
  submitGuessInput: (input: GuessInput) => void
  completeNow: () => void
  resume: (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[] }) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const GameSessionContext = createContext<GameSessionApi | null>(null)

interface Props {
  pools: { countries: CountryLike[]; cities: CityLike[] }
  children: ReactNode
}

export function GameSessionProvider({ pools, children }: Props) {
  const { session, start, attempt, completeNow, resume, advance, overrideRound, endGame } = useGameSession()

  const mode = useMemo<GameMode | null>(() => {
    if (session.modeId === 'country-pinning' && pools.countries.length === 0) return null
    if (session.modeId === 'city-guessing' && pools.cities.length === 0) return null
    try {
      return getMode(session.modeId, pools)
    } catch {
      return null
    }
  }, [session.modeId, pools])

  const submitGuessInput = useCallback(
    (input: GuessInput) => {
      if (!mode || session.status !== 'playing' || !session.currentRound) return
      const result = mode.onGuess(input, session.currentRound)
      attempt(input, result)
    },
    [mode, session.status, session.currentRound, attempt],
  )

  const api = useMemo<GameSessionApi>(
    () => ({ session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame }),
    [session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame],
  )

  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    if (!import.meta.env.VITE_TEST_HOOKS) return
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.getSession = () => apiRef.current.session
    w.__funworldmap_game.endGame = () => apiRef.current.endGame()
    w.__funworldmap_game.completeNow = () => apiRef.current.completeNow()
    return () => {
      if (w.__funworldmap_game) {
        delete w.__funworldmap_game.getSession
        delete w.__funworldmap_game.endGame
        delete w.__funworldmap_game.completeNow
      }
    }
  }, [])

  return <GameSessionContext.Provider value={api}>{children}</GameSessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameSessionContext(): GameSessionApi {
  const ctx = useContext(GameSessionContext)
  if (!ctx) throw new Error('useGameSessionContext must be used within <GameSessionProvider>')
  return ctx
}
```

- [ ] **Step 2: Run all unit tests**

Run: `npm run test:unit`
Expected: useGameSession tests pass; some tests in other files may fail because they reference the old API. Note them; we'll fix them in Task 1.4.

### Task 1.4: Fix call sites of the removed API

**Files:**
- Modify: `src/game/GameController.tsx`
- Modify: `src/hooks/__tests__/useLauncherVisibility.test.tsx`

- [ ] **Step 1: Find references to old API names**

Run: `grep -n "submitGuess\|recordAttempt\|revealEarly" src/game/GameController.tsx src/hooks/__tests__/useLauncherVisibility.test.tsx`
Expected: lines that destructure / call / mock the old API.

- [ ] **Step 2: Update GameController destructure (around line 99)**

Find:
```ts
const { session, mode, start, submitGuessInput, advance, overrideRound, endGame } = useGameSessionContext()
```
Replace with:
```ts
const { session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame } = useGameSessionContext()
```

- [ ] **Step 3: Update the GameSessionApi mock in `useLauncherVisibility.test.tsx`**

Find the `makeApi` function (around lines 29-42):
```ts
function makeApi(session: GameSession): GameSessionApi {
  return {
    session,
    mode: null,
    start: () => {},
    submitGuess: () => {},
    submitGuessInput: () => {},
    recordAttempt: () => {},
    revealEarly: () => {},
    advance: () => {},
    overrideRound: () => {},
    endGame: () => {},
  }
}
```
Replace with:
```ts
function makeApi(session: GameSession): GameSessionApi {
  return {
    session,
    mode: null,
    start: () => {},
    submitGuessInput: () => {},
    completeNow: () => {},
    resume: () => {},
    advance: () => {},
    overrideRound: () => {},
    endGame: () => {},
  }
}
```

- [ ] **Step 4: Verify no remaining production refs**

Run: `grep -rn "recordAttempt\|revealEarly" src/`
Expected: no matches outside the new `src/game/shared/__tests__/useGameSession.test.ts` (which only references them in the test name string, if at all — confirm with the test file). The launcher-visibility test mock has been updated.

- [ ] **Step 5: Run full unit suite**

Run: `npm run test:unit`
Expected: All unit tests pass.

### Task 1.5: Build, lint, commit

- [ ] **Step 1: Type-check and lint**

```bash
npm run build && npm run lint
```
Expected: success.

- [ ] **Step 2: Stage and commit**

```bash
git add src/game/shared/useGameSession.ts \
        src/game/shared/GameSessionProvider.tsx \
        src/game/shared/__tests__/useGameSession.test.ts \
        src/game/GameController.tsx \
        src/hooks/__tests__/useLauncherVisibility.test.tsx
git commit -m "$(cat <<'EOF'
refactor(game): collapse recordAttempt and submitGuess into a single attempt action

Resolves the structural seam responsible for findings #1, #2, A, B, C, E.
The new action set is start | attempt | completeNow | resume | advance |
overrideRound | endGame. lastOutcome.reveal now derives from the BEST attempt
in best-of-N rounds, so score and animation always agree. The unsupported
combination attemptsPerRound>1 + maxRounds=null is rejected at start time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Commit 2: Done button + completeNow wiring

### Task 2.1: Render the Done button in HudShell

**Files:**
- Modify: `src/game/shared/hud/HudShell.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import type { ReactNode } from 'react'
import { LivesIndicator } from './LivesIndicator'
import { ScoreBadge } from './ScoreBadge'
import { StreakBadge } from './StreakBadge'
import { RoundCounter } from './RoundCounter'
import { AttemptsIndicator } from './AttemptsIndicator'
import type { GameSession } from '../types'

interface Props {
  session: GameSession
  onEndGame: () => void
  onDone: () => void
  children: ReactNode
}

export function HudShell({ session, onEndGame, onDone, children }: Props) {
  const bestOfN = session.attemptsPerRound > 1
  const fixedRounds = session.maxRounds !== null && session.maxRounds > 1
  const showDone = bestOfN && session.status === 'playing' && session.currentAttempts.length > 0
  return (
    <div
      role="region"
      aria-label="Game HUD"
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[95vw]"
      data-testid="game-hud"
      data-game-status={session.status}
      data-game-mode={session.modeId}
    >
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {bestOfN ? (
            <AttemptsIndicator session={session} />
          ) : fixedRounds ? (
            <RoundCounter
              current={Math.min(session.roundIndex + 1, session.maxRounds!)}
              total={session.maxRounds!}
            />
          ) : (
            <LivesIndicator lives={session.lives} />
          )}
          <div className="flex items-center gap-2">
            <ScoreBadge score={session.score} />
            {bestOfN || fixedRounds ? null : <StreakBadge streak={session.streak} />}
          </div>
          <div className="flex items-center gap-2">
            {showDone && (
              <button
                type="button"
                onClick={onDone}
                className="px-3 py-1.5 rounded-lg bg-teal-accessible text-white text-sm font-semibold hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/50"
                data-testid="game-done"
              >
                Done
              </button>
            )}
            <button
              type="button"
              onClick={onEndGame}
              className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
              data-testid="game-end"
            >
              End game
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire `onDone` from GameController**

In `src/game/GameController.tsx`, find `<HudShell session={session} onEndGame={onEndGame}>` (around line 630). Replace with:
```tsx
<HudShell session={session} onEndGame={onEndGame} onDone={completeNow}>
```

### Task 2.2: Create AttemptsIndicator stub

**Files:**
- Create: `src/game/shared/hud/AttemptsIndicator.tsx`

- [ ] **Step 1: Write the stub (full version lands in Task 3.1)**

```tsx
import type { GameSession } from '../types'

export function AttemptsIndicator({ session }: { session: GameSession }) {
  const used = session.currentAttempts.length
  const total = session.attemptsPerRound
  return (
    <div data-testid="attempts-indicator" className="text-sm text-sand-700 dark:text-dark-100 tabular-nums">
      Attempt {Math.min(used + (session.status === 'playing' ? 1 : 0), total)}/{total}
    </div>
  )
}
```

- [ ] **Step 2: Build to confirm**

Run: `npm run build`
Expected: success.

### Task 2.3: e2e for Done button

**Files:**
- Create: `e2e/daily-best-of-3.spec.ts`

- [ ] **Step 1: Write the scaffold**

```ts
import { test, expect } from '@playwright/test'

test.describe('daily best-of-3', () => {
  test('Done button after one attempt ends the game with that attempt', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.location.hash = `daily/${new Date().toISOString().slice(0, 10)}/country-pinning`
    })
    await page.waitForSelector('[data-testid="game-hud"]')
    await page.evaluate(() => {
      const hooks = (window as unknown as { __funworldmap_game?: { submitCountryGuess?: (cca3: string) => boolean } }).__funworldmap_game
      hooks?.submitCountryGuess?.('FRA')
    })
    await expect(page.getByTestId('game-done')).toBeVisible()
    await page.getByTestId('game-done').click()
    await expect(page.getByTestId('game-over')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the new spec**

Run: `npm run test:e2e -- e2e/daily-best-of-3.spec.ts`
Expected: PASS.

### Task 2.4: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/game/shared/hud/HudShell.tsx \
        src/game/shared/hud/AttemptsIndicator.tsx \
        src/game/GameController.tsx \
        e2e/daily-best-of-3.spec.ts
git commit -m "$(cat <<'EOF'
feat(game): add completeNow action and Done HUD button for best-of-N rounds

The Done button surfaces the previously-orphaned revealEarly behavior under
its new completeNow name. Renders only when attemptsPerRound>1 and at least
one attempt exists. The end-game underline link stays as the abandon-without-
recording exit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Commit 3: Per-attempt color feedback

### Task 3.1: Update intermediate-reveal effect for color signal

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Locate the intermediate-reveal effect**

Currently at `src/game/GameController.tsx:456-499`. Beginning marker comment: `// Intermediate reveal between attempts (daily only)`.

- [ ] **Step 2: Replace the effect body**

```tsx
  // Intermediate reveal between attempts (daily only): correctness-coloured
  // guess highlight + score toast.
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.attemptsPerRound <= 1) return
    if (session.currentAttempts.length === 0) return
    const last = session.currentAttempts[session.currentAttempts.length - 1]
    const map = mapRef.current
    if (!map) return
    const reduced = prefersReducedMotion()
    const holdMs = reduced ? 0 : 600

    if (last.reveal.kind === 'country') {
      const colour = last.reveal.correct ? '#22c55e' : '#f59e0b'
      try {
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], last.reveal.clickedCca3 ?? ''])
        map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
        map.setPaintProperty(LAYER.hoverBorder, 'line-width', 3)
      } catch { /* layer may not exist */ }
      const t = window.setTimeout(() => {
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }, holdMs)
      return () => {
        window.clearTimeout(t)
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }
    }

    // City mode: distance-banded marker color.
    const d = last.reveal.distanceKm
    const colour = d < 50 ? '#22c55e' : d < 500 ? '#f59e0b' : '#ef4444'
    try {
      ensureRevealSources(map)
      const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
      const point = last.reveal.clickedPoint
      if (point) {
        markerSrc.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: point }, properties: { intermediate: true } }],
        })
        try { map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', colour) } catch { /* no-op */ }
      }
    } catch { /* style may still be resolving */ }
    const t = window.setTimeout(() => {
      try {
        clearRevealSources(map)
        map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', '#f59e0b')
      } catch { /* no-op */ }
    }, holdMs)
    return () => {
      window.clearTimeout(t)
      try {
        clearRevealSources(map)
        map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', '#f59e0b')
      } catch { /* no-op */ }
    }
  }, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])
```

- [ ] **Step 3: Replace the AttemptsIndicator stub with the toast-enabled version**

Replace `src/game/shared/hud/AttemptsIndicator.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import type { GameSession } from '../types'

export function AttemptsIndicator({ session }: { session: GameSession }) {
  const used = session.currentAttempts.length
  const total = session.attemptsPerRound
  const last = session.currentAttempts[used - 1]
  const [toast, setToast] = useState<{ pts: number; key: number } | null>(null)
  useEffect(() => {
    if (!last || session.status !== 'playing') return
    setToast({ pts: last.pointsEarned, key: used })
    const t = window.setTimeout(() => setToast(null), 1000)
    return () => window.clearTimeout(t)
  }, [used, last, session.status])

  return (
    <div data-testid="attempts-indicator" className="relative flex items-center gap-2">
      <div className="flex gap-1.5" aria-label={`Attempt ${Math.min(used + (session.status === 'playing' ? 1 : 0), total)} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < used ? 'bg-teal' : 'border border-teal/50'
            }`}
            data-testid={`attempt-pip-${i}`}
          />
        ))}
      </div>
      {toast && (
        <span
          key={toast.key}
          role="status"
          aria-live="polite"
          className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-dark-400/90 text-teal-light text-xs font-semibold whitespace-nowrap"
        >
          +{toast.pts}
        </span>
      )}
    </div>
  )
}
```

### Task 3.2: Build, e2e, commit

- [ ] **Step 1: Build + unit + targeted e2e**

```bash
npm run build && npm run test:unit && npm run test:e2e -- e2e/daily-best-of-3.spec.ts
```
Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add src/game/GameController.tsx src/game/shared/hud/AttemptsIndicator.tsx
git commit -m "$(cat <<'EOF'
feat(game): per-attempt color feedback in daily best-of-3

Country-pinning: green flash for correct, orange for wrong. City-guessing:
green/orange/red bands at <50km / <500km / further. A "+X pts" toast above
the AttemptsIndicator is the secondary channel for color-blind users.
Reduced motion: instant transitions, colors still apply.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Commit 4: Resume persistence

### Task 4.1: Create the resume storage module

**Files:**
- Create: `src/game/daily/resume.ts`

- [ ] **Step 1: Write the file**

```ts
import type { ModeId, AttemptRecord } from '../shared/types'
import { toLocalDateString } from './dates'

export interface DailyResumeV1 {
  version: 1
  date: string             // YYYY-MM-DD
  modeId: ModeId
  attempts: AttemptRecord[]
}

const KEY = 'funworldmap-daily-resume'

export function readResume(): DailyResumeV1 | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DailyResumeV1>
    if (parsed.version !== 1) return null
    if (typeof parsed.date !== 'string') return null
    if (parsed.date !== toLocalDateString(new Date())) {
      try { localStorage.removeItem(KEY) } catch { /* no-op */ }
      return null
    }
    if (parsed.modeId !== 'country-pinning' && parsed.modeId !== 'city-guessing') return null
    if (!Array.isArray(parsed.attempts)) return null
    return parsed as DailyResumeV1
  } catch {
    return null
  }
}

export function writeResume(value: DailyResumeV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* quota / private mode — best-effort */
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* no-op */
  }
}
```

### Task 4.2: Tests for resume storage

**Files:**
- Create: `src/game/daily/__tests__/resume.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { readResume, writeResume, clearResume, type DailyResumeV1 } from '../resume'
import { toLocalDateString } from '../dates'

const today = toLocalDateString(new Date())

const blob = (overrides: Partial<DailyResumeV1> = {}): DailyResumeV1 => ({
  version: 1,
  date: today,
  modeId: 'country-pinning',
  attempts: [],
  ...overrides,
})

describe('daily resume storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a current-day blob', () => {
    writeResume(blob())
    expect(readResume()?.date).toBe(today)
  })

  it('discards stale-date blobs and clears the key', () => {
    localStorage.setItem('funworldmap-daily-resume', JSON.stringify(blob({ date: '2020-01-01' })))
    expect(readResume()).toBeNull()
    expect(localStorage.getItem('funworldmap-daily-resume')).toBeNull()
  })

  it('rejects unknown version', () => {
    localStorage.setItem('funworldmap-daily-resume', JSON.stringify({ ...blob(), version: 99 }))
    expect(readResume()).toBeNull()
  })

  it('rejects malformed JSON', () => {
    localStorage.setItem('funworldmap-daily-resume', '{not json')
    expect(readResume()).toBeNull()
  })

  it('rejects unknown modeId', () => {
    localStorage.setItem('funworldmap-daily-resume', JSON.stringify({ ...blob(), modeId: 'mystery' }))
    expect(readResume()).toBeNull()
  })

  it('clearResume removes the key', () => {
    writeResume(blob())
    clearResume()
    expect(localStorage.getItem('funworldmap-daily-resume')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm run test:unit -- src/game/daily/__tests__/resume.test.ts`
Expected: PASS.

### Task 4.3: Wire resume write effect in GameController

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Add the import**

Add to existing imports near the top:
```tsx
import { readResume, writeResume, clearResume } from './daily/resume'
```

- [ ] **Step 2: Add the write effect** (place after the existing `// Drain deferred start` effect)

```tsx
  // Persist daily best-of-N progress to localStorage so refresh resumes.
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.attemptsPerRound <= 1) return
    if (session.currentAttempts.length === 0) return
    const state = parseHash(window.location.hash)
    if (state.kind !== 'daily' || !state.modeId) return
    writeResume({
      version: 1,
      date: state.date,
      modeId: state.modeId as ModeId,
      attempts: session.currentAttempts,
    })
  }, [session.status, session.attemptsPerRound, session.currentAttempts])
```

### Task 4.4: Wire resume read in hash bootstrap (immediate AND deferred-start paths)

**Files:**
- Modify: `src/game/GameController.tsx`

GameController has two start paths for daily: the immediate hash-bootstrap (when pools are already loaded) and the deferred drain effect (when the user lands on a daily URL before `countries.json` / `cities.json` resolve). Both need the resume read.

- [ ] **Step 1: Update the immediate bootstrap daily branch (currently around lines 113-150)**

Inside `if (state.kind === 'daily' && state.modeId && !state.reveal && statusRef.current === 'idle')`, replace the puzzle/round-build/start sequence with:

```tsx
        const puzzle = dailyPuzzles.byDate(state.date)
        if (!puzzle) return
        const firstRound =
          id === 'country-pinning'
            ? buildCountryDailyRound(puzzle.country.cca3, countries)
            : buildCityDailyRound(puzzle.city.id, cities)
        if (!firstRound) {
          window.dispatchEvent(new CustomEvent('funworldmap:toast', {
            detail: 'Daily content unavailable — try again shortly.',
          }))
          return
        }

        const resumed = readResume()
        if (resumed && resumed.date === state.date && resumed.modeId === id && resumed.attempts.length > 0) {
          resume({ modeId: id, round: firstRound, attemptsPerRound: 3, attempts: resumed.attempts })
          return
        }
        start(id, firstRound, 1, 3)
        return
```

- [ ] **Step 2: Update the deferred drain path (currently around lines 174-196)**

Inside the `useEffect` that drains `pendingStartRef`, the daily branch (currently `if (state.kind === 'daily' && state.modeId && state.date === toLocalDateString(new Date()))`) — replace its body with:

```tsx
      const puzzle = dailyPuzzles.byDate(state.date)
      if (!puzzle) return
      pendingStartRef.current = null
      const firstRound =
        pending === 'country-pinning'
          ? buildCountryDailyRound(puzzle.country.cca3, countries)
          : buildCityDailyRound(puzzle.city.id, cities)
      if (!firstRound) {
        window.dispatchEvent(new CustomEvent('funworldmap:toast', {
          detail: 'Daily content unavailable — try again shortly.',
        }))
        return
      }
      const resumed = readResume()
      if (resumed && resumed.date === state.date && resumed.modeId === pending && resumed.attempts.length > 0) {
        resume({ modeId: pending, round: firstRound, attemptsPerRound: 3, attempts: resumed.attempts })
        return
      }
      start(pending, firstRound, 1, 3)
      return
```

(Telemetry calls for `daily_started` / `deep_link_opened` move here in Phase 8; keep launcher-side fires intact for this commit so behavior is bisect-isolable.)

### Task 4.5: Wire clearResume in the forfeit path

**Files:**
- Modify: `src/game/GameController.tsx`

The success path (after `recordDailyResult`) clears the resume key inside `useDailyHistory.record` itself in Task 9.3 — clearing there is atomic with `writeHistory` so a quota-failed write doesn't orphan a completed day. Task 4.5 only handles the forfeit path here.

- [ ] **Step 1: Clear resume on endGame**

Find:
```ts
const onEndGame = () => { endGame(); writeIdleHash() }
```
Replace with:
```ts
const onEndGame = () => { clearResume(); endGame(); writeIdleHash() }
```

### Task 4.6: e2e — refresh resumes; Escape forfeits

**Files:**
- Modify: `e2e/daily-best-of-3.spec.ts`

- [ ] **Step 1: Append two scenarios**

```ts
test('refresh after one attempt resumes the same round with attempts preserved', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.location.hash = `daily/${new Date().toISOString().slice(0, 10)}/country-pinning`
  })
  await page.waitForSelector('[data-testid="game-hud"]')
  await page.evaluate(() => {
    const hooks = (window as unknown as { __funworldmap_game?: { submitCountryGuess?: (cca3: string) => boolean } }).__funworldmap_game
    hooks?.submitCountryGuess?.('DEU')
  })
  await expect(page.getByTestId('attempt-pip-0')).toBeVisible()
  await page.reload()
  await page.waitForSelector('[data-testid="game-hud"]')
  // Pip 0 should still be filled after reload.
  await expect(page.getByTestId('attempt-pip-0')).toBeVisible()
})

test('Escape forfeits the daily and clears the resume blob', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.location.hash = `daily/${new Date().toISOString().slice(0, 10)}/country-pinning`
  })
  await page.waitForSelector('[data-testid="game-hud"]')
  await page.evaluate(() => {
    const hooks = (window as unknown as { __funworldmap_game?: { submitCountryGuess?: (cca3: string) => boolean } }).__funworldmap_game
    hooks?.submitCountryGuess?.('DEU')
  })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('game-hud')).toBeHidden()
  const resume = await page.evaluate(() => localStorage.getItem('funworldmap-daily-resume'))
  expect(resume).toBeNull()
})
```

- [ ] **Step 2: Run e2e**

Run: `npm run test:e2e -- e2e/daily-best-of-3.spec.ts`
Expected: PASS.

### Task 4.7: Commit

```bash
git add src/game/daily/resume.ts \
        src/game/daily/__tests__/resume.test.ts \
        src/game/GameController.tsx \
        e2e/daily-best-of-3.spec.ts
git commit -m "$(cat <<'EOF'
feat(daily): persist currentAttempts to localStorage and resume on refresh

New funworldmap-daily-resume key (v1, single-day, single-mode). Written on
every attempt during a best-of-N round; cleared after writeHistory returns
on completion or on endGame dispatch on forfeit. Refresh now restores
mid-attempt state. Escape still forfeits but the resume blob is cleared so
the next reload returns to the launcher.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Commit 5: Copy variants + skip gating

### Task 5.1: Country-pinning copy variant for daily

**Files:**
- Modify: `src/game/modes/country-pinning/messages.ts`
- Modify: `src/game/modes/country-pinning/CountryPinningHud.tsx`

- [ ] **Step 1: Replace messages.ts**

```ts
export const MESSAGES = {
  title: 'Country Pinning',
  description: 'Click the country shown at the top. Three wrong countries end the game.',
  prompt: (name: string) => `Pin: ${name}`,
  correct: (points: number, name: string) =>
    `Correct! +${points} points. That was ${name}.`,
  wrong: (points: number, target: string, clicked: string | null) =>
    clicked
      ? `Wrong — that was ${clicked}. +${points} points. The answer was ${target}. −1 life.`
      : `Wrong. +${points} points. The answer was ${target}. −1 life.`,
  wrongDaily: (points: number, target: string, clicked: string | null) =>
    clicked
      ? `Wrong — that was ${clicked}. +${points} points. The answer was ${target}.`
      : `Wrong. +${points} points. The answer was ${target}.`,
  gameOver: (score: number, bestStreak: number) =>
    `Game over. Final score ${score}. Longest streak ${bestStreak}.`,
  livesRemaining: (n: number) =>
    n === 1 ? 'One life remaining.' : `${n} lives remaining.`,
}
```

- [ ] **Step 2: Update CountryPinningHud.tsx revealLine**

Replace the `revealLine` useMemo body with:

```tsx
  const revealLine = useMemo(() => {
    if (session.status !== 'round-ended' || !reveal) return null
    if (reveal.reveal.kind !== 'country') return null
    const r = reveal.reveal
    const targetName = round && round.kind === 'country-pinning' ? round.targetName : r.targetCca3
    if (r.correct) return MESSAGES.correct(reveal.pointsEarned, targetName)
    return session.attemptsPerRound > 1
      ? MESSAGES.wrongDaily(reveal.pointsEarned, targetName, r.clickedName)
      : MESSAGES.wrong(reveal.pointsEarned, targetName, r.clickedName)
  }, [session.status, session.attemptsPerRound, reveal, round])
```

### Task 5.2: Tutorial copy variants

**Files:**
- Modify: `src/game/shared/hud/FirstSessionTutorial.tsx`

- [ ] **Step 1: Replace the COPY constant and props**

```tsx
import { useState, useEffect } from 'react'
import type { ModeId } from '../types'

const KEY_PREFIX = 'funworldmap-game-tutorial-shown-'

const COPY = {
  'country-pinning-free': {
    title: 'How to play',
    body: 'Click the country that matches the flag and name above. Three wrong countries end the game. Ocean clicks don’t count.',
  },
  'country-pinning-daily': {
    title: 'Daily — best of 3',
    body: 'You have 3 attempts. Your highest-scoring guess wins. Press Done when you’re happy with your best so far.',
  },
  'city-guessing-free': {
    title: 'How to play',
    body: 'Click anywhere on the map — including ocean — to guess the city’s location. Ten rounds per game.',
  },
  'city-guessing-daily': {
    title: 'Daily — best of 3',
    body: 'You have 3 attempts to pin the city. Your closest guess wins. Press Done when you’re happy with your best so far.',
  },
} as const

interface Props {
  modeId: ModeId
  attemptsPerRound: number
  firstAttemptMade: boolean
}

export function FirstSessionTutorial({ modeId, attemptsPerRound, firstAttemptMade }: Props) {
  const variant = (attemptsPerRound > 1 ? `${modeId}-daily` : `${modeId}-free`) as keyof typeof COPY
  const [open, setOpen] = useState(false)
  const key = KEY_PREFIX + variant

  useEffect(() => {
    if (sessionStorage.getItem(key)) return
    setOpen(true)
    sessionStorage.setItem(key, '1')
  }, [key])

  useEffect(() => {
    if (firstAttemptMade) setOpen(false)
  }, [firstAttemptMade])

  if (!open) return null
  const copy = COPY[variant]

  return (
    <div
      role="status"
      className="fixed top-40 sm:top-44 left-1/2 -translate-x-1/2 z-[45] max-w-xs px-4 py-3 rounded-2xl bg-dark-400/95 dark:bg-dark-300/95 backdrop-blur-md border border-teal/30 dark:border-teal-light/30 text-teal-light text-sm shadow-2xl pointer-events-none"
      style={{ animation: 'fade-up 300ms ease-out' }}
      data-testid="game-tutorial"
    >
      <p className="font-medium mb-1">{copy.title}</p>
      <p className="text-xs opacity-90">{copy.body}</p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs underline-offset-2 underline hover:no-underline pointer-events-auto"
      >
        Got it
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Pass `attemptsPerRound` from GameController**

Find `<FirstSessionTutorial modeId={session.modeId} firstAttemptMade={...} />` (around line 624) and add the new prop:

```tsx
<FirstSessionTutorial
  modeId={session.modeId}
  attemptsPerRound={session.attemptsPerRound}
  firstAttemptMade={session.currentAttempts.length > 0 || session.lastOutcome !== null}
/>
```

### Task 5.3: Hide skip in best-of-N city

**Files:**
- Modify: `src/game/modes/city-guessing/CityGuessingHud.tsx`

- [ ] **Step 1: Gate the skip button on `attemptsPerRound === 1`**

Find:
```tsx
{session.status === 'playing' && (
  <button
    type="button"
    onClick={onSkip}
```
Replace the conditional with:
```tsx
{session.status === 'playing' && session.attemptsPerRound === 1 && (
  <button
    type="button"
    onClick={onSkip}
```

### Task 5.4: Build, test, commit

```bash
npm run build && npm run test:unit && npm run test:e2e -- e2e/daily-best-of-3.spec.ts
git add src/game/modes/country-pinning/messages.ts \
        src/game/modes/country-pinning/CountryPinningHud.tsx \
        src/game/shared/hud/FirstSessionTutorial.tsx \
        src/game/modes/city-guessing/CityGuessingHud.tsx \
        src/game/GameController.tsx
git commit -m "$(cat <<'EOF'
feat(hud): per-mode copy variants; hide skip in best-of-N city; remove "−1 life" from daily wrong

Country-pinning gains a wrongDaily variant without the lives wording.
Tutorial copy splits four ways (mode × free/daily). Skip is hidden in daily
city-guessing where it would just discard an attempt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Commit 6: Launcher fixes

### Task 6.1: Hide "Play again" on daily game-over

**Files:**
- Modify: `src/game/shared/hud/GameOverOverlay.tsx`

- [ ] **Step 1: Gate the Play-again button**

Find the buttons block and replace:

```tsx
        <div className="flex gap-2">
          {!isDaily && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex-1 px-4 py-2 rounded-xl bg-teal-accessible text-white font-medium hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/50"
              data-testid="game-over-play-again"
            >
              Play again
            </button>
          )}
          <button
            type="button"
            onClick={onBackToMap}
            className="flex-1 px-4 py-2 rounded-xl bg-sand-200 dark:bg-dark-300 text-sand-900 dark:text-dark-50 font-medium hover:bg-sand-300 dark:hover:bg-dark-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
            data-testid="game-over-back"
          >
            Back to map
          </button>
        </div>
```

`isDaily` is already defined at line 21.

### Task 6.2: Card label derived from anchorDate

**Files:**
- Modify: `src/components/LauncherModeCard.tsx`
- Modify: `src/components/Launcher.tsx`

- [ ] **Step 1: Update the Props interface**

Add to `Props`:
```ts
  anchorDate?: string  // 'YYYY-MM-DD'; absent = today
  todayDate: string    // 'YYYY-MM-DD'
```

- [ ] **Step 2: Replace HEADER_LABEL with a function**

Remove the `HEADER_LABEL` const. Add:

```tsx
function headerLabel(modeId: ModeId, anchorDate: string | undefined, today: string): string {
  const isToday = !anchorDate || anchorDate === today
  if (isToday) return modeId === 'country-pinning' ? 'TODAY · COUNTRY' : 'TODAY · CITY'
  const [y, m, d] = anchorDate.split('-').map(Number)
  const local = new Date(y, m - 1, d)
  const md = local.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${md.toUpperCase()} · ${modeId === 'country-pinning' ? 'COUNTRY' : 'CITY'}`
}
```

In the JSX, replace `{HEADER_LABEL[modeId]}` with `{headerLabel(modeId, anchorDate, todayDate)}`.

- [ ] **Step 3: Pass new props from Launcher**

In `src/components/Launcher.tsx`, find `<LauncherModeCard ...>` and add:
```tsx
<LauncherModeCard
  modeId={m.id}
  anchorDate={anchorDate ?? undefined}
  todayDate={today}
  state={cardState(m.id)}
  ...
/>
```

### Task 6.3: Cascading initial focus

**Files:**
- Modify: `src/components/Launcher.tsx`

- [ ] **Step 1: Replace the initial-focus effect (currently lines 150-154)**

```tsx
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const lastModeBtn = root.querySelector<HTMLButtonElement>(
      `[data-testid="launcher-card-${lastMode}-daily-cta"], [data-testid="launcher-card-${lastMode}-free-link"], [data-testid="launcher-card-${lastMode}-see-reveal"]`,
    )
    const firstFocusable = root.querySelector<HTMLButtonElement>('button:not([disabled])')
    const target = lastModeBtn ?? firstFocusable ?? root
    target.focus()
  }, [lastMode])
```

### Task 6.4: Build, test, commit

```bash
npm run build && npm run test:unit && npm run lint
git add src/game/shared/hud/GameOverOverlay.tsx \
        src/components/LauncherModeCard.tsx \
        src/components/Launcher.tsx
git commit -m "$(cat <<'EOF'
fix(launcher): hide Play-again for daily; per-date card label; cascading focus

GameOverOverlay no longer offers Play-again under a daily hash (the previous
behavior silently flipped the session into free-play). LauncherModeCard
header reads "Apr 20 · Country" rather than "TODAY · COUNTRY" when anchored
to a past date. Initial launcher focus cascades through last-mode CTA, first
focusable, and root.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Commit 7: Routing fixes

### Task 7.1: dailyRound returns null on pool miss

**Files:**
- Modify: `src/game/daily/dailyRound.ts`
- Modify: `src/game/daily/__tests__/dailyRound.test.ts`

- [ ] **Step 1: Replace the dailyRound.ts file**

```ts
import type { CountryLike, CityLike, RoundSpec } from '../shared/types'
import { centroidFromLatLng } from '../shared/distance'

export function buildCountryDailyRound(cca3: string, pool: CountryLike[]): RoundSpec | null {
  const c = pool.find((x) => x.cca3 === cca3)
  if (!c) return null
  return {
    kind: 'country-pinning',
    targetCca3: c.cca3,
    targetName: c.name.common,
    targetFlag: c.flag,
    targetCentroid: centroidFromLatLng(c.latlng),
  }
}

export function buildCityDailyRound(id: string, pool: CityLike[]): RoundSpec | null {
  const c = pool.find((x) => x.id === id)
  if (!c) return null
  return {
    kind: 'city-guessing',
    targetId: c.id,
    targetName: c.name,
    targetCountryName: c.countryName,
    targetCountryFlag: c.countryFlag,
    targetCentroid: centroidFromLatLng(c.latlng),
  }
}
```

- [ ] **Step 2: Update the throw-expectations in the test file**

In `src/game/daily/__tests__/dailyRound.test.ts`, replace the two `throws when … is not in the pool` cases:

```ts
  it('returns null when cca3 is not in the pool', () => {
    expect(buildCountryDailyRound('XXX', [FRA])).toBeNull()
  })
```

```ts
  it('returns null when id is not in the pool', () => {
    expect(buildCityDailyRound('nope', [PARIS])).toBeNull()
  })
```

- [ ] **Step 3: Verify both call sites in GameController have the null-handling toast**

Run: `grep -n "buildCountryDailyRound\|buildCityDailyRound" src/game/GameController.tsx`

Each call site must be followed by:
```ts
if (!firstRound) {
  window.dispatchEvent(new CustomEvent('funworldmap:toast', {
    detail: 'Daily content unavailable — try again shortly.',
  }))
  return
}
```

The bootstrap path was updated in Task 4.4. Update the deferred-start path (around lines 174-196) similarly if not already done.

### Task 7.2: Drop the `playing` flag from HashState

**Files:**
- Modify: `src/lib/hashState.ts`
- Modify: `src/components/Launcher.tsx`

- [ ] **Step 1: Replace hashState.ts**

```ts
export type HashState =
  | { kind: 'empty' }
  | { kind: 'country'; cca3: string; compareWith: string | null }
  | { kind: 'game'; modeId: string }
  | { kind: 'daily'; date: string; modeId: string | null; reveal: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_MODE_IDS = new Set(['country-pinning', 'city-guessing'])

export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { kind: 'empty' }

  if (clean === 'daily' || clean === 'daily/') return { kind: 'empty' }
  if (clean.startsWith('daily/')) {
    const parts = clean.slice('daily/'.length).split('/').filter(Boolean)
    const [date, second, third] = parts
    if (!date || !DATE_RE.test(date)) return { kind: 'empty' }
    if (parts.length === 1) return { kind: 'daily', date, modeId: null, reveal: false }
    if (parts.length === 2) {
      if (second === 'reveal') return { kind: 'daily', date, modeId: null, reveal: true }
      if (KNOWN_MODE_IDS.has(second)) return { kind: 'daily', date, modeId: second, reveal: false }
      return { kind: 'empty' }
    }
    if (parts.length === 3) {
      if (KNOWN_MODE_IDS.has(second) && third === 'reveal') {
        return { kind: 'daily', date, modeId: second, reveal: true }
      }
      return { kind: 'empty' }
    }
    return { kind: 'empty' }
  }

  if (clean.startsWith('game/')) {
    const rest = clean.slice('game/'.length)
    if (!rest) return { kind: 'empty' }
    const modeId = rest.endsWith('/play') ? rest.slice(0, -'/play'.length) : rest
    return { kind: 'game', modeId }
  }

  const parts = clean.split(',').map((s) => s.trim().toUpperCase())
  const cca3 = parts[0] || ''
  if (!cca3) return { kind: 'empty' }
  const compareWith = parts[1] || null
  return { kind: 'country', cca3, compareWith }
}

export function writeHash(state: HashState): string {
  switch (state.kind) {
    case 'empty':
      return ''
    case 'country':
      return state.compareWith ? `${state.cca3},${state.compareWith}` : state.cca3
    case 'game':
      return `game/${state.modeId}`
    case 'daily': {
      let out = `daily/${state.date}`
      if (state.modeId) out += `/${state.modeId}`
      if (state.reveal) out += '/reveal'
      return out
    }
  }
}
```

- [ ] **Step 2: Update Launcher's startFree**

In `src/components/Launcher.tsx`, find:
```ts
window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
```
Replace with:
```ts
window.location.hash = writeHash({ kind: 'game', modeId: id })
```

- [ ] **Step 3: Verify no other callers**

Run: `grep -rn "playing:" src/`
Expected: only test-file matches. Any other production reference must be removed.

### Task 7.3: Build, test, commit

```bash
npm run build && npm run test:unit && npm run lint
git add src/game/daily/dailyRound.ts src/lib/hashState.ts src/components/Launcher.tsx src/game/GameController.tsx
git commit -m "$(cat <<'EOF'
fix(routing): null-return on pool-mismatch; drop dead playing flag

dailyRound functions no longer throw on pool drift — callers receive null
and surface a toast. The hashState.game.playing flag is removed; parseHash
accepts both #game/<m> and #game/<m>/play (forward-compat) and writeHash
emits the short form.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 — Commit 8: Telemetry redesign

### Task 8.1: Update analytics.ts schema

**Files:**
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: Replace the `deep_link_opened` schema entry**

Find:
```ts
deep_link_opened: {
  dateKind: 'today' | 'past' | 'future' | 'invalid'
  outcome: 'played' | 'reveal' | 'redirect'
}
```
Replace with:
```ts
deep_link_opened: {
  dateKind: 'today' | 'past' | 'future'
  outcome: 'start' | 'resume' | 'reveal' | 'redirect'
}
```

### Task 8.2: Delete deep-link fires from App.tsx and DailyRevealOverlay

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/DailyRevealOverlay.tsx`

- [ ] **Step 1: Delete the `useEffect` block in App.tsx (lines 263-277)**

Remove the entire `useEffect(() => { const fireIfDaily = …; window.addEventListener('hashchange', fireIfDaily); … })` block. Also remove the now-unused imports `track` and `toLocalDateString` if they have no other use.

- [ ] **Step 2: Delete the deep-link fire in DailyRevealOverlay**

Remove:
```ts
useEffect(() => {
  track('deep_link_opened', { dateKind: dateKindOf(date), outcome: 'reveal' })
}, [date])
```

Remove `dateKindOf` and `track` imports if unused.

### Task 8.3: Single fire-point in GameController bootstrap

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Add reveal-route emit at the top of the bootstrap check**

Inside the `check()` function in the hash-bootstrap effect, add early:

```ts
if (state.kind === 'daily' && state.reveal) {
  const todayStr = toLocalDateString(new Date())
  const dateKind: 'today' | 'past' | 'future' =
    state.date === todayStr ? 'today' : state.date < todayStr ? 'past' : 'future'
  track('deep_link_opened', { dateKind, outcome: 'reveal' })
  return
}
```

- [ ] **Step 2: Emit `redirect` outcome on the future-date branch**

Inside `if (state.date > todayStr)` (around line 124-128):
```ts
track('deep_link_opened', { dateKind: 'future', outcome: 'redirect' })
history.replaceState(null, '', window.location.pathname)
window.dispatchEvent(new HashChangeEvent('hashchange'))
return
```

- [ ] **Step 3: Emit `redirect` on the already-played / past-date branch**

Inside `if (state.date < todayStr || alreadyPlayed)` (around line 132-135):
```ts
const dateKind: 'today' | 'past' = state.date < todayStr ? 'past' : 'today'
track('deep_link_opened', { dateKind, outcome: 'redirect' })
window.location.hash = `daily/${state.date}/${id}/reveal`
return
```

- [ ] **Step 4: Emit `start` and `resume` on the play-fresh branch**

Modify the segment from Task 4.4 to include telemetry:

```ts
const resumed = readResume()
if (resumed && resumed.date === state.date && resumed.modeId === id && resumed.attempts.length > 0) {
  resume({ modeId: id, round: firstRound, attemptsPerRound: 3, attempts: resumed.attempts })
  track('deep_link_opened', { dateKind: 'today', outcome: 'resume' })
  track('daily_started', { mode: id })
  return
}
start(id, firstRound, 1, 3)
track('deep_link_opened', { dateKind: 'today', outcome: 'start' })
track('daily_started', { mode: id })
return
```

### Task 8.4: Move `free_started` to the bootstrap

**Files:**
- Modify: `src/game/GameController.tsx`
- Modify: `src/components/Launcher.tsx`

- [ ] **Step 1: Add the fire in the `kind === 'game'` bootstrap branch**

In `GameController.tsx`, in the `kind === 'game'` branch (currently around line 151-162), after `start(id, firstRound, m.maxRounds)`:

```ts
track('free_started', { mode: id })
```

- [ ] **Step 2: Remove launcher-side `daily_started` and `free_started`**

In `src/components/Launcher.tsx`, find `startDaily` (line 96-105) and `startFree` (line 107-116). Delete the `track('daily_started', ...)` and `track('free_started', ...)` lines from each. Remove the `track` import if it has no other use in the file.

### Task 8.5: Delete deep-link fires from useSelectedCountry

**Files:**
- Modify: `src/hooks/useSelectedCountry.ts`

- [ ] **Step 1: Remove both `track('deep_link_opened', ...)` calls**

Remove the two calls (lines 33 and 41). Remove the `track` import if it becomes unused.

### Task 8.6: Telemetry tests

**Files:**
- Modify: `src/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Add cases for the new outcome enum**

Append (using the existing test setup pattern in the file):

```ts
  it('emits deep_link_opened with all four outcome values', () => {
    track('deep_link_opened', { dateKind: 'today', outcome: 'start' })
    track('deep_link_opened', { dateKind: 'today', outcome: 'resume' })
    track('deep_link_opened', { dateKind: 'past', outcome: 'reveal' })
    track('deep_link_opened', { dateKind: 'future', outcome: 'redirect' })
    const outcomes = ((window as unknown as { __testAnalytics?: Array<{ name: string; props: { outcome?: string } }> }).__testAnalytics ?? [])
      .filter((e) => e.name === 'deep_link_opened')
      .map((e) => e.props.outcome)
    expect(outcomes).toEqual(['start', 'resume', 'reveal', 'redirect'])
  })
```

- [ ] **Step 2: Run analytics tests**

Run: `npm run test:unit -- src/lib/__tests__/analytics.test.ts`
Expected: PASS.

### Task 8.7: Build, test, commit

```bash
npm run build && npm run test:unit && npm run lint
git add src/lib/analytics.ts \
        src/App.tsx \
        src/components/DailyRevealOverlay.tsx \
        src/game/GameController.tsx \
        src/components/Launcher.tsx \
        src/hooks/useSelectedCountry.ts \
        src/lib/__tests__/analytics.test.ts
git commit -m "$(cat <<'EOF'
chore(telemetry): redesign deep_link_opened; relocate started events; drop country-link fires

deep_link_opened.outcome enum: start | resume | reveal | redirect (was:
played | reveal | redirect; played was undocumented). Single fire-point in
GameController hash bootstrap; the App.tsx and DailyRevealOverlay duplicates
are deleted. daily_started / free_started are emitted by the bootstrap
rather than the launcher. dateKind:'invalid' removed (unreachable). Country
deep-link fires from useSelectedCountry are deleted entirely.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9 — Commit 9: Storage hygiene

### Task 9.1: Bump bests key to v2

**Files:**
- Modify: `src/game/shared/usePersonalBests.ts`

- [ ] **Step 1: Replace the file**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonalBest } from './types'

const ZERO: PersonalBest = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

function keyFor(modeId: string): string {
  return `funworldmap-game-${modeId}-bests-v2`
}

function legacyKeyFor(modeId: string): string {
  return `funworldmap-game-${modeId}-bests`
}

function readSafely(modeId: string): PersonalBest {
  // One-time cleanup of v1 (polluted by daily plays). Idempotent.
  try { localStorage.removeItem(legacyKeyFor(modeId)) } catch { /* no-op */ }
  try {
    const raw = localStorage.getItem(keyFor(modeId))
    if (!raw) return ZERO
    const parsed = JSON.parse(raw)
    return {
      bestScore: Number(parsed?.bestScore) || 0,
      bestStreak: Number(parsed?.bestStreak) || 0,
      gamesPlayed: Number(parsed?.gamesPlayed) || 0,
    }
  } catch {
    return ZERO
  }
}

function writeSafely(modeId: string, value: PersonalBest): void {
  try {
    localStorage.setItem(keyFor(modeId), JSON.stringify(value))
  } catch {
    /* quota or private-mode; in-memory only */
  }
}

export function usePersonalBests(modeId: string): {
  best: PersonalBest
  record: (score: number, streak: number) => PersonalBest
} {
  const [best, setBest] = useState<PersonalBest>(() => readSafely(modeId))
  const bestRef = useRef(best)
  bestRef.current = best

  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === keyFor(modeId)) setBest(readSafely(modeId))
    }
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [modeId])

  const record = useCallback(
    (score: number, streak: number): PersonalBest => {
      const prev = bestRef.current
      const next: PersonalBest = {
        bestScore: Math.max(prev.bestScore, score),
        bestStreak: Math.max(prev.bestStreak, streak),
        gamesPlayed: prev.gamesPlayed + 1,
      }
      setBest(next)
      writeSafely(modeId, next)
      return next
    },
    [modeId],
  )

  return { best, record }
}
```

### Task 9.2: Migration tests

**Files:**
- Create: `src/game/shared/__tests__/bestsKeyMigration.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersonalBests } from '../usePersonalBests'

describe('usePersonalBests v1→v2 migration', () => {
  beforeEach(() => { localStorage.clear() })

  it('removes v1 key and returns ZERO when v2 is absent', () => {
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests',
      JSON.stringify({ bestScore: 999, bestStreak: 99, gamesPlayed: 9 }),
    )
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
    expect(localStorage.getItem('funworldmap-game-country-pinning-bests')).toBeNull()
  })

  it('reads v2 on subsequent loads', () => {
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests-v2',
      JSON.stringify({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 }),
    )
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 })
  })

  it('record() writes to v2', () => {
    const { result } = renderHook(() => usePersonalBests('city-guessing'))
    act(() => { result.current.record(700, 4) })
    const v2 = JSON.parse(localStorage.getItem('funworldmap-game-city-guessing-bests-v2') ?? 'null')
    expect(v2.bestScore).toBe(700)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm run test:unit -- src/game/shared/__tests__/bestsKeyMigration.test.ts`
Expected: PASS.

### Task 9.3: Wire pruneOlderThan and gate daily leak

**Files:**
- Modify: `src/game/daily/useDailyHistory.ts`
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Update useDailyHistory.ts initializer to prune**

Replace the `useState` line:
```ts
const [history, setHistory] = useState<DailyHistoryV1>(() => readHistory())
```
with:
```ts
const [history, setHistory] = useState<DailyHistoryV1>(() => {
  const raw = readHistory()
  const pruned = pruneOlderThan(raw, 90)
  if (pruned !== raw) writeHistory(pruned)
  return pruned
})
```

Add `pruneOlderThan` to the import from `./storage`.

- [ ] **Step 2: Clear resume after writeHistory in `record`**

Replace the existing `record` callback in `useDailyHistory.ts`:

```ts
const record = useCallback(
  (date: string, modeId: ModeId, result: DailyDayResult) => {
    setHistory((prev) => {
      const merged = mergeDay(prev, date, modeId, result)
      const streaked = updateStreak(merged, date)
      writeHistory(streaked)
      // Clear resume only after writeHistory returns — a quota-failed write
      // must not orphan a completed day with no record.
      try { localStorage.removeItem('funworldmap-daily-resume') } catch { /* no-op */ }
      return streaked
    })
  },
  [],
)
```

- [ ] **Step 3: Gate `record(...)` on non-daily in GameController**

Find the game-over branch around line 281-283:
```ts
if (session.status === 'game-over' && !recordedRef.current) {
  recordedRef.current = true
  record(session.score, session.bestStreak)
```
Replace with:
```ts
if (session.status === 'game-over' && !recordedRef.current) {
  recordedRef.current = true
  const isDaily = parseHash(window.location.hash).kind === 'daily'
  if (!isDaily) record(session.score, session.bestStreak)
```

### Task 9.4: Build, test, commit

```bash
npm run build && npm run test:unit && npm run lint
git add src/game/shared/usePersonalBests.ts \
        src/game/shared/__tests__/bestsKeyMigration.test.ts \
        src/game/daily/useDailyHistory.ts \
        src/game/GameController.tsx
git commit -m "$(cat <<'EOF'
chore(storage): bump game-bests v1→v2; wipe v1 on first load; wire pruneOlderThan; gate daily leak

The funworldmap-game-{mode}-bests key is bumped to -v2; v1 is removed once
on first read (idempotent). Daily plays no longer call record() so the v2
store stays free-play-only. pruneOlderThan(history, 90) runs in
useDailyHistory's initializer, bringing the doc claim into agreement with
behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 10 — Commit 10: Accessibility

### Task 10.1: Shared focus-trap util

**Files:**
- Create: `src/lib/focusTrap.ts`

- [ ] **Step 1: Write the file**

```ts
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function installFocusTrap(rootEl: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusables = Array.from(rootEl.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (!active || !rootEl.contains(active)) {
      e.preventDefault()
      first.focus()
      return
    }
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
  rootEl.addEventListener('keydown', onKey)
  return () => rootEl.removeEventListener('keydown', onKey)
}
```

### Task 10.2: focusTrap test (DOM-built fixtures, no innerHTML)

**Files:**
- Create: `src/lib/__tests__/focusTrap.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { installFocusTrap } from '../focusTrap'

afterEach(() => {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
})

function buildRoot(ids: string[]): HTMLDivElement {
  const root = document.createElement('div')
  root.id = 'root'
  for (const id of ids) {
    const btn = document.createElement('button')
    btn.id = id
    btn.textContent = id.toUpperCase()
    root.appendChild(btn)
  }
  document.body.appendChild(root)
  return root
}

function dispatchTab(target: HTMLElement, shift = false) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true }))
}

describe('installFocusTrap', () => {
  it('cycles forward from last to first', () => {
    const root = buildRoot(['a', 'b', 'c'])
    installFocusTrap(root)
    ;(document.getElementById('c') as HTMLButtonElement).focus()
    dispatchTab(root)
    expect(document.activeElement?.id).toBe('a')
  })

  it('cycles backward from first to last on shift+tab', () => {
    const root = buildRoot(['a', 'b'])
    installFocusTrap(root)
    ;(document.getElementById('a') as HTMLButtonElement).focus()
    dispatchTab(root, true)
    expect(document.activeElement?.id).toBe('b')
  })

  it('redirects external focus back into the trap', () => {
    const outside = document.createElement('button')
    outside.id = 'outside'
    outside.textContent = 'Outside'
    document.body.appendChild(outside)
    const root = buildRoot(['a', 'b'])
    installFocusTrap(root)
    outside.focus()
    dispatchTab(root)
    expect(document.activeElement?.id).toBe('a')
  })

  it('cleanup function removes the listener', () => {
    const root = buildRoot(['a', 'b'])
    const cleanup = installFocusTrap(root)
    cleanup()
    ;(document.getElementById('a') as HTMLButtonElement).focus()
    dispatchTab(root)
    // Listener removed; jsdom doesn't fire native Tab default, so focus stays.
    expect(document.activeElement?.id).toBe('a')
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npm run test:unit -- src/lib/__tests__/focusTrap.test.ts`
Expected: PASS.

### Task 10.3: Wire focus trap into Launcher and DailyRevealOverlay

**Files:**
- Modify: `src/components/Launcher.tsx`
- Modify: `src/components/DailyRevealOverlay.tsx`

- [ ] **Step 1: Replace Launcher's keydown effect**

Add the import:
```tsx
import { installFocusTrap } from '../lib/focusTrap'
```

Replace the existing Tab-handler `useEffect` (currently lines 156-179) with:

```tsx
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cleanup = installFocusTrap(root)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && historyOpen) {
        e.preventDefault()
        e.stopPropagation()
        setHistoryOpen(false)
      }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      cleanup()
      root.removeEventListener('keydown', onKey)
    }
  }, [historyOpen])
```

- [ ] **Step 2: Install trap and manage focus in DailyRevealOverlay**

Add at the top:
```tsx
import { useEffect, useRef } from 'react'
import { installFocusTrap } from '../lib/focusTrap'
```

Inside the component (replace the existing escape-key effect):

```tsx
  const rootRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const root = rootRef.current
    if (!root) return
    const close = root.querySelector<HTMLButtonElement>('[data-testid="daily-reveal-close"]')
    close?.focus()
    const cleanup = installFocusTrap(root)
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => {
      cleanup()
      window.removeEventListener('keydown', onEsc)
      const prev = previousFocusRef.current
      if (prev && document.body.contains(prev) && typeof prev.focus === 'function') {
        prev.focus()
      }
    }
  }, [onClose])
```

Add `ref={rootRef}` to the outermost `<div role="dialog" …>`.

### Task 10.4: Calendar local-date label

**Files:**
- Modify: `src/components/LauncherCalendarCell.tsx`

- [ ] **Step 1: Replace the `ariaLabel` helper**

```ts
function ariaLabel(date: string, status: CalendarCellStatus, played: ReadonlySet<ModeId>): string {
  const [y, m, d] = date.split('-').map(Number)
  const local = new Date(y, m - 1, d)
  const parts: string[] = [local.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })]
  if (status === 'today') parts.push('today')
  if (played.has('country-pinning')) parts.push('played country pinning')
  if (played.has('city-guessing')) parts.push('played city guessing')
  if (status === 'rolled-off') parts.push('not available')
  return parts.join(', ')
}
```

### Task 10.5: Share clipboard toast on failure

**Files:**
- Modify: `src/components/DailyShareBlock.tsx`

- [ ] **Step 1: Replace silent catches with toasts**

Replace `handlePrimary` and `handleCopyLink`:

```tsx
const handlePrimary = useCallback(async () => {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'funworldmap daily', text, url })
      track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'share-api' })
      return
    } catch (err) {
      const name = (err as { name?: string }).name
      if (name === 'AbortError') return
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    dispatchToast('Copied!')
    track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-text' })
  } catch {
    dispatchToast("Couldn't copy — select and copy manually.")
  }
}, [date, text, url, modesPlayed])

const handleCopyLink = useCallback(async () => {
  try {
    await navigator.clipboard.writeText(url)
    dispatchToast('Link copied')
    track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-link' })
  } catch {
    dispatchToast("Couldn't copy — select and copy manually.")
  }
}, [date, url, modesPlayed])
```

### Task 10.6: Build, test, commit

```bash
npm run build && npm run test:unit && npm run lint
git add src/lib/focusTrap.ts \
        src/lib/__tests__/focusTrap.test.ts \
        src/components/Launcher.tsx \
        src/components/DailyRevealOverlay.tsx \
        src/components/LauncherCalendarCell.tsx \
        src/components/DailyShareBlock.tsx
git commit -m "$(cat <<'EOF'
fix(a11y): shared focus-trap util; calendar local-date label; share clipboard toast

Launcher and DailyRevealOverlay both install installFocusTrap on their
modal root. Calendar cell aria-label parses YYYY-MM-DD as local-date parts
to avoid the UTC-midnight off-by-one. Silent share clipboard failures now
surface a toast.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 11 — Commit 11: Documentation

### Task 11.1: Update daily-puzzle.md

**Files:**
- Modify: `docs/systems/daily-puzzle.md`

- [ ] **Step 1: Strike the "always length 3" claim**

Find the storage paragraph (around line 47) and replace its sentence:

> `DailyDayResult.attempts[]` has length 1, 2, or 3 — depending on whether the player pressed Done early or used all attempts.

- [ ] **Step 2: Add a Resume key subsection after Storage shape**

```markdown
### Resume key

`localStorage` key `funworldmap-daily-resume` (v1) holds in-progress best-of-N
attempts so a refresh restores the same round.

Shape:

\`\`\`ts
{ version: 1, date: 'YYYY-MM-DD', modeId: ModeId, attempts: AttemptRecord[] }
\`\`\`

Lifecycle:
- *Write:* on every `attempt` action while `status === 'playing'` and
  `attemptsPerRound > 1`.
- *Read:* on hash bootstrap when route is `daily/<date>/<mode>` and the
  history has no entry for that day.
- *Clear:* after `writeHistory` returns successfully on completion; on
  `endGame` dispatch (Escape, End-game button); on stale-date mismatch.
```

(Replace `\`\`\`` with actual triple-backticks when editing.)

- [ ] **Step 3: Update the Routing matrix row for `/#daily/YYYY-MM-DD/<mode>`**

```
| `/#daily/YYYY-MM-DD/<mode>` | Today + unplayed → start daily; today + in-progress resume blob → resume; past or already-played → redirect to `.../reveal`; future → redirect to root. |
```

- [ ] **Step 4: Update the telemetry table**

The `outcome` enum values are now `start | resume | reveal | redirect`. The `dateKind` enum drops `'invalid'`.

### Task 11.2: Add Game system subsection to overview.md

**Files:**
- Modify: `docs/systems/overview.md`

- [ ] **Step 1: Append the subsection**

```markdown
## Game system

The game runs on a single `useGameSession` reducer with a small action set
(`start | attempt | completeNow | resume | advance | overrideRound | endGame`).
Best-of-N rounds (daily mode) are supported via `attemptsPerRound > 1`; the
reducer derives the round-end outcome from the best of all attempts so score
and reveal animation always agree. Modes plug in via the `GameMode` contract
(`src/game/modes/{country-pinning,city-guessing}/index.tsx`); the daily layer
adds session resume (`src/game/daily/resume.ts`) and history persistence
(`src/game/daily/storage.ts`).

Key files:
- `src/game/shared/useGameSession.ts` — reducer
- `src/game/shared/GameSessionProvider.tsx` — context API + computed mode
- `src/game/GameController.tsx` — hash bootstrap, reveal effects, telemetry
- `src/game/daily/` — daily-specific puzzle, history, resume, share
```

### Task 11.3: Add Game link list to docs/index.md

**Files:**
- Modify: `docs/index.md`

- [ ] **Step 1: Add a "Game" subsection under "### Systems"**

```markdown
### Game
- [Game System Overview](systems/overview.md#game-system) — reducer model, modes, daily layer
- [Daily Puzzle](systems/daily-puzzle.md) — content generation, storage, telemetry
```

### Task 11.4: Fix purpose.md compare line

**Files:**
- Modify: `docs/purpose.md`

- [ ] **Step 1: Remove the stale comparison line**

In the "What It Is Not" list (around line 51), find:
```
- Not a comparison tool — no side-by-side country comparisons (yet)
```
Delete the entire line. The list still contains "Not a historical atlas — shows current political boundaries only" and other valid items.

### Task 11.5: Final build, full e2e, commit

- [ ] **Step 1: Run the full suite**

```bash
npm run build && npm run test:unit && npm run lint && npm run test:e2e
```
Expected: all pass.

- [ ] **Step 2: Commit**

```bash
git add docs/systems/daily-puzzle.md \
        docs/systems/overview.md \
        docs/index.md \
        docs/purpose.md
git commit -m "$(cat <<'EOF'
docs: update daily-puzzle.md, overview.md, index.md, purpose.md

daily-puzzle.md: document the resume key and the new outcome enum; correct
the "always length 3" claim. overview.md: new Game system subsection.
index.md: link the game system docs from the canonical index. purpose.md:
remove the stale "Not a comparison tool" claim.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 12 — Final verification + PR

### Task 12.1: Pre-PR sanity

- [ ] **Step 1: Verify commit count and order**

Run: `git log --oneline main..HEAD`
Expected: 12 commits (1 spec + 11 implementation), in load-bearing order.

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all green.

- [ ] **Step 3: Verify no production references to the removed API**

Run:
```bash
grep -rn "recordAttempt\|revealEarly" src/ | grep -v __tests__
```
Expected: no matches.

- [ ] **Step 4: Visual smoke test**

Start the dev server (`npm run dev`), play through:
- **Free-play country**: 3 wrong → game over with Play-again button visible.
- **Free-play city**: 10 rounds → game over with Play-again visible.
- **Daily best-of-3 country**: one correct + Done → game over with Play-again HIDDEN; share block visible.
- **Daily best-of-3 city**: three guesses with the third farthest → game over showing the closest-distance arc, not the third's.
- **Daily best-of-3**: one attempt + browser refresh → game resumes with the attempt preserved (pip 0 filled).

If any behaves wrong, fix forward (no amend).

### Task 12.2: Push and open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin game-flow-bugfix
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "Game flow bugfix — reducer collapse, daily resume, telemetry/a11y cleanup" --body "$(cat <<'EOF'
## Summary
- Collapses the recordAttempt/submitGuess reducer split into a single attempt action; lastOutcome.reveal now derives from the BEST attempt in best-of-N, eliminating the score-vs-animation mismatch.
- Persists in-progress daily attempts to a new funworldmap-daily-resume key so refresh resumes mid-attempt instead of forfeiting.
- Redesigns deep_link_opened telemetry: single fire-point, four-value outcome enum (start | resume | reveal | redirect), country deep links no longer pollute the daily funnel.
- Cleans up a long tail of copy ("−1 life" in daily), routing (dead playing flag, throwing pool builders), a11y (focus traps, calendar UTC parse, silent clipboard failure), and four documentation drift points.

Spec: docs/superpowers/specs/2026-04-26-game-flow-bugfix-design.md

## Test plan
- [ ] Free-play country: 3 wrong ends the game; Play-again works.
- [ ] Free-play city: 10 rounds ends the game; Play-again works.
- [ ] Daily best-of-3 country: correct + Done; Play-again hidden; share visible.
- [ ] Daily best-of-3 country: three wrongs; lastOutcome arc points at best wrong, not final.
- [ ] Daily best-of-3 city: refresh mid-attempt resumes the same round.
- [ ] Daily best-of-3: Escape clears the resume blob (forfeit).
- [ ] Telemetry: opening #daily/<today>/reveal fires exactly one deep_link_opened (outcome:'reveal').
- [ ] localStorage: funworldmap-game-{mode}-bests v1 is removed on first load.
- [ ] A11y: tab cycle stays within Launcher and DailyRevealOverlay.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Print PR URL** (output of `gh pr create`).

---

## Spec coverage self-check

After execution, verify each spec section has a corresponding task:

- [ ] **§1.1 Reducer collapse** → Tasks 1.1–1.5
- [ ] **§1.2 HUD changes** → Tasks 2.1, 3.1, 5.3
- [ ] **§1.3 Copy** → Tasks 5.1, 5.2
- [ ] **§1.4 Persistence** → Tasks 4.1–4.5, 9.1–9.3
- [ ] **§2.1 Routing** → Tasks 6.1, 7.1, 7.2
- [ ] **§2.2 Telemetry** → Tasks 8.1–8.7
- [ ] **§2.3 A11y** → Tasks 6.3, 10.1–10.4
- [ ] **§2.4 Share + skip** → Tasks 5.3, 10.5
- [ ] **§3.1 Doc updates** → Tasks 11.1–11.4
- [ ] **§3.2 No ADR** → covered by the comment block in Task 1.2 (file-top JSDoc) and Task 11.2 (overview subsection)
- [ ] **§3.3 Testing** → Tasks 1.1, 4.2, 8.6, 9.2, 10.2, plus e2e in 2.3 and 4.6
- [ ] **§3.4 Rollout** → manual; reflected in PR description (Task 12.2)

Any gaps surfaced during execution: open a follow-up commit on the same branch.
