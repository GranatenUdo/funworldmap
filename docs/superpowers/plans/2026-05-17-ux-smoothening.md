# UX Smoothening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the design in `docs/superpowers/specs/2026-05-17-ux-smoothening-design.md` as two sequential PRs. PR1 rewrites launcher copy, restructures the launcher composition, adds a tomorrow-countdown, and softens the daily-mode game-over screen. PR2 changes the first-load posture so the map is the homepage and today's puzzle becomes a stateful header CTA.

**Architecture:** All changes are React + TypeScript edits to existing files plus four new files (countdown hook, countdown component, two new e2e specs). No new dependencies. UI vocabulary changes from "free" to "unlimited" while analytics event names stay (backwards-compat). The `useLauncherVisibility` hook changes a single boolean rule.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Playwright (e2e), Vitest + jsdom (unit/component), prettier on pre-commit.

---

## File Structure

### New files (PR1)

- `src/hooks/useNextDailyCountdown.ts` — hook computing `{ hours, minutes }` until local midnight; ticks every 60s
- `src/hooks/__tests__/useNextDailyCountdown.test.ts` — clock-mocked unit tests
- `src/components/LauncherCountdown.tsx` — presentational countdown line ("Next puzzle in 4h 23m")

### Modified (PR1)

- `src/lib/analytics.ts` — declare `header_cta_clicked` in `EventSchema`
- `src/game/daily/useDailyPuzzles.ts` — extract fetch into callable `refetch`; export it
- `src/game/daily/DailyPuzzlesProvider.tsx` — propagate `refetch` through context (no other changes; provider is a thin wrapper)
- `src/components/Launcher.tsx` — add `initialHistoryOpen` prop; new subtitle copy; replace bottom dismiss link with `×` close button; insert shared unlimited link routed via `readLastMode()`; mount `LauncherCountdown`
- `src/components/LauncherModeCard.tsx` — title rename, subtitle line, eyebrow removal, primary CTA split, played-state CTA restructure, stats-footer removal, per-card unlimited-link removal, retry-button addition
- `src/components/LauncherStreakPill.tsx` — copy rewrite for 'broken' and 'first' branches
- `src/game/shared/hud/FirstSessionTutorial.tsx` — daily-mode title rename
- `src/App.tsx` — hint-toast copy
- `src/game/shared/hud/GameOverOverlay.tsx` — daily-mode title + subtitle override

### Modified (PR2)

- `src/hooks/useLauncherVisibility.ts` — bare hash returns `visible: false`
- `src/hooks/__tests__/useLauncherVisibility.test.tsx` — update for new rule
- `src/components/Header.tsx` — replace icon `▶` button with stateful `[▶ Play today •]` pill; add streak chip; mobile combined pill; wire `header_cta_clicked`
- `src/App.tsx` — pass `initialHistoryOpen` through `showLauncher` → `Launcher`
- `src/hooks/useLauncherVisibility.ts` — extend `show()` to accept `{ historyOpen?: boolean }` option (or add a separate state setter)
- `e2e/helpers.ts` — rename `dismissLauncher` → `ensureLauncherDismissed`; add `openLauncher`
- `e2e/launcher.spec.ts` — rewrite for the new posture (no modal on bare `/`)
- `e2e/header-cta.spec.ts` _(new)_ — covers the three pill states

### Component-test surface

- `src/components/__tests__/LauncherModeCard.test.tsx` already exists — extend with new copy and retry-button assertions.
- `src/components/__tests__/LauncherCountdown.test.tsx` _(new, PR1)_ — small (the unit logic lives in the hook).
- `src/hooks/__tests__/useLauncherVisibility.test.tsx` exists — update.

---

# PR1 — Launcher + journey copy

## Phase 1: Foundations (isolated, no UX change)

### Task 1.1: Declare `header_cta_clicked` event and extend `launcher_dismissed.path`

**Files:**

- Modify: `src/lib/analytics.ts:3–23`

- [ ] **Step 1: Add the event declaration and the new `'close'` path value**

Edit `src/lib/analytics.ts`:

1. Change `launcher_dismissed` to add `'close'` to the path enum:

```ts
launcher_dismissed: {
  path: 'link' | 'search' | 'escape' | 'card' | 'backdrop' | 'close'
}
```

2. Append a new entry inside `EventSchema` (after `launcher_dismissed`):

```ts
// alias: "unlimited" in UI vocabulary; event name kept for analytics
// backwards-compat with cloudflare-worker/queries/*.sql
header_cta_clicked: {
  state: 'unplayed' | 'partial' | 'done'
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat(analytics): declare header_cta_clicked event"
```

---

### Task 1.2: Add `refetch` to `useDailyPuzzles`

**Files:**

- Modify: `src/game/daily/useDailyPuzzles.ts`

- [ ] **Step 1: Write a failing test asserting refetch is exposed**

Create `src/game/daily/__tests__/useDailyPuzzles.refetch.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDailyPuzzles } from '../useDailyPuzzles'

describe('useDailyPuzzles refetch', () => {
  beforeEach(() => {
    const fetchMock = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        version: 1,
        window: { start: '2026-05-17', end: '2026-05-17' },
        days: { '2026-05-17': { country: { cca3: 'FRA' }, city: { id: 'paris' } } },
      }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reverts to ready after refetch succeeds following a failure', async () => {
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })
})
```

- [ ] **Step 2: Run the test — expect a TypeScript error (`refetch` doesn't exist)**

Run: `npm run test -- src/game/daily/__tests__/useDailyPuzzles.refetch.test.ts`
Expected: FAIL (compile or runtime; `result.current.refetch` is undefined).

- [ ] **Step 3: Implement refetch**

Replace the body of `src/game/daily/useDailyPuzzles.ts` with:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyIndex, DailyPuzzleRef } from './types'

export type DailyPuzzlesStatus = 'loading' | 'ready' | 'unavailable'

export interface UseDailyPuzzles {
  status: DailyPuzzlesStatus
  index: DailyIndex | null
  byDate: (date: string) => DailyPuzzleRef | null
  refetch: () => Promise<void>
}

export function useDailyPuzzles(): UseDailyPuzzles {
  const [status, setStatus] = useState<DailyPuzzlesStatus>('loading')
  const [index, setIndex] = useState<DailyIndex | null>(null)
  const cancelRef = useRef<{ cancelled: boolean } | null>(null)

  const doFetch = useCallback(async (): Promise<void> => {
    // Cancel any in-flight fetch so its setState doesn't race with a fresh one.
    if (cancelRef.current) cancelRef.current.cancelled = true
    const token = { cancelled: false }
    cancelRef.current = token
    setStatus('loading')
    try {
      const r = await fetch('/daily/index.json', { cache: 'default' })
      if (!r.ok) throw new Error(`http ${r.status}`)
      const json = (await r.json()) as DailyIndex
      if (token.cancelled) return
      setIndex(json)
      setStatus('ready')
    } catch {
      if (token.cancelled) return
      setStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    void doFetch()
    return () => {
      if (cancelRef.current) cancelRef.current.cancelled = true
    }
  }, [doFetch])

  const byDate = useCallback(
    (date: string): DailyPuzzleRef | null => {
      if (!index) return null
      if (date < index.window.start || date > index.window.end) return null
      return index.days[date] ?? null
    },
    [index],
  )

  return { status, index, byDate, refetch: doFetch }
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npm run test -- src/game/daily/__tests__/useDailyPuzzles.refetch.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full unit suite — verify no regressions**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/daily/useDailyPuzzles.ts src/game/daily/__tests__/useDailyPuzzles.refetch.test.ts
git commit -m "feat(daily): expose refetch from useDailyPuzzles"
```

---

### Task 1.3: Add `initialHistoryOpen` prop to `Launcher`

**Files:**

- Modify: `src/components/Launcher.tsx:18–23, 47`

- [ ] **Step 1: Add the prop with default `false`**

In `src/components/Launcher.tsx`, change the `Props` interface:

```ts
interface Props {
  onDismiss: () => void
  anchorDate: string | null
  countries: CountryLike[]
  cities: CityLike[]
  initialHistoryOpen?: boolean
}
```

And the function signature + initial state:

```ts
export function Launcher({ onDismiss, anchorDate, countries, cities, initialHistoryOpen = false }: Props) {
```

Then replace the existing `useState(false)` for `historyOpen`:

```ts
const [historyOpen, setHistoryOpen] = useState(initialHistoryOpen)
```

- [ ] **Step 2: Typecheck + run launcher-related unit tests**

Run: `npm run typecheck && npm run test -- src/components/__tests__/LauncherHistoryPanel.test.tsx`
Expected: passes (the prop is optional, no caller changes required).

- [ ] **Step 3: Commit**

```bash
git add src/components/Launcher.tsx
git commit -m "feat(launcher): add initialHistoryOpen prop (unused by callers)"
```

---

### Task 1.4: Create `useNextDailyCountdown` hook

**Files:**

- Create: `src/hooks/useNextDailyCountdown.ts`
- Create: `src/hooks/__tests__/useNextDailyCountdown.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/__tests__/useNextDailyCountdown.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNextDailyCountdown } from '../useNextDailyCountdown'

describe('useNextDailyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Fix the clock to 2026-05-17T20:37:00 local time
    vi.setSystemTime(new Date(2026, 4, 17, 20, 37, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns hours and minutes until next local midnight', () => {
    const { result } = renderHook(() => useNextDailyCountdown())
    expect(result.current).toEqual({ hours: 3, minutes: 23 })
  })

  it('updates after 60 seconds tick', () => {
    const { result } = renderHook(() => useNextDailyCountdown())
    expect(result.current.minutes).toBe(23)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.minutes).toBe(22)
  })

  it('returns {hours: 24, minutes: 0} when called exactly at midnight (rollover boundary)', () => {
    vi.setSystemTime(new Date(2026, 4, 18, 0, 0, 0))
    const { result } = renderHook(() => useNextDailyCountdown())
    expect(result.current).toEqual({ hours: 24, minutes: 0 })
  })
})
```

- [ ] **Step 2: Run tests — expect compile failure (no such hook)**

Run: `npm run test -- src/hooks/__tests__/useNextDailyCountdown.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useNextDailyCountdown.ts`:

```ts
import { useEffect, useState } from 'react'

export interface NextDailyCountdown {
  hours: number
  minutes: number
}

function compute(now: Date): NextDailyCountdown {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
  const diffMs = next.getTime() - now.getTime()
  const totalMinutes = Math.floor(diffMs / 60_000)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

export function useNextDailyCountdown(): NextDailyCountdown {
  const [value, setValue] = useState<NextDailyCountdown>(() => compute(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setValue(compute(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return value
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm run test -- src/hooks/__tests__/useNextDailyCountdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNextDailyCountdown.ts src/hooks/__tests__/useNextDailyCountdown.test.ts
git commit -m "feat(daily): add useNextDailyCountdown hook"
```

---

## Phase 2: Copy pass (§A)

### Task 2.1: Streak pill copy ('broken' and 'first')

**Files:**

- Modify: `src/components/LauncherStreakPill.tsx:25–30`

- [ ] **Step 1: Find or add a component test for the streak pill**

Check whether `src/components/__tests__/LauncherStreakPill.test.tsx` exists.

Run: `ls src/components/__tests__/ | grep -i streakpill`
If it doesn't exist, create `src/components/__tests__/LauncherStreakPill.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { LauncherStreakPill } from '../LauncherStreakPill'

describe('LauncherStreakPill', () => {
  const noop = () => {}

  it('shows the broken-state copy', () => {
    render(
      <LauncherStreakPill
        current={0}
        longest={5}
        totalDays={5}
        streakMode="broken"
        onOpenHistory={noop}
      />,
    )
    expect(screen.getByText(/Your streak's reset/i)).toBeInTheDocument()
  })

  it('shows the first-state copy', () => {
    render(
      <LauncherStreakPill
        current={0}
        longest={0}
        totalDays={0}
        streakMode="first"
        onOpenHistory={noop}
      />,
    )
    expect(screen.getByText(/You haven't played today yet/i)).toBeInTheDocument()
  })

  it('still shows active streak unchanged', () => {
    render(
      <LauncherStreakPill
        current={5}
        longest={5}
        totalDays={5}
        streakMode="active"
        onOpenHistory={noop}
      />,
    )
    expect(screen.getByText(/5-day streak/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (current copy doesn't match)**

Run: `npm run test -- src/components/__tests__/LauncherStreakPill.test.tsx`
Expected: FAIL on the two new copy assertions.

- [ ] **Step 3: Update copy**

Edit `src/components/LauncherStreakPill.tsx`. Replace the 'broken' and 'first' branches:

```tsx
{
  streakMode === 'broken' && <span>Your streak’s reset — back in with today’s puzzle?</span>
}
{
  streakMode === 'first' && <span>You haven't played today yet — start a streak?</span>
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- src/components/__tests__/LauncherStreakPill.test.tsx`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherStreakPill.tsx src/components/__tests__/LauncherStreakPill.test.tsx
git commit -m "feat(launcher): rewrite streak pill empty-state copy"
```

---

### Task 2.2: Hint toast copy

**Files:**

- Modify: `src/App.tsx:401`

- [ ] **Step 1: Find any test asserting the current hint copy**

Run: `npm run test -- -t "Explore the world"`
If a test exists, note its file. If not, this is a copy-only change with no test surface yet.

- [ ] **Step 2: Update copy**

Edit `src/App.tsx`, line 401 area, change:

```tsx
        >Explore the world</div>
```

to:

```tsx
        >Click a country to explore — or press / to search</div>
```

- [ ] **Step 3: Run full unit suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(hint): rewrite map-load hint toast"
```

---

### Task 2.3: Tutorial daily-mode title

**Files:**

- Modify: `src/game/shared/hud/FirstSessionTutorial.tsx:11–22`

- [ ] **Step 1: Update both daily variants**

Edit `src/game/shared/hud/FirstSessionTutorial.tsx`. Change:

```ts
  'country-pinning-daily': {
    title: 'Today’s puzzle',
    body: 'You have 3 attempts. Your highest-scoring guess wins. Press Done when you’re happy with your best so far.',
  },
```

and

```ts
  'city-guessing-daily': {
    title: 'Today’s puzzle',
    body: 'You have 3 attempts to pin the city. Your closest guess wins. Press Done when you’re happy with your best so far.',
  },
```

(Use the typographic apostrophe `'` as the rest of the file does.)

- [ ] **Step 2: Run any existing tutorial tests**

Run: `npm run test -- FirstSessionTutorial`
Expected: PASS (or no tests exist; check via `ls src/game/shared/hud/__tests__/`).

- [ ] **Step 3: Commit**

```bash
git add src/game/shared/hud/FirstSessionTutorial.tsx
git commit -m "feat(tutorial): rename daily-mode title from 'Daily — best of 3'"
```

---

### Task 2.4: Mode card titles + subtitles

**Files:**

- Modify: `src/components/LauncherModeCard.tsx:28–31, 76–79`

- [ ] **Step 1: Write a failing test in `LauncherModeCard.test.tsx`**

Edit `src/components/__tests__/LauncherModeCard.test.tsx` and add a test case:

```tsx
it('shows the country title with subtitle copy', () => {
  render(<LauncherModeCard {...defaultProps} modeId="country-pinning" />)
  expect(screen.getByText('Country')).toBeInTheDocument()
  expect(screen.getByText(/Click the right country on the map/)).toBeInTheDocument()
})

it('shows the city title with subtitle copy', () => {
  render(<LauncherModeCard {...defaultProps} modeId="city-guessing" />)
  expect(screen.getByText('City')).toBeInTheDocument()
  expect(screen.getByText(/Pin where the city is/)).toBeInTheDocument()
})
```

(If `defaultProps` doesn't exist in the test file, extract one from existing tests in the same file. See existing test shape at `src/components/__tests__/LauncherModeCard.test.tsx`.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherModeCard`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Update title constants and add subtitle**

In `src/components/LauncherModeCard.tsx`:

Replace the `TITLE` object:

```ts
const TITLE: Record<ModeId, string> = {
  'country-pinning': 'Country',
  'city-guessing': 'City',
}

const SUBTITLE: Record<ModeId, string> = {
  'country-pinning': 'Click the right country on the map',
  'city-guessing': 'Pin where the city is',
}
```

In the JSX block where the title renders (around line 76), add the subtitle after the title:

```tsx
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
          <div className="text-xs text-sand-600 dark:text-dark-100 mt-0.5">
            {SUBTITLE[modeId]}
          </div>
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- LauncherModeCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "feat(launcher): rename mode titles + add subtitles"
```

---

### Task 2.5: Drop the eyebrow label

**Files:**

- Modify: `src/components/LauncherModeCard.tsx:33–38, 70–75`

- [ ] **Step 1: Write a failing test**

Add to `src/components/__tests__/LauncherModeCard.test.tsx`:

```tsx
it('does not render the eyebrow label for today', () => {
  render(
    <LauncherModeCard
      {...defaultProps}
      modeId="country-pinning"
      anchorDate={undefined}
      todayDate="2026-05-17"
    />,
  )
  expect(screen.queryByText('TODAY · COUNTRY')).not.toBeInTheDocument()
  expect(screen.queryByText('TODAY · CITY')).not.toBeInTheDocument()
})

it('renders the eyebrow as the bare date for past days', () => {
  render(
    <LauncherModeCard
      {...defaultProps}
      modeId="country-pinning"
      anchorDate="2026-05-16"
      todayDate="2026-05-17"
    />,
  )
  expect(screen.getByText(/MAY 16/)).toBeInTheDocument()
  expect(screen.queryByText(/COUNTRY/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherModeCard`
Expected: FAIL.

- [ ] **Step 3: Rewrite `headerLabel` and the eyebrow JSX**

In `src/components/LauncherModeCard.tsx`, replace `headerLabel`:

```ts
function headerLabel(anchorDate: string | undefined, today: string): string | null {
  const isToday = !anchorDate || anchorDate === today
  if (isToday) return null
  const md = parseLocalDate(anchorDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return md.toUpperCase()
}
```

In the JSX (around line 73–75), wrap the eyebrow div in a conditional:

```tsx
        <div className="min-w-0 flex-1">
          {headerLabel(anchorDate, todayDate) && (
            <div className="text-[10px] font-semibold uppercase tracking-widest text-teal dark:text-teal-light">
              {headerLabel(anchorDate, todayDate)}
            </div>
          )}
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
          …
```

Update the call site if the signature changed (it did — `modeId` removed from `headerLabel`). Search for other `headerLabel(` calls in the file and update.

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- LauncherModeCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "feat(launcher): drop eyebrow for today, keep bare date for past days"
```

---

### Task 2.6: Primary CTA split (Play + caption)

**Files:**

- Modify: `src/components/LauncherModeCard.tsx:82–91`

- [ ] **Step 1: Write a failing test**

Add to `src/components/__tests__/LauncherModeCard.test.tsx`:

```tsx
it('renders the Play button with caption', () => {
  render(<LauncherModeCard {...defaultProps} state="unplayed" />)
  const btn = screen.getByTestId('launcher-card-country-pinning-daily-cta')
  expect(btn).toHaveTextContent('Play')
  expect(btn).not.toHaveTextContent('3 attempts')
  expect(screen.getByText('3 tries · best one counts')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherModeCard`
Expected: FAIL.

- [ ] **Step 3: Restructure the unplayed branch**

In `src/components/LauncherModeCard.tsx`, replace the `state === 'unplayed'` block (around line 82):

```tsx
{
  state === 'unplayed' && (
    <>
      <button
        type="button"
        onClick={onStartDaily}
        data-testid={`${testIdBase}-daily-cta`}
        className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
      >
        Play
      </button>
      <div className="text-xs text-sand-600 dark:text-dark-100 mt-1.5 text-center">
        3 tries · best one counts
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- LauncherModeCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "feat(launcher): split CTA into Play button + tries caption"
```

---

### Task 2.7: Error state — copy + Retry button

**Files:**

- Modify: `src/components/LauncherModeCard.tsx:128–132, 56–58`
- Modify: `src/components/Launcher.tsx` — thread refetch through to card

- [ ] **Step 1: Write a failing test**

Add to `src/components/__tests__/LauncherModeCard.test.tsx`:

```tsx
it('renders Retry button in unavailable-error state', () => {
  const onRetry = vi.fn()
  render(<LauncherModeCard {...defaultProps} state="unavailable-error" onRetry={onRetry} />)
  expect(screen.getByText('Couldn’t load today’s puzzle.')).toBeInTheDocument()
  expect(screen.queryByText(/Refresh to retry/)).not.toBeInTheDocument()
  const btn = screen.getByTestId('launcher-card-country-pinning-retry')
  btn.click()
  expect(onRetry).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherModeCard`
Expected: FAIL.

- [ ] **Step 3: Add `onRetry` to Props and render the button**

In `src/components/LauncherModeCard.tsx`, add to the `Props` interface (around line 53):

```ts
  onRetry?: () => void
```

Destructure in the function signature, then replace the error block:

```tsx
{
  state === 'unavailable-error' && (
    <div data-testid={`${testIdBase}-error`}>
      <div className="text-sand-600 dark:text-dark-100 text-sm mb-3">
        Couldn’t load today’s puzzle.
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          data-testid={`${testIdBase}-retry`}
          className="px-3 py-1.5 rounded-lg bg-teal text-white text-sm font-medium hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Retry
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Thread `refetch` through `Launcher`**

In `src/components/Launcher.tsx`, near the `useDailyPuzzlesContext()` destructure (line 45):

```tsx
const { status: puzzlesStatus, byDate, index, refetch } = useDailyPuzzlesContext()
```

Then in the `LauncherModeCard` JSX (around line 324–335), pass `onRetry={refetch}`:

```tsx
                <LauncherModeCard
                  modeId={m.id}
                  …
                  onRetry={refetch}
                />
```

- [ ] **Step 5: Run — expect PASS**

Run: `npm run test -- LauncherModeCard`
Expected: PASS.

Run: `npm run test`
Expected: PASS (full suite).

- [ ] **Step 6: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/Launcher.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "feat(launcher): add Retry button to unavailable-error state"
```

---

## Phase 3: Launcher composition (§B + §D)

### Task 3.1: Launcher subtitle copy

**Files:**

- Modify: `src/components/Launcher.tsx:300–306`

- [ ] **Step 1: Determine today's formatted date helper**

Confirm `parseLocalDate` exists in `src/game/daily/dates.ts` and `toLocaleDateString('en-US', ...)` is used elsewhere (e.g., `LauncherModeCard.tsx:37`).

- [ ] **Step 2: Replace subtitle copy**

In `src/components/Launcher.tsx`, change lines around 300–306. Compute a formatted "today" once near the existing `today` declaration:

```tsx
const todayFormatted = todayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
```

(Inserting after `const todayDate = new Date()` on line ~52.)

Then change the subtitle JSX:

```tsx
<p className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2" data-testid="launcher-subtitle">
  {anchorDate ? `Daily · ${anchorDate}` : `Today’s puzzle · ${todayFormatted}`}
</p>
```

- [ ] **Step 3: Run full unit suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Launcher.tsx
git commit -m "feat(launcher): rewrite subtitle as 'Today's puzzle · <date>'"
```

---

### Task 3.2: Add `×` close button; remove bottom dismiss link

**Files:**

- Modify: `src/components/Launcher.tsx:347–360`
- Modify: `e2e/helpers.ts:239` — note the test-id change

- [ ] **Step 1: Add a dismiss callback for the close button**

In `src/components/Launcher.tsx`, add a new callback alongside `dismissWithFocus` (around line 141):

```tsx
const dismissWithCloseButton = useCallback(() => {
  track('launcher_dismissed', { path: 'close' })
  onDismiss()
  focusSearchInput()
}, [onDismiss])
```

(`'close'` is the new path value declared in Task 1.1.)

- [ ] **Step 2: Add the close button to the launcher panel**

In `src/components/Launcher.tsx`, locate the outer `<div className="relative w-full max-w-2xl mx-auto">` (around line 291). Add a close button as the first child inside that div, before the text-center heading:

```tsx
        <div className="relative w-full max-w-2xl mx-auto">
          <button
            type="button"
            onClick={dismissWithCloseButton}
            data-testid="launcher-close"
            aria-label="Close"
            className="absolute -top-2 right-0 w-9 h-9 rounded-full text-sand-50 dark:text-dark-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 flex items-center justify-center"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
```

- [ ] **Step 3: Remove the bottom "Just explore the map" link**

Delete the entire block from `<div className="mt-6 text-center" …>` through its closing `</div>` (around lines 348–360). This is the block containing `data-testid="launcher-dismiss"`.

- [ ] **Step 4: Update the e2e helper to click the new test-id**

In `e2e/helpers.ts`, change `dismissLauncher` body (around line 239):

```ts
await page.getByTestId('launcher-close').click()
```

(Leave the rest of `dismissLauncher` unchanged. We rename the helper itself in PR2.)

- [ ] **Step 5: Run launcher unit tests + a few launcher e2e tests**

Run: `npm run test -- Launcher`
Expected: PASS.

Run: `npm run test:e2e -- e2e/launcher.spec.ts --project=chromium`
Expected: PASS. If a test asserts the old `launcher-dismiss` test-id directly, find and fix in the same commit; do not skip.

- [ ] **Step 6: Commit**

```bash
git add src/components/Launcher.tsx e2e/helpers.ts
git commit -m "feat(launcher): replace bottom dismiss link with × close button (path: 'close')"
```

---

### Task 3.3: Drop the per-card unlimited link

**Files:**

- Modify: `src/components/LauncherModeCard.tsx:151–158`

- [ ] **Step 1: Write a failing test asserting the per-card link is gone**

Add to `src/components/__tests__/LauncherModeCard.test.tsx`:

```tsx
it('no longer renders the per-card free-mode link', () => {
  render(<LauncherModeCard {...defaultProps} state="unplayed" />)
  expect(screen.queryByTestId('launcher-card-country-pinning-free-link')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherModeCard`
Expected: FAIL.

- [ ] **Step 3: Delete the per-card unlimited link**

In `src/components/LauncherModeCard.tsx`, delete the block:

```tsx
      <button
        type="button"
        onClick={onStartFree}
        data-testid={`${testIdBase}-free-link`}
        …
      >
        Play free mode →
      </button>
```

Keep `onStartFree` in the Props for now (still used by the parent — Task 3.4 routes it).

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- LauncherModeCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "feat(launcher): remove per-card unlimited link"
```

---

### Task 3.4: Add shared "Play unlimited rounds →" link in `Launcher`

**Files:**

- Modify: `src/components/Launcher.tsx` (between the cards grid and the history panel)

- [ ] **Step 1: Add the shared link**

In `src/components/Launcher.tsx`, after the `.grid` block that maps over `modes` (closing tag of the grid div around line 338), insert:

```tsx
<div className="mt-4 text-center">
  <button
    type="button"
    onClick={() => startFree(lastMode ?? 'country-pinning')}
    data-testid="launcher-unlimited-link"
    className="text-[13px] text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-2 py-1"
  >
    Play unlimited rounds →
  </button>
</div>
```

`lastMode` is already declared at line 42 (`const lastMode = readLastMode()`); `startFree` is the existing callback at line 163.

- [ ] **Step 2: Write a smoke test**

Add to `src/components/__tests__/LauncherModeCard.test.tsx` or a sibling Launcher integration test (whichever fits):

```tsx
it('renders one shared unlimited link in the launcher', async () => {
  // import { Launcher } and necessary providers at top of file
  // …
  render(<Launcher onDismiss={vi.fn()} anchorDate={null} countries={countries} cities={cities} />, {
    wrapper: Providers,
  })
  const link = await screen.findByTestId('launcher-unlimited-link')
  expect(link).toHaveTextContent('Play unlimited rounds')
})
```

If no Launcher integration test scaffold exists, defer the assertion to e2e in PR2; skip this step but still complete Step 1.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/Launcher.tsx
git commit -m "feat(launcher): add shared 'Play unlimited rounds →' link"
```

---

### Task 3.5: Remove the per-card "Best (free)" stats footer (§D folds in)

**Files:**

- Modify: `src/components/LauncherModeCard.tsx:160–167`
- Modify: `src/components/LauncherModeCard.tsx` Props — make `freeBest` optional or remove

- [ ] **Step 1: Write a failing test**

Add to `src/components/__tests__/LauncherModeCard.test.tsx`:

```tsx
it('does not render the Best (free) footer', () => {
  render(<LauncherModeCard {...defaultProps} state="unplayed" />)
  expect(screen.queryByText(/Best \(free\)/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Unlimited best/i)).not.toBeInTheDocument()
  expect(screen.queryByTestId('launcher-card-country-pinning-free-best')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherModeCard`
Expected: FAIL.

- [ ] **Step 3: Delete the footer block**

In `src/components/LauncherModeCard.tsx`, delete:

```tsx
<div className="mt-4 pt-3 border-t border-sand-200/70 dark:border-dark-200/30 text-[11px] text-sand-600 dark:text-dark-100">
  <span className="uppercase tracking-wider text-teal dark:text-teal-light font-medium">
    Best (free)
  </span>{' '}
  <span data-testid={`${testIdBase}-free-best`} className="tabular-nums">
    {freeBest.gamesPlayed > 0
      ? isCountryPinning(modeId)
        ? `${freeBest.bestScore} pts`
        : `${freeBest.bestScore} / 1000`
      : isCountryPinning(modeId)
        ? '— pts'
        : '— / 1000'}
  </span>
</div>
```

Then remove the `freeBest` prop from `Props` and from the function signature destructure. Drop the unused `isCountryPinning` import if no remaining references exist in the file.

In `src/components/Launcher.tsx`, remove the `freeBest={bestFor(m.id)}` prop on `LauncherModeCard`. Remove `usePersonalBests` usage and the `cpBest`/`cgBest`/`bestFor` declarations (lines 9, 43–44, 82) — they are now dead.

**Note:** keep `isCountryPinning` imported in `LauncherModeCard.tsx` — Task 3.6 (played-state CTA) re-uses it. If your IDE auto-removes it after this task, the unit tests in 3.6 will catch the missing import.

- [ ] **Step 4: Run typecheck + unit suite**

Run: `npm run typecheck && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/Launcher.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "feat(launcher): remove per-card unlimited-best footer + dead deps"
```

---

### Task 3.6: Played-state CTA — full-width `✓ score · See reveal →` button

**Files:**

- Modify: `src/components/LauncherModeCard.tsx:104–120`

- [ ] **Step 1: Write a failing test**

Add to `src/components/__tests__/LauncherModeCard.test.tsx`:

```tsx
it('renders played state as a single full-width See reveal button with score', () => {
  render(
    <LauncherModeCard
      {...defaultProps}
      state="played"
      played={{ targetName: 'France', score: 87 }}
      onSeeReveal={vi.fn()}
    />,
  )
  const btn = screen.getByTestId('launcher-card-country-pinning-see-reveal')
  expect(btn).toHaveTextContent(/✓\s*87\s*\/\s*100\s*·\s*See reveal/i)
  // The old "✓ France · 87/100" text line should be gone (consolidated into the button)
  expect(screen.queryByText(/France · 87/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherModeCard`
Expected: FAIL.

- [ ] **Step 3: Restructure the played branch**

In `src/components/LauncherModeCard.tsx`, replace the `state === 'played'` block:

```tsx
{
  state === 'played' && (
    <div data-testid={`${testIdBase}-played-result`}>
      {onSeeReveal && (
        <button
          type="button"
          onClick={onSeeReveal}
          data-testid={`${testIdBase}-see-reveal`}
          className="w-full px-4 py-2 rounded-xl bg-emerald-500/90 text-white font-semibold hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          ✓ {played?.score ?? 0}
          {isCountryPinning(modeId) ? '/100' : '/1000'} · See reveal →
        </button>
      )}
    </div>
  )
}
```

`isCountryPinning` should still be imported (Task 3.5 noted to keep it). If somehow removed, re-import from `'../game/shared/modePredicates'`.

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- LauncherModeCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "feat(launcher): consolidate played state into single See reveal button"
```

---

## Phase 4: Countdown (§E)

### Task 4.1: Create `LauncherCountdown` component

**Files:**

- Create: `src/components/LauncherCountdown.tsx`
- Create: `src/components/__tests__/LauncherCountdown.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/LauncherCountdown.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { LauncherCountdown } from '../LauncherCountdown'

describe('LauncherCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 17, 20, 37, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('renders the all-played message and the countdown', () => {
    render(<LauncherCountdown />)
    expect(screen.getByText(/All played today/i)).toBeInTheDocument()
    expect(screen.getByText(/Next puzzle in 3h 23m/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- LauncherCountdown`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `src/components/LauncherCountdown.tsx`:

```tsx
import { useNextDailyCountdown } from '../hooks/useNextDailyCountdown'

export function LauncherCountdown() {
  const { hours, minutes } = useNextDailyCountdown()
  return (
    <div
      data-testid="launcher-countdown"
      className="mt-3 text-center text-[12px] text-sand-50/90 dark:text-dark-100"
    >
      <span>✓ All played today</span>
      <span aria-hidden="true"> · </span>
      <span className="tabular-nums">
        Next puzzle in {hours}h {minutes}m
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- LauncherCountdown`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherCountdown.tsx src/components/__tests__/LauncherCountdown.test.tsx
git commit -m "feat(launcher): add LauncherCountdown component"
```

---

### Task 4.2: Mount countdown in `Launcher` when both modes are played

**Files:**

- Modify: `src/components/Launcher.tsx`

- [ ] **Step 1: Import and conditionally render the countdown**

In `src/components/Launcher.tsx`, import:

```tsx
import { LauncherCountdown } from './LauncherCountdown'
```

Compute the both-played flag near where `cardState` is defined (around line 71):

```tsx
const bothPlayed = modes.every((m) => cardState(m.id) === 'played')
```

Render the countdown in the JSX after the cards grid and before the history panel (around line 339):

```tsx
{
  bothPlayed && <LauncherCountdown />
}
```

- [ ] **Step 2: Typecheck + run launcher tests**

Run: `npm run typecheck && npm run test -- Launcher`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Launcher.tsx
git commit -m "feat(launcher): show countdown when both modes are played"
```

---

## Phase 5: Daily-mode game-over copy (§G)

### Task 5.1: Soften the daily-mode title and subtitle

**Files:**

- Modify: `src/game/shared/hud/GameOverOverlay.tsx:66–72`
- Modify: `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx:24–35` (existing test breaks; rewrite)

- [ ] **Step 1: Update the existing breaking test and add new daily-mode coverage**

Open `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`. The current test at line 24:

```tsx
it('says "1 round complete." when maxRounds is 1', () => {
  render(
    <GameOverOverlay
      session={{ ...baseSession, maxRounds: 1, dailyDate: '2026-04-27' }}
      …
    />,
  )
  expect(screen.getByText('1 round complete.')).toBeTruthy()
})
```

…uses a **daily** session (note `dailyDate: '2026-04-27'`) but asserts the subtitle string that §G removes for daily mode. Replace this test with:

```tsx
it('hides the subtitle on daily mode (was "1 round complete.")', () => {
  render(
    <GameOverOverlay
      session={{ ...baseSession, maxRounds: 1, dailyDate: '2026-04-27' }}
      personalBest={zeroBest}
      beatPersonalBest={false}
      onPlayAgain={() => {}}
      onBackToMap={() => {}}
    />,
  )
  expect(screen.queryByText(/1 round complete/)).toBeNull()
})

it('shows "Today’s results" as the title on daily mode', () => {
  render(
    <GameOverOverlay
      session={{ ...baseSession, maxRounds: 1, dailyDate: '2026-04-27' }}
      personalBest={zeroBest}
      beatPersonalBest={false}
      onPlayAgain={() => {}}
      onBackToMap={() => {}}
    />,
  )
  expect(screen.getByTestId('game-over-title')).toHaveTextContent('Today’s results')
})

it('still says "Game over" on unlimited mode', () => {
  render(
    <GameOverOverlay
      session={{ ...baseSession, maxRounds: 10, attemptsPerRound: 1, dailyDate: null }}
      personalBest={zeroBest}
      beatPersonalBest={false}
      onPlayAgain={() => {}}
      onBackToMap={() => {}}
    />,
  )
  expect(screen.getByTestId('game-over-title')).toHaveTextContent('Game over')
  expect(screen.getByText('10 rounds complete.')).toBeTruthy()
})
```

(The "10 rounds complete." test at line 37 already passes — leave it untouched. The existing `baseSession` and `zeroBest` are imported at lines 7 and 16 of the test file.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- GameOverOverlay`
Expected: FAIL on the new daily-mode title assertion.

- [ ] **Step 3: Implement the branch**

In `src/game/shared/hud/GameOverOverlay.tsx`, change the title and subtitle block (around lines 66–72):

```tsx
;<h2
  id="game-over-title"
  data-testid="game-over-title"
  className="text-xl font-bold text-sand-900 dark:text-dark-50 mb-1"
>
  {isDaily ? 'Today’s results' : 'Game over'}
</h2>
{
  !isDaily && (
    <p className="text-sm text-sand-600 dark:text-dark-100 mb-4">{describeGameEnd(session)}</p>
  )
}
```

(`isDaily` is already computed at line 29.) Ensure `data-testid="game-over-title"` is present on the `<h2>` (it's not in current code — the existing `id="game-over-title"` doesn't act as a test selector).

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test -- GameOverOverlay`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/shared/hud/GameOverOverlay.tsx src/game/shared/hud/__tests__/GameOverOverlay.test.tsx
git commit -m "feat(game-over): soften daily-mode title to 'Today’s results'"
```

---

## Phase 6: PR1 final checks

### Task 6.1: Full unit + component suite

- [ ] **Step 1:** Run `npm run test`. Expect: PASS.
- [ ] **Step 2:** Run `npm run typecheck`. Expect: PASS.
- [ ] **Step 3:** Run `npm run lint`. Expect: PASS.

### Task 6.2: Targeted e2e smoke

- [ ] **Step 1:** Run `npm run test:e2e -- e2e/launcher.spec.ts e2e/daily.spec.ts --project=chromium`. Expect: PASS. If any test fails because of the test-id change from `launcher-dismiss` to `launcher-close`, update the test to use the new ID — do not add retries or quarantines.
- [ ] **Step 2:** Run `npm run test:e2e -- --project=chromium-gpu`. Expect: PASS.

### Task 6.3: Manual smoke (browser)

- [ ] **Step 1:** Run `npm run dev` and open `http://localhost:5173/`.
- [ ] **Step 2:** Verify the launcher appears with: new subtitle ("Today’s puzzle · May 17"), two cards (Country / City) with subtitles, single `Play unlimited rounds →` link below cards, `×` close button top-right, no "Best (free)" footer, no per-card `Play free mode →` link.
- [ ] **Step 3:** Click `Play` on Country, finish the daily (3 attempts or click `Done`). Reach game-over. Verify title reads "Today’s results" with no subtitle.
- [ ] **Step 4:** Back to launcher, click `Play` on City, finish. Both played → verify the `✓ All played today · Next puzzle in Xh Ym` line appears under the cards.
- [ ] **Step 5:** Open devtools, throttle network to Offline, refresh, observe `unavailable-error` state showing copy + Retry button. Restore network, click Retry. Expect cards to repopulate.

### Task 6.4: Open PR1

- [ ] **Step 1:** Push branch and open PR:

```bash
git push -u origin <branch>
gh pr create --title "UX smoothening (PR1): launcher copy + composition + countdown + daily game-over" --body "$(cat <<'EOF'
Implements PR1 of docs/superpowers/specs/2026-05-17-ux-smoothening-design.md.

## Summary
- Rewrites launcher copy and mode-card structure
- Adds shared 'Play unlimited rounds →' link routed via `readLastMode`
- Adds × close button; removes bottom dismiss link
- Adds Retry button for daily-fetch failures
- Adds tomorrow-countdown when both modes are played
- Softens daily-mode game-over to 'Today’s results'

PR2 (first-load posture: map-first + header CTA) is held until PR1 merges so its funnel impact can be measured against PR1 as a baseline.

## Test plan
- [ ] `npm run test` green
- [ ] `npm run test:e2e -- --project=chromium --project=chromium-gpu` green
- [ ] Manual smoke per Task 6.3
EOF
)"
```

---

# PR2 — First-load posture

## Phase 7: Launcher visibility rule change (§C)

### Task 7.1: Update `useLauncherVisibility` test

**Files:**

- Modify: `src/hooks/__tests__/useLauncherVisibility.test.tsx`

- [ ] **Step 1: Update the expectation for bare hash**

Open `src/hooks/__tests__/useLauncherVisibility.test.tsx` and find the test that asserts `visible === true` for bare hash. Change the expectation to `false`:

```tsx
it('returns visible=false for bare hash (map-first)', () => {
  history.replaceState(null, '', '/')
  const { result } = renderHook(() => useLauncherVisibility(), { wrapper })
  expect(result.current.visible).toBe(false)
})

it('still returns visible=true for #daily/YYYY-MM-DD', () => {
  history.replaceState(null, '', '/#daily/2026-05-17')
  const { result } = renderHook(() => useLauncherVisibility(), { wrapper })
  expect(result.current.visible).toBe(true)
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -- useLauncherVisibility`
Expected: FAIL (bare hash currently returns `true`).

### Task 7.2: Change the rule

**Files:**

- Modify: `src/hooks/useLauncherVisibility.ts:45–48`

- [ ] **Step 1: Rewrite the `visible` computation**

In `src/hooks/useLauncherVisibility.ts`, replace lines 45–48:

```ts
const visible = isDailyRoot(currentHash) && !dismissed && session.status === 'idle'
```

Note the `isBareRoot` branch is gone. `isBareRoot` itself can be removed if no other callers — search first:

Run: `npm run grep -r "isBareRoot"` (or use Grep tool)
If no other callers, remove the function declaration.

- [ ] **Step 2: Run — expect PASS**

Run: `npm run test -- useLauncherVisibility`
Expected: PASS.

- [ ] **Step 3: Run full unit suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLauncherVisibility.ts src/hooks/__tests__/useLauncherVisibility.test.tsx
git commit -m "feat(launcher): bare hash no longer auto-opens launcher"
```

---

## Phase 8: Header CTA (§C)

### Task 8.1: Compute header CTA state in `App.tsx`

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Derive the state**

In `src/App.tsx`, near where `gameActive` is computed, add:

```tsx
const today = toLocalDateString(new Date())
const { history: dailyHistory, streak } = useDailyHistory()
const todayEntry = dailyHistory.days[today] ?? {}
const countryPlayed = !!todayEntry['country-pinning']
const cityPlayed = !!todayEntry['city-guessing']
const ctaState: 'unplayed' | 'partial' | 'done' =
  countryPlayed && cityPlayed ? 'done' : countryPlayed || cityPlayed ? 'partial' : 'unplayed'
```

Import `useDailyHistory` from `'./game/daily/useDailyHistory'` if not already imported.

- [ ] **Step 2: Pass `ctaState` and `streak` to `Header`**

Update the `<Header>` JSX:

```tsx
<Header
  countries={countries}
  theme={theme}
  satellite={satellite}
  comparePickingMode={comparePickingMode}
  gameActive={gameActive}
  launcherVisible={launcherVisible}
  ctaState={ctaState}
  streakCurrent={streak.current}
  streakActive={streak.lastActiveDate !== null && streak.lastActiveDate >= today}
  onSelect={onMapSelect}
  onThemeCycle={cycle}
  onSatelliteToggle={toggleSatellite}
  onOpenLauncher={openLauncher}
  onOpenLauncherHistory={openLauncherHistory}
  onLauncherDismiss={onLauncherDismissFromSearch}
/>
```

Add a new callback alongside `openLauncher`:

```tsx
const openLauncherHistory = useCallback(() => {
  showLauncher({ historyOpen: true })
}, [showLauncher])
```

`showLauncher` is the existing function from `useLauncherVisibility`. Task 8.5 extends its signature.

- [ ] **Step 3: Typecheck — expect TS errors in Header**

Run: `npm run typecheck`
Expected: FAIL (Header doesn't accept the new props yet — fixed in Task 8.2).

(Do not commit until 8.2 lands; this is the start of a multi-task feature.)

### Task 8.2: Header pill UI (3 states)

**Files:**

- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Update the Props interface**

```ts
interface Props {
  countries: CountryData[]
  theme: Theme
  satellite: boolean
  comparePickingMode: boolean
  gameActive: boolean
  launcherVisible: boolean
  ctaState: 'unplayed' | 'partial' | 'done'
  streakCurrent: number
  streakActive: boolean
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
  onSatelliteToggle: () => void
  onOpenLauncher: () => void
  onOpenLauncherHistory: () => void
  onLauncherDismiss: () => void
}
```

- [ ] **Step 2: Replace the icon-only play button with the stateful pill**

Replace the existing `<button … aria-label="Play a game" …>` (lines 57–66) with:

```tsx
{
  !gameActive && (
    <button
      onClick={() => {
        track('header_cta_clicked', { state: ctaState })
        onOpenLauncher()
      }}
      aria-label={
        ctaState === 'done'
          ? 'Today’s puzzle complete'
          : ctaState === 'partial'
            ? 'Play today (1 mode remaining)'
            : 'Play today'
      }
      data-testid="header-play"
      data-state={ctaState}
      className={`h-10 px-3 rounded-xl backdrop-blur-sm border flex items-center gap-2 font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
        ctaState === 'done'
          ? 'bg-sand-100/60 dark:bg-dark-400/60 border-sand-300/40 dark:border-dark-200/30 text-sand-700 dark:text-dark-100'
          : 'bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-teal dark:text-teal-light hover:bg-sand-200/90 dark:hover:bg-dark-300/80'
      }`}
    >
      {ctaState === 'done' ? (
        <>
          <span aria-hidden="true">✓</span>
          <span className="hidden sm:inline">Today done</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="hidden sm:inline">Play today</span>
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full ${
              ctaState === 'partial' ? 'border-2 border-teal bg-transparent' : 'bg-teal'
            }`}
          />
        </>
      )}
    </button>
  )
}
```

Import `track` from `'../lib/analytics'` at the top of the file.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (assuming Task 8.1 props now match).

### Task 8.3: Streak chip + mobile combined behaviour

**Files:**

- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add a streak chip beside the play pill on desktop**

In `Header.tsx`, immediately before the play-pill `{!gameActive && (` block, add:

```tsx
{
  !gameActive && streakActive && streakCurrent > 0 && (
    <button
      type="button"
      onClick={onOpenLauncherHistory}
      aria-label={`Streak ${streakCurrent} days — open history`}
      data-testid="header-streak-chip"
      className="hidden sm:flex h-10 px-2.5 rounded-xl backdrop-blur-sm border bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-sm tabular-nums items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
    >
      <span aria-hidden="true">🔥</span>
      <span className="font-semibold text-teal dark:text-teal-light">{streakCurrent}</span>
    </button>
  )
}
```

- [ ] **Step 2: On mobile, integrate streak into the play pill**

Inside the play-pill JSX (Task 8.2), add a mobile-only streak prefix as the first child of the unplayed/partial branches:

```tsx
{
  streakActive && streakCurrent > 0 && (
    <span className="sm:hidden flex items-center gap-1 mr-1 text-teal dark:text-teal-light tabular-nums">
      <span aria-hidden="true">🔥</span>
      <span className="font-semibold">{streakCurrent}</span>
    </span>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Task 8.4: Plumb `initialHistoryOpen` through `useLauncherVisibility`

**Files:**

- Modify: `src/hooks/useLauncherVisibility.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update the hook signature**

In `src/hooks/useLauncherVisibility.ts`, change the `show` callback to accept an optional argument and track the open intent:

```ts
export interface LauncherVisibility {
  visible: boolean
  anchorDate: string | null
  initialHistoryOpen: boolean
  dismiss: () => void
  show: (opts?: { historyOpen?: boolean }) => void
}

export function useLauncherVisibility(): LauncherVisibility {
  …existing state…
  const [initialHistoryOpen, setInitialHistoryOpen] = useState(false)

  const dismiss = useCallback(() => {
    setDismissed(true)
    setInitialHistoryOpen(false)
  }, [])
  const show = useCallback((opts?: { historyOpen?: boolean }) => {
    setInitialHistoryOpen(!!opts?.historyOpen)
    setDismissed(false)
  }, [])
  …
  return { visible, anchorDate, initialHistoryOpen, dismiss, show }
}
```

- [ ] **Step 2: Pass through `App.tsx`**

In `src/App.tsx`, destructure the new field:

```tsx
const {
  visible: launcherVisible,
  anchorDate,
  initialHistoryOpen,
  dismiss: dismissLauncher,
  show: showLauncher,
} = useLauncherVisibility()
```

And pass to `<Launcher>`:

```tsx
{
  launcherVisible && (
    <Launcher
      onDismiss={dismissLauncher}
      anchorDate={anchorDate}
      countries={pool}
      cities={cities}
      initialHistoryOpen={initialHistoryOpen}
    />
  )
}
```

- [ ] **Step 3: Add a test for the new `show({ historyOpen: true })` signature**

In `src/hooks/__tests__/useLauncherVisibility.test.tsx`, add:

```tsx
it('show({ historyOpen: true }) sets initialHistoryOpen', () => {
  history.replaceState(null, '', '/')
  const { result } = renderHook(() => useLauncherVisibility(), { wrapper })
  expect(result.current.initialHistoryOpen).toBe(false)
  act(() => {
    result.current.show({ historyOpen: true })
  })
  expect(result.current.initialHistoryOpen).toBe(true)
})

it('show() with no args leaves initialHistoryOpen false', () => {
  history.replaceState(null, '', '/')
  const { result } = renderHook(() => useLauncherVisibility(), { wrapper })
  act(() => {
    result.current.show()
  })
  expect(result.current.initialHistoryOpen).toBe(false)
})

it('dismiss() resets initialHistoryOpen to false', () => {
  history.replaceState(null, '', '/')
  const { result } = renderHook(() => useLauncherVisibility(), { wrapper })
  act(() => {
    result.current.show({ historyOpen: true })
  })
  act(() => {
    result.current.dismiss()
  })
  expect(result.current.initialHistoryOpen).toBe(false)
})
```

(Imports `act` and `renderHook` from `'@testing-library/react'` if not already imported in the file. The existing test file already imports `vitest` test helpers — extend the same import list as needed.)

- [ ] **Step 4: Run typecheck + the visibility-hook tests**

Run: `npm run typecheck && npm run test -- useLauncherVisibility`
Expected: PASS.

### Task 8.5: Commit Phase-8 work as one feature commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/App.tsx src/components/Header.tsx src/hooks/useLauncherVisibility.ts
git commit -m "feat(header): stateful Play-today pill + streak chip + history-deep-link"
```

(All of Phase 8's changes are co-dependent; committing them together avoids broken intermediate states.)

---

## Phase 9: e2e helper + spec updates (§F)

### Task 9.1: Rename `dismissLauncher` → `ensureLauncherDismissed`

**Files:**

- Modify: `e2e/helpers.ts:232–245`
- Modify: every caller (`e2e/*.spec.ts`)

- [ ] **Step 1: Rename in the helpers file**

In `e2e/helpers.ts`:

```ts
export async function ensureLauncherDismissed(page: Page): Promise<void> {
  await waitForAppReady(page)
  const launcher = page.getByTestId('launcher')
  if (!(await launcher.isVisible())) {
    return
  }
  await page.getByTestId('launcher-close').click()
  await expect(launcher).not.toBeAttached({ timeout: 5_000 })
  await page.locator('#search-input').waitFor({ state: 'attached', timeout: 5_000 })
}
```

- [ ] **Step 2: Sweep all call sites**

Run: `grep -r "dismissLauncher" e2e/` (use the Grep tool with `path` set to `e2e/`)

For every result, edit the call site to use the new name.

- [ ] **Step 3: Add `openLauncher` helper**

Append to `e2e/helpers.ts`:

```ts
export async function openLauncher(page: Page): Promise<void> {
  await waitForAppReady(page)
  await page.getByTestId('header-play').click()
  await page.getByTestId('launcher').waitFor({ state: 'visible', timeout: 5_000 })
}
```

- [ ] **Step 4: Run e2e smoke**

Run: `npm run test:e2e -- e2e/launcher.spec.ts --project=chromium`
Expected: PASS (some tests may need follow-up updates — fix them in Task 9.2).

### Task 9.2: Audit `e2e/launcher.spec.ts` for the new posture

**Files:**

- Modify: `e2e/launcher.spec.ts`

- [ ] **Step 1: Read the file**

Open `e2e/launcher.spec.ts` and identify tests that:

- assume bare `/` shows the launcher
- call `dismissLauncher`
- assert the modal exists immediately after `goto('/')`

- [ ] **Step 2: Rewrite each affected test**

Tests that need the launcher must now call `openLauncher(page)` after `goto('/')`. Tests that asserted dismissal flow should target the new `[data-testid="launcher-close"]` button and re-anchor on the header pill.

Add new assertions:

```ts
test('bare / shows the map, no launcher', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await expect(page.getByTestId('launcher')).not.toBeAttached()
})

test('clicking header-play opens the launcher', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await page.getByTestId('header-play').click()
  await expect(page.getByTestId('launcher')).toBeVisible()
})

test('deep link #daily/YYYY-MM-DD still opens the launcher', async ({ page }) => {
  await stubDailyIndex(page, '2026-05-17')
  await gotoAndWaitForMap(page, '/#daily/2026-05-17')
  await expect(page.getByTestId('launcher')).toBeVisible()
})

test('× button closes the launcher', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await openLauncher(page)
  await page.getByTestId('launcher-close').click()
  await expect(page.getByTestId('launcher')).not.toBeAttached()
})
```

- [ ] **Step 3: Run the suite**

Run: `npm run test:e2e -- e2e/launcher.spec.ts --project=chromium`
Expected: PASS.

### Task 9.3: Add `e2e/header-cta.spec.ts`

**Files:**

- Create: `e2e/header-cta.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, seedDailyHistory, stubDailyIndex } from './helpers'

test.describe('header CTA states', () => {
  test('unplayed state — solid dot, label "Play today"', async ({ page }) => {
    await stubDailyIndex(page, '2026-05-17')
    await gotoAndWaitForMap(page, '/')
    const pill = page.getByTestId('header-play')
    await expect(pill).toHaveAttribute('data-state', 'unplayed')
    await expect(pill).toContainText('Play today')
  })

  test('partial state — one mode played', async ({ page }) => {
    await stubDailyIndex(page, '2026-05-17')
    await seedDailyHistory(page, { date: '2026-05-17', modes: ['country-pinning'] })
    await gotoAndWaitForMap(page, '/')
    await expect(page.getByTestId('header-play')).toHaveAttribute('data-state', 'partial')
  })

  test('done state — both modes played', async ({ page }) => {
    await stubDailyIndex(page, '2026-05-17')
    await seedDailyHistory(page, {
      date: '2026-05-17',
      modes: ['country-pinning', 'city-guessing'],
    })
    await gotoAndWaitForMap(page, '/')
    const pill = page.getByTestId('header-play')
    await expect(pill).toHaveAttribute('data-state', 'done')
    await expect(pill).toContainText('Today done')
  })
})
```

- [ ] **Step 2: Run the new spec**

Run: `npm run test:e2e -- e2e/header-cta.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 3: Commit Phase 9**

```bash
git add e2e/helpers.ts e2e/launcher.spec.ts e2e/header-cta.spec.ts
git commit -m "test(e2e): rename helper, add header-cta spec, rewrite launcher spec for map-first"
```

---

## Phase 10: PR2 final checks

### Task 10.1: Full test suite + manual smoke

- [ ] **Step 1:** `npm run typecheck` — PASS.
- [ ] **Step 2:** `npm run test` — PASS.
- [ ] **Step 3:** `npm run test:e2e -- --project=chromium --project=chromium-gpu --project=mobile-chromium --project=mobile-webkit` — PASS. No `test.fixme` additions.

### Task 10.2: Manual smoke

- [ ] **Step 1:** Run `npm run dev`. Open `http://localhost:5173/`.
- [ ] **Step 2:** Verify the map renders with NO launcher modal. The hint toast reads "Click a country to explore — or press / to search".
- [ ] **Step 3:** Verify the header shows `▶ Play today` with a solid dot (no streak yet).
- [ ] **Step 4:** Click the play pill → launcher opens.
- [ ] **Step 5:** Play and complete the Country daily. Close the game-over screen. Verify the play pill becomes `▶ Play today` with an outline dot (partial).
- [ ] **Step 6:** Complete the City daily too. Verify the pill becomes `✓ Today done` (muted).
- [ ] **Step 7:** Force a positive streak (e.g., seed `funworldmap-daily-history` via devtools console). Verify the `🔥 5` streak chip appears beside the pill on desktop, integrates into the pill on mobile.
- [ ] **Step 8:** Click the streak chip → launcher opens with history panel pre-expanded.
- [ ] **Step 9:** Navigate to `/#daily/2026-05-17`. Verify the launcher opens anchored on that date.
- [ ] **Step 10:** Navigate to `/`. Verify map only, no modal.

### Task 10.3: Open PR2

- [ ] **Step 1:** Push branch + open PR:

```bash
git push -u origin <branch>
gh pr create --title "UX smoothening (PR2): map-first first-load + header CTA" --body "$(cat <<'EOF'
Implements PR2 of docs/superpowers/specs/2026-05-17-ux-smoothening-design.md.

## Summary
- Bare `/` no longer auto-opens the launcher (`useLauncherVisibility` rule change)
- Header CTA becomes a stateful `[▶ Play today •]` pill (unplayed / partial / done)
- Streak chip beside pill on desktop, integrated on mobile
- Streak chip click opens launcher with history pre-expanded
- New `header_cta_clicked` analytics event for funnel comparison
- `dismissLauncher` → `ensureLauncherDismissed` rename + `openLauncher` helper
- `e2e/launcher.spec.ts` rewritten for new posture; new `e2e/header-cta.spec.ts`

## Funnel risk
Removing the on-load modal may lower `daily_started` per visit. Watch the 7-day delta:
- New funnel: `header_cta_clicked → launcher_opened → daily_started`
- Old funnel: `launcher_auto_opened → daily_started` (baseline before merge)

If funnel regresses materially, revert with `git revert` — PR2 is contained and self-revertible.

## Test plan
- [ ] `npm run test` green
- [ ] `npm run test:e2e -- --project=chromium --project=chromium-gpu --project=mobile-chromium --project=mobile-webkit` green
- [ ] Manual smoke per Task 10.2
EOF
)"
```

---

## Spec coverage self-check

| Spec section                                     | Covered by                                      |
| ------------------------------------------------ | ----------------------------------------------- |
| §A naming/copy pass                              | Tasks 2.1–2.7, 3.1, 5.1                         |
| §B launcher composition                          | Tasks 3.2–3.6, 4.2                              |
| §C first-load posture                            | Tasks 7.1–7.2, 8.1–8.5                          |
| §D denominator fix                               | Folded into Task 3.5 + 3.6                      |
| §E countdown                                     | Tasks 4.1–4.2                                   |
| §G daily game-over                               | Task 5.1                                        |
| §F e2e updates                                   | Tasks 9.1–9.3                                   |
| Foundations (refetch, hook, event, prop)         | Tasks 1.1–1.4                                   |
| Goal: returning visitor → map                    | Task 7.2                                        |
| Goal: today reachable in one click               | Tasks 8.1–8.3                                   |
| Goal: no "free" in confusing context             | Tasks 2.4, 3.3, 3.4 (UI vocab only)             |
| Goal: consistent denominators                    | Task 3.5 (removal eliminates the inconsistency) |
| Goal: daily journey doesn't end with "Game over" | Task 5.1                                        |
| Goal: no test.fixme quarantines                  | Required throughout Phase 9–10                  |
