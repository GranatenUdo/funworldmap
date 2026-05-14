# GameController Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 833-line `src/game/GameController.tsx` into five focused custom hooks, in five sequenced PRs from safest to riskiest, each protected by a characterization unit-test net so the reducer-untouched controller behaviour is provably preserved end-to-end.

**Architecture:** Each phase extracts one logical concern into a dedicated hook under a new `src/game/hooks/` directory. The reducer in `src/game/shared/useGameSession.ts` (44 unit tests, the global regression net) is untouched throughout. Before extracting each hook, the phase adds a characterization unit test that locks in the pre-existing controller behaviour; after extracting, the same test re-runs against the new hook to prove behavioural equivalence. The 9 `useRef` mirrors of reducer state get re-homed (not eliminated) — the ref-mirror code smell is real, but solving it is out of scope for this extraction (see "What's NOT in this plan").

**Tech Stack:** React 19, TypeScript 5, Vitest + `@testing-library/react` (`renderHook`), Playwright e2e as a second-line regression net, existing `__funworldmap_game` test seam, MapLibre GL JS 5.x (mocked via `mapRef` stub in unit tests).

---

## Scope check — why one plan with 5 phases (not 5 plans)

The five extractions share **state ownership** (all five read from `useGameSessionContext()`'s `session` and dispatchers) and **a single physical file** as their source-of-truth. Splitting them into 5 separate plans would force each plan to re-establish:

- the same characterization-test methodology (one shared section below),
- the same file-map decisions (new directory `src/game/hooks/`, naming convention, public-API shape),
- the same deferral list (mode-name de-branching, restart-action redesign, etc.),

and would lose the **safest-first ordering rationale** which only makes sense as one document. The phases themselves are independent units of work — each phase produces one PR that lands on `main`. Reverting a single phase doesn't cascade because GameController.tsx imports each hook by name; if `useRevealMapEffects` ships and breaks, reverting just its PR restores the inlined effect. **One plan, five PRs, one shared methodology.**

---

## File map

### New hooks directory

Create `src/game/hooks/` (new, mirrors the existing `src/hooks/` convention at the repo level, while keeping game-domain hooks distinct from app-shell hooks like `useMap`, `useCountryData`). Rationale:

- `src/hooks/` is the established hook home for app-shell concerns (map, country/city data, theme, search). Game hooks would be out of place there.
- `src/game/shared/` already hosts `useGameSession.ts` (the reducer), `usePersonalBests.ts`, and the `GameSessionProvider`. Adding 5 effect-shaped hooks there mixes shape (state + dispatcher) with shape (effect-only). A separate `hooks/` directory inside `src/game/` keeps the effect-only hooks together and leaves `shared/` as the "session core" home.
- `src/game/GameController/index.tsx` (Option C from the brainstorm) would force a file move on every existing import. The blast radius outweighs the organisational win.

| File | Phase | Responsibility | Public API sketch |
|---|---|---|---|
| `src/game/hooks/useGameTestSeams.ts` | 1 | Registers `window.__funworldmap_game.{submitGuess,submitCountryGuess,setRound}` when `VITE_TEST_HOOKS=1`; cleans up on unmount. Only effect; no state. | `useGameTestSeams({ session, mode, byCca3, cities, start, overrideRound, submitGuessInput, statusRef }): void` |
| `src/game/hooks/useDailyResumePersistence.ts` | 2 | Writes the daily best-of-N resume blob to localStorage whenever the in-flight attempts mutate during a daily round. | `useDailyResumePersistence(session: GameSession): void` |
| `src/game/hooks/useGameAnnouncements.ts` | 3 | Dispatches `funworldmap:announce` events for screen-readers on round-start and game-over; handles auto-advance timers and round-end keyboard handlers; records personal-best / daily-history on game-over. Owns `recordedRef` and `lastAnnouncedRoundKeyRef`. | `useGameAnnouncements({ session, mode, byCca3, advance, finalize, record, recordDailyResult }): void` |
| `src/game/hooks/useRevealMapEffects.ts` | 4 | Drives the reveal layer (paint properties, geodesic arc rAF loop), intermediate-reveal flashes between daily attempts, camera reset on round start, the city-mode any-click handler, and the idle-state reveal-clear. Owns `lastIntermediateAttemptCountRef`, `prevStatusForIntermediateRef`. | `useRevealMapEffects({ session, mode, mapRef, byCca3, submitGuessInput }): void` |
| `src/game/hooks/useHashGameRouter.ts` | 5 | Parses the location hash, drives the initial bootstrap, listens to `hashchange`, drains deferred starts once pools arrive, emits `deep_link_opened` analytics. Owns `pendingStartRef`, `lastRevealEmitHashRef`, `statusRef`. Also fires `daily_attempted` per intermediate-attempt — owns `lastAttemptCountRef`, `prevStatusForTelemetryRef`. | `useHashGameRouter(opts: UseHashGameRouterOptions): { statusRef: RefObject<SessionStatus> }` where `UseHashGameRouterOptions = { session, mode, pools, byCca3, dailyPuzzles, dailyHistoryGet, start, resume, restart, endGame }` (10 fields — typed interface exported alongside the hook). |

After all phases land, the final shape of `GameController.tsx` is:

```tsx
export function GameController({ countries, cities, byCca3 }: Props) {
  const { mapRef } = useMap()
  const sessionApi = useGameSessionContext()
  const { session, mode, submitGuessInput, advance, endGame, finalize, ... } = sessionApi
  const { best, record } = usePersonalBests(session.modeId || 'country-pinning')
  const dailyPuzzles = useDailyPuzzlesContext()
  const { record: recordDailyResult, get: dailyHistoryGet } = useDailyHistory()
  const pools = useMemo(() => ({ countries, cities }), [countries, cities])

  const { statusRef } = useHashGameRouter({
    session,
    mode,
    pools,
    byCca3,
    dailyPuzzles,
    dailyHistoryGet,
    start: sessionApi.start,
    resume: sessionApi.resume,
    restart: sessionApi.restart,
    endGame: sessionApi.endGame,
  })
  useDailyResumePersistence(session)
  useGameAnnouncements({ session, mode, byCca3, advance, finalize, record, recordDailyResult })
  useRevealMapEffects({ session, mode, mapRef, byCca3, submitGuessInput })
  useGameTestSeams({ session, mode, byCca3, cities, statusRef, start: sessionApi.start, overrideRound: sessionApi.overrideRound, submitGuessInput })

  // Escape-to-exit + onEndGame/onPlayAgain/onSkip handlers + JSX render.
  // (Estimated 80–120 lines remaining; the original 833 minus the hooks.)
}
```

### Test files

| File | Created in | Holds tests for |
|---|---|---|
| `src/game/hooks/__tests__/useGameTestSeams.test.tsx` | Phase 1 | Test-seam registration / cleanup |
| `src/game/hooks/__tests__/useDailyResumePersistence.test.tsx` | Phase 2 | Resume-blob write conditions |
| `src/game/hooks/__tests__/useGameAnnouncements.test.tsx` | Phase 3 | Live-region dispatch, auto-advance timers, game-over recording |
| `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` | Phase 4 | Reveal paint properties, intermediate-attempt flashes, camera reset, city-click |
| `src/game/hooks/__tests__/useHashGameRouter.test.tsx` | Phase 5 | Hash bootstrap, deferred drain, wasGameOver branch, deep_link_opened dedup |

### Shared characterization-test methodology (referenced by all 5 phases)

Each phase follows this discipline:

1. **Write the characterization test FIRST**, on the current inlined behaviour of `GameController.tsx`. It must fail-or-pass against `main` in a way that locks in the current behaviour. (For a behaviour-preserving refactor, the test should PASS against `main` — that's the safety net: if the test still passes after extraction, behaviour is preserved. If we accidentally write a test that fails on `main`, that signals either a bug to file separately or a misunderstood spec — STOP and revisit before extracting.)
2. **Extract the hook**, keeping the JSX/imports unchanged inside `GameController.tsx` aside from replacing the inlined block with a hook call.
3. **Re-run the same test pointed at the new hook** (drop the GameController wrapper, use `renderHook` directly). It must PASS.
4. **Run the full test suite** (`npm run test:unit` then `npm run test:e2e` against `chromium-gpu` for game/daily specs) to catch regressions outside the targeted behaviour.
5. **Commit and PR per phase**, never combine two extractions into one PR.

The characterization tests use:

- `renderHook` from `@testing-library/react` (already used in `src/hooks/__tests__/useLauncherVisibility.test.tsx`).
- A `fakeMapRef` stub: `{ current: { setFilter: vi.fn(), setPaintProperty: vi.fn(), getSource: vi.fn(() => ({ setData: vi.fn() })), addSource: vi.fn(), addLayer: vi.fn(), on: vi.fn(), off: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() } }`.
- A `buildSession()` factory imported from `src/game/shared/__tests__/factories.ts` (existing — used by `useGameSession.test.ts`).
- `vi.useFakeTimers()` for setTimeout-driven effects (auto-advance, intermediate-reveal hold).
- Stubbed `localStorage` via `vi.stubGlobal('localStorage', ...)` or the JSDOM default (resume.ts already exercises real localStorage in tests).

### Line numbers vs symbol names

Every line range in this plan (e.g. `GameController.tsx:707-765`) was accurate at plan-write time (2026-05-14, against the post-PR-#50 tree). **After each phase lands, line numbers shift for the phases that haven't run yet.** Treat the ranges as anchors valid at plan-write time; before executing each phase, re-locate the inlined effect by its symbol or comment marker (`// Test seams.`, `// Persist daily best-of-N progress to localStorage so refresh resumes.`, `// Side effects on status change.`, etc.) rather than trusting the numeric range. Update line numbers in the per-phase prompt before dispatching the implementer subagent.

### CI testIgnore interaction (Phases 3, 4, 5)

Two CI risks every executor of Phases 3-5 must internalise:

1. **`game-country-pinning.spec.ts` is in CI's `testIgnore`** list (`playwright.config.ts:115-127`). It runs locally but not on CI. Phases 3 (announcements), 4 (reveal map effects), and 5 (hash router) all touch behaviour that spec exercises. Run `npm run test:e2e -- --project=chromium game-country-pinning.spec.ts` LOCALLY as part of each phase's verification — CI alone is not enough.
2. **5 tests are quarantined via `test.fixme(!!process.env.CI, …)`** (issues #31, #32, #47). Each is documented in `docs/testing/playwright-matrix.md`'s "Quarantined tests" section. The extractions may interact with these — Phase 3 with #32 (game-over → hash mode switch), Phase 4 with #47 (animation timing), Phase 5 with #31 and #32 (hash routing). If a quarantined test starts passing locally, the underlying fix may have landed as a side-effect — file a note; if it starts failing harder, revisit the extraction.

### App.tsx coupling (Phase 4 + Phase 5 risk)

`src/App.tsx` is closely coupled to GameController via:

- The `roundEndTarget` `useMemo` at `App.tsx:137-153` reading `session.lastOutcome.reveal.targetCca3` (touched by Phase 4's reveal-map effects).
- The `advanceRoundEndPanel` callback at `App.tsx:155-163` dispatching `advance` / `finalize` (touched by Phase 3's announcements + Phase 4's reveal).
- The `onMapSelect` handler at `App.tsx:165-194` branching on `session.modeId === 'country-pinning'` (touched by Phase 5 if the router changes which mode is active).
- The reveal-state hash listener at `App.tsx:105-117` (a second `hashchange` subscriber that duplicates the GameController's router — touched by Phase 5).

**Before Phase 4 and Phase 5 land**, audit App.tsx for these touch-points. If the extracted hook changes the shape or timing of any field App.tsx reads, App.tsx will need a parallel update — and that update should land in the SAME PR as the extraction, not a follow-up.

---

## Phase 1 — Extract `useGameTestSeams` (safest)

**Why safest:** The effect only registers/unregisters keys on `window.__funworldmap_game` when `import.meta.env.VITE_TEST_HOOKS` is truthy. In production builds that flag is undefined, so the effect's body is a no-op. Risk of production regression: zero. Risk of e2e regression: low — the seam is exercised by every `__funworldmap_game.submitCountryGuess(...)` call across the e2e suite, which is a much louder failure signal than a quiet production drift.

**Source:** Currently inlined at `src/game/GameController.tsx:707–765` (the `// Test seams.` effect).

### Task 1.1: Branch from main

- [ ] **Step 1**: Branch from main.

```bash
git checkout main && git pull --ff-only origin main && git checkout -b refactor/extract-use-game-test-seams
```

Working tree may have untracked unrelated files — they MUST NOT enter your commit.

### Task 1.2: Write the characterization test

**Files:**
- Create: `src/game/hooks/__tests__/useGameTestSeams.test.tsx` (will initially exercise GameController, then in Task 1.4 we point it at the new hook)

- [ ] **Step 1: Write the failing-on-spec / passing-on-main characterization test**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { GameController } from '../../GameController'
// fixtures: minimal countries + cities + byCca3 to satisfy the controller's props
import { countriesFixture, citiesFixture, byCca3Fixture } from './fixtures'

declare global {
  interface Window {
    __funworldmap_game?: Record<string, unknown>
  }
}

describe('test seams (characterization, pre-extraction)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    delete window.__funworldmap_game
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    delete window.__funworldmap_game
  })

  it('registers submitGuess, submitCountryGuess, setRound on window when VITE_TEST_HOOKS=1', () => {
    renderControllerInProviders(
      <GameController
        countries={countriesFixture}
        cities={citiesFixture}
        byCca3={byCca3Fixture}
      />,
    )
    expect(window.__funworldmap_game).toBeDefined()
    expect(typeof window.__funworldmap_game!.submitGuess).toBe('function')
    expect(typeof window.__funworldmap_game!.submitCountryGuess).toBe('function')
    expect(typeof window.__funworldmap_game!.setRound).toBe('function')
  })

  it('does NOT register seams when VITE_TEST_HOOKS is unset', () => {
    vi.stubEnv('VITE_TEST_HOOKS', '')
    renderControllerInProviders(
      <GameController
        countries={countriesFixture}
        cities={citiesFixture}
        byCca3={byCca3Fixture}
      />,
    )
    expect(window.__funworldmap_game?.submitGuess).toBeUndefined()
  })

  it('cleans up seam keys on unmount', () => {
    const { unmount } = renderControllerInProviders(
      <GameController
        countries={countriesFixture}
        cities={citiesFixture}
        byCca3={byCca3Fixture}
      />,
    )
    expect(window.__funworldmap_game!.submitGuess).toBeDefined()
    unmount()
    expect(window.__funworldmap_game!.submitGuess).toBeUndefined()
  })

  it('submitCountryGuess returns false when mode is not country-pinning', () => {
    // (Drive controller into city-guessing mode via __funworldmap_game.setRound,
    // then call submitCountryGuess('USA') and assert it returns false.)
    // …spelled out in the implementation; see fixtures.ts for setup helpers.
  })

  it('setRound returns false when mode is null (no pools loaded)', () => {
    renderControllerInProviders(
      <GameController countries={[]} cities={[]} byCca3={new Map()} />,
    )
    // mode is null when pools are empty (GameSessionProvider returns null for mode).
    expect(window.__funworldmap_game!.setRound('USA')).toBe(false)
  })
})
```

`renderControllerInProviders` is a small helper wrapping the component in `<GameSessionProvider>` + `<DailyPuzzlesProvider>` + the map context. **Phase 1 defines this helper inline in `useGameTestSeams.test.tsx`. Phase 3 promotes it to `src/game/hooks/__tests__/test-helpers.tsx`** and updates Phase 1's test to import from there. This is a deliberate scope split — Phase 1 stays minimal; Phase 3 picks up the DRY when the second consumer appears.

**Pin fixtures location (Phase 1 sub-task):** Create `src/game/hooks/__tests__/fixtures.ts` as part of Phase 1's Task 1.2. It does NOT exist on `main` today (verified 2026-05-14 by checking `src/game/hooks/` does not exist; sibling `src/game/shared/__tests__/factories.ts` is a related but separate file used by reducer tests). The file's contract:

```ts
// src/game/hooks/__tests__/fixtures.ts
import type { CountryLike, CityLike } from '../../shared/types'

export const countriesFixture: CountryLike[] = [
  { cca3: 'USA', name: { common: 'United States' }, latlng: [38, -97], flag: 'flags/US.svg', independent: true },
  { cca3: 'FRA', name: { common: 'France' }, latlng: [46, 2], flag: 'flags/FR.svg', independent: true },
]

export const citiesFixture: CityLike[] = [
  { id: 'USA-new-york', name: 'New York', countryCca3: 'USA', countryName: 'United States', countryFlag: 'flags/US.svg', latlng: [40.7128, -74.0060], scalerank: 0 },
  { id: 'FRA-paris', name: 'Paris', countryCca3: 'FRA', countryName: 'France', countryFlag: 'flags/FR.svg', latlng: [48.8566, 2.3522], scalerank: 0 },
]

export const byCca3Fixture: Map<string, CountryLike> = new Map([
  ['USA', countriesFixture[0]],
  ['FRA', countriesFixture[1]],
])
```

Phase 1's Task 1.2 must create this file BEFORE the characterization tests are run. Subsequent phases that need a richer or different shape can add to this file (e.g. add a `multiAttemptCountriesFixture` in Phase 2) rather than re-defining inline.

- [ ] **Step 2: Run the test against `main` (before extraction)**

```bash
npm run test:unit -- src/game/hooks/__tests__/useGameTestSeams.test.tsx
```

Expected: All 5 tests PASS. (This is the characterization — current GameController already implements the contract.)

- [ ] **Step 3: Commit the characterization test**

```bash
git add src/game/hooks/__tests__/useGameTestSeams.test.tsx
git commit -m "test: characterise GameController test-seam registration

Pre-extraction safety net for the useGameTestSeams hook extraction.
The current inlined effect at GameController.tsx:707–765 satisfies
this contract; the extraction must preserve it."
```

### Task 1.3: Extract the hook

**Files:**
- Create: `src/game/hooks/useGameTestSeams.ts`
- Modify: `src/game/GameController.tsx:707–765` (delete inlined effect, replace with hook call near top of component body)

- [ ] **Step 1: Create the hook**

```ts
// src/game/hooks/useGameTestSeams.ts
import { useEffect, type RefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CityLike, CountryLike, GameMode, GameSession, GuessInput, ModeId, RoundSpec } from '../shared/types'
import { centroidFromLatLng } from '../shared/distance'

interface Args {
  session: GameSession
  mode: GameMode | null
  byCca3: Map<string, CountryLike>
  cities: CityLike[]
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number, dailyDate?: string | null) => void
  overrideRound: (round: RoundSpec) => void
  submitGuessInput: (input: GuessInput) => void
  /** Synchronous mirror of session.status (provided by useHashGameRouter once Phase 5 lands; until then, plumbed from GameController). */
  statusRef: RefObject<GameSession['status']>
}

export function useGameTestSeams({
  session, mode, byCca3, cities, start, overrideRound, submitGuessInput, statusRef,
}: Args): void {
  useEffect(() => {
    if (!import.meta.env.VITE_TEST_HOOKS) return
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.submitGuess = (input: GuessInput) => submitGuessInput(input)
    w.__funworldmap_game.submitCountryGuess = (cca3: string): boolean => {
      if (session.modeId !== 'country-pinning') return false
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return false
      submitGuessInput({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        name: country.name.common,
        centroid: centroidFromLatLng(country.latlng),
      })
      return true
    }
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
          targetCentroid: centroidFromLatLng(city.latlng),
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
        delete w.__funworldmap_game.submitCountryGuess
        delete w.__funworldmap_game.setRound
      }
    }
  }, [mode, session.modeId, byCca3, cities, start, overrideRound, submitGuessInput, statusRef])
}

// Suppress unused-mapref-import warning if needed; maplibregl import retained for future seam shapes.
export type { maplibregl }
```

Note on `statusRef`: until Phase 5 lands and `useHashGameRouter` owns the ref, `GameController.tsx` continues to declare `const statusRef = useRef(session.status); statusRef.current = session.status` and plumb it in. Phase 5 will move that ref ownership.

- [ ] **Step 2: Replace the inlined effect in GameController.tsx**

Delete `src/game/GameController.tsx:707–765` (the entire `// Test seams.` `useEffect` block) and insert at the top of the component body (after the existing hook destructures, alongside the other extracted hook calls that will be added in later phases):

```tsx
useGameTestSeams({
  session,
  mode,
  byCca3,
  cities,
  start,
  overrideRound,
  submitGuessInput,
  statusRef,
})
```

Add the import: `import { useGameTestSeams } from './hooks/useGameTestSeams'`.

### Task 1.4: Re-target and re-run the characterization test

- [ ] **Step 1: Add a `renderHook`-based pair of tests** in the same `useGameTestSeams.test.tsx` file

```tsx
import { renderHook, cleanup } from '@testing-library/react'
import { useGameTestSeams } from '../useGameTestSeams'
import { useRef } from 'react'

describe('useGameTestSeams (post-extraction, isolated)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    delete window.__funworldmap_game
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    delete window.__funworldmap_game
  })

  it('registers seam keys when invoked with VITE_TEST_HOOKS=1', () => {
    const args = buildTestSeamArgs()
    renderHook(() => {
      const statusRef = useRef(args.session.status)
      useGameTestSeams({ ...args, statusRef })
    })
    expect(typeof window.__funworldmap_game?.submitGuess).toBe('function')
  })

  it('cleans up seam keys on unmount', () => {
    const args = buildTestSeamArgs()
    const { unmount } = renderHook(() => {
      const statusRef = useRef(args.session.status)
      useGameTestSeams({ ...args, statusRef })
    })
    unmount()
    expect(window.__funworldmap_game?.submitGuess).toBeUndefined()
  })

  it('submitCountryGuess dispatches a country input via submitGuessInput', () => {
    const submitGuessInput = vi.fn()
    const args = buildTestSeamArgs({ submitGuessInput })
    renderHook(() => {
      const statusRef = useRef(args.session.status)
      useGameTestSeams({ ...args, statusRef })
    })
    expect((window.__funworldmap_game!.submitCountryGuess as (s: string) => boolean)('USA')).toBe(true)
    expect(submitGuessInput).toHaveBeenCalledWith(expect.objectContaining({ kind: 'country', cca3: 'USA' }))
  })
})
```

`buildTestSeamArgs` is a local factory using the `factories.ts` `buildSession()` helper from `src/game/shared/__tests__/factories.ts`.

- [ ] **Step 2: Run both test groups (pre + post)**

```bash
npm run test:unit -- src/game/hooks/__tests__/useGameTestSeams.test.tsx
```

Expected: All tests PASS — both the GameController-wrapped characterization and the renderHook-isolated tests.

- [ ] **Step 3: Run the affected e2e specs**

```bash
npx playwright test --project=chromium-gpu e2e/game-city-guessing.spec.ts e2e/game-country-pinning.spec.ts e2e/daily-best-of-3.spec.ts
```

Expected: PASS. These specs exercise `__funworldmap_game.submitCountryGuess` heavily; if the extraction broke the seam wiring, these would fail loudly.

### Task 1.5: Commit and PR

- [ ] **Step 1: Commit**

```bash
git add src/game/hooks/useGameTestSeams.ts src/game/hooks/__tests__/useGameTestSeams.test.tsx src/game/GameController.tsx
git status   # only these three should be staged
git commit -m "refactor: extract useGameTestSeams from GameController

Pulls the VITE_TEST_HOOKS-gated window.__funworldmap_game registration
out of GameController.tsx into src/game/hooks/useGameTestSeams.ts.

Pre-extraction characterization tests verify the wiring; isolated
renderHook tests then re-verify after extraction. Behaviour preserved.

Part of the GameController extraction plan
(docs/superpowers/plans/2026-05-14-game-controller-extraction.md)."
```

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin refactor/extract-use-game-test-seams
gh pr create --base main --title "refactor: extract useGameTestSeams from GameController" --body "First of five extraction PRs (see plan). Safest start: VITE_TEST_HOOKS-gated effect with zero production codepath."
```

---

## Phase 2 — Extract `useDailyResumePersistence`

**Why safe second:** Single concern (one `useEffect`, one localStorage key); the effect's guards (`session.status !== 'playing'`, `attemptsPerRound <= 1`, etc.) are pure expressions over `session`. No timers, no map state, no animations. Failure mode is contained to the daily resume feature — already validated end-to-end by `e2e/daily-best-of-3.spec.ts`.

**Source:** Currently inlined at `src/game/GameController.tsx:333–345`.

### Task 2.1: Branch from main

- [ ] **Step 1**: Branch from main.

```bash
git checkout main && git pull --ff-only origin main && git checkout -b refactor/extract-use-daily-resume-persistence
```

### Task 2.2: Write the characterization test

**Files:**
- Create: `src/game/hooks/__tests__/useDailyResumePersistence.test.tsx`

- [ ] **Step 1: Write tests covering each guard branch and the happy path**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useDailyResumePersistence } from '../useDailyResumePersistence' // will not exist yet
import { RESUME_KEY } from '../../daily/resume'
import { buildSession, buildAttempt } from '../../shared/__tests__/factories'

describe('useDailyResumePersistence (characterization)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes resume blob when status=playing, attemptsPerRound>1, currentAttempts non-empty, dailyDate set', () => {
    const session = buildSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [buildAttempt({ pointsEarned: 40 })],
      dailyDate: '2026-05-14',
      modeId: 'country-pinning',
    })
    renderHook(() => useDailyResumePersistence(session))
    const raw = localStorage.getItem(RESUME_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.version).toBe(1)
    expect(parsed.date).toBe('2026-05-14')
    expect(parsed.modeId).toBe('country-pinning')
    expect(parsed.attempts).toHaveLength(1)
  })

  it('does NOT write when status is not playing', () => {
    const session = buildSession({
      status: 'round-ended',
      attemptsPerRound: 3,
      currentAttempts: [buildAttempt()],
      dailyDate: '2026-05-14',
    })
    renderHook(() => useDailyResumePersistence(session))
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('does NOT write when attemptsPerRound <= 1 (free-mode play)', () => {
    const session = buildSession({
      status: 'playing',
      attemptsPerRound: 1,
      currentAttempts: [buildAttempt()],
      dailyDate: '2026-05-14',
    })
    renderHook(() => useDailyResumePersistence(session))
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('does NOT write when currentAttempts is empty (before first guess)', () => {
    const session = buildSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [],
      dailyDate: '2026-05-14',
    })
    renderHook(() => useDailyResumePersistence(session))
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('does NOT write when dailyDate is null (free play in best-of-N shape — unreachable today but guarded)', () => {
    const session = buildSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [buildAttempt()],
      dailyDate: null,
    })
    renderHook(() => useDailyResumePersistence(session))
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('re-writes the blob when currentAttempts grows (second attempt)', () => {
    const session1 = buildSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [buildAttempt({ pointsEarned: 40 })],
      dailyDate: '2026-05-14',
    })
    const { rerender } = renderHook(({ s }) => useDailyResumePersistence(s), { initialProps: { s: session1 } })
    expect(JSON.parse(localStorage.getItem(RESUME_KEY)!).attempts).toHaveLength(1)
    const session2 = { ...session1, currentAttempts: [...session1.currentAttempts, buildAttempt({ pointsEarned: 60 })] }
    rerender({ s: session2 })
    expect(JSON.parse(localStorage.getItem(RESUME_KEY)!).attempts).toHaveLength(2)
  })
})
```

The factory `buildAttempt` may need a tiny addition to `src/game/shared/__tests__/factories.ts` if it doesn't already exist. Check first; if it exists, use it directly. If not, add it: `export function buildAttempt(o: Partial<AttemptRecord> = {}): AttemptRecord { return { input: { kind: 'country', cca3: 'USA', name: 'United States', centroid: [38, -97] }, reveal: { kind: 'country', correct: false, targetCca3: 'FRA', targetName: 'France', targetCentroid: [46, 2], distanceKm: 7000 }, pointsEarned: 0, attemptIndex: 0, ...o } }`.

- [ ] **Step 2: Run the test — it should fail because `useDailyResumePersistence` doesn't exist yet**

```bash
npm run test:unit -- src/game/hooks/__tests__/useDailyResumePersistence.test.tsx
```

Expected: FAIL with `Cannot find module '../useDailyResumePersistence'`.

This is the test-driven failure: the test specifies the contract before the hook exists. Pre-extraction characterization for this phase happens not against `main` (the effect's inlined inside GameController.tsx, not testable in isolation), but against the **post-extraction shape**. The behavioural lock-in comes from the e2e suite (Task 2.5 below).

### Task 2.3: Extract the hook

**Files:**
- Create: `src/game/hooks/useDailyResumePersistence.ts`
- Modify: `src/game/GameController.tsx:333–345`

- [ ] **Step 1: Create the hook**

```ts
// src/game/hooks/useDailyResumePersistence.ts
import { useEffect } from 'react'
import type { GameSession } from '../shared/types'
import { writeResume } from '../daily/resume'

/**
 * Persists in-flight daily best-of-N attempts to localStorage so a refresh
 * resumes mid-round. Inert outside daily best-of-N play.
 */
export function useDailyResumePersistence(session: GameSession): void {
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.attemptsPerRound <= 1) return
    if (session.currentAttempts.length === 0) return
    if (session.dailyDate === null) return
    writeResume({
      version: 1,
      date: session.dailyDate,
      modeId: session.modeId,
      attempts: session.currentAttempts,
    })
  }, [session.status, session.attemptsPerRound, session.currentAttempts, session.dailyDate, session.modeId])
}
```

- [ ] **Step 2: Replace the inlined effect in GameController.tsx**

Delete `src/game/GameController.tsx:333–345` and insert (near the other hook calls):

```tsx
useDailyResumePersistence(session)
```

Add the import: `import { useDailyResumePersistence } from './hooks/useDailyResumePersistence'`.

### Task 2.4: Re-run tests

- [ ] **Step 1: Run unit tests**

```bash
npm run test:unit -- src/game/hooks/__tests__/useDailyResumePersistence.test.tsx
```

Expected: All 6 tests PASS.

- [ ] **Step 2: Run the daily-suite e2e specs**

```bash
npx playwright test --project=chromium-gpu e2e/daily-best-of-3.spec.ts e2e/daily-deep-link.spec.ts e2e/daily-reveal.spec.ts
```

Expected: PASS. These specs depend on resume-blob round-tripping during best-of-N play.

### Task 2.5: Commit and PR

- [ ] **Step 1: Commit**

```bash
git add src/game/hooks/useDailyResumePersistence.ts src/game/hooks/__tests__/useDailyResumePersistence.test.tsx src/game/GameController.tsx
git commit -m "refactor: extract useDailyResumePersistence from GameController

Moves the daily best-of-N resume-blob write effect from
GameController.tsx:333–345 into a dedicated hook with unit-test
coverage of every guard branch.

Part of the GameController extraction plan
(docs/superpowers/plans/2026-05-14-game-controller-extraction.md)."
```

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin refactor/extract-use-daily-resume-persistence
gh pr create --base main --title "refactor: extract useDailyResumePersistence from GameController" --body "Second of five extraction PRs. Tiny hook, all-guard-branch unit coverage."
```

---

## Phase 3 — Extract `useGameAnnouncements`

**Why this order:** The announcement / auto-advance effect (`src/game/GameController.tsx:347–449`) touches three things: the screen-reader live region (via the `funworldmap:announce` custom event), the auto-advance timer (which calls `advance()` / `finalize()` against the reducer), and the personal-best / daily-history records on game-over. All three are reducer-state-driven and have no MapLibre coupling. This makes it the third-safest extraction: it touches more behaviour than Phase 1 or 2, but no map paint, no rAF, no hash routing.

**Source:** Currently inlined at `src/game/GameController.tsx:347–449` plus the `recordedRef` (line 125) and `lastAnnouncedRoundKeyRef` (line 133) which it owns.

### Task 3.1: Branch from main

- [ ] **Step 1**: Branch from main.

```bash
git checkout main && git pull --ff-only origin main && git checkout -b refactor/extract-use-game-announcements
```

### Task 3.2: Write the characterization test

**Files:**
- Create: `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`

- [ ] **Step 1: Write tests covering each behavioural branch**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useGameAnnouncements } from '../useGameAnnouncements'
import { buildSession, buildAttempt, buildRound, buildRevealCorrect, buildRevealWrong } from '../../shared/__tests__/factories'
import { getMode } from '../../modes'

const POOLS = { countries: [/* USA + FRA fixture */], cities: [/* NYC + Paris fixture */] }

function captureAnnouncements(): string[] {
  const events: string[] = []
  const handler = (e: Event) => events.push((e as CustomEvent).detail)
  window.addEventListener('funworldmap:announce', handler)
  // returned cleanup is intentionally inline-callable from test cleanup
  return events
}

describe('useGameAnnouncements', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('announces target name on entering playing with a country-pinning round', () => {
    const events = captureAnnouncements()
    const mode = getMode('country-pinning', POOLS)
    const session = buildSession({
      status: 'playing',
      modeId: 'country-pinning',
      currentRound: buildRound({ kind: 'country-pinning', targetCca3: 'FRA', targetName: 'France' }),
      roundIndex: 0,
    })
    renderHook(() => useGameAnnouncements({
      session, mode, byCca3: new Map(),
      advance: vi.fn(), finalize: vi.fn(), record: vi.fn(), recordDailyResult: vi.fn(),
    }))
    expect(events).toContain('Pin: France')
  })

  it('announces "Where is …" on entering playing with a city-guessing round', () => {
    const events = captureAnnouncements()
    const mode = getMode('city-guessing', POOLS)
    const session = buildSession({
      status: 'playing',
      modeId: 'city-guessing',
      currentRound: buildRound({ kind: 'city-guessing', targetName: 'Paris', targetCountryName: 'France' }),
      roundIndex: 0,
    })
    renderHook(() => useGameAnnouncements({
      session, mode, byCca3: new Map(),
      advance: vi.fn(), finalize: vi.fn(), record: vi.fn(), recordDailyResult: vi.fn(),
    }))
    expect(events.some((s) => /Where is Paris, France/.test(s))).toBe(true)
  })

  it('does not re-announce when round key is unchanged across rerenders', () => {
    const events = captureAnnouncements()
    const session = buildSession({
      status: 'playing',
      modeId: 'country-pinning',
      currentRound: buildRound({ kind: 'country-pinning', targetCca3: 'FRA' }),
      roundIndex: 0,
    })
    const { rerender } = renderHook(({ s }) => useGameAnnouncements({
      session: s, mode: getMode('country-pinning', POOLS), byCca3: new Map(),
      advance: vi.fn(), finalize: vi.fn(), record: vi.fn(), recordDailyResult: vi.fn(),
    }), { initialProps: { s: session } })
    rerender({ s: { ...session, score: session.score + 10 } }) // unrelated state change
    expect(events.filter((s) => s.includes('France')).length).toBe(1)
  })

  it('auto-advances country-pinning non-final round-end after REVEAL_MS_COUNTRY (1200ms) when no animation plan', () => {
    const advance = vi.fn()
    const mode = getMode('country-pinning', POOLS)
    const session = buildSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      attemptsPerRound: 1,
      attemptsRemaining: 0,
      lastOutcome: { reveal: buildRevealWrong({ kind: 'country', clickedCca3: null }), endsGame: false },
      roundIndex: 0,
      maxRounds: 5,
    })
    renderHook(() => useGameAnnouncements({
      session, mode, byCca3: new Map(),
      advance, finalize: vi.fn(), record: vi.fn(), recordDailyResult: vi.fn(),
    }))
    vi.advanceTimersByTime(1199)
    expect(advance).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(advance).toHaveBeenCalledTimes(1)
  })

  it('calls finalize() instead of advance() when lastOutcome.endsGame is true and not country-pinning', () => {
    const advance = vi.fn()
    const finalize = vi.fn()
    const mode = getMode('city-guessing', POOLS)
    const session = buildSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: { reveal: buildRevealWrong({ kind: 'point' }), endsGame: true },
    })
    renderHook(() => useGameAnnouncements({
      session, mode, byCca3: new Map(),
      advance, finalize, record: vi.fn(), recordDailyResult: vi.fn(),
    }))
    vi.advanceTimersByTime(2000) // REVEAL_MS_CITY
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(advance).not.toHaveBeenCalled()
  })

  it('records personal best on game-over for free play (dailyDate=null)', () => {
    const record = vi.fn()
    const recordDailyResult = vi.fn()
    const session = buildSession({
      status: 'game-over',
      modeId: 'country-pinning',
      score: 250,
      bestStreak: 4,
      dailyDate: null,
    })
    renderHook(() => useGameAnnouncements({
      session, mode: getMode('country-pinning', POOLS), byCca3: new Map(),
      advance: vi.fn(), finalize: vi.fn(), record, recordDailyResult,
    }))
    expect(record).toHaveBeenCalledWith(250, 4)
    expect(recordDailyResult).not.toHaveBeenCalled()
  })

  it('records daily-history on game-over when dailyDate is set, and clears resume', () => {
    localStorage.setItem('funworldmap-daily-resume', '"placeholder"')
    const record = vi.fn()
    const recordDailyResult = vi.fn()
    const session = buildSession({
      status: 'game-over',
      modeId: 'country-pinning',
      score: 80,
      dailyDate: '2026-05-14',
      currentAttempts: [buildAttempt({ pointsEarned: 80 })],
    })
    renderHook(() => useGameAnnouncements({
      session, mode: getMode('country-pinning', POOLS), byCca3: new Map(),
      advance: vi.fn(), finalize: vi.fn(), record, recordDailyResult,
    }))
    expect(recordDailyResult).toHaveBeenCalledWith('2026-05-14', 'country-pinning', expect.objectContaining({ score: 80, attempts: expect.any(Array) }))
    expect(record).not.toHaveBeenCalled()
    expect(localStorage.getItem('funworldmap-daily-resume')).toBeNull()
  })

  it('dedups record() across rerenders when status stays game-over', () => {
    const record = vi.fn()
    const session = buildSession({
      status: 'game-over', modeId: 'country-pinning', score: 100, dailyDate: null,
    })
    const { rerender } = renderHook(({ s }) => useGameAnnouncements({
      session: s, mode: getMode('country-pinning', POOLS), byCca3: new Map(),
      advance: vi.fn(), finalize: vi.fn(), record, recordDailyResult: vi.fn(),
    }), { initialProps: { s: session } })
    rerender({ s: { ...session, score: 100 } })
    expect(record).toHaveBeenCalledTimes(1)
  })
})
```

(8 tests cover the announcement / advance / record contracts. Tests fail until the hook is created — TDD.)

- [ ] **Step 2: Run tests — expected FAIL** (`Cannot find module '../useGameAnnouncements'`)

### Task 3.3: Extract the hook

**Files:**
- Create: `src/game/hooks/useGameAnnouncements.ts`
- Modify: `src/game/GameController.tsx:347–449` (delete inlined effect, move `recordedRef` and `lastAnnouncedRoundKeyRef` into the hook)

- [ ] **Step 1: Create the hook**

```ts
// src/game/hooks/useGameAnnouncements.ts
import { useEffect, useRef } from 'react'
import type { AttemptRecord, CountryLike, GameMode, GameSession } from '../shared/types'
import { computeRevealAnimationPlan } from '../shared/revealAnimation'
import { prefersReducedMotion } from '../../lib/motion'
import { clearResume } from '../daily/resume'
import { track } from '../../lib/analytics'

const REVEAL_MS_COUNTRY = 1200
const REVEAL_MS_CITY = 2000

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

function holdThenAdvance(durationMs: number, advanceNow: () => void): () => void {
  const t = window.setTimeout(advanceNow, durationMs)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      advanceNow()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.clearTimeout(t)
    window.removeEventListener('keydown', onKey)
  }
}

interface Args {
  session: GameSession
  mode: GameMode | null
  byCca3: Map<string, CountryLike>
  advance: (nextRound: ReturnType<GameMode['nextRound']>) => void
  finalize: () => void
  record: (score: number, bestStreak: number) => void
  recordDailyResult: (date: string, modeId: GameSession['modeId'], payload: { score: number; attempts: Array<{ pointsEarned: number; guessCca3?: string; guessLngLat?: [number, number]; distanceKm: number }>; completedAt: number }) => void
}

export function useGameAnnouncements({ session, mode, byCca3, advance, finalize, record, recordDailyResult }: Args): void {
  const recordedRef = useRef(false)
  const lastAnnouncedRoundKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!mode) return
    if (session.status === 'playing' && session.currentRound) {
      if (session.roundIndex === 0) recordedRef.current = false
      const key = session.currentRound.kind === 'country-pinning'
        ? session.currentRound.targetCca3
        : session.currentRound.targetId
      if (lastAnnouncedRoundKeyRef.current !== key) {
        lastAnnouncedRoundKeyRef.current = key
        if (session.currentRound.kind === 'country-pinning') {
          dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
        } else {
          const r = session.currentRound
          dispatchAnnouncement(`Round ${session.roundIndex + 1}. Where is ${r.targetName}, ${r.targetCountryName}? Click anywhere on the map.`)
        }
      }
    }
    if (session.status === 'round-ended' && session.lastOutcome) {
      const isFinalOutcome =
        session.attemptsPerRound === 1 || session.attemptsRemaining === 0
      const isCountryPinning = session.modeId === 'country-pinning'
      const isCorrect = session.lastOutcome.reveal?.kind === 'country'
        ? session.lastOutcome.reveal.correct
        : false

      const advanceNow = () => {
        if (session.lastOutcome?.endsGame) {
          finalize()
          return
        }
        const next = mode.nextRound(session.used)
        advance(next)
      }

      const plan = session.lastOutcome
        ? computeRevealAnimationPlan(session.lastOutcome.reveal, byCca3, prefersReducedMotion())
        : null
      const animatedMs = plan ? Math.max(plan.durationMs + 300, 1800) : null

      if (isCountryPinning && !isFinalOutcome) {
        const ms = animatedMs ?? REVEAL_MS_COUNTRY
        const t = window.setTimeout(advanceNow, ms)
        return () => window.clearTimeout(t)
      }
      if (!isCountryPinning) {
        const ms = animatedMs ?? REVEAL_MS_CITY
        const t = window.setTimeout(advanceNow, ms)
        return () => window.clearTimeout(t)
      }
      if (isCorrect) {
        return holdThenAdvance(3000, advanceNow)
      }
      if (session.lastOutcome.endsGame) {
        return holdThenAdvance(Math.max(animatedMs ?? 0, 3000), advanceNow)
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') advanceNow()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
    if (session.status === 'game-over' && !recordedRef.current) {
      recordedRef.current = true
      const dailyDate = session.dailyDate
      if (dailyDate === null) record(session.score, session.bestStreak)
      else {
        const attempts: AttemptRecord[] = session.currentAttempts
        recordDailyResult(dailyDate, session.modeId, {
          score: session.score,
          attempts: attempts.map((a) => ({
            pointsEarned: a.pointsEarned,
            guessCca3: a.input.kind === 'country' ? a.input.cca3 : undefined,
            guessLngLat: a.input.kind === 'point' ? a.input.lngLat : undefined,
            distanceKm: a.reveal.distanceKm,
          })),
          completedAt: Date.now(),
        })
        clearResume()
        track('daily_completed', {
          mode: session.modeId,
          bestScoreBucket: Math.min(4, Math.floor(session.score / 20)),
          attemptsUsed: attempts.length,
        })
      }
      lastAnnouncedRoundKeyRef.current = null
      dispatchAnnouncement(`Game over. Final score ${session.score}.`)
    }
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    session.currentAttempts, session.dailyDate,
    advance, mode, record, recordDailyResult, byCca3, finalize,
  ])
}
```

- [ ] **Step 2: Replace the inlined effect in GameController.tsx**

Delete `src/game/GameController.tsx:347–449` AND remove the two refs at lines 125 (`recordedRef`) and 133 (`lastAnnouncedRoundKeyRef`) AND the helper functions `dispatchAnnouncement` (37–39) and `holdThenAdvance` (51–65) AND the constants `REVEAL_MS_COUNTRY` / `REVEAL_MS_CITY` (33–34) — those move into the hook file. Add the hook call:

```tsx
useGameAnnouncements({
  session, mode, byCca3,
  advance, finalize, record, recordDailyResult,
})
```

Add the import: `import { useGameAnnouncements } from './hooks/useGameAnnouncements'`.

### Task 3.4: Re-run tests

- [ ] **Step 1: Unit tests**

```bash
npm run test:unit -- src/game/hooks/__tests__/useGameAnnouncements.test.tsx
```

Expected: All 8 tests PASS.

- [ ] **Step 2: A11y + game e2e**

```bash
npx playwright test --project=chromium-gpu e2e/a11y-keyboard-smoke.spec.ts e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts e2e/daily-best-of-3.spec.ts e2e/daily-reveal-on-final-attempt.spec.ts
```

Expected: PASS. The keyboard-smoke spec exercises the live-region announcement; the game specs exercise auto-advance.

### Task 3.5: Commit and PR

- [ ] **Step 1: Commit**

```bash
git add src/game/hooks/useGameAnnouncements.ts src/game/hooks/__tests__/useGameAnnouncements.test.tsx src/game/GameController.tsx
git commit -m "refactor: extract useGameAnnouncements from GameController

Pulls the screen-reader announcement, auto-advance timing, and
game-over recording effect (lines 347–449) into a dedicated hook.
recordedRef and lastAnnouncedRoundKeyRef move with it.

Part of the GameController extraction plan."
```

- [ ] **Step 2: Push and PR**

```bash
git push -u origin refactor/extract-use-game-announcements
gh pr create --base main --title "refactor: extract useGameAnnouncements from GameController"
```

---

## Phase 4 — Extract `useRevealMapEffects`

**Why this order:** This phase consolidates **four related effects** (lines 484–705) that all manipulate MapLibre state: reveal geometry (line growing, marker placement, camera tracking), intermediate-attempt flashes (best-of-N daily), camera reset on new round, the city-mode any-click handler, and the idle-state clear. They're grouped because they share the `mapRef` dependency and the `prefersReducedMotion()` check; splitting them across multiple hooks would invite cross-hook timing bugs. It comes after Phase 3 because the auto-advance timing (Phase 3) depends on the `computeRevealAnimationPlan` plan — both Phase 3 and Phase 4 compute that plan independently today, and the duplication is intentional (two consumers of the same pure helper). Risk: this phase touches the most visible surface (the reveal animation users see); the e2e suite is the louder safety net here.

**Source:** Currently inlined at `src/game/GameController.tsx:484–705`, plus refs `lastIntermediateAttemptCountRef` (458) and `prevStatusForIntermediateRef` (459). Includes the in-file helpers `ensureRevealSources` (67–101) and `clearRevealSources` (103–111).

### Task 4.1: Branch from main

- [ ] **Step 1**: Branch from main.

```bash
git checkout main && git pull --ff-only origin main && git checkout -b refactor/extract-use-reveal-map-effects
```

### Task 4.2: Write the characterization test

**Files:**
- Create: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`
- Possibly create: `src/game/hooks/__tests__/fakeMapRef.ts` (reusable map stub)

- [ ] **Step 1: Create the fakeMapRef helper**

```ts
// src/game/hooks/__tests__/fakeMapRef.ts
import { vi } from 'vitest'
import type { RefObject } from 'react'
import type maplibregl from 'maplibre-gl'

export function createFakeMapRef(): { ref: RefObject<maplibregl.Map>; calls: ReturnType<typeof spyCalls> } {
  const setData = vi.fn()
  const map = {
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    getSource: vi.fn(() => ({ setData })),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
  } as unknown as maplibregl.Map
  return { ref: { current: map }, calls: spyCalls(map, setData) }
}

function spyCalls(map: maplibregl.Map, setData: ReturnType<typeof vi.fn>) {
  return {
    setFilter: map.setFilter as ReturnType<typeof vi.fn>,
    setPaintProperty: map.setPaintProperty as ReturnType<typeof vi.fn>,
    on: map.on as ReturnType<typeof vi.fn>,
    off: map.off as ReturnType<typeof vi.fn>,
    flyTo: map.flyTo as ReturnType<typeof vi.fn>,
    jumpTo: map.jumpTo as ReturnType<typeof vi.fn>,
    setData,
  }
}
```

- [ ] **Step 2: Write characterization tests for each effect branch**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useRevealMapEffects } from '../useRevealMapEffects'
import { createFakeMapRef } from './fakeMapRef'
import { buildSession, buildAttempt, buildRound, buildRevealCorrect, buildRevealWrong } from '../../shared/__tests__/factories'
import { getMode } from '../../modes'
import { LAYER } from '../../../lib/mapLayers'

const POOLS = { countries: [/* USA + FRA */], cities: [/* NYC + Paris */] }

describe('useRevealMapEffects', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('paints the green correct-country border on round-ended for a correct country reveal', () => {
    const { ref, calls } = createFakeMapRef()
    const session = buildSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: { reveal: buildRevealCorrect({ kind: 'country', targetCca3: 'FRA' }), endsGame: false },
    })
    renderHook(() => useRevealMapEffects({
      session, mode: getMode('country-pinning', POOLS), mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }))
    expect(calls.setFilter).toHaveBeenCalledWith(LAYER.hoverBorder, ['==', ['get', 'id'], 'FRA'])
    expect(calls.setPaintProperty).toHaveBeenCalledWith(LAYER.hoverBorder, 'line-color', '#22c55e')
  })

  it('paints the orange wrong-country border on round-ended for a wrong country reveal', () => {
    const { ref, calls } = createFakeMapRef()
    const session = buildSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: { reveal: buildRevealWrong({ kind: 'country', targetCca3: 'FRA', correct: false }), endsGame: false },
    })
    renderHook(() => useRevealMapEffects({
      session, mode: getMode('country-pinning', POOLS), mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }))
    expect(calls.setPaintProperty).toHaveBeenCalledWith(LAYER.hoverBorder, 'line-color', '#f59e0b')
  })

  it('clears the hoverBorder filter on cleanup (round-ended → playing transition)', () => {
    const { ref, calls } = createFakeMapRef()
    const session = buildSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: { reveal: buildRevealWrong({ kind: 'country', targetCca3: 'FRA' }), endsGame: false },
    })
    const { rerender } = renderHook(({ s }) => useRevealMapEffects({
      session: s, mode: getMode('country-pinning', POOLS), mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }), { initialProps: { s: session } })
    calls.setFilter.mockClear()
    rerender({ s: { ...session, status: 'playing', lastOutcome: null } })
    expect(calls.setFilter).toHaveBeenCalledWith(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
  })

  it('flashes the clicked country with correctness colour on intermediate attempt (best-of-N daily)', () => {
    const { ref, calls } = createFakeMapRef()
    const session = buildSession({
      status: 'playing',
      modeId: 'country-pinning',
      attemptsPerRound: 3,
      attemptsRemaining: 2,
      currentAttempts: [buildAttempt({ reveal: buildRevealWrong({ kind: 'country', clickedCca3: 'GBR', correct: false }) })],
      dailyDate: '2026-05-14',
    })
    // Note: the intermediate effect anchors on `prevStatus !== 'playing' → status === 'playing'`.
    // To trigger the flash we rerender from idle → playing.
    const idle = { ...session, status: 'idle' as const, currentAttempts: [] }
    const { rerender } = renderHook(({ s }) => useRevealMapEffects({
      session: s, mode: getMode('country-pinning', POOLS), mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }), { initialProps: { s: idle } })
    rerender({ s: session })
    expect(calls.setPaintProperty).toHaveBeenCalledWith(LAYER.hoverBorder, 'line-color', '#f59e0b')
  })

  it('flyTo on round-start when mode.initialCameraView === "world"', () => {
    const { ref, calls } = createFakeMapRef()
    const mode = getMode('city-guessing', POOLS) // city-guessing uses world view per its mode definition (verify in src/game/modes/)
    const session = buildSession({ status: 'playing', modeId: 'city-guessing', currentRound: buildRound({ kind: 'city-guessing' }), roundIndex: 0 })
    renderHook(() => useRevealMapEffects({
      session, mode, mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }))
    expect(calls.flyTo).toHaveBeenCalled()
  })

  it('attaches a click handler in city-guessing playing state and detaches on unmount', () => {
    const { ref, calls } = createFakeMapRef()
    const session = buildSession({ status: 'playing', modeId: 'city-guessing', currentRound: buildRound({ kind: 'city-guessing' }) })
    const { unmount } = renderHook(() => useRevealMapEffects({
      session, mode: getMode('city-guessing', POOLS), mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }))
    expect(calls.on).toHaveBeenCalledWith('click', expect.any(Function))
    unmount()
    expect(calls.off).toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('does NOT attach a click handler in country-pinning mode', () => {
    const { ref, calls } = createFakeMapRef()
    const session = buildSession({ status: 'playing', modeId: 'country-pinning', currentRound: buildRound({ kind: 'country-pinning' }) })
    renderHook(() => useRevealMapEffects({
      session, mode: getMode('country-pinning', POOLS), mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }))
    expect(calls.on).not.toHaveBeenCalled()
  })

  it('clears reveal sources on transition to idle', () => {
    const { ref, calls } = createFakeMapRef()
    const session = buildSession({ status: 'round-ended', modeId: 'country-pinning' })
    const { rerender } = renderHook(({ s }) => useRevealMapEffects({
      session: s, mode: getMode('country-pinning', POOLS), mapRef: ref, byCca3: new Map(), submitGuessInput: vi.fn(),
    }), { initialProps: { s: session } })
    calls.setData.mockClear()
    rerender({ s: { ...session, status: 'idle' as const } })
    // clearRevealSources calls setData on both marker + line sources with an empty FeatureCollection.
    expect(calls.setData).toHaveBeenCalled()
  })
})
```

(8 tests cover the key branches. The rAF animation step itself is not unit-tested at frame granularity — that's covered by `e2e/animation-interrupt.spec.ts`. The unit tests verify the **start** and **cleanup** of the rAF loop, not the per-frame behaviour.)

- [ ] **Step 2: Run — expected FAIL** (`Cannot find module '../useRevealMapEffects'`).

### Task 4.3: Extract the hook

**Files:**
- Create: `src/game/hooks/useRevealMapEffects.ts`
- Modify: `src/game/GameController.tsx`: delete lines 484–705 (four effects), delete refs at 458–459, delete helpers `ensureRevealSources` (67–101) and `clearRevealSources` (103–111).

- [ ] **Step 1: Create the hook file**

The hook combines the four extracted effects under one exported function. Internal helpers `ensureRevealSources` and `clearRevealSources` move here (private to the hook file):

```ts
// src/game/hooks/useRevealMapEffects.ts
import { useEffect, useRef, type RefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryLike, GameMode, GameSession, GuessInput } from '../shared/types'
import { LAYER } from '../../lib/mapLayers'
import { tessellateArc } from '../shared/distance'
import { computeRevealAnimationPlan } from '../shared/revealAnimation'
import { prefersReducedMotion } from '../../lib/motion'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../../lib/mapStyles'
import {
  REVEAL_MARKER_SOURCE, REVEAL_LINE_SOURCE,
  REVEAL_MARKER_LAYER, REVEAL_LINE_LAYER,
} from '../shared/revealLayers'

function ensureRevealSources(map: maplibregl.Map): void { /* … verbatim from current lines 67–101 … */ }
function clearRevealSources(map: maplibregl.Map): void { /* … verbatim from current lines 103–111 … */ }

interface Args {
  session: GameSession
  mode: GameMode | null
  mapRef: RefObject<maplibregl.Map | null>
  byCca3: Map<string, CountryLike>
  submitGuessInput: (input: GuessInput) => void
}

export function useRevealMapEffects({ session, mode, mapRef, byCca3, submitGuessInput }: Args): void {
  const lastIntermediateAttemptCountRef = useRef(0)
  const prevStatusForIntermediateRef = useRef<GameSession['status']>('idle')

  // Effect 1: reveal geometry on round-ended (verbatim from lines 484–606)
  useEffect(() => { /* … */ }, [session.status, session.lastOutcome, byCca3])

  // Effect 2: intermediate-reveal flashes (verbatim from lines 608–675)
  useEffect(() => { /* … */ }, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])

  // Effect 3: camera reset on round start (verbatim from lines 677–685)
  useEffect(() => { /* … */ }, [session.status, session.roundIndex, mode])

  // Effect 4: city-mode any-click handler (verbatim from lines 687–698)
  useEffect(() => { /* … */ }, [session.status, session.modeId, submitGuessInput])

  // Effect 5: idle-state reveal clear (verbatim from lines 700–705)
  useEffect(() => { /* … */ }, [session.status])
}
```

The five effect bodies copy verbatim from the current GameController; their dependency arrays are unchanged.

- [ ] **Step 2: Replace in GameController.tsx**

Delete lines 67–111 (helpers), 458–459 (refs), 484–705 (the four effects + idle-clear). Insert the hook call near the other hook calls:

```tsx
useRevealMapEffects({ session, mode, mapRef, byCca3, submitGuessInput })
```

Add the import: `import { useRevealMapEffects } from './hooks/useRevealMapEffects'`.

### Task 4.4: Re-run tests

- [ ] **Step 1: Unit tests**

```bash
npm run test:unit -- src/game/hooks/__tests__/useRevealMapEffects.test.tsx
```

Expected: All 8 tests PASS.

- [ ] **Step 2: Animation + game e2e**

```bash
npx playwright test --project=chromium-gpu e2e/animation-interrupt.spec.ts e2e/daily-reveal.spec.ts e2e/daily-best-of-3.spec.ts e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts e2e/daily-survives-ocean-click.spec.ts
```

Expected: PASS. These exercise the reveal animation, intermediate flashes, and the city-mode any-click.

### Task 4.5: Commit and PR

- [ ] **Step 1: Commit**

```bash
git add src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx src/game/hooks/__tests__/fakeMapRef.ts src/game/GameController.tsx
git commit -m "refactor: extract useRevealMapEffects from GameController

Pulls 5 MapLibre-interacting effects out of GameController.tsx into
a single hook: reveal geometry (rAF arc animation), intermediate
attempt flashes, camera reset on round start, city-mode any-click
handler, and idle-state reveal-source clear. Private helpers
ensureRevealSources / clearRevealSources move with them.

Part of the GameController extraction plan."
```

- [ ] **Step 2: Push and PR**

```bash
git push -u origin refactor/extract-use-reveal-map-effects
gh pr create --base main --title "refactor: extract useRevealMapEffects from GameController"
```

---

## Phase 5 — Extract `useHashGameRouter` (riskiest, last)

**Why last:** This is the most tangled extraction: hash bootstrap, hashchange handler, deferred-pool drain, deep-link analytics, intermediate-attempt telemetry, and the wasGameOver / atomicRestart bug-#32 workaround. It owns four of the nine ref-mirrors (`statusRef`, `lastRevealEmitHashRef`, `pendingStartRef`, plus the telemetry pair `lastAttemptCountRef` and `prevStatusForTelemetryRef`). The `statusRef` mirror in particular is the explicit closure-staleness workaround whose comments cite bug #32; touching it requires care. By landing this last, every earlier extraction has narrowed the surface, and the characterization tests for hash-bootstrap can be written against a controller that's already 80% the size of today's.

**Source:** Currently inlined at `src/game/GameController.tsx:173–331` (hash router + deferred drain) and `455–482` (intermediate-attempt telemetry). Refs: 126 (`pendingStartRef`), 132 (`lastRevealEmitHashRef`), 174 (`statusRef`), 455 (`lastAttemptCountRef`), 456 (`prevStatusForTelemetryRef`). Also the `startOrResumeDaily` callback at lines 146–171 and the in-file helper `writeIdleHash` at 41–47 (still used by other code paths, so keep `writeIdleHash` in `GameController.tsx`).

### Task 5.1: Branch from main

- [ ] **Step 1**: Branch from main.

```bash
git checkout main && git pull --ff-only origin main && git checkout -b refactor/extract-use-hash-game-router
```

### Task 5.2: Write the characterization test

**Files:**
- Create: `src/game/hooks/__tests__/useHashGameRouter.test.tsx`

The hash-router is dependency-heavy (`dailyPuzzles.byDate`, `dailyHistoryGet`, `parseHash`, the reducer dispatchers). The characterization tests use a thin wrapper that exposes the dispatcher spies:

- [ ] **Step 1: Write tests for the major branches**

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useHashGameRouter } from '../useHashGameRouter'
import { buildSession } from '../../shared/__tests__/factories'

const POOLS = { countries: [/* USA + FRA */], cities: [/* NYC + Paris */] }

function setHash(path: string): void {
  window.location.hash = path
}

describe('useHashGameRouter', () => {
  let analytics: Array<{ name: string; props: Record<string, unknown> }>

  beforeEach(() => {
    analytics = []
    ;(window as unknown as { __testAnalytics?: typeof analytics }).__testAnalytics = analytics
    ;(window as unknown as { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
    window.location.hash = ''
    localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    delete (window as unknown as { __testAnalytics?: unknown }).__testAnalytics
    delete (window as unknown as { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__
  })

  it('starts a free game on hash bootstrap when status=idle, pools loaded, valid game route', () => {
    setHash('#game/country-pinning')
    const start = vi.fn()
    const session = buildSession({ status: 'idle' })
    renderHook(() => useHashGameRouter({
      session, mode: null, pools: POOLS, byCca3: new Map(),
      dailyPuzzles: { byDate: () => null }, dailyHistoryGet: () => null,
      start, resume: vi.fn(), restart: vi.fn(), endGame: vi.fn(),
    }))
    expect(start).toHaveBeenCalledWith('country-pinning', expect.objectContaining({ kind: 'country-pinning' }), expect.any(Number))
    expect(analytics.find((e) => e.name === 'free_started')).toBeDefined()
  })

  it('defers start when pools are empty, then drains once pools arrive', () => {
    setHash('#game/country-pinning')
    const start = vi.fn()
    const session = buildSession({ status: 'idle' })
    const { rerender } = renderHook(({ p }) => useHashGameRouter({
      session, mode: null, pools: p, byCca3: new Map(),
      dailyPuzzles: { byDate: () => null }, dailyHistoryGet: () => null,
      start, resume: vi.fn(), restart: vi.fn(), endGame: vi.fn(),
    }), { initialProps: { p: { countries: [], cities: [] } } })
    expect(start).not.toHaveBeenCalled()
    rerender({ p: POOLS })
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('emits deep_link_opened with outcome=reveal exactly once for a reveal-route hash', () => {
    setHash('#daily/2026-05-13/country-pinning/reveal')
    const session = buildSession({ status: 'idle' })
    const { rerender } = renderHook(({ s }) => useHashGameRouter({
      session: s, mode: null, pools: POOLS, byCca3: new Map(),
      dailyPuzzles: { byDate: () => null }, dailyHistoryGet: () => null,
      start: vi.fn(), resume: vi.fn(), restart: vi.fn(), endGame: vi.fn(),
    }), { initialProps: { s: session } })
    const initialCount = analytics.filter((e) => e.name === 'deep_link_opened').length
    expect(initialCount).toBe(1)
    rerender({ s: { ...session, lives: session.lives - 1 } }) // unrelated rerender
    const afterCount = analytics.filter((e) => e.name === 'deep_link_opened').length
    expect(afterCount).toBe(1) // dedup
  })

  it('dispatches restart instead of start+endGame when arriving in game-over state with a playable route', () => {
    setHash('#game/country-pinning')
    const start = vi.fn()
    const restart = vi.fn()
    const endGame = vi.fn()
    const session = buildSession({ status: 'game-over' })
    renderHook(() => useHashGameRouter({
      session, mode: null, pools: POOLS, byCca3: new Map(),
      dailyPuzzles: { byDate: () => null }, dailyHistoryGet: () => null,
      start, resume: vi.fn(), restart, endGame,
    }))
    expect(restart).toHaveBeenCalledTimes(1)
    expect(start).not.toHaveBeenCalled()
    expect(endGame).not.toHaveBeenCalled()
  })

  it('redirects future-dated daily to root', () => {
    const tomorrow = '2099-12-31'
    setHash(`#daily/${tomorrow}/country-pinning`)
    const session = buildSession({ status: 'idle' })
    renderHook(() => useHashGameRouter({
      session, mode: null, pools: POOLS, byCca3: new Map(),
      dailyPuzzles: { byDate: () => null }, dailyHistoryGet: () => null,
      start: vi.fn(), resume: vi.fn(), restart: vi.fn(), endGame: vi.fn(),
    }))
    expect(window.location.hash).toBe('') // root
    expect(analytics.find((e) => e.name === 'deep_link_opened' && e.props.outcome === 'redirect')).toBeDefined()
  })

  it('redirects past-dated daily to /reveal', () => {
    setHash('#daily/2020-01-01/country-pinning')
    const session = buildSession({ status: 'idle' })
    renderHook(() => useHashGameRouter({
      session, mode: null, pools: POOLS, byCca3: new Map(),
      dailyPuzzles: { byDate: () => null }, dailyHistoryGet: () => null,
      start: vi.fn(), resume: vi.fn(), restart: vi.fn(), endGame: vi.fn(),
    }))
    expect(window.location.hash).toMatch(/\/reveal$/)
  })

  it('resumes from localStorage when a daily resume blob matches today + mode', () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('funworldmap-daily-resume', JSON.stringify({
      version: 1, date: today, modeId: 'country-pinning',
      attempts: [{ input: { kind: 'country', cca3: 'USA' }, reveal: { kind: 'country', correct: false }, pointsEarned: 0, attemptIndex: 0 }],
    }))
    setHash(`#daily/${today}/country-pinning`)
    const resume = vi.fn()
    const session = buildSession({ status: 'idle' })
    renderHook(() => useHashGameRouter({
      session, mode: null, pools: POOLS, byCca3: new Map(),
      dailyPuzzles: { byDate: () => ({ country: { cca3: 'USA' }, city: { id: 'paris' } }) },
      dailyHistoryGet: () => null,
      start: vi.fn(), resume, restart: vi.fn(), endGame: vi.fn(),
    }))
    expect(resume).toHaveBeenCalledWith(expect.objectContaining({ modeId: 'country-pinning', attempts: expect.any(Array) }))
  })

  it('fires daily_attempted on intermediate attempt when attemptsPerRound > 1', () => {
    const session = buildSession({
      status: 'playing', modeId: 'country-pinning', attemptsPerRound: 3,
      currentAttempts: [{ input: { kind: 'country', cca3: 'USA' }, reveal: { kind: 'country', correct: false }, pointsEarned: 40, attemptIndex: 0 }],
    })
    const idle = { ...session, status: 'idle' as const, currentAttempts: [] }
    const { rerender } = renderHook(({ s }) => useHashGameRouter({
      session: s, mode: null, pools: POOLS, byCca3: new Map(),
      dailyPuzzles: { byDate: () => null }, dailyHistoryGet: () => null,
      start: vi.fn(), resume: vi.fn(), restart: vi.fn(), endGame: vi.fn(),
    }), { initialProps: { s: idle } })
    analytics.length = 0
    rerender({ s: session })
    expect(analytics.find((e) => e.name === 'daily_attempted')).toBeDefined()
  })
})
```

(8 tests cover bootstrap, defer-and-drain, reveal-dedup, restart-on-game-over, past/future redirect, resume, and intermediate-attempt telemetry. Two further behaviours — the leaving-game-route → endGame and the hashchange listener for runtime navigation — get one test each, brought to 10. Edge cases beyond these are deferred to e2e.)

`buildSession` returns `unknown` in factories.ts; for the tests pass it through `as GameSession` if necessary.

- [ ] **Step 2: Run — expected FAIL** (hook doesn't exist).

### Task 5.3: Extract the hook

**Files:**
- Create: `src/game/hooks/useHashGameRouter.ts`
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Create the hook file**

Move the hash-router logic, the deferred-drain effect, the intermediate-attempt telemetry effect, and the `startOrResumeDaily` callback. The hook returns `{ statusRef }` so the test-seam hook (Phase 1) can read it.

```ts
// src/game/hooks/useHashGameRouter.ts
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { CityLike, CountryLike, GameMode, GameSession, ModeId, RoundSpec, AttemptRecord } from '../shared/types'
import { parseHash } from '../../lib/hashState'
import { track } from '../../lib/analytics'
import { dispatchToast } from '../../lib/toast'
import { readResume, clearResume } from '../daily/resume'
import { toLocalDateString, classifyDate } from '../daily/dates'
import { buildCountryDailyRound, buildCityDailyRound } from '../daily/dailyRound'
import { getMode } from '../modes'

const DAILY_ATTEMPTS_PER_ROUND = 3

/**
 * Public options interface for useHashGameRouter. Exported alongside the hook
 * so call sites (currently just GameController) get typed completion and so
 * future fields can be added without changing the positional contract.
 */
export interface UseHashGameRouterOptions {
  session: GameSession
  mode: GameMode | null
  pools: { countries: CountryLike[]; cities: CityLike[] }
  byCca3: Map<string, CountryLike>
  dailyPuzzles: { byDate: (date: string) => { country: { cca3: string }; city: { id: string } } | null }
  dailyHistoryGet: (date: string, modeId: ModeId) => unknown
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number, dailyDate?: string | null) => void
  resume: (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }) => void
  restart: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number, dailyDate?: string | null) => void
  endGame: () => void
}

export function useHashGameRouter(opts: UseHashGameRouterOptions): { statusRef: RefObject<GameSession['status']> } {
  const { session, pools, byCca3, dailyPuzzles, dailyHistoryGet, start, resume, restart, endGame } = opts
  const { countries, cities } = pools

  const pendingStartRef = useRef<ModeId | null>(null)
  const lastRevealEmitHashRef = useRef<string | null>(null)
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  const startOrResumeDaily = useCallback(
    (id: ModeId, date: string, firstRound: RoundSpec, atomicRestart = false): void => {
      // …verbatim from GameController.tsx:146–171…
    },
    [start, resume, restart],
  )

  useEffect(() => {
    const check = () => {
      // …verbatim from GameController.tsx:176–296…
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, cities.length, dailyPuzzles.byDate, dailyHistoryGet])

  // Deferred-pool drain.
  useEffect(() => {
    // …verbatim from GameController.tsx:304–331…
  }, [countries, cities, session.status, pools, start, startOrResumeDaily, dailyPuzzles])

  // Intermediate-attempt telemetry.
  const lastAttemptCountRef = useRef(0)
  const prevStatusForTelemetryRef = useRef<GameSession['status']>('idle')
  useEffect(() => {
    // …verbatim from GameController.tsx:460–482…
  }, [session.status, session.currentAttempts, session.attemptsPerRound, session.modeId])

  return { statusRef }
}
```

- [ ] **Step 2: Replace in GameController.tsx**

Delete lines 41–47 (helper `writeIdleHash` — actually KEEP, still used by Escape-exit handler), 126 (`pendingStartRef`), 132 (`lastRevealEmitHashRef`), 146–171 (`startOrResumeDaily`), 173–301 (hash-router effect), 304–331 (deferred drain), 455–456 (telemetry refs), 460–482 (telemetry effect). Replace with the hook call:

```tsx
const { statusRef } = useHashGameRouter({
  session, mode, pools, byCca3,
  dailyPuzzles, dailyHistoryGet,
  start, resume, restart, endGame,
})
```

Then update the `useGameTestSeams` call to pass the returned `statusRef` (replacing the temporary inline `statusRef` declaration that Phase 1 introduced).

Add the import: `import { useHashGameRouter } from './hooks/useHashGameRouter'`.

### Task 5.4: Re-run tests

- [ ] **Step 1: Unit tests**

```bash
npm run test:unit -- src/game/hooks/__tests__/useHashGameRouter.test.tsx
```

Expected: All 10 tests PASS.

- [ ] **Step 2: Full hash / daily / deep-link e2e**

```bash
npx playwright test --project=chromium-gpu e2e/daily-deep-link.spec.ts e2e/cold-load-deep-link.spec.ts e2e/daily-reveal.spec.ts e2e/daily-best-of-3.spec.ts e2e/daily-share.spec.ts e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Full reducer unit suite as a global regression net**

```bash
npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts
```

Expected: 44 tests PASS (unchanged; the reducer is untouched). If any test fails here, you've accidentally changed reducer dispatch ordering — STOP.

### Task 5.5: Commit and PR

- [ ] **Step 1: Commit**

```bash
git add src/game/hooks/useHashGameRouter.ts src/game/hooks/__tests__/useHashGameRouter.test.tsx src/game/GameController.tsx
git commit -m "refactor: extract useHashGameRouter from GameController

Pulls the hash bootstrap, hashchange handler, deferred-pool drain,
deep-link analytics, and intermediate-attempt telemetry out of
GameController.tsx into a dedicated hook. Owns statusRef,
pendingStartRef, lastRevealEmitHashRef, plus the two telemetry refs.

The wasGameOver/atomicRestart bug-#32 workaround is preserved
verbatim — the reducer's restart action remains the atomic path.

This is the final phase of the GameController extraction plan.
GameController.tsx is now ~120 lines (down from 833)."
```

- [ ] **Step 2: Push and PR**

```bash
git push -u origin refactor/extract-use-hash-game-router
gh pr create --base main --title "refactor: extract useHashGameRouter from GameController" --body "Final of five extraction PRs. After this lands, GameController.tsx is ~120 lines; the reducer is untouched throughout."
```

---

## Sequencing and critical path

Phases execute strictly in order. Each phase blocks the next:

```
Phase 1 (useGameTestSeams)  →  Phase 2 (useDailyResumePersistence)
       ↓
Phase 3 (useGameAnnouncements)
       ↓
Phase 4 (useRevealMapEffects)
       ↓
Phase 5 (useHashGameRouter)
```

The dependencies are:

- Phase 1's `statusRef` is plumbed from `GameController.tsx` as a temporary inline `useRef`; Phase 5 replaces that source with the hook's return value. If Phase 5 fails review and is reverted, Phase 1's inline `statusRef` continues to work.
- Phases 2–4 are independent of each other but ordered by risk (safest → riskiest middle-tier).
- Phase 5 must land last because its return value is referenced by Phase 1's input.

**Cadence:** ~1 phase per calendar week. The GameController is a hot file (game-flow PRs land regularly); spacing extractions a week apart keeps the merge-conflict surface manageable. Announce each extraction in the corresponding tracking issue before opening the PR so reviewers can coordinate.

**Cancellation:** Reverting any single extraction PR restores that phase's inlined effect; the other phases continue to work because each hook is imported by name. The order of revert doesn't matter except that reverting Phase 5 alone leaves Phase 1's `statusRef` reading the inline ref (already valid).

---

## What's NOT in this plan (out of scope)

These came up during the audit but are deferred to future work; do NOT expand this plan to cover them:

1. **Mode-name de-branching.** `session.modeId === 'country-pinning'` literal-string checks appear throughout GameController, the extracted hooks, and the modes registry. A polymorphic-on-mode design (each mode owns its own announcement, reveal-paint, and resume shapes) is a separate refactor. Out of scope.
2. **Reducer redesign to eliminate `restart` action.** Bug #32's fix introduced an atomic `restart` action because the two-step `endGame + start` produced an intermediate `status='idle'` commit that unmounted the HUD on slow CI. The right long-term fix is to make the HUD tolerant of momentary `idle` (or to use a `useTransition` so the React commit batches). Either is a separate plan.
3. **`GameSessionProvider` gating changes.** `mode` becomes `null` when pools are empty. The current behaviour is "render-but-do-nothing"; some consumers (the `setRound` test seam) check `!mode` and return false. A cleaner gate at the provider level is a separate refactor.
4. **Folder rename `GameController.tsx → GameController/index.tsx`.** Co-locating sub-files with the parent is a stylistic choice the codebase hasn't yet committed to. Out of scope.
5. **Replacing ref-mirrors with `useSyncExternalStore` or a commit-driven pattern.** Most refs (`statusRef` especially) exist because event-handler closures need the live value. The right replacement is either `useSyncExternalStore` or moving the closure-driven logic to a reducer effect. Each ref individually warrants a small standalone refactor; doing them en-masse during extraction would invalidate the "behaviour preserved" claim of the characterization tests. Out of scope.
6. **E2E coverage gap analysis for the new hooks.** Where this plan adds unit tests, it does NOT also add new e2e tests for the same behaviour. The existing e2e suite (16 game/daily specs) is the second-line regression net; if a new gap appears post-extraction, file it separately.
7. **Performance work (memoisation review of the new hooks).** Out of scope. The dependency arrays are copied verbatim from the inlined effects; any pre-existing over-rendering is preserved, not amplified.

---

## Self-review (run by the plan author after writing)

**Spec coverage**

- File map present? Yes — five hooks, each with its public-API sketch.
- Phased tasks, safest → riskiest? Yes — `useGameTestSeams` (production-no-op when flag off) → `useDailyResumePersistence` (single localStorage write) → `useGameAnnouncements` (live-region + timers) → `useRevealMapEffects` (MapLibre paint + rAF) → `useHashGameRouter` (hash routing + closure-staleness ref). The order matches risk.
- Per-task TDD shape? Yes — each phase writes the test first, runs to verify red-or-locked-in behaviour, extracts, re-runs.
- Scope check argument? Yes — `## Scope check — why one plan with 5 phases`.
- Explicit deferrals? Yes — `## What's NOT in this plan`, 7 items.

**Placeholder scan**

- "TODO" / "TBD" / "fill in details"? Searched — only present inside verbatim quoted comments (e.g. "//…verbatim from current lines 484–606…" in the Phase 5 hook sketch). These are intentional placeholders for "copy this block verbatim" and explicitly cite their source. Acceptable per the writing-plans skill — they're not asking the engineer to invent code, they're pointing at the exact lines to copy.
- "Similar to Task N"? None — each test snippet is fully spelled.
- Steps without code blocks where code is implied? None — every code-touching step has a code block.

**Type consistency**

- `submitGuessInput`, `start`, `restart`, `resume`, `advance`, `endGame`, `finalize`, `overrideRound`, `record`, `recordDailyResult`, `dailyHistoryGet`, `dailyPuzzles.byDate` all appear with consistent signatures across phases. Verified against the actual `GameSessionApi` type in `src/game/shared/GameSessionProvider.tsx:7–20`.
- `statusRef` is `RefObject<GameSession['status']>` in both Phase 1's input and Phase 5's return. Match.
- `byCca3` is `Map<string, CountryLike>` in all phases. Match.
- `mapRef` is `RefObject<maplibregl.Map | null>` in Phase 4. Consistent with `useMap`'s return.

**One gap discovered during review**

The Phase 5 hook's `dailyPuzzles` type in the test setup uses the structural type `{ byDate: (date: string) => { country: { cca3: string }; city: { id: string } } | null }`. In the real codebase, `useDailyPuzzlesContext()` returns a richer object. The hook's type should accept the full interface; the test passes a partial. If `tsc` complains, the test should use `as unknown as ReturnType<typeof useDailyPuzzlesContext>`. Adding this note as guidance for the implementer.

---

## Execution

When ready to execute (a future session — this is plan-only):

- Per the writing-plans skill, recommend **Subagent-Driven Execution**: one fresh subagent per phase, two-stage review (the plan-author reviews the spec→test mapping; the code-reviewer reviews the extraction diff).
- Each phase is a self-contained PR; the subagent's job at that level is "branch, characterization test, extract, verify, PR."
- This plan is one input; the per-phase subagent should re-read the relevant `GameController.tsx` source range in its own context before writing the hook.
