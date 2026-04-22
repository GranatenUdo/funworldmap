# Retention Program v1 — Phase 3: Streak + Calendar + Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the streak state that Phase 2 already writes, add a calendar panel and milestone celebrations, and make past/played daily URLs resolve to a read-only reveal view.

**Architecture:** Four additive surfaces, all anchored on the existing `Launcher` and the already-committed `useDailyHistory`: (1) a streak pill between tagline and cards; (2) a milestone-celebration overlay that fires when `streak.current` crosses a threshold; (3) an inline calendar panel toggled by a "Past 30 days →" link, rendering a 5×7 grid keyed off `useDailyHistory`; (4) a `DailyRevealOverlay` mounted on `/#daily/<date>[/<mode>]/reveal` that renders the target + any stored attempts, independent of the game session.

**Tech Stack:** TypeScript, React 19, Vitest, Playwright, existing `src/game/daily/*` + `src/components/Launcher*` files from Phase 2.

---

## Scope

This plan implements **Phase 3** of [`2026-04-21-retention-program-v1-design.md`](../specs/2026-04-21-retention-program-v1-design.md). Depends on Phase 2 (`f50fa4e`, merged) for `useDailyHistory`, `useDailyPuzzlesContext`, `LauncherModeCard`, `hashState.ts` `daily` variant including the `reveal` flag, and the `streak_reached_milestone` / `history_opened` / `history_cell_clicked` entries already present in the analytics event schema (added in Phase 1).

### In scope

- **Streak pill** on the launcher — reads `useDailyHistory().streak.current`. Three copy states: ≥1-day, 0 on a broken streak (had prior entries), and hidden/empty first-ever.
- **Milestone overlay** — celebration modal for streak values 3/7/14/30/100. Fires once per threshold via `lastMilestoneShown` dedupe. Auto-dismiss after 2.5 s, click-dismissible, Escape-dismissible (Escape then falls through to the launcher's existing Escape chain).
- **Calendar panel** — inline-expanding 5×7 grid beneath the mode cards, toggled by a "Past 30 days →" link next to the streak pill. Cells: rolled-off (inert, `—`), in-window un-played (interactive, no dots), played one mode (one dot), played both modes (two dots), today (teal ring). Captions: `Current · Longest · Days played`. Keyboard: arrow navigation + Enter activation. Nested Escape closes the panel first, then cascades to the launcher.
- **"See reveal" CTA** on `LauncherModeCard` played state (spec line 254 — deferred in Phase 2). Navigates to `/#daily/<date>/<modeId>/reveal`.
- **DailyRevealOverlay** — full-screen reveal for `/#daily/<date>/reveal` and `/#daily/<date>/<modeId>/reveal`. Text-only (no map). Shows target country/city name + flag + any stored attempts with colored dots and scores. "Back to map" closes. Works for in-window dates regardless of whether the user has a stored result.
- **GameController daily-hash gating update** — when `#daily/<today>/<modeId>` lands on an already-played daily, redirect to the matching `.../reveal` instead of restarting the session. Past/future dates continue to redirect (Phase 2 behavior). Spec line 373.
- **Events:** `streak_reached_milestone` (on milestone overlay mount), `history_opened` (on panel toggle-open), `history_cell_clicked` (on cell activation).
- **CSS keyframes:** `launcher-streak-in`, `launcher-history-in`, `launcher-milestone-in`.

### Out of scope (Phase 4/5)

- Share block + `navigator.share` (Phase 4).
- Canvas PNG share image (v1.1).
- Retroactive free-play of past dailies (v1.1 — calendar un-played cells are reveal-only).
- Polish pass: axe audit, reduced-motion final pass, doc updates beyond the roadmap tick (Phase 5).

### Implementation-level decisions (pinned before execution)

1. **Milestone detection is derived, not persisted.** `useDailyHistory` exposes a derived `pendingMilestone: Milestone | null` computed from `streak.current` and `streak.lastMilestoneShown`. The milestone overlay reads `pendingMilestone`; on dismiss it calls `markMilestoneShown()` which updates storage. `updateStreak` stays pure — it does not touch `lastMilestoneShown`.
2. **Calendar grid is pure.** A new `calendarGrid(today, retentionDays)` function in `src/game/daily/calendarGrid.ts` returns an array of 35 cell descriptors (7 cols × 5 rows, Monday-aligned, ending on the current week's Sunday). Cells before `today - retentionDays + 1` are marked `rolled-off`. The component renders from this array without date math of its own.
3. **Monday-aligned rows.** ISO week starts Monday. Col 0 = Monday. Consistent with European convention and the project's existing date-format assumptions.
4. **`DailyRevealOverlay` is text-only.** No map manipulation — MapLibre state is tied to `GameController`'s session, and decoupling the reveal from the session keeps this PR scoped. Target info renders as a card with name/flag/centroid-coords. Attempts render as a dot strip with scores. A future PR can add map-based reveal if desired.
5. **"See reveal" on the played card uses deep-link navigation, not a modal-from-launcher.** Clicking it sets `window.location.hash = daily/<date>/<mode>/reveal`, which triggers the standard hashchange flow: `useLauncherVisibility` sees a non-bare-root/non-isDailyRoot hash → hides launcher; `App.tsx` mounts `DailyRevealOverlay` for the reveal hash. Same UX as typing the URL directly.
6. **Calendar cell count is fixed at 35 = 5 weeks × 7 days.** When the retention window is 30 days (default), the oldest 5 cells land before `window.start` and render as rolled-off. When retention is reduced (future tuning), the grid shape stays constant.
7. **GameController gate is symmetric.** Phase 2: `state.date !== today → redirect /`. Phase 3 changes this to: "if already-played for this mode → redirect to `daily/<date>/<mode>/reveal`; else if date !== today → redirect to `daily/<date>/reveal`; else start daily." The "played" check reads `useDailyHistory().get(date, mode)`.
8. **Reveal overlay animation**: reuses `launcher-backdrop-in` + a new `launcher-card-in`-like keyframe (or reuses existing) for the card. No new named keyframe needed — reuse the existing `launcher-*-in` family.

---

## File structure

### Created

- `src/game/daily/calendarGrid.ts` — pure `calendarGrid(today: Date, retentionDays: number): CalendarCell[]`.
- `src/game/daily/__tests__/calendarGrid.test.ts`
- `src/components/LauncherStreakPill.tsx` — ~40-line presentational component.
- `src/components/LauncherMilestoneOverlay.tsx` — ~70-line overlay with auto-dismiss timer.
- `src/components/LauncherCalendarCell.tsx` — ~80-line single-cell component.
- `src/components/LauncherHistoryPanel.tsx` — ~130-line grid + close button + captions.
- `src/components/DailyRevealOverlay.tsx` — ~170-line full-screen reveal card.
- `src/components/__tests__/LauncherMilestoneOverlay.test.tsx` — unit: auto-dismiss, click-dismiss, event fire.
- `src/components/__tests__/LauncherHistoryPanel.test.tsx` — unit: keyboard nav, cell click fires navigation.
- `e2e/daily-streak.spec.ts`
- `e2e/launcher-history.spec.ts`
- `e2e/daily-reveal.spec.ts`

### Modified

- `src/game/daily/useDailyHistory.ts` — add `pendingMilestone` + `markMilestoneShown`.
- `src/game/daily/__tests__/useDailyHistory.test.tsx` — add tests for pendingMilestone and markMilestoneShown.
- `src/components/LauncherModeCard.tsx` — played state gains a "See reveal" CTA + `onSeeReveal` prop. Country name surfaced in `played.countryName`.
- `src/components/Launcher.tsx` — integrate streak pill, history link, history panel toggle, milestone overlay, nested Escape handling, `onSeeReveal` wiring. Enrich `playedFor()` to include the country name.
- `src/App.tsx` — mount `DailyRevealOverlay`.
- `src/game/GameController.tsx` — extend daily-hash gating: already-played → redirect to `.../reveal`.
- `src/index.css` — add `launcher-streak-in`, `launcher-history-in`, `launcher-milestone-in` keyframes.
- `playwright.config.ts` — register new e2e specs.
- `docs/roadmap.md` — tick Phase 3 complete.

### Removed

Nothing. Phase 3 is additive on Phase 2.

---

## Task 1: `calendarGrid` pure helper (TDD)

**Files:**
- Create: `src/game/daily/__tests__/calendarGrid.test.ts`
- Create: `src/game/daily/calendarGrid.ts`

Pure function returning a 35-cell array, Monday-aligned, ending on the current week's Sunday. Each cell carries its ISO date string + a `status: 'rolled-off' | 'in-window' | 'today'`.

- [ ] **Step 1: Write failing tests**

Create `src/game/daily/__tests__/calendarGrid.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calendarGrid } from '../calendarGrid'

describe('calendarGrid', () => {
  it('returns exactly 35 cells (7 cols × 5 rows)', () => {
    const cells = calendarGrid(new Date(2026, 3, 22), 30) // Wed Apr 22 2026
    expect(cells).toHaveLength(35)
  })

  it('ends on the current ISO-week Sunday', () => {
    const today = new Date(2026, 3, 22) // Wed Apr 22 2026
    const cells = calendarGrid(today, 30)
    // Wed → Sunday is +4 days → Apr 26.
    expect(cells[34].date).toBe('2026-04-26')
  })

  it('is Monday-aligned — cell 0 is a Monday', () => {
    const today = new Date(2026, 3, 22) // Wednesday
    const cells = calendarGrid(today, 30)
    // Walk back 5 weeks from Sunday Apr 26 → Mon Mar 23.
    expect(cells[0].date).toBe('2026-03-23')
  })

  it('marks cells before the retention-window start as rolled-off', () => {
    const today = new Date(2026, 3, 22)
    const cells = calendarGrid(today, 30)
    // Window start = today - 29 days = 2026-03-24.
    // So 2026-03-23 (cell 0) is rolled-off; 2026-03-24 (cell 1) is in-window.
    expect(cells[0].status).toBe('rolled-off')
    expect(cells[1].status).toBe('in-window')
  })

  it('marks today with status "today"', () => {
    const today = new Date(2026, 3, 22)
    const cells = calendarGrid(today, 30)
    const todayCell = cells.find((c) => c.date === '2026-04-22')
    expect(todayCell?.status).toBe('today')
  })

  it('cells after today within the current week have status "in-window" but no special today marker', () => {
    const today = new Date(2026, 3, 22) // Wed
    const cells = calendarGrid(today, 30)
    const thu = cells.find((c) => c.date === '2026-04-23')
    const sun = cells.find((c) => c.date === '2026-04-26')
    // Future cells within the current week — keep them but flag as 'rolled-off' so they don't look playable.
    // Spec doesn't explicitly cover future cells; we treat them as rolled-off for UI consistency.
    expect(thu?.status).toBe('rolled-off')
    expect(sun?.status).toBe('rolled-off')
  })

  it('handles a Sunday "today" (last day of ISO week)', () => {
    const today = new Date(2026, 3, 26) // Sun Apr 26
    const cells = calendarGrid(today, 30)
    expect(cells[34].date).toBe('2026-04-26')
    expect(cells[34].status).toBe('today')
  })
})
```

- [ ] **Step 2: Run to verify red**

```
npm run test:unit -- src/game/daily/__tests__/calendarGrid.test.ts
```
Expected: FAIL — `calendarGrid` not exported.

- [ ] **Step 3: Implement the helper**

Create `src/game/daily/calendarGrid.ts`:

```ts
import { toLocalDateString } from './dates'

export type CalendarCellStatus = 'rolled-off' | 'in-window' | 'today'

export interface CalendarCell {
  date: string // YYYY-MM-DD
  status: CalendarCellStatus
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/**
 * Build a 5×7 Monday-aligned calendar grid ending on the ISO-week Sunday
 * that contains `today`. Cells before the retention window or after `today`
 * are marked 'rolled-off'; cells within the window up to and including
 * today are 'in-window' (with today itself marked 'today').
 */
export function calendarGrid(today: Date, retentionDays: number): CalendarCell[] {
  // JS getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  // We want the ISO-week Sunday that contains `today`.
  const dow = today.getDay() // 0..6
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow
  const endSunday = addDays(today, daysUntilSunday)
  const gridStart = addDays(endSunday, -34) // 35 days total, inclusive both ends

  const todayStr = toLocalDateString(today)
  const windowStart = toLocalDateString(addDays(today, -(retentionDays - 1)))

  const out: CalendarCell[] = []
  for (let i = 0; i < 35; i++) {
    const date = toLocalDateString(addDays(gridStart, i))
    let status: CalendarCellStatus
    if (date === todayStr) status = 'today'
    else if (date < windowStart) status = 'rolled-off'
    else if (date > todayStr) status = 'rolled-off'
    else status = 'in-window'
    out.push({ date, status })
  }
  return out
}
```

- [ ] **Step 4: Run to verify green**

```
npm run test:unit -- src/game/daily/__tests__/calendarGrid.test.ts
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```
git add src/game/daily/calendarGrid.ts src/game/daily/__tests__/calendarGrid.test.ts
git commit -m "feat(daily): pure calendarGrid — 5x7 Monday-aligned cells with status"
```

---

## Task 2: `useDailyHistory` pendingMilestone + markMilestoneShown (TDD)

**Files:**
- Modify: `src/game/daily/useDailyHistory.ts`
- Modify: `src/game/daily/__tests__/useDailyHistory.test.tsx`
- Modify: `src/game/daily/storage.ts` (new pure helper `withMilestoneShown`)

Extend the hook's return shape with `pendingMilestone: Milestone | null` (derived) and `markMilestoneShown(): void` (persisted).

- [ ] **Step 1: Add a pure helper to `storage.ts`**

Append to `src/game/daily/storage.ts`:

```ts
import type { Milestone } from './types'
import { MILESTONES } from './types'

/**
 * Return the milestone threshold the current streak has just crossed and
 * has not yet been marked as shown, or null if none pending.
 */
export function pendingMilestone(h: DailyHistoryV1): Milestone | null {
  const current = h.streak.current
  const lastShown = h.streak.lastMilestoneShown
  // MILESTONES is ascending; pick the single threshold equal to `current`
  // (streak increments by 1 on each new day, so it can only equal exactly one).
  const hit = MILESTONES.find((m) => m === current) as Milestone | undefined
  if (!hit) return null
  if (hit <= lastShown) return null
  return hit
}

export function withMilestoneShown(h: DailyHistoryV1, m: Milestone): DailyHistoryV1 {
  if (m <= h.streak.lastMilestoneShown) return h
  return {
    ...h,
    streak: { ...h.streak, lastMilestoneShown: m },
  }
}
```

The import from `./types` is new — place with other type imports at the top of the file.

- [ ] **Step 2: Write failing tests for pendingMilestone + markMilestoneShown**

Append to `src/game/daily/__tests__/useDailyHistory.test.tsx`:

```tsx
import { MILESTONES } from '../types'

describe('useDailyHistory — milestones', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('pendingMilestone is null when streak is not at a threshold', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 2, longest: 2, lastActiveDate: '2026-04-22', lastMilestoneShown: 0 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBeNull()
  })

  it('pendingMilestone returns 3 when streak is 3 and never shown', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 3, longest: 3, lastActiveDate: '2026-04-22', lastMilestoneShown: 0 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBe(3)
  })

  it('pendingMilestone is null after markMilestoneShown', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 3, longest: 3, lastActiveDate: '2026-04-22', lastMilestoneShown: 0 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBe(3)
    act(() => { result.current.markMilestoneShown() })
    expect(result.current.pendingMilestone).toBeNull()
  })

  it('markMilestoneShown persists to localStorage', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 7, longest: 7, lastActiveDate: '2026-04-22', lastMilestoneShown: 3 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBe(7)
    act(() => { result.current.markMilestoneShown() })
    const stored = JSON.parse(localStorage.getItem('funworldmap-daily-history') ?? '{}')
    expect(stored.streak.lastMilestoneShown).toBe(7)
  })

  it('markMilestoneShown is a no-op when no pending milestone', () => {
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBeNull()
    act(() => { result.current.markMilestoneShown() })
    const stored = localStorage.getItem('funworldmap-daily-history')
    // Either unchanged or still matches empty-history shape.
    expect(JSON.parse(stored ?? 'null')?.streak?.lastMilestoneShown ?? 0).toBe(0)
  })

  it('MILESTONES export is [3, 7, 14, 30, 100]', () => {
    expect([...MILESTONES]).toEqual([3, 7, 14, 30, 100])
  })
})
```

- [ ] **Step 3: Run to verify red**

```
npm run test:unit -- src/game/daily/__tests__/useDailyHistory.test.tsx
```
Expected: FAIL on the new tests — `pendingMilestone` / `markMilestoneShown` not on the hook.

- [ ] **Step 4: Extend the hook**

Replace the contents of `src/game/daily/useDailyHistory.ts`:

```ts
import { useCallback, useMemo, useState } from 'react'
import type { ModeId } from '../shared/types'
import type { DailyHistoryV1, DailyDayResult, Milestone, StreakState } from './types'
import {
  readHistory,
  writeHistory,
  mergeDay,
  updateStreak,
  pendingMilestone as derivePendingMilestone,
  withMilestoneShown,
} from './storage'

export interface UseDailyHistory {
  history: DailyHistoryV1
  streak: StreakState
  pendingMilestone: Milestone | null
  get(date: string, modeId: ModeId): DailyDayResult | null
  record(date: string, modeId: ModeId, result: DailyDayResult): void
  markMilestoneShown(): void
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

  const pendingMilestone = useMemo(() => derivePendingMilestone(history), [history])

  const markMilestoneShown = useCallback(() => {
    setHistory((prev) => {
      const m = derivePendingMilestone(prev)
      if (!m) return prev
      const next = withMilestoneShown(prev, m)
      writeHistory(next)
      return next
    })
  }, [])

  return { history, streak: history.streak, pendingMilestone, get, record, markMilestoneShown }
}
```

- [ ] **Step 5: Run tests — expect green**

```
npm run test:unit -- src/game/daily/__tests__/useDailyHistory.test.tsx
```
Expected: all previous tests + 6 new milestone tests pass.

- [ ] **Step 6: Commit**

```
git add src/game/daily/useDailyHistory.ts src/game/daily/storage.ts src/game/daily/__tests__/useDailyHistory.test.tsx
git commit -m "feat(daily): pendingMilestone derivation + markMilestoneShown dedupe"
```

---

## Task 3: `LauncherStreakPill` component

**Files:**
- Create: `src/components/LauncherStreakPill.tsx`

Presentational only — renders streak copy in one of three states. No internal state.

- [ ] **Step 1: Create the component**

```tsx
interface Props {
  current: number
  longest: number
  totalDays: number
  isBroken: boolean
  onOpenHistory: () => void
}

export function LauncherStreakPill({ current, longest, totalDays, isBroken, onOpenHistory }: Props) {
  const showActive = current >= 1
  const showBroken = current === 0 && isBroken

  return (
    <div
      data-testid="launcher-streak"
      className="flex items-center justify-center gap-3 text-[13px] text-sand-50/90 dark:text-dark-100"
      style={{ animation: 'launcher-streak-in 180ms ease-out 30ms both' }}
    >
      {showActive && (
        <span>
          <span aria-hidden="true">🔥 </span>
          <span className="tabular-nums font-semibold">{current}-day streak</span>
        </span>
      )}
      {showBroken && (
        <span>Start your streak — play today's daily.</span>
      )}
      {!showActive && !showBroken && (
        <span>Play today's daily.</span>
      )}

      {totalDays > 0 && (
        <button
          type="button"
          onClick={onOpenHistory}
          data-testid="launcher-history-link"
          className="text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-1"
          aria-label={`Open calendar: current ${current} longest ${longest} days played ${totalDays}`}
        >
          Past 30 days →
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc -b
```
Expected: clean — the component is standalone.

- [ ] **Step 3: Commit**

```
git add src/components/LauncherStreakPill.tsx
git commit -m "feat(launcher): streak pill component (3 states + history link)"
```

---

## Task 4: `LauncherMilestoneOverlay` component (with unit tests)

**Files:**
- Create: `src/components/LauncherMilestoneOverlay.tsx`
- Create: `src/components/__tests__/LauncherMilestoneOverlay.test.tsx`

Standalone modal that celebrates a milestone. Auto-dismiss after 2.5 s; click or Escape also dismiss. Fires `streak_reached_milestone` on mount; calls `onDismiss` on any dismiss path.

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LauncherMilestoneOverlay } from '../LauncherMilestoneOverlay'

declare global {
  interface Window {
    __PLAYWRIGHT__?: boolean
    __testAnalytics?: Array<{ name: string; props?: Record<string, string | number> }>
  }
}

describe('LauncherMilestoneOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(window as Window).__PLAYWRIGHT__ = true
    ;(window as Window).__testAnalytics = []
  })
  afterEach(() => {
    vi.useRealTimers()
    delete (window as Window).__PLAYWRIGHT__
    delete (window as Window).__testAnalytics
  })

  it('renders milestone copy for each threshold', () => {
    const copies: Record<number, RegExp> = {
      3: /off to a strong start/i,
      7: /a full week/i,
      14: /two weeks/i,
      30: /a full month/i,
      100: /a hundred days/i,
    }
    for (const [days, regex] of Object.entries(copies)) {
      const { unmount } = render(
        <LauncherMilestoneOverlay days={Number(days) as 3 | 7 | 14 | 30 | 100} onDismiss={() => {}} />,
      )
      expect(screen.getByTestId('launcher-milestone')).toHaveTextContent(regex)
      unmount()
    }
  })

  it('fires streak_reached_milestone on mount', () => {
    render(<LauncherMilestoneOverlay days={7} onDismiss={() => {}} />)
    expect((window as Window).__testAnalytics).toContainEqual({
      name: 'streak_reached_milestone',
      props: { days: 7 },
    })
  })

  it('auto-dismisses after 2500 ms', () => {
    const onDismiss = vi.fn()
    render(<LauncherMilestoneOverlay days={3} onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2499) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on click', () => {
    const onDismiss = vi.fn()
    render(<LauncherMilestoneOverlay days={3} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('launcher-milestone'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify red**

```
npm run test:unit -- src/components/__tests__/LauncherMilestoneOverlay.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

Create `src/components/LauncherMilestoneOverlay.tsx`:

```tsx
import { useEffect } from 'react'
import { track } from '../lib/analytics'
import type { Milestone } from '../game/daily/types'

const COPY: Record<Milestone, string> = {
  3: '3 days — off to a strong start',
  7: '7 days — a full week',
  14: '14 days — two weeks',
  30: '30 days — a full month',
  100: '100 days — a hundred days',
}

interface Props {
  days: Milestone
  onDismiss: () => void
}

export function LauncherMilestoneOverlay({ days, onDismiss }: Props) {
  useEffect(() => {
    track('streak_reached_milestone', { days })
    const t = window.setTimeout(onDismiss, 2500)
    return () => { window.clearTimeout(t) }
  }, [days, onDismiss])

  return (
    <button
      type="button"
      onClick={onDismiss}
      data-testid="launcher-milestone"
      className="fixed inset-x-0 top-16 z-[220] mx-auto max-w-md px-6 py-3 rounded-xl bg-teal text-white shadow-2xl text-center text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-light/80"
      style={{ animation: 'launcher-milestone-in 260ms ease-out both' }}
      aria-live="polite"
    >
      <span aria-hidden="true">🔥 </span>{COPY[days]}
    </button>
  )
}
```

- [ ] **Step 4: Run tests — expect green**

```
npm run test:unit -- src/components/__tests__/LauncherMilestoneOverlay.test.tsx
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/LauncherMilestoneOverlay.tsx src/components/__tests__/LauncherMilestoneOverlay.test.tsx
git commit -m "feat(launcher): milestone overlay — 5 thresholds, auto+click dismiss"
```

---

## Task 5: `LauncherCalendarCell` component

**Files:**
- Create: `src/components/LauncherCalendarCell.tsx`

Single cell renderer. No internal state. `onActivate(date)` callback for played + in-window cells; rolled-off is inert.

- [ ] **Step 1: Create the file**

```tsx
import type { CalendarCellStatus } from '../game/daily/calendarGrid'
import type { ModeId } from '../game/shared/types'

interface Props {
  date: string // YYYY-MM-DD
  status: CalendarCellStatus
  playedModes: ReadonlySet<ModeId>
  onActivate: (date: string) => void
}

function dayNumber(date: string): string {
  return String(Number(date.slice(-2))) // strip leading zero for visual tightness
}

function ariaLabel(date: string, status: CalendarCellStatus, played: ReadonlySet<ModeId>): string {
  const parts: string[] = [new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })]
  if (status === 'today') parts.push('today')
  if (played.has('country-pinning')) parts.push('played country pinning')
  if (played.has('city-guessing')) parts.push('played city guessing')
  if (status === 'rolled-off') parts.push('not available')
  return parts.join(', ')
}

export function LauncherCalendarCell({ date, status, playedModes, onActivate }: Props) {
  const isInteractive = status === 'in-window' || status === 'today'
  const testId = `launcher-cal-${date}`
  const cpDot = playedModes.has('country-pinning')
  const cgDot = playedModes.has('city-guessing')

  const className = [
    'relative h-10 flex flex-col items-center justify-center rounded-md text-[11px] tabular-nums',
    status === 'rolled-off' && 'text-sand-400 dark:text-dark-200 cursor-default',
    status === 'in-window' && 'text-sand-800 dark:text-dark-50 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 cursor-pointer',
    status === 'today' && 'text-sand-900 dark:text-dark-50 ring-2 ring-teal dark:ring-teal-light cursor-pointer',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      data-testid={testId}
      data-status={status}
      role="gridcell"
      aria-label={ariaLabel(date, status, playedModes)}
      tabIndex={isInteractive ? 0 : -1}
      disabled={!isInteractive}
      onClick={isInteractive ? () => onActivate(date) : undefined}
      className={className}
    >
      <span>{status === 'rolled-off' ? '—' : dayNumber(date)}</span>
      {(cpDot || cgDot) && (
        <span className="flex gap-0.5 mt-0.5">
          {cpDot && <span aria-hidden="true" className="w-1 h-1 rounded-full bg-teal dark:bg-teal-light" />}
          {cgDot && <span aria-hidden="true" className="w-1 h-1 rounded-full bg-orange-400" />}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc -b
```
Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/components/LauncherCalendarCell.tsx
git commit -m "feat(launcher): calendar cell — interactive states + per-mode dots"
```

---

## Task 6: `LauncherHistoryPanel` component (with unit tests)

**Files:**
- Create: `src/components/LauncherHistoryPanel.tsx`
- Create: `src/components/__tests__/LauncherHistoryPanel.test.tsx`

Grid + close button + captions. Consumes `useDailyHistory` for day data; `calendarGrid` for structure. Keyboard arrow-navigation is handled at the panel level.

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LauncherHistoryPanel } from '../LauncherHistoryPanel'

declare global {
  interface Window {
    __PLAYWRIGHT__?: boolean
    __testAnalytics?: Array<{ name: string; props?: Record<string, string | number> }>
  }
}

function seedHistory(today: string, score = 87) {
  localStorage.setItem('funworldmap-daily-history', JSON.stringify({
    version: 1,
    streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
    days: { [today]: { 'country-pinning': { score, attempts: [], completedAt: 1 } } },
  }))
}

describe('LauncherHistoryPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    ;(window as Window).__PLAYWRIGHT__ = true
    ;(window as Window).__testAnalytics = []
  })
  afterEach(() => {
    localStorage.clear()
    delete (window as Window).__PLAYWRIGHT__
    delete (window as Window).__testAnalytics
  })

  it('renders a grid of 35 cells', () => {
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    render(<LauncherHistoryPanel today={new Date(2026, 3, 22)} onClose={onClose} onCellActivate={onCellActivate} />)
    const cells = screen.getAllByRole('gridcell')
    expect(cells).toHaveLength(35)
  })

  it('shows streak captions', () => {
    seedHistory('2026-04-22')
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    render(<LauncherHistoryPanel today={new Date(2026, 3, 22)} onClose={onClose} onCellActivate={onCellActivate} />)
    expect(screen.getByTestId('launcher-history-captions')).toHaveTextContent(/current[^\d]*1/i)
    expect(screen.getByTestId('launcher-history-captions')).toHaveTextContent(/days played[^\d]*1/i)
  })

  it('activating a cell fires onCellActivate with the date + kind', () => {
    seedHistory('2026-04-22')
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    render(<LauncherHistoryPanel today={new Date(2026, 3, 22)} onClose={onClose} onCellActivate={onCellActivate} />)
    fireEvent.click(screen.getByTestId('launcher-cal-2026-04-22'))
    expect(onCellActivate).toHaveBeenCalledWith('2026-04-22', 'played')
  })

  it('close button fires onClose', () => {
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    render(<LauncherHistoryPanel today={new Date(2026, 3, 22)} onClose={onClose} onCellActivate={onCellActivate} />)
    fireEvent.click(screen.getByTestId('launcher-history-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify red**

```
npm run test:unit -- src/components/__tests__/LauncherHistoryPanel.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

Create `src/components/LauncherHistoryPanel.tsx`:

```tsx
import { useMemo, useRef } from 'react'
import { calendarGrid } from '../game/daily/calendarGrid'
import { useDailyHistory } from '../game/daily/useDailyHistory'
import type { ModeId } from '../game/shared/types'
import { LauncherCalendarCell } from './LauncherCalendarCell'

export type HistoryCellKind = 'played' | 'unplayed-in-window' | 'rolled-off'

interface Props {
  today: Date
  onClose: () => void
  onCellActivate: (date: string, kind: HistoryCellKind) => void
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function LauncherHistoryPanel({ today, onClose, onCellActivate }: Props) {
  const { history } = useDailyHistory()
  const cells = useMemo(() => calendarGrid(today, 30), [today])
  const rootRef = useRef<HTMLDivElement>(null)

  const playedByDate = useMemo(() => {
    const out = new Map<string, Set<ModeId>>()
    for (const [date, entry] of Object.entries(history.days)) {
      const modes: Set<ModeId> = new Set()
      if (entry?.['country-pinning']) modes.add('country-pinning')
      if (entry?.['city-guessing']) modes.add('city-guessing')
      if (modes.size > 0) out.set(date, modes)
    }
    return out
  }, [history])

  const totalDays = playedByDate.size

  const onActivate = (date: string) => {
    const cell = cells.find((c) => c.date === date)
    if (!cell) return
    if (cell.status === 'rolled-off') return
    const played = playedByDate.has(date)
    const kind: HistoryCellKind = played ? 'played' : 'unplayed-in-window'
    onCellActivate(date, kind)
  }

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const active = document.activeElement as HTMLElement | null
    if (!active || !active.hasAttribute('data-testid') || !active.getAttribute('data-testid')?.startsWith('launcher-cal-')) return
    const currentDate = active.getAttribute('data-testid')?.slice('launcher-cal-'.length)
    if (!currentDate) return
    const idx = cells.findIndex((c) => c.date === currentDate)
    if (idx < 0) return
    let target = idx
    switch (e.key) {
      case 'ArrowLeft': target = Math.max(0, idx - 1); break
      case 'ArrowRight': target = Math.min(cells.length - 1, idx + 1); break
      case 'ArrowUp': target = Math.max(0, idx - 7); break
      case 'ArrowDown': target = Math.min(cells.length - 1, idx + 7); break
      default: return
    }
    e.preventDefault()
    const el = rootRef.current?.querySelector<HTMLButtonElement>(`[data-testid="launcher-cal-${cells[target].date}"]`)
    el?.focus()
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Past 30 days"
      data-testid="launcher-history"
      className="mt-4 p-4 rounded-xl bg-sand-50/95 dark:bg-dark-400/95 border border-sand-300/50 dark:border-dark-200/30 shadow-xl"
      style={{ animation: 'launcher-history-in 220ms ease-out both' }}
      onKeyDown={onKey}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-teal dark:text-teal-light">Past 30 days</div>
        <button
          type="button"
          onClick={onClose}
          data-testid="launcher-history-close"
          aria-label="Close history"
          className="w-7 h-7 rounded-full text-sand-600 dark:text-dark-100 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          ×
        </button>
      </div>

      <div role="row" className="grid grid-cols-7 gap-1 mb-1 text-[10px] text-sand-500 dark:text-dark-100 text-center">
        {DOW_LABELS.map((l, i) => (
          <span key={i} aria-hidden="true">{l}</span>
        ))}
      </div>

      <div role="grid" aria-label="Calendar" className="grid grid-cols-7 gap-1">
        {cells.map((c) => (
          <LauncherCalendarCell
            key={c.date}
            date={c.date}
            status={c.status}
            playedModes={playedByDate.get(c.date) ?? new Set<ModeId>()}
            onActivate={onActivate}
          />
        ))}
      </div>

      <div
        data-testid="launcher-history-captions"
        className="mt-3 text-center text-[12px] text-sand-600 dark:text-dark-100 tabular-nums"
      >
        Current: <span className="text-teal dark:text-teal-light font-semibold">{history.streak.current}</span>
        {' · '}
        Longest: <span className="text-teal dark:text-teal-light font-semibold">{history.streak.longest}</span>
        {' · '}
        Days played: <span className="text-teal dark:text-teal-light font-semibold">{totalDays}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect green**

```
npm run test:unit -- src/components/__tests__/LauncherHistoryPanel.test.tsx
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/LauncherHistoryPanel.tsx src/components/__tests__/LauncherHistoryPanel.test.tsx
git commit -m "feat(launcher): history panel — 5x7 grid + keyboard nav + captions"
```

---

## Task 7: `DailyRevealOverlay` component

**Files:**
- Create: `src/components/DailyRevealOverlay.tsx`

Text-only reveal. Reads `useDailyHistory.get` for stored attempts and `useDailyPuzzlesContext().byDate` for the target. Receives country + city pools via props from App.tsx. Renders either one-mode or both-mode reveal based on the URL shape.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect } from 'react'
import { useDailyHistory } from '../game/daily/useDailyHistory'
import { useDailyPuzzlesContext } from '../game/daily/DailyPuzzlesProvider'
import { track } from '../lib/analytics'
import { toLocalDateString } from '../game/daily/dates'
import type { CityLike, CountryLike, ModeId } from '../game/shared/types'

interface Props {
  date: string
  modeId: ModeId | null
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
}

function scoreDot(score: number): { emoji: string; label: string } {
  if (score >= 90) return { emoji: '🟩', label: `${score}/100` }
  if (score >= 70) return { emoji: '🟨', label: `${score}/100` }
  if (score >= 50) return { emoji: '🟧', label: `${score}/100` }
  if (score >= 30) return { emoji: '🟥', label: `${score}/100` }
  return { emoji: '⬛', label: `${score}/100` }
}

function dateKindOf(date: string): 'today' | 'past' | 'future' | 'invalid' {
  const todayStr = toLocalDateString(new Date())
  if (date === todayStr) return 'today'
  if (date < todayStr) return 'past'
  if (date > todayStr) return 'future'
  return 'invalid'
}

export function DailyRevealOverlay({ date, modeId, countries, cities, onClose }: Props) {
  const { byDate } = useDailyPuzzlesContext()
  const { get } = useDailyHistory()
  const puzzle = byDate(date)

  useEffect(() => {
    track('deep_link_opened', { dateKind: dateKindOf(date), outcome: 'reveal' })
  }, [date])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const showCountry = modeId === null || modeId === 'country-pinning'
  const showCity = modeId === null || modeId === 'city-guessing'

  const country = puzzle ? countries.find((c) => c.cca3 === puzzle.country.cca3) ?? null : null
  const city = puzzle ? cities.find((c) => c.id === puzzle.city.id) ?? null : null

  const cpRecord = get(date, 'country-pinning')
  const cgRecord = get(date, 'city-guessing')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Daily reveal for ${date}`}
      data-testid="daily-reveal"
      className="fixed inset-0 z-[220] flex items-center justify-center p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/65 dark:bg-[rgba(11,15,26,0.78)] backdrop-blur-[4px]"
      />
      <div className="relative w-full max-w-xl mx-auto bg-sand-50 dark:bg-dark-400 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-teal dark:text-teal-light">Daily reveal</div>
            <div className="text-lg font-bold text-sand-900 dark:text-dark-50 tabular-nums">{date}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="daily-reveal-close"
            aria-label="Close reveal"
            className="w-8 h-8 rounded-full text-sand-600 dark:text-dark-100 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
          >
            ×
          </button>
        </div>

        {!puzzle && (
          <p data-testid="daily-reveal-unavailable" className="text-sand-600 dark:text-dark-100">
            That daily is no longer available.
          </p>
        )}

        {puzzle && showCountry && country && (
          <div data-testid="daily-reveal-country" className="mb-4 pb-4 border-b border-sand-200 dark:border-dark-300">
            <div className="text-[11px] uppercase tracking-widest text-teal dark:text-teal-light mb-1">Country</div>
            <div className="text-xl font-bold text-sand-900 dark:text-dark-50">{country.name.common}</div>
            {cpRecord && (
              <div className="mt-2 text-sm text-sand-700 dark:text-dark-100">
                Your attempts:{' '}
                <span className="tabular-nums">
                  {cpRecord.attempts.map((a, i) => (
                    <span key={i} aria-label={scoreDot(a.pointsEarned).label}>{scoreDot(a.pointsEarned).emoji}</span>
                  ))}
                </span>{' '}
                <span className="font-semibold">{cpRecord.score}/100</span>
              </div>
            )}
            {!cpRecord && (
              <div className="mt-2 text-sm text-sand-600 dark:text-dark-100">Not played.</div>
            )}
          </div>
        )}

        {puzzle && showCity && city && (
          <div data-testid="daily-reveal-city">
            <div className="text-[11px] uppercase tracking-widest text-teal dark:text-teal-light mb-1">City</div>
            <div className="text-xl font-bold text-sand-900 dark:text-dark-50">{city.name}, {city.countryName}</div>
            {cgRecord && (
              <div className="mt-2 text-sm text-sand-700 dark:text-dark-100">
                Your attempts:{' '}
                <span className="tabular-nums">
                  {cgRecord.attempts.map((a, i) => (
                    <span key={i} aria-label={scoreDot(a.pointsEarned).label}>{scoreDot(a.pointsEarned).emoji}</span>
                  ))}
                </span>{' '}
                <span className="font-semibold">{cgRecord.score}/100</span>
              </div>
            )}
            {!cgRecord && (
              <div className="mt-2 text-sm text-sand-600 dark:text-dark-100">Not played.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc -b
```
Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/components/DailyRevealOverlay.tsx
git commit -m "feat(daily): DailyRevealOverlay — text-only reveal for /reveal URLs"
```

---

## Task 8: Add keyframes to `src/index.css`

**Files:**
- Modify: `src/index.css`

Three new keyframes to match the animations referenced by the Phase 3 components. Existing `launcher-*` keyframes remain untouched.

- [ ] **Step 1: Find the existing `@keyframes launcher-backdrop-in` block**

Locate the existing launcher keyframes (added in the launcher-landing-state PR). They sit in a dedicated section.

- [ ] **Step 2: Append three new keyframes**

At the end of the existing launcher-keyframes block, add:

```css
@keyframes launcher-streak-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes launcher-history-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scaleY(0.97);
    transform-origin: top center;
  }
  to {
    opacity: 1;
    transform: translateY(0) scaleY(1);
  }
}

@keyframes launcher-milestone-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

- [ ] **Step 3: Verify build**

```
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```
git add src/index.css
git commit -m "feat(launcher): keyframes for streak pill, history panel, milestone overlay"
```

---

## Task 9: Integrate streak pill, history link, milestone overlay into `Launcher.tsx`

**Files:**
- Modify: `src/components/Launcher.tsx`

Embed the three new surfaces. Add local state for `historyOpen` and hand over `onOpenHistory` to the streak pill. Milestone overlay renders conditionally on `pendingMilestone`.

- [ ] **Step 1: Update imports**

At the top of `Launcher.tsx`, add:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LauncherStreakPill } from './LauncherStreakPill'
import { LauncherMilestoneOverlay } from './LauncherMilestoneOverlay'
import { LauncherHistoryPanel } from './LauncherHistoryPanel'
import type { HistoryCellKind } from './LauncherHistoryPanel'
```

(Add to the existing `from 'react'` line; do not duplicate imports.)

- [ ] **Step 2: Destructure new pieces from the daily-history hook**

Inside `Launcher`, change:
```tsx
const { get: getDay } = useDailyHistory()
```
to:
```tsx
const { history, get: getDay, streak, pendingMilestone, markMilestoneShown } = useDailyHistory()
```

- [ ] **Step 3: Derive `totalDays` and `isBroken`**

After the destructure, add:
```tsx
const totalDays = useMemo(() => Object.keys(history.days).length, [history])
const isBroken = streak.current === 0 && totalDays > 0
```

- [ ] **Step 4: Add `historyOpen` state**

Near the other `useState` calls, add:
```tsx
const [historyOpen, setHistoryOpen] = useState(false)
```

- [ ] **Step 5: Handlers**

Before the render, add:

```tsx
const openHistory = useCallback(() => {
  setHistoryOpen(true)
  track('history_opened', {})
}, [])

const closeHistory = useCallback(() => {
  setHistoryOpen(false)
}, [])

const onCellActivate = useCallback((d: string, kind: HistoryCellKind) => {
  track('history_cell_clicked', { cellKind: kind })
  if (kind === 'rolled-off') return
  onDismiss()
  window.location.hash = `daily/${d}/reveal`
}, [onDismiss])

const onMilestoneDismiss = useCallback(() => {
  markMilestoneShown()
}, [markMilestoneShown])
```

- [ ] **Step 6: Render the streak pill above the cards**

In the JSX, after the `<header>` block and before the mode-card grid:

```tsx
<div className="mb-4">
  <LauncherStreakPill
    current={streak.current}
    longest={streak.longest}
    totalDays={totalDays}
    isBroken={isBroken}
    onOpenHistory={openHistory}
  />
</div>
```

- [ ] **Step 7: Render the history panel below the cards, conditional**

After the mode-card grid div, before the `<div className="mt-6 text-center">` (dismiss-link block):

```tsx
{historyOpen && (
  <LauncherHistoryPanel
    today={new Date()}
    onClose={closeHistory}
    onCellActivate={onCellActivate}
  />
)}
```

- [ ] **Step 8: Render the milestone overlay conditionally**

Near the root `<div>`, inside the same return but outside the card-cluster div (so it can position `fixed` cleanly):

```tsx
{pendingMilestone && (
  <LauncherMilestoneOverlay days={pendingMilestone} onDismiss={onMilestoneDismiss} />
)}
```

- [ ] **Step 9: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: all pass.

- [ ] **Step 10: Commit**

```
git add src/components/Launcher.tsx
git commit -m "feat(launcher): integrate streak pill + history panel + milestone overlay"
```

---

## Task 10: Nested Escape — close history panel first

**Files:**
- Modify: `src/components/Launcher.tsx`

When the panel is open, Escape should close the panel and NOT propagate to the launcher's existing Escape→dismiss chain. When the panel is closed, Escape dismisses the launcher (unchanged behavior in `App.tsx`).

- [ ] **Step 1: Add a keydown handler on the launcher root**

Extend the existing focus-trap `useEffect` inside `Launcher.tsx` so the Escape key handler closes the panel first if open:

Inside the `onKey` function that currently handles Tab cycling, add an Escape branch BEFORE any other handling:

```tsx
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && historyOpen) {
    e.preventDefault()
    e.stopPropagation()
    setHistoryOpen(false)
    return
  }
  if (e.key !== 'Tab') return
  // ... existing Tab logic unchanged
}
```

Since this handler must see `historyOpen` via closure, ensure the effect's dep array includes `historyOpen`:

```tsx
}, [historyOpen])
```

If the existing effect had `[]` for deps (stable trap), the change above keeps the Tab logic correct; the effect re-binds when `historyOpen` changes, which is fine because the trap only attaches/removes a keydown listener.

- [ ] **Step 2: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: pass.

- [ ] **Step 3: Commit**

```
git add src/components/Launcher.tsx
git commit -m "feat(launcher): nested Escape — close history panel before launcher dismiss"
```

---

## Task 11: `LauncherModeCard` "See reveal" CTA

**Files:**
- Modify: `src/components/LauncherModeCard.tsx`
- Modify: `src/components/Launcher.tsx`

Played state gains a primary `See reveal` button. Clicking navigates to `/#daily/<date>/<modeId>/reveal`.

- [ ] **Step 1: Extend `LauncherModeCard` Props**

Edit `src/components/LauncherModeCard.tsx`. Extend the `Props` interface:

```tsx
interface Props {
  modeId: ModeId
  state: LauncherCardState
  played?: PlayedResult
  freeBest: PersonalBest
  onStartDaily: () => void
  onStartFree: () => void
  onSeeReveal?: () => void
}
```

And the function signature:

```tsx
export function LauncherModeCard({ modeId, state, played, freeBest, onStartDaily, onStartFree, onSeeReveal }: Props) {
```

- [ ] **Step 2: Render the CTA in the played branch**

Replace the existing played branch:

```tsx
{state === 'played' && (
  <div data-testid={`${testIdBase}-played-result`}>
    <div className="text-sand-900 dark:text-dark-50 text-sm mb-2">
      ✓ {played?.countryName ?? 'Played'} · <span className="tabular-nums font-semibold">{played?.score ?? 0}</span>/100
    </div>
    {onSeeReveal && (
      <button
        type="button"
        onClick={onSeeReveal}
        data-testid={`${testIdBase}-see-reveal`}
        className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60"
      >
        See reveal
      </button>
    )}
  </div>
)}
```

- [ ] **Step 3: Extend `PlayedResult` with countryName**

Inside `LauncherModeCard.tsx`, update:

```tsx
interface PlayedResult {
  countryName?: string
  score: number
}
```

(Already has `countryName?` — leave as-is.)

- [ ] **Step 4: Wire `onSeeReveal` in Launcher.tsx**

In `Launcher.tsx`, enrich `playedFor()` to include the country/city name and add a `seeReveal` callback:

```tsx
const playedFor = useCallback((id: ModeId) => {
  const prior = getDay(date, id)
  if (!prior) return undefined
  const puzzle = byDate(date)
  if (!puzzle) return { score: prior.score }
  if (id === 'country-pinning') {
    const c = countries.find((cc) => cc.cca3 === puzzle.country.cca3)
    return { score: prior.score, countryName: c?.name.common }
  }
  const city = cities.find((cc) => cc.id === puzzle.city.id)
  return { score: prior.score, countryName: city?.name }
}, [getDay, date, byDate, countries, cities])
```

You'll need to thread `countries` and `cities` into Launcher. Check the current Launcher signature — if it doesn't already receive them, add optional props (but a simpler path: use React Context `useDailyPuzzlesContext().byDate` + add `countries`/`cities` via a small context OR accept that `countryName` can be undefined and show the fallback). **Lean approach: pass `countries` and `cities` as props from `App.tsx`.**

Extend Launcher Props:

```tsx
interface Props {
  onDismiss: () => void
  anchorDate: string | null
  countries: CountryLike[]
  cities: CityLike[]
}
```

Add `import type { CityLike, CountryLike } from '../game/shared/types'`.

Update `App.tsx`'s `<Launcher>` render to pass `countries` + `cities`.

- [ ] **Step 5: Add `onSeeReveal` handler**

In `Launcher.tsx`:

```tsx
const seeReveal = useCallback(
  (id: ModeId) => {
    track('launcher_dismissed', { path: 'card' })
    onDismiss()
    window.location.hash = `daily/${date}/${id}/reveal`
  },
  [onDismiss, date],
)
```

Pass to the card:

```tsx
<LauncherModeCard
  ...
  onSeeReveal={() => seeReveal(m.id)}
/>
```

- [ ] **Step 6: Update `App.tsx` to pass pools**

In `App.tsx`, update the `<Launcher>` render:

```tsx
{launcherVisible && <Launcher onDismiss={dismissLauncher} anchorDate={anchorDate} countries={pool} cities={cities} />}
```

- [ ] **Step 7: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: pass.

- [ ] **Step 8: Commit**

```
git add src/components/LauncherModeCard.tsx src/components/Launcher.tsx src/App.tsx
git commit -m "feat(launcher): See-reveal CTA on played card + country name on result line"
```

---

## Task 12: Mount `DailyRevealOverlay` from `App.tsx`

**Files:**
- Modify: `src/App.tsx`

Subscribe to hashchange + mount the overlay when hash kind is `'daily'` with `reveal === true`.

- [ ] **Step 1: Add hash-state tracking in App.tsx**

At the top of `AppInner`, add:

```tsx
const [revealState, setRevealState] = useState<{ date: string; modeId: ModeId | null } | null>(null)

useEffect(() => {
  const read = () => {
    const state = parseHash(window.location.hash)
    if (state.kind === 'daily' && state.reveal) {
      setRevealState({ date: state.date, modeId: state.modeId as ModeId | null })
    } else {
      setRevealState(null)
    }
  }
  read()
  window.addEventListener('hashchange', read)
  return () => window.removeEventListener('hashchange', read)
}, [])
```

Import `ModeId` if not already imported at the top.

- [ ] **Step 2: Mount the overlay**

Add near the end of the `AppInner` return, inside the root `<div>`:

```tsx
{revealState && (
  <DailyRevealOverlay
    date={revealState.date}
    modeId={revealState.modeId}
    countries={pool}
    cities={cities}
    onClose={() => {
      history.replaceState(null, '', window.location.pathname)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }}
  />
)}
```

Import at the top:

```tsx
import { DailyRevealOverlay } from './components/DailyRevealOverlay'
```

- [ ] **Step 3: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: pass.

- [ ] **Step 4: Commit**

```
git add src/App.tsx
git commit -m "feat(daily): mount DailyRevealOverlay on /reveal hashes"
```

---

## Task 13: GameController — redirect played/past daily to `/reveal`

**Files:**
- Modify: `src/game/GameController.tsx`

Currently (Phase 2): `#daily/<today>/<mode>` starts the daily; `#daily/<past>/<mode>` redirects to `/`. Change: if the user has already played today's daily for this mode → redirect to `.../reveal`; past dates also → redirect to `.../reveal` (same URL shape). Future dates → still redirect to `/`.

- [ ] **Step 1: Update the daily branch in `check()`**

Locate the `if (state.kind === 'daily' && state.modeId && !state.reveal && ...)` branch inside the hash-bootstrap `useEffect`. Replace the past/future gate block:

Before:
```tsx
const todayStr = toLocalDateString(new Date())
if (state.date !== todayStr) {
  history.replaceState(null, '', window.location.pathname)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  return
}
```

After:
```tsx
const todayStr = toLocalDateString(new Date())

if (state.date > todayStr) {
  // Future: send to root (handled by launcher when hash clears).
  history.replaceState(null, '', window.location.pathname)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  return
}

const alreadyPlayed = dailyHistoryGet(state.date, id) !== null
if (state.date < todayStr || alreadyPlayed) {
  window.location.hash = `daily/${state.date}/${id}/reveal`
  return
}
```

`useDailyHistory()` is already called at the top of `GameController` (Phase 2 added it with `{ record: recordDailyResult }`). Extend the destructure in place:

```tsx
const { record: recordDailyResult, get: dailyHistoryGet } = useDailyHistory()
```

- [ ] **Step 2: Typecheck + unit tests**

```
npx tsc -b && npm run test:unit
```
Expected: pass.

- [ ] **Step 3: Commit**

```
git add src/game/GameController.tsx
git commit -m "fix(daily): past/already-played URLs redirect to /reveal instead of /"
```

---

## Task 14: E2e — daily-streak spec

**Files:**
- Create: `e2e/daily-streak.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { test, expect } from '@playwright/test'

test.setTimeout(120_000)
const TODAY = new Date().toISOString().slice(0, 10)

test.describe('Daily streak', () => {
  test('streak pill shows current streak when localStorage has a streak', async ({ page }) => {
    await page.addInitScript((today) => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 5, longest: 5, lastActiveDate: today, lastMilestoneShown: 3 },
        days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
      }))
    }, TODAY)
    await page.goto('/')
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-streak')).toContainText(/5-day streak/)
  })

  test('streak pill shows broken-streak invite when current=0 with prior entries', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 0, longest: 3, lastActiveDate: '2026-04-18', lastMilestoneShown: 3 },
        days: { '2026-04-18': { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
      }))
    })
    await page.goto('/')
    await expect(page.getByTestId('launcher-streak')).toContainText(/start your streak/i)
  })

  test('milestone overlay fires at streak 7 with a fresh lastMilestoneShown', async ({ page }) => {
    await page.addInitScript((today) => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 7, longest: 7, lastActiveDate: today, lastMilestoneShown: 3 },
        days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
      }))
    }, TODAY)
    await page.goto('/')
    await expect(page.getByTestId('launcher-milestone')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('launcher-milestone')).toContainText(/a full week/i)
  })

  test('milestone overlay auto-dismisses and persists lastMilestoneShown', async ({ page }) => {
    await page.addInitScript((today) => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 3, longest: 3, lastActiveDate: today, lastMilestoneShown: 0 },
        days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
      }))
    }, TODAY)
    await page.goto('/')
    await expect(page.getByTestId('launcher-milestone')).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(3_000) // auto-dismiss + state persist
    await expect(page.getByTestId('launcher-milestone')).not.toBeVisible()
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('funworldmap-daily-history')
      return raw ? (JSON.parse(raw) as { streak: { lastMilestoneShown: number } }).streak.lastMilestoneShown : null
    })
    expect(stored).toBe(3)
  })
})
```

- [ ] **Step 2: Register in playwright.config.ts**

Add `'daily-streak.spec.ts'` to the `chromium` project's `testMatch` array (pure-DOM tests, no GPU needed).

- [ ] **Step 3: Verify**

```
npx playwright test --list e2e/daily-streak.spec.ts
```
Expected: 4 tests listed.

- [ ] **Step 4: Commit**

```
git add e2e/daily-streak.spec.ts playwright.config.ts
git commit -m "test(e2e): streak pill states + milestone overlay fire/dismiss"
```

---

## Task 15: E2e — launcher-history spec

**Files:**
- Create: `e2e/launcher-history.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { test, expect } from '@playwright/test'

test.setTimeout(120_000)
const TODAY = new Date().toISOString().slice(0, 10)

async function seedDailyAndHistory(page: import('@playwright/test').Page) {
  await page.route('**/daily/index.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        window: { start: TODAY, end: TODAY },
        days: { [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
      }),
    }),
  )
  await page.addInitScript((today) => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
      days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
    }))
  }, TODAY)
}

test.describe('Launcher history panel', () => {
  test('history link opens the panel', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await expect(page.getByTestId('launcher-history-link')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-history-link').click()
    await expect(page.getByTestId('launcher-history')).toBeVisible()
  })

  test('close button closes the panel', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await page.getByTestId('launcher-history-link').click()
    await page.getByTestId('launcher-history-close').click()
    await expect(page.getByTestId('launcher-history')).not.toBeVisible()
  })

  test('Escape closes the panel first, then the launcher', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await page.getByTestId('launcher-history-link').click()
    await expect(page.getByTestId('launcher-history')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher-history')).not.toBeVisible()
    await expect(page.getByTestId('launcher')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })

  test('clicking today cell navigates to reveal', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await page.getByTestId('launcher-history-link').click()
    await page.getByTestId(`launcher-cal-${TODAY}`).click()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toBe(`#daily/${TODAY}/reveal`)
  })

  test('rolled-off cell is inert', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await page.getByTestId('launcher-history-link').click()
    // The first cell in the grid is Monday of 5 weeks ago — definitely rolled-off.
    const rolledOff = page.getByTestId('launcher-history').locator('[data-status="rolled-off"]').first()
    await expect(rolledOff).toHaveAttribute('disabled', '')
  })
})
```

- [ ] **Step 2: Register in playwright.config.ts**

Add `'launcher-history.spec.ts'` to chromium's `testMatch`.

- [ ] **Step 3: Commit**

```
git add e2e/launcher-history.spec.ts playwright.config.ts
git commit -m "test(e2e): history panel open/close, Escape, cell navigation, rolled-off"
```

---

## Task 16: E2e — daily-reveal spec

**Files:**
- Create: `e2e/daily-reveal.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { test, expect } from '@playwright/test'

test.setTimeout(120_000)
const TODAY = new Date().toISOString().slice(0, 10)

async function stubDaily(page: import('@playwright/test').Page) {
  await page.route('**/daily/index.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        window: { start: TODAY, end: TODAY },
        days: { [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
      }),
    }),
  )
}

test.describe('Daily reveal', () => {
  test('/#daily/<today>/reveal shows both modes reveal', async ({ page }) => {
    await stubDaily(page)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('daily-reveal-country')).toBeVisible()
    await expect(page.getByTestId('daily-reveal-city')).toBeVisible()
  })

  test('/#daily/<today>/country-pinning/reveal shows only country', async ({ page }) => {
    await stubDaily(page)
    await page.goto(`/#daily/${TODAY}/country-pinning/reveal`)
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('daily-reveal-country')).toBeVisible()
    await expect(page.getByTestId('daily-reveal-city')).not.toBeVisible()
  })

  test('stored attempts render as emoji strip', async ({ page }) => {
    await stubDaily(page)
    await page.addInitScript((today) => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
        days: {
          [today]: {
            'country-pinning': {
              score: 100,
              attempts: [
                { pointsEarned: 40, distanceKm: 800, guessCca3: 'ESP' },
                { pointsEarned: 70, distanceKm: 500, guessCca3: 'DEU' },
                { pointsEarned: 100, distanceKm: 0, guessCca3: 'FRA' },
              ],
              completedAt: 1,
            },
          },
        },
      }))
    }, TODAY)
    await page.goto(`/#daily/${TODAY}/country-pinning/reveal`)
    await expect(page.getByTestId('daily-reveal-country')).toContainText(/100\/100/)
  })

  test('close button clears the hash', async ({ page }) => {
    await stubDaily(page)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await page.getByTestId('daily-reveal-close').click()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toBe('')
  })

  test('unavailable puzzle shows fallback message', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto(`/#daily/${TODAY}/reveal`)
    await expect(page.getByTestId('daily-reveal-unavailable')).toBeVisible({ timeout: 10_000 })
  })
})
```

- [ ] **Step 2: Register in playwright.config.ts**

Add `'daily-reveal.spec.ts'` to chromium's `testMatch`.

- [ ] **Step 3: Commit**

```
git add e2e/daily-reveal.spec.ts playwright.config.ts
git commit -m "test(e2e): daily-reveal — both modes, single mode, stored attempts, close, unavailable"
```

---

## Task 17: Roadmap tick + final validation

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Update the Retention v1.1+ note**

Find the existing `> Phase 2 (daily play end-to-end) has landed. ...` line in `docs/roadmap.md` and replace with:

```markdown
> Phases 2 (daily play end-to-end) and 3 (streak + calendar + reveal) have landed. Share and polish remain for Phases 4–5.
```

- [ ] **Step 2: Full validation**

```
npx tsc -b && npm run lint && npm run test:unit && npm run build
```
Expected: all green.

- [ ] **Step 3: Commit**

```
git add docs/roadmap.md
git commit -m "docs(roadmap): note Phase 3 landing"
```

---

## Completion checklist

Before opening the PR:

- [ ] All unit tests pass (`npm run test:unit`).
- [ ] Type check clean (`tsc -b`).
- [ ] Lint clean (`npm run lint`) — pre-existing `city-guessing/index.tsx` warning is OK.
- [ ] Build clean (`npm run build`).
- [ ] `daily-streak.spec.ts`, `launcher-history.spec.ts`, `daily-reveal.spec.ts` all registered in `playwright.config.ts` and listable.
- [ ] Manual: seed localStorage with `streak.current: 5` → launcher shows `5-day streak 🔥` + `Past 30 days →` link.
- [ ] Manual: click `Past 30 days →` → calendar panel slides in; grid shows 35 cells; today has teal ring; played day has one teal dot.
- [ ] Manual: Escape closes panel first, then launcher.
- [ ] Manual: seed streak `current: 7, lastMilestoneShown: 3` → milestone overlay renders on launcher mount; auto-dismisses after 2.5 s; `lastMilestoneShown` persists to 7.
- [ ] Manual: click played card's "See reveal" → hash becomes `/#daily/<today>/country-pinning/reveal`; reveal overlay mounts; shows target + attempts.
- [ ] Manual: visit `/#daily/<past>/country-pinning` → redirects to `/#daily/<past>/country-pinning/reveal` (no game-start).

---

## What Phase 4+ picks up

Phase 4 — share flow. `DailyShareBlock` inside `GameOverOverlay`; `shareText.ts` pure function; `navigator.share` + clipboard fallback; `#daily/<date>` (no mode) launcher-anchored route is already live from Phase 2's `isDailyRoot`. Share copy includes the 3-attempt emoji strip per mode, which uses the `attempts` array Phase 2 already persists.

Phase 5 — polish + launch. Axe audit on the new surfaces (streak pill, history panel, milestone overlay, reveal overlay). Reduced-motion verification. Documentation updates beyond the roadmap tick. Pre-launch checklist: ≥ 14 days baseline analytics; CF Worker verifying event writes. Launch.
