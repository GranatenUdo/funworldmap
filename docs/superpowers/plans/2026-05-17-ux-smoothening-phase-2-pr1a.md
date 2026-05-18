# UX Smoothening Phase 2 — PR1a Implementation Plan (narrowed)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the narrowed PR1a slice of `docs/superpowers/specs/2026-05-17-ux-smoothening-phase-2-design.md` — history-panel memory affordance (B3) and a hover-title on the satellite toggle (C2 partial; icon swap deferred). Items dropped from this PR per critical review: B1 (composition refactor — relitigates a closed Phase 1 decision), C1 (kbd hint — low-value polish), C2 icon swap (proposed glyphs admitted as mediocre).

**Architecture:** Two small additive changes. `LauncherHistoryPanel` gains responsive day-of-week headers and threads per-cell memory data (country/city name + score) into each cell, which renders a `title=""` tooltip. `Header.tsx`'s satellite-toggle button gains a `title=""` attribute that mirrors the action of clicking (e.g., `Switch to map view` when satellite is on). No new components, no new hooks, no analytics.

**Caveat — desktop-only affordance:** `title=""` tooltips only render on hover, so the new B3 memory tooltips are a desktop-only enhancement. Mobile and touch users tap the calendar cell and navigate to reveal directly (existing behavior, unchanged). This is acceptable — the cell's primary affordance is navigate-to-reveal; the tooltip is a bonus on top.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest + jsdom, Playwright (e2e).

---

## File Structure

### Modified files

- `src/components/LauncherHistoryPanel.tsx` — responsive day-of-week headers; accept `countries` and `cities` props; compute `cellMemories` and thread per-cell memory into each cell.
- `src/components/LauncherCalendarCell.tsx` — accept optional `memory` prop; render `title` attribute when memory is defined.
- `src/components/Launcher.tsx` — pass `countries` and `cities` through to `LauncherHistoryPanel`.
- `src/components/Header.tsx` — add `title` attribute to the satellite toggle button; add `data-satellite-active` for e2e.
- `src/components/__tests__/LauncherHistoryPanel.test.tsx` _(if it exists)_ — extend for responsive headers + new props.
- `src/components/__tests__/LauncherCalendarCell.test.tsx` _(if it exists)_ — extend for `title` rendering.
- `e2e/launcher-history.spec.ts` — assert `title` rendering on a played cell.
- `e2e/satellite-default.spec.ts` — assert `title` attribute changes with state.

### No new files. No deletions.

---

# Phase 1: History panel polish (B3)

### Task 1.1: Responsive day-of-week headers

**Files:**

- Modify: `src/components/LauncherHistoryPanel.tsx`
- Modify: `src/components/__tests__/LauncherHistoryPanel.test.tsx` (if exists)

- [ ] **Step 1: Check for existing test file**

```bash
ls src/components/__tests__/LauncherHistoryPanel.test.tsx 2>/dev/null
```

If the file exists, add the test in step 2 to it. If not, create it.

- [ ] **Step 2: Add a failing test**

If creating the file, full contents:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherHistoryPanel } from '../LauncherHistoryPanel'

describe('LauncherHistoryPanel', () => {
  const noop = () => {}

  it('renders spelled-out day headers (desktop) and single-letter headers (mobile)', () => {
    render(
      <LauncherHistoryPanel
        today="2026-05-17"
        countries={[]}
        cities={[]}
        onClose={noop}
        onCellActivate={vi.fn()}
      />,
    )
    expect(screen.getByTestId('dow-row-full')).toBeTruthy()
    expect(screen.getByTestId('dow-row-mobile')).toBeTruthy()
    expect(screen.getByText('Mon')).toBeTruthy()
    expect(screen.getByText('Sun')).toBeTruthy()
  })
})
```

Notes:

- `.toBeTruthy()` / null checks — this repo doesn't use `@testing-library/jest-dom`.
- The test passes empty `countries`/`cities` arrays because Task 1.2 will introduce these props (the test is written ahead of the prop signature change).

If the file already exists, append the test inside the existing `describe` block.

- [ ] **Step 3: Run — expect FAIL**

`npm run test:unit -- LauncherHistoryPanel`
Expected: FAIL (either compile error from new props that don't exist yet, OR assertion failure on missing `dow-row-full` testid).

- [ ] **Step 4: Update `LauncherHistoryPanel` Props to accept `countries` and `cities`**

In `src/components/LauncherHistoryPanel.tsx`, change the imports + Props:

```tsx
import type { CityLike, CountryLike, ModeId } from '../game/shared/types'

interface Props {
  today: string
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
  onCellActivate: (date: string, kind: HistoryCellKind) => void
}
```

Destructure the new props in the function signature:

```tsx
export function LauncherHistoryPanel({
  today,
  countries,
  cities,
  onClose,
  onCellActivate,
}: Props) {
```

The new props are unused by Task 1.1; Task 1.2 uses them. Adding them now keeps the prop signature stable for the test.

- [ ] **Step 5: Add the responsive day headers**

Below the existing constant `const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']`, add:

```tsx
const DOW_LABELS_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
```

Find the existing single-row day-header block (around lines 107–115):

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

Replace with two rows — spelled-out on `sm`+, single-letter below `sm`:

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

- [ ] **Step 6: Update the caller in `Launcher.tsx`**

In `src/components/Launcher.tsx`, find the `<LauncherHistoryPanel>` mount (search for `<LauncherHistoryPanel`). Pass the new props (`countries` and `cities` are already destructured in `Launcher.tsx`'s function signature):

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

- [ ] **Step 7: Run — expect PASS**

```bash
npm run typecheck
npm run test:unit -- LauncherHistoryPanel
npm run test:unit  # full suite — confirms nothing else broke
```

- [ ] **Step 8: Commit**

```bash
git add src/components/LauncherHistoryPanel.tsx src/components/Launcher.tsx src/components/__tests__/LauncherHistoryPanel.test.tsx
git commit -m "feat(launcher-history): spelled-out day headers on desktop, single-letter on mobile"
```

---

### Task 1.2: Per-cell memory tooltips

**Files:**

- Modify: `src/components/LauncherHistoryPanel.tsx`
- Modify: `src/components/LauncherCalendarCell.tsx`
- Modify or create: `src/components/__tests__/LauncherCalendarCell.test.tsx`

- [ ] **Step 1: Define `CellMemory` interface and write failing cell-test**

Check for existing test file:

```bash
ls src/components/__tests__/LauncherCalendarCell.test.tsx 2>/dev/null
```

If it exists, append the tests below. If not, create it:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherCalendarCell } from '../LauncherCalendarCell'
import type { CellMemory } from '../LauncherHistoryPanel'

describe('LauncherCalendarCell', () => {
  it('renders a title tooltip with country + city memory when both are provided', () => {
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
        onActivate={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('launcher-cal-2026-05-15')
    expect(btn.getAttribute('title')).toBe('France 87/100 · Paris 760/1000')
  })

  it('renders a title tooltip with only country memory when city is unplayed', () => {
    const memory: CellMemory = {
      country: { name: 'France', score: 87 },
    }
    render(
      <LauncherCalendarCell
        date="2026-05-15"
        status="in-window"
        playedModes={new Set(['country-pinning'])}
        memory={memory}
        onActivate={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('launcher-cal-2026-05-15')
    expect(btn.getAttribute('title')).toBe('France 87/100')
  })

  it('does not render title when memory is undefined', () => {
    render(
      <LauncherCalendarCell
        date="2026-05-15"
        status="in-window"
        playedModes={new Set()}
        memory={undefined}
        onActivate={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('launcher-cal-2026-05-15')
    expect(btn.getAttribute('title')).toBeNull()
  })
})
```

The middle dot `·` is U+00B7 — same as used elsewhere in the codebase.

- [ ] **Step 2: Run — expect FAIL**

`npm run test:unit -- LauncherCalendarCell`
Expected: FAIL (import of `CellMemory` doesn't resolve; `memory` prop doesn't exist).

- [ ] **Step 3: Add `CellMemory` interface to `LauncherHistoryPanel.tsx`**

Near the top of the file (with the other type exports), add:

```tsx
export interface CellMemory {
  country?: { name: string; score: number }
  city?: { name: string; score: number }
}
```

- [ ] **Step 4: Compute `cellMemories` in `LauncherHistoryPanel`**

In `src/components/LauncherHistoryPanel.tsx`, add the import:

```tsx
import { useDailyPuzzlesContext } from '../game/daily/DailyPuzzlesProvider'
```

Inside the function body, after the existing `playedByDate` useMemo (around line 33), add:

```tsx
const { byDate: puzzleByDate } = useDailyPuzzlesContext()

const cellMemories = useMemo(() => {
  const out = new Map<string, CellMemory>()
  for (const [date, entry] of Object.entries(history.days)) {
    const puzzle = puzzleByDate(date)
    if (!puzzle) continue
    const mem: CellMemory = {}
    const cp = entry?.['country-pinning']
    const cg = entry?.['city-guessing']
    if (cp) {
      const c = countries.find((x) => x.cca3 === puzzle.country.cca3)
      if (c) mem.country = { name: c.name.common, score: cp.score }
    }
    if (cg) {
      const ci = cities.find((x) => x.id === puzzle.city.id)
      if (ci) mem.city = { name: ci.name, score: cg.score }
    }
    if (mem.country || mem.city) out.set(date, mem)
  }
  return out
}, [history.days, puzzleByDate, countries, cities])
```

- [ ] **Step 5: Pass `memory` to each cell**

In the `cells.slice(...).map(...)` block, add `memory={cellMemories.get(c.date)}`:

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

- [ ] **Step 6: Accept and use `memory` in `LauncherCalendarCell`**

In `src/components/LauncherCalendarCell.tsx`, add the import and extend Props:

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

Add a helper function above the component:

```tsx
function memoryTooltip(memory: CellMemory | undefined): string | undefined {
  if (!memory) return undefined
  const parts: string[] = []
  if (memory.country) parts.push(`${memory.country.name} ${memory.country.score}/100`)
  if (memory.city) parts.push(`${memory.city.name} ${memory.city.score}/1000`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
```

In the function signature, destructure `memory`. On the `<button>`, add a `title` attribute right after `aria-label`:

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
```

`title={undefined}` is a no-op in React (no attribute rendered), so the third test case in step 1 passes naturally.

- [ ] **Step 7: Run tests**

```bash
npm run typecheck
npm run test:unit -- LauncherCalendarCell
npm run test:unit  # full suite
```

- [ ] **Step 8: Commit**

```bash
git add src/components/LauncherHistoryPanel.tsx src/components/LauncherCalendarCell.tsx src/components/__tests__/LauncherCalendarCell.test.tsx
git commit -m "feat(launcher-history): per-cell memory tooltip (country/city name + score)"
```

---

### Task 1.3: E2E coverage for the memory tooltip

**Files:**

- Modify: `e2e/launcher-history.spec.ts`

- [ ] **Step 1: Inspect the existing spec for patterns**

Read `e2e/launcher-history.spec.ts` end-to-end to understand the existing setup (likely uses `seedDailyHistory` + `openLauncher` + clicking the history link). Match its style.

- [ ] **Step 2: Add a test asserting the title attribute on a played cell**

Append inside the existing `describe` block (a typical shape — adapt to whatever helpers and fixtures the file uses):

```ts
test('played cell exposes a memory tooltip via title attribute', async ({ page }) => {
  // Seed a played daily on a specific date so we know what to assert
  const playedDate = '2026-05-15'
  await stubDailyIndex(page, playedDate)
  await seedDailyHistory(page, { date: playedDate, modes: ['country-pinning', 'city-guessing'] })
  await gotoAndWaitForMap(page, '/')
  await openLauncher(page)
  await page.getByTestId('launcher-history-link').click()
  const cell = page.getByTestId(`launcher-cal-${playedDate}`)
  await expect(cell).toBeVisible()
  const title = await cell.getAttribute('title')
  expect(title).toBeTruthy()
  expect(title).toMatch(/\d+\/100/) // country score format
  expect(title).toMatch(/\d+\/1000/) // city score format
})
```

Imports at the top of the file should already include `gotoAndWaitForMap`, `openLauncher`, `seedDailyHistory`, `stubDailyIndex` from `./helpers`. If any are missing, add them.

If the `seedDailyHistory` helper doesn't seed both modes by default, check its signature in `e2e/helpers.ts` and adjust the call.

- [ ] **Step 3: Run the spec**

```bash
npm run test:e2e -- e2e/launcher-history.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/launcher-history.spec.ts
git commit -m "test(e2e): cover per-cell memory tooltip in history panel"
```

---

# Phase 2: Satellite toggle title attribute (C2 partial)

### Task 2.1: Add `title` attribute to satellite toggle

**Files:**

- Modify: `src/components/Header.tsx`

This task **only adds a `title` attribute** to the existing button (and a `data-satellite-active` attribute for e2e selectors). The icon swap proposed in the Phase 2 spec is **dropped** from this PR — the spec acknowledged the proposed glyphs were mediocre. The `title` on hover is the primary value-add; the icon can be revisited later when a clear improvement is identified.

- [ ] **Step 1: Find the existing satellite toggle button**

In `src/components/Header.tsx`, find the existing block (search for `aria-pressed={satellite}`):

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
```

- [ ] **Step 2: Add the `title` attribute and `data-satellite-active`**

Add `title` (mirrors the aria-label — clicking does the labeled action) and `data-satellite-active` (for e2e):

```tsx
          <button
            onClick={onSatelliteToggle}
            aria-label={satellite ? 'Switch to map view' : 'Switch to satellite view'}
            title={satellite ? 'Switch to map view' : 'Switch to satellite view'}
            aria-pressed={satellite}
            data-satellite-active={satellite}
            className={`w-10 h-10 rounded-xl backdrop-blur-sm border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
              satellite
                ? 'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal dark:text-teal-light'
                : 'bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-sand-500 dark:text-dark-100 hover:bg-sand-200/90 dark:hover:bg-dark-300/80'
            }`}
            data-testid="satellite-toggle"
          >
```

The SVG inside the button is unchanged.

- [ ] **Step 3: Run typecheck**

`npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(header): hover title on satellite toggle reflects click action"
```

---

### Task 2.2: E2E coverage for the satellite-toggle title

**Files:**

- Modify: `e2e/satellite-default.spec.ts`

- [ ] **Step 1: Append a test**

Append inside the existing `describe` block (or as a top-level `test()` if the file is flat):

```ts
test('satellite toggle has hover title reflecting the click action', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await ensureLauncherDismissed(page)
  const toggle = page.getByTestId('satellite-toggle')
  // Default state: satellite ON (per src/App.tsx initial state)
  await expect(toggle).toHaveAttribute('data-satellite-active', 'true')
  await expect(toggle).toHaveAttribute('title', 'Switch to map view')
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-satellite-active', 'false')
  await expect(toggle).toHaveAttribute('title', 'Switch to satellite view')
})
```

Imports at the top should include `gotoAndWaitForMap`, `ensureLauncherDismissed` from `./helpers`. Add if missing.

- [ ] **Step 2: Run**

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

# Phase 3: Verification + PR

### Task 3.1: Full check

- [ ] **Step 1:** `npm run typecheck` — clean
- [ ] **Step 2:** `npm run test:unit` — all pass
- [ ] **Step 3:** `npm run lint` — 0 errors (7 pre-existing warnings OK)
- [ ] **Step 4:** `npm run test:e2e -- --project=chromium` — all pass

### Task 3.2: Cross-browser smoke

- [ ] **Step 1:** `npm run test:e2e -- --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch` — all pass.

Notes if anything fails:

- The `title` tooltip is desktop-only behavior; cross-browser e2e tests assert the _attribute_ (`getAttribute('title')`), which works regardless of viewport — no expected mobile failure from B3 or C2.
- If a mobile test that previously passed now fails on the launcher-history changes, it's likely an existing test asserting on the day-of-week header rendering. Update its query to use `getByTestId('dow-row-full')` or `getByTestId('dow-row-mobile')` rather than asserting on a specific letter.

### Task 3.3: Manual smoke

- [ ] **Step 1:** Run `npm run dev`, open `http://localhost:5173/`.
- [ ] **Step 2:** Seed a played daily via devtools console:
  ```js
  localStorage.setItem(
    'funworldmap-daily-history',
    JSON.stringify({
      version: 1,
      streak: { current: 1, longest: 1, lastActiveDate: '2026-05-17', lastMilestoneShown: 3 },
      days: {
        '2026-05-17': {
          'country-pinning': { score: 87, attempts: [], completedAt: 1 },
          'city-guessing': { score: 760, attempts: [], completedAt: 2 },
        },
      },
    }),
  )
  location.reload()
  ```
- [ ] **Step 3:** Click `▶ Play today` in the header. Click `Past 30 days →` in the launcher. Verify the calendar shows spelled-out day headers (`Mon Tue Wed Thu Fri Sat Sun`).
- [ ] **Step 4:** Hover the cell for today (May 17, ringed). Verify a tooltip appears showing the country + city memory (e.g., `France 87/100 · Paris 760/1000` — exact countries/cities depend on the seeded daily index).
- [ ] **Step 5:** Resize the browser below `sm` (640px). Verify the day headers switch to single letters (`M T W T F S S`).
- [ ] **Step 6:** Close the launcher. Hover the satellite toggle in the header. Verify the title shows `Switch to map view` (satellite is on by default). Click the toggle. Verify the title now reads `Switch to satellite view`.

### Task 3.4: Open PR

- [ ] **Step 1:** Push:

  ```bash
  git push -u origin <branch>
  ```

- [ ] **Step 2:** Open PR:

  ```bash
  gh pr create --title "UX smoothening Phase 2 (PR1a, narrowed): history memory tooltips + satellite hover title" --body "$(cat <<'EOF'
  Implements the narrowed PR1a slice of docs/superpowers/specs/2026-05-17-ux-smoothening-phase-2-design.md.

  ## Summary
  - **B3 partial — history panel polish.** Spelled-out day-of-week headers on desktop, single-letter on mobile. Each played calendar cell renders a `title` tooltip with the country/city name + score (e.g., `France 87/100 · Paris 760/1000`).
  - **C2 partial — satellite toggle.** Adds a hover `title` attribute mirroring the aria-label so the click action is visible at a glance. Icon swap deferred (proposed glyphs were not a clear improvement).

  ## Not in this PR (per critical-review narrowing)
  - **B1** (launcher composition refactor) — relitigates a closed Phase 1 decision; no signal it's needed.
  - **C1** (kbd hint in search) — low-value polish; defer.
  - **C2 icon swap** — proposed glyphs admitted as mediocre; revisit when a clear improvement is identified.

  ## Caveat
  `title=""` tooltips are desktop-only behavior. Mobile and touch users see no tooltip — they tap a cell and navigate to reveal directly (existing behavior). Acceptable: the cell's primary affordance is navigate-to-reveal; the tooltip is a bonus on top.

  ## Test plan
  - [ ] `npm run test:unit` green
  - [ ] `npm run test:e2e -- --project=chromium --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch` green
  - [ ] Manual smoke per Task 3.3
  EOF
  )"
  ```

---

## Spec coverage self-check

| Phase 2 spec item                   | Status in this PR                                                         |
| ----------------------------------- | ------------------------------------------------------------------------- |
| B1 (launcher composition reduction) | **Deferred** — relitigates closed Phase 1 decision; no signal it's needed |
| B2 (stats view)                     | **Deferred to PR1b**, conditional on need                                 |
| B3 (responsive day headers)         | ✅ Task 1.1                                                               |
| B3 (per-cell memory tooltips)       | ✅ Tasks 1.2, 1.3                                                         |
| B4 (mobile visual audit)            | **Deferred to PR2**, conditional                                          |
| B5 (header consolidation)           | **Deferred to PR2**, conditional                                          |
| C1 (persistent `/` kbd hint)        | **Dropped** — low value                                                   |
| C2 (satellite icon clarity)         | ✅ Title attribute via Tasks 2.1, 2.2; icon swap dropped                  |
| C3 (first-visit intro)              | **Deferred to PR2**, conditional on funnel data                           |
