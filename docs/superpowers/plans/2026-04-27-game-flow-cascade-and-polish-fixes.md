# Game-flow Cascade & Polish Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the seven bugs identified in the 2026-04-27 critical assessment. The headline defect is a six-symptom cascade triggered by a single ocean / off-globe click during a country-pinning game; the remaining four are smaller HIGH/LOW polish items.

**Architecture:** Stop using `window.location.hash` as the session-state oracle for "is this a daily?". Add `dailyDate: string | null` to `GameSession`, threaded through `start` / `resume` reducer actions, consumed at three call sites (`GameController` resume-write, `GameController` game-over recording, `GameOverOverlay`) instead of `parseHash(window.location.hash)`. Defense-in-depth: gate `useMapInteractions.clickMap`'s `onDeselect` so off-target clicks during gameplay don't clear the URL hash. PR 2 then ships four mechanical fixes (free-mode End-game UX, redundant SR announcement, stale aria-live, reduced-motion mid-session toggle).

**Tech Stack:** React 19 (`useSyncExternalStore`, `useReducer`), TypeScript 5.7, Vite 6, Vitest 4 (unit, jsdom), Playwright 1.59 (e2e), `@testing-library/react` 16, MapLibre GL 5.

**Source spec:** [`docs/superpowers/specs/2026-04-27-game-flow-cascade-fixes-design.md`](../specs/2026-04-27-game-flow-cascade-fixes-design.md)

---

## Two-phase plan

This plan covers two PRs. **Phase 1** (Tasks 1–13) ships the cascade fix on its own branch. **Phase 2** (Tasks 14–20) ships polish fixes on a second branch *after Phase 1 merges to `main`*. Branch names are specified in each phase header. Don't start Phase 2 until Phase 1 is on `main` — Phase 2 modifies files Phase 1 also modifies.

---

## File structure

### Phase 1 — Cascade fix

**Modified**
- `src/game/shared/types.ts` — add `dailyDate: string | null` field to `GameSession`
- `src/game/shared/useGameSession.ts` — add `dailyDate: null` to `EMPTY`; update `start` and `resume` reducer cases and hook callbacks to thread `dailyDate`
- `src/game/shared/GameSessionProvider.tsx` — extend `GameSessionApi` interface with the new `start` / `resume` signatures (this type is what `GameController` and other consumers see via `useGameSessionContext()`)
- `src/game/GameController.tsx` — pass `state.date` to `start` / `resume` from bootstrap; replace `parseHash` reads at the per-attempt resume-write effect and the game-over recording effect with `session.dailyDate`
- `src/game/shared/hud/GameOverOverlay.tsx` — replace `parseHash(window.location.hash)` with `session.dailyDate`; drop the `parseHash` import
- `src/hooks/useMapInteractions.ts` — add `sessionRef` (mirrors existing `onSelectRef` pattern); gate `clickMap`'s `onDeselect` on `sessionRef.current.status === 'idle'`
- `src/game/shared/__tests__/useGameSession.test.ts` — extend with `dailyDate` plumbing tests
- `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx` — drop `window.location.hash = …` setup; pass `session.dailyDate` directly
- `docs/systems/daily-puzzle.md` — one-line note on session-state plumbing

**Created**
- `e2e/daily-survives-ocean-click.spec.ts` — Playwright regression: ocean click during daily preserves end-of-game flow (covers the `clickMap` gate end-to-end)

### Phase 2 — Polish

**Modified**
- `src/game/shared/useGameSession.ts` — add `finishFree` action and hook callback
- `src/game/shared/GameSessionProvider.tsx` — add `finishFree: () => void` to `GameSessionApi`, destructure it from `useGameSession()`, include in `api` `useMemo`
- `src/game/GameController.tsx` — pull `finishFree` from context; branch `onEndGame` on `session.dailyDate`; delete the round-ended `dispatchAnnouncement` block (lines ~297-313)
- `src/App.tsx` — replace announce handler with one that schedules an 8 s clear timer
- `src/lib/motion.ts` — add `subscribeReducedMotion(cb)` API
- `src/hooks/useMapInstance.ts` — subscribe to reduced-motion changes; re-apply `map.setPitch` on toggle
- `src/game/shared/__tests__/useGameSession.test.ts` — `finishFree` action tests
- `src/lib/__tests__/motion.test.ts` — `subscribeReducedMotion` test (create if not present)

---

## Task order rationale

**Phase 1** lands in a strict dependency order: types first (Task 1), then the reducer (Tasks 2–3), then verification of preservation (Task 4), then call sites that depend on the reducer (Tasks 5–8), then test cleanup (Task 9), then the orthogonal map-interaction gate (Task 10), then end-to-end coverage (Task 11), docs (Task 12), and a final verification gate (Task 13). Each task ends with a commit.

**Phase 2** tasks are independent of each other after Task 14 (the new reducer action). Tasks 15–19 can be tackled in any order; they're listed below in commit-sequence order to keep the diff bisectable.

---

# Phase 1 — Cascade fix

**Branch:** `game-flow-cascade-fix`
**Target merge:** `main`

Start by creating the branch:

```bash
git checkout main && git pull
git checkout -b game-flow-cascade-fix
```

---

### Task 1: Add `dailyDate` field to `GameSession` and `EMPTY`

**Files:**
- Modify: `src/game/shared/types.ts`
- Modify: `src/game/shared/useGameSession.ts`
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `src/game/shared/__tests__/useGameSession.test.ts` inside the existing top-level `describe('useGameSession (post-collapse)', () => { … })` block, immediately after the `it('starts idle', …)` test:

```typescript
  it('starts with dailyDate null (free / idle has no daily date)', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.dailyDate).toBeNull()
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "dailyDate null" --no-coverage
```

Expected: FAIL with `Property 'dailyDate' does not exist on type 'GameSession'` (TypeScript) or `expected undefined to be null` (runtime).

- [ ] **Step 3: Add the field to the type**

In `src/game/shared/types.ts`, find the `GameSession` type (around line 87-102). Add `dailyDate` between `lastOutcome` and `used`:

```typescript
export type GameSession = {
  modeId: ModeId
  status: GameStatus
  lives: 0 | 1 | 2 | 3
  score: number
  streak: number
  bestStreak: number
  roundIndex: number
  maxRounds: number | null
  attemptsPerRound: number
  attemptsRemaining: number
  currentAttempts: AttemptRecord[]
  currentRound: RoundSpec | null
  lastOutcome: GuessOutcome | null
  dailyDate: string | null           // YYYY-MM-DD when this is a daily; null for free/idle
  used: Set<string>
}
```

- [ ] **Step 4: Add the field to `EMPTY`**

In `src/game/shared/useGameSession.ts`, find the `EMPTY` constant (around line 23-38). Add `dailyDate: null` between `lastOutcome` and `used`:

```typescript
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
  dailyDate: null,
  used: new Set(),
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "dailyDate null" --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Run typecheck — anything else broken?**

```bash
npx tsc -b --noEmit
```

Expected: PASS. The new field is optional-feeling because all reducer actions spread `...state` or `...EMPTY`. If you see a type error for an explicit `GameSession` literal somewhere (e.g. test fixtures), add `dailyDate: null` to that literal. Search for `GameSession =` and check each.

- [ ] **Step 7: Commit**

```bash
git add src/game/shared/types.ts src/game/shared/useGameSession.ts src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): add dailyDate field to GameSession and EMPTY"
```

---

### Task 2: Update `start` reducer action to accept and store `dailyDate`

**Files:**
- Modify: `src/game/shared/useGameSession.ts`
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe('start', () => { … })` block in `useGameSession.test.ts`:

```typescript
    it('stores dailyDate when passed (daily play)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('defaults dailyDate to null when not passed (free play)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      expect(result.current.session.dailyDate).toBeNull()
    })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "stores dailyDate|defaults dailyDate" --no-coverage
```

Expected: FAIL with `Expected 4 arguments, but got 5` (TypeScript) for the first test.

- [ ] **Step 3: Extend the `start` action shape**

In `src/game/shared/useGameSession.ts`, find the `Action` discriminated union (around line 14-22). Update the `start` member:

```typescript
type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null; attemptsPerRound: number; dailyDate: string | null }
  | { type: 'attempt'; input: GuessInput; result: ModeGuessResult }
  | { type: 'completeNow' }
  | { type: 'resume'; modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[] }
  | { type: 'advance'; nextRound: RoundSpec }
  | { type: 'overrideRound'; round: RoundSpec }
  | { type: 'endGame' }
```

- [ ] **Step 4: Update the `start` reducer case**

In the same file, find `case 'start': { … }` (around line 77-94). Add `dailyDate: action.dailyDate` to the returned object:

```typescript
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
        dailyDate: action.dailyDate,
        used: new Set([roundKey(action.firstRound)]),
      }
    }
```

- [ ] **Step 5: Update the hook's `start` callback**

In the same file, find the `useGameSession` return type and the `start` callback (around line 175-190). Update both:

Type signature in the return object of `useGameSession`:

```typescript
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number, dailyDate?: string | null) => void
```

Implementation:

```typescript
  const start = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound = 1, dailyDate: string | null = null) =>
      dispatch({ type: 'start', modeId, firstRound, maxRounds, attemptsPerRound, dailyDate }),
    [],
  )
```

`dailyDate` is optional with default `null` — every existing call site (free play) keeps working without changes.

- [ ] **Step 6: Update `GameSessionApi.start` in `GameSessionProvider.tsx`**

The `useGameSessionContext()` consumers (notably `GameController.tsx`) read `start` through this interface. If you don't update it, Task 5's 5-arg `start` call won't typecheck against the unmodified `GameSessionApi`.

Open `src/game/shared/GameSessionProvider.tsx`. Find the `GameSessionApi` type (around line 7-17). Update the `start` line:

```typescript
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number, dailyDate?: string | null) => void
```

(No other lines change — the destructuring at line 28 and the `api` `useMemo` are signature-agnostic.)

- [ ] **Step 7: Run the new tests to verify they pass**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "stores dailyDate|defaults dailyDate" --no-coverage
```

Expected: PASS.

- [ ] **Step 8: Run the entire `useGameSession` suite to confirm no regressions**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts --no-coverage
```

Expected: PASS — all existing tests still green (the `dailyDate` parameter is optional).

- [ ] **Step 9: Run typecheck**

```bash
npx tsc -b --noEmit
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/game/shared/useGameSession.ts src/game/shared/GameSessionProvider.tsx src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): thread dailyDate through start action"
```

---

### Task 3: Update `resume` reducer action to require `dailyDate`

**Files:**
- Modify: `src/game/shared/useGameSession.ts`
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`

Resume is daily-only (gated on `attemptsPerRound > 1`); `dailyDate` is required.

- [ ] **Step 1: Write the failing test**

Add to `useGameSession.test.ts`. Find an existing `describe('resume', …)` block — if one exists, add inside; otherwise add a new block adjacent to other top-level describes:

```typescript
  describe('resume', () => {
    it('stores dailyDate from the resume payload', () => {
      const { result } = renderHook(() => useGameSession())
      const r = round('ESP')
      const attemptInput: AttemptRecord = {
        pointsEarned: 50,
        input: countryInput('USA'),
        reveal: { kind: 'country', correct: false, targetCca3: 'ESP', clickedCca3: 'USA', clickedName: 'USA', distanceKm: 9000 },
      }
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: r,
          attemptsPerRound: 3,
          attempts: [attemptInput],
          dailyDate: '2026-04-27',
        })
      })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.currentAttempts).toHaveLength(1)
      expect(result.current.session.attemptsRemaining).toBe(2)
    })
  })
```

If `describe('resume', …)` already exists, add only the test body inside it (and replace any older test that covered the same scenario without `dailyDate`).

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "stores dailyDate from the resume" --no-coverage
```

Expected: FAIL with `Object literal may only specify known properties, and 'dailyDate' does not exist in type …`.

- [ ] **Step 3: Extend the `resume` action shape**

In `src/game/shared/useGameSession.ts`, update the `resume` action in the `Action` union:

```typescript
  | { type: 'resume'; modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }
```

(`dailyDate: string` not `string | null` — resume is daily-only so the date is required.)

- [ ] **Step 4: Update the `resume` reducer case**

Find `case 'resume': { … }` (around line 124-138). Add `dailyDate: action.dailyDate`:

```typescript
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
        dailyDate: action.dailyDate,
        used: new Set([roundKey(action.round)]),
      }
    }
```

- [ ] **Step 5: Update the hook's `resume` callback**

Find the `resume` callback (around line 196-200). Update both type and implementation:

Return-type signature in the `useGameSession` return object:

```typescript
  resume: (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }) => void
```

Implementation (already takes `payload` and spreads — just verify it forwards `dailyDate`):

```typescript
  const resume = useCallback(
    (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }) =>
      dispatch({ type: 'resume', ...payload }),
    [],
  )
```

- [ ] **Step 6: Update `GameSessionApi.resume` in `GameSessionProvider.tsx`**

Open `src/game/shared/GameSessionProvider.tsx`. Update the `resume` line in `GameSessionApi`:

```typescript
  resume: (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }) => void
```

- [ ] **Step 7: Run the new test to verify it passes**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "stores dailyDate from the resume" --no-coverage
```

Expected: PASS.

- [ ] **Step 8: Run the full `useGameSession` suite + typecheck**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts --no-coverage
npx tsc -b --noEmit
```

Expected: vitest PASS. tsc may fail at the `GameController.tsx:125` resume call site — leave that for Task 5 (it's the next task to fix).

- [ ] **Step 9: Commit**

```bash
git add src/game/shared/useGameSession.ts src/game/shared/GameSessionProvider.tsx src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): thread dailyDate through resume action"
```

---

### Task 4: Confirm other actions preserve `dailyDate`

This is a verification-only task — `attempt`, `completeNow`, `advance`, `overrideRound` all spread `...state` and should preserve `dailyDate` automatically. `endGame` returns `{ ...EMPTY, used: new Set() }` and resets `dailyDate` to `null` via the spread. This task locks that behaviour into the test suite.

**Files:**
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1: Write the tests**

Add at the bottom of the top-level `describe('useGameSession (post-collapse)', …)` block:

```typescript
  describe('dailyDate preservation', () => {
    it('attempt preserves dailyDate', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('completeNow preserves dailyDate', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('endGame resets dailyDate to null', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
      act(() => { result.current.endGame() })
      expect(result.current.session.dailyDate).toBeNull()
    })
  })
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "dailyDate preservation" --no-coverage
```

Expected: PASS (all four). The reducer already spreads `...state` for `attempt` / `completeNow` / `advance` / `overrideRound`; `endGame` returns `...EMPTY` which resets the field. No reducer changes needed.

If any test fails, do NOT add a code change — instead inspect why the spread isn't preserving the field and fix the root cause in the reducer (this would indicate a missed action).

- [ ] **Step 3: Commit**

```bash
git add src/game/shared/__tests__/useGameSession.test.ts
git commit -m "test(game): assert dailyDate preserved across reducer actions"
```

---

### Task 5: GameController bootstrap passes `dailyDate` to `start` / `resume`

**Files:**
- Modify: `src/game/GameController.tsx`

The bootstrap effect at `GameController.tsx:139-238` parses the hash and calls `start` (free) or `startOrResumeDaily` (daily). The deferred-pool drain effect at `:241-268` does the same for late-arriving pools. Both must thread the daily date.

- [ ] **Step 1: Update `startOrResumeDaily` to pass `dailyDate`**

Find `startOrResumeDaily` (around line 121-134). Update the body:

```typescript
  const startOrResumeDaily = useCallback(
    (id: ModeId, date: string, firstRound: RoundSpec): void => {
      const resumed = readResume()
      if (resumed && resumed.date === date && resumed.modeId === id && resumed.attempts.length > 0) {
        resume({
          modeId: id,
          round: firstRound,
          attemptsPerRound: DAILY_ATTEMPTS_PER_ROUND,
          attempts: resumed.attempts,
          dailyDate: date,
        })
        track('deep_link_opened', { dateKind: 'today', outcome: 'resume' })
        return
      }
      start(id, firstRound, 1, DAILY_ATTEMPTS_PER_ROUND, date)
      track('deep_link_opened', { dateKind: 'today', outcome: 'start' })
      track('daily_started', { mode: id })
    },
    [start, resume],
  )
```

The free-play bootstrap call at `:227` is `start(id, firstRound, m.maxRounds)` — leave it untouched. The new optional `dailyDate` parameter defaults to `null`, which is correct for free play.

The deferred-pool drain at `:266` is also `start(pending, firstRound, m.maxRounds)` — also unchanged. The deferred-daily branch at `:260` calls `startOrResumeDaily`, which is now correct.

- [ ] **Step 2: Run typecheck — was Task 3's tsc breakage at this line resolved?**

```bash
npx tsc -b --noEmit
```

Expected: PASS — `resume` now receives the required `dailyDate`, and `start` calls receive the optional fifth argument where appropriate.

- [ ] **Step 3: Run the unit suite**

```bash
npx vitest run --no-coverage
```

Expected: PASS — every existing test still green. (Most existing tests don't go through `GameController`; those that do — like `useDailyHistory` integration tests — don't construct sessions through the bootstrap.)

- [ ] **Step 4: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "feat(game): pass dailyDate from bootstrap to start/resume"
```

---

### Task 6: Per-attempt resume write reads `session.dailyDate` instead of hash

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Update the per-attempt resume-write effect**

Find the effect that calls `writeResume` (around line 271-283). Replace it:

```typescript
  // Persist daily best-of-N progress to localStorage so refresh resumes.
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
```

Three behavioural changes:
1. The hash-parse + guard is replaced with `session.dailyDate === null` early-return.
2. The date written to the resume blob comes from `session.dailyDate` (which the reducer set at `start`/`resume` time).
3. `session.dailyDate` and `session.modeId` are added to the effect's dep array. (`session.modeId` was previously read from hash; now it's session-state.)

- [ ] **Step 2: Run typecheck**

```bash
npx tsc -b --noEmit
```

Expected: PASS. If the `parseHash` import is now unused in this file, leave it for now — it's still used at `:141`, `:247`, and `:370` until Task 7.

- [ ] **Step 3: Run the unit suite**

```bash
npx vitest run --no-coverage
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "refactor(game): per-attempt resume write reads session.dailyDate"
```

---

### Task 7: Game-over recording effect reads `session.dailyDate`

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Update the game-over recording branch**

Find the side-effects effect around lines 286-400. Inside, the game-over branch (around line 368-392) currently calls `parseHash(window.location.hash)`. Replace:

```typescript
    if (session.status === 'game-over' && !recordedRef.current) {
      recordedRef.current = true
      const isDaily = session.dailyDate !== null
      if (!isDaily) record(session.score, session.bestStreak)
      // Daily-specific recording:
      if (session.dailyDate !== null && session.modeId) {
        const attempts: AttemptRecord[] = session.currentAttempts
        recordDailyResult(session.dailyDate, session.modeId, {
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
      dispatchAnnouncement(`Game over. Final score ${session.score}.`)
    }
```

Note: the inner `if` is duplicated for type-narrowing — `session.dailyDate !== null` lets TypeScript narrow it inside that block.

- [ ] **Step 2: Update the effect's dep array**

The effect's dep array (line ~395-401) needs `session.dailyDate` added. Find:

```typescript
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    session.currentAttempts,
    advance, mode, record, recordDailyResult, byCca3,
  ])
```

Replace with:

```typescript
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    session.currentAttempts, session.dailyDate,
    advance, mode, record, recordDailyResult, byCca3,
  ])
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc -b --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run the unit suite**

```bash
npx vitest run --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "refactor(game): game-over recording reads session.dailyDate"
```

---

### Task 8: GameOverOverlay reads `session.dailyDate`

**Files:**
- Modify: `src/game/shared/hud/GameOverOverlay.tsx`

- [ ] **Step 1: Replace the hash-parse with session-state**

In `src/game/shared/hud/GameOverOverlay.tsx`, find lines 22-27:

```tsx
  const { history, streak } = useDailyHistory()
  const hashState = parseHash(window.location.hash)
  const isDaily = hashState.kind === 'daily'
  const dailyDate = isDaily ? hashState.date : null
  const dailyResults = dailyDate ? (history.days[dailyDate] ?? {}) : {}
  const hasAnyMode = isDaily && (!!dailyResults['country-pinning'] || !!dailyResults['city-guessing'])
```

Replace with:

```tsx
  const { history, streak } = useDailyHistory()
  const isDaily = session.dailyDate !== null
  const dailyDate = session.dailyDate
  const dailyResults = dailyDate ? (history.days[dailyDate] ?? {}) : {}
  const hasAnyMode = isDaily && (!!dailyResults['country-pinning'] || !!dailyResults['city-guessing'])
```

- [ ] **Step 2: Drop the now-unused `parseHash` import**

At the top of the same file (line 5), remove:

```tsx
import { parseHash } from '../../../lib/hashState'
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc -b --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run only the GameOverOverlay tests (they will fail — that's Task 9)**

```bash
npx vitest run src/game/shared/hud/__tests__/GameOverOverlay.test.tsx --no-coverage
```

Expected: some FAIL, because the existing tests set `window.location.hash = …` to drive `isDaily`. Task 9 fixes the test setup. Don't commit until Task 9 is done.

- [ ] **Step 5: Commit (combined with Task 9 — see Task 9 step 5)**

Skip the commit here. Task 9 makes the test suite pass; commit at the end of Task 9.

---

### Task 9: Update `GameOverOverlay` tests to use `session.dailyDate`

**Files:**
- Modify: `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`

- [ ] **Step 1: Read the existing test file**

```bash
sed -n '1,30p' src/game/shared/hud/__tests__/GameOverOverlay.test.tsx
```

(Or use the Read tool.) Note the existing fixtures (`baseSession`, `zeroBest`) and how `window.location.hash = …` is used.

- [ ] **Step 2: Add `dailyDate` to `baseSession` and update each test**

Find `const baseSession: GameSession = { … }` near the top of the file. Add `dailyDate: null` between `lastOutcome` and `used`:

```typescript
const baseSession: GameSession = {
  modeId: 'country-pinning',
  status: 'game-over',
  lives: 0,
  score: 100,
  streak: 0,
  bestStreak: 0,
  roundIndex: 0,
  maxRounds: 1,
  attemptsPerRound: 3,
  attemptsRemaining: 0,
  currentAttempts: [],
  currentRound: null,
  lastOutcome: null,
  dailyDate: null,
  used: new Set(),
}
```

- [ ] **Step 3: Replace `window.location.hash = …` setup with session-driven setup**

Find each test that does `window.location.hash = '#daily/2026-04-27/country-pinning'` (or similar) to drive `isDaily`. Replace those with passing a session that has `dailyDate: '2026-04-27'`. Free-play tests pass `dailyDate: null`.

For example, the test `'hides the personal-best block on daily plays'`:

Before:

```tsx
  it('hides the personal-best block on daily plays', () => {
    window.location.hash = '#daily/2026-04-27/country-pinning'
    render(
      <GameOverOverlay
        session={baseSession}
        personalBest={zeroBest}
        beatPersonalBest={true}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.queryByTestId('game-over-pb')).toBeNull()
  })
```

After:

```tsx
  it('hides the personal-best block on daily plays', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, dailyDate: '2026-04-27' }}
        personalBest={zeroBest}
        beatPersonalBest={true}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.queryByTestId('game-over-pb')).toBeNull()
  })
```

Apply the same pattern to each test that currently sets `window.location.hash`:
- `'says "1 round complete." when maxRounds is 1'` (line ~31) — replace `window.location.hash = '#daily/...'` with session override `{ ...baseSession, maxRounds: 1, dailyDate: '2026-04-27' }`.
- `'hides the personal-best block on daily plays'` (line ~58) — replace with `dailyDate: '2026-04-27'`.
- `'shows the personal-best block on free plays'` (line ~73) — already free; just delete the `window.location.hash = '#game/country-pinning'` line.
- `'keeps "New personal best!" when beatPersonalBest later flips to false'` (line ~88) — delete the hash line.
- `'shows "Best: N pts" stably when beatPersonalBest started false'` (line ~116) — delete the hash line.

Keep the `beforeEach(() => { localStorage.clear(); window.location.hash = '' })` block intact — `window.location.hash = ''` in `beforeEach` is a defensive reset that doesn't hurt and protects against test order leaks.

- [ ] **Step 4: Run the GameOverOverlay tests**

```bash
npx vitest run src/game/shared/hud/__tests__/GameOverOverlay.test.tsx --no-coverage
```

Expected: PASS — every test green.

- [ ] **Step 5: Run the full unit suite**

```bash
npx vitest run --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit Tasks 8 + 9 together**

```bash
git add src/game/shared/hud/GameOverOverlay.tsx src/game/shared/hud/__tests__/GameOverOverlay.test.tsx
git commit -m "refactor(hud): GameOverOverlay reads session.dailyDate"
```

---

### Task 10: Gate `clickMap`'s deselect on game state

**Files:**
- Modify: `src/hooks/useMapInteractions.ts`

The behaviour is covered end-to-end by Task 11's e2e regression. A unit test would require mocking the full MapLibre instance + the game-session context; the e2e exercises the exact code path under realistic conditions. Skip a unit test for the gate.

- [ ] **Step 1: Add `sessionRef` to `useMapInteractions`**

Open `src/hooks/useMapInteractions.ts`. After the existing ref pattern for `onSelectRef` / `onDeselectRef` / `byNumericRef` (around lines 28-35), add:

```typescript
  const sessionRef = useRef(session)
  sessionRef.current = session
```

Place it adjacent to the other refs, near line 35.

- [ ] **Step 2: Gate `clickMap`'s deselect**

In the same file, find the `clickMap` function (around lines 123-126):

```typescript
    const clickMap = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYER.fill] })
      if (features.length === 0) onDeselectRef.current()
    }
```

Replace with:

```typescript
    const clickMap = (e: maplibregl.MapMouseEvent) => {
      // Don't deselect during active gameplay — clearing the URL hash mid-game
      // strips routing state and was the root of the 2026-04-27 cascade.
      if (sessionRef.current.status !== 'idle') return
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYER.fill] })
      if (features.length === 0) onDeselectRef.current()
    }
```

- [ ] **Step 3: Run typecheck and the unit suite**

```bash
npx tsc -b --noEmit
npx vitest run --no-coverage
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useMapInteractions.ts
git commit -m "fix(map): suppress click-deselect during active gameplay"
```

---

### Task 11: E2E regression — daily survives ocean click

**Files:**
- Create: `e2e/daily-survives-ocean-click.spec.ts`

This is the load-bearing test for Phase 1. It exercises the full cascade: ocean click during a daily must not corrupt history / share-block / PB / Play-Again.

- [ ] **Step 1: Read existing e2e helpers**

```bash
sed -n '1,40p' e2e/helpers.ts
```

Note `waitForAppReady`, the test-hook pattern (`window.__funworldmap_game`), and how the existing `e2e/game-over-mode-switch.spec.ts` seeds state.

- [ ] **Step 2: Write the new spec**

Create `e2e/daily-survives-ocean-click.spec.ts`:

```typescript
import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

async function seedTodayPuzzle(page: Page, date: string): Promise<void> {
  await page.addInitScript(
    ({ d }) => {
      const index = {
        generatedAt: new Date().toISOString(),
        window: { start: d, end: d },
        days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
      }
      ;(window as unknown as { __seededIndex?: unknown }).__seededIndex = index
      localStorage.removeItem('funworldmap-daily-history')
      localStorage.removeItem('funworldmap-daily-resume')
      localStorage.removeItem('funworldmap-game-country-pinning-bests-v2')
      sessionStorage.clear()
    },
    { d: date },
  )
  await page.route('**/daily/index.json', async (route) => {
    const seeded = await page.evaluate(
      () => (window as unknown as { __seededIndex?: unknown }).__seededIndex,
    )
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
  })
}

test.describe('daily survives ocean clicks', () => {
  test('ocean click between attempts does not corrupt end-of-game flow', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedTodayPuzzle(page, today)
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)

    // Three country attempts with one ocean click in between.
    // Test hooks expose submitCountryGuess and submitGuess (point) — see
    // src/game/GameController.tsx test-seam block.
    await page.evaluate(async () => {
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('USA')
      await new Promise((r) => setTimeout(r, 400))
      // Ocean click — submit a point guess that hits no country.
      // For country-pinning, ocean clicks are routed through the map handler
      // not the test seam. We simulate by dispatching a synthetic onDeselect
      // via the same path used by the user click. The simplest way: read
      // the document hash and clear it manually to simulate the bug, then
      // assert the fix prevents that. Instead, exercise the actual gate by
      // calling the map's own click event with a known-water point.
      // @ts-expect-error — test seam
      const map = window.__funworldmap_map
      if (!map) throw new Error('map not exposed via test hook')
      // Atlantic — far from any country fill polygon
      map.fire('click', { point: { x: 50, y: 50 }, lngLat: { lng: -40, lat: 0 } })
      await new Promise((r) => setTimeout(r, 200))
    })

    // Assert hash is preserved (the gate works)
    expect(page.url()).toContain(`#daily/${today}/country-pinning`)

    // Continue: two more attempts then completeNow
    await page.evaluate(async () => {
      // @ts-expect-error
      window.__funworldmap_game.submitCountryGuess('CAN')
      await new Promise((r) => setTimeout(r, 400))
      // @ts-expect-error
      window.__funworldmap_game.submitCountryGuess('CHN')
      await new Promise((r) => setTimeout(r, 400))
      // @ts-expect-error
      window.__funworldmap_game.completeNow()
      await new Promise((r) => setTimeout(r, 400))
    })

    // Game-over reached — verify daily UI, not free UI:
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('daily-share-block')).toBeVisible()
    await expect(page.getByTestId('game-over-pb')).toHaveCount(0)
    await expect(page.getByTestId('game-over-play-again')).toHaveCount(0)

    // Verify storage:
    const ls = await page.evaluate(() => ({
      history: JSON.parse(localStorage.getItem('funworldmap-daily-history') ?? 'null'),
      resume: localStorage.getItem('funworldmap-daily-resume'),
      pb: JSON.parse(localStorage.getItem('funworldmap-game-country-pinning-bests-v2') ?? 'null'),
    }))
    expect(ls.history).not.toBeNull()
    expect(ls.history.days[today]?.['country-pinning']).toBeDefined()
    expect(ls.resume).toBeNull()
    expect(ls.pb).toBeNull()
  })
})
```

The test exercises the exact corruption path observed in the assessment:
1. First attempt fires (resume blob written, hash intact).
2. Synthetic ocean click via `map.fire('click', …)` — this is the click that, before the fix, called `onDeselect` and cleared the hash.
3. Hash assertion right after — Phase 1's `clickMap` gate keeps it intact.
4. Two more attempts, completeNow, game-over.
5. localStorage assertions — the cascade's six symptoms reduced to four observable storage / DOM checks.

- [ ] **Step 3: Build the e2e bundle and run the test**

```bash
npm run build:e2e && npx playwright test e2e/daily-survives-ocean-click.spec.ts
```

Expected: PASS. If the test seam `window.__funworldmap_game` doesn't expose `submitCountryGuess`/`completeNow`, inspect `src/game/GameController.tsx` for the existing test-hook block and add the missing seams there as a small helper commit (most likely they're already exposed — see `e2e/game-over-mode-switch.spec.ts` for the existing pattern).

- [ ] **Step 4: Commit**

```bash
git add e2e/daily-survives-ocean-click.spec.ts
git commit -m "test(e2e): regress ocean-click during daily preserves end-of-game flow"
```

---

### Task 12: Documentation update

**Files:**
- Modify: `docs/systems/daily-puzzle.md`

- [ ] **Step 1: Add the state-architecture note**

Open `docs/systems/daily-puzzle.md`. Find the existing `### State sharing` subsection (added in PR #24). Immediately after its closing paragraph, add:

```markdown
The session itself carries the daily date as `session.dailyDate: string |
null`, set at `start()` / `resume()` time. Game-over recording, the
per-attempt resume write, and `GameOverOverlay` read this field instead
of re-parsing `window.location.hash`. The hash is the routing input;
session state is the source of truth for "is this a daily, and if so,
for what date?". See `docs/superpowers/specs/2026-04-27-game-flow-cascade-fixes-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/systems/daily-puzzle.md
git commit -m "docs(daily): note dailyDate session-state plumbing"
```

---

### Task 13: Phase 1 verification gate

This task is the integration check. No code changes; only verification.

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: PASS — no errors.

- [ ] **Step 2: Typecheck**

```bash
npx tsc -b --noEmit
```

Expected: PASS.

- [ ] **Step 3: Full unit suite**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 4: Full e2e suite**

```bash
npm run build:e2e && npm run test:e2e
```

Expected: PASS.

- [ ] **Step 5: Manual smoke pass**

Open `npm run dev` in a fresh browser profile (Incognito):

| Scenario | Expected |
|---|---|
| Play today's country-pinning daily, click ocean once between attempts, complete with Done | Game-over shows daily UI: share block visible, no PB block, no Play Again button. Hash is `#daily/<today>/country-pinning` throughout. |
| Same as above but for `#daily/<today>/city-guessing` | Same expectations. |
| Play country-pinning free to natural game-over (lose 3 lives) | Free game-over: PB block visible, "New personal best!" shown, Play Again visible. |
| Refresh during a daily after one attempt | Daily resumes with attempt 1 in `currentAttempts`. |
| Past date `#daily/2026-04-25/country-pinning` | Redirects to `…/reveal` (existing behaviour, unchanged). |

If any scenario fails, do NOT mark this task complete — diagnose, fix, and re-run all steps.

- [ ] **Step 6: Push branch and open PR**

```bash
git push -u origin game-flow-cascade-fix
gh pr create --title "Game-flow cascade fix: stop using URL hash as session-state oracle" --body "$(cat <<'EOF'
## Summary

Closes the 2026-04-27 cascade — one ocean click during a daily corrupts end-of-game flow (no history saved, free PB contaminated, daily share block missing, Play Again wrong). Root cause: three call sites re-parse `window.location.hash` to answer "is this a daily?", but `useMapInteractions.clickMap` mutates the hash on off-target clicks.

This PR adds `dailyDate: string | null` to `GameSession`, threaded through `start` / `resume`, consumed at the three call sites instead of the hash. Defense-in-depth: gates `clickMap`'s deselect on `session.status !== 'idle'`.

Spec: `docs/superpowers/specs/2026-04-27-game-flow-cascade-fixes-design.md`

## Test plan

- [x] `npm run lint`
- [x] `npx tsc -b --noEmit`
- [x] `npm run test:unit`
- [x] `npm run test:e2e` — including new `e2e/daily-survives-ocean-click.spec.ts`
- [x] Manual smoke: scenarios in plan task 13
EOF
)"
```

After PR is reviewed and merged to `main`, **STOP HERE** and proceed to Phase 2.

---

# Phase 2 — Polish fixes

**Branch:** `game-flow-polish-fixes`
**Target merge:** `main`
**Prerequisite:** Phase 1 merged to `main`.

Update local `main` and create the new branch:

```bash
git checkout main && git pull
git checkout -b game-flow-polish-fixes
```

---

### Task 14: Add `finishFree` reducer action

**Files:**
- Modify: `src/game/shared/useGameSession.ts`
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`

`finishFree` transitions a free game from `playing` / `round-ended` directly to `game-over`, preserving the score. Refuses to fire on `idle`, on `game-over`, and on daily plays (which keep their abandon-via-`endGame` semantics).

- [ ] **Step 1: Write the failing tests**

Add to `src/game/shared/__tests__/useGameSession.test.ts`:

```typescript
  describe('finishFree', () => {
    it('transitions playing → game-over for a free game, preserving score', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA', 14)) })
      // attempt for free game (attemptsPerRound=1) ends the round and
      // transitions to round-ended (or game-over if lives === 0).
      // After one wrong attempt, status is round-ended, lives 2.
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.score).toBe(14)
      act(() => { result.current.finishFree() })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(14)
    })

    it('refuses on idle (no-op)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.finishFree() })
      expect(result.current.session.status).toBe('idle')
    })

    it('refuses on a daily play (preserves abandon-semantic)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      act(() => { result.current.finishFree() })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('refuses on game-over (no-op)', () => {
      const { result } = renderHook(() => useGameSession())
      // Drive to game-over by losing 3 lives in free play
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      act(() => { result.current.advance(round('ESP')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('ESP', 'USA')) })
      act(() => { result.current.advance(round('DEU')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('DEU', 'USA')) })
      expect(result.current.session.status).toBe('game-over')
      const before = result.current.session
      act(() => { result.current.finishFree() })
      expect(result.current.session).toBe(before)
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "finishFree" --no-coverage
```

Expected: FAIL — `result.current.finishFree is not a function`.

- [ ] **Step 3: Add the action to the union**

In `src/game/shared/useGameSession.ts`, add to the `Action` union:

```typescript
  | { type: 'finishFree' }
```

- [ ] **Step 4: Add the reducer case**

Inside the switch, after `case 'endGame': { return { ...EMPTY, used: new Set() } }`:

```typescript
    case 'finishFree': {
      if (state.status === 'idle' || state.status === 'game-over') return state
      if (state.dailyDate !== null) return state
      return { ...state, status: 'game-over' }
    }
```

- [ ] **Step 5: Add the hook callback**

Update the return-type signature of `useGameSession` to include:

```typescript
  finishFree: () => void
```

…and the implementation block:

```typescript
  const finishFree = useCallback(() => dispatch({ type: 'finishFree' }), [])
```

…and include `finishFree` in the returned object.

- [ ] **Step 6: Plumb `finishFree` through `GameSessionProvider`**

Open `src/game/shared/GameSessionProvider.tsx`. Three edits:

(a) Add to `GameSessionApi` (around line 7-17):

```typescript
  finishFree: () => void
```

(b) Add `finishFree` to the destructure of `useGameSession()` at line 28:

```typescript
const { session, start, attempt, completeNow, resume, advance, overrideRound, endGame, finishFree } = useGameSession()
```

(c) Add `finishFree` to the `api` `useMemo` value AND its dep array (lines 49-52):

```typescript
const api = useMemo<GameSessionApi>(
  () => ({ session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame, finishFree }),
  [session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame, finishFree],
)
```

- [ ] **Step 7: Run the new tests**

```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts -t "finishFree" --no-coverage
```

Expected: PASS — all four tests.

- [ ] **Step 8: Run the full suite + typecheck**

```bash
npx vitest run --no-coverage
npx tsc -b --noEmit
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/game/shared/useGameSession.ts src/game/shared/GameSessionProvider.tsx src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): finishFree reducer action"
```

---

### Task 15: `onEndGame` branches on `session.dailyDate`

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Pull `finishFree` from the context**

`GameSessionApi` was already extended in Task 14 step 6; `finishFree` is on the context. In `GameController.tsx:102`, find:

```typescript
const { session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame } = useGameSessionContext()
```

Add `finishFree`:

```typescript
const { session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame, finishFree } = useGameSessionContext()
```

- [ ] **Step 2: Replace `onEndGame`**

Find `onEndGame` (around line 732):

```typescript
const onEndGame = () => { clearResume(); endGame(); writeIdleHash() }
```

Replace:

```typescript
const onEndGame = () => {
  // Free games: route through game-over so the user sees their score and
  // PB is recorded. Daily plays keep abandon-semantic (Done is the
  // explicit save action there); idle / already game-over no-ops.
  if (session.dailyDate === null && session.status !== 'idle' && session.status !== 'game-over') {
    finishFree()
    return
  }
  clearResume()
  endGame()
  writeIdleHash()
}
```

`onBackToMap = onEndGame` keeps working — when invoked from the game-over dialog, `session.status === 'game-over'`, so it falls into the abandon branch (`endGame` + `writeIdleHash`). No infinite loop.

- [ ] **Step 3: Run typecheck and the unit suite**

```bash
npx tsc -b --noEmit
npx vitest run --no-coverage
```

Expected: PASS.

- [ ] **Step 4: Manual smoke**

```bash
npm run dev
```

In a fresh Incognito session:
1. Play `#game/country-pinning` free, hit one attempt, click "End game" in the HUD.
2. Game-over dialog should appear with the current score, "Play again" button visible, PB recorded in localStorage.
3. Click "Back to map" — dialog closes, hash clears.
4. Now play `#daily/<today>/country-pinning`, click "End game".
5. Daily session should abandon as before (no game-over dialog, returns to launcher, daily history *not* recorded).

- [ ] **Step 5: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "feat(game): End game in free mode shows game-over and records PB"
```

---

### Task 16: Drop the redundant round-end announcement block (Bugs 7 + 8)

**Files:**
- Modify: `src/game/GameController.tsx`

The block at `GameController.tsx:297-313` issues `dispatchAnnouncement(...)` calls on round-end that duplicate the inline `[role="status"]` content rendered by both mode HUDs. Removing it also removes the three "Plus N points" pluralization sites (Bug 7).

- [ ] **Step 1: Find the block**

In `src/game/GameController.tsx`, find the `useEffect(() => { if (!mode) return; if (session.status === 'playing' && …) … if (session.status === 'round-ended' && session.lastOutcome) { … } … }, …)` effect. Identify the round-ended block:

```typescript
    if (session.status === 'round-ended' && session.lastOutcome) {
      const o = session.lastOutcome
      if (o.reveal.kind === 'country') {
        dispatchAnnouncement(
          o.reveal.correct
            ? `Correct. Plus ${o.pointsEarned} points.`
            : `Wrong. Plus ${o.pointsEarned} points. ${session.lives === 1 ? 'One life remaining.' : `${session.lives} lives remaining.`}`,
        )
      } else {
        const d = o.reveal.distanceKm ?? 0
        dispatchAnnouncement(`${Math.round(d)} kilometres off. Plus ${o.pointsEarned} points.`)
      }
    }
```

- [ ] **Step 2: Delete the block**

Remove those lines entirely. The surrounding `useEffect` continues to handle other status transitions (game-over recording at the bottom of the effect, round-start announcement at the top).

- [ ] **Step 3: Verify the inline status still announces**

Open `src/game/modes/country-pinning/CountryPinningHud.tsx` lines 42-50 and `src/game/modes/city-guessing/CityGuessingHud.tsx` lines 62-70 — both render `<div role="status">{revealLine}</div>` conditionally on `revealLine` being truthy. `role="status"` provides implicit `aria-live="polite"` + `aria-atomic="true"`. When the element mounts on round-end, screen readers announce the content. No code change needed here — just verify by reading.

- [ ] **Step 4: Run the full unit suite + typecheck**

```bash
npx vitest run --no-coverage
npx tsc -b --noEmit
```

Expected: PASS — no test was asserting the App-level announcement content for round-end (the existing assertions are on the inline `[role="status"]`).

- [ ] **Step 5: Manual smoke (NVDA / VoiceOver if available)**

Play a free country-pinning round, intentionally click a wrong country. Confirm the HUD reads its inline reveal line ("Wrong — that was United States. The answer was Botswana. −1 life.") and that you hear it once, not twice.

- [ ] **Step 6: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "fix(a11y): drop redundant round-end announcement; inline role=status auto-announces"
```

---

### Task 17: Clear stale aria-live region after each announcement (Bug 9)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Find the announce handler**

In `src/App.tsx`, find the announce-event listener (around line 206-213):

```typescript
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (liveRegionRef.current && detail) liveRegionRef.current.textContent = detail
    }
    window.addEventListener('funworldmap:announce', handler)
    return () => window.removeEventListener('funworldmap:announce', handler)
  }, [])
```

- [ ] **Step 2: Add a clear timer**

Replace with:

```typescript
  const clearTimerRef = useRef<number | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (!liveRegionRef.current || !detail) return
      liveRegionRef.current.textContent = detail
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = window.setTimeout(() => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = ''
      }, 8000)
    }
    window.addEventListener('funworldmap:announce', handler)
    return () => {
      window.removeEventListener('funworldmap:announce', handler)
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
    }
  }, [])
```

`clearTimerRef` must be declared at the same level as the existing refs (e.g. near `liveRegionRef`). If it's not present, add `import { useRef } from 'react'` (it's almost certainly already imported).

The 8 s window covers the longest announcement (~80 characters at typical SR speech rate). Each new announcement cancels the prior timer and starts a fresh one.

- [ ] **Step 3: Run typecheck and unit suite**

```bash
npx tsc -b --noEmit
npx vitest run --no-coverage
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix(a11y): clear stale aria-live region 8s after each announcement"
```

---

### Task 18: Add `subscribeReducedMotion` API (Bug 10 — half 1)

**Files:**
- Modify: `src/lib/motion.ts`
- Create: `src/lib/__tests__/motion.test.ts` (or append to existing)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/motion.test.ts` (or append if it exists):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { prefersReducedMotion, subscribeReducedMotion } from '../motion'

describe('motion', () => {
  let mediaQueryListeners: Array<(e: MediaQueryListEvent) => void>
  let matchesValue: boolean

  beforeEach(() => {
    mediaQueryListeners = []
    matchesValue = false
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => {
      const mql = {
        matches: matchesValue,
        media: q,
        onchange: null,
        addEventListener: (type: string, listener: (e: MediaQueryListEvent) => void) => {
          if (type === 'change') mediaQueryListeners.push(listener)
        },
        removeEventListener: (type: string, listener: (e: MediaQueryListEvent) => void) => {
          if (type === 'change') {
            mediaQueryListeners = mediaQueryListeners.filter((l) => l !== listener)
          }
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as unknown as MediaQueryList
      return mql
    })
  })

  afterEach(() => { vi.restoreAllMocks() })

  describe('prefersReducedMotion', () => {
    it('reads matchMedia each call (live)', () => {
      matchesValue = false
      expect(prefersReducedMotion()).toBe(false)
      matchesValue = true
      expect(prefersReducedMotion()).toBe(true)
    })
  })

  describe('subscribeReducedMotion', () => {
    it('invokes the callback when the media query changes', () => {
      const cb = vi.fn()
      const unsubscribe = subscribeReducedMotion(cb)
      expect(mediaQueryListeners).toHaveLength(1)
      mediaQueryListeners[0]!({ matches: true } as MediaQueryListEvent)
      expect(cb).toHaveBeenCalledWith(true)
      mediaQueryListeners[0]!({ matches: false } as MediaQueryListEvent)
      expect(cb).toHaveBeenCalledWith(false)
      unsubscribe()
      expect(mediaQueryListeners).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/motion.test.ts --no-coverage
```

Expected: FAIL with `subscribeReducedMotion is not exported from '../motion'`.

- [ ] **Step 3: Add the API**

In `src/lib/motion.ts`, replace the file contents with:

```typescript
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function subscribeReducedMotion(cb: (reduced: boolean) => void): () => void {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handler = (e: MediaQueryListEvent) => cb(e.matches)
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/lib/__tests__/motion.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion.ts src/lib/__tests__/motion.test.ts
git commit -m "feat(motion): subscribeReducedMotion API"
```

---

### Task 19: `useMapInstance` re-applies pitch on reduced-motion change (Bug 10 — half 2)

**Files:**
- Modify: `src/hooks/useMapInstance.ts`

- [ ] **Step 1: Import the new API**

At the top of `src/hooks/useMapInstance.ts` (line 16), update the import:

```typescript
import { prefersReducedMotion, subscribeReducedMotion } from '../lib/motion'
```

- [ ] **Step 2: Subscribe in the init effect**

Find the init `useEffect` body (around line 51-168). After the `map = new maplibregl.Map(…)` block (around line 78) and before `mapRef.current = map`, add:

```typescript
    const unsubscribeReducedMotion = subscribeReducedMotion((reduced) => {
      // The initial pitch was set from prefersReducedMotion() at construction;
      // re-apply on OS-toggle so the map flattens / restores tilt without a
      // page refresh. duration=0 keeps the toggle itself non-animated.
      map.setPitch(reduced ? 0 : DEFAULT_PITCH, { duration: 0 })
    })
```

(`map.setPitch` accepts a second `options` arg per MapLibre docs; the second arg here is the eventData passed to listeners. Use `{ duration: 0 }` — actually `setPitch` only takes one arg in some MapLibre versions. **Verify against the installed `maplibre-gl` version** by reading `node_modules/maplibre-gl/dist/maplibre-gl.d.ts` for `setPitch`'s signature. If it doesn't accept a duration option, use `map.jumpTo({ pitch: reduced ? 0 : DEFAULT_PITCH })` instead, which is unambiguously instantaneous and doesn't animate.)

- [ ] **Step 3: Add to the cleanup**

The init effect's return function (around line 150-164) handles cleanup. Add `unsubscribeReducedMotion()` before `map.remove()`:

```typescript
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      window.removeEventListener('keydown', homeHandler)
      tooltipRef.current?.remove()
      tooltipRef.current = null
      setLoadedBoth(false)
      unsubscribeReducedMotion()
      map.remove()
      mapRef.current = null
      if (import.meta.env.VITE_TEST_HOOKS) {
        delete (window as unknown as Record<string, unknown>).__funworldmap_map
      }
    }
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc -b --noEmit
```

Expected: PASS.

- [ ] **Step 5: Run the unit suite**

```bash
npx vitest run --no-coverage
```

Expected: PASS — `useMapInstance` is mostly tested by integration. If a test mocks `subscribeReducedMotion` it may need adjustment; otherwise no test changes needed.

- [ ] **Step 6: Manual smoke**

```bash
npm run dev
```

1. Open the app with default OS settings (motion not reduced). Observe the globe is tilted (DEFAULT_PITCH).
2. Without refreshing, toggle the OS reduced-motion setting on (macOS: System Settings → Accessibility → Display → Reduce motion; Windows: Settings → Accessibility → Visual effects → Animation effects off).
3. Map should flatten (`pitch: 0`) within a fraction of a second.
4. Toggle back. Map should re-tilt.

If `setPitch` doesn't accept the second arg, use `map.jumpTo({ pitch: … })` (per Step 2 fallback) and re-test.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useMapInstance.ts
git commit -m "feat(motion): useMapInstance re-applies pitch on reduced-motion toggle"
```

---

### Task 20: Phase 2 verification gate

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Typecheck**

```bash
npx tsc -b --noEmit
```

Expected: PASS.

- [ ] **Step 3: Full unit suite**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 4: Full e2e suite**

```bash
npm run build:e2e && npm run test:e2e
```

Expected: PASS — including the `daily-survives-ocean-click` regression from Phase 1.

- [ ] **Step 5: Manual smoke pass (Phase 2 specific scenarios)**

| Scenario | Expected |
|---|---|
| Free `#game/country-pinning`, play one round, click End game | Game-over dialog appears with score, "Play again" / "Back to map" visible, PB updated in localStorage. |
| Daily `#daily/<today>/country-pinning`, click End game during play | Daily abandons as before — no game-over dialog, returns to launcher, daily history NOT recorded, resume blob cleared. |
| Wrong country click in either mode | One round-end announcement (the inline HUD `role="status"`), not two. |
| Reach game-over, navigate away, wait 8 s | Live region is empty (`liveRegionRef.current.textContent === ''`); re-announcing a fresh message later doesn't pull stale text. |
| Toggle OS reduced-motion mid-session | Map flattens / re-tilts immediately. |

If any scenario fails, do NOT mark this task complete.

- [ ] **Step 6: Push branch and open PR**

```bash
git push -u origin game-flow-polish-fixes
gh pr create --title "Game-flow polish: free End-game, redundant SR announcement, stale a11y, reduced-motion subscribe" --body "$(cat <<'EOF'
## Summary

Closes the four LOW/HIGH bugs from the 2026-04-27 critical assessment that were deferred from PR #cascade-fix:

- **Bug 3 (HIGH):** "End game" in free mode now routes through `game-over` so the user sees their score and PB is written. Daily plays keep abandon-semantic (Done remains the explicit save).
- **Bugs 7 + 8 (LOW):** Drop the redundant App-level round-end announcement; the inline mode-HUD `[role="status"]` already auto-announces with richer content. Auto-resolves the "Plus 1 points" pluralization (the strings are now gone).
- **Bug 9 (LOW):** Clear stale aria-live region 8 s after each announcement so a stale "Game over. Final score N." doesn't re-fire on later region writes.
- **Bug 10 (LOW):** Add `subscribeReducedMotion` API; `useMapInstance` flattens / re-tilts the map when the user toggles OS reduce-motion mid-session.

Spec: `docs/superpowers/specs/2026-04-27-game-flow-cascade-fixes-design.md`

## Test plan

- [x] `npm run lint`
- [x] `npx tsc -b --noEmit`
- [x] `npm run test:unit`
- [x] `npm run test:e2e`
- [x] Manual smoke: scenarios in plan task 20
EOF
)"
```

---

## Verification matrix

| Bug | Severity | Resolved by | Verified by |
|---|---|---|---|
| 1 (cascade) | CRITICAL | Tasks 1-10 | Task 11 e2e + Task 13 manual |
| 2 (Play Again on daily) | CRITICAL | Auto-fixed by 1 (no separate code change) | Task 11 e2e + Task 13 manual |
| 3 (End game free) | HIGH | Tasks 14-15 | Task 15 manual + Task 20 manual |
| 7 (pluralization) | LOW | Auto-fixed by Bug 8 (strings removed) | Task 16 manual |
| 8 (triple announcement) | LOW | Task 16 | Task 16 manual + NVDA pass |
| 9 (stale aria-live) | LOW | Task 17 | Task 20 manual |
| 10 (reduced-motion mid-session) | LOW | Tasks 18-19 | Task 19 manual + Task 20 manual |

## Plan self-review

- **Spec coverage:** Every finding in the spec has at least one task. The architectural decision (`dailyDate` on session) is implemented across Tasks 1-3 (reducer + provider type) and consumed in Tasks 5-9 (call sites). The defense-in-depth gate is Task 10. Bug 7 has no separate task — it's marked `auto-fixed by Bug 8` per the spec's findings table, with Task 16 as the verification.
- **Placeholder scan:** No `TBD` / `TODO` / `???` strings. The "may need adjustment" note in Task 19 step 5 is conditional guidance about a possible test-mock interaction, not a placeholder. The Step 2 note in Task 19 about `setPitch` signature is a verify-against-version step with a concrete fallback (`map.jumpTo`) — also not a placeholder.
- **Type consistency:** `dailyDate: string | null` on `start`, `dailyDate: string` (required) on `resume`. Hook callbacks match. **`GameSessionApi` interface in `GameSessionProvider.tsx` is updated alongside the hook in Tasks 2 and 3** — the spec critical-review (2026-04-27) caught that the public-API type would otherwise reject the new arg. Reducer cases write the field consistently. `finishFree` is `() => void` everywhere it appears, including in `GameSessionApi` (Task 14 step 6).
- **Task isolation:** Tasks 1-12 are sequenced because each builds on the prior reducer/state changes. Tasks 14-19 are independent after Task 14 plumbs `finishFree` through the provider. Each task ends with a commit; each PR ends with a verification gate.
- **Cross-task references:** Tasks 8 and 9 are paired (the source change in Task 8 breaks tests that Task 9 fixes; the commit at Task 9 step 6 covers both). Task 10 covers the gate via the e2e in Task 11 (no separate unit test). Task 19 has a fall-back to `map.jumpTo` if `setPitch`'s second arg isn't supported by the installed MapLibre version.
- **Critical-review revisions applied (2026-04-27):**
  - Tasks 2 and 3 each got an explicit step to update `GameSessionApi` in `GameSessionProvider.tsx` — without this, Task 5's 5-arg `start` call would fail typecheck against the unmodified API interface.
  - Task 4 dropped the malformed "advance preserves dailyDate" test (a daily best-of-3 with `maxRounds=1` transitions straight to game-over after `completeNow`, so `advance` can't legitimately fire on a daily session). The three remaining preservation tests cover the spread invariant adequately.
  - Task 14 step 6 spells out the three Provider edits (interface, destructure, useMemo + deps) instead of vaguely "mirror the pattern for endGame".
  - Task 9 keeps the `beforeEach` hash reset intact (defensive against test-order leaks) instead of conditionally deleting it.
