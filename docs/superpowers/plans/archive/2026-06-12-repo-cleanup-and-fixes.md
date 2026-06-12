# Repo Cleanup and Fixes Implementation Plan

> **Executed and shipped 2026-06-12** via subagent-driven development: PRs #103, #104, #105, #107, #108, #109, #110 (tracking issue #106; review follow-ups in #111). Checkboxes were tracked by the executing session rather than ticked in-file; verification evidence lives in the PR descriptions. Post-merge gates green: 300 unit / 152 chromium e2e / 6 mobile e2e local, CI + Deploy + CodeQL green on main.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the small production bugs, delete dead code, make the CI/test story honest, and reconcile every doc/code contradiction found in the 2026-06-11 full-repo review.

**Architecture:** Seven independent PR-sized phases ordered code → tests → config → docs → corpus, so each phase ships alone and a stop after any phase leaves the repo strictly better. No behavior changes beyond the three verified bugs; everything else is deletion, documentation, or file moves.

**Tech Stack:** React 19 + TypeScript (Vitest, Testing Library), Playwright, MapLibre GL; docs are plain Markdown.

**Spec:** [`docs/superpowers/specs/2026-06-11-repo-cleanup-and-fixes-design.md`](../specs/2026-06-11-repo-cleanup-and-fixes-design.md) — includes the four user-confirmed scope decisions.

---

## Pre-flight

- [ ] `git status` is clean; on `main` and up to date (`git pull`).
- [ ] **Kill any background `npm run dev`** — Playwright's `reuseExistingServer` would reuse it and the dev server lacks `VITE_TEST_HOOKS` (see project memory).
- [ ] Baseline green: `npm run check` (lint + typecheck + unit) passes.
- [ ] Each phase below is its own branch + PR (`cleanup/phase-<n>-<slug>`), per repo convention.

### Task 0: Commit spec + plan

- [ ] **Step 1: Commit the two planning docs (docs before code, per CLAUDE.md)**

```bash
git add docs/superpowers/specs/2026-06-11-repo-cleanup-and-fixes-design.md docs/superpowers/plans/2026-06-12-repo-cleanup-and-fixes.md
git commit -m "docs(superpowers): spec + plan for the 2026-06 repo cleanup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 1 — Production bug fixes (branch `cleanup/phase-1-bugfixes`)

### Task 1: Satellite-aware fill-opacity restore on compare exit

`useCompareViewDimming`'s exit branch restores the vector-mode `DEFAULT_FILL_OPACITY` (0.28 hover / 0.05 base) even in satellite mode, whose baseline is 0.32 / 0.03 (set in `useSatelliteMode`, which does not re-run when `compareWith` changes). The border restore in the same block is already satellite-aware via `applyBorderPaintForMode`; the fill must be too.

**Files:**

- Modify: `src/lib/mapLayers.ts` (after the `DEFAULT_FILL_OPACITY` export, ~line 164)
- Modify: `src/hooks/useSatelliteMode.ts:55-65`
- Modify: `src/hooks/useCompareViewDimming.ts:2-8, 54`
- Test: `src/hooks/__tests__/useCompareViewDimming.test.tsx`

- [ ] **Step 1: Write the failing test** — add after the existing `'restores satellite border paint when compareWith clears in satellite mode'` test (it checks borders but not fill — this is the gap):

```tsx
it('restores the satellite fill opacity when compareWith clears in satellite mode', () => {
  const fake = makeFakeMap()
  renderHook(
    () =>
      useCompareViewDimming({
        loaded: true,
        compareWith: null,
        satellite: true,
        resolvedTheme: 'light',
      }),
    { wrapper: makeWrapper(fake) },
  )
  const fillCall = fake.calls.setPaintProperty.find(
    (c) => c[0] === 'country-fill' && c[1] === 'fill-opacity',
  )
  // Satellite keeps the base fill nearly transparent (0.03) so imagery shows
  // through — not the vector default (0.05).
  expect(fillCall?.[2]).toEqual([
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    0.32,
    0.03,
  ])
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useCompareViewDimming.test.tsx`
Expected: FAIL — received expression ends `0.28, 0.05` (the vector default).

- [ ] **Step 3: Add the shared mode-aware opacity helper** in `src/lib/mapLayers.ts`, directly below the `DEFAULT_FILL_OPACITY` export:

```ts
/** The `country-fill` opacity in satellite mode: near-transparent base (3%)
 *  so imagery shows through, 32% on hover. */
export const SATELLITE_FILL_OPACITY: maplibregl.ExpressionSpecification = [
  'case',
  ['boolean', ['feature-state', 'hover'], false],
  0.32,
  0.03,
]

/** The `country-fill` opacity for the current visual mode. One edit-point so
 *  useSatelliteMode and useCompareViewDimming restore the same baseline
 *  (mirrors applyBorderPaintForMode for borders). */
export function fillOpacityForMode(satellite: boolean): maplibregl.ExpressionSpecification {
  return satellite ? SATELLITE_FILL_OPACITY : DEFAULT_FILL_OPACITY
}
```

- [ ] **Step 4: Use it in `useSatelliteMode.ts`** — replace lines 55-65:

```ts
applyBorderPaintForMode(map, { isDark: resolvedTheme === 'dark', satellite })
map.setPaintProperty(LAYER.fill, 'fill-opacity', fillOpacityForMode(satellite))
```

and change the import (line 2) to:

```ts
import { applyBorderPaintForMode, fillOpacityForMode, LAYER } from '../lib/mapLayers'
```

(`DEFAULT_FILL_OPACITY` is no longer imported here.)

- [ ] **Step 5: Use it in `useCompareViewDimming.ts`** — in the imports, replace `DEFAULT_FILL_OPACITY,` with `fillOpacityForMode,`; in the `else` branch replace

```ts
map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
```

with

```ts
map.setPaintProperty(LAYER.fill, 'fill-opacity', fillOpacityForMode(satellite))
```

- [ ] **Step 6: Run the test file — all green**

Run: `npx vitest run src/hooks/__tests__/useCompareViewDimming.test.tsx`
Expected: PASS (7 tests, including the existing non-satellite restore test, which only asserts the value is an array).

- [ ] **Step 7: Commit**

```bash
git add src/lib/mapLayers.ts src/hooks/useSatelliteMode.ts src/hooks/useCompareViewDimming.ts src/hooks/__tests__/useCompareViewDimming.test.tsx
git commit -m "fix(map): restore satellite fill opacity when exiting compare view

Exiting compare while in satellite mode reapplied the vector-mode
fill-opacity (0.28/0.05) instead of the satellite baseline (0.32/0.03).
Extract fillOpacityForMode so both hooks share one baseline definition,
mirroring applyBorderPaintForMode.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 2: Inert unmatched border chips in compare columns

`CountryColumn` renders border codes without a canonical match (reachable codes: UNK, ESH, GUF, HKG, MAC, GIB — e.g. Morocco → ESH) as clickable buttons. Clicking writes an unresolvable hash, which `useSelectedCountry` clears — dismissing the whole compare panel. `SingleCountryPanel` already renders these as inert spans.

**Files:**

- Create: `src/components/__tests__/CountryColumn.test.tsx`
- Modify: `src/components/CountryColumn.tsx:95-105`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountryColumn } from '../CountryColumn'
import { makeCountry } from './singleCountryPanelTestUtils'

describe('CountryColumn border chips', () => {
  it('renders unmatched border codes as inert text, not buttons', () => {
    const morocco = makeCountry({
      cca3: 'MAR',
      ccn3: '504',
      name: { common: 'Morocco', official: 'Kingdom of Morocco' },
      borders: ['DZA', 'ESH', 'ESP'],
    })
    const algeria = makeCountry({
      cca3: 'DZA',
      ccn3: '012',
      name: { common: 'Algeria', official: "People's Democratic Republic of Algeria" },
    })
    const spain = makeCountry({
      cca3: 'ESP',
      ccn3: '724',
      name: { common: 'Spain', official: 'Kingdom of Spain' },
    })
    const byCca3 = new Map([
      ['DZA', algeria],
      ['ESP', spain],
    ])
    render(
      <CountryColumn
        country={morocco}
        byCca3={byCca3}
        onSelect={vi.fn()}
        onClose={() => {}}
        badgeLetter="A"
        badgeColor="a"
        showColumnClose={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'Algeria' })).toBeTruthy()
    // ESH (Western Sahara) is not in the canonical 195 — it must not be
    // clickable: selecting it writes an unresolvable hash, which clears the
    // selection and closes the whole compare panel.
    expect(screen.queryByRole('button', { name: 'ESH' })).toBeNull()
    expect(screen.getByText('ESH')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/__tests__/CountryColumn.test.tsx`
Expected: FAIL — `queryByRole('button', { name: 'ESH' })` finds a button.

- [ ] **Step 3: Implement** — replace the borders `.map` callback body in `CountryColumn.tsx` (currently lines 95-106) with:

```tsx
{
  country.borders.slice(0, 6).map((code) => {
    const neighbor = byCca3.get(code)
    if (!neighbor) {
      // No canonical match (e.g. ESH, HKG) — render inert, matching
      // SingleCountryPanel. Clicking would write an unresolvable
      // hash, clearing the selection and closing the panel.
      return (
        <span
          key={code}
          className="px-2 py-0.5 text-[11px] rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100"
        >
          {code}
        </span>
      )
    }
    return (
      <button
        key={code}
        onClick={() => onSelect(code)}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 transition-colors"
      >
        {neighbor.name.common}
      </button>
    )
  })
}
```

- [ ] **Step 4: Run the test — green**

Run: `npx vitest run src/components/__tests__/CountryColumn.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CountryColumn.tsx src/components/__tests__/CountryColumn.test.tsx
git commit -m "fix(compare): render unmatched border chips as inert text

Clicking a border code with no canonical match (ESH, HKG, UNK, GUF, MAC,
GIB) wrote an unresolvable hash, which cleared the selection and closed
the compare panel. Mirror SingleCountryPanel's inert-span treatment.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Fix conflicting alignment classes on GameOverOverlay

**Files:**

- Modify: `src/game/shared/hud/GameOverOverlay.tsx:54`

- [ ] **Step 1: Replace the class string** — `items-center sm:items-center items-end` declares two competing base alignments. Intended: bottom-sheet on mobile, centered from `sm:` up.

Old:

```tsx
className =
  'fixed inset-0 z-[60] flex items-center sm:items-center items-end justify-center p-4 bg-black/30 backdrop-blur-sm'
```

New:

```tsx
className =
  'fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm'
```

- [ ] **Step 2: Verify and commit**

Run: `npm run check`
Expected: green.

```bash
git add src/game/shared/hud/GameOverOverlay.tsx
git commit -m "fix(hud): resolve conflicting base alignment classes on game-over overlay

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 4: Phase 1 verification + PR

- [ ] **Step 1:** `npm run check` — green.
- [ ] **Step 2:** Targeted e2e (kill dev servers first): `npx playwright test --project=chromium compare-view-dimming.spec.ts panel-and-deeplink.spec.ts` — Expected: PASS.
- [ ] **Step 3:** Open PR `fix: compare-exit satellite paint, unmatched compare chips, overlay alignment`.

---

## Phase 2 — Dead-code sweep (branch `cleanup/phase-2-dead-code`)

### Task 5: Delete `relativeTime` (news-feed leftover)

**Files:**

- Delete: `src/lib/relativeTime.ts`, `src/lib/__tests__/relativeTime.test.ts`

- [ ] **Step 1: Confirm zero production consumers**

Run: `grep -rn "relativeTime" src/ e2e/ scripts/ --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v "lib/relativeTime.ts"`
Expected: no output.

- [ ] **Step 2: Delete + verify + commit**

```bash
git rm src/lib/relativeTime.ts src/lib/__tests__/relativeTime.test.ts
npm run check
git commit -m "chore: delete relativeTime — dead since the news-feed removal (PR #40)

Its only consumer was its own test.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 6: Remove `REVEAL_FAR` and fix the reveal-palette comments

**Files:**

- Modify: `src/lib/mapPalette.ts:8-11`

- [ ] **Step 1: Replace lines 8-11** — `REVEAL_FAR` is unused, and the comments describe a three-band distance-coloring scheme that exists nowhere (actual use: binary correct/wrong border color; arc + markers are amber):

```ts
/** Reveal-feedback palette — useRevealMapEffects colors the target-country
 *  border by outcome; the reveal arc and target marker are amber. */
export const REVEAL_CORRECT = '#22c55e' // green-500 — correct-guess border
export const REVEAL_WRONG = '#f59e0b' // amber-500 — wrong-guess border, reveal arc + markers
```

- [ ] **Step 2: Verify + commit**

Run: `npm run check`
Expected: green (nothing imports `REVEAL_FAR`).

```bash
git add src/lib/mapPalette.ts
git commit -m "chore(map): drop unused REVEAL_FAR; correct reveal-palette comments

The comments described a distance-band coloring scheme that was never
built; actual use is binary correct/wrong.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 7: Delete five dead CSS keyframes

**Files:**

- Modify: `src/index.css`

- [ ] **Step 1: Confirm they are unreferenced**

Run: `grep -rn "shimmer\|launcher-exit\|launcher-streak-in\|launcher-history-in\|launcher-milestone-in" src/ --include=*.tsx --include=*.ts`
Expected: no output (definitions live only in index.css).

- [ ] **Step 2: Delete these five `@keyframes` blocks** from `src/index.css`: `shimmer` (~line 138), `launcher-exit` (~184), `launcher-streak-in` (~189), `launcher-history-in` (~200), `launcher-milestone-in` (~212). The last three are daily/retention leftovers.

- [ ] **Step 3: Verify + commit**

Run: `npm run check && npm run build`
Expected: green.

```bash
git add src/index.css
git commit -m "chore(css): delete five unused keyframes (daily/retention leftovers)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 8: Remove dead `GameMode.title/description/hashSegment` and the triplicated mode copy

`LauncherModeCard` carries its own TITLE/SUBTITLE records; `listModes()`' titles/descriptions and `GameMode.title/description` are never read. The hash is built from `modeId` via `writeHash`, so `hashSegment` is also a candidate (verify first).

**Files:**

- Modify: `src/game/shared/types.ts` (GameMode)
- Modify: `src/game/modes/index.ts`, `src/game/modes/country-pinning/index.tsx`, `src/game/modes/city-guessing/index.tsx`
- Modify: `src/game/modes/country-pinning/messages.ts`, `src/game/modes/city-guessing/messages.ts`
- Modify: `src/components/Launcher.tsx`
- Modify: `src/game/hooks/__tests__/useGameTestSeams.test.tsx:26-28` (mode stub; `fixtures.ts` holds only pool fixtures and needs no change — verified)

- [ ] **Step 1: Verify the dead surface**

Run: `grep -rn "\.title\b\|\.description\b\|hashSegment\|listModes" src/ e2e/ --include=*.ts --include=*.tsx`
Expected: `.title`/`.description` hits only in the two mode `index.tsx` definitions, `FirstSessionTutorial` (`copy.title` — unrelated, keep), and possibly test fixtures; `hashSegment` hits only in `types.ts` + the two mode definitions; `listModes` hits only in `modes/index.ts` + `Launcher.tsx`. If `hashSegment` has any other consumer, keep it and skip its removal below.

- [ ] **Step 2: Slim the `GameMode` contract** in `src/game/shared/types.ts` — remove `title: string`, `description: string`, `hashSegment: string`:

```ts
export type GameMode = {
  id: ModeId
  maxRounds: number | null
  HudComponent: React.FC<{ session: GameSession }>
  nextRound(used: Set<string>): RoundSpec
  onGuess(input: GuessInput, round: RoundSpec): ModeGuessResult
}
```

- [ ] **Step 3: Update both mode factories.** In `country-pinning/index.tsx` remove the `title:`, `description:`, `hashSegment:` lines and the now-unused `import { MESSAGES } from './messages'`. Same in `city-guessing/index.tsx` (its MESSAGES import also becomes unused — remove).

- [ ] **Step 4: Replace `listModes()` with a plain id list** in `src/game/modes/index.ts`:

```ts
/** Launcher card order. */
export const MODE_IDS: readonly ModeId[] = ['country-pinning', 'city-guessing']
```

(delete the `listModes` function).

- [ ] **Step 5: Update `Launcher.tsx`** — import `MODE_IDS` instead of `listModes`, delete `const modes = listModes()` and its comment, and render:

```tsx
{
  MODE_IDS.map((id, i) => (
    <div key={id} style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}>
      <LauncherModeCard modeId={id} onPlay={() => startFree(id)} />
    </div>
  ))
}
```

- [ ] **Step 6: Delete the now-dead MESSAGES keys.** `country-pinning/messages.ts` keeps only the two consumed entries:

```ts
export const MESSAGES = {
  correct: (points: number, name: string) => `Correct! +${points} points. That was ${name}.`,
  wrong: (points: number, target: string, clicked: string | null) =>
    clicked
      ? `Wrong — that was ${clicked}. +${points} points. The answer was ${target}. −1 life.`
      : `Wrong. +${points} points. The answer was ${target}. −1 life.`,
}
```

`city-guessing/messages.ts` keeps:

```ts
export const MESSAGES = {
  revealCorrect: (name: string) => `Spot on! You found ${name}.`,
  revealNear: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. That was ${name}.`,
  revealFar: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. ${name} was over there.`,
  revealSkipped: (name: string) => `Skipped. ${name} was there.`,
  skipButton: 'Skip round',
}
```

(Confirm with `grep -rn "MESSAGES\." src/` that no removed key is referenced; expected consumers afterwards: `CountryPinningHud` correct/wrong, `CityGuessingHud` reveal\*/skipButton.)

- [ ] **Step 7: Fix the test stub that satisfies the old type.** In `src/game/hooks/__tests__/useGameTestSeams.test.tsx`, delete these three lines from the inline `GameMode` stub (currently lines 26-28):

```ts
    title: 'Country Pinning',
    description: '',
    hashSegment: 'country-pinning',
```

- [ ] **Step 8: Verify + commit**

Run: `npm run check`
Expected: green (typecheck proves nothing consumed the removed members).

```bash
git add src/game/shared/types.ts src/game/modes/ src/components/Launcher.tsx src/game/hooks/__tests__/
git commit -m "chore(game): drop unused GameMode.title/description/hashSegment and listModes copy

Mode card copy lives in LauncherModeCard; the hash is built from modeId.
Three sources of the same strings, one consumed — keep the consumed one.
Announcement-string routing through messages.ts is a roadmap item.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 9: Remove the unused Fuse match plumbing (user decision: no highlighting)

**Files:**

- Modify: `src/hooks/useCountrySearch.ts` (full replacement below)
- Modify: `src/components/SearchBar.tsx` (mechanical `result.country` → `country`)
- Modify: `src/hooks/__tests__/useCountrySearch.test.ts` (mechanical)

- [ ] **Step 1: Replace `useCountrySearch.ts` with:**

```ts
import { useMemo, useState, useEffect, useRef } from 'react'
import Fuse, { type IFuseOptions } from 'fuse.js'
import type { CountryData } from '../lib/types'

const FUSE_OPTIONS: IFuseOptions<CountryData> = {
  keys: [
    { name: 'name.common', weight: 2.0 },
    { name: 'name.official', weight: 1.5 },
    { name: 'capital', weight: 1.0 },
    { name: 'region', weight: 0.5 },
    { name: 'subregion', weight: 0.5 },
    { name: 'cca2', weight: 0.3 },
    { name: 'cca3', weight: 0.3 },
  ],
  threshold: 0.4,
}

const MAX_RESULTS = 8
const DEBOUNCE_MS = 150

export function useCountrySearch(countries: CountryData[], query: string): CountryData[] {
  const fuse = useMemo(() => new Fuse(countries, FUSE_OPTIONS), [countries])
  const [results, setResults] = useState<CountryData[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    timerRef.current = setTimeout(() => {
      setResults(fuse.search(query, { limit: MAX_RESULTS }).map((r) => r.item))
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fuse, query])

  return results
}
```

(`SearchResult`, `includeMatches`, and the `FuseResultMatch` import are gone — the match data was computed and never rendered.)

- [ ] **Step 2: Update `SearchBar.tsx`** — six mechanical substitutions:
  1. `selectResult(results[activeIndex].country)` → `selectResult(results[activeIndex])`
  2. `results.map((result, index) => (` → `results.map((country, index) => (`
  3. `key={result.country.cca3}` → `key={country.cca3}`
  4. `onClick={() => selectResult(result.country)}` → `onClick={() => selectResult(country)}`
  5. `src={result.country.flag}` → `src={country.flag}`
  6. All remaining `result.country.` reads (`name.common`, `capital.length`, `capital[0]`, `region` ×2) → `country.`

  Then `grep -n "result\." src/components/SearchBar.tsx` — Expected: no output.

- [ ] **Step 3: Update the hook test** — in `src/hooks/__tests__/useCountrySearch.test.ts`, exactly three accesses change (lines 76, 88, 100): `result.current[0]?.country.cca3` → `result.current[0]?.cca3`. Nothing in the file asserts `matches`, and `SearchResult` has no other consumers (verified) — no further changes.

- [ ] **Step 4: Verify + commit**

Run: `npm run check`, then `npx playwright test --project=chromium search.spec.ts a11y-contrast.spec.ts`
Expected: green.

```bash
git add src/hooks/useCountrySearch.ts src/components/SearchBar.tsx src/hooks/__tests__/useCountrySearch.test.ts
git commit -m "chore(search): drop unused Fuse match plumbing

includeMatches data was computed on every query and never rendered; the
documented highlighting was never built (now a roadmap item).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 10: Drop the stale daily block from .gitignore + stale comments

**Files:**

- Modify: `.gitignore:7-9`
- Modify: `e2e/helpers.ts:264, 340`; `e2e/canonical-195.spec.ts:5-7`; `src/game/hooks/__tests__/useGameTestSeams.test.tsx:8`

- [ ] **Step 1: .gitignore** — delete the three daily lines:

```
# Daily content — generated on demand (lives on the `data` branch in prod)
public/daily/index.json
.daily-data/
```

- [ ] **Step 2: Remove the local leftover** (untracked, ignored — not a commit):

PowerShell: `Remove-Item -Recurse -Force public/daily`

- [ ] **Step 3: Stale comment fixes**
  - `e2e/helpers.ts:264`: `* All localhost requests (app assets, daily API stubs, etc.) pass through` → `* All localhost requests (app assets, preview-server routes) pass through`
  - `e2e/helpers.ts:340`: `// Let all localhost requests pass through (app assets, daily API stubs, etc.)` → `// Let all localhost requests pass through (app assets, preview-server routes)`
  - `e2e/canonical-195.spec.ts:5-7`: replace the two-generations-stale subtitle comment with: `// The launcher subtitle intentionally carries no country count; the canonical-195 guarantee is asserted against the bundled data and rendered map layers below.`
  - `src/game/hooks/__tests__/useGameTestSeams.test.tsx:8`: delete the clause mentioning `DailyPuzzlesProvider` (component no longer exists); keep the rest of the rationale sentence.

- [ ] **Step 4: Verify + commit + PR**

Run: `npm run check`
Expected: green.

```bash
git add .gitignore e2e/helpers.ts e2e/canonical-195.spec.ts src/game/hooks/__tests__/useGameTestSeams.test.tsx
git commit -m "chore: drop daily-feature residue from .gitignore and comments

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Open PR `chore: dead-code sweep (news/daily leftovers, unused plumbing)`.

---

## Phase 3 — Test hygiene (branch `cleanup/phase-3-test-hygiene`)

### Task 11: Make the corrupt-storage test exercise the real parse path

The existing test corrupts the **v1** key, which `readSafely` deletes without parsing — it passes even with all corruption handling removed.

**Files:**

- Modify: `src/game/shared/__tests__/usePersonalBests.test.ts:41-45`

- [ ] **Step 1: Replace the test:**

```ts
it('falls back to zeros when the v2 key holds corrupt JSON', () => {
  localStorage.setItem('funworldmap-game-country-pinning-bests-v2', 'not-json')
  const { result } = renderHook(() => usePersonalBests('country-pinning'))
  expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
})
```

- [ ] **Step 2: Prove it tests the catch** — temporarily change `personalBestsStore.ts`'s `catch { return ZERO }` to `catch { return { bestScore: 99, bestStreak: 0, gamesPlayed: 0 } }`, run `npx vitest run src/game/shared/__tests__/usePersonalBests.test.ts`, see the new test FAIL, revert the store change, see PASS.

- [ ] **Step 3: Commit**

```bash
git add src/game/shared/__tests__/usePersonalBests.test.ts
git commit -m "test(bests): corrupt the v2 key so the JSON.parse fallback is actually exercised

The old test corrupted the v1 key, which readSafely deletes unparsed.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 12: Fix the misnamed/duplicated GameOverOverlay test

Test 1 is named "unlimited mode" but passes `maxRounds: 10` and duplicates test 2; the `'Three wrong guesses.'` branch (`maxRounds === null`) is asserted nowhere.

**Files:**

- Modify: `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx:22-34`

- [ ] **Step 1: Replace test 1 with:**

```tsx
it("says 'Three wrong guesses.' on unlimited (lives) mode", () => {
  render(
    <GameOverOverlay
      session={{ ...baseSession, maxRounds: null }}
      personalBest={zeroBest}
      beatPersonalBest={false}
      onPlayAgain={() => {}}
      onBackToMap={() => {}}
    />,
  )
  expect(screen.getByTestId('game-over-title').textContent).toBe('Game over')
  expect(screen.getByText('Three wrong guesses.')).toBeTruthy()
})
```

- [ ] **Step 2: Run + commit**

Run: `npx vitest run src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`
Expected: PASS (6 tests).

```bash
git add src/game/shared/hud/__tests__/GameOverOverlay.test.tsx
git commit -m "test(hud): cover the 'Three wrong guesses.' branch; drop duplicated assertion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 13: Delete the dead city-skip test; fix stale enforce-vs-collect headers

**Files:**

- Modify: `e2e/game-city-guessing.spec.ts` (~lines 85-90)
- Modify: `e2e/axe-snapshot.spec.ts` (header ~lines 6-7 and 33-35; unused import line 22)
- Modify: `e2e/label-contrast.spec.ts` (header ~lines 9-10)

- [ ] **Step 1:** In `game-city-guessing.spec.ts`, delete the test `'skip round scores 0 via the skip button'` — it neither clicks skip nor checks a score; it only re-asserts `city-skip` visibility already covered by the first test. The real skip coverage lives in the adjacent tests.
- [ ] **Step 2:** In `axe-snapshot.spec.ts`: remove `finalizeGame` from the imports (unused; the spec clicks `game-end`); replace the header sentences claiming "Violations are COLLECTED, not enforced … to establish a baseline, not to block the build" and "We never throw — the spec is baseline-collection-only" with: `Violations FAIL the suite — every audit below asserts an empty violations array.`
- [ ] **Step 3:** In `label-contrast.spec.ts`: replace the "BASELINE COLLECTION MODE … do NOT fail the test" header sentence with: `The Phase-3.10 thresholds below are HARD assertions — contrast regressions fail this spec.`
- [ ] **Step 4: Verify + commit**

Run: `npx playwright test --project=chromium game-city-guessing.spec.ts`
Expected: PASS.

```bash
git add e2e/game-city-guessing.spec.ts e2e/axe-snapshot.spec.ts e2e/label-contrast.spec.ts
git commit -m "test(e2e): drop a no-op test; align axe/contrast headers with their hard assertions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 14: Give the WebGL retry test real assertions

The current test accepts every post-click outcome (assertion wrapped in a swallowing `.catch`); it can only fail if the click throws. It also uses the deprecated `page.waitForNavigation`.

**Files:**

- Modify: `e2e/webgl-context-loss.spec.ts:22-57`

- [ ] **Step 1: Replace the second test with:**

```ts
test('retry button recovers the map after webgl-lost', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await ensureLauncherDismissed(page)
  await waitForCountryTilesRendered(page)

  await forceWebGLContextLoss(page)
  await expect(page.locator('[data-map-error="webgl-lost"]')).toBeAttached()
  await expect(page.getByTestId('map-error-retry')).toBeVisible()

  await page.getByTestId('map-error-retry').click()

  // retryWebGL() calls restoreContext(); if the context doesn't restore
  // within 1 s the app falls back to a full reload. Both paths converge on
  // a loaded map with no error overlay — assert that end state.
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
  await expect(page.getByTestId('map-error-overlay')).not.toBeVisible()
})
```

- [ ] **Step 2: Verify stability** (this spec runs on CI, so prove it locally first)

Run: `npx playwright test --project=chromium webgl-context-loss.spec.ts --repeat-each=10`
Expected: 30/30 pass. If the retry test is unstable, quarantine it per CLAUDE.md (conditional `test.fixme(!!process.env.CI, ...)` + tracking issue) — do NOT re-weaken the assertions.

- [ ] **Step 3: Commit**

```bash
git add e2e/webgl-context-loss.spec.ts
git commit -m "test(e2e): assert actual recovery in the webgl-lost retry test

The old test accepted every outcome (navigation, none, overlay present
or gone) and could only fail if the click threw.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 15: Remove the forbidden `.first()` patterns

**Files:**

- Modify: `e2e/panel-focus.spec.ts:6-18, 27-28`
- Modify: `e2e/a11y-contrast.spec.ts:~47`
- Modify: `e2e/source-tooltip-edge.spec.ts:~27-28` (comment only)

- [ ] **Step 1: panel-focus** — replace the helper (it is CLAUDE.md's literal forbidden example):

```ts
// Search for a country and click its result by name (never .first() — Fuse
// ordering is not a contract; see CLAUDE.md).
async function searchAndOpenPanel(page: Page, query: string, name: RegExp) {
  await page.getByTestId('search-input').fill(query)
  const option = page.getByTestId('search-results').getByRole('option', { name })
  await expect(option).toBeVisible({ timeout: 15_000 })
  await option.click()
  const panel = page.getByTestId('country-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await waitForAnimationIdle(panel, 30_000)
  return panel
}
```

and the call site: `await searchAndOpenPanel(page, 'France', /^France\s/)`.

- [ ] **Step 2: a11y-contrast** — replace the `.first()` option locator after `fill('Germany')` with `page.getByTestId('search-results').getByRole('option', { name: /^Germany\s/ })`.

- [ ] **Step 3: source-tooltip-edge** — the `.first()` here is positionally load-bearing (the test needs an 'i' button near the panel's left edge) but the comment is misleading. Replace the comment with: `// First Source button in DOM order = the Capital cell (first DataCell). The edge test only needs an 'i' button near the panel's left edge; update if cell order changes.`

- [ ] **Step 4: Verify + commit + PR**

Run: `npx playwright test --project=chromium panel-focus.spec.ts a11y-contrast.spec.ts source-tooltip-edge.spec.ts`
Expected: PASS.

```bash
git add e2e/panel-focus.spec.ts e2e/a11y-contrast.spec.ts e2e/source-tooltip-edge.spec.ts
git commit -m "test(e2e): replace .first() on search results with named-option locators

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Open PR `test: suite hygiene — real assertions, no .first(), honest headers`.

---

## Phase 4 — CI & config honesty (branch `cleanup/phase-4-ci-honesty`)

### Task 16: Config cleanup + tracking issue

**Files:**

- Modify: `playwright.config.ts:64, 93-99`

- [ ] **Step 1:** Delete line 64: `'reduced-motion-game-start.spec.ts',` — the spec was removed in `648315c` without config cleanup; the entry silently matches nothing.
- [ ] **Step 2 (needs user-visible action — confirm before running):** create the tracking issue CLAUDE.md's quarantine rules require:

```bash
gh issue create --title "Restore CI e2e coverage for the 10 testIgnore'd specs (needs GPU runner)" --body "The chromium project's testIgnore excludes these specs on CI (cold-WebGL flake on GitHub-hosted runners without a GPU): label-contrast, header-play-reopens-launcher, panel-focus, accessibility, axe-snapshot, reveal-animation, search, game-country-pinning, theme-and-responsive, source-tooltip-edge.

Combined with the chromium-only CI matrix (mobile-smoke, mobile-tap, mobile-free-play also local-only), 13 of 38 spec files never run on CI — including one of the two game modes and both axe audits.

Exit criterion: self-hosted GPU runner (docs/roadmap.md § 'Flaky-on-free-CI specs'), then delete the testIgnore block. Context: docs/superpowers/notes/2026-05-05-flake-watch.md."
```

Record the issue number `#N` for the next steps.

- [ ] **Step 3:** In the `testIgnore` comment block (lines 93-98), append: `// Tracking issue: #N`.
- [ ] **Step 4:** `npx playwright test --list --project=chromium` — Expected: config parses and lists tests with no missing-file errors (35 chromium spec files remain after the deletion).

### Task 17: CLAUDE.md corrections

**Files:**

- Modify: `CLAUDE.md` (intro paragraph of the e2e section; quarantine section)

- [ ] **Step 1:** Replace `` `chromium` (real-GPU-backed ANGLE on Linux) `` with `` `chromium` (ANGLE — real GPU locally; GitHub-hosted CI has no GPU and falls back to software rendering) ``.
- [ ] **Step 2:** After quarantine rule 4, add:

```markdown
**Beyond `test.fixme`:** ten whole specs are excluded on CI via the `chromium`
project's `testIgnore` (no GPU on free runners — tracking issue #N), and CI runs
only the chromium project, so the three mobile-only specs don't run there either.
**13 of 38 specs are local-only.** See `docs/systems/testing.md` § "What runs in
CI" before assuming CI covered your change.
```

- [ ] **Step 3:** Commit both:

```bash
git add playwright.config.ts CLAUDE.md
git commit -m "chore(ci): honest GPU/coverage description; drop dangling testMatch entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 18: testing.md "What runs in CI" + ci.yml comment hygiene

**Files:**

- Modify: `docs/systems/testing.md` (new subsection after "Test Organization")
- Modify: `.github/workflows/ci.yml:58-65, 83-91`

- [ ] **Step 1:** Add to `testing.md`:

```markdown
## What runs in CI

CI (`.github/workflows/ci.yml`) runs the **chromium project only**, sharded
4-way. The mobile / WebKit / Firefox projects are local opt-in
(`--project=<name>`); putting them in the CI matrix is gated on a green
cross-browser baseline (roadmap). On top of that, the chromium project's
`testIgnore` excludes ten specs on CI pending a self-hosted GPU runner
(tracking issue #N; `docs/roadmap.md` § "Flaky-on-free-CI specs").

Net effect: **13 of 38 spec files run locally only** — the ten `testIgnore`d
specs plus `mobile-smoke`, `mobile-tap`, and `mobile-free-play`. Run them
before merging changes that touch their areas:

    npx playwright test --project=chromium            # what CI runs (minus testIgnore)
    npx playwright test --project=mobile-chromium     # mobile coverage
    npx playwright test --project=chromium search.spec.ts   # a CI-skipped spec
```

Also in `testing.md`'s Test Organization tree: `# ~39 specs total — see playwright.config.ts testMatch` → `# 38 specs total — see playwright.config.ts testMatch`.

- [ ] **Step 2: ci.yml comments:**
  - Delete the sentence `Per Promaton/Snider 2026-02 research, just having Mesa available gives ~3x speedup on WebGL-heavy tests even without any GPU acceleration.` (unverifiable citation; the adjacent flake-watch note shows the next run was _slower_). Replace with: `Mesa/llvmpipe is markedly faster than SwiftShader for WebGL2 paths.`
  - `# 4-way sharding: split the ~215-spec chromium suite across 4 parallel` → `# 4-way sharding: split the chromium suite (~215 test cases) across 4 parallel`
  - `# runners. Each shard runs ~50 specs in ~7 min wall-clock instead of` → `# runners. Each shard runs ~55 test cases in ~7 min wall-clock instead of`

- [ ] **Step 3: Commit + PR**

```bash
git add docs/systems/testing.md .github/workflows/ci.yml
git commit -m "docs(testing): document what actually runs in CI; scrub unverifiable citation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Open PR `chore: CI coverage honesty pass`.

---

## Phase 5 — Living-docs reconciliation (branch `cleanup/phase-5-docs`)

Single PR; one commit per file-cluster is fine. All edits are exact old → new.

### Task 19: Rewrite `docs/testing/playwright-matrix.md`

- [ ] **Step 1:** Replace the entire file (it lists ten deleted daily specs as live, a 13-entry testIgnore at wrong line numbers, and daily-mode caveats) with:

```markdown
# Playwright Project Matrix

Which Playwright project runs which spec, and why. Kept in sync with
`playwright.config.ts` — if you change a `testMatch`/`testIgnore` there,
update this file in the same PR.

## Projects

| Project                 | Engine   | Viewport                   | Touch | GPU                                               | Purpose                                                                    |
| ----------------------- | -------- | -------------------------- | ----- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `chromium`              | Chromium | Desktop                    | No    | ANGLE (real GPU locally; software fallback on CI) | All desktop specs; consolidated from chromium + chromium-gpu on 2026-05-02 |
| `mobile-chromium`       | Chromium | Pixel 7 (412×915)          | Yes   | ANGLE                                             | Mobile-viewport regression coverage                                        |
| `mobile-webkit`         | WebKit   | iPhone 14                  | Yes   | Native                                            | Second mobile engine (DOM specs only)                                      |
| `desktop-firefox-touch` | Firefox  | 412×839 + `hasTouch: true` | Yes   | Native                                            | Gecko touch-event proxy. NOT a real Firefox-Android repro                  |

CI runs **chromium only** (4-way sharded). The other three projects are
local opt-in via `--project=<name>`. See `docs/systems/testing.md`
§ "What runs in CI".

### Known config caveats

- `permissions: ['clipboard-read', 'clipboard-write']` in the top-level `use`
  block is Chromium-only; `mobile-webkit` and `desktop-firefox-touch` override
  to `permissions: []` (both engines reject the strings). No spec in those
  projects exercises clipboard.
- The `chromium` project sets `reducedMotion: 'reduce'` globally so the
  `prefers-reduced-motion` CSS rule collapses animations — this removed the
  animation-actionability flake class. A spec that needs rich-motion behavior
  must opt back in per test via `page.emulateMedia(...)` (see
  `reveal-animation-reduced-motion.spec.ts` for the pattern).

## Spec assignment

| Spec                                                                                                                             | chromium | mobile-chromium | mobile-webkit | desktop-firefox-touch |
| -------------------------------------------------------------------------------------------------------------------------------- | :------: | :-------------: | :-----------: | :-------------------: |
| scaffold, canonical-195, meta-and-static, cold-load-deep-link                                                                    |    ✓     |                 |               |                       |
| search\*, theme-and-responsive\*, accessibility\*, a11y-contrast, a11y-keyboard-smoke, axe-snapshot\*, label-contrast\*          |    ✓     |                 |      ✓¹       |          ✓¹           |
| panel-and-deeplink, panel-focus\*, satellite-default, compare-source-attribution, source-tooltip-edge\*, source-tooltip-keyboard |    ✓     |                 |               |                       |
| launcher, launcher-focus-order, launcher-card-loading-states, launcher-backdrop-dismiss, header-play-reopens-launcher\*          |    ✓     |                 |      ✓²       |          ✓²           |
| map-and-countries, map-reliability, keyboard-map-nav, webgl-context-loss, compare-view-dimming, tutorial-first-click             |    ✓     |       ✓³        |               |                       |
| game-country-pinning\*, game-city-guessing, game-over-mode-switch, animation-interrupt                                           |    ✓     |                 |               |                       |
| reveal-animation\*, reveal-animation-reduced-motion                                                                              |    ✓     |                 |               |                       |
| mobile-panel-header                                                                                                              |    ✓     |                 |               |                       |
| mobile-smoke, mobile-tap                                                                                                         |          |        ✓        |       ✓       |           ✓           |
| mobile-free-play                                                                                                                 |          |        ✓        |               |                       |

¹ only `theme-and-responsive`. ² only `launcher-card-loading-states`.
³ only `tutorial-first-click`.
`*` = in the chromium `testIgnore` list on CI (runs locally only — see below).

## CI testIgnore (chromium, CI-only)

These 10 specs are excluded on CI pending a self-hosted GPU runner (tracking
issue #N; `docs/roadmap.md` § "Flaky-on-free-CI specs"). They run locally.

label-contrast · header-play-reopens-launcher · panel-focus · accessibility ·
axe-snapshot · reveal-animation · search · game-country-pinning ·
theme-and-responsive · source-tooltip-edge

Exit criterion: when the GPU runner lands, delete the `testIgnore` block and
this section.

## Quarantined tests (test.fixme on CI)

| Test                                                     | Spec file                           | Issue                                                       |
| -------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| rapid Continue click during panel slide-in (wrong guess) | `e2e/animation-interrupt.spec.ts`   | [#47](https://github.com/GranatenUdo/funworldmap/issues/47) |
| Escape mid-reveal (correct guess) skips the hold         | `e2e/animation-interrupt.spec.ts`   | [#47](https://github.com/GranatenUdo/funworldmap/issues/47) |
| Escape mid-panel-slide-in (wrong guess) skips the hold   | `e2e/animation-interrupt.spec.ts`   | [#47](https://github.com/GranatenUdo/funworldmap/issues/47) |
| game-over → hash-mode-switch race                        | `e2e/game-over-mode-switch.spec.ts` | [#32](https://github.com/GranatenUdo/funworldmap/issues/32) |

## Manual QA — out of CI scope

Real Firefox-for-Android cannot run in Playwright. `desktop-firefox-touch`
exercises the Gecko `clickTolerance: 8` path with synthetic touch only.
Before closing tickets that reference mobile Firefox, verify on a real
device: country-pinning tap registers, city-guessing tap registers, reveal
animations play. Record the verification in the PR thread.
```

(Substitute the real tracking-issue number for `#N` from Task 16.)

### Task 20: Fix the game test-contract docs

**Files:** `docs/testing/game-happy-paths.md`, `docs/testing/game-unhappy-paths.md`, `docs/testing/game-divergences-2026-05-11.md`

- [ ] **Step 1: happy-paths Scenario 1, Step 3** — replace the two "After" lines containing `Country panel is **not** opened (mid-game; panel is a post-reveal artifact only)` with:

```markdown
- After: Session transitions `playing → round-ended`. Score increases by 100. Streak increments. The target country's border highlights and the HUD shows a "correct" reveal line.
- After: **The country panel opens with the target country's data and a Continue button.** The panel renders for every country-pinning round-end — correct or wrong (`App.tsx` `roundEndTarget`); only the HUD reveal line differs by outcome.
```

- [ ] **Step 2: happy-paths Scenario 1, Step 4** — replace the step line with `4. **User clicks Continue, presses Enter / Space / Escape, or waits ~3 s.**` (the After lines stand).
- [ ] **Step 2b: happy-paths Scenario 1, Step 8 (final wrong guess)** — replace the suppression claim `After: Final wrong guess triggers `endsGame=true`. **The Continue-panel flow is suppressed in this terminal case** — auto-transition to `game-over` fires at ~3 s with no user input required. (Verified live 2026-05-11: lives 1→0 wrong guess produced game-over overlay at ~3 s.)` with `After: Final wrong guess triggers `endsGame=true`. The country panel still opens — the round-end panel renders regardless of `endsGame` (`App.tsx` `roundEndTarget`has no endsGame check); its Continue button, Enter / Space / Escape, or the ~3 s hold finalize to`game-over`.`
- [ ] **Step 2c: happy-paths Scenario 1, Steps 10–11 + negative-path** — no game-code camera reset exists (`flyToHome` is wired only to the Reset control and the Home key) and the launcher never auto-reopens after a game (`useLauncherVisibility` is explicitly map-first):
  - Step 10 After: delete `Map camera flies back to the default view.` and append `The camera stays where it is (no reset at game start — camera-coherence, 2026-05-17).`
  - Step 11 After: replace `After: `endGame`dispatched. Hash returns to`#`. Launcher reopens. Map camera flies back to the default view.` with `After: `endGame`dispatched; hash returns to`#`. The user lands on the bare map — the launcher does **not** auto-reopen (map-first; the header Play button reopens it). No camera reset.`
  - Negative-path note: replace `During play, pressing Escape opens an "End game?" confirm or directly dispatches `endGame` (depending on the launched flow). Either way, the user returns to the launcher without errors.` with `During play, Escape dispatches `endGame` directly (no confirm dialog) and returns to the bare map; the HUD's "End game" button instead finishes early to the game-over overlay (`finishFree`).`
- [ ] **Step 3: happy-paths Scenario 2 (city)** — five corrections:
  - Step 2 After: replace `Launcher unmounts. Map flies to a "world" view (zoomed-out, no specific country). HUD shows` with `Launcher unmounts. The camera stays where it is (no fly-to at game start). HUD shows` (no world-view fly-to exists in the game code).
  - Step 3's arc sentence: `A dashed geodesic arc animates from the click point to the true city for ~2 s.` → `A dashed geodesic arc animates from the click point to the true city (1.5–3 s, scaled by distance).`
  - Step 4's After: replace `Round advances at ~200-300 ms after the reveal renders (city mode does **not** have the 3 s country-mode hold). New city target appears in the HUD. Camera returns to a world view for the new round. (Verified live 2026-05-11.)` with `Round auto-advances after the arc animation completes (~1.8–3.3 s; 2 s fallback when no arc renders, e.g. a skip). New city target appears in the HUD. The camera stays where the reveal left it (near the previous target).`
  - Step 6: replace `Session transitions to `game-over` at ~1.5 s after the final attempt. Game-over overlay shows total score (**out of 1,000**, not 10,000) and best streak. (Verified live 2026-05-11.)` with `Session transitions to `game-over` after the same reveal hold. Game-over overlay shows total score (**out of 1,000**); the streak line appears only in country-pinning — fixed-round modes hide it.`
  - Special invariants: replace `The camera-reset between rounds is gated by reduced-motion (uses `flyToCountry`/ world-view helper). Confirm no jump occurs when`prefers-reduced-motion: reduce` is set.` with `There is no camera reset between rounds. The reveal's camera movement (`useRevealMapEffects` `easeTo`) collapses to an instant `jumpTo`under`prefers-reduced-motion: reduce`.`
- [ ] **Step 4: happy-paths cross-game invariants** — replace `exposes `submitGuessInput`, `finalize`, `endGame`` with `exposes `submitGuess`, `submitCountryGuess`, `setRound`, `getSession`, `endGame`, `finalize`, `restart``.
- [ ] **Step 5: unhappy-paths** — (a) after the verification-status blockquote add `> Line-number references below reflect the 2026-05-13 tree; the game-controller extraction (2026-05-14) moved most of them.`; (b) B2: `countries-10m.json` → `countries-50m.json`; (c) delete the whole `### B4` block (news feature removed in PR #40); (d) A9 Pre: drop `LauncherMilestoneOverlay` from the component list; (e) G5: `Modal dialogs (launcher, milestone overlay)` → `Modal dialogs (launcher, game-over overlay)`; (f) E1: replace `Per Scenario 1 Step 7 (happy paths): country panel **does NOT open** with Continue (because endsGame supersedes the wrong-guess-Continue flow).` with `The country panel still opens (the round-end panel renders regardless of `endsGame`); Continue, Enter / Space / Escape, or the ~3 s hold finalize to `game-over`.`; (g) D1: replace `launcher reopens, map camera flies to default view` with `the user returns to the bare map (no launcher auto-open, no camera reset)`.
- [ ] **Step 6: divergences report** — prepend after the Date/Build header block:

```markdown
> **Note (2026-06-12):** the companion `game-happy-paths.md` was rewritten after
> the daily-puzzle removal (PR #97); Scenarios 3–5 referenced below existed only
> in its pre-removal version (see git history).
```

- [ ] **Step 7: Commit**

```bash
git add docs/testing/
git commit -m "docs(testing): reconcile test-contract docs with the shipped game flow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 21: System docs vs code

**Files:** `docs/systems/ui-layout.md`, `accessibility.md`, `search.md`, `map-rendering.md`, `data-collection.md`, `analytics.md`, `overview.md`, `build.md`, `docs/ops/runbook.md`, `docs/adr/0002-url-hash-single-source-of-truth.md`, `docs/index.md`

- [ ] **Step 1: ui-layout.md** — Reset-view bullet: replace `Custom "Reset view" button — resets the camera to defaults (longitude 0, latitude 20, zoom 1.8, pitch 20°). If a country is selected, deselects it, closes the panel, and clears the URL hash.` with `Custom "Reset view" button — flies the camera back to the default world view (longitude 0, latitude 20, zoom 1.8, pitch 20°, bearing 0). It does not touch selection: an open panel and the URL hash are preserved. (The Home key does the same while the map has focus.)` Also: `Fixed width: 380px` → `Fixed width: 360px`.
- [ ] **Step 2: accessibility.md** — (a) map row `aria-description` value → `"Pan with arrow keys, zoom with plus/minus, reset view with Home, deselect with Escape"`; (b) Panel Tab row: drop `'i' tooltips` from the cycle list and append the note `Source 'i' buttons are intentionally outside the Tab order (tabIndex=-1) so blur-out closes them cleanly; they open on hover, click/tap, or programmatic focus — a documented trade-off.`; (c) Focus Management → Panel Open: replace the paragraph with `When the country panel opens, focus moves first to the panel heading (so screen readers announce the country name), then settles on the panel's close button once the slide-in completes (~300 ms). Keyboard users land on Close; the announcement still happens.`
- [ ] **Step 3: search.md** — delete Query Flow item 6 (`Match segments are highlighted in the country name`) and the dropdown bullet `Highlighted match segments in the name`.
- [ ] **Step 4: map-rendering.md** — (a) replace the zoom table + intro (from `**Zoom calculation**:` through the `Exact values are tuned…` line) with:

```markdown
**Zoom calculation**: `flyToCountry` derives a target zoom from the country's
area — `zoom = clamp(11 − 1.7·log₁₀(areaKm²), 2, 12)` — and never zooms _out_
below the user's current zoom (`Math.max(map.getZoom(), computed)`; see the
2026-05-17 country-click-preserve-zoom spec). Large countries resolve to the
clamp floor (zoom 2); only countries below roughly 100,000 km² pull the camera
in meaningfully (Luxembourg ≈ 5.2, Vatican ≈ 11.6).
```

(b) in the `flyTo` code sample: `duration: 1500` → `duration: 1400`; (c) after the three-layer table add: `These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER`in`src/lib/mapLayers.ts` (13 ids).`; (d) replace the dark-mode "Approach" bullet list with: `On theme toggle, `applyMapTheme` (`src/lib/mapColors.ts`) overrides a fixed set of basemap layers — background, water, waterway, park, building — with warm dark (or sand-light) fills, and recolors every symbol layer's text + halo. Layers outside that set keep their style defaults.`

- [ ] **Step 5: data-collection.md** — replace `If a source is unavailable during a run, the tool falls back to existing data for that source's fields and logs a warning.` with `If a source is unavailable during a run, the run fails and writes nothing — the previously committed countries.json stays in place. There is no per-source fallback.` Also swap pipeline boxes 3 and 4/5 so the order reads: 1 REST Countries → 2 CIA Factbook → 3 Merge & Enrich (+ validate vs world-atlas) → 4 Download SVG flags → 5 Write output (matching `scripts/fetch-countries.ts`).
- [ ] **Step 6: analytics.md** — replace `No-op when `window.**PLAYWRIGHT**`is set — the e2e harness captures events to`window.**testAnalytics` for assertion instead.` with `No-op when `window.**PLAYWRIGHT**` is set — a unit-test seam (`src/test/analyticsCapture.ts`) that captures events to `window.**testAnalytics`. E2e builds simply leave `VITE_ANALYTICS_ENDPOINT`empty, so`track()` is already a no-op there.`
- [ ] **Step 7: overview.md** — (a) bundle-table footnote: replace `The original <700 KB target predates Sentry and `cities.json`; re-baselining against a measured CI build is tracked as a roadmap item (bundle-size budgets in CI).` with `Budgets are enforced in CI by `scripts/bundle-budget/check.ts`against`scripts/bundle-budget/budgets.json` (total-with-async ceiling 820 KB gzip, set 2026-05-14 at measured + 10%).`; (b) diagram hook name `useMapInteraction` → `useMapInteractions`.
- [ ] **Step 8: build.md** — replace `Target: <700KB total gzipped including async geo data chunk.` with `Budgets are enforced in CI (`npm run bundle:budget`) against `scripts/bundle-budget/budgets.json` — total-with-async ceiling 820 KB gzip. Raising a budget requires measurement evidence in the PR.`
- [ ] **Step 9: runbook.md** — flag row `| flagcdn.com | Hotlinked at runtime | No-op |` → `| flagcdn.com (SVG flags) | Downloaded by update-data; bundled at build | Static |`
- [ ] **Step 10: ADR-0002** — replace `There is no parallel in-memory selection state that can diverge from the hash.` with `Components hold no independent selection state; `useSelectedCountry`re-derives from the hash on every`hashchange`, and mirrors the clear on deselect (which uses `history.replaceState`, firing no event).`
- [ ] **Step 11: docs/index.md** — after the Operations section, add:

```markdown
### Testing references

- [Playwright project matrix](testing/playwright-matrix.md) — which project runs which spec, CI exclusions, quarantines
- [Game happy paths](testing/game-happy-paths.md) / [unhappy paths](testing/game-unhappy-paths.md) — designed flows that test plans derive from
```

- [ ] **Step 12: Commit**

```bash
git add docs/
git commit -m "docs(systems): reconcile system docs with the shipped code

Reset-view, focus management, tooltips, search highlighting, zoom
formula, dark-mode overrides, data-collection failure mode, flag
sourcing, bundle budgets, analytics seam.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 22: Roadmap fixes + deferred items

**Files:** `docs/roadmap.md`

- [ ] **Step 1:** Strike the shipped item: wrap the `**Bundle-size budgets in CI** — …` bullet in `~~…~~` and append `**Done** (PR #50, 2026-05-14):`scripts/bundle-budget/check.ts`enforces`budgets.json`via`npm run bundle:budget` in CI.`
- [ ] **Step 2:** Fix the two broken links: `[`src/index.html`](../../src/index.html)` → `[`index.html`](../index.html)` (the bootstrap script lives in the repo-root `index.html`, lines ~29-42); `[`src/hooks/useMapInstance.ts`](../../src/hooks/useMapInstance.ts)` → `[`src/hooks/useMapInstance.ts`](../src/hooks/useMapInstance.ts)`.
- [ ] **Step 3:** Add before the "Rejected" section:

```markdown
## Deferred from the 2026-06 cleanup

Source: [`2026-06-11-repo-cleanup-and-fixes-design.md`](superpowers/specs/2026-06-11-repo-cleanup-and-fixes-design.md)

- **Shared unit-test utilities** — one `CountryData` factory + one matchMedia stub in `src/test/` to replace the five per-file factories and six bespoke matchMedia stubs.
- **`waitForMapLoaded(page)` e2e helper** — consolidate the ~9 hand-rolled `waitForSelector('[data-map-loaded]')` preambles; parameterise `routeMapTiles` with a style stub so `label-contrast.spec.ts` can drop its 70-line interceptor copy.
- **Search match highlighting** — re-introduce Fuse `includeMatches` only together with a UI that renders it (the plumbing was removed as dead).
- **Route game announcement strings through `messages.ts`** — `useGameAnnouncements` inlines its prompt strings; restore the i18n routing when i18n work starts.
- **Unit-test gaps** — `useSatelliteMode`, `useMapTheme`, `GameSessionProvider` pool/status guards, reducer `endGame`/`overrideRound` actions.
```

- [ ] **Step 4: Commit + PR**

```bash
git add docs/roadmap.md
git commit -m "docs(roadmap): strike shipped bundle-budget item; fix links; add cleanup deferrals

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Open PR `docs: reconcile living docs with the shipped app (round 2)`.

---

## Phase 6 — Superpowers corpus sweep (branch `cleanup/phase-6-corpus`)

### Task 23: Archive the 36 shipped plans

- [ ] **Step 1:** `git mv` each of these from `docs/superpowers/plans/` to `docs/superpowers/plans/archive/` (every one shipped; traced to merged PRs):

```
2026-04-19-assessment-remediation.md          2026-04-20-a11y-contrast-pass.md
2026-04-20-launcher-landing-state.md          2026-04-21-retention-program-v1-phase-1-foundation.md
2026-04-21-retention-program-v1-phase-2-daily-play.md  2026-04-22-deflake-chromium-e2e.md
2026-04-22-phase-4-share-flow.md              2026-04-22-phase-5a-a11y-axe-pass.md
2026-04-22-phase-5b-launch-prep.md            2026-04-22-retention-program-v1-phase-3-streak-calendar.md
2026-04-23-country-news-feed.md               2026-04-23-country-pinning-guess-fixes-and-ux.md
2026-04-24-gdelt-migration.md                 2026-04-24-reveal-animation-and-mobile-tap.md
2026-04-25-e2e-timing-sweep.md                2026-04-25-hardening-and-reveal-fixes.md
2026-04-26-game-flow-bugfix.md                2026-04-27-cross-component-state-and-game-over-fixes.md
2026-04-27-game-flow-cascade-and-polish-fixes.md       2026-05-02-assessment-remediation.md
2026-05-02-e2e-flake-elimination.md           2026-05-04-vision-audit-remediation.md
2026-05-05-flake-triage.md                    2026-05-14-game-controller-extraction.md
2026-05-15-repository-cleanup-presentability.md        2026-05-17-camera-coherence.md
2026-05-17-country-click-preserve-zoom.md     2026-05-17-ux-smoothening-phase-2-pr1a.md
2026-05-17-ux-smoothening.md                  2026-05-18-daily-already-played-ux.md
2026-05-19-daily-city-feedback.md             2026-05-20-daily-flow-polish.md
2026-05-29-daily-content-data-branch.md       2026-05-30-remove-daily.md
2026-05-30-workstream-a-adrs.md               2026-05-30-workstream-c2-app-effect-hooks.md
```

(`2026-06-12-repo-cleanup-and-fixes.md` — this plan — stays live until it ships.)

- [ ] **Step 2: Repair back-links.** Run `grep -rln "superpowers/plans/2026-" --include=*.md docs/ CLAUDE.md | grep -v "superpowers/plans"` and update every hit to the new `plans/archive/` path. Known hit: CLAUDE.md's escalation-rule reference to `docs/superpowers/plans/2026-04-22-deflake-chromium-e2e.md`. Several `docs/superpowers/notes/*` files also reference moved plans — update those paths too (mechanical).
- [ ] **Step 3: Commit**

```bash
git add -A docs/ CLAUDE.md
git commit -m "docs(superpowers): archive all 36 shipped plans; repair back-links

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 24: Tombstones on deleted-feature plans and specs

- [ ] **Step 1:** Insert as the first line (before the title) of each file below, in `plans/archive/`:

Daily (9 plans): `2026-04-21-retention-program-v1-phase-1-foundation.md`, `2026-04-21-retention-program-v1-phase-2-daily-play.md`, `2026-04-22-retention-program-v1-phase-3-streak-calendar.md`, `2026-04-22-phase-4-share-flow.md`, `2026-04-22-phase-5b-launch-prep.md`, `2026-05-18-daily-already-played-ux.md`, `2026-05-19-daily-city-feedback.md`, `2026-05-20-daily-flow-polish.md`, `2026-05-29-daily-content-data-branch.md`:

```markdown
> **Tombstone (2026-06-12):** the daily-puzzle/retention feature this plan built was removed in PR #97 (2026-05-30, "Remove the daily puzzle"). Kept unmodified for history — do not implement from it.
```

News (2 plans): `2026-04-23-country-news-feed.md`, `2026-04-24-gdelt-migration.md`:

```markdown
> **Tombstone (2026-06-12):** the country-news feature this plan concerns was removed in PR #40 (2026-05-12). Kept unmodified for history — do not implement from it.
```

- [ ] **Step 2:** Same for specs (in `docs/superpowers/specs/`): daily set — `2026-04-21-retention-program-v1-design.md`, `2026-04-22-retention-v1-finishing-design.md`, `2026-05-18-daily-already-played-ux-design.md`, `2026-05-19-daily-city-feedback-design.md`, `2026-05-20-daily-flow-polish-design.md`, `2026-05-29-daily-content-data-branch-design.md` (daily tombstone text); news set — `2026-04-23-country-news-feed-design.md` (news text) and `2026-04-24-gdelt-migration-design.md` with the extended line:

```markdown
> **Tombstone (2026-06-12):** the country-news feature was removed in PR #40 (2026-05-12); the "execute when monetisation becomes concrete" guidance below is void — the migration in fact shipped the same day it was specced (PR #17). Kept unmodified for history.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/
git commit -m "docs(superpowers): tombstone the deleted-feature plans and specs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 25: Align the superpowers README; correct the two broken notes

**Files:** `docs/superpowers/README.md`, `docs/superpowers/notes/2026-05-03-dropped-country-test-audit.md`, `docs/superpowers/notes/2026-05-05-post-audit-verification.md`

- [ ] **Step 1: README Archive section** — replace it with:

```markdown
## Archive

Completed plans live under `plans/archive/` — moving a plan there is the
signal that its work shipped. Archive on landing; periodic batch sweeps are
acceptable when the live directory has drifted. Keep the filename and update
any back-links. Plans whose feature was later **removed** get a one-line
`> **Tombstone:**` header pointing at the removing PR instead of being
rewritten.

Only plans for active or not-yet-started work live directly under `plans/`.
```

(The old text claimed "at most one forward plan per concurrent work stream" while 36 shipped plans sat un-archived.)

- [ ] **Step 2:** In the 2026-05-03 note, after the link to `plans/2026-05-03-quarantine-bugs-and-palestine.md`, append: ` *(dead link — this plan file was never committed; the note merged without it in PR #33)*`.
- [ ] **Step 3:** In the 2026-05-05 post-audit note, insert directly above its §2.2 heading:

```markdown
> **Correction (2026-06-12):** §2.2 below is wrong — the 2026-05-04 Phase 5.5
> note had already added `theme-and-responsive` and
> `launcher-card-loading-states` to the mobile-webkit and
> desktop-firefox-touch testMatch, where they remain today. The
> "chromium-only by design" rationale and the backlog item are void.
```

- [ ] **Step 4: Commit + PR**

```bash
git add docs/superpowers/
git commit -m "docs(superpowers): archive policy matches practice; correct two notes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Open PR `docs: plans-corpus lifecycle sweep`.

---

## Phase 7 (OPTIONAL — droppable) — Gates for e2e/ and scripts/ (branch `cleanup/phase-7-gates`)

`tsc -b` covers only `src` + `vite.config.ts`; ESLint ignores `e2e/**` and `scripts/**`. CONTRIBUTING advertises repo-wide strictness. **Abort criterion:** if enabling either gate surfaces more than ~20 errors, stop, keep the branch as a draft, and file an issue instead.

### Task 26: Typecheck e2e/ and scripts/

- [ ] **Step 1:** Create `tsconfig.e2e.json` (mirrors `tsconfig.node.json`; DOM lib because helpers run code in the page):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["node", "vitest/globals"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "strict": true
  },
  "include": ["e2e", "playwright.config.ts"]
}
```

- [ ] **Step 2:** Add `{ "path": "./tsconfig.e2e.json" }` to the `references` array in `tsconfig.json`.
- [ ] **Step 3:** Run `tsc -b`; fix surfaced e2e errors (expected: small — the suite was written under IDE typechecking). Apply the abort criterion to this surface alone.
- [ ] **Step 4:** Add `"scripts"` to the `include` array; run `tsc -b` again and fix surfaced errors. If `scripts/` alone exceeds the abort budget, remove it from `include` again and file an issue — the e2e gate still lands.

### Task 27: Lint e2e/ and scripts/

- [ ] **Step 1:** In `eslint.config.js`, remove `'scripts/**'` and `'e2e/**'` from the ignores and add a non-type-checked block after the app block:

```js
  {
    name: 'tooling/e2e-and-scripts',
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['e2e/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
```

- [ ] **Step 2:** `npm run lint` currently only covers `src/` (`eslint src/`) — change the script in `package.json` to `"lint": "eslint src/ e2e/ scripts/"`. Run it; fix surfaced errors (abort criterion applies).
- [ ] **Step 3:** Verify + commit + PR

Run: `npm run check && npx playwright test --list`
Expected: green; config still parses.

```bash
git add tsconfig.json tsconfig.e2e.json eslint.config.js package.json e2e/ scripts/
git commit -m "chore(gates): typecheck + lint e2e/ and scripts/

Makes CONTRIBUTING's repo-wide strictness claim true.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**If Phase 7 is dropped:** instead edit `CONTRIBUTING.md`'s "TypeScript is strict." line to `TypeScript is strict in src/ (typechecked in CI); e2e/ and scripts/ are transpiled without typechecking.` and commit that with Phase 5.

---

## Final verification (after the last phase ships)

- [ ] `npm run check` green on `main`.
- [ ] `npx playwright test --project=chromium` green locally (kill dev servers first).
- [ ] `npx playwright test --project=mobile-chromium` green locally.
- [ ] Spot-check: `grep -rn "daily" src/ e2e/ --include=*.ts --include=*.tsx | grep -iv "legacy"` returns only the deliberate compat shims (`hashState.ts` `#daily/` fallback, `legacyStorageCleanup` and its callers/tests) and accurate historical comments (e.g. the PlayMenu tombstone note in `game-city-guessing.spec.ts`).
- [ ] `docs/superpowers/plans/` contains only this plan; archive it when this ships.
