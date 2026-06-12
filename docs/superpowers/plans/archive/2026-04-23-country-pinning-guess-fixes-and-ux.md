# Country-Pinning Guess-Phase Fixes + Round-End UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the tooltip-reveals-name and Guess-by-name bugs in country-pinning, and replace the fixed auto-advance with a target-country panel that opens on guess (continue-required on wrong, skippable auto-advance on correct).

**Architecture:** Three decoupled changes plus one orchestration change. (1) `SingleCountryPanel` gains an `inGameRound` prop that hides Compare + Copy-link and replaces the close-icon with a "Continue" text button. (2) `useMapInteractions` reads game state via `useGameSessionContext()` and suppresses the tooltip's identity content during country-pinning guess phases. (3) `GuessByNameButton.tsx` is deleted along with its render block at `GameController.tsx:521-535`. (4) `App.tsx` gains a parallel `<CountryPanel>` render branch for round-ended-final-outcome, and `GameController.tsx`'s round-end effect becomes conditional (correct → 3000 ms timer + scoped keydown skip; wrong → no timer, Continue + Escape advance).

**Tech Stack:** React 19, TypeScript, MapLibre GL, Playwright.

**Spec:** [`2026-04-22-country-pinning-guess-fixes-and-ux.md`](../specs/2026-04-22-country-pinning-guess-fixes-and-ux.md).

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/components/SingleCountryPanel.tsx` | Modify (~15 LOC) | Add optional `inGameRound?: boolean` prop. When true: hide Compare + Copy-link buttons; replace close-icon with a "Continue" text button (same `onClose` handler, testid `game-continue`). |
| `src/hooks/useMapInteractions.ts` | Modify (~10 LOC) | Read `session` via `useGameSessionContext()`. When `session.modeId === 'country-pinning' && session.status === 'playing'`, skip the tooltip identity-write block; hover highlight stays. |
| `src/game/shared/hud/GuessByNameButton.tsx` | **Delete** | Broken input removed — target name is already in the HUD, typing it is trivial. |
| `src/game/GameController.tsx:10,521-535` | Modify | Remove import + entire `{session.status === 'playing' && session.modeId === 'country-pinning' && (<GuessByNameButton ... />)}` block. |
| `src/game/GameController.tsx:225-233` | Modify (~35 LOC) | Rewrite round-end effect: intermediate daily attempts keep existing `setTimeout`; final outcome + correct → 3000ms timer + scoped keydown listener; final outcome + wrong → no timer, `keydown(Escape)` advance, Continue button is the primary path. |
| `src/App.tsx` | Modify (~15 LOC) | Add a second `<CountryPanel>` render branch for `session.status === 'round-ended' && country-pinning && final-outcome`. |
| `e2e/game-country-pinning.spec.ts` | Modify | Remove GuessByName-related tests. Replace auto-advance assertions with Continue-click assertions. Add: tooltip hidden during guess; correct auto-advance with early-skip; wrong requires Continue. |
| `e2e/daily-puzzle.spec.ts` | Modify | Add: panel NOT shown for attempts 1+2 in 3-attempt daily; panel shown + Continue advances after attempt 3. |

No new dependencies.

---

### Task 1: Set up worktree

**Files:** new worktree at `../polworldmap-country-pinning-ux`.

- [ ] **Step 1: Create worktree off main**

```bash
git worktree add ../polworldmap-country-pinning-ux -b feat/country-pinning-guess-fixes-ux main
```

- [ ] **Step 2: Install deps**

```bash
cd /e/polworldmap-country-pinning-ux
npm install 2>&1 | tail -3
```

- [ ] **Step 3: Baseline sanity**

```bash
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: all unit tests pass; tsc clean.

---

### Task 2: Add `inGameRound` prop to `SingleCountryPanel`

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx`

- [ ] **Step 1: Add the prop to the `Props` interface**

In `src/components/SingleCountryPanel.tsx`, around line 6-15 where `Props` is defined, add `inGameRound?: boolean`:

```ts
interface Props {
  country: CountryData
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  byCca3: Map<string, CountryData>
  inGameRound?: boolean
}
```

- [ ] **Step 2: Destructure it in the component signature**

Around line 62-70 where `SingleCountryPanel` destructures props, add `inGameRound`:

```ts
export function SingleCountryPanel({
  country,
  comparePickingMode,
  sources,
  isDesktop,
  onSelect,
  onClose,
  onEnterCompare,
  byCca3,
  inGameRound = false,
}: Props) {
```

- [ ] **Step 3: Hide Compare button when `inGameRound`**

At `SingleCountryPanel.tsx:148-159` (the Compare button), wrap the existing condition:

```tsx
{!comparePickingMode && !inGameRound && (
  <button
    onClick={onEnterCompare}
    className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-teal dark:text-teal-light transition-colors"
    aria-label="Compare with another country"
    title="Compare"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
      <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
    </svg>
  </button>
)}
```

- [ ] **Step 4: Hide Copy-link button when `inGameRound`**

At `SingleCountryPanel.tsx:162-171` (the Copy-link button), wrap with `!inGameRound`:

```tsx
{!inGameRound && (
  <button
    onClick={onShareLink}
    className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors"
    aria-label="Copy link to this country"
    title="Copy link"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  </button>
)}
```

- [ ] **Step 5: Replace close button with Continue button when `inGameRound`**

At `SingleCountryPanel.tsx:189` where `<CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />` is rendered, replace with a conditional:

```tsx
{inGameRound ? (
  <button
    type="button"
    onClick={onClose}
    data-testid="game-continue"
    className="px-4 py-2 rounded-xl bg-teal-accessible text-white font-semibold text-sm hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/60"
  >
    Continue
  </button>
) : (
  <CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />
)}
```

- [ ] **Step 6: Verify tsc + unit tests**

```bash
cd /e/polworldmap-country-pinning-ux
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: clean; all pre-existing unit tests still pass (the new prop defaults to `false`, so no existing callers are affected).

- [ ] **Step 7: Commit**

```bash
git add src/components/SingleCountryPanel.tsx
git commit -m "feat(panel): inGameRound prop — hide Compare + Copy-link, replace Close with Continue"
```

---

### Task 3: Tooltip gating during country-pinning guess phase

**Files:**
- Modify: `src/hooks/useMapInteractions.ts`

- [ ] **Step 1: Import `useGameSessionContext`**

At the top of `src/hooks/useMapInteractions.ts`, add the import (location adjacent to existing React / map imports):

```ts
import { useGameSessionContext } from '../game/shared/GameSessionProvider'
```

- [ ] **Step 2: Read session inside the hook body**

Near the top of `useMapInteractions` (before the `useEffect` at line 36), add:

```ts
const { session } = useGameSessionContext()
const tooltipsEnabled = !(session.modeId === 'country-pinning' && session.status === 'playing')
```

- [ ] **Step 3: Read the current `mousemoveHover` logic**

```bash
cd /e/polworldmap-country-pinning-ux
sed -n '40,82p' src/hooks/useMapInteractions.ts
```

Identify the tooltip-write block (lines 53-81 approximately — starting at `const tooltip = tooltipRef.current`).

- [ ] **Step 4: Gate the tooltip-write block on `tooltipsEnabled`**

Wrap the `if (tooltip)` block with the gate. The feature-state / extrusion / cursor lines stay BEFORE the gate. Exact edit:

Original lines ~53-81:
```ts
const tooltip = tooltipRef.current
if (tooltip) {
  const country = byNumericRef.current.get(id)
  if (country) {
    // ... writes flag + name + capital to tooltip and adds 'visible' class
  }
}
```

Change to:
```ts
if (tooltipsEnabled) {
  const tooltip = tooltipRef.current
  if (tooltip) {
    const country = byNumericRef.current.get(id)
    if (country) {
      // ... unchanged tooltip content
    }
  }
} else {
  // Tooltips suppressed during country-pinning guess phase — keep hover
  // highlight (feature-state + extrusion + cursor) but hide identity cues.
  tooltipRef.current?.classList.remove('visible')
}
```

**Important:** close the new branch BEFORE the closing `}` of the `mousemoveHover` outer `if (e.features && e.features.length > 0)`.

- [ ] **Step 5: Update the effect's dependency array to include `tooltipsEnabled`**

At `useMapInteractions.ts:142` (roughly — where the effect's deps `[mapRef, loaded, tooltipRef]` live), add `tooltipsEnabled`:

```ts
}, [mapRef, loaded, tooltipRef, tooltipsEnabled])
```

Find the existing deps array and insert `tooltipsEnabled` at the end.

- [ ] **Step 6: Run unit + tsc**

```bash
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: clean. If TS complains about `useGameSessionContext` import path, verify path with `grep -rn "export.*useGameSessionContext" src/game`.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useMapInteractions.ts
git commit -m "fix(map): suppress country tooltip identity during country-pinning guess phase"
```

---

### Task 4: Delete `GuessByNameButton`

**Files:**
- Delete: `src/game/shared/hud/GuessByNameButton.tsx`
- Modify: `src/game/GameController.tsx` (remove import + render block)

- [ ] **Step 1: Remove the import**

In `src/game/GameController.tsx`, delete line 10:

```ts
import { GuessByNameButton } from './shared/hud/GuessByNameButton'
```

- [ ] **Step 2: Remove the render block**

At `src/game/GameController.tsx:521-535`, delete the entire conditional block:

```tsx
{session.status === 'playing' && session.modeId === 'country-pinning' && (
  <GuessByNameButton
    pool={countriesFull}
    onGuess={(cca3) => {
      const c = byCca3.get(cca3.toUpperCase())
      if (!c) return
      submitGuessInput({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        name: c.name.common,
        centroid: centroidFromLatLng(c.latlng),
      })
    }}
  />
)}
```

- [ ] **Step 3: Verify `countriesFull` still has consumers**

```bash
grep -n "countriesFull" src/game/GameController.tsx
```

If `countriesFull` is no longer referenced anywhere in the file, remove it from the destructure / props too. If it's used elsewhere (daily logic, city mode, etc.), leave it.

- [ ] **Step 4: Delete the source file**

```bash
rm src/game/shared/hud/GuessByNameButton.tsx
```

- [ ] **Step 5: Verify tsc + unit**

```bash
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: clean. If tsc reports "cannot find module", there's another caller of GuessByName — find and remove.

- [ ] **Step 6: Commit**

```bash
git add -u src/game/GameController.tsx src/game/shared/hud/GuessByNameButton.tsx
git commit -m "feat(country-pinning): remove GuessByName UI (target name was already shown in HUD)"
```

---

### Task 5: Round-end panel render + timer/continue logic

**Files:**
- Modify: `src/App.tsx` (add second CountryPanel render branch)
- Modify: `src/game/GameController.tsx` (rewrite round-end effect)

- [ ] **Step 1: Understand existing round-end effect**

```bash
cd /e/polworldmap-country-pinning-ux
sed -n '225,236p' src/game/GameController.tsx
```

The current code is:

```ts
const revealMs = session.modeId === 'city-guessing' ? REVEAL_MS_CITY : REVEAL_MS_COUNTRY
const t = window.setTimeout(() => {
  const next = mode.nextRound(session.used)
  advance(next)
}, revealMs)
return () => window.clearTimeout(t)
```

- [ ] **Step 2: Rewrite the round-end timer branch**

Replace the block identified in Step 1 with the conditional logic below. Keep the surrounding `if (session.status === 'round-ended' && session.lastOutcome)` check intact; this only rewrites what happens inside.

```ts
const isFinalOutcome =
  session.attemptsPerRound === 1 || session.attemptsRemaining === 0
const isCountryPinning = session.modeId === 'country-pinning'
const isCorrect = session.lastOutcome.reveal?.kind === 'country'
  ? session.lastOutcome.reveal.correct
  : false

const advanceNow = () => {
  const next = mode.nextRound(session.used)
  advance(next)
}

// Country-pinning intermediate daily attempt → existing behavior (no panel,
// auto-advance via timer).
if (isCountryPinning && !isFinalOutcome) {
  const t = window.setTimeout(advanceNow, REVEAL_MS_COUNTRY)
  return () => window.clearTimeout(t)
}

// City-guessing → unchanged existing behavior.
if (!isCountryPinning) {
  const revealMs = session.modeId === 'city-guessing' ? REVEAL_MS_CITY : REVEAL_MS_COUNTRY
  const t = window.setTimeout(advanceNow, revealMs)
  return () => window.clearTimeout(t)
}

// Country-pinning final outcome + correct → 3000ms auto-advance, scoped early-skip.
if (isCorrect) {
  const t = window.setTimeout(advanceNow, 3000)
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

// Country-pinning final outcome + wrong → no timer; Continue button OR Escape advances.
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') advanceNow()
}
window.addEventListener('keydown', onKey)
return () => window.removeEventListener('keydown', onKey)
```

- [ ] **Step 3: Find and read App.tsx's CountryPanel render**

```bash
sed -n '372,390p' src/App.tsx
```

Current (for reference):
```tsx
{selected && !gameActive && (
  <CountryPanel
    country={selected}
    compareWith={compareWith}
    comparePickingMode={comparePickingMode}
    sources={sources}
    isDesktop={isDesktop}
    onSelect={onMapSelect}
    onClose={deselect}
    onEnterCompare={enterComparePicking}
    onExitCompare={exitCompare}
    byCca3={byCca3}
  />
)}
```

- [ ] **Step 4: Add a parallel `roundEndTarget` derivation in App.tsx**

Near the top of `App` where state is derived (after `const { selected, ... } = useSelectedCountry(byCca3)`), add:

```ts
const roundEndTarget = useMemo(() => {
  if (session.status !== 'round-ended') return null
  if (session.modeId !== 'country-pinning') return null
  const isFinalOutcome =
    session.attemptsPerRound === 1 || session.attemptsRemaining === 0
  if (!isFinalOutcome) return null
  const reveal = session.lastOutcome?.reveal
  if (!reveal || reveal.kind !== 'country') return null
  return byCca3.get(reveal.targetCca3) ?? null
}, [
  session.status,
  session.modeId,
  session.attemptsPerRound,
  session.attemptsRemaining,
  session.lastOutcome,
  byCca3,
])

// Advance via the GameSessionProvider context directly. Destructure advance
// + mode from useGameSessionContext (extend the existing destructure at
// App.tsx:96 to include them).
const advanceRoundEndPanel = useCallback(() => {
  if (session.status !== 'round-ended') return
  const next = mode.nextRound(session.used)
  advance(next)
}, [session.status, session.used, advance, mode])
```

Add `useMemo` and `useCallback` to the imports at the top of App.tsx if not already present. Also extend the `useGameSessionContext()` destructure at `App.tsx:96` from `const { session, submitGuessInput } = useGameSessionContext()` to `const { session, submitGuessInput, advance, mode } = useGameSessionContext()`.

- [ ] **Step 5: Add the second CountryPanel render branch**

After the existing `{selected && !gameActive && <CountryPanel ... />}` block, add the sibling branch:

```tsx
{roundEndTarget && (
  <CountryPanel
    country={roundEndTarget}
    compareWith={null}
    comparePickingMode={false}
    sources={sources}
    isDesktop={isDesktop}
    onSelect={() => { /* no-op during round-end */ }}
    onClose={advanceRoundEndPanel}
    onEnterCompare={() => { /* no-op — hidden by inGameRound */ }}
    onExitCompare={() => { /* no-op — hidden by inGameRound */ }}
    byCca3={byCca3}
    inGameRound={true}
  />
)}
```

- [ ] **Step 6: Plumb `inGameRound` through `CountryPanel` dispatcher**

Check `src/components/CountryPanel.tsx` (the wrapper that picks Single vs Compare). It should accept and forward the new prop:

```bash
head -60 src/components/CountryPanel.tsx
```

Locate where it accepts props and passes them to `SingleCountryPanel`. Add `inGameRound?: boolean` to the wrapper's Props and forward it.

If `CountryPanel.tsx` is a simple forwarder:

```tsx
interface Props {
  // ... existing props
  inGameRound?: boolean
}

export function CountryPanel({ /* ... */, inGameRound }: Props) {
  // existing logic that picks SingleCountryPanel vs CompareCountryPanel
  if (compareWith) return <CompareCountryPanel ... />
  return <SingleCountryPanel {...restProps} inGameRound={inGameRound} />
}
```

Adjust to the real shape.

- [ ] **Step 7: Verify tsc + unit**

```bash
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 8: Manual smoke (optional but encouraged at this point)**

```bash
npm run dev
```

Play country-pinning free-play, make a wrong guess, verify the target's panel opens, Compare/Copy-link are hidden, and the Continue button advances to the next round. Make a correct guess, verify the panel opens briefly then auto-advances within 3 seconds. Press Enter/Escape on a correct-panel-open state → advances immediately.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/game/GameController.tsx src/components/CountryPanel.tsx
git commit -m "feat(country-pinning): round-end opens target panel; Continue required on wrong, auto-advance on correct"
```

---

### Task 6: Update country-pinning e2e spec

**Files:**
- Modify: `e2e/game-country-pinning.spec.ts`

- [ ] **Step 1: Read the current spec**

```bash
cd /e/polworldmap-country-pinning-ux
cat e2e/game-country-pinning.spec.ts | head -40
grep -n "guess-by-name\|guess-input\|guess-results\|game-reveal\|auto-advance\|panel-close" e2e/game-country-pinning.spec.ts
```

- [ ] **Step 2: Delete any tests that exercise GuessByName**

Remove the tests and helper lines referencing `game-guess-by-name`, `game-guess-input`, and `game-guess-results`. These test-ids no longer exist in the code (Task 4 deleted them).

- [ ] **Step 3: Update existing auto-advance assertions to click Continue**

Any test that asserts the game auto-advances after a guess needs to be updated. Search for patterns like:

```ts
// Old pattern
await page.waitForTimeout(1500)  // wait for auto-advance
await expect(page.getByTestId('game-prompt-name')).toContainText(nextCountry)
```

Replace with:

```ts
// New pattern for wrong guesses
await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 5_000 })
await page.getByTestId('game-continue').click()
await expect(page.getByTestId('game-prompt-name')).toContainText(nextCountry)
```

For correct guesses, the auto-advance still works but wait window is 3000ms instead of 1200ms. Either adjust the timeout or press Enter to skip:

```ts
// New pattern for correct guesses
await page.keyboard.press('Enter')  // skip the 3000ms auto-advance early
await expect(page.getByTestId('game-prompt-name')).toContainText(nextCountry)
```

- [ ] **Step 4: Add tooltip-suppression test**

Append a new test inside the existing describe block:

```ts
test('tooltip identity hidden during country-pinning guess phase', async ({ page }) => {
  await page.goto('/')
  await waitForMap(page)
  await openCountryPinning(page)
  await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

  // Hover a country on the map (any country — the tooltip should NOT show identity).
  const mapContainer = page.locator('.maplibregl-canvas').first()
  await mapContainer.hover({ position: { x: 400, y: 300 } })
  await page.waitForTimeout(500)

  // The tooltip element exists in the DOM but its .visible class should NOT be present.
  const tooltipVisible = await page.evaluate(() => {
    const t = document.querySelector('.country-tooltip')
    return t?.classList.contains('visible') ?? false
  })
  expect(tooltipVisible).toBe(false)
})
```

Use the spec's pre-existing local helpers `waitForMap` and `openCountryPinning` — no new imports from `./helpers`.

- [ ] **Step 5: Add round-end panel + continue test**

```ts
test('round-end on wrong guess opens target panel; Continue advances', async ({ page }) => {
  await page.goto('/')
  await waitForMap(page)
  await openCountryPinning(page)
  await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

  // Submit an intentional wrong guess via the existing test shim
  // (__funworldmap_game.submitCountryGuess takes cca3 and returns boolean).
  const usaWasTarget = await page.evaluate(() => {
    const game = (window as unknown as {
      __funworldmap_game?: { submitCountryGuess: (cca3: string) => boolean }
    }).__funworldmap_game
    return game?.submitCountryGuess('USA') ?? false
  })

  // The target panel should open regardless of whether USA was the target
  // (on correct, the target IS USA; on wrong, it's whoever was the target).
  await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 5_000 })

  // Compare + copy-link buttons must NOT be present in-round
  await expect(page.locator('button[aria-label="Compare with another country"]')).not.toBeAttached()
  await expect(page.locator('button[aria-label="Copy link to this country"]')).not.toBeAttached()

  // If USA was the target (correct), the auto-advance timer fires or Continue
  // advances. If wrong, Continue is required. In either case, clicking Continue
  // moves to the next round.
  const continueBtn = page.getByTestId('game-continue')
  await expect(continueBtn).toBeVisible()
  await continueBtn.click()

  // Next round: panel should disappear
  await expect(page.getByTestId('country-panel')).not.toBeAttached({ timeout: 5_000 })
  // Unused variable guard for lint
  void usaWasTarget
})
```

- [ ] **Step 6: Run the spec 3× locally to catch flakes**

```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/game-country-pinning.spec.ts 2>&1 | tail -8
done
```

Expected: 3/3 green. If any flake, investigate — do not paper over with retry.

- [ ] **Step 7: Commit**

```bash
git add e2e/game-country-pinning.spec.ts
git commit -m "test(e2e): country-pinning — tooltip suppression, round-end panel, Continue"
```

---

### Task 7: Update daily-puzzle e2e spec

**Files:**
- Modify: `e2e/daily-puzzle.spec.ts`

- [ ] **Step 1: Read the current daily country-pinning flow**

```bash
grep -n "country-pinning\|submitCountryGuess\|panel-close\|game-continue" e2e/daily-puzzle.spec.ts | head -20
```

- [ ] **Step 2: Add intermediate-attempt suppression test**

Append a test that verifies attempts 1 and 2 DO NOT open the panel:

```ts
test('daily country-pinning: panel suppressed for attempts 1 + 2; opens on attempt 3', async ({ page }) => {
  await withDailyStub(page)
  await page.goto(`/#daily/${TODAY}/country-pinning`)
  await waitForMap(page)
  await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

  // Attempt 1: wrong guess via the existing shim
  await page.evaluate(() => {
    const game = (window as unknown as {
      __funworldmap_game?: { submitCountryGuess: (cca3: string) => boolean }
    }).__funworldmap_game
    game?.submitCountryGuess('USA')
  })
  await page.waitForTimeout(1500) // wait past existing intermediate 1200ms timer
  await expect(page.getByTestId('country-panel')).not.toBeAttached()

  // Attempt 2: wrong guess
  await page.evaluate(() => {
    const game = (window as unknown as {
      __funworldmap_game?: { submitCountryGuess: (cca3: string) => boolean }
    }).__funworldmap_game
    game?.submitCountryGuess('CHN')
  })
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('country-panel')).not.toBeAttached()

  // Attempt 3: wrong guess → panel opens + Continue button visible
  await page.evaluate(() => {
    const game = (window as unknown as {
      __funworldmap_game?: { submitCountryGuess: (cca3: string) => boolean }
    }).__funworldmap_game
    game?.submitCountryGuess('BRA')
  })
  await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('game-continue')).toBeVisible()
})
```

Uses the spec's pre-existing `withDailyStub` and `waitForMap` helpers plus the `TODAY` module-level constant — no `stubDailyIndex`/`waitForAppReady` imports needed.

- [ ] **Step 3: Run the daily spec 3× locally**

```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/daily-puzzle.spec.ts 2>&1 | tail -8
done
```

Expected: 3/3 green.

- [ ] **Step 4: Commit**

```bash
git add e2e/daily-puzzle.spec.ts
git commit -m "test(e2e): daily country-pinning — panel suppression for attempts 1+2"
```

---

### Task 8: Local validation + push + PR

**Files:** none.

- [ ] **Step 1: Full unit + tsc**

```bash
cd /e/polworldmap-country-pinning-ux
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 2: Full chromium project 3× consecutive**

```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 --workers=2 2>&1 | tail -5
done
```

Expected: fully green each run. Pre-existing search/panel-close flakes may recur (documented on main); flag but do not block unless country-pinning / daily-puzzle specs themselves flake.

- [ ] **Step 3: chromium-gpu sanity**

```bash
npx playwright test --project=chromium-gpu --retries=0 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/country-pinning-guess-fixes-ux
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --base main --title "feat(country-pinning): guess-phase fixes + round-end UX reform" --body "$(cat <<'EOF'
## Summary

- **Tooltip suppression** — `useMapInteractions` reads game session via `useGameSessionContext`; during country-pinning guess phase the tooltip identity content (flag + name + capital) is suppressed. Hover highlight stays.
- **GuessByName removed** — `src/game/shared/hud/GuessByNameButton.tsx` deleted + render block at `GameController.tsx:521-535` removed. Map-click is the only guess input.
- **Round-end panel** — new parallel render branch in `App.tsx` opens the target country's `CountryPanel` when a country-pinning round ends with a final outcome. `SingleCountryPanel` gains an `inGameRound` prop that hides Compare + Copy-link and replaces the close icon with a "Continue" text button.
- **Auto-advance rules** — wrong guess: no timer, Continue (or Escape) required. Correct guess: 3000 ms timer with `Enter`/`Escape`/`Space` early-skip.
- **Daily 3-attempt preserved** — panel suppressed for attempts 1-2 (existing per-attempt reveal + timer unchanged), opens after attempt 3.

Zero changes to scoring, reveal animation, daily content pipeline, city-guessing, free-play CountryPanel behaviour, or analytics events.

## Why

Spec: `docs/superpowers/specs/2026-04-22-country-pinning-guess-fixes-and-ux.md`.

Two bugs invalidated the country-pinning guess phase (hover reveals name; Guess-by-name lets you type the name already shown in the HUD). Round-end UX previously auto-dismissed too fast to learn anything. This PR addresses both.

Plan: `docs/superpowers/plans/2026-04-23-country-pinning-guess-fixes-and-ux.md`.

## Out of scope (follow-up plans)

- City-guessing tooltip-reveals-answer bug (same class, separate plan).
- Country news feed on `CountryPanel` (separate brainstorm).

## Test Plan

- [ ] CI `lint + type + unit`, `e2e (chromium)`, `e2e (chromium-gpu)` all green
- [ ] Manual: hover countries during a country-pinning game — no tooltip identity
- [ ] Manual: wrong guess opens target panel, Continue advances
- [ ] Manual: correct guess opens panel for ~3 s, Enter skips early
- [ ] Manual: daily country-pinning attempts 1 + 2 do NOT show panel; attempt 3 does

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Watch CI**

```bash
gh pr checks $(gh pr view --json number --jq .number) --watch
```

Expected: green on first run. If pre-existing search flake strikes, re-run chromium once. If the new country-pinning / daily tests flake, investigate before re-running.

- [ ] **Step 7: Hand off to `finishing-a-development-branch`**

Present the 4-option menu.

---

## Self-review notes

- **Spec coverage:** §1 tooltip → Task 3. §2 GuessByName removal → Task 4. §3 panel + timer/continue → Tasks 2 + 5. §4 daily suppression → implemented in Task 5 Step 2 (the `isFinalOutcome` gate) and verified in Task 7. §5 tests → Tasks 6 + 7.
- **Placeholder scan:** every step has concrete code or commands. The `CountryPanel.tsx` forwarder edit in Task 5 Step 6 has a "Adjust to the real shape" hedge — acceptable because the wrapper structure can vary, and the rule (add prop, forward it) is unambiguous.
- **Type consistency:** `inGameRound?: boolean` appears in `SingleCountryPanel.Props` (Task 2), `CountryPanel.Props` forwarder (Task 5), and the App.tsx JSX (Task 5). `advanceNow` name used consistently in Task 5. Test-id `game-continue` introduced in Task 2 Step 5 and referenced in Tasks 6 + 7.
- **Honest uncertainty:** Continue-button click calls `advance` directly via the context; the correct-guess setTimeout also calls `advance` from the round-end effect. If the user clicks Continue before the 3000 ms timer fires, the effect's cleanup (on status change to 'playing') clears the timer — no double-advance. Same guarantee for Escape on wrong: advance runs once, status flips, effect cleanup clears the listener. The path is safe; verify with the new e2e tests.
