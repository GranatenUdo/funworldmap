# Daily-already-played UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users a clear "keep playing" affordance after today's daily for a mode is done — one tap from the played card, one tap from the reveal overlay — so the played-state card no longer reads as "the game instantly ended."

**Architecture:** Two independently revertable commits on `feat/daily-already-played-ux`. Commit 1 adds a teal "Play City" / "Play Country" primary button to the played-state of `LauncherModeCard`, keeps the See-reveal action as a small emerald secondary row, and wires the new prop to the existing `startFree` helper in `Launcher.tsx`. Commit 2 adds a "Play unlimited rounds" CTA to `DailyRevealOverlay`, shifts initial focus to the new button, and wires `App.tsx` to resolve the target mode (`revealState.modeId ?? readLastMode()`).

**Tech Stack:** TypeScript, React, Vitest + `@testing-library/react` (unit), Playwright (e2e).

Spec: `docs/superpowers/specs/2026-05-18-daily-already-played-ux-design.md`.

---

## File Structure

**Modify (Task 1):**

- `src/components/LauncherModeCard.tsx` — add `onPlayUnlimited` prop, rework the `state === 'played'` branch (lines 148-161) to render a teal primary button + small emerald secondary row.
- `src/components/Launcher.tsx:361-371` — wire `onPlayUnlimited={() => startFree(m.id)}` on the `LauncherModeCard` instantiation.
- `src/components/__tests__/LauncherModeCard.test.tsx` — replace the existing `'renders played state as a single full-width See reveal button with score'` test with new tests covering both primary Play button + secondary row.

**Modify (Task 2):**

- `src/components/DailyRevealOverlay.tsx` — add required `onPlayUnlimited` prop, add a new bottom action area containing only the primary teal "Play unlimited rounds" button, shift initial focus from the existing header X close to the new Play button. The existing header X close button (lines 91-99) is unchanged.
- `src/App.tsx` — pass `onPlayUnlimited` to `<DailyRevealOverlay>` at lines 533-546, resolving the target mode as `revealState.modeId ?? readLastMode()`.
- `src/components/__tests__/DailyRevealOverlay.test.tsx` — pass `onPlayUnlimited={() => {}}` to existing test callsites; add new tests for button render, initial focus, click behavior.

No new files. No new analytics events. No URL hash shape changes.

---

## Task 1: Per-card "Play unlimited" on played daily cards

**Files:**

- Modify: `src/components/LauncherModeCard.tsx` (props interface + played-state branch)
- Modify: `src/components/Launcher.tsx:361-371` (call site)
- Modify: `src/components/__tests__/LauncherModeCard.test.tsx` (replace/extend played-state test)

- [ ] **Step 1: Write the failing tests**

Open `src/components/__tests__/LauncherModeCard.test.tsx`. Find the existing test at the end of the file:

```ts
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
  expect(btn.textContent).toMatch(/✓\s*87\s*\/\s*100\s*·\s*See reveal/)
  // The old "✓ France · 87/100" text line should be gone (consolidated into the button)
  expect(screen.queryByText(/France · 87/)).toBeNull()
})
```

Replace it with the following four tests (the secondary-row test inherits the existing assertion shape; the Play-button tests are new):

```ts
it('played state: renders the mode-specific Play button (country-pinning → "Play Country")', () => {
  const onPlayUnlimited = vi.fn()
  render(
    <LauncherModeCard
      {...defaultProps}
      state="played"
      played={{ targetName: 'France', score: 87 }}
      onPlayUnlimited={onPlayUnlimited}
      onSeeReveal={vi.fn()}
    />,
  )
  const btn = screen.getByTestId('launcher-card-country-pinning-play-unlimited')
  expect(btn.textContent).toBe('Play Country')
  btn.click()
  expect(onPlayUnlimited).toHaveBeenCalledTimes(1)
})

it('played state: renders the mode-specific Play button (city-guessing → "Play City")', () => {
  const onPlayUnlimited = vi.fn()
  render(
    <LauncherModeCard
      modeId="city-guessing"
      todayDate="2026-05-18"
      state="played"
      played={{ targetName: 'Paris', score: 760 }}
      onStartDaily={() => {}}
      onPlayUnlimited={onPlayUnlimited}
      onSeeReveal={vi.fn()}
    />,
  )
  const btn = screen.getByTestId('launcher-card-city-guessing-play-unlimited')
  expect(btn.textContent).toBe('Play City')
  btn.click()
  expect(onPlayUnlimited).toHaveBeenCalledTimes(1)
})

it('played state: renders the secondary See-reveal row with score and click handler', () => {
  const onSeeReveal = vi.fn()
  render(
    <LauncherModeCard
      {...defaultProps}
      state="played"
      played={{ targetName: 'France', score: 87 }}
      onPlayUnlimited={vi.fn()}
      onSeeReveal={onSeeReveal}
    />,
  )
  const row = screen.getByTestId('launcher-card-country-pinning-see-reveal')
  expect(row.textContent).toMatch(/✓\s*87\s*\/\s*100\s*·\s*See reveal/)
  row.click()
  expect(onSeeReveal).toHaveBeenCalledTimes(1)
})

it('played state: city-guessing score formats as /1000', () => {
  render(
    <LauncherModeCard
      modeId="city-guessing"
      todayDate="2026-05-18"
      state="played"
      played={{ targetName: 'Paris', score: 760 }}
      onStartDaily={() => {}}
      onPlayUnlimited={vi.fn()}
      onSeeReveal={vi.fn()}
    />,
  )
  const row = screen.getByTestId('launcher-card-city-guessing-see-reveal')
  expect(row.textContent).toMatch(/✓\s*760\s*\/\s*1000\s*·\s*See reveal/)
})
```

- [ ] **Step 2: Run the new tests, confirm they fail**

Run: `npx vitest run src/components/__tests__/LauncherModeCard.test.tsx --reporter=verbose`

Expected: at least the first two tests fail with messages like `Unable to find an element by: [data-testid="launcher-card-country-pinning-play-unlimited"]`. The third and fourth tests may pass (the existing See-reveal button has the same testid as the new secondary row, and `formatModeScore` is already in use). That's fine — the goal of Step 2 is to confirm the new Play-button assertions FAIL before implementation.

- [ ] **Step 3: Add `onPlayUnlimited` to the props interface**

Open `src/components/LauncherModeCard.tsx`. The `Props` interface is at lines 71-81. Modify it:

```tsx
// Before:
interface Props {
  modeId: ModeId
  anchorDate?: string // 'YYYY-MM-DD'; absent = today
  todayDate: string // 'YYYY-MM-DD'
  state: LauncherCardState
  played?: PlayedResult
  latestAvailableDate?: string | null // most recent past date with a daily; for 'no-puzzle-today'
  onStartDaily: () => void
  onSeeReveal?: () => void
  onRetry?: () => void
}

// After:
interface Props {
  modeId: ModeId
  anchorDate?: string // 'YYYY-MM-DD'; absent = today
  todayDate: string // 'YYYY-MM-DD'
  state: LauncherCardState
  played?: PlayedResult
  latestAvailableDate?: string | null // most recent past date with a daily; for 'no-puzzle-today'
  onStartDaily: () => void
  onSeeReveal?: () => void
  onPlayUnlimited?: () => void // required when state === 'played'; only the played branch reads it
  onRetry?: () => void
}
```

Also extend the destructured parameters at lines 83-93:

```tsx
// Before:
export function LauncherModeCard({
  modeId,
  anchorDate,
  todayDate,
  state,
  played,
  latestAvailableDate,
  onStartDaily,
  onSeeReveal,
  onRetry,
}: Props) {

// After:
export function LauncherModeCard({
  modeId,
  anchorDate,
  todayDate,
  state,
  played,
  latestAvailableDate,
  onStartDaily,
  onSeeReveal,
  onPlayUnlimited,
  onRetry,
}: Props) {
```

- [ ] **Step 4: Rewrite the played-state branch**

Open `src/components/LauncherModeCard.tsx`. Find the `state === 'played'` branch at lines 148-161:

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
          ✓ {formatModeScore(played?.score ?? 0, modeId)} · See reveal →
        </button>
      )}
    </div>
  )
}
```

Replace with:

```tsx
{
  state === 'played' && (
    <div data-testid={`${testIdBase}-played-result`}>
      {onPlayUnlimited && (
        <button
          type="button"
          onClick={onPlayUnlimited}
          data-testid={`${testIdBase}-play-unlimited`}
          className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Play {TITLE[modeId]}
        </button>
      )}
      {onSeeReveal && (
        <button
          type="button"
          onClick={onSeeReveal}
          data-testid={`${testIdBase}-see-reveal`}
          className="w-full mt-2 text-sm text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded text-center"
        >
          ✓ {formatModeScore(played?.score ?? 0, modeId)} · See reveal →
        </button>
      )}
    </div>
  )
}
```

Note: the button label `Play {TITLE[modeId]}` resolves to `"Play Country"` (`TITLE['country-pinning'] === 'Country'`) or `"Play City"` (`TITLE['city-guessing'] === 'City'`), reusing the existing `TITLE` lookup at line 47.

- [ ] **Step 5: Wire `onPlayUnlimited` in `Launcher.tsx`**

Open `src/components/Launcher.tsx`. Find the `LauncherModeCard` instantiation at lines 361-371:

```tsx
<LauncherModeCard
  modeId={m.id}
  anchorDate={anchorDate ?? undefined}
  todayDate={today}
  state={cardStates[m.id]}
  played={playedFor(m.id)}
  latestAvailableDate={latestAvailableDate}
  onStartDaily={() => startDaily(m.id)}
  onSeeReveal={() => seeReveal(m.id)}
  onRetry={() => void refetch()}
/>
```

Add the new prop:

```tsx
<LauncherModeCard
  modeId={m.id}
  anchorDate={anchorDate ?? undefined}
  todayDate={today}
  state={cardStates[m.id]}
  played={playedFor(m.id)}
  latestAvailableDate={latestAvailableDate}
  onStartDaily={() => startDaily(m.id)}
  onSeeReveal={() => seeReveal(m.id)}
  onPlayUnlimited={() => startFree(m.id)}
  onRetry={() => void refetch()}
/>
```

`startFree` is already defined at lines 191-199 of `Launcher.tsx`. No new helper needed.

- [ ] **Step 6: Re-run the unit tests, confirm they pass**

Run: `npx vitest run src/components/__tests__/LauncherModeCard.test.tsx --reporter=verbose`

Expected: all 4 new played-state tests pass, plus all the previously-passing tests in the file. Test count for this file should increase by 3 net (replaced 1 existing test, added 4 new ones).

- [ ] **Step 7: Run the full unit suite**

Run: `npx vitest run --reporter=dot`

Expected: all tests pass. The current total on `main` is **467** (verified via `npx vitest run --reporter=dot` before starting). This task replaces 1 existing test with 4 new ones (+3 net) → expect **470**.

- [ ] **Step 8: Typecheck + lint touched files**

Run: `npm run typecheck && npx eslint src/components/LauncherModeCard.tsx src/components/Launcher.tsx src/components/__tests__/LauncherModeCard.test.tsx`

Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/Launcher.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(launcher): per-card "Play unlimited" on played daily cards

The played-state card today has a single emerald button labeled
"✓ {score} · See reveal →" that mixes the "I'm done" indicator with
a reveal-link affordance. Users have reported it reading as "the game
instantly ended" because the button looks like the play CTA but
actually navigates to the reveal overlay.

Split the played-state into two affordances:

- Primary: teal "Play Country" / "Play City" button that calls the
  existing startFree(modeId) helper — same path as the launcher's
  bottom unlimited link. Sets hash to #game/<modeId>, dismisses
  launcher, lets the hash router boot an unlimited game.
- Secondary: small emerald text row ✓ {score} · See reveal →, same
  testid as today's button, same onSeeReveal handler. The reveal
  affordance survives but reads as a subordinate action.

Card emerald border + ✓ prefix kept as "this is done" signals. No
analytics schema change — startFree already fires
launcher_dismissed { path: 'card' }, matching the daily Play CTA.

Spec: docs/superpowers/specs/2026-05-18-daily-already-played-ux-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: "Play unlimited rounds" CTA in the daily reveal overlay

**Files:**

- Modify: `src/components/DailyRevealOverlay.tsx` (add prop, render new button, shift initial focus)
- Modify: `src/App.tsx:533-546` (pass `onPlayUnlimited` callback)
- Modify: `src/components/__tests__/DailyRevealOverlay.test.tsx` (pass new prop in existing tests + add new tests)

- [ ] **Step 1: Write the failing tests**

Open `src/components/__tests__/DailyRevealOverlay.test.tsx`. The current file (lines 12-34) has three tests that call `render(<DailyRevealOverlay ... onClose={() => {}} />)` without the new prop. We need both:

1. Update existing tests to pass `onPlayUnlimited={() => {}}` (otherwise TypeScript will fail).
2. Add new tests for the CTA itself.

Replace the contents of the `describe('DailyRevealOverlay spoiler gate', ...)` block (and add a new `describe` for the CTA tests) with:

```ts
describe('DailyRevealOverlay spoiler gate', () => {
  beforeEach(() => {
    resetHistoryStore()
    cleanup()
  })

  it('today + unplayed: country headline hidden', () => {
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId={null}
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    expect(screen.queryByText('France')).toBeNull()
    expect(screen.getAllByText(/Finish today's daily/i).length).toBeGreaterThan(0)
  })

  it('today + played country: country headline rendered', () => {
    setHistory((p) => ({
      ...p,
      days: {
        ...p.days,
        '2026-05-02': { 'country-pinning': { score: 80, attempts: [], completedAt: 0 } },
      },
    }))
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId={null}
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    expect(screen.getByText('France')).toBeTruthy()
  })

  it('past + unplayed: headline rendered (past days are inert)', () => {
    render(
      <DailyRevealOverlay
        date="2026-04-25"
        today="2026-05-02"
        modeId={null}
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    expect(screen.getByText('France')).toBeTruthy()
  })
})

describe('DailyRevealOverlay play-unlimited CTA', () => {
  beforeEach(() => {
    resetHistoryStore()
    cleanup()
  })

  it('renders the "Play unlimited rounds" button', () => {
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    const btn = screen.getByTestId('daily-reveal-play-unlimited')
    expect(btn.textContent).toBe('Play unlimited rounds')
  })

  it('clicking the Play unlimited button calls onPlayUnlimited', () => {
    const onPlayUnlimited = vi.fn()
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={onPlayUnlimited}
      />,
    )
    screen.getByTestId('daily-reveal-play-unlimited').click()
    expect(onPlayUnlimited).toHaveBeenCalledTimes(1)
  })

  it('initial focus lands on the Play unlimited button, not Close', () => {
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    const btn = screen.getByTestId('daily-reveal-play-unlimited')
    expect(document.activeElement).toBe(btn)
  })

  it('clicking Close calls onClose, not onPlayUnlimited', () => {
    const onClose = vi.fn()
    const onPlayUnlimited = vi.fn()
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={onClose}
        onPlayUnlimited={onPlayUnlimited}
      />,
    )
    screen.getByTestId('daily-reveal-close').click()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPlayUnlimited).not.toHaveBeenCalled()
  })
})
```

You'll also need to add `vi` to the imports at the top:

```ts
// Before:
import { describe, it, expect, beforeEach } from 'vitest'

// After:
import { describe, it, expect, beforeEach, vi } from 'vitest'
```

- [ ] **Step 2: Run the new tests, confirm they fail**

Run: `npx vitest run src/components/__tests__/DailyRevealOverlay.test.tsx --reporter=verbose`

Expected:

- The existing spoiler-gate tests now fail because `DailyRevealOverlay` doesn't have an `onPlayUnlimited` prop yet — TypeScript may flag this at compile time, or the runtime test will throw on the missing prop reference if the component reads it.
- The 4 new CTA tests fail with `Unable to find an element by: [data-testid="daily-reveal-play-unlimited"]`.

If TypeScript blocks the test from compiling at all (more likely since the new prop is required in the test call signature but doesn't yet exist on the component), proceed to Step 3 anyway — the build will compile once we add the prop.

- [ ] **Step 3: Add `onPlayUnlimited` to `DailyRevealOverlay` props**

Open `src/components/DailyRevealOverlay.tsx`. Find the `Props` interface at lines 10-18:

```tsx
interface Props {
  date: string
  modeId: ModeId | null
  puzzle: DailyPuzzleRef | null
  today: string
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
}
```

Modify to add `onPlayUnlimited`:

```tsx
interface Props {
  date: string
  modeId: ModeId | null
  puzzle: DailyPuzzleRef | null
  today: string
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
  onPlayUnlimited: () => void
}
```

Update the destructured parameters at line 28:

```tsx
// Before:
export function DailyRevealOverlay({ date, modeId, puzzle, today, countries, cities, onClose }: Props) {

// After:
export function DailyRevealOverlay({ date, modeId, puzzle, today, countries, cities, onClose, onPlayUnlimited }: Props) {
```

- [ ] **Step 4: Shift initial focus from Close to Play unlimited**

Open `src/components/DailyRevealOverlay.tsx`. Find the initial-focus block inside the mount effect (around line 38):

```tsx
// Before:
const close = root.querySelector<HTMLButtonElement>('[data-testid="daily-reveal-close"]')
close?.focus()

// After:
const initialFocus =
  root.querySelector<HTMLButtonElement>('[data-testid="daily-reveal-play-unlimited"]') ??
  root.querySelector<HTMLButtonElement>('[data-testid="daily-reveal-close"]')
initialFocus?.focus()
```

The fallback to `daily-reveal-close` is defense-in-depth — if some future rendering condition removes the Play button (e.g. a mode where unlimited isn't supported), focus still lands somewhere sensible.

- [ ] **Step 5: Render the new bottom Play unlimited button**

The existing close button in `DailyRevealOverlay.tsx:91-99` is a **header X icon** at the top-right of the overlay — verified by reading the file. **Do NOT modify it.** It stays as the sole close affordance. The new Play unlimited button goes in a new bottom action area, added after the share block.

Concretely, find the last closing tag of the puzzle-content section in `DailyRevealOverlay.tsx` — currently the share block renders on lines 159-166:

```tsx
{
  anyPlayed && (
    <DailyShareBlock
      date={date}
      results={shareResults}
      streak={streak}
      originUrl={window.location.origin}
    />
  )
}
```

Add the new action area immediately after that block (still inside the inner `<div className="relative w-full max-w-xl ...">` container that wraps the dialog content):

```tsx
{
  anyPlayed && (
    <DailyShareBlock
      date={date}
      results={shareResults}
      streak={streak}
      originUrl={window.location.origin}
    />
  )
}
;<div className="mt-6">
  <button
    type="button"
    onClick={onPlayUnlimited}
    data-testid="daily-reveal-play-unlimited"
    className="w-full px-4 py-2.5 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
  >
    Play unlimited rounds
  </button>
</div>
```

Notes:

- The new action area renders **unconditionally** — including when `puzzle === null` ("daily no longer available") and when neither mode has been played today. In those states the CTA gives the user a clear way out via unlimited. No `{anyPlayed && ...}` guard around the action area.
- The header X close at lines 91-99 keeps its testid `daily-reveal-close` so existing tests + e2e selectors continue to work unchanged.
- The Play button gets the same teal styling as the launcher card's new primary button — visual consistency across the two surfaces.

- [ ] **Step 6: Wire `onPlayUnlimited` in `App.tsx`**

Open `src/App.tsx`. Find the `DailyRevealOverlay` render at lines 533-546:

```tsx
{
  revealState && (
    <DailyRevealOverlay
      date={revealState.date}
      modeId={revealState.modeId}
      puzzle={byDate(revealState.date) ?? null}
      today={toLocalDateString(new Date())}
      countries={pool}
      cities={cities}
      onClose={() => {
        history.replaceState(null, '', window.location.pathname)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }}
    />
  )
}
```

Add the new prop:

```tsx
{
  revealState && (
    <DailyRevealOverlay
      date={revealState.date}
      modeId={revealState.modeId}
      puzzle={byDate(revealState.date) ?? null}
      today={toLocalDateString(new Date())}
      countries={pool}
      cities={cities}
      onClose={() => {
        history.replaceState(null, '', window.location.pathname)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }}
      onPlayUnlimited={() => {
        const id = revealState.modeId ?? readLastMode()
        // No track() here — the hash router's free_started event fires when
        // the game boots, which is the durable signal. Adding launcher_dismissed
        // here would be a category error (the reveal overlay is not the launcher).
        window.location.hash = writeHash({ kind: 'game', modeId: id })
      }}
    />
  )
}
```

Both `readLastMode` and `writeHash` are **NOT currently imported** in `App.tsx` (verified by grep on the current tree — only `parseHash` is imported from `./lib/hashState` on line 25). Add the imports:

```tsx
// Existing import (line 25 today) — extend it:
// Before:
import { parseHash } from './lib/hashState'
// After:
import { parseHash, writeHash } from './lib/hashState'
```

And add a brand-new import line for `readLastMode`, near the other game-shared imports (the `ModeId` import is at line 22; place this nearby):

```tsx
import { readLastMode } from './game/shared/lastMode'
```

Verify with `grep -n "readLastMode\|writeHash" src/App.tsx` — should match the new import line(s) and the `onPlayUnlimited` callback body. No other places should reference these names.

- [ ] **Step 7: Re-run the tests, confirm they pass**

Run: `npx vitest run src/components/__tests__/DailyRevealOverlay.test.tsx --reporter=verbose`

Expected: all 7 tests pass (3 existing spoiler-gate tests + 4 new CTA tests).

- [ ] **Step 8: Run the full unit suite**

Run: `npx vitest run --reporter=dot`

Expected: all tests pass. Previous total after Task 1 was **470**; this task adds 4 new CTA tests (the 3 existing spoiler-gate tests stay at the same count, with updated props) → expect **474**.

- [ ] **Step 9: Typecheck + lint touched files**

Run: `npm run typecheck && npx eslint src/components/DailyRevealOverlay.tsx src/App.tsx src/components/__tests__/DailyRevealOverlay.test.tsx`

Expected: both clean.

- [ ] **Step 10: Browser smoke check (per spec's risks)**

If a dev server is not running, start one: `npm run dev`. Open the page on a viewport sized **375 × 667** (use DevTools device emulation → "iPhone SE" preset, which is the smallest common mobile target).

1. **Played-card layout fits.** Play today's daily city game to completion (or use DevTools localStorage to set `funworldmap-daily-history` to a state where both modes are played). Open the launcher. **Expected:** both played cards visible without scrolling the launcher. The teal "Play City" / "Play Country" primary button + small "✓ {score} · See reveal →" secondary row are clearly distinct.
2. **Secondary row reads as tappable.** Tap the secondary row on one card. **Expected:** the daily reveal overlay opens. (If the row feels visually decorative rather than tappable on this viewport, fall back to the documented background tint `bg-emerald-50/50 dark:bg-emerald-900/20` per the spec's secondary-row fallback note.)
3. **Reveal overlay CTA.** The reveal overlay's "Play unlimited rounds" button has focus (visible focus ring or browser-default focus indicator). **Expected:** tab order is Play → Close → (rest of overlay).
4. **CTA click starts unlimited.** Tap the "Play unlimited rounds" button. **Expected:** the overlay closes, the URL hash changes to `#game/<modeId>` (or `#game/<lastMode>` if `modeId === null`), the HUD appears, the city game starts in unlimited mode.
5. **Escape still closes.** Open the overlay again. Press Escape. **Expected:** overlay closes, no game starts.
6. **Played-card Play button starts unlimited.** Reopen the launcher. Tap the teal "Play City" button. **Expected:** launcher dismisses, hash becomes `#game/city-guessing`, HUD appears, unlimited city game starts.

If any of these don't match expectation, fix before committing. Do not commit a layout overflow.

- [ ] **Step 11: Commit**

```bash
git add src/components/DailyRevealOverlay.tsx src/App.tsx src/components/__tests__/DailyRevealOverlay.test.tsx
git commit -m "$(cat <<'EOF'
feat(reveal): add "Play unlimited" CTA to daily reveal overlay

After this commit, a user who lands on the daily reveal overlay
— via the launcher's See-reveal row, via deep link, via browser back
— has a clear "play more" exit. The overlay no longer reads as a
dead-end for someone who wants to keep playing.

DailyRevealOverlay grows a required onPlayUnlimited prop and a new
bottom action area containing only a teal "Play unlimited rounds"
primary button (initial focus target). The existing header X close
stays unchanged — duplicating the close affordance at the bottom
would violate "one obvious way to close." App.tsx wires
onPlayUnlimited to resolve the target mode as
revealState.modeId ?? readLastMode() — explicit reveal preserves the
user's mode choice; full-day reveal (modeId === null) falls back to
their last-played mode.

No new analytics events fired at the CTA click site — the hash
router's existing free_started event captures the start signal on
boot. Adding launcher_dismissed here would be a category error
(reveal overlay is not the launcher).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (run after writing, before handing off)

- **Spec coverage:** Every spec requirement maps to a task step.
  - Spec Item 1 (played-card layout) → Task 1 steps 3, 4 (props + branch rewrite) and 5 (call site).
  - Spec Item 2 (reveal overlay CTA) → Task 2 steps 3 (props), 4 (focus shift), 5 (render), 6 (App.tsx wiring).
  - Spec Risk "mobile vertical growth" → Task 2 step 10 (browser smoke check on 375 × 667).
  - Spec Risk "secondary-row tap-target ambiguity" → Task 2 step 10's note about the documented fallback.
  - Spec Risk "reveal-overlay focus shift" → Task 2 step 4 (focus shift) + step 1 (test asserting initial focus on Play button).
  - Spec "Analytics" → reused without modification; commit messages call this out explicitly.
- **Placeholder scan:** No "TBD", "TODO", "similar to", or "add appropriate" patterns. Every code-change step has explicit before/after code blocks.
- **Type consistency:**
  - `onPlayUnlimited?: () => void` in `LauncherModeCard` (optional, only used in played branch) — consistent across Task 1 steps 3 and 4.
  - `onPlayUnlimited: () => void` in `DailyRevealOverlay` (required) — consistent across Task 2 steps 3, 5, 6, and all four new tests.
  - The `Play {TITLE[modeId]}` expression in Task 1 step 4 produces `"Play Country"` / `"Play City"`, matching the test assertions in Task 1 step 1.
  - Testid `launcher-card-{modeId}-play-unlimited` is used consistently in both step 1 (test) and step 4 (component).
  - Testid `daily-reveal-play-unlimited` is used consistently in Task 2 step 1 (tests), step 4 (focus shift), and step 5 (render).
