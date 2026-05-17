# UX Smoothening Phase 2 — PR1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement PR1a of `docs/superpowers/specs/2026-05-17-ux-smoothening-phase-2-design.md` — launcher composition reduction (B1), history panel polish (B3), persistent `/` keyboard hint (C1), and satellite-toggle icon clarity (C2). Defers B2 (stats view) and Phase 2 PR2 items.

**Architecture:** All changes are React + TypeScript edits to existing components plus one new presentational component (`LauncherRetentionNudge`). No new hooks, no new routes, no analytics changes. The launcher's `LauncherStreakPill` splits into two pieces: a streak chip (active state only, rendered in launcher header) and a retention nudge (broken/first states, rendered as a caption between cards and footer). History calendar gains responsive day-of-week headers + per-cell `title` tooltips computed from `useDailyPuzzlesContext` + the played history. Search bar gains a small `kbd`-styled `/` hint visible when input is unfocused and empty. Satellite toggle gains two-state SVG glyphs + a `title` attribute reflecting the click action.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest + jsdom, Playwright (e2e).

---

## File Structure

### New files

- `src/components/LauncherRetentionNudge.tsx` — small caption rendering Phase 1's broken/first-state copy. Pure render, no state.
- `src/components/__tests__/LauncherRetentionNudge.test.tsx` — unit tests.

### Modified files

- `src/components/Launcher.tsx` — restructure header row (date + streak chip), demote `LauncherStreakPill` (removed entirely or repurposed), add `LauncherRetentionNudge` between cards and footer, consolidate footer links into one row.
- `src/components/LauncherStreakPill.tsx` — **delete** (its three jobs split into: chip in `Launcher.tsx` header, nudge in new component, history link in footer row).
- `src/components/__tests__/LauncherStreakPill.test.tsx` — **delete** (component gone; equivalent tests live in `LauncherRetentionNudge.test.tsx` + integration in launcher).
- `src/components/LauncherHistoryPanel.tsx` — responsive day-of-week headers; thread per-cell memory data into cells.
- `src/components/LauncherCalendarCell.tsx` — render `title` attribute with memory info (country/city name + score) for played cells.
- `src/components/SearchBar.tsx` — add `kbd`-styled `/` badge visible when empty + unfocused.
- `src/components/Header.tsx` — replace striped-globe SVG with two-state glyphs; add `title` attribute.
- E2E specs: `e2e/launcher.spec.ts` (focus order + streak chip location), `e2e/launcher-history.spec.ts` (memory tooltip), `e2e/search.spec.ts` (kbd badge visibility), `e2e/satellite-default.spec.ts` (title attribute).

---

# Phase 1: Retention nudge extraction (B1 foundation)

### Task 1.1: Create `LauncherRetentionNudge` component with TDD

**Files:**

- Create: `src/components/LauncherRetentionNudge.tsx`
- Create: `src/components/__tests__/LauncherRetentionNudge.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/LauncherRetentionNudge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherRetentionNudge } from '../LauncherRetentionNudge'

describe('LauncherRetentionNudge', () => {
  it('renders the broken-state copy', () => {
    render(<LauncherRetentionNudge streakMode="broken" />)
    expect(screen.getByText(/Your streak.s reset/i)).toBeTruthy()
  })

  it('renders the first-state copy', () => {
    render(<LauncherRetentionNudge streakMode="first" />)
    expect(screen.getByText(/You haven.t played today yet/i)).toBeTruthy()
  })

  it('renders nothing for active streak', () => {
    const { container } = render(<LauncherRetentionNudge streakMode="active" />)
    expect(container.firstChild).toBeNull()
  })
})
```

(`.toBeTruthy()` / `null` checks — this repo doesn't use `@testing-library/jest-dom`.)

- [ ] **Step 2: Run — expect FAIL**

`npm run test:unit -- LauncherRetentionNudge`
Expected: module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/LauncherRetentionNudge.tsx`:

```tsx
import type { StreakMode } from '../game/daily/storage'

interface Props {
  streakMode: StreakMode
}

export function LauncherRetentionNudge({ streakMode }: Props) {
  if (streakMode === 'active') return null
  return (
    <div
      data-testid="launcher-retention-nudge"
      data-streak-mode={streakMode}
      className="mt-3 text-center text-[13px] text-sand-50/90 dark:text-dark-100"
    >
      {streakMode === 'broken' ? (
        <span>Your streak’s reset — back in with today’s puzzle?</span>
      ) : (
        <span>You haven’t played today yet — start a streak?</span>
      )}
    </div>
  )
}
```

Apostrophes are typographic `’` (U+2019). The em dash is `—` (U+2014).

- [ ] **Step 4: Run — expect PASS**

`npm run test:unit -- LauncherRetentionNudge`
Full suite: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherRetentionNudge.tsx src/components/__tests__/LauncherRetentionNudge.test.tsx
git commit -m "feat(launcher): add LauncherRetentionNudge (broken/first state copy)"
```

---

# Phase 2: Launcher composition reduction (B1)

### Task 2.1: Add streak chip to launcher header row

**Files:**

- Modify: `src/components/Launcher.tsx` (the JSX block around lines 329–343 — the centered title/subtitle div)

- [ ] **Step 1: Restructure the title/subtitle block**

Find the existing block:

```tsx
<div
  role="presentation"
  className="text-center mb-6 pointer-events-none"
  style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}
>
  <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
    funworldmap
  </div>
  <p
    className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2"
    data-testid="launcher-subtitle"
  >
    {anchorDate ? `Daily · ${anchorDate}` : `Today’s puzzle · ${todayFormatted}`}
  </p>
</div>
```

Replace with a header row that puts subtitle on the left and the streak chip on the right (when active). The wordmark stays for personality. The whole row stays decorative (`role="presentation"`), but the streak chip itself is interactive (no `pointer-events-none` on it).

```tsx
<div className="mb-6" style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}>
  <div className="text-center pointer-events-none">
    <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
      funworldmap
    </div>
    <p
      className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2"
      data-testid="launcher-subtitle"
    >
      {anchorDate ? `Daily · ${anchorDate}` : `Today’s puzzle · ${todayFormatted}`}
    </p>
  </div>
  {streakMode === 'active' && streak.current > 0 && (
    <div className="absolute top-0 right-12 mt-1" data-testid="launcher-streak-chip">
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal/15 dark:bg-teal-light/15 border border-teal/30 dark:border-teal-light/30 text-xs font-medium text-teal dark:text-teal-light tabular-nums">
        <span aria-hidden="true">🔥</span>
        <span>{streak.current}</span>
      </span>
    </div>
  )}
</div>
```

Note: the chip's `right-12` keeps clear of the `×` close button at `right-0` (the × is a 36-39px button with `-top-2 right-0`). On `<sm`, the chip is still in the corner but stacking with × at narrow viewports may collide — the e2e mobile-tap project will catch any collision.

`streak` is already destructured at the top of the Launcher function from `useDailyHistory()`. `streakMode` is already computed via `deriveStreakMode(streak.lastActiveDate, yesterday)` near the top.

- [ ] **Step 2: Typecheck**

`npm run typecheck`
Expected: clean.

(Tests will catch any rendering regression in step 2.4 below.)

- [ ] **Step 3: Run launcher-related unit tests**

`npm run test:unit -- Launcher`
Expected: pass (the streak chip is purely additive markup; existing launcher tests don't assert on the previous streak-pill location).

- [ ] **Step 4: Commit**

```bash
git add src/components/Launcher.tsx
git commit -m "feat(launcher): move active-streak indicator to header as a chip"
```

---

### Task 2.2: Remove `LauncherStreakPill` and mount retention nudge

**Files:**

- Modify: `src/components/Launcher.tsx` (remove the `<LauncherStreakPill>` block; mount `<LauncherRetentionNudge>` instead between cards and footer)
- Modify: `src/components/Launcher.tsx` imports
- Delete: `src/components/LauncherStreakPill.tsx`
- Delete: `src/components/__tests__/LauncherStreakPill.test.tsx`

- [ ] **Step 1: Remove the existing LauncherStreakPill mount**

In `src/components/Launcher.tsx`, find and DELETE this block (currently around lines 345–353):

```tsx
<div className="mb-4">
  <LauncherStreakPill
    current={streak.current}
    longest={streak.longest}
    totalDays={totalDays}
    streakMode={streakMode}
    onOpenHistory={openHistory}
  />
</div>
```

- [ ] **Step 2: Add the import for `LauncherRetentionNudge`**

In `src/components/Launcher.tsx` near the other `./Launcher*` imports:

```tsx
import { LauncherRetentionNudge } from './LauncherRetentionNudge'
```

Remove the now-unused `LauncherStreakPill` import.

- [ ] **Step 3: Mount the retention nudge between the cards grid and the countdown/footer**

Find the existing block:

```tsx
          {bothPlayed && <LauncherCountdown />}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => startFree(lastMode ?? 'country-pinning')}
              data-testid="launcher-unlimited-link"
              ...
            >
              Play unlimited rounds →
            </button>
          </div>
```

Insert the retention nudge BEFORE the `{bothPlayed && <LauncherCountdown />}` line:

```tsx
          <LauncherRetentionNudge streakMode={streakMode} />

          {bothPlayed && <LauncherCountdown />}

          <div className="mt-4 text-center">
            ...
```

The nudge renders nothing when `streakMode === 'active'`, so this is purely additive for users with broken/first streaks.

- [ ] **Step 4: Move the "Past 30 days →" link to the footer row**

The `LauncherStreakPill` previously contained a `Past 30 days →` button that opened the history panel. We need to relocate it next to the unlimited link. Replace the unlimited-link block:

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

With a two-link row:

```tsx
<div className="mt-4 flex items-center justify-center gap-4 text-[13px]">
  {totalDays > 0 && (
    <button
      type="button"
      onClick={openHistory}
      data-testid="launcher-history-link"
      aria-label={`Open calendar: current ${streak.current} longest ${streak.longest} days played ${totalDays}`}
      className="text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-2 py-1"
    >
      Past 30 days →
    </button>
  )}
  <button
    type="button"
    onClick={() => startFree(lastMode ?? 'country-pinning')}
    data-testid="launcher-unlimited-link"
    className="text-[13px] text-white bg-black/40 underline underline-offset-2 hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-2 py-1"
  >
    Play unlimited rounds →
  </button>
</div>
```

The history link preserves its `aria-label` from the deleted streak pill. The unlimited link keeps its existing WCAG AA contrast classes (white-on-translucent-black with underline) from PR1's a11y fix.

- [ ] **Step 5: Delete the dead component files**

```bash
git rm src/components/LauncherStreakPill.tsx src/components/__tests__/LauncherStreakPill.test.tsx
```

- [ ] **Step 6: Sweep for any remaining `launcher-streak` references**

```bash
grep -rn "LauncherStreakPill\|launcher-streak\b" src/ e2e/
```

Update or delete each hit:

- Imports of `LauncherStreakPill` → already removed via step 2.
- `data-testid="launcher-streak"` in any test → update to `launcher-streak-chip` (the new chip in the header) OR `launcher-retention-nudge` (the new caption) depending on what the test is actually checking. If a test is testing both, split into two assertions.

- [ ] **Step 7: Run typecheck + full unit suite**

```bash
npm run typecheck
npm run test:unit
```

Expected: clean. If a test fails because it referenced the now-deleted `launcher-streak` testid, update it as in step 6.

- [ ] **Step 8: Commit**

```bash
git add src/components/Launcher.tsx
git commit -m "refactor(launcher): split streak pill into header chip + retention nudge"
```

---

# Phase 3: History panel polish (B3)

### Task 3.1: Responsive day-of-week headers in history panel

**Files:**

- Modify: `src/components/LauncherHistoryPanel.tsx`
- Modify (if exists): `src/components/__tests__/LauncherHistoryPanel.test.tsx`

- [ ] **Step 1: Add failing test**

Look for `src/components/__tests__/LauncherHistoryPanel.test.tsx`. If it exists, append:

```tsx
it('renders spelled-out day-of-week headers on desktop and single-letter on mobile', () => {
  const onActivate = vi.fn()
  const onClose = vi.fn()
  // Render at default size (jsdom doesn't simulate viewport breakpoints, so both DOM nodes will exist; assert both are rendered, then test rely on Tailwind's responsive classes)
  render(<LauncherHistoryPanel today="2026-05-17" onClose={onClose} onCellActivate={onActivate} />)
  // Spelled-out (desktop) header row
  expect(screen.getByText('Mon')).toBeTruthy()
  expect(screen.getByText('Tue')).toBeTruthy()
  expect(screen.getByText('Wed')).toBeTruthy()
  // Single-letter (mobile) header row is also in DOM (hidden via responsive utilities, not by JS)
  // assert the count of header-row containers is 2
  const headerRows = screen.getAllByTestId(/dow-row-/)
  expect(headerRows.length).toBe(2)
})
```

If the test file doesn't exist, create it with the necessary imports + describe block + this test.

(The test uses `screen.getAllByTestId` with a regex; `vi.fn()` requires `import { vi } from 'vitest'`.)

- [ ] **Step 2: Run — expect FAIL**

`npm run test:unit -- LauncherHistoryPanel`

- [ ] **Step 3: Replace the day-header row**

In `src/components/LauncherHistoryPanel.tsx`, find the existing block:

```tsx
const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
```

Add a second array beneath it:

```tsx
const DOW_LABELS_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
```

Find the existing day-header JSX:

```tsx
<div
  aria-hidden="true"
  className="grid grid-cols-7 gap-1 mb-1 text-[10px] text-sand-500 dark:text-dark-100 text-center"
>
  {DOW_LABELS.map((l, i) => (
    <span key={i}>{l}</span>
  ))}
</div>
```

Replace with two header rows — one visible on `sm` and up (full), one visible below `sm` (single-letter):

```tsx
      <div
        aria-hidden="true"
        data-testid="dow-row-full"
        className="hidden sm:grid grid-cols-7 gap-1 mb-1 text-[10px] text-sand-500 dark:text-dark-100 text-center"
      >
        {DOW_LABELS_FULL.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div
        aria-hidden="true"
        data-testid="dow-row-mobile"
        className="sm:hidden grid grid-cols-7 gap-1 mb-1 text-[10px] text-sand-500 dark:text-dark-100 text-center"
      >
        {DOW_LABELS.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
```

- [ ] **Step 4: Run — expect PASS**

`npm run test:unit -- LauncherHistoryPanel`

- [ ] **Step 5: Commit**

```bash
git add src/components/LauncherHistoryPanel.tsx src/components/__tests__/LauncherHistoryPanel.test.tsx
git commit -m "feat(launcher-history): spelled-out day headers on desktop, single-letter on mobile"
```

---

### Task 3.2: Compute per-cell memories in `LauncherHistoryPanel`

**Files:**

- Modify: `src/components/LauncherHistoryPanel.tsx`
- Modify: `src/components/LauncherCalendarCell.tsx`

The calendar cell needs to know WHAT was played (country name, city name, scores) for played cells, not just THAT something was played. The panel will compute a `cellMemories: Map<string, CellMemory>` and pass per-cell entries to each cell.

- [ ] **Step 1: Define the memory shape and lookup**

Currently `LauncherHistoryPanel.tsx` receives `today` but pulls history via `useDailyHistory()`. It does not pull puzzle data (country/city for each date). Add the import and lookup.

In `src/components/LauncherHistoryPanel.tsx`, change the `Props` interface to also accept `countries` and `cities` pools (provided by the caller — `Launcher.tsx` already has them):

```tsx
import type { CityLike, CountryLike, ModeId } from '../game/shared/types'
import { useDailyPuzzlesContext } from '../game/daily/DailyPuzzlesProvider'

export interface CellMemory {
  country?: { name: string; score: number }
  city?: { name: string; score: number }
}

interface Props {
  today: string
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
  onCellActivate: (date: string, kind: HistoryCellKind) => void
}
```

In the function body, after the existing `playedByDate` useMemo, add:

```tsx
const { byDate: puzzleByDate } = useDailyPuzzlesContext()

const cellMemories = useMemo(() => {
  const out = new Map<string, CellMemory>()
  for (const [date, entry] of Object.entries(history.days)) {
    const puzzle = puzzleByDate(date)
    const mem: CellMemory = {}
    const cp = entry?.['country-pinning']
    const cg = entry?.['city-guessing']
    if (cp && puzzle) {
      const c = countries.find((x) => x.cca3 === puzzle.country.cca3)
      if (c) mem.country = { name: c.name.common, score: cp.score }
    }
    if (cg && puzzle) {
      const ci = cities.find((x) => x.id === puzzle.city.id)
      if (ci) mem.city = { name: ci.name, score: cg.score }
    }
    if (mem.country || mem.city) out.set(date, mem)
  }
  return out
}, [history.days, puzzleByDate, countries, cities])
```

- [ ] **Step 2: Pass `memory` to each `LauncherCalendarCell`**

In the cells `.map()` callback in the same file, add `memory={cellMemories.get(c.date)}`:

```tsx
{
  cells
    .slice(rowIdx * 7, rowIdx * 7 + 7)
    .map((c) => (
      <LauncherCalendarCell
        key={c.date}
        date={c.date}
        status={c.status}
        playedModes={playedByDate.get(c.date) ?? new Set<ModeId>()}
        memory={cellMemories.get(c.date)}
        onActivate={onActivate}
      />
    ))
}
```

- [ ] **Step 3: Accept and use `memory` in `LauncherCalendarCell`**

In `src/components/LauncherCalendarCell.tsx`, import the type and extend Props:

```tsx
import type { CellMemory } from './LauncherHistoryPanel'

interface Props {
  date: string
  status: CalendarCellStatus
  playedModes: ReadonlySet<ModeId>
  memory?: CellMemory
  onActivate: (date: string) => void
}
```

Add a small helper that formats the tooltip:

```tsx
function memoryTooltip(memory: CellMemory | undefined): string | undefined {
  if (!memory) return undefined
  const parts: string[] = []
  if (memory.country) parts.push(`${memory.country.name} ${memory.country.score}/100`)
  if (memory.city) parts.push(`${memory.city.name} ${memory.city.score}/1000`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
```

In the function signature, destructure `memory`. On the `<button>` element, add a `title` attribute (only when memory is defined):

```tsx
  return (
    <button
      type="button"
      data-testid={testId}
      data-status={status}
      role="gridcell"
      aria-label={ariaLabel(date, status, playedModes)}
      title={memoryTooltip(memory)}
      tabIndex={isInteractive ? 0 : -1}
      disabled={!isInteractive}
      onClick={isInteractive ? () => onActivate(date) : undefined}
      className={className}
    >
      …
```

`title` is undefined when no memory exists; browsers don't render a tooltip for `title={undefined}`.

- [ ] **Step 4: Update the existing `LauncherHistoryPanel` caller in `Launcher.tsx`**

Find where `<LauncherHistoryPanel>` is mounted in `src/components/Launcher.tsx`:

```tsx
{
  historyOpen && (
    <LauncherHistoryPanel today={today} onClose={closeHistory} onCellActivate={onCellActivate} />
  )
}
```

Pass the `countries` and `cities` props through (they're already in `Launcher.tsx`'s props):

```tsx
{
  historyOpen && (
    <LauncherHistoryPanel
      today={today}
      countries={countries}
      cities={cities}
      onClose={closeHistory}
      onCellActivate={onCellActivate}
    />
  )
}
```

- [ ] **Step 5: Add a unit test for the tooltip in `LauncherCalendarCell`**

Look for `src/components/__tests__/LauncherCalendarCell.test.tsx`. If it exists, append a test:

```tsx
it('renders a title tooltip when memory is provided', () => {
  const onActivate = vi.fn()
  const memory: CellMemory = {
    country: { name: 'France', score: 87 },
    city: { name: 'Paris', score: 760 },
  }
  render(
    <LauncherCalendarCell
      date="2026-05-15"
      status="in-window"
      playedModes={new Set(['country-pinning', 'city-guessing'])}
      memory={memory}
      onActivate={onActivate}
    />,
  )
  const btn = screen.getByTestId('launcher-cal-2026-05-15')
  expect(btn.getAttribute('title')).toBe('France 87/100 · Paris 760/1000')
})

it('does not render title when memory is undefined', () => {
  const onActivate = vi.fn()
  render(
    <LauncherCalendarCell
      date="2026-05-15"
      status="in-window"
      playedModes={new Set()}
      memory={undefined}
      onActivate={onActivate}
    />,
  )
  const btn = screen.getByTestId('launcher-cal-2026-05-15')
  expect(btn.getAttribute('title')).toBeNull()
})
```

Imports: `import { vi } from 'vitest'`, `import type { CellMemory } from '../LauncherHistoryPanel'`.

If the test file doesn't exist, create it with the imports + describe block.

- [ ] **Step 6: Run tests**

```bash
npm run typecheck
npm run test:unit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/LauncherHistoryPanel.tsx src/components/LauncherCalendarCell.tsx src/components/Launcher.tsx src/components/__tests__/LauncherCalendarCell.test.tsx
# include LauncherHistoryPanel test if updated
git commit -m "feat(launcher-history): per-cell memory tooltip (country/city name + score)"
```

---

# Phase 4: Persistent `/` keyboard hint in search (C1)

### Task 4.1: Add `kbd`-styled `/` badge to `SearchBar`

**Files:**

- Modify: `src/components/SearchBar.tsx`

- [ ] **Step 1: Add focused state**

In `src/components/SearchBar.tsx`, near the other `useState` hooks, add:

```tsx
const [isFocused, setIsFocused] = useState(false)
```

On the `<input>`, wire `onBlur` and update the existing `onFocus`:

```tsx
onFocus={() => {
  setIsFocused(true)
  if (query.trim()) setIsOpen(true)
}}
onBlur={() => setIsFocused(false)}
```

- [ ] **Step 2: Add the kbd badge**

Inside the existing `<div className="relative flex-1 max-w-md">`, AFTER the `<input>` element and BEFORE the `{query && (<button …clear>)}` block, add:

```tsx
{
  !query && !isFocused && (
    <kbd
      aria-hidden="true"
      data-testid="search-kbd-hint"
      className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-sand-300/60 dark:border-dark-200/40 text-[11px] font-mono text-sand-500 dark:text-dark-100 bg-sand-200/40 dark:bg-dark-300/40 pointer-events-none"
    >
      /
    </kbd>
  )
}
```

Notes:

- `aria-hidden="true"` — screen readers don't need this hint.
- `pointer-events-none` — clicks pass through to the input.
- `hidden sm:inline-flex` — desktop-only; mobile space is too tight.
- Same `right-3` position as the clear-X (`right-2.5`) but the two never coexist (clear-X only renders when `query` is non-empty; the kbd only when `query` is empty).

- [ ] **Step 3: Component test**

Look for `src/components/__tests__/SearchBar.test.tsx`. If it exists, append:

```tsx
it('shows the / kbd hint when input is empty and unfocused', async () => {
  render(<SearchBar countries={[]} onSelect={() => {}} />)
  expect(screen.getByTestId('search-kbd-hint')).toBeTruthy()
})

it('hides the / kbd hint when input is focused', async () => {
  const user = userEvent.setup()
  render(<SearchBar countries={[]} onSelect={() => {}} />)
  await user.click(screen.getByTestId('search-input'))
  expect(screen.queryByTestId('search-kbd-hint')).toBeNull()
})
```

(Imports: `import userEvent from '@testing-library/user-event'`. If `user-event` isn't already in the file's test imports, follow the existing repo pattern — most tests use plain `fireEvent.focus` or `screen.getByTestId(...).focus()` instead. Adapt to whatever the file already does. If `SearchBar.test.tsx` doesn't exist, the e2e test in Task 4.2 below is sufficient coverage — skip the unit test in that case.)

- [ ] **Step 4: Run**

```bash
npm run typecheck
npm run test:unit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx
# include SearchBar.test.tsx if updated
git commit -m "feat(search): show / keyboard hint when search is empty and unfocused"
```

---

### Task 4.2: E2E test for the kbd badge

**Files:**

- Modify: `e2e/search.spec.ts` (or new spec if appropriate)

- [ ] **Step 1: Add an e2e test asserting badge visibility**

Append to `e2e/search.spec.ts`:

```ts
test('shows / keyboard hint when search is empty and not focused', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  // Search bar is in the header (not inside launcher); ensure launcher isn't blocking
  await ensureLauncherDismissed(page)
  const hint = page.getByTestId('search-kbd-hint')
  await expect(hint).toBeVisible()
  await page.getByTestId('search-input').click()
  await expect(hint).not.toBeVisible()
  await page.locator('body').click() // blur
  await expect(hint).toBeVisible()
})
```

Imports at the top of the file should already include `gotoAndWaitForMap` and `ensureLauncherDismissed` from `./helpers`. If not, add them.

- [ ] **Step 2: Run the e2e test for this spec only**

```bash
npm run test:e2e -- e2e/search.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/search.spec.ts
git commit -m "test(e2e): cover the / keyboard hint visibility"
```

---

# Phase 5: Satellite-toggle icon clarity (C2)

### Task 5.1: Two-state satellite icon + title

**Files:**

- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Replace the SVG with two state-specific glyphs and add `title`**

Find the existing satellite toggle button (around line 70 area — search for `aria-pressed={satellite}`):

```tsx
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
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M3.6 9h16.8M3.6 15h16.8"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z"
    />
  </svg>
</button>
```

Replace with two distinct SVGs (a topographic map when satellite is ON, a satellite glyph when satellite is OFF) and add a `title` attribute that mirrors the aria-label (visible on hover):

```tsx
<button
  onClick={onSatelliteToggle}
  aria-label={satellite ? 'Switch to map view' : 'Switch to satellite view'}
  aria-pressed={satellite}
  title={satellite ? 'Switch to map view' : 'Switch to satellite view'}
  className={`w-10 h-10 rounded-xl backdrop-blur-sm border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
    satellite
      ? 'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal dark:text-teal-light'
      : 'bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-sand-500 dark:text-dark-100 hover:bg-sand-200/90 dark:hover:bg-dark-300/80'
  }`}
  data-testid="satellite-toggle"
  data-satellite-active={satellite}
>
  {satellite ? (
    // Satellite mode is ON → show a satellite-dish glyph
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M5 17a8 8 0 0 1 11.31-11.31"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 13a4 4 0 0 1 5.66-5.66"
      />
      <circle cx="12" cy="10" r="1.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M5 17l-2 2M5 17l2 2"
      />
    </svg>
  ) : (
    // Satellite mode is OFF → show a topographic-contour glyph
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 18l5-8 4 5 3-4 6 7"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21h18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 14l5-6 4 4 3-3 6 5"
      />
    </svg>
  )}
</button>
```

The two SVGs are small custom paths — they don't perfectly evoke "satellite" vs "map" in isolation, but the **title-on-hover** + the **aria-pressed state** + the **filled vs unfilled background** together communicate the state clearly enough. Iconography is subjective; if the user dislikes these glyphs, they can be swapped later — the surrounding affordances (title, aria, color state) carry the meaning regardless.

The `data-satellite-active={satellite}` attribute is new — useful for e2e selectors.

- [ ] **Step 2: Run typecheck**

`npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(header): two-state satellite icon + hover title"
```

---

### Task 5.2: E2E test for the satellite toggle title

**Files:**

- Modify: `e2e/satellite-default.spec.ts` (or new `e2e/satellite-toggle.spec.ts`)

- [ ] **Step 1: Add the test**

Append to `e2e/satellite-default.spec.ts`:

```ts
test('satellite toggle button has a click-action title that reflects state', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await ensureLauncherDismissed(page)
  const toggle = page.getByTestId('satellite-toggle')
  // Default state: satellite ON (per src/App.tsx satellite=true initial)
  await expect(toggle).toHaveAttribute('data-satellite-active', 'true')
  await expect(toggle).toHaveAttribute('title', 'Switch to map view')
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-satellite-active', 'false')
  await expect(toggle).toHaveAttribute('title', 'Switch to satellite view')
})
```

- [ ] **Step 2: Run the e2e**

```bash
npm run test:e2e -- e2e/satellite-default.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/satellite-default.spec.ts
git commit -m "test(e2e): cover satellite toggle title attribute"
```

---

# Phase 6: Existing-test fallout from B1

The launcher composition changes in Phase 2 likely break some existing e2e tests (focus order, streak-pill location, etc.). Handle them after the implementation lands and before final smoke.

### Task 6.1: Fix e2e launcher specs for the new composition

**Files:**

- Modify: `e2e/launcher.spec.ts`
- Possibly modify: `e2e/launcher-focus-order.spec.ts`

- [ ] **Step 1: Run targeted e2e to see breakage**

```bash
npm run test:e2e -- e2e/launcher.spec.ts e2e/launcher-focus-order.spec.ts --project=chromium
```

Note the failures. The most likely affected tests:

- "Tab cycles through mode card 1, mode card 2, close button, wraps" — Tab order changed (history link + unlimited link are now in the same row at the bottom; streak chip is in the header on the right).
- Any test asserting on `data-testid="launcher-streak"` — testid is gone (split into `launcher-streak-chip` and `launcher-retention-nudge`).
- Any test asserting on the history-link location next to the streak — link moved to the footer row.

- [ ] **Step 2: Update the Tab-cycle test**

Read the current Tab order in the rendered DOM (the most reliable way is to look at the actual sequence of focusable elements top-to-bottom, left-to-right). Expected new order:

1. `launcher-card-country-pinning-daily-cta` (or `-see-reveal` if played)
2. `launcher-card-city-guessing-daily-cta`
3. `launcher-history-link` (in footer row, if `totalDays > 0`)
4. `launcher-unlimited-link`
5. `launcher-close`
6. wraps back to (1)

Update the test's expected step-by-step focus assertions to match.

- [ ] **Step 3: Update streak-pill testid sweep**

```bash
grep -rn "launcher-streak\b" e2e/
```

For each match:

- If the assertion is about "is the streak visible" → use `launcher-streak-chip`.
- If the assertion is about "is the retention nudge visible (broken/first state)" → use `launcher-retention-nudge`.
- If the test setup seeded history such that the streak was active, the chip test-id is the right one.

- [ ] **Step 4: Re-run e2e**

```bash
npm run test:e2e -- e2e/launcher.spec.ts e2e/launcher-focus-order.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/launcher.spec.ts e2e/launcher-focus-order.spec.ts
# include any other swept specs
git commit -m "test(e2e): adjust launcher specs for streak-chip + footer-link relocation"
```

---

# Phase 7: Final verification

### Task 7.1: Full check

- [ ] **Step 1:** `npm run typecheck` — clean
- [ ] **Step 2:** `npm run test:unit` — all pass
- [ ] **Step 3:** `npm run lint` — 0 errors (7 pre-existing warnings OK)
- [ ] **Step 4:** `npm run test:e2e -- --project=chromium` — all pass (2 pre-existing flakes in `testIgnore` are fine)

### Task 7.2: Cross-browser smoke

- [ ] **Step 1:** `npm run test:e2e -- --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch` — all pass.

If a cross-browser test fails, fix in-task. Common shapes from prior PRs: mobile-webkit `header-play` click timing (use 10s timeout instead of 5s if needed); mobile-chromium pill collision with × at narrow viewport (visual issue → adjust `right-12` of streak chip if necessary).

### Task 7.3: Manual smoke

- [ ] **Step 1:** Run `npm run dev`, open `http://localhost:5173/`.
- [ ] **Step 2:** With no streak: launcher header shows date only (no chip). Below cards, see retention nudge: `You haven't played today yet — start a streak?`.
- [ ] **Step 3:** Seed an active streak via devtools console:
  ```js
  localStorage.setItem(
    'funworldmap-daily-history',
    JSON.stringify({
      version: 1,
      streak: { current: 5, longest: 7, lastActiveDate: '2026-05-17', lastMilestoneShown: 3 },
      days: {},
    }),
  )
  location.reload()
  ```
  Verify: launcher header now shows `🔥 5` chip on the right. Retention nudge is gone.
- [ ] **Step 4:** Open the history panel via the footer link. Verify spelled-out day headers on desktop, single-letter on mobile (resize browser to confirm).
- [ ] **Step 5:** Hover a played cell. Verify the `title` tooltip shows country/city name + score.
- [ ] **Step 6:** Close launcher. The search bar shows a `/` kbd hint on the right. Click into the search bar — hint disappears. Click outside — hint returns.
- [ ] **Step 7:** Hover the satellite toggle. Verify the title shows `Switch to map view` (since satellite is on by default). Click. Verify the icon changes and the title now reads `Switch to satellite view`.

### Task 7.4: Open PR1a

- [ ] **Step 1:** Push branch:

  ```bash
  git push -u origin <branch>
  ```

- [ ] **Step 2:** Open PR:

  ```bash
  gh pr create --title "UX smoothening Phase 2 (PR1a): launcher composition + history polish + discoverability" --body "$(cat <<'EOF'
  Implements PR1a of docs/superpowers/specs/2026-05-17-ux-smoothening-phase-2-design.md.

  ## Summary
  - B1: Launcher streak pill split into header chip + caption-style retention nudge; "Past 30 days →" relocated to a footer-link row paired with "Play unlimited rounds →"
  - B3: History panel gains responsive day-of-week headers (spelled-out on desktop, single-letter on mobile) + per-cell title tooltips with country/city name + score
  - C1: Search bar shows a persistent `/` kbd hint when empty and unfocused (desktop only)
  - C2: Satellite toggle gains two-state glyphs and a hover title that reflects the click action

  ## What's NOT in this PR
  - B2 (stats view) — deferred to PR1b, only if needed (see spec's priority caveat)
  - B4/B5/C3 — deferred to PR2, conditional on user feedback or funnel data

  ## Test plan
  - [ ] \`npm run test:unit\` green
  - [ ] \`npm run test:e2e -- --project=chromium --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch\` green
  - [ ] Manual smoke per Task 7.3
  EOF
  )"
  ```

---

## Spec coverage self-check

| Spec section                                   | Covered by                 |
| ---------------------------------------------- | -------------------------- |
| B1 (launcher composition reduction to 3 zones) | Tasks 2.1, 2.2             |
| B1 — preserve Phase 1 retention nudges         | Task 1.1 + Task 2.2 step 3 |
| B3 (responsive day headers)                    | Task 3.1                   |
| B3 (per-cell memory tooltips)                  | Task 3.2                   |
| C1 (persistent `/` kbd hint)                   | Tasks 4.1, 4.2             |
| C2 (satellite icon + title)                    | Tasks 5.1, 5.2             |
| Existing-test fallout from B1                  | Task 6.1                   |
| Smoke + PR                                     | Tasks 7.1–7.4              |

**Out-of-scope items from the Phase 2 spec (intentionally not covered):**

- B2 (stats view) — PR1b
- B4 (mobile screenshot regression) — PR2
- B5 (header consolidation) — PR2
- C3 (first-visit intro) — PR2, conditional
