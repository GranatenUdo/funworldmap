> **Tombstone (2026-06-12):** the daily-puzzle/retention feature this plan built was removed in PR #97 (2026-05-30, "Remove the daily puzzle"). Kept unmodified for history — do not implement from it.

# Retention Program v1 — Phase 2: Daily Play End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship playable daily puzzles end-to-end: fetch today's country + city, let the user attempt each up to 3 times with between-attempt distance feedback, score best-of-3, record the result locally, and reflect on the launcher. Zero new UI beyond the launcher rewrite; streak display, calendar, and share flows are Phases 3–5.

**Architecture:** Three concerns plug into the existing game framework:

1. **Data** — a rolling `public/daily/index.json` (Phase 1) is consumed by `useDailyPuzzles` (session-scoped fetch with cache + status). A new `useDailyHistory` hook wraps `localStorage` (`funworldmap-daily-history`) to record attempts and maintain the streak state machine.
2. **Session** — `GameSession` gains `attemptsPerRound`, `attemptsRemaining`, and `currentAttempts[]`. When `attemptsRemaining > 0`, the reducer keeps status at `playing` and records the attempt; when the last attempt exhausts or the user triggers `revealEarly`, the reducer transitions to `round-ended` with best-of-3 score. Free mode passes `attemptsPerRound: 1` (no behavior change).
3. **UX** — `LauncherModeCard` is rewritten as a three-state component (`unplayed` / `played` / `unavailable`) with dual CTAs: primary (daily) and a secondary free-mode link. `#daily/<date>/<modeId>` URLs bypass the launcher and start the daily session directly.

**Tech Stack:** TypeScript, React 19, Vitest, Playwright, existing game framework under `src/game/`.

---

## Scope

This plan implements **Phase 2** of [`2026-04-21-retention-program-v1-design.md`](../specs/2026-04-21-retention-program-v1-design.md). It depends on Phase 1 (`d64e36b`, merged) for `public/daily/index.json`, `src/lib/hashState.ts` `daily` variant, `src/lib/analytics.ts`, and `src/game/daily/dates.ts`.

### In scope

- `useDailyPuzzles` + `useDailyHistory` hooks, plus a pure `storage.ts` module.
- Game framework `attemptsPerRound` / `attemptsRemaining` / `currentAttempts[]` extension with accompanying reducer actions (`attempt`, `revealEarly`).
- `GameSessionProvider.submitGuessInput` branching: intermediate attempts vs final attempt vs reveal-early.
- Daily session starter functions per mode (`country-pinning` / `city-guessing`).
- `GameController` intermediate-reveal handling between attempts (distance label + guess-marker/country-highlight, no target reveal).
- `LauncherModeCard` three-state rewrite with `unplayed` / `played` / `unavailable` states; dual CTAs (daily primary + free secondary); test ids `launcher-card-{id}-state`, `launcher-card-{id}-daily-cta`, `launcher-card-{id}-free-link`.
- `Launcher.tsx` integration with the daily hooks and new card shape.
- `useLauncherVisibility.isDailyRoot` extension so `#daily/<YYYY-MM-DD>` (no mode) opens the launcher anchored to that date.
- `App.tsx` daily-hash handler switches from redirect-to-root (Phase 1 stub) to real routing for `#daily/<date>/<modeId>`.
- Baseline analytics wiring for `daily_opened`, `daily_started`, `daily_attempted`, `daily_completed`.
- Streak state machine computed on daily completion (written to storage but not yet displayed — Phase 3 reads it).
- New e2e spec `daily-puzzle.spec.ts`.
- Migration of `game-country-pinning.spec.ts` + `game-city-guessing.spec.ts` to click the new free-mode link.
- Removal of the two obsolete blocks in `launcher.spec.ts`; new `Launcher — daily state` block.

### Out of scope (Phase 3+)

- Streak pill UI / `launcher-streak` visible element.
- Calendar panel / `LauncherHistoryPanel` / `LauncherCalendarCell`.
- Streak-milestone celebration overlays.
- `#daily/<date>/reveal` and `#daily/<date>/<mode>/reveal` routes (reveal-only views).
- Share block / `DailyShareBlock` / share text function.
- `navigator.share` + clipboard fallback.
- Polish pass (axe audit across new surfaces, reduced-motion final pass).

### Implementation-level decisions (pinned before execution)

1. **Approach A over Approach B for attempts.** `GameSession` is extended (Approach A per the spec) rather than introducing a parallel `DailyController`. Keeps one source of truth for reveal geometry. Free mode passes `attemptsPerRound: 1` — identical runtime behavior to today.
2. **Intermediate reveals do NOT fire `'round-ended'`.** They stay at status `playing` with a transient `currentAttempts[]` array; HUD reads `currentAttempts.length` to display attempt count and prior distances. The full `round-ended` transition happens only on attempt 3 or `revealEarly`.
3. **Daily session maxRounds is always 1.** The 3 attempts are per-round, not across rounds. Round aggregation infrastructure (roundIndex, used set) is unused for daily.
4. **`used` is seeded with the daily target id on `start()`** so future framework extensions (e.g. bonus rounds) can't re-pick it.
5. **Best-of-3 scoring** — `lastOutcome.pointsEarned` on `round-ended` equals `max(...currentAttempts.map(a => a.pointsEarned))`. `session.score` also reflects that.
6. **Between-attempt distance feedback**: country mode shows the guessed country highlighted in the warm-accent color (not correct-green) plus a distance pill in the HUD; city mode shows the guess point with a muted grey marker and a dashed line *without* revealing the target. On the final attempt / reveal, the existing reveal geometry renders as today.
7. **Storage write timing** — `useDailyHistory.record(date, modeId, dayResult)` is called once per completed daily, on transition into `round-ended` for a daily session. The streak state machine is evaluated at the same moment.
8. **Daily session detection in the framework** — encoded via `session.maxRounds === 1 && session.attemptsPerRound === 3`. No new `sessionKind` enum; the tuple is sufficient and avoids parallel state.

---

## File structure

### Created

- `src/game/daily/types.ts` — `DailyIndex`, `DayEntry`, `AttemptRecord`, `DailyDayResult`, `DailyHistoryV1`, `StreakState`.
- `src/game/daily/storage.ts` — pure `readHistory()`, `writeHistory(v)`, `pruneOlderThan(v, days)`, `mergeDay(v, date, modeId, result)`, `updateStreak(v, date)`.
- `src/game/daily/__tests__/storage.test.ts`
- `src/game/daily/useDailyPuzzles.ts` — session-scoped fetch of `/daily/index.json` with status (`loading` / `ready` / `unavailable`).
- `src/game/daily/__tests__/useDailyPuzzles.test.tsx`
- `src/game/daily/DailyPuzzlesProvider.tsx` — Context that hoists `useDailyPuzzles()` once at the app root. `Launcher` and `GameController` both consume via `useDailyPuzzlesContext()`. Replaces the earlier plan's `__funworldmap_daily` window-global hack.
- `src/game/daily/useDailyHistory.ts` — wraps `storage`, exposes `{ get, record, history, streak }`.
- `src/game/daily/__tests__/useDailyHistory.test.tsx`
- `src/game/daily/dailyRound.ts` — pure builders `buildCountryDailyRound(cca3, pool)`, `buildCityDailyRound(id, pool)` returning `RoundSpec`.
- `src/game/daily/__tests__/dailyRound.test.ts`
- `e2e/daily-puzzle.spec.ts` — happy-path + edge-case Playwright tests.

### Modified

- `src/game/shared/types.ts` — extend `GameSession` with `attemptsPerRound`, `attemptsRemaining`, `currentAttempts`; add `AttemptRecord` type.
- `src/game/shared/useGameSession.ts` — extend `start` signature, add `attempt` + `revealEarly` actions, update reducer.
- `src/game/shared/GameSessionProvider.tsx` — extend API (`submitGuessInput` branching, `revealEarly`), update test-shim exposure.
- `src/game/shared/__tests__/useGameSession.test.ts` (extension; existing tests stay green).
- `src/game/GameController.tsx` — intermediate reveal handling; daily detection; record-on-complete hook call.
- `src/components/Launcher.tsx` — consumes daily hooks, renders three-state cards, dispatches daily/free start.
- `src/components/LauncherModeCard.tsx` — majority rewrite: three-state render, dual CTAs, new test ids.
- `src/hooks/useLauncherVisibility.ts` — add `isDailyRoot` case to the visibility predicate.
- `src/hooks/__tests__/useLauncherVisibility.test.tsx` — new cases for `isDailyRoot`.
- `src/App.tsx` — replace the Phase 1 redirect stub for `kind: 'daily'` with real routing; delegate to `GameController` hash bootstrap for `#daily/<date>/<modeId>`.
- `e2e/launcher.spec.ts` — delete obsolete test + block; add `Launcher — daily state` block.
- `e2e/game-country-pinning.spec.ts`, `e2e/game-city-guessing.spec.ts` — migrate click target to `launcher-card-{id}-free-link`.
- `docs/roadmap.md` — move Phase 3 items out of the "v1.1+" list into a Phase 3 section (or leave — clarify on pickup).

### Deleted outright (not preserved as shims)

- `LauncherModeCard`'s existing 2xl `tabular-nums` `bestScore` rendering block (replaced by compact free-mode best footer).
- `LauncherModeCard`'s `hasPlayed ? numeric : em-dash` branch (replaced by first-class daily states).
- `Launcher.tsx`'s `TAGLINES` constant (`"… 10 rounds."` copy is wrong for daily; new copy carried in the rewritten card).
- `LauncherModeCard`'s `onStart` single-handler prop (replaced by `onStartDaily` + `onStartFree`).
- The `launcher-best-{modeId}` test id and all e2e references to it.
- `e2e/launcher.spec.ts`'s `'clicking a mode card dismisses and starts that game'` test and the entire `Launcher — personal bests` describe block.

Per the user feedback memory ([`feedback_remove_obsolete.md`](../../../../../../C:/Users/renade/.claude/projects/E--polworldmap/memory/feedback_remove_obsolete.md) — remove obsolete code and tests in the same change), these deletions happen in the same commits as their replacements, not a follow-up cleanup.

---

## Task 1: Daily types module

**Files:**
- Create: `src/game/daily/types.ts`

Pure types only — no runtime code, no test needed.

- [ ] **Step 1: Write the types file**

```ts
import type { ModeId } from '../shared/types'

export interface DailyPuzzleRef {
  country: { cca3: string }
  city: { id: string }
}

export interface DailyIndex {
  generatedAt: string
  window: { start: string; end: string }
  days: Record<string, DailyPuzzleRef>
}

export interface AttemptRecord {
  pointsEarned: number
  guessCca3?: string
  guessLngLat?: [number, number]
  distanceKm: number | null
}

export interface DailyDayResult {
  score: number
  attempts: AttemptRecord[]
  completedAt: number
}

export interface StreakState {
  current: number
  longest: number
  lastActiveDate: string | null
  lastMilestoneShown: 0 | 3 | 7 | 14 | 30 | 100
}

export interface DailyHistoryV1 {
  version: 1
  streak: StreakState
  days: Record<string, Partial<Record<ModeId, DailyDayResult | null>>>
}

export const MILESTONES = [3, 7, 14, 30, 100] as const
export type Milestone = (typeof MILESTONES)[number]

export const STORAGE_KEY = 'funworldmap-daily-history'
```

- [ ] **Step 2: Typecheck passes**

Run:
```
npx tsc -b
```
Expected: exit 0 (no file-level errors introduced).

- [ ] **Step 3: Commit**

```
git add src/game/daily/types.ts
git commit -m "feat(daily): types for daily index, history, attempts, streak"
```

---

## Task 2: Storage pure functions (TDD)

**Files:**
- Create: `src/game/daily/__tests__/storage.test.ts`
- Create: `src/game/daily/storage.ts`

All functions operate on `DailyHistoryV1` values; tests never touch the real `localStorage`.

- [ ] **Step 1: Write failing tests**

Create `src/game/daily/__tests__/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readHistory, writeHistory, pruneOlderThan, mergeDay, updateStreak, emptyHistory } from '../storage'
import { STORAGE_KEY } from '../types'
import type { DailyHistoryV1 } from '../types'

function makeDay(score: number): { score: number; attempts: never[]; completedAt: number } {
  return { score, attempts: [], completedAt: Date.now() }
}

describe('emptyHistory', () => {
  it('has version 1, zero streak, no days', () => {
    const h = emptyHistory()
    expect(h.version).toBe(1)
    expect(h.streak).toEqual({
      current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0,
    })
    expect(h.days).toEqual({})
  })
})

describe('readHistory / writeHistory', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('returns an empty history when the key is absent', () => {
    expect(readHistory()).toEqual(emptyHistory())
  })

  it('round-trips a history through localStorage', () => {
    const h = emptyHistory()
    h.days['2026-04-21'] = { 'country-pinning': makeDay(87) }
    writeHistory(h)
    expect(readHistory()).toEqual(h)
  })

  it('returns an empty history when the stored value fails to parse', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(readHistory()).toEqual(emptyHistory())
  })

  it('returns an empty history on unknown version (future-proof migration)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, days: {}, streak: {} }))
    expect(readHistory()).toEqual(emptyHistory())
  })
})

describe('mergeDay', () => {
  it('creates a day entry when none exists', () => {
    const h = emptyHistory()
    const out = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    expect(out.days['2026-04-21']?.['country-pinning']?.score).toBe(87)
  })

  it('preserves the other mode when merging one mode', () => {
    let h = emptyHistory()
    h = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    h = mergeDay(h, '2026-04-21', 'city-guessing', makeDay(72))
    expect(h.days['2026-04-21']?.['country-pinning']?.score).toBe(87)
    expect(h.days['2026-04-21']?.['city-guessing']?.score).toBe(72)
  })

  it('overwrites a same-day same-mode entry (last write wins)', () => {
    let h = emptyHistory()
    h = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    h = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(99))
    expect(h.days['2026-04-21']?.['country-pinning']?.score).toBe(99)
  })

  it('does not mutate the input history', () => {
    const h = emptyHistory()
    const before = JSON.stringify(h)
    mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    expect(JSON.stringify(h)).toBe(before)
  })
})

describe('updateStreak', () => {
  it('first-ever play sets current = 1, longest = 1', () => {
    const h = emptyHistory()
    const out = updateStreak(h, '2026-04-21')
    expect(out.streak.current).toBe(1)
    expect(out.streak.longest).toBe(1)
    expect(out.streak.lastActiveDate).toBe('2026-04-21')
  })

  it('yesterday → today increments current', () => {
    let h = emptyHistory()
    h = updateStreak(h, '2026-04-20')
    h = updateStreak(h, '2026-04-21')
    expect(h.streak.current).toBe(2)
    expect(h.streak.longest).toBe(2)
  })

  it('same-day no-op (second call returns unchanged state)', () => {
    let h = emptyHistory()
    h = updateStreak(h, '2026-04-21')
    const after = updateStreak(h, '2026-04-21')
    expect(after.streak.current).toBe(1)
    expect(after.streak.longest).toBe(1)
  })

  it('gap of 2 or more resets current to 1', () => {
    let h = emptyHistory()
    h = updateStreak(h, '2026-04-20')
    h = updateStreak(h, '2026-04-21')
    h = updateStreak(h, '2026-04-24')
    expect(h.streak.current).toBe(1)
    expect(h.streak.longest).toBe(2)
  })

  it('preserves longest across a reset', () => {
    let h = emptyHistory()
    for (const d of ['2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21']) {
      h = updateStreak(h, d)
    }
    h = updateStreak(h, '2026-04-25')
    expect(h.streak.current).toBe(1)
    expect(h.streak.longest).toBe(4)
  })
})

describe('pruneOlderThan', () => {
  it('drops day entries with keys before the cutoff', () => {
    let h: DailyHistoryV1 = emptyHistory()
    h.days['2026-01-01'] = { 'country-pinning': makeDay(50) }
    h.days['2026-04-20'] = { 'country-pinning': makeDay(80) }
    h = pruneOlderThan(h, 30, new Date('2026-04-21T12:00:00'))
    expect(h.days['2026-01-01']).toBeUndefined()
    expect(h.days['2026-04-20']).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify red**

Run:
```
npm run test:unit -- src/game/daily/__tests__/storage.test.ts
```
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement storage.ts**

Create `src/game/daily/storage.ts`:

```ts
import type { DailyHistoryV1, DailyDayResult, StreakState } from './types'
import { STORAGE_KEY } from './types'
import type { ModeId } from '../shared/types'
import { toLocalDateString } from './dates'

const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  lastActiveDate: null,
  lastMilestoneShown: 0,
}

export function emptyHistory(): DailyHistoryV1 {
  return { version: 1, streak: { ...EMPTY_STREAK }, days: {} }
}

export function readHistory(): DailyHistoryV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyHistory()
    const parsed = JSON.parse(raw) as Partial<DailyHistoryV1>
    if (parsed.version !== 1) return emptyHistory()
    return {
      version: 1,
      streak: { ...EMPTY_STREAK, ...(parsed.streak ?? {}) } as StreakState,
      days: parsed.days ?? {},
    }
  } catch {
    return emptyHistory()
  }
}

export function writeHistory(h: DailyHistoryV1): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h))
  } catch {
    /* private-mode / quota exceeded — best-effort */
  }
}

export function mergeDay(
  h: DailyHistoryV1,
  date: string,
  modeId: ModeId,
  result: DailyDayResult,
): DailyHistoryV1 {
  const prior = h.days[date] ?? {}
  return {
    ...h,
    days: {
      ...h.days,
      [date]: { ...prior, [modeId]: result },
    },
  }
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = Date.UTC(ay, am - 1, ad)
  const db = Date.UTC(by, bm - 1, bd)
  return Math.round((db - da) / 86_400_000)
}

export function updateStreak(h: DailyHistoryV1, date: string): DailyHistoryV1 {
  const last = h.streak.lastActiveDate
  if (last === date) return h
  let current: number
  if (last && daysBetween(last, date) === 1) {
    current = h.streak.current + 1
  } else {
    current = 1
  }
  const longest = Math.max(h.streak.longest, current)
  return {
    ...h,
    streak: { ...h.streak, current, longest, lastActiveDate: date },
  }
}

export function pruneOlderThan(
  h: DailyHistoryV1,
  days: number,
  now: Date = new Date(),
): DailyHistoryV1 {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = toLocalDateString(cutoff)
  const kept: DailyHistoryV1['days'] = {}
  for (const [date, entry] of Object.entries(h.days)) {
    if (date >= cutoffStr) kept[date] = entry
  }
  return { ...h, days: kept }
}
```

- [ ] **Step 4: Run to verify green**

Run:
```
npm run test:unit -- src/game/daily/__tests__/storage.test.ts
```
Expected: all 14 tests pass.

- [ ] **Step 5: Commit**

```
git add src/game/daily/storage.ts src/game/daily/__tests__/storage.test.ts
git commit -m "feat(daily): pure storage + streak state machine with localStorage round-trip"
```

---

## Task 3: `useDailyPuzzles` hook (TDD)

**Files:**
- Create: `src/game/daily/__tests__/useDailyPuzzles.test.tsx`
- Create: `src/game/daily/useDailyPuzzles.ts`

The hook is a session-scoped fetch — one `GET /daily/index.json` per app load, cached in React state.

- [ ] **Step 1: Write failing tests**

Create `src/game/daily/__tests__/useDailyPuzzles.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDailyPuzzles } from '../useDailyPuzzles'
import type { DailyIndex } from '../types'

const TODAY_INDEX: DailyIndex = {
  generatedAt: '2026-04-21T00:15:00Z',
  window: { start: '2026-04-17', end: '2026-04-21' },
  days: {
    '2026-04-21': { country: { cca3: 'PER' }, city: { id: 'PER-lima' } },
    '2026-04-20': { country: { cca3: 'NOR' }, city: { id: 'NOR-oslo' } },
  },
}

describe('useDailyPuzzles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('fetches /daily/index.json on mount and exposes ready status', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(TODAY_INDEX), { status: 200 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.index).toEqual(TODAY_INDEX)
  })

  it('exposes unavailable status when the fetch fails', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('', { status: 500 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.index).toBeNull()
  })

  it('exposes unavailable status when fetch rejects', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })

  it('byDate returns the entry when within window', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(TODAY_INDEX), { status: 200 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.byDate('2026-04-20')).toEqual({
      country: { cca3: 'NOR' }, city: { id: 'NOR-oslo' },
    })
  })

  it('byDate returns null when out of window', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(TODAY_INDEX), { status: 200 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.byDate('2025-01-01')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify red**

```
npm run test:unit -- src/game/daily/__tests__/useDailyPuzzles.test.tsx
```
Expected: FAIL — hook not exported.

- [ ] **Step 3: Implement the hook**

Create `src/game/daily/useDailyPuzzles.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { DailyIndex, DailyPuzzleRef } from './types'

export type DailyPuzzlesStatus = 'loading' | 'ready' | 'unavailable'

export interface UseDailyPuzzles {
  status: DailyPuzzlesStatus
  index: DailyIndex | null
  byDate(date: string): DailyPuzzleRef | null
}

export function useDailyPuzzles(): UseDailyPuzzles {
  const [status, setStatus] = useState<DailyPuzzlesStatus>('loading')
  const [index, setIndex] = useState<DailyIndex | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/daily/index.json', { cache: 'default' })
      .then((r) => {
        if (!r.ok) throw new Error(`http ${r.status}`)
        return r.json() as Promise<DailyIndex>
      })
      .then((json) => {
        if (cancelled) return
        setIndex(json)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('unavailable')
      })
    return () => { cancelled = true }
  }, [])

  const byDate = useCallback(
    (date: string): DailyPuzzleRef | null => {
      if (!index) return null
      if (date < index.window.start || date > index.window.end) return null
      return index.days[date] ?? null
    },
    [index],
  )

  return { status, index, byDate }
}
```

- [ ] **Step 4: Run to verify green**

```
npm run test:unit -- src/game/daily/__tests__/useDailyPuzzles.test.tsx
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/game/daily/useDailyPuzzles.ts src/game/daily/__tests__/useDailyPuzzles.test.tsx
git commit -m "feat(daily): useDailyPuzzles fetches + caches /daily/index.json"
```

---

## Task 3b: `DailyPuzzlesProvider` Context

**Files:**
- Create: `src/game/daily/DailyPuzzlesProvider.tsx`

The hook is session-scoped but needs to be consumed from two places (`Launcher` for card state, `GameController` for hash-bootstrap daily-round resolution). Hoisting once via Context avoids double-fetching and removes the need for a `window` global.

- [ ] **Step 1: Create the Provider + hook**

```tsx
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useDailyPuzzles, type UseDailyPuzzles } from './useDailyPuzzles'

// eslint-disable-next-line react-refresh/only-export-components
export const DailyPuzzlesContext = createContext<UseDailyPuzzles | null>(null)

export function DailyPuzzlesProvider({ children }: { children: ReactNode }) {
  const value = useDailyPuzzles()
  return <DailyPuzzlesContext.Provider value={value}>{children}</DailyPuzzlesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDailyPuzzlesContext(): UseDailyPuzzles {
  const ctx = useContext(DailyPuzzlesContext)
  if (!ctx) throw new Error('useDailyPuzzlesContext must be used within <DailyPuzzlesProvider>')
  return ctx
}
```

- [ ] **Step 2: Mount the Provider in `src/App.tsx`**

Wrap `<AppInner>` inside the existing `<GameSessionProvider>`:

```tsx
return (
  <MapProvider>
    <GameSessionProvider pools={pools}>
      <DailyPuzzlesProvider>
        <AppInner ... />
      </DailyPuzzlesProvider>
    </GameSessionProvider>
  </MapProvider>
)
```

Add the import:
```tsx
import { DailyPuzzlesProvider } from './game/daily/DailyPuzzlesProvider'
```

- [ ] **Step 3: Typecheck**

```
npx tsc -b
```
Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/game/daily/DailyPuzzlesProvider.tsx src/App.tsx
git commit -m "feat(daily): DailyPuzzlesProvider Context hoists hook for launcher + controller"
```

---

## Task 4: `useDailyHistory` hook (TDD)

**Files:**
- Create: `src/game/daily/__tests__/useDailyHistory.test.tsx`
- Create: `src/game/daily/useDailyHistory.ts`

Wraps `storage.ts` with React state + `record()` mutation that mergeDay + updateStreak + writeHistory in one call.

- [ ] **Step 1: Write failing tests**

Create `src/game/daily/__tests__/useDailyHistory.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { useDailyHistory } from '../useDailyHistory'

describe('useDailyHistory', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('starts empty when no prior storage', () => {
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.streak.current).toBe(0)
    expect(result.current.get('2026-04-21', 'country-pinning')).toBeNull()
  })

  it('record merges a day, updates streak, and persists', () => {
    const { result } = renderHook(() => useDailyHistory())
    act(() => {
      result.current.record('2026-04-21', 'country-pinning', {
        score: 87, attempts: [], completedAt: 1,
      })
    })
    expect(result.current.get('2026-04-21', 'country-pinning')?.score).toBe(87)
    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.lastActiveDate).toBe('2026-04-21')
    // persisted:
    const stored = JSON.parse(localStorage.getItem('funworldmap-daily-history') ?? '{}')
    expect(stored.days['2026-04-21']['country-pinning'].score).toBe(87)
  })

  it('same-day second mode does NOT bump streak', () => {
    const { result } = renderHook(() => useDailyHistory())
    act(() => {
      result.current.record('2026-04-21', 'country-pinning', { score: 80, attempts: [], completedAt: 1 })
    })
    act(() => {
      result.current.record('2026-04-21', 'city-guessing', { score: 70, attempts: [], completedAt: 2 })
    })
    expect(result.current.streak.current).toBe(1)
    expect(result.current.get('2026-04-21', 'city-guessing')?.score).toBe(70)
    expect(result.current.get('2026-04-21', 'country-pinning')?.score).toBe(80)
  })

  it('yesterday → today increments streak to 2', () => {
    const { result } = renderHook(() => useDailyHistory())
    act(() => {
      result.current.record('2026-04-20', 'country-pinning', { score: 80, attempts: [], completedAt: 1 })
    })
    act(() => {
      result.current.record('2026-04-21', 'country-pinning', { score: 87, attempts: [], completedAt: 2 })
    })
    expect(result.current.streak.current).toBe(2)
    expect(result.current.streak.longest).toBe(2)
  })

  it('gap resets streak to 1, longest preserved', () => {
    const { result } = renderHook(() => useDailyHistory())
    for (const d of ['2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21']) {
      act(() => {
        result.current.record(d, 'country-pinning', { score: 87, attempts: [], completedAt: 1 })
      })
    }
    act(() => {
      result.current.record('2026-04-25', 'country-pinning', { score: 87, attempts: [], completedAt: 2 })
    })
    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.longest).toBe(4)
  })
})
```

- [ ] **Step 2: Run to verify red**

```
npm run test:unit -- src/game/daily/__tests__/useDailyHistory.test.tsx
```
Expected: FAIL — hook not exported.

- [ ] **Step 3: Implement the hook**

Create `src/game/daily/useDailyHistory.ts`:

```ts
import { useCallback, useState } from 'react'
import type { ModeId } from '../shared/types'
import type { DailyHistoryV1, DailyDayResult, StreakState } from './types'
import { readHistory, writeHistory, mergeDay, updateStreak } from './storage'

export interface UseDailyHistory {
  history: DailyHistoryV1
  streak: StreakState
  get(date: string, modeId: ModeId): DailyDayResult | null
  record(date: string, modeId: ModeId, result: DailyDayResult): void
}

export function useDailyHistory(): UseDailyHistory {
  const [history, setHistory] = useState<DailyHistoryV1>(() => readHistory())

  const get = useCallback(
    (date: string, modeId: ModeId): DailyDayResult | null =>
      history.days[date]?.[modeId] ?? null,
    [history],
  )

  const record = useCallback(
    (date: string, modeId: ModeId, result: DailyDayResult) => {
      setHistory((prev) => {
        const merged = mergeDay(prev, date, modeId, result)
        const streaked = updateStreak(merged, date)
        writeHistory(streaked)
        return streaked
      })
    },
    [],
  )

  return { history, streak: history.streak, get, record }
}
```

- [ ] **Step 4: Run to verify green**

```
npm run test:unit -- src/game/daily/__tests__/useDailyHistory.test.tsx
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/game/daily/useDailyHistory.ts src/game/daily/__tests__/useDailyHistory.test.tsx
git commit -m "feat(daily): useDailyHistory wraps storage with record/get/streak"
```

---

## Task 5: Daily round builders (TDD)

**Files:**
- Create: `src/game/daily/__tests__/dailyRound.test.ts`
- Create: `src/game/daily/dailyRound.ts`

Pure functions that turn a `DailyPuzzleRef` + pool lookups into `RoundSpec`. These are called by the daily-start flow.

- [ ] **Step 1: Write failing tests**

Create `src/game/daily/__tests__/dailyRound.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCountryDailyRound, buildCityDailyRound } from '../dailyRound'
import type { CountryLike, CityLike } from '../../shared/types'

const FRA: CountryLike = {
  cca3: 'FRA',
  name: { common: 'France' },
  flag: 'flags/FR.svg',
  latlng: [46, 2],
  independent: true,
}

const PARIS: CityLike = {
  id: 'FRA-paris',
  name: 'Paris',
  countryCca3: 'FRA',
  countryName: 'France',
  countryFlag: 'flags/FR.svg',
  latlng: [48.857, 2.352],
  scalerank: 0,
}

describe('buildCountryDailyRound', () => {
  it('returns a country-pinning RoundSpec for the given cca3', () => {
    const r = buildCountryDailyRound('FRA', [FRA])
    expect(r).toEqual({
      kind: 'country-pinning',
      targetCca3: 'FRA',
      targetName: 'France',
      targetFlag: 'flags/FR.svg',
      targetCentroid: [2, 46],
    })
  })

  it('throws when cca3 is not in the pool', () => {
    expect(() => buildCountryDailyRound('XXX', [FRA])).toThrow(/not found/i)
  })
})

describe('buildCityDailyRound', () => {
  it('returns a city-guessing RoundSpec for the given id', () => {
    const r = buildCityDailyRound('FRA-paris', [PARIS])
    expect(r).toEqual({
      kind: 'city-guessing',
      targetId: 'FRA-paris',
      targetName: 'Paris',
      targetCountryName: 'France',
      targetCountryFlag: 'flags/FR.svg',
      targetCentroid: [2.352, 48.857],
    })
  })

  it('throws when id is not in the pool', () => {
    expect(() => buildCityDailyRound('nope', [PARIS])).toThrow(/not found/i)
  })
})
```

- [ ] **Step 2: Run to verify red**

```
npm run test:unit -- src/game/daily/__tests__/dailyRound.test.ts
```
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement builders**

Create `src/game/daily/dailyRound.ts`:

```ts
import type { CountryLike, CityLike, RoundSpec } from '../shared/types'
import { centroidFromLatLng } from '../shared/distance'

export function buildCountryDailyRound(cca3: string, pool: CountryLike[]): RoundSpec {
  const c = pool.find((x) => x.cca3 === cca3)
  if (!c) throw new Error(`country not found in pool: ${cca3}`)
  return {
    kind: 'country-pinning',
    targetCca3: c.cca3,
    targetName: c.name.common,
    targetFlag: c.flag,
    targetCentroid: centroidFromLatLng(c.latlng),
  }
}

export function buildCityDailyRound(id: string, pool: CityLike[]): RoundSpec {
  const c = pool.find((x) => x.id === id)
  if (!c) throw new Error(`city not found in pool: ${id}`)
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

- [ ] **Step 4: Run to verify green**

```
npm run test:unit -- src/game/daily/__tests__/dailyRound.test.ts
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```
git add src/game/daily/dailyRound.ts src/game/daily/__tests__/dailyRound.test.ts
git commit -m "feat(daily): pure daily-round builders for both modes"
```

---

## Task 6: Extend `GameSession` with attempts fields + reducer (TDD, atomic commit)

**Files:**
- Modify: `src/game/shared/types.ts`
- Modify: `src/game/shared/useGameSession.ts`
- Create or modify: `src/game/shared/__tests__/useGameSession.test.ts`

> **Atomic commit rule:** steps 1–5 all land in ONE commit. The intermediate `tsc` state after step 1 is broken by design — no commits until step 7 green-lights the combined change. Reviewer / subagent should NOT approve intermediate commits for this task.

Reducer changes in one atomic change:
- `start` accepts `attemptsPerRound` (default 1) — initializes `attemptsRemaining = attemptsPerRound`, `currentAttempts = []`.
- `attempt` — records one attempt to `currentAttempts`, decrements `attemptsRemaining`, keeps status `playing`. Used when attempts remain.
- `guess` — now carries BOTH the triggering `input` and the `outcome`. When `attemptsPerRound === 1`, behavior unchanged. When `attemptsPerRound > 1 && attemptsRemaining === 1` (final attempt), records to `currentAttempts` AND transitions to `round-ended` with best-of-attempts score. If dispatched with `attemptsRemaining > 1`, the reducer is a no-op (defensive guard).
- `revealEarly` — valid only when `currentAttempts.length > 0`. Transitions to `round-ended` using best-of-current. Zero-out `attemptsRemaining`.
- `advance` / `overrideRound` — reset `attemptsRemaining` to `attemptsPerRound`, clear `currentAttempts`.
- `endGame` — reset all attempts state.

### Step 1: Edit `src/game/shared/types.ts`

Add `AttemptRecord` below `GuessOutcome` and extend `GameSession`:

```ts
// ---- Attempt record (for multi-attempt rounds — daily) ----
export type AttemptRecord = {
  pointsEarned: number
  input: GuessInput
  reveal: CountryReveal | PointReveal
}

// ---- Session state ----
export type GameSession = {
  modeId: ModeId
  status: GameStatus
  lives: 0 | 1 | 2 | 3
  score: number
  streak: number
  bestStreak: number
  roundIndex: number
  maxRounds: number | null
  attemptsPerRound: number          // 1 for free modes; 3 for daily
  attemptsRemaining: number         // counts down within the current round
  currentAttempts: AttemptRecord[]  // attempts made during the current round
  currentRound: RoundSpec | null
  lastOutcome: GuessOutcome | null
  used: Set<string>
}
```

### Step 2: Write failing tests

Create or append to `src/game/shared/__tests__/useGameSession.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useGameSession } from '../useGameSession'
import type { CountryRoundSpec } from '../types'

const CPR: CountryRoundSpec = {
  kind: 'country-pinning',
  targetCca3: 'FRA',
  targetName: 'France',
  targetFlag: 'flags/FR.svg',
  targetCentroid: [2, 46],
}

describe('useGameSession — attempts per round', () => {
  it('start with attemptsPerRound=1 keeps existing free-mode behavior', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, null, 1) })
    expect(result.current.session.attemptsPerRound).toBe(1)
    expect(result.current.session.attemptsRemaining).toBe(1)
    expect(result.current.session.currentAttempts).toEqual([])
  })

  it('start with attemptsPerRound=3 initializes three attempts', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    expect(result.current.session.attemptsPerRound).toBe(3)
    expect(result.current.session.attemptsRemaining).toBe(3)
  })

  it('recordAttempt decrements remaining + records attempt, stays playing', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 40,
        input: { kind: 'country', cca3: 'ESP', name: 'Spain', centroid: [-3, 40] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'ESP', clickedName: 'Spain', distanceKm: 800 },
      })
    })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.attemptsRemaining).toBe(2)
    expect(result.current.session.currentAttempts).toHaveLength(1)
    expect(result.current.session.currentAttempts[0].pointsEarned).toBe(40)
  })

  it('submitGuess carries the input into the final attempt record (best-of-3)', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 30,
        input: { kind: 'country', cca3: 'ESP', name: 'Spain', centroid: [-3, 40] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'ESP', clickedName: 'Spain', distanceKm: 800 },
      })
    })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 70,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => {
      result.current.submitGuess(
        { kind: 'country', cca3: 'FRA', name: 'France', centroid: [2, 46] },
        {
          pointsEarned: 100,
          livesDelta: 0,
          endsGame: true,
          reveal: { kind: 'country', correct: true, targetCca3: 'FRA', clickedCca3: 'FRA', clickedName: 'France', distanceKm: 0 },
        },
      )
    })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.score).toBe(100)  // best-of-3
    expect(result.current.session.currentAttempts).toHaveLength(3)
    // Final attempt carries the real input (not a reconstructed fake):
    const final = result.current.session.currentAttempts[2]
    expect(final.input.kind).toBe('country')
    if (final.input.kind === 'country') {
      expect(final.input.cca3).toBe('FRA')
      expect(final.input.centroid).toEqual([2, 46])
    }
  })

  it('submitGuess with attemptsRemaining > 1 is a no-op (defensive guard)', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    // attemptsRemaining is 3; dispatching submitGuess directly should NOT end the round.
    act(() => {
      result.current.submitGuess(
        { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        {
          pointsEarned: 60,
          livesDelta: 0,
          endsGame: true,
          reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
        },
      )
    })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.attemptsRemaining).toBe(3)
    expect(result.current.session.currentAttempts).toEqual([])
  })

  it('revealEarly ends the round using best-of-current-attempts', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 60,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => { result.current.revealEarly() })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.score).toBe(60)
    expect(result.current.session.attemptsRemaining).toBe(0)
  })

  it('revealEarly is a no-op when no attempts recorded', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => { result.current.revealEarly() })
    expect(result.current.session.status).toBe('playing')
  })

  it('advance resets attemptsRemaining to attemptsPerRound', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, null, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 50,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => {
      result.current.submitGuess(
        { kind: 'country', cca3: 'FRA', name: 'France', centroid: [2, 46] },
        {
          pointsEarned: 100,
          livesDelta: 0,
          endsGame: false,
          reveal: { kind: 'country', correct: true, targetCca3: 'FRA', clickedCca3: 'FRA', clickedName: 'France', distanceKm: 0 },
        },
      )
    })
    const next: CountryRoundSpec = { ...CPR, targetCca3: 'DEU', targetName: 'Germany', targetFlag: 'flags/DE.svg' }
    act(() => { result.current.advance(next) })
    expect(result.current.session.attemptsRemaining).toBe(3)
    expect(result.current.session.currentAttempts).toEqual([])
  })
})
```

### Step 3: Run tests — expect red

```
npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts
```
Expected: FAIL — `recordAttempt`/`revealEarly` not exported, `submitGuess` still takes a single arg, reducer hasn't been updated.

### Step 4: Implement the reducer

Replace the full contents of `src/game/shared/useGameSession.ts`:

```ts
import { useCallback, useReducer } from 'react'
import type { AttemptRecord, GameSession, GuessInput, GuessOutcome, ModeId, RoundSpec } from './types'

type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null; attemptsPerRound: number }
  | { type: 'attempt'; attempt: AttemptRecord }
  | { type: 'guess'; input: GuessInput; outcome: GuessOutcome }
  | { type: 'revealEarly' }
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

function bestPoints(attempts: AttemptRecord[]): number {
  return attempts.reduce((m, a) => Math.max(m, a.pointsEarned), 0)
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
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
      if (state.status !== 'playing') return state
      if (state.attemptsRemaining <= 0) return state
      return {
        ...state,
        attemptsRemaining: state.attemptsRemaining - 1,
        currentAttempts: [...state.currentAttempts, action.attempt],
      }
    }
    case 'guess': {
      // Defensive: callers bypassing submitGuessInput with attempts still remaining
      // would end the round prematurely. Guard against that.
      if (state.attemptsPerRound > 1 && state.attemptsRemaining > 1) return state

      const finalAttempt: AttemptRecord = {
        pointsEarned: action.outcome.pointsEarned,
        input: action.input,
        reveal: action.outcome.reveal,
      }
      const attemptsWithFinal =
        state.attemptsPerRound > 1
          ? [...state.currentAttempts, finalAttempt]
          : state.currentAttempts
      const points = state.attemptsPerRound > 1 ? bestPoints(attemptsWithFinal) : action.outcome.pointsEarned
      const nextLives = Math.max(0, state.lives + action.outcome.livesDelta) as GameSession['lives']
      const nextStreak = action.outcome.pointsEarned >= 100 ? state.streak + 1 : 0
      return {
        ...state,
        status: action.outcome.endsGame ? 'game-over' : 'round-ended',
        lives: nextLives,
        score: state.score + points,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        attemptsRemaining: 0,
        currentAttempts: attemptsWithFinal,
        lastOutcome: { ...action.outcome, pointsEarned: points },
      }
    }
    case 'revealEarly': {
      if (state.status !== 'playing') return state
      if (state.currentAttempts.length === 0) return state
      const points = bestPoints(state.currentAttempts)
      return {
        ...state,
        status: 'game-over',
        score: state.score + points,
        attemptsRemaining: 0,
        lastOutcome: {
          pointsEarned: points,
          livesDelta: 0,
          endsGame: true,
          reveal: state.currentAttempts[state.currentAttempts.length - 1].reveal,
        },
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
  recordAttempt: (attempt: AttemptRecord) => void
  submitGuess: (input: GuessInput, outcome: GuessOutcome) => void
  revealEarly: () => void
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
  const recordAttempt = useCallback((attempt: AttemptRecord) => dispatch({ type: 'attempt', attempt }), [])
  const submitGuess = useCallback(
    (input: GuessInput, outcome: GuessOutcome) => dispatch({ type: 'guess', input, outcome }),
    [],
  )
  const revealEarly = useCallback(() => dispatch({ type: 'revealEarly' }), [])
  const advance = useCallback((nextRound: RoundSpec) => dispatch({ type: 'advance', nextRound }), [])
  const overrideRound = useCallback((round: RoundSpec) => dispatch({ type: 'overrideRound', round }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, recordAttempt, submitGuess, revealEarly, advance, overrideRound, endGame }
}
```

Note: `submitGuess` now takes `(input, outcome)` — callers updated in Task 7.

### Step 5: Run tests — expect green

```
npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts
```
Expected: all 8 new tests pass. If other existing shared-game tests reference the old `submitGuess(outcome)` signature, they need updates too — find them and fix in this same task:

```
grep -rn "submitGuess(" src/game/shared/__tests__/ src/game/__tests__/ 2>/dev/null
```

Patch any call sites to the new 2-arg signature.

### Step 6: Typecheck — expect failures in `GameSessionProvider.tsx` and `GameController.tsx` (they call the old shapes)

```
npx tsc -b
```
Expected: fails. These are fixed by Task 7 and onward. Do NOT commit yet — the codebase is in a broken intermediate state.

### Step 7: Proceed directly to Task 7 without committing

Task 6 + Task 7 land as a single atomic commit at the end of Task 7. This prevents a broken-CI intermediate state on the branch. The commit message combines both.

---

## Task 7: Extend `GameSessionProvider` API — closes Task 6 atomically

**Files:**
- Modify: `src/game/shared/GameSessionProvider.tsx`

Widens the API to expose `recordAttempt` + `revealEarly`. Changes `submitGuessInput` to branch by `attemptsRemaining` and — critically — pass the `input` through to `submitGuess` so the reducer can record it on the final attempt (no synthetic reconstruction). The final commit of this task bundles Task 6 + Task 7 so tsc never sees a broken intermediate.

- [ ] **Step 1: Update the provider**

Edit `src/game/shared/GameSessionProvider.tsx`. Add `AttemptRecord` + `GuessInput` to the type import from `./types` if not already present. Replace the exported `GameSessionApi` type:

```ts
export type GameSessionApi = {
  session: GameSession
  mode: GameMode | null
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number) => void
  submitGuess: (input: GuessInput, outcome: GuessOutcome) => void
  submitGuessInput: (input: GuessInput) => void
  recordAttempt: (attempt: AttemptRecord) => void
  revealEarly: () => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
}
```

Change the hook destructure to pick up `recordAttempt` and `revealEarly`:

```tsx
const { session, start, submitGuess, recordAttempt, revealEarly, advance, overrideRound, endGame } = useGameSession()
```

Replace `submitGuessInput` with the branched implementation:

```tsx
const submitGuessInput = useCallback(
  (input: GuessInput) => {
    if (!mode || session.status !== 'playing' || !session.currentRound) return
    const result = mode.onGuess(input, session.currentRound)

    // Multi-attempt intermediate: record and stay playing.
    if (session.attemptsPerRound > 1 && session.attemptsRemaining > 1) {
      recordAttempt({ pointsEarned: result.pointsEarned, input, reveal: result.reveal })
      return
    }

    // Single-attempt mode or final attempt: finalize with endsGame.
    const endsGame =
      session.maxRounds !== null
        ? session.roundIndex + 1 >= session.maxRounds
        : session.lives + result.livesDelta <= 0
    const outcome: GuessOutcome = { ...result, endsGame }
    submitGuess(input, outcome)
  },
  [mode, session.status, session.currentRound, session.maxRounds, session.roundIndex, session.lives, session.attemptsPerRound, session.attemptsRemaining, submitGuess, recordAttempt],
)
```

Update the `api` construction:

```tsx
const api = useMemo<GameSessionApi>(
  () => ({ session, mode, start, submitGuess, submitGuessInput, recordAttempt, revealEarly, advance, overrideRound, endGame }),
  [session, mode, start, submitGuess, submitGuessInput, recordAttempt, revealEarly, advance, overrideRound, endGame],
)
```

- [ ] **Step 2: Fix any remaining callers**

Grep and fix:

```
grep -rn "submitGuess(" src/ e2e/ 2>/dev/null
```

Each call must now match `submitGuess(input, outcome)`. The controller's `submitGuessInput` flow handles this via `submitGuess(input, outcome)` inside — direct callers are rare but grep to confirm.

- [ ] **Step 3: Typecheck + full unit run — expect green**

```
npx tsc -b && npm run test:unit
```
Expected: type check clean; all Task 6 + existing tests green.

- [ ] **Step 4: Commit (atomic Task 6 + Task 7)**

```
git add src/game/shared/types.ts src/game/shared/useGameSession.ts src/game/shared/__tests__/useGameSession.test.ts src/game/shared/GameSessionProvider.tsx
git commit -m "feat(game): GameSession gains attempts fields + best-of-N reducer + provider branching

GameSession grows three fields: attemptsPerRound, attemptsRemaining,
currentAttempts[]. Reducer gains 'attempt' + 'revealEarly' actions
and makes 'guess' accept (input, outcome) — no more synthetic input
reconstruction on the final attempt. 'guess' is also a no-op when
attemptsRemaining > 1 (defensive guard).

GameSessionProvider.submitGuessInput branches: intermediate attempts
dispatch recordAttempt; final attempt (or any single-attempt mode)
dispatches submitGuess.

Atomic because Task 6's type extension and Task 7's provider change
are co-dependent — splitting them leaves tsc broken mid-sequence."
```

---

## Task 8 — SKIP (folded into Task 7 above)

The earlier draft had separate Task 6 (types), Task 7 (reducer), Task 8 (provider). After applying the critical-review fixes they're now a single atomic commit on Task 7. Task 8 is intentionally empty; skip it and continue at Task 9.

Placeholder step so the task count stays aligned with earlier references:

- [ ] **Step 1: Nothing to do.** Verify the atomic commit from Task 7 includes all of: types.ts, useGameSession.ts, useGameSession.test.ts, GameSessionProvider.tsx.

---

## Task 8 — old content archive (IGNORE — duplicate of earlier tasks)

The block between this heading and the Task 9 heading below contains early-draft content that was superseded by the critical-review revisions. Execution should skip directly from the above Task 7 commit to Task 9.

<details>
<summary>Show archived draft content</summary>

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useGameSession } from '../useGameSession'
import type { CountryRoundSpec } from '../types'

const CPR: CountryRoundSpec = {
  kind: 'country-pinning',
  targetCca3: 'FRA',
  targetName: 'France',
  targetFlag: 'flags/FR.svg',
  targetCentroid: [2, 46],
}

describe('useGameSession — attempts per round', () => {
  it('start with attemptsPerRound=1 keeps existing free-mode behavior', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, null, 1) })
    expect(result.current.session.attemptsPerRound).toBe(1)
    expect(result.current.session.attemptsRemaining).toBe(1)
    expect(result.current.session.currentAttempts).toEqual([])
  })

  it('start with attemptsPerRound=3 initializes three attempts', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    expect(result.current.session.attemptsPerRound).toBe(3)
    expect(result.current.session.attemptsRemaining).toBe(3)
  })

  it('attempt action decrements remaining + records attempt, stays playing', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 40,
        input: { kind: 'country', cca3: 'ESP', name: 'Spain', centroid: [-3, 40] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'ESP', clickedName: 'Spain', distanceKm: 800 },
      })
    })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.attemptsRemaining).toBe(2)
    expect(result.current.session.currentAttempts).toHaveLength(1)
    expect(result.current.session.currentAttempts[0].pointsEarned).toBe(40)
  })

  it('guess action after last attempt transitions to round-ended with best-of-3', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 30,
        input: { kind: 'country', cca3: 'ESP', name: 'Spain', centroid: [-3, 40] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'ESP', clickedName: 'Spain', distanceKm: 800 },
      })
    })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 70,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => {
      result.current.submitGuess({
        pointsEarned: 100,
        livesDelta: 0,
        endsGame: true,
        reveal: { kind: 'country', correct: true, targetCca3: 'FRA', clickedCca3: 'FRA', clickedName: 'France', distanceKm: 0 },
      })
    })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.score).toBe(100)  // best-of-3
    expect(result.current.session.currentAttempts).toHaveLength(3)
  })

  it('revealEarly ends the round using best-of-current-attempts', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 60,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => { result.current.revealEarly() })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.score).toBe(60)
    expect(result.current.session.attemptsRemaining).toBe(0)
  })

  it('revealEarly is a no-op when no attempts recorded', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => { result.current.revealEarly() })
    expect(result.current.session.status).toBe('playing')
  })

  it('advance resets attemptsRemaining to attemptsPerRound', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, null, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 50,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => {
      result.current.submitGuess({
        pointsEarned: 100,
        livesDelta: 0,
        endsGame: false,
        reveal: { kind: 'country', correct: true, targetCca3: 'FRA', clickedCca3: 'FRA', clickedName: 'France', distanceKm: 0 },
      })
    })
    const next: CountryRoundSpec = { ...CPR, targetCca3: 'DEU', targetName: 'Germany', targetFlag: 'flags/DE.svg' }
    act(() => { result.current.advance(next) })
    expect(result.current.session.attemptsRemaining).toBe(3)
    expect(result.current.session.currentAttempts).toEqual([])
  })
})
```

- [ ] **Step 3: Run to verify red**

```
npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts
```
Expected: FAIL — `recordAttempt`, `revealEarly`, the 4th `start` arg don't exist.

- [ ] **Step 4: Update `useGameSession.ts`**

Replace the full file contents:

```ts
import { useCallback, useReducer } from 'react'
import type { AttemptRecord, GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null; attemptsPerRound: number }
  | { type: 'attempt'; attempt: AttemptRecord }
  | { type: 'guess'; outcome: GuessOutcome }
  | { type: 'revealEarly' }
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

function bestPoints(attempts: AttemptRecord[]): number {
  return attempts.reduce((m, a) => Math.max(m, a.pointsEarned), 0)
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
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
      if (state.status !== 'playing') return state
      if (state.attemptsRemaining <= 0) return state
      return {
        ...state,
        attemptsRemaining: state.attemptsRemaining - 1,
        currentAttempts: [...state.currentAttempts, action.attempt],
      }
    }
    case 'guess': {
      const nextLives = Math.max(0, state.lives + action.outcome.livesDelta) as GameSession['lives']
      // With multi-attempt rounds, score is best-of-attempts (including this final one).
      const attemptsWithFinal: AttemptRecord[] =
        state.attemptsPerRound > 1
          ? [...state.currentAttempts, { pointsEarned: action.outcome.pointsEarned, input: fakeInputForOutcome(action.outcome), reveal: action.outcome.reveal }]
          : state.currentAttempts
      const points = state.attemptsPerRound > 1 ? bestPoints(attemptsWithFinal) : action.outcome.pointsEarned
      const nextStreak = action.outcome.pointsEarned >= 100 ? state.streak + 1 : 0
      return {
        ...state,
        status: action.outcome.endsGame ? 'game-over' : 'round-ended',
        lives: nextLives,
        score: state.score + points,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        attemptsRemaining: 0,
        currentAttempts: attemptsWithFinal,
        lastOutcome: { ...action.outcome, pointsEarned: points },
      }
    }
    case 'revealEarly': {
      if (state.status !== 'playing') return state
      if (state.currentAttempts.length === 0) return state
      const points = bestPoints(state.currentAttempts)
      return {
        ...state,
        status: 'game-over',
        score: state.score + points,
        attemptsRemaining: 0,
        lastOutcome: {
          pointsEarned: points,
          livesDelta: 0,
          endsGame: true,
          reveal: state.currentAttempts[state.currentAttempts.length - 1].reveal,
        },
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

// The guess action needs a synthetic input for the final-attempt record.
// Controller callers already hold the real input; this helper exists only to
// satisfy the AttemptRecord shape without widening the outcome type.
function fakeInputForOutcome(outcome: GuessOutcome): AttemptRecord['input'] {
  if (outcome.reveal.kind === 'country') {
    return outcome.reveal.clickedCca3
      ? {
          kind: 'country',
          cca3: outcome.reveal.clickedCca3,
          name: outcome.reveal.clickedName ?? '',
          centroid: [0, 0],
        }
      : { kind: 'skip' }
  }
  return outcome.reveal.clickedPoint
    ? { kind: 'point', lngLat: outcome.reveal.clickedPoint }
    : { kind: 'skip' }
}

export function useGameSession(): {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number) => void
  recordAttempt: (attempt: AttemptRecord) => void
  submitGuess: (outcome: GuessOutcome) => void
  revealEarly: () => void
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
  const recordAttempt = useCallback((attempt: AttemptRecord) => dispatch({ type: 'attempt', attempt }), [])
  const submitGuess = useCallback((outcome: GuessOutcome) => dispatch({ type: 'guess', outcome }), [])
  const revealEarly = useCallback(() => dispatch({ type: 'revealEarly' }), [])
  const advance = useCallback((nextRound: RoundSpec) => dispatch({ type: 'advance', nextRound }), [])
  const overrideRound = useCallback((round: RoundSpec) => dispatch({ type: 'overrideRound', round }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, recordAttempt, submitGuess, revealEarly, advance, overrideRound, endGame }
}
```

- [ ] **Step 5: Run to verify green**

```
npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts
```
Expected: all 7 new tests pass. Other existing tests in the file (if any) should also stay green.

- [ ] **Step 6: Commit**

```
git add src/game/shared/useGameSession.ts src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): reducer extension for attempt/revealEarly + best-of-N scoring"
```

---

## Task 8: Extend `GameSessionProvider` API with attempt branching

**Files:**
- Modify: `src/game/shared/GameSessionProvider.tsx`

`submitGuessInput` branches based on `attemptsRemaining`:
- `attemptsRemaining > 1` → dispatch `recordAttempt` (stay in playing, decrement).
- `attemptsRemaining === 1` → dispatch `submitGuess` (transition to round-ended / game-over, best-of-attempts applied).
- `attemptsRemaining <= 0` → no-op.

Also widen `GameSessionApi` to expose `recordAttempt` (for test shims) and `revealEarly`.

- [ ] **Step 1: Update the provider**

Replace `submitGuessInput` and the `api` construction in `GameSessionProvider.tsx` with:

```tsx
export type GameSessionApi = {
  session: GameSession
  mode: GameMode | null
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number) => void
  submitGuess: (outcome: GuessOutcome) => void
  submitGuessInput: (input: GuessInput) => void
  recordAttempt: (attempt: AttemptRecord) => void
  revealEarly: () => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
}
```

And:

```tsx
const { session, start, submitGuess, recordAttempt, revealEarly, advance, overrideRound, endGame } = useGameSession()

// ... existing mode memo ...

const submitGuessInput = useCallback(
  (input: GuessInput) => {
    if (!mode || session.status !== 'playing' || !session.currentRound) return
    const result = mode.onGuess(input, session.currentRound)

    // Multi-attempt branch: record intermediate attempt, stay playing.
    if (session.attemptsPerRound > 1 && session.attemptsRemaining > 1) {
      recordAttempt({ pointsEarned: result.pointsEarned, input, reveal: result.reveal })
      return
    }

    // Final attempt (or single-attempt modes): finalize with endsGame.
    const endsGame =
      session.maxRounds !== null
        ? session.roundIndex + 1 >= session.maxRounds
        : session.lives + result.livesDelta <= 0
    const outcome: GuessOutcome = { ...result, endsGame }
    submitGuess(outcome)
  },
  [mode, session.status, session.currentRound, session.maxRounds, session.roundIndex, session.lives, session.attemptsPerRound, session.attemptsRemaining, submitGuess, recordAttempt],
)

const api = useMemo<GameSessionApi>(
  () => ({ session, mode, start, submitGuess, submitGuessInput, recordAttempt, revealEarly, advance, overrideRound, endGame }),
  [session, mode, start, submitGuess, submitGuessInput, recordAttempt, revealEarly, advance, overrideRound, endGame],
)
```

Also add `AttemptRecord` to the imports at the top.

- [ ] **Step 2: Typecheck + run existing e2e shim expectations**

```
npx tsc -b && npm run test:unit
```
Expected: 170+ tests pass (Phase 1 tests + the new reducer tests).

- [ ] **Step 3: (archive end)**

</details>

---

## Task 9: Intermediate-reveal geometry in `GameController` (between attempts)

**Files:**
- Modify: `src/game/GameController.tsx`

Between attempts, the HUD needs visible feedback without revealing the target:
- **Country mode:** paint the *guessed* country border in warm-accent color (not correct-green), clear after a brief (600 ms) pause. The target is NOT highlighted.
- **City mode:** render a muted grey marker at the guess point; do NOT draw a line to the target. Cleared after 600 ms.

After the brief intermediate reveal, the controller returns the player to playing state — they can immediately make the next attempt.

The existing `round-ended` branch already handles the final-attempt reveal with target marker + line. Keep that unchanged.

- [ ] **Step 1: Add an intermediate-reveal effect**

In `GameController.tsx`, add a new `useEffect` after the existing reveal-geometry one. Detect intermediate attempts via `session.currentAttempts.length > 0 && session.status === 'playing' && session.attemptsRemaining > 0`:

```tsx
// Intermediate reveal between attempts (daily only): brief guess-highlight, no target.
useEffect(() => {
  if (session.status !== 'playing') return
  if (session.attemptsPerRound <= 1) return
  if (session.currentAttempts.length === 0) return
  const last = session.currentAttempts[session.currentAttempts.length - 1]
  const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
  if (!map) return

  if (last.reveal.kind === 'country') {
    // Paint the guessed border warm-accent; do NOT reveal the target.
    try {
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], last.reveal.clickedCca3 ?? ''])
      map.setPaintProperty(LAYER.hoverBorder, 'line-color', '#f59e0b')
      map.setPaintProperty(LAYER.hoverBorder, 'line-width', 3)
    } catch { /* layer may not exist */ }
    const t = window.setTimeout(() => {
      try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
    }, 600)
    return () => { window.clearTimeout(t); try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ } }
  }

  // City mode: render a single grey marker at the guess point; no line, no target.
  try {
    ensureRevealSources(map)
    const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
    const point = last.reveal.clickedPoint
    if (point) {
      markerSrc.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: point }, properties: { intermediate: true } }],
      })
      // Override paint: grey for intermediate.
      try { map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', '#94a3b8') } catch { /* no-op */ }
    }
  } catch { /* style may still be resolving */ }
  const t = window.setTimeout(() => {
    try { clearRevealSources(map); map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', '#f59e0b') } catch { /* no-op */ }
  }, 600)
  return () => { window.clearTimeout(t) }
}, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])
```

- [ ] **Step 2: Suppress the auto-advance timer on intermediate 'playing' state**

The existing reveal-geometry effect only fires on `round-ended`. Verify it is unaffected (intermediate attempts leave status as `playing`). No additional suppression needed.

- [ ] **Step 3: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: all pass (the intermediate effect is untested in unit — it manipulates the map side effects and is verified via e2e in Task 16).

- [ ] **Step 4: Commit**

```
git add src/game/GameController.tsx
git commit -m "feat(game): intermediate guess-highlight between attempts (no target reveal)"
```

---

## Task 10: Wire daily-start hook-up in `GameController` + daily hash bootstrap

**Files:**
- Modify: `src/game/GameController.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useLauncherVisibility.ts`

Replace the Phase 1 daily-redirect stub with real routing. `#daily/<date>/<modeId>` bootstraps a daily session; `#daily/<date>` (no mode) is handled by launcher-anchoring (Task 11 rewires the launcher to read the date). The controller's existing hash bootstrap is extended to recognize the daily shape.

Also record the daily result on game-over via `useDailyHistory`.

- [ ] **Step 1: Update `useLauncherVisibility.ts`**

Replace the module contents:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

function isBareRoot(hash: string): boolean {
  return hash === '' || hash === '#'
}

function isDailyRoot(hash: string): boolean {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  return /^daily\/\d{4}-\d{2}-\d{2}$/.test(clean)
}

export interface LauncherVisibility {
  visible: boolean
  anchorDate: string | null
  dismiss: () => void
  show: () => void
}

export function useLauncherVisibility(): LauncherVisibility {
  const { session } = useGameSessionContext()
  const initialHash = typeof window !== 'undefined' ? window.location.hash : ''
  const [currentHash, setCurrentHash] = useState(initialHash)
  const [dismissed, setDismissed] = useState(false)
  const prevSessionStatusRef = useRef(session.status)

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const prev = prevSessionStatusRef.current
    if (prev !== 'idle' && session.status === 'idle') {
      setDismissed(false)
    }
    prevSessionStatusRef.current = session.status
  }, [session.status])

  const dismiss = useCallback(() => setDismissed(true), [])
  const show = useCallback(() => setDismissed(false), [])

  const visible =
    (isBareRoot(currentHash) || isDailyRoot(currentHash)) &&
    !dismissed &&
    session.status === 'idle'

  let anchorDate: string | null = null
  if (isDailyRoot(currentHash)) {
    const clean = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash
    anchorDate = clean.slice('daily/'.length)
  }

  return { visible, anchorDate, dismiss, show }
}
```

- [ ] **Step 2: Update `useLauncherVisibility.test.tsx`**

Append to the existing test file:

```tsx
it('isDailyRoot matches #daily/YYYY-MM-DD', () => {
  window.location.hash = '#daily/2026-04-21'
  const api = makeApi(makeSession({ status: 'idle' }))
  const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
  expect(result.current.visible).toBe(true)
  expect(result.current.anchorDate).toBe('2026-04-21')
})

it('isDailyRoot does NOT match #daily/YYYY-MM-DD/modeId', () => {
  window.location.hash = '#daily/2026-04-21/country-pinning'
  const api = makeApi(makeSession({ status: 'idle' }))
  const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
  expect(result.current.visible).toBe(false)
  expect(result.current.anchorDate).toBeNull()
})
```

- [ ] **Step 3: Update `src/App.tsx`**

Remove the Phase 1 redirect stub effect (the `useEffect` that fired `deep_link_opened` with `outcome: 'redirect'` and replaced the hash). The new behavior:

- `#daily/<date>/<modeId>` → fires `deep_link_opened` with `outcome: 'played'` then lets `GameController` start the session (Step 4).
- `#daily/<date>` → fires `deep_link_opened` with `outcome: 'played'` then lets the launcher anchor to that date (Step 5 in Task 11 wires the launcher side).

Replace the Phase-1 effect with:

```tsx
useEffect(() => {
  const fireIfDaily = () => {
    const state = parseHash(window.location.hash)
    if (state.kind !== 'daily') return
    const todayStr = toLocalDateString(new Date())
    let dateKind: 'today' | 'past' | 'future' | 'invalid' = 'invalid'
    if (state.date === todayStr) dateKind = 'today'
    else if (state.date < todayStr) dateKind = 'past'
    else if (state.date > todayStr) dateKind = 'future'
    track('deep_link_opened', { dateKind, outcome: 'played' })
  }
  fireIfDaily()
  window.addEventListener('hashchange', fireIfDaily)
  return () => window.removeEventListener('hashchange', fireIfDaily)
}, [])
```

Note: this deliberately does NOT redirect any longer. Redirect / invalid-date / rolled-off-date handling moves to Task 12.

- [ ] **Step 4: Extend `GameController.tsx` hash bootstrap for daily**

Locate the existing `check()` function inside the hash → session bootstrap `useEffect`. Add a daily branch:

```tsx
const check = () => {
  const state = parseHash(window.location.hash)

  // Daily routes (Phase 2 handles /#daily/<date>/<modeId> for TODAY only; /#daily/<date>
  // is launcher-anchored; past/future are Phase 3 reveal territory).
  if (state.kind === 'daily' && state.modeId && !state.reveal && statusRef.current === 'idle') {
    const id = state.modeId as ModeId
    if (id !== 'country-pinning' && id !== 'city-guessing') return

    // Gate: Phase 2 only starts today's daily. Past/future redirect to root;
    // Phase 3 will add /reveal routes for past dates.
    const todayStr = toLocalDateString(new Date())
    if (state.date !== todayStr) {
      history.replaceState(null, '', window.location.pathname)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      return
    }

    const hasPool = id === 'country-pinning' ? countries.length > 0 : cities.length > 0
    if (!hasPool) {
      pendingStartRef.current = id
      return
    }
    // Read the daily index from the shared Context (hoisted in App.tsx via DailyPuzzlesProvider).
    // `dailyPuzzles.byDate` is closed over from the enclosing hook scope.
    const puzzle = dailyPuzzles.byDate(state.date)
    if (!puzzle) return  // index still loading or date out-of-window; retried on next hashchange.
    const firstRound =
      id === 'country-pinning'
        ? buildCountryDailyRound(puzzle.country.cca3, countries)
        : buildCityDailyRound(puzzle.city.id, cities)
    start(id, firstRound, 1, 3)
    return
  }

  if (state.kind === 'game' && statusRef.current === 'idle') {
    // ... existing logic unchanged
  }

  if (state.kind !== 'game' && state.kind !== 'daily' && statusRef.current !== 'idle') {
    endGame()
  }
}
```

Imports to add at the top of `GameController.tsx`:
```tsx
import { buildCountryDailyRound, buildCityDailyRound } from './daily/dailyRound'
import { toLocalDateString } from './daily/dates'
import { useDailyPuzzlesContext } from './daily/DailyPuzzlesProvider'
```

Add the Context consumption near the top of the `GameController` function body:

```tsx
const dailyPuzzles = useDailyPuzzlesContext()
```

Include `dailyPuzzles.byDate` in the dependency array of the hash-bootstrap `useEffect`. Because the Context is stable per-session, re-renders are inexpensive; the extra dep is cheap.

- [ ] **Step 5: Wire `useDailyHistory.record()` on game-over for daily sessions**

Inside `GameController.tsx`'s status-change effect (the one that records personal bests), add a daily-specific branch.

Add a call to the hook at the top of the component:

```tsx
const { record: recordDailyResult } = useDailyHistory()
```

Inside the status-change useEffect, where `session.status === 'game-over' && !recordedRef.current`:

```tsx
if (session.status === 'game-over' && !recordedRef.current) {
  recordedRef.current = true
  // Personal-best recording (existing):
  record(session.score, session.bestStreak)

  // Daily-specific recording (new):
  const hash = parseHash(window.location.hash)
  if (hash.kind === 'daily' && hash.modeId) {
    const attempts: AttemptRecord[] = session.currentAttempts
    recordDailyResult(hash.date, session.modeId, {
      score: session.score,
      attempts: attempts.map((a) => ({
        pointsEarned: a.pointsEarned,
        guessCca3: a.input.kind === 'country' ? a.input.cca3 : undefined,
        guessLngLat: a.input.kind === 'point' ? a.input.lngLat : undefined,
        distanceKm:
          a.reveal.kind === 'country'
            ? a.reveal.distanceKm
            : a.reveal.distanceKm,
      })),
      completedAt: Date.now(),
    })
    track('daily_completed', {
      mode: session.modeId,
      bestScoreBucket: Math.min(4, Math.floor(session.score / 20)),
      attemptsUsed: attempts.length,
    })
  }
  dispatchAnnouncement(`Game over. Final score ${session.score}.`)
}
```

Imports to add to `GameController.tsx`:
```tsx
import { useDailyHistory } from './daily/useDailyHistory'
import { track } from '../lib/analytics'
import type { AttemptRecord } from './shared/types'
```

- [ ] **Step 6: Fire `daily_attempted` per attempt**

Inside the status-change effect, add an effect that fires on each intermediate attempt. Or fire from the branch in `GameSessionProvider.submitGuessInput`? Cleanest placement: fire from `GameController` based on `session.currentAttempts` length diff.

Add a ref + effect to `GameController.tsx`:

```tsx
const lastAttemptCountRef = useRef(0)
useEffect(() => {
  if (session.status !== 'playing' && session.status !== 'round-ended' && session.status !== 'game-over') {
    lastAttemptCountRef.current = 0
    return
  }
  const prev = lastAttemptCountRef.current
  const cur = session.currentAttempts.length
  if (cur > prev) {
    const a = session.currentAttempts[cur - 1]
    if (session.attemptsPerRound > 1) {
      track('daily_attempted', {
        mode: session.modeId,
        attemptIndex: prev,
        scoreBucket: Math.min(4, Math.floor(a.pointsEarned / 20)),
      })
    }
  }
  lastAttemptCountRef.current = cur
}, [session.status, session.currentAttempts, session.attemptsPerRound, session.modeId])
```

- [ ] **Step 7: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: all pass.

- [ ] **Step 8: Commit**

```
git add src/hooks/useLauncherVisibility.ts src/hooks/__tests__/useLauncherVisibility.test.tsx src/App.tsx src/game/GameController.tsx
git commit -m "feat(daily): hash bootstrap + record-on-game-over + daily_attempted/completed events"
```

---

## Task 11: `LauncherModeCard` three-state rewrite (TDD via e2e pattern)

**Files:**
- Modify: `src/components/LauncherModeCard.tsx` (majority rewrite — deletes obsolete render)

Three states — `unplayed` / `played` / `unavailable`. Dual CTAs. New test ids. Deletes obsolete render paths in the same commit.

- [ ] **Step 1: Replace the file contents**

```tsx
import type { ModeId, PersonalBest } from '../game/shared/types'

export type LauncherCardState = 'unplayed' | 'played' | 'unavailable'

const ICONS: Record<ModeId, React.ReactNode> = {
  'country-pinning': (
    <svg className="w-8 h-8 text-teal dark:text-teal-light" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  'city-guessing': (
    <svg className="w-8 h-8 text-teal dark:text-teal-light" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V10l4-2 4 2 4-3 4 2v12H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6M12 21v-6M16 21v-6" />
    </svg>
  ),
}

const TITLE: Record<ModeId, string> = {
  'country-pinning': 'Country Pinning',
  'city-guessing': 'City Guessing',
}

const HEADER_LABEL: Record<ModeId, string> = {
  'country-pinning': 'TODAY · COUNTRY',
  'city-guessing': 'TODAY · CITY',
}

interface PlayedResult {
  countryName?: string
  score: number
}

interface Props {
  modeId: ModeId
  state: LauncherCardState
  played?: PlayedResult
  freeBest: PersonalBest
  onStartDaily: () => void
  onStartFree: () => void
}

export function LauncherModeCard({ modeId, state, played, freeBest, onStartDaily, onStartFree }: Props) {
  const testIdBase = `launcher-card-${modeId}`
  return (
    <div
      data-testid={testIdBase}
      data-state={state}
      className={`p-5 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 border shadow-lg transition-all duration-150 ${
        state === 'played'
          ? 'border-emerald-400/60 dark:border-emerald-500/40'
          : 'border-sand-300/50 dark:border-dark-200/30'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        {ICONS[modeId]}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-teal dark:text-teal-light">
            {HEADER_LABEL[modeId]}
          </div>
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
        </div>
      </div>

      {state === 'unplayed' && (
        <button
          type="button"
          onClick={onStartDaily}
          data-testid={`${testIdBase}-daily-cta`}
          className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Play · 3 attempts
        </button>
      )}

      {state === 'played' && (
        <div className="text-sand-900 dark:text-dark-50 text-sm" data-testid={`${testIdBase}-played-result`}>
          ✓ {played?.countryName ?? 'Played'} · <span className="tabular-nums font-semibold">{played?.score ?? 0}</span>/100
        </div>
      )}

      {state === 'unavailable' && (
        <div className="text-sand-600 dark:text-dark-100 text-sm mb-3" data-testid={`${testIdBase}-unavailable`}>
          Today's daily is syncing.
        </div>
      )}

      <button
        type="button"
        onClick={onStartFree}
        data-testid={`${testIdBase}-free-link`}
        className="mt-3 text-[13px] text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-1"
      >
        Play free mode →
      </button>

      <div className="mt-4 pt-3 border-t border-sand-200/70 dark:border-dark-200/30 text-[11px] text-sand-600 dark:text-dark-100">
        <span className="uppercase tracking-wider text-teal dark:text-teal-light font-medium">Best (free)</span>{' '}
        <span data-testid={`${testIdBase}-free-best`} className="tabular-nums">
          {freeBest.gamesPlayed > 0 ? `${freeBest.bestScore} / 1000` : '— / 1000'}
        </span>
      </div>
    </div>
  )
}
```

Removed: old `<button>` root, `best.bestScore` 2xl render, `hasPlayed` em-dash branch, `launcher-best-{modeId}` testid, `onStart` single handler. All replaced as described in §File structure.

- [ ] **Step 2: Typecheck**

```
npx tsc -b
```
Expected: fails — `Launcher.tsx` still passes the old prop shape. Task 12 fixes this.

- [ ] **Step 3: Commit**

```
git add src/components/LauncherModeCard.tsx
git commit -m "refactor(launcher): mode card rewrite — three states + dual CTAs"
```

---

## Task 12: `Launcher.tsx` consumes daily hooks

**Files:**
- Modify: `src/components/Launcher.tsx`

Reads `useDailyPuzzles` and `useDailyHistory`. Derives per-card state for the anchored date (today by default, or `launcherVisibility.anchorDate` when set). Exposes a window global so `GameController`'s hash bootstrap can read the index synchronously (per Task 10 §Design note). Also wires `daily_opened` and `daily_started` events.

- [ ] **Step 1: Replace the module**

```tsx
import { useCallback, useEffect, useRef } from 'react'
import { listModes } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { track } from '../lib/analytics'
import { usePersonalBests } from '../game/shared/usePersonalBests'
import { useDailyPuzzlesContext } from '../game/daily/DailyPuzzlesProvider'
import { useDailyHistory } from '../game/daily/useDailyHistory'
import { toLocalDateString } from '../game/daily/dates'
import { LauncherModeCard, type LauncherCardState } from './LauncherModeCard'

interface Props {
  onDismiss: () => void
  anchorDate: string | null
}

function focusSearchInput(): void {
  const el = document.getElementById('search-input') as HTMLInputElement | null
  el?.focus()
}

export function Launcher({ onDismiss, anchorDate }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const modes = listModes()
  const lastMode = readLastMode()
  const { best: cpBest } = usePersonalBests('country-pinning')
  const { best: cgBest } = usePersonalBests('city-guessing')
  const { status: puzzlesStatus, byDate, index } = useDailyPuzzlesContext()
  const { get: getDay } = useDailyHistory()

  const today = toLocalDateString(new Date())
  const date = anchorDate ?? today

  function cardState(modeId: ModeId): LauncherCardState {
    if (puzzlesStatus === 'unavailable') return 'unavailable'
    if (puzzlesStatus === 'loading') return 'unavailable' // fall-back: show the user the free-mode CTA while loading
    const puzzle = byDate(date)
    if (!puzzle) return 'unavailable'
    const prior = getDay(date, modeId)
    return prior ? 'played' : 'unplayed'
  }

  const bestFor = (id: ModeId) => (id === 'country-pinning' ? cpBest : cgBest)
  const playedFor = (id: ModeId) => {
    const prior = getDay(date, id)
    return prior ? { score: prior.score } : undefined
  }

  // Fire daily_opened once per card render (per mode).
  const openedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (puzzlesStatus !== 'ready' || !index) return
    for (const m of modes) {
      const key = `${m.id}:${date}`
      if (openedRef.current.has(key)) continue
      if (!byDate(date)) continue
      openedRef.current.add(key)
      const dateAge = Math.max(0, Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86_400_000))
      track('daily_opened', { mode: m.id, dateAge })
    }
  }, [puzzlesStatus, index, byDate, date, today, modes])

  const dismissWithFocus = useCallback(() => {
    track('launcher_dismissed', { path: 'link' })
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const startDaily = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      track('daily_started', { mode: id })
      writeLastMode(id)
      onDismiss()
      window.location.hash = `daily/${date}/${id}`
    },
    [onDismiss, date],
  )

  const startFree = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      track('free_started', { mode: id })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
    },
    [onDismiss],
  )

  useEffect(() => {
    const selector = `[data-testid="launcher-card-${lastMode}-daily-cta"], [data-testid="launcher-card-${lastMode}-free-link"]`
    const target = rootRef.current?.querySelector<HTMLButtonElement>(selector)
    target?.focus()
  }, [lastMode])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('button[data-testid^="launcher-"]'),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose how to play"
      data-testid="launcher"
      className="fixed inset-0 z-[210] flex items-center justify-center p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 dark:bg-[rgba(11,15,26,0.7)] backdrop-blur-[4px]"
        style={{ animation: 'launcher-backdrop-in 220ms ease-out' }}
      />
      <div className="relative w-full max-w-2xl mx-auto">
        <header
          className="text-center mb-6"
          style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}
        >
          <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </div>
          <p className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2">
            {anchorDate ? `Daily · ${anchorDate}` : '194 countries. Explore or guess.'}
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {modes.map((m, i) => (
            <div
              key={m.id}
              style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}
            >
              <LauncherModeCard
                modeId={m.id}
                state={cardState(m.id)}
                played={playedFor(m.id)}
                freeBest={bestFor(m.id)}
                onStartDaily={() => startDaily(m.id)}
                onStartFree={() => startFree(m.id)}
              />
            </div>
          ))}
        </div>

        <div
          className="mt-6 text-center"
          style={{ animation: 'launcher-text-in 180ms ease-out 260ms both' }}
        >
          <button
            type="button"
            onClick={dismissWithFocus}
            data-testid="launcher-dismiss"
            className="text-[13px] text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-2 py-1"
          >
            Just explore the map
          </button>
        </div>
      </div>
    </div>
  )
}
```

Removed: `TAGLINES` constant, old `startMode` single-CTA handler, direct `writeHash({ kind: 'game', ..., playing: true })` as primary action.

- [ ] **Step 2: Thread `anchorDate` through `App.tsx`**

In `src/App.tsx`, update the destructure and the `<Launcher>` render:

```tsx
const { visible: launcherVisible, anchorDate, dismiss: dismissLauncher, show: showLauncher } = useLauncherVisibility()
```

And:

```tsx
{launcherVisible && <Launcher onDismiss={dismissLauncher} anchorDate={anchorDate} />}
```

- [ ] **Step 3: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: all pass.

- [ ] **Step 4: Commit**

```
git add src/components/Launcher.tsx src/App.tsx
git commit -m "feat(launcher): consume daily hooks, dispatch daily vs free start, fire daily_opened/started"
```

---

## Task 13: Migrate existing game-mode e2e specs to the free-mode link

**Files:**
- Modify: `e2e/game-country-pinning.spec.ts`
- Modify: `e2e/game-city-guessing.spec.ts`

These specs currently click `launcher-mode-{id}` (which no longer exists). Replace with `launcher-card-{id}-free-link` — the free-mode entry point in the new card shape.

- [ ] **Step 1: Search + replace across both files**

```
grep -rn "launcher-mode-" e2e/
```

Expected output references in `game-country-pinning.spec.ts` and `game-city-guessing.spec.ts`. Update each:

```diff
- await page.getByTestId('launcher-mode-country-pinning').click()
+ await page.getByTestId('launcher-card-country-pinning-free-link').click()
```

```diff
- await page.getByTestId('launcher-mode-city-guessing').click()
+ await page.getByTestId('launcher-card-city-guessing-free-link').click()
```

- [ ] **Step 2: Run the specs locally**

```
npm run build && npx playwright test --project=chromium-gpu game-country-pinning.spec.ts game-city-guessing.spec.ts
```
Expected: both pass.

- [ ] **Step 3: Commit**

```
git add e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts
git commit -m "test(e2e): migrate game-mode specs to launcher-card-*-free-link"
```

---

## Task 14: Rewrite the launcher e2e spec (delete obsolete blocks)

**Files:**
- Modify: `e2e/launcher.spec.ts`

Delete the `'clicking a mode card dismisses and starts that game'` test and the entire `Launcher — personal bests` describe block. Add a `Launcher — daily state` describe block.

- [ ] **Step 1: Delete the obsolete test + block**

Open `e2e/launcher.spec.ts` and remove:
- The test starting at `'clicking a mode card dismisses and starts that game'` (inside `Launcher — dismiss paths` block).
- The entire `test.describe('Launcher — personal bests', …)` block (two tests asserting `launcher-best-{modeId}` render).

- [ ] **Step 2: Add the new block**

Append before the `Launcher — accessibility` block:

```ts
test.describe('Launcher — daily state', () => {
  test('unplayed daily state renders the daily CTA', async ({ page }) => {
    // Stub the daily index so today has a puzzle.
    const today = new Date().toISOString().slice(0, 10)
    await page.route('**/daily/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          window: { start: today, end: today },
          days: { [today]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      })
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'unplayed')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible()
  })

  test('played daily state renders the result line', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await page.addInitScript(({ today }) => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
        days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
      }))
    }, { today })
    await page.route('**/daily/index.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          window: { start: today, end: today },
          days: { [today]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      })
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'played')
    await expect(page.getByTestId('launcher-card-country-pinning-played-result')).toContainText('87')
  })

  test('unavailable state when daily index fetch fails', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'unavailable')
    await expect(page.getByTestId('launcher-card-country-pinning-unavailable')).toBeVisible()
  })

  test('free-mode link starts endless free mode', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toContain('game/country-pinning')
  })
})
```

- [ ] **Step 3: Run the spec locally**

```
npm run build && npx playwright test --project=chromium launcher.spec.ts
```
Expected: launcher.spec.ts green.

- [ ] **Step 4: Commit**

```
git add e2e/launcher.spec.ts
git commit -m "test(e2e): launcher daily-state coverage; drop personal-bests block"
```

---

## Task 15: Daily-puzzle e2e coverage

**Files:**
- Create: `e2e/daily-puzzle.spec.ts`
- Modify: `playwright.config.ts` (add to chromium project's `testMatch`)

- [ ] **Step 1: Create the spec**

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(120_000)

const TODAY = new Date().toISOString().slice(0, 10)

async function withDailyStub(page: Page): Promise<void> {
  await page.route('**/daily/index.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        window: { start: TODAY, end: TODAY },
        days: {
          [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } },
        },
      }),
    })
  })
}

test.describe('Daily puzzle — country-pinning, 3 attempts', () => {
  test('clicking Play starts the daily and three guesses finalize with best-of-3', async ({ page }) => {
    await withDailyStub(page)
    await page.goto('/')
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-daily-cta').click()

    // The hash switches to daily/<TODAY>/country-pinning and the game HUD mounts.
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 })
      .toContain(`daily/${TODAY}/country-pinning`)

    // Submit three synthetic guesses via the test shim.
    await page.waitForFunction(() => Boolean((window as unknown as { __funworldmap_game?: unknown }).__funworldmap_game))
    await page.evaluate(() => {
      ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
        .__funworldmap_game.submitCountryGuess('DEU')
    })
    await page.evaluate(() => {
      ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
        .__funworldmap_game.submitCountryGuess('ESP')
    })
    await page.evaluate(() => {
      ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
        .__funworldmap_game.submitCountryGuess('FRA')
    })

    await expect(page.getByTestId('game-over-overlay')).toBeVisible({ timeout: 10_000 })
    // Score = best-of-3 = 100 for the exact FRA match.
    await expect(page.getByTestId('game-over-score')).toContainText('100')
  })

  test('deep-linking to #daily/<today>/country-pinning bypasses launcher and starts', async ({ page }) => {
    await withDailyStub(page)
    await page.goto(`/#daily/${TODAY}/country-pinning`)
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toContain(`daily/${TODAY}/country-pinning`)
  })

  test('daily history persists: playing + reloading shows played state', async ({ page }) => {
    await withDailyStub(page)
    await page.goto('/')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-daily-cta').click()
    await page.waitForFunction(() => Boolean((window as unknown as { __funworldmap_game?: unknown }).__funworldmap_game))
    await page.evaluate(() => {
      ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
        .__funworldmap_game.submitCountryGuess('FRA')
    })
    // Score 100 on attempt 1; remaining attempts auto-forfeit via the controller's game-over timer.
    await expect(page.getByTestId('game-over-overlay')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /back to map/i }).click()
    await page.reload()
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'played')
  })
})

test.describe('Daily puzzle — launcher-anchored deep link', () => {
  test('#daily/<today> opens launcher anchored to today', async ({ page }) => {
    await withDailyStub(page)
    await page.goto(`/#daily/${TODAY}`)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })
})
```

- [ ] **Step 2: Register with Playwright**

In `playwright.config.ts`, add `'daily-puzzle.spec.ts'` to the `chromium` project's `testMatch`:

```ts
testMatch: [
  'scaffold.spec.ts',
  'search.spec.ts',
  'theme-and-responsive.spec.ts',
  'accessibility.spec.ts',
  'panel-and-deeplink.spec.ts',
  'meta-and-static.spec.ts',
  'panel-focus.spec.ts',
  'satellite-default.spec.ts',
  'a11y-contrast.spec.ts',
  'launcher.spec.ts',
  'daily-puzzle.spec.ts',
],
```

Note: daily-puzzle.spec's first test submits synthetic guesses via `__funworldmap_game.submitCountryGuess`, which is exposed in `GameController` and does not require GPU rendering. Placing the spec in `chromium` (SwiftShader) is correct.

**Single-attempt caveat for the "persists" test:** the test submits one 100-point guess and the game transitions immediately to game-over via `submitGuess`'s `endsGame=true` path (since maxRounds=1 and this is attempt 3-of-3 after the first hit). Wait — attempts remain. The test as written would only record one attempt via `recordAttempt` (not `submitGuess`). To exercise the game-over path cleanly, the test should instead use a shim that calls `revealEarly()` after one attempt, or submit three guesses. The happy-path test (first test above) already does three submits; the persists test should follow the same pattern. Fix: replace the single-submit in the persists test with three submits (adjusting to reach game-over). Use `submitCountryGuess('FRA')` three times — best-of-3 is still 100, game ends naturally.

Update the persists test to submit three times:

```ts
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
      .__funworldmap_game.submitCountryGuess('FRA')
  })
}
```

- [ ] **Step 3: Run the spec locally**

```
npm run build && npx playwright test --project=chromium daily-puzzle.spec.ts
```
Expected: all 4 tests pass.

- [ ] **Step 4: Commit**

```
git add e2e/daily-puzzle.spec.ts playwright.config.ts
git commit -m "test(e2e): daily-puzzle spec — happy path + persistence + deep link"
```

---

## Task 16: Full validation pass + roadmap pruning

**Files:**
- Modify: `docs/roadmap.md` (move Phase 3 items out of the "v1.1+" section; leave v1.1+ list intact but clarify Phase 3 is still "in progress")

- [ ] **Step 1: Full local validation**

```
npx tsc -b && npm run lint && npm run test:unit && npm run build
```
Expected: all green. If `tsc -b` flags anything, fix inline.

- [ ] **Step 2: Run full e2e**

```
npx playwright test --project=chromium
npx playwright test --project=chromium-gpu
```
Expected: launcher / daily-puzzle / game-* all pass. Pre-existing flakes (search.spec.ts:25, keyboard-map-nav.spec.ts:26) may still flake — rerun with `--retries=2` as configured.

- [ ] **Step 3: Edit `docs/roadmap.md`**

The current Retention v1.1+ section lists items like "Streak-freeze / streak-save mechanics" etc. Phase 2 doesn't change these. Add a note at the top of the section that Phases 3–5 are in active development:

```markdown
## Retention program (v1.1+)

Source: [`2026-04-21-retention-program-v1-design.md`](superpowers/specs/2026-04-21-retention-program-v1-design.md).

> Phase 2 (daily play end-to-end) has landed. Streak display, calendar, share, and milestone celebrations remain for Phases 3–5.

- ... (existing items unchanged)
```

No date placeholder — the sentence is self-contained regardless of when the merge lands.

- [ ] **Step 4: Commit**

```
git add docs/roadmap.md
git commit -m "docs(roadmap): note Phase 2 landing; v1.1+ list unchanged"
```

---

## Completion checklist

Before opening the PR:

- [ ] All 170+ unit tests pass (`npm run test:unit`).
- [ ] Type check clean (`tsc -b`).
- [ ] Lint clean (`npm run lint`).
- [ ] Build clean (`npm run build`).
- [ ] `daily-puzzle.spec.ts` (new) passes.
- [ ] `launcher.spec.ts` passes with the new daily-state block + obsolete blocks removed.
- [ ] `game-country-pinning.spec.ts` and `game-city-guessing.spec.ts` pass after the free-link migration.
- [ ] Manual: at `/`, launcher shows three-state cards; clicking the daily CTA starts a 3-attempt session; after attempt 1, the guessed country/city is highlighted briefly with no target reveal; after attempt 3, full reveal + game-over.
- [ ] Manual: reload after completing today's country daily → launcher shows `played` state for country, `unplayed` for city.
- [ ] Manual: `/#daily/<today>/country-pinning` bypasses the launcher and starts the daily directly.
- [ ] Manual: `/#daily/<today>` opens the launcher (visible, bare-root-equivalent).
- [ ] Manual: offline / stubbed-failing `/daily/index.json` → cards go `unavailable`; free-link remains clickable.
- [ ] `docs/roadmap.md` updated with Phase 2 landing note.
- [ ] Zero dead code: no `launcher-best-{modeId}`, `TAGLINES`, or single-handler `onStart` references anywhere (grep-verified).

## What Phase 3 picks up

After this plan merges, the Phase 3 plan file (`2026-04-21-retention-program-v1-phase-3-streak-calendar.md`, authored at that time) will implement:

- Streak pill copy + render on the launcher (reads `useDailyHistory().streak`).
- `LauncherHistoryPanel` + `LauncherCalendarCell` — 5×7 grid, cell navigation, nested Escape.
- `#daily/<date>/reveal` + `#daily/<date>/<mode>/reveal` routes → reveal-only views.
- Streak-milestone overlay + `streak_reached_milestone` event.
- `history_opened`, `history_cell_clicked` events.
- Phase 3 e2e specs (`daily-streak.spec.ts`, `launcher-history.spec.ts`).

Phases 4 (share) and 5 (polish + launch) follow with their own plan files.
