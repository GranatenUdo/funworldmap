# Cross-Component State & Game-Over Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close eight verified bugs from the 2026-04-27 critical assessment by lifting the daily-history and personal-bests state into module-level stores subscribed via `useSyncExternalStore`, polishing the game-over overlay, surfacing the running best-of-N score in the HUD, and unblocking mid-`game-over` mode switches.

**Architecture:** The three critical bugs (#1 share block missing, #2 stale share data, #3 cross-mode PB contamination) all stem from one architectural defect: `useDailyHistory` and `usePersonalBests` each declare a *local* `useState` initializer that reads `localStorage` once per hook instance, with no cross-instance subscription. Two consumers of the same hook hold independent state; writes from one don't propagate to the other; and when a hook's modeId argument changes mid-life it keeps the old state. The fix is a single pattern: a module-level snapshot + listener set, exposed via `subscribe`/`getSnapshot`/mutator functions and consumed through `useSyncExternalStore`. The hook public APIs (`useDailyHistory()` returns `{ history, streak, pendingMilestone, get, record, markMilestoneShown }`; `usePersonalBests(modeId)` returns `{ best, record }`) stay identical, so no callers change. Bug #4 (PB-flash) needs its *own* fix on top of that — the architecture refactor makes the post-`record()` re-render *more* reliable, not less; the overlay still has to freeze its `beatPersonalBest` value at first paint via `useState(initial)`. The remaining four bugs (#5 PB-on-daily, #6 plural copy, #7 HUD score, #8 mid-game-over mode switch) are localised tweaks in `GameOverOverlay`, `HudShell`/`ScoreBadge`, and `GameController.tsx`'s bootstrap.

**Tech Stack:** React 19 (`useSyncExternalStore`), TypeScript, Vite 6, Vitest 4 (unit), Playwright 1.59 (e2e), `@testing-library/react` 16.

**Source assessment:** Conversation 2026-04-27 — eight bugs ranked CRITICAL (#1 share block missing on first daily, #2 stale share text, #3 cross-mode PB contamination), HIGH (#4 PB flash, #5 PB shown for daily, #6 "1 rounds complete."), MEDIUM (#7 HUD score 0 in best-of-N, #8 hash-switch dead-end during game-over).

---

## File Structure

### Created
- `src/game/daily/historyStore.ts` — module-level snapshot of `DailyHistoryV1` with `subscribe`/`getSnapshot`/`setHistory`. Owns the 90-day prune on first load and the `writeHistory` call on every mutation.
- `src/game/daily/__tests__/historyStore.test.ts` — direct unit tests for the store (subscribe fires once per write, snapshot identity stable across no-op updates, persists to `localStorage`).
- `src/game/shared/personalBestsStore.ts` — module-level map of `modeId → PersonalBest` with `subscribe`, `getSnapshot(modeId)`, and `record(modeId, score, streak)`. Owns the v1→v2 migration on first read per key and the `localStorage` write on mutation.
- `src/game/shared/__tests__/personalBestsStore.test.ts` — listener fan-out, per-key isolation, v1 cleanup, persistence.
- `e2e/game-over-mode-switch.spec.ts` — regression: from a finished free game, navigating to a different `#game/<mode>` URL starts that mode rather than freezing on the old game-over.
- `e2e/daily-share-block-immediate.spec.ts` — regression: completing today's first daily renders the share block on the game-over overlay (no reload required) and the share text reflects the just-finished mode.

### Modified
- `src/game/daily/useDailyHistory.ts` — replace the `useState(readHistory())` initializer with `useSyncExternalStore(subscribe, getSnapshot)` from `historyStore`. `record` and `markMilestoneShown` delegate to the store. `get` and `pendingMilestone` are derived from the snapshot. Public API unchanged.
- `src/game/shared/usePersonalBests.ts` — replace the `useState`/storage-listener pair with `useSyncExternalStore(subscribe, () => getSnapshot(modeId))`. `record` delegates to `personalBestsStore.record(modeId, …)`. Public API unchanged.
- `src/game/daily/__tests__/useDailyHistory.test.tsx` — add one test asserting that two `renderHook` instances of `useDailyHistory` see the same value after one of them calls `record`.
- `src/game/shared/__tests__/usePersonalBests.test.ts` — add cross-instance test (two hooks, one records, both updated) and a cross-mode-switch test (hook re-keyed from `country-pinning` to `city-guessing` returns the city-mode value, not the country-mode value).
- `src/game/shared/__tests__/bestsKeyMigration.test.ts` — adjust the v1-cleanup test to call the store-level migration (the per-mode v1 cleanup must run on first store access for that mode).
- `src/game/shared/hud/GameOverOverlay.tsx` — guard the "Best / New personal best!" block on `!isDaily`; pluralize the rounds-complete copy (`1 round complete.` vs `${n} rounds complete.`).
- `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx` — new file: PB block hidden when `kind === 'daily'`, visible otherwise; copy assertion for 1 vs N rounds.
- `src/game/shared/hud/HudShell.tsx` — pass the running best-of-N score into `<ScoreBadge>` when `attemptsPerRound > 1`; when `playing` and `currentAttempts.length > 0`, the displayed score is `Math.max(...currentAttempts.map(a => a.pointsEarned))` (otherwise unchanged: `session.score`).
- `src/game/shared/hud/ScoreBadge.tsx` — accept an optional `pending: boolean` prop; render with a subtle "best so far" affordance when `pending === true`.
- `src/game/shared/hud/__tests__/ScoreBadge.test.tsx` — new file: shows the score, marks pending state via `data-pending`.
- `src/game/GameController.tsx` — bootstrap effect: relax the `statusRef.current === 'idle'` gates in the `game` and `daily` branches to also start when status is `'game-over'`, dispatching `endGame()` first to clear `currentRound` / `lastOutcome` / `currentAttempts` before the `start` call. The reducer's `start` already spreads `EMPTY` first, so the second dispatch is the only thing required.
- `src/game/shared/messages.ts` *(if present; otherwise inline)* — none expected; pluralization is in `GameOverOverlay.tsx` only.
- `docs/systems/daily-puzzle.md` — add a one-line note that the daily-history and personal-best state lives in module-level stores so all consumers stay in sync.

### Touched but unchanged behaviour
- `src/components/Launcher.tsx` — uses both stores; will automatically rerender when either updates. No code change needed.
- `src/components/DailyRevealOverlay.tsx`, `src/components/DailyShareBlock.tsx` — same.

---

## Task Order Rationale

Tasks 1–4 must land first and in order (the store comes before the hook refactor that depends on it). Tasks 5–7 are independent and can be implemented in any order. Task 8 is the e2e regression for #8 and must come after Task 7 lands. Task 9 is documentation.

---

### Task 1: Daily-history module store

**Files:**
- Create: `src/game/daily/historyStore.ts`
- Create test: `src/game/daily/__tests__/historyStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/daily/__tests__/historyStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { subscribe, getSnapshot, setHistory, __resetForTests } from '../historyStore'
import { emptyHistory } from '../storage'

describe('historyStore', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
  })

  it('returns empty history on first read with no localStorage', () => {
    expect(getSnapshot()).toEqual(emptyHistory())
  })

  it('hydrates from localStorage on first read', () => {
    localStorage.setItem(
      'funworldmap-daily-history',
      JSON.stringify({
        version: 1,
        streak: { current: 4, longest: 4, lastActiveDate: '2026-04-21', lastMilestoneShown: 3 },
        days: {},
      }),
    )
    __resetForTests()
    expect(getSnapshot().streak.current).toBe(4)
  })

  it('setHistory replaces snapshot, persists to localStorage, and notifies all subscribers exactly once', () => {
    let countA = 0
    let countB = 0
    const unA = subscribe(() => { countA++ })
    const unB = subscribe(() => { countB++ })

    setHistory((prev) => ({
      ...prev,
      streak: { ...prev.streak, current: 7, longest: 7, lastActiveDate: '2026-04-27', lastMilestoneShown: 0 },
    }))

    expect(getSnapshot().streak.current).toBe(7)
    expect(countA).toBe(1)
    expect(countB).toBe(1)
    const stored = JSON.parse(localStorage.getItem('funworldmap-daily-history') ?? '{}')
    expect(stored.streak.current).toBe(7)

    unA(); unB()
  })

  it('setHistory with identity-equal return is a no-op (no notify, no write)', () => {
    let count = 0
    const un = subscribe(() => { count++ })
    const before = getSnapshot()

    setHistory((prev) => prev)

    expect(getSnapshot()).toBe(before)
    expect(count).toBe(0)
    un()
  })

  it('subscribe returns an unsubscribe that stops further notifications', () => {
    let count = 0
    const un = subscribe(() => { count++ })
    setHistory((prev) => ({ ...prev, days: { ...prev.days, '2026-04-27': {} } }))
    expect(count).toBe(1)
    un()
    setHistory((prev) => ({ ...prev, days: { ...prev.days, '2026-04-26': {} } }))
    expect(count).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/daily/__tests__/historyStore.test.ts --no-coverage`
Expected: FAIL with `Cannot find module '../historyStore'` or similar resolution error.

- [ ] **Step 3: Implement the store**

Create `src/game/daily/historyStore.ts`:

```typescript
import type { DailyHistoryV1 } from './types'
import { readHistory, writeHistory, pruneOlderThan } from './storage'

type Listener = () => void

let snapshot: DailyHistoryV1 = hydrate()
const listeners = new Set<Listener>()

function hydrate(): DailyHistoryV1 {
  const raw = readHistory()
  const pruned = pruneOlderThan(raw, 90)
  if (pruned !== raw) writeHistory(pruned)
  return pruned
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getSnapshot(): DailyHistoryV1 {
  return snapshot
}

export function setHistory(updater: (prev: DailyHistoryV1) => DailyHistoryV1): void {
  const next = updater(snapshot)
  if (next === snapshot) return
  snapshot = next
  writeHistory(next)
  // Snapshot of listeners so a subscriber that unsubscribes during dispatch
  // doesn't perturb iteration.
  for (const l of [...listeners]) l()
}

/** Test seam — re-hydrate from localStorage and clear listeners. */
export function __resetForTests(): void {
  snapshot = hydrate()
  listeners.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/daily/__tests__/historyStore.test.ts --no-coverage`
Expected: PASS — five tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/daily/historyStore.ts src/game/daily/__tests__/historyStore.test.ts
git commit -m "feat(daily): add module-level historyStore with subscribe/getSnapshot"
```

---

### Task 2: Refactor `useDailyHistory` onto the store

**Files:**
- Modify: `src/game/daily/useDailyHistory.ts` (full file replacement)
- Modify: `src/game/daily/__tests__/useDailyHistory.test.tsx` (add cross-instance test)

- [ ] **Step 1: Write the failing cross-instance test**

Add this test to the bottom of `src/game/daily/__tests__/useDailyHistory.test.tsx`, inside the existing first `describe('useDailyHistory', ...)` block (before the `describe('useDailyHistory — milestones', ...)` block):

```typescript
  it('two hook instances stay in sync — recording in one updates the other', () => {
    const writer = renderHook(() => useDailyHistory())
    const reader = renderHook(() => useDailyHistory())

    expect(reader.result.current.get('2026-04-21', 'country-pinning')).toBeNull()

    act(() => {
      writer.result.current.record('2026-04-21', 'country-pinning', {
        score: 87, attempts: [], completedAt: 1,
      })
    })

    expect(reader.result.current.get('2026-04-21', 'country-pinning')?.score).toBe(87)
    expect(reader.result.current.streak.current).toBe(1)
  })
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npx vitest run src/game/daily/__tests__/useDailyHistory.test.tsx -t "stay in sync" --no-coverage`
Expected: FAIL — `reader.result.current.get(...)` returns `null` because the two `useState` instances don't share state.

- [ ] **Step 3: Replace `useDailyHistory.ts` with a store-backed version**

Replace the entire contents of `src/game/daily/useDailyHistory.ts`:

```typescript
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ModeId } from '../shared/types'
import type { DailyHistoryV1, DailyDayResult, Milestone, StreakState } from './types'
import {
  mergeDay,
  updateStreak,
  pendingMilestone as derivePendingMilestone,
  withMilestoneShown,
} from './storage'
import { subscribe, getSnapshot, setHistory } from './historyStore'

export interface UseDailyHistory {
  history: DailyHistoryV1
  streak: StreakState
  pendingMilestone: Milestone | null
  get(date: string, modeId: ModeId): DailyDayResult | null
  record(date: string, modeId: ModeId, result: DailyDayResult): void
  markMilestoneShown(): void
}

export function useDailyHistory(): UseDailyHistory {
  const history = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const get = useCallback(
    (date: string, modeId: ModeId): DailyDayResult | null =>
      history.days[date]?.[modeId] ?? null,
    [history],
  )

  const record = useCallback(
    (date: string, modeId: ModeId, result: DailyDayResult) => {
      setHistory((prev) => {
        const merged = mergeDay(prev, date, modeId, result)
        return updateStreak(merged, date)
      })
    },
    [],
  )

  const pendingMilestone = useMemo(() => derivePendingMilestone(history), [history])

  const markMilestoneShown = useCallback(() => {
    setHistory((prev) => {
      const m = derivePendingMilestone(prev)
      if (!m) return prev
      return withMilestoneShown(prev, m)
    })
  }, [])

  return { history, streak: history.streak, pendingMilestone, get, record, markMilestoneShown }
}
```

- [ ] **Step 4: Run all `useDailyHistory` tests**

Run: `npx vitest run src/game/daily/__tests__/useDailyHistory.test.tsx --no-coverage`
Expected: PASS — all existing tests plus the new "stay in sync" test pass.

Note: the existing tests assume `localStorage.clear()` in `beforeEach`. With a module-level snapshot the store is hydrated once at import time, so a `__resetForTests()` call may be needed in test setup. Add this to the top of the file alongside the existing imports if any test fails because of stale module state:

```typescript
import { __resetForTests } from '../historyStore'
```

…and call `__resetForTests()` in each `beforeEach` after `localStorage.clear()`.

- [ ] **Step 5: Run the full daily test suite to catch downstream regressions**

Run: `npx vitest run src/game/daily --no-coverage`
Expected: PASS — every test in `src/game/daily/__tests__/` passes.

- [ ] **Step 6: Commit**

```bash
git add src/game/daily/useDailyHistory.ts src/game/daily/__tests__/useDailyHistory.test.tsx
git commit -m "fix(daily): share daily-history state across hook instances via store"
```

---

### Task 3: Personal-bests module store

**Files:**
- Create: `src/game/shared/personalBestsStore.ts`
- Create test: `src/game/shared/__tests__/personalBestsStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/shared/__tests__/personalBestsStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  subscribe,
  getSnapshot,
  record,
  __resetForTests,
} from '../personalBestsStore'

const ZERO = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

describe('personalBestsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
  })

  it('returns zeros for an unknown modeId', () => {
    expect(getSnapshot('country-pinning')).toEqual(ZERO)
    expect(getSnapshot('city-guessing')).toEqual(ZERO)
  })

  it('record() writes to the v2 key for that mode and not the other', () => {
    record('country-pinning', 87, 4)

    expect(getSnapshot('country-pinning')).toEqual({ bestScore: 87, bestStreak: 4, gamesPlayed: 1 })
    expect(getSnapshot('city-guessing')).toEqual(ZERO)

    expect(localStorage.getItem('funworldmap-game-country-pinning-bests-v2')).not.toBeNull()
    expect(localStorage.getItem('funworldmap-game-city-guessing-bests-v2')).toBeNull()
  })

  it('record() keeps the higher score and streak per mode', () => {
    record('country-pinning', 50, 2)
    record('country-pinning', 30, 5)
    expect(getSnapshot('country-pinning')).toEqual({ bestScore: 50, bestStreak: 5, gamesPlayed: 2 })
  })

  it('cross-mode isolation: recording in one mode does not change the other', () => {
    record('country-pinning', 100, 7)
    record('city-guessing', 0, 0)
    expect(getSnapshot('country-pinning').bestScore).toBe(100)
    expect(getSnapshot('city-guessing').bestScore).toBe(0)
    expect(getSnapshot('city-guessing').gamesPlayed).toBe(1)
  })

  it('subscribe receives notifications only for the registered mode', () => {
    let countCountry = 0
    let countCity = 0
    const unC = subscribe('country-pinning', () => { countCountry++ })
    const unG = subscribe('city-guessing', () => { countCity++ })

    record('country-pinning', 50, 0)
    expect(countCountry).toBe(1)
    expect(countCity).toBe(0)

    record('city-guessing', 200, 1)
    expect(countCountry).toBe(1)
    expect(countCity).toBe(1)

    unC(); unG()
  })

  it('reads v2 on first access and removes the legacy v1 key for the same mode', () => {
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests',
      JSON.stringify({ bestScore: 999, bestStreak: 99, gamesPlayed: 9 }),
    )
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests-v2',
      JSON.stringify({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 }),
    )
    __resetForTests()

    expect(getSnapshot('country-pinning')).toEqual({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 })
    expect(localStorage.getItem('funworldmap-game-country-pinning-bests')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/shared/__tests__/personalBestsStore.test.ts --no-coverage`
Expected: FAIL with `Cannot find module '../personalBestsStore'`.

- [ ] **Step 3: Implement the store**

Create `src/game/shared/personalBestsStore.ts`:

```typescript
import type { ModeId } from './types'
import type { PersonalBest } from './types'

const ZERO: PersonalBest = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

function v2Key(modeId: string): string {
  return `funworldmap-game-${modeId}-bests-v2`
}

function v1Key(modeId: string): string {
  return `funworldmap-game-${modeId}-bests`
}

function readSafely(modeId: string): PersonalBest {
  // One-time cleanup of v1 (polluted by daily plays). Idempotent.
  try { localStorage.removeItem(v1Key(modeId)) } catch { /* no-op */ }
  try {
    const raw = localStorage.getItem(v2Key(modeId))
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
    localStorage.setItem(v2Key(modeId), JSON.stringify(value))
  } catch { /* private-mode / quota — best effort */ }
}

const snapshots = new Map<ModeId, PersonalBest>()
const listenersByMode = new Map<ModeId, Set<() => void>>()

function ensureLoaded(modeId: ModeId): PersonalBest {
  let cur = snapshots.get(modeId)
  if (cur) return cur
  cur = readSafely(modeId)
  snapshots.set(modeId, cur)
  return cur
}

export function getSnapshot(modeId: ModeId): PersonalBest {
  return ensureLoaded(modeId)
}

export function subscribe(modeId: ModeId, listener: () => void): () => void {
  let set = listenersByMode.get(modeId)
  if (!set) { set = new Set(); listenersByMode.set(modeId, set) }
  set.add(listener)
  return () => { set!.delete(listener) }
}

export function record(modeId: ModeId, score: number, streak: number): PersonalBest {
  const prev = ensureLoaded(modeId)
  const next: PersonalBest = {
    bestScore: Math.max(prev.bestScore, score),
    bestStreak: Math.max(prev.bestStreak, streak),
    gamesPlayed: prev.gamesPlayed + 1,
  }
  snapshots.set(modeId, next)
  writeSafely(modeId, next)
  const set = listenersByMode.get(modeId)
  if (set) for (const l of [...set]) l()
  return next
}

/** Test seam — clear all cached snapshots and listeners. */
export function __resetForTests(): void {
  snapshots.clear()
  listenersByMode.clear()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/game/shared/__tests__/personalBestsStore.test.ts --no-coverage`
Expected: PASS — six tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/shared/personalBestsStore.ts src/game/shared/__tests__/personalBestsStore.test.ts
git commit -m "feat(game): add per-mode personal-bests store"
```

---

### Task 4: Refactor `usePersonalBests` onto the store

**Files:**
- Modify: `src/game/shared/usePersonalBests.ts` (full file replacement)
- Modify: `src/game/shared/__tests__/usePersonalBests.test.ts` (add cross-instance + cross-mode-switch tests)
- Modify: `src/game/shared/__tests__/bestsKeyMigration.test.ts` (no-op behaviourally; add `__resetForTests` if needed)

- [ ] **Step 1: Write the failing tests**

Append to `src/game/shared/__tests__/usePersonalBests.test.ts`:

```typescript
  it('two hook instances of the same mode stay in sync', () => {
    const a = renderHook(() => usePersonalBests('country-pinning'))
    const b = renderHook(() => usePersonalBests('country-pinning'))
    act(() => { a.result.current.record(120, 3) })
    expect(b.result.current.best).toEqual({ bestScore: 120, bestStreak: 3, gamesPlayed: 1 })
  })

  it('does not contaminate across modes — recording in one mode leaves the other at zero', () => {
    const country = renderHook(() => usePersonalBests('country-pinning'))
    const city = renderHook(() => usePersonalBests('city-guessing'))

    act(() => { country.result.current.record(14, 0) })
    act(() => { city.result.current.record(0, 0) })

    expect(country.result.current.best).toEqual({ bestScore: 14, bestStreak: 0, gamesPlayed: 1 })
    expect(city.result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 1 })

    const cityStored = JSON.parse(
      localStorage.getItem('funworldmap-game-city-guessing-bests-v2') ?? 'null',
    )
    expect(cityStored.bestScore).toBe(0)
    expect(cityStored.gamesPlayed).toBe(1)
  })

  it('hook re-keyed mid-life returns the new mode value, not the stale one', () => {
    let modeId: 'country-pinning' | 'city-guessing' = 'country-pinning'
    const { result, rerender } = renderHook(() => usePersonalBests(modeId))
    act(() => { result.current.record(50, 0) })
    expect(result.current.best.bestScore).toBe(50)

    modeId = 'city-guessing'
    rerender()
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })
```

Also add to the top of the file:

```typescript
import { __resetForTests as resetPbStore } from '../personalBestsStore'
```

…and update the `beforeEach` to:

```typescript
  beforeEach(() => {
    localStorage.clear()
    resetPbStore()
  })
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/game/shared/__tests__/usePersonalBests.test.ts -t "stay in sync|contaminate|re-keyed" --no-coverage`
Expected: FAIL — current implementation contaminates city PB with country PB; reads stale state; cross-instance writes don't propagate.

- [ ] **Step 3: Replace `usePersonalBests.ts` with a store-backed version**

Replace the entire contents of `src/game/shared/usePersonalBests.ts`:

```typescript
import { useCallback, useSyncExternalStore } from 'react'
import type { PersonalBest, ModeId } from './types'
import { subscribe, getSnapshot, record as storeRecord } from './personalBestsStore'

export function usePersonalBests(modeId: ModeId): {
  best: PersonalBest
  record: (score: number, streak: number) => PersonalBest
} {
  const subscribeForMode = useCallback(
    (listener: () => void) => subscribe(modeId, listener),
    [modeId],
  )
  const getSnapshotForMode = useCallback(() => getSnapshot(modeId), [modeId])

  const best = useSyncExternalStore(subscribeForMode, getSnapshotForMode, getSnapshotForMode)

  const record = useCallback(
    (score: number, streak: number): PersonalBest => storeRecord(modeId, score, streak),
    [modeId],
  )

  return { best, record }
}
```

- [ ] **Step 4: Run all `usePersonalBests` and migration tests**

Run: `npx vitest run src/game/shared/__tests__/usePersonalBests.test.ts src/game/shared/__tests__/bestsKeyMigration.test.ts --no-coverage`
Expected: PASS — every test in both files. If `bestsKeyMigration.test.ts` fails because of cached snapshots between tests, prepend its `beforeEach` with `__resetForTests()` from `personalBestsStore` (mirroring the pattern in `usePersonalBests.test.ts`).

- [ ] **Step 5: Run the full game test suite**

Run: `npx vitest run src/game --no-coverage`
Expected: PASS — every game-related unit test still green.

- [ ] **Step 6: Commit**

```bash
git add src/game/shared/usePersonalBests.ts src/game/shared/__tests__/usePersonalBests.test.ts src/game/shared/__tests__/bestsKeyMigration.test.ts
git commit -m "fix(game): share personal-best state across hook instances and modes"
```

---

### Task 5: GameOverOverlay — hide PB on daily, freeze "New PB!", fix pluralization

This task addresses three issues in one place: bug #5 (PB block on daily), bug #6 (plural copy), and bug #4 (PB flash). The flash fix is independent of the store refactor: once `record()` updates the live `best` value via the store (Task 4), `GameController` re-renders and recomputes `const beatPB = session.score > best.bestScore || ...` — which flips to false on the second commit. The overlay must freeze its `beatPersonalBest` prop at first paint so the second commit doesn't change the displayed message.

**Files:**
- Modify: `src/game/shared/hud/GameOverOverlay.tsx`
- Create test: `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameOverOverlay } from '../GameOverOverlay'
import type { GameSession, PersonalBest } from '../../types'

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
  used: new Set(),
}

const zeroBest: PersonalBest = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

describe('GameOverOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  it('says "1 round complete." when maxRounds is 1', () => {
    window.location.hash = '#daily/2026-04-27/country-pinning'
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: 1 }}
        personalBest={zeroBest}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText('1 round complete.')).toBeTruthy()
  })

  it('says "10 rounds complete." when maxRounds is 10', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: 10, attemptsPerRound: 1 }}
        personalBest={zeroBest}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText('10 rounds complete.')).toBeTruthy()
  })

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
    expect(screen.queryByText(/personal best/i)).toBeNull()
  })

  it('shows the personal-best block on free plays', () => {
    window.location.hash = '#game/country-pinning'
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: null, attemptsPerRound: 1 }}
        personalBest={zeroBest}
        beatPersonalBest={true}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByTestId('game-over-pb')).toBeTruthy()
    expect(screen.getByText(/new personal best/i)).toBeTruthy()
  })

  it('keeps "New personal best!" when beatPersonalBest later flips to false (post-record re-render)', () => {
    window.location.hash = '#game/country-pinning'
    const session = { ...baseSession, maxRounds: null, attemptsPerRound: 1 }
    const { rerender } = render(
      <GameOverOverlay
        session={session}
        personalBest={zeroBest}
        beatPersonalBest={true}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText(/new personal best/i)).toBeTruthy()

    // Simulate the post-record re-render: PB now equals the score, beatPB flipped to false.
    rerender(
      <GameOverOverlay
        session={session}
        personalBest={{ bestScore: 100, bestStreak: 0, gamesPlayed: 1 }}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText(/new personal best/i)).toBeTruthy()
    expect(screen.queryByText(/best: 100 pts/i)).toBeNull()
  })

  it('shows "Best: N pts" stably when beatPersonalBest started false', () => {
    window.location.hash = '#game/country-pinning'
    const session = { ...baseSession, maxRounds: null, attemptsPerRound: 1, score: 14 }
    render(
      <GameOverOverlay
        session={session}
        personalBest={{ bestScore: 50, bestStreak: 2, gamesPlayed: 3 }}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText(/best: 50 pts/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npx vitest run src/game/shared/hud/__tests__/GameOverOverlay.test.tsx --no-coverage`
Expected: FAIL — currently the overlay says "1 rounds complete." (plural), renders the PB block on daily plays, and flips "New personal best!" to "Best: 100 pts" on rerender.

- [ ] **Step 3: Apply the three fixes inside `GameOverOverlay.tsx`**

Open `src/game/shared/hud/GameOverOverlay.tsx`. Three edits.

**Edit 3a — import `useState` if not already imported.** The existing imports include `useEffect, useRef`; extend that line to:

```tsx
import { useEffect, useRef, useState } from 'react'
```

**Edit 3b — capture `beatPersonalBest` once at mount.** Just after the existing destructure of props (`function GameOverOverlay({ session, personalBest, beatPersonalBest, ... }: Props) {`), add this line as the first statement inside the function body:

```tsx
  // Freeze the prop at first paint. GameController recomputes beatPB from a
  // live store value that updates immediately after game-over (when record()
  // fires), which would flip "New personal best!" to "Best: N pts" on the
  // very next render. Capturing once preserves the message for the user.
  const [stableBeatPB] = useState(beatPersonalBest)
```

**Edit 3c — replace the rounds-complete copy.** Find the existing `<p>` block containing `${session.maxRounds} rounds complete.` and replace with:

```tsx
        <p className="text-sm text-sand-600 dark:text-dark-100 mb-4">
          {session.maxRounds === null
            ? 'Three wrong guesses.'
            : session.maxRounds === 1
              ? '1 round complete.'
              : `${session.maxRounds} rounds complete.`}
        </p>
```

**Edit 3d — gate the PB block on `!isDaily` and use `stableBeatPB`.** Replace the existing PB block:

```tsx
        <div className="text-xs text-sand-600 dark:text-dark-100 mb-5" data-testid="game-over-pb">
          {beatPersonalBest ? (
            <span className="font-semibold text-teal-accessible dark:text-teal-light">New personal best!</span>
          ) : (
            <>Best: {personalBest.bestScore} pts · {personalBest.bestStreak} streak</>
          )}
        </div>
```

…with:

```tsx
        {!isDaily && (
          <div className="text-xs text-sand-600 dark:text-dark-100 mb-5" data-testid="game-over-pb">
            {stableBeatPB ? (
              <span className="font-semibold text-teal-accessible dark:text-teal-light">New personal best!</span>
            ) : (
              <>Best: {personalBest.bestScore} pts · {personalBest.bestStreak} streak</>
            )}
          </div>
        )}
```

Note the `personalBest.bestScore` in the false branch is intentionally *not* frozen: when the user did **not** beat their PB, the displayed best is their *previous* PB, which is identical before and after `record()` (record() takes `Math.max`, so a non-beating score doesn't change the stored value). The displayed number is stable without any extra capture.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/game/shared/hud/__tests__/GameOverOverlay.test.tsx --no-coverage`
Expected: PASS — all six tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/shared/hud/GameOverOverlay.tsx src/game/shared/hud/__tests__/GameOverOverlay.test.tsx
git commit -m "fix(hud): freeze beatPB at mount, hide PB on daily, pluralize rounds copy"
```

---

### Task 6: Surface running best-of-N score in the HUD

**Files:**
- Modify: `src/game/shared/hud/HudShell.tsx`
- Modify: `src/game/shared/hud/ScoreBadge.tsx`
- Create test: `src/game/shared/hud/__tests__/ScoreBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/game/shared/hud/__tests__/ScoreBadge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBadge } from '../ScoreBadge'

describe('ScoreBadge', () => {
  it('renders the score', () => {
    render(<ScoreBadge score={42} />)
    expect(screen.getByTestId('hud-score').textContent).toBe('42')
  })

  it('marks the badge as pending when running best-of-N', () => {
    render(<ScoreBadge score={75} pending />)
    const badge = screen.getByTestId('hud-score')
    expect(badge.getAttribute('data-pending')).toBe('true')
    expect(badge.textContent).toBe('75')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/shared/hud/__tests__/ScoreBadge.test.tsx --no-coverage`
Expected: FAIL — `data-pending` attribute does not exist yet.

- [ ] **Step 3: Update `ScoreBadge.tsx`**

Replace `src/game/shared/hud/ScoreBadge.tsx`:

```tsx
interface Props {
  score: number
  pending?: boolean
}

export function ScoreBadge({ score, pending = false }: Props) {
  return (
    <div
      className={`px-2.5 py-1 rounded-full bg-sand-100/90 dark:bg-dark-400/80 border text-sm font-semibold tabular-nums ${
        pending
          ? 'border-teal-accessible/60 text-teal-accessible dark:text-teal-light'
          : 'border-sand-300/50 dark:border-dark-200/30 text-sand-900 dark:text-dark-50'
      }`}
      data-testid="hud-score"
      data-pending={pending ? 'true' : undefined}
      title={pending ? 'Best so far this round' : undefined}
    >
      {score}
    </div>
  )
}
```

- [ ] **Step 4: Verify the ScoreBadge test passes**

Run: `npx vitest run src/game/shared/hud/__tests__/ScoreBadge.test.tsx --no-coverage`
Expected: PASS — both tests.

- [ ] **Step 5: Wire HudShell to compute and pass the running max**

In `src/game/shared/hud/HudShell.tsx`, replace the body of the component (everything from `export function HudShell` through the end of the file) with:

```tsx
export function HudShell({ session, onEndGame, onDone, children }: Props) {
  const bestOfN = session.attemptsPerRound > 1
  const fixedRounds = session.maxRounds !== null && session.maxRounds > 1
  const showDone = bestOfN && session.status === 'playing' && session.currentAttempts.length > 0

  // For best-of-N rounds the cumulative `session.score` is updated only on
  // round-end, so it stays at 0 throughout the round. Surface the running
  // best instead — and tag it so the badge can style it as provisional.
  const runningBest =
    bestOfN && session.status === 'playing' && session.currentAttempts.length > 0
      ? Math.max(...session.currentAttempts.map((a) => a.pointsEarned))
      : null
  const displayScore = runningBest ?? session.score
  const scorePending = runningBest !== null

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
            <ScoreBadge score={displayScore} pending={scorePending} />
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

- [ ] **Step 6: Run the full HUD test suite**

Run: `npx vitest run src/game/shared/hud --no-coverage`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/shared/hud/HudShell.tsx src/game/shared/hud/ScoreBadge.tsx src/game/shared/hud/__tests__/ScoreBadge.test.tsx
git commit -m "fix(hud): show running best-of-N score during round, mark as pending"
```

---

### Task 7: Allow mode switch from `game-over` via direct URL navigation

**Files:**
- Modify: `src/game/GameController.tsx`

This bug is the bootstrap effect's two `=== 'idle'` gates rejecting the `game-over` → new-game transition. The fix is structural: when the route asks for a `game` or `daily` start and the session is in `game-over`, dispatch `endGame()` first, then proceed to the start branch in the same `check()` invocation. `endGame` is synchronous on the dispatcher (it queues a state update). Because the bootstrap reads `statusRef.current` (a mutable ref) rather than `session.status`, we can update the ref locally after `endGame()` dispatches so the existing branch's `=== 'idle'` guards still work.

- [ ] **Step 1: Inspect the current bootstrap and locate the two gates**

Open `src/game/GameController.tsx` and find the `useEffect` whose body declares `const check = () => { ... }`. Inside, two branches start with:

```ts
if (state.kind === 'daily' && state.modeId && !state.reveal && statusRef.current === 'idle') {
```

…and

```ts
if (state.kind === 'game' && statusRef.current === 'idle') {
```

- [ ] **Step 2: Add an early game-over → idle reset at the top of `check()`**

Inside `check()`, immediately after `const state = parseHash(window.location.hash)` (and before the `if (state.kind === 'daily' && state.reveal)` early-return for the reveal-route emit), insert this block:

```ts
      // If a game/daily route arrives while the previous session is still in
      // game-over (e.g. user pasted a different mode URL or used browser
      // back/forward), end the previous session synchronously so the start
      // branches below proceed. statusRef is a mutable ref, so we mirror the
      // dispatch locally to keep the `=== 'idle'` guards consistent within
      // this same check() invocation.
      if (
        statusRef.current === 'game-over' &&
        ((state.kind === 'game' && state.modeId) ||
          (state.kind === 'daily' && state.modeId && !state.reveal))
      ) {
        clearResume()
        endGame()
        statusRef.current = 'idle'
      }
```

- [ ] **Step 3: Type-check the project**

Run: `npx tsc -b --noEmit`
Expected: PASS — no errors.

- [ ] **Step 4: Run all unit tests to confirm no regressions**

Run: `npx vitest run --no-coverage`
Expected: PASS — every test still green.

- [ ] **Step 5: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "fix(game): end previous session when navigating to a new mode during game-over"
```

---

### Task 8: e2e regression — mode switch during game-over

**Files:**
- Create: `e2e/game-over-mode-switch.spec.ts`

The two flaws in the first draft of this test (caught during plan self-review): `page.goto` with a hash-only change to a different mode URL still triggers a fresh load in some Playwright/browser combos, which would wipe in-memory `game-over` state and defeat the test premise — use `window.location.hash = …` instead. And firing Escape after every wrong guess fires Escape on the *third* wrong guess too, where the session is already in `game-over` and the *exit* Escape handler (`GameController.tsx:700`) is registered — which dispatches `endGame()` and breaks the assertion. Skip Escape on the third iteration.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/game-over-mode-switch.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers'

test.setTimeout(60_000)

test.describe('game-over → new mode', () => {
  test('hash-changing to a different #game URL during game-over starts the new mode', async ({ page }) => {
    await page.goto('/#game/country-pinning')
    await waitForAppReady(page)

    // Burn three lives via the test hook. Escape advances the country-pinning
    // round-end after wrong guesses #1 and #2; on #3 the session is already
    // game-over and the *other* Escape handler (exit) would clear it, so
    // skip Escape on the final iteration.
    await page.evaluate(async () => {
      for (let i = 0; i < 2; i++) {
        // @ts-expect-error — test seam
        window.__funworldmap_game.submitCountryGuess('USA')
        await new Promise((r) => setTimeout(r, 300))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await new Promise((r) => setTimeout(r, 300))
      }
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('USA')
      await new Promise((r) => setTimeout(r, 300))
    })
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })

    // Hash-only nav — does NOT reload the page, so the in-memory game-over
    // state is preserved up to the moment the bootstrap effect re-runs.
    await page.evaluate(() => {
      window.location.hash = '#game/city-guessing'
    })

    // The game-over overlay must disappear and a city-guessing prompt must mount.
    await expect(page.getByTestId('game-over')).toBeHidden({ timeout: 5_000 })
    await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-mode', 'city-guessing')
    await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  })
})
```

- [ ] **Step 2: Run the e2e test against a built bundle**

Run:

```bash
npm run build:e2e && npx playwright test e2e/game-over-mode-switch.spec.ts
```

Expected: PASS — the test relies on `VITE_TEST_HOOKS` being set by `build:e2e`, the new branch in the bootstrap clearing the previous `game-over`, and the existing start path mounting the new mode.

- [ ] **Step 3: Commit**

```bash
git add e2e/game-over-mode-switch.spec.ts
git commit -m "test(e2e): regress mode switch during game-over"
```

---

### Task 9: e2e regression — daily share block visible immediately

**Files:**
- Create: `e2e/daily-share-block-immediate.spec.ts`

- [ ] **Step 1: Write the failing-without-Task-2 test**

Create `e2e/daily-share-block-immediate.spec.ts`:

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
        days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'paris' } } },
      }
      ;(window as unknown as { __seededIndex?: unknown }).__seededIndex = index
      // Wipe any leftover daily history from a previous run.
      localStorage.removeItem('funworldmap-daily-history')
      localStorage.removeItem('funworldmap-daily-resume')
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

test.describe('daily share block on game-over', () => {
  test('first daily completion of the day shows the share block immediately', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedTodayPuzzle(page, today)
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)

    // Three correct attempts → completeNow → game-over.
    await page.evaluate(async () => {
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('FRA')
      // @ts-expect-error
      window.__funworldmap_game.completeNow()
    })

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 5_000 })
    const preview = page.getByTestId('daily-share-preview')
    const text = (await preview.textContent()) ?? ''
    expect(text).toContain('100/100')
  })

  test('second mode of the day reflects in the share text immediately', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedTodayPuzzle(page, today)
    // Pre-seed country played; play city next.
    await page.addInitScript((d: string) => {
      const history = {
        version: 1,
        streak: { current: 1, longest: 1, lastActiveDate: d, lastMilestoneShown: 0 },
        days: {
          [d]: {
            'country-pinning': { score: 100, attempts: [], completedAt: 1 },
          },
        },
      }
      localStorage.setItem('funworldmap-daily-history', JSON.stringify(history))
    }, today)

    await page.goto(`/#daily/${today}/city-guessing`)
    await waitForAppReady(page)

    await page.evaluate(async () => {
      // @ts-expect-error
      window.__funworldmap_game.submitGuess({ kind: 'point', lngLat: [2.3522, 48.8566] })
      // @ts-expect-error
      window.__funworldmap_game.completeNow()
    })

    await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 5_000 })
    const preview = page.getByTestId('daily-share-preview')
    const text = (await preview.textContent()) ?? ''
    expect(text).not.toContain('not played')
    expect(text).toMatch(/100\/100/)
  })
})
```

- [ ] **Step 2: Build and run the e2e**

Run:

```bash
npm run build:e2e && npx playwright test e2e/daily-share-block-immediate.spec.ts
```

Expected: PASS — Task 2 made the share block read live state from the store, so the overlay sees the just-completed mode.

- [ ] **Step 3: Commit**

```bash
git add e2e/daily-share-block-immediate.spec.ts
git commit -m "test(e2e): regress immediate daily share block on game-over"
```

---

### Task 10: Documentation update

**Files:**
- Modify: `docs/systems/daily-puzzle.md`

- [ ] **Step 1: Add a state-architecture note**

Open `docs/systems/daily-puzzle.md`. Find the `## Storage shape` section. Immediately after the closing of that section's body and before `### Resume key`, insert this paragraph:

```markdown
### State sharing

Daily history and personal-best state live in module-level stores
(`src/game/daily/historyStore.ts`, `src/game/shared/personalBestsStore.ts`)
exposed to React via `useSyncExternalStore`. A single write is visible to
every consumer (`<GameOverOverlay>`, `<DailyShareBlock>`, `<Launcher>`,
etc.) on the same render. The `useDailyHistory()` and `usePersonalBests()`
hooks have not changed shape — only their backing storage.

```

- [ ] **Step 2: Commit**

```bash
git add docs/systems/daily-puzzle.md
git commit -m "docs(daily): note module-level stores backing the React hooks"
```

---

### Task 11: Final verification — lint, typecheck, full unit suite, full e2e

Tasks 1–10 each ran their own scoped suite. This task is the integration gate: catch regressions from changed hook contracts in callers we didn't otherwise touch (`Launcher.tsx`, `DailyShareBlock.tsx`, `DailyRevealOverlay.tsx`, `LauncherStreakPill.tsx`, `LauncherHistoryPanel.tsx` — all of which read from one or both stores).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS — no errors. The existing `eslint-plugin-react-hooks` will flag any `useSyncExternalStore` misuse (e.g. unstable subscribe/getSnapshot identities not wrapped in `useCallback`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS — no errors.

- [ ] **Step 3: Full unit suite**

Run: `npm run test:unit`
Expected: PASS — every Vitest test green. If a test for `Launcher`, `DailyShareBlock`, or `DailyRevealOverlay` fails because of cached store state across tests, add `__resetForTests()` from the relevant store to that test file's `beforeEach`.

- [ ] **Step 4: Full e2e suite**

Run: `npm run build:e2e && npm run test:e2e`
Expected: PASS — every Playwright test green, including the two new specs.

- [ ] **Step 5: Manual smoke pass**

Open the app in a fresh browser profile (Incognito). Run through the four scenarios:

| Scenario | Expected outcome |
|---|---|
| Play today's country-pinning daily to completion | Share block visible on game-over with non-stale data; "New personal best!" not shown (daily); copy reads `"1 round complete."` |
| Play country-pinning free, lose 3 lives | Personal-best line stable as "New personal best!" (does not flip to "Best: N pts") |
| Play country-pinning free → game-over → paste `#game/city-guessing` URL | City-guessing starts; previous overlay disappears |
| Play country-pinning free (score 14), then play city-guessing free (score 0) | `localStorage['funworldmap-game-city-guessing-bests-v2']` reads `{bestScore:0, gamesPlayed:1}` — **not** `{bestScore:14, gamesPlayed:2}` |

If all four pass, the deliverable is complete.

- [ ] **Step 6: Commit (if any test-file fixes were needed)**

If `__resetForTests()` calls were added to existing test files in Step 3, commit them:

```bash
git add -p src/
git commit -m "test: reset module-level stores between tests for isolation"
```

Otherwise nothing to commit at this step.

---

## Verification matrix

| Bug | Severity | Resolved by | Verified by |
|---|---|---|---|
| #1 Daily share block missing on first daily | CRITICAL | Tasks 1, 2 (store + hook refactor) | Task 9 e2e |
| #2 Share block stale data | CRITICAL | Tasks 1, 2 | Task 9 e2e (second mode case) |
| #3 Cross-mode PB contamination | CRITICAL | Tasks 3, 4 | Task 4 unit (`does not contaminate`) + Task 11 manual scenario 4 |
| #4 "New personal best!" never visible | HIGH | Task 5 (orthogonal `useState` freeze; not actually fixed by Tasks 1–4 — see "Plan self-review" below) | Task 5 unit (`keeps "New personal best!"` test) + Task 11 manual scenario 2 |
| #5 PB block shown on daily plays | HIGH | Task 5 | Task 5 unit |
| #6 "1 rounds complete." | HIGH | Task 5 | Task 5 unit |
| #7 HUD score 0 in best-of-N | MEDIUM | Task 6 | Task 6 unit + visible during Task 11 manual scenario 1 |
| #8 Hash-switch dead-end during game-over | MEDIUM | Task 7 | Task 8 e2e + Task 11 manual scenario 3 |

## Plan self-review

This section documents three gaps caught during a critical review of the first draft of this plan, all of which are resolved in the version above. Surfacing them here as a record so a future engineer knows the reasoning.

1. **Bug #4 is NOT fixed by Tasks 1–4 — it needs an orthogonal freeze in Task 5.**
   The first draft credited the store refactor with fixing the "New personal best!" flash. That is wrong. After the store refactor, `record()` still updates `best` and triggers a re-render of `GameController`, which recomputes `const beatPB = session.score > best.bestScore || ...` (`GameController.tsx:728`) — flipping `beatPB` from `true` to `false` on the second commit. The shared store makes the re-render *more deterministic*, not slower. The actual fix is to capture `beatPersonalBest` once at first paint via `useState(beatPersonalBest)` in `GameOverOverlay`. Task 5 now contains this fix and a regression test for it.

2. **Task 8 e2e originally used `page.goto` for hash-only navigation, which can reload the page in some Playwright/browser combinations.** A reload wipes in-memory `game-over` state, defeating the test premise. The revised test uses `await page.evaluate(() => { window.location.hash = '...' })`, which guarantees a hashchange event without a load.

3. **Task 8 e2e originally fired Escape on every wrong-guess iteration.** On the third wrong guess, the session is already in `game-over`, and the *exit* Escape handler (`GameController.tsx:700`, registered for any non-`round-ended-country-pinning` non-`idle` state) dispatches `endGame()` — clearing the overlay before the assertion runs and returning a false-positive PASS even with the bug present. The revised test only fires Escape on the first two iterations.

4. **Task 7 (bootstrap) is intentionally scoped to `statusRef.current === 'game-over'` only.** A broader `!== 'idle'` would also auto-end mid-attempt sessions when the user navigates away — that's surprising behaviour, and the existing logic that lets the resume blob persist for return-to-daily depends on mid-attempt sessions not being torn down by hash-changes within the `game`/`daily` route family. Game-over is the only state where the user is unambiguously done.

## Other self-review

1. **Spec coverage:** every assessment finding has at least one task. The two e2e specs (Tasks 8, 9) cover the integration paths that unit tests can't reach (#8 mode switch, #1/#2 game-over share block visibility under real component composition). Task 11 is the integration gate. ✓
2. **Placeholder scan:** no "TBD", "implement later", or "similar to Task N" — every step has either runnable commands or full code. ✓
3. **Type consistency:**
   - `historyStore`: `subscribe(listener)`, `getSnapshot()`, `setHistory(updater)`, `__resetForTests()` — used identically in Task 1 test and Task 2 hook.
   - `personalBestsStore`: `subscribe(modeId, listener)`, `getSnapshot(modeId)`, `record(modeId, score, streak)`, `__resetForTests()` — consistent across Task 3 test and Task 4 hook.
   - `ScoreBadge` props (`{ score: number; pending?: boolean }`) match the call site in Task 6's HudShell.
   - `data-pending` attribute is the same string in test and component.
   - `useDailyHistory` / `usePersonalBests` public APIs are unchanged, so callers in `Launcher.tsx`, `GameController.tsx`, `DailyRevealOverlay.tsx`, `DailyShareBlock.tsx`, `GameOverOverlay.tsx` need no edits beyond the targeted fixes in Task 5. ✓
4. **Risk:** the v1→v2 migration in `personalBestsStore.readSafely` removes the v1 key. The existing `bestsKeyMigration.test.ts` verifies this; Task 4 keeps that test green. The 90-day prune now happens once at module load, not on every hook mount — semantically identical for any user opening the app at least once a day, and strictly better (one prune call vs one per `useDailyHistory` consumer). ✓
5. **`useSyncExternalStore` semantics:** the third argument (`getServerSnapshot`) is set to the same function as the second; the app is CSR-only so server-snapshot mismatch is not a concern. The subscribe and getSnapshot identities are wrapped in `useCallback([modeId])` for `usePersonalBests` so that re-keying the hook from one mode to another correctly re-subscribes. Verified by the "hook re-keyed mid-life" test in Task 4. ✓
