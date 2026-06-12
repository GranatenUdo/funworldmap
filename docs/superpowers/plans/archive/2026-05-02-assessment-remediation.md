# Assessment Remediation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix nine prioritised bugs from the 2026-05-02 critical assessment. Headline defect (Phase 1, Tasks 1–7) is that every daily game and every kill-shot free round transitions `playing → game-over` directly, skipping the reveal animation entirely. Phase 2 (Tasks 8–15) ships eight independent corrections (spoiler protection, end-early copy, milestone reset, launcher card denominator + past-date CTA, SR announcement gating, +0 toast, telemetry index).

**Architecture:** The reducer's `endOfRound` currently returns `'game-over'` whenever `endsGame` is true; the entire reveal pipeline (`GameController.tsx`, `App.tsx` `roundEndTarget`) is gated on `'round-ended'` and therefore never fires on the final round. Phase 1 makes `endOfRound` always return `'round-ended'`; a new `finalize` reducer action transitions `round-ended → game-over` once the controller's reveal animation completes. The `endsGame` flag already lives on `lastOutcome` — no new session field. Phase 2 fixes are mechanical.

**Tech Stack:** React 19 (`useReducer`, `useSyncExternalStore`), TypeScript 5.7, Vite 6, Vitest 4 (jsdom unit tests), Playwright 1.59 (`chromium-gpu` for map-rendering specs), `@testing-library/react` 16, MapLibre GL 5.

**Source assessment:** Conversation transcript 2026-05-02 (final ranked list section). No separate spec document — bug-by-bug rationale is inline in each task.

---

## Two-phase plan

This plan ships in two PRs.

**Phase 1** (Tasks 1–7) ships the reveal-pipeline rework on `branch fix/reveal-pipeline`. Phase 1 is one bug across many files: don't split.

**Phase 2** (Tasks 8–15) ships eight independent corrections on `branch fix/assessment-2026-05-02-polish` *after Phase 1 merges*. Phase 2 modifies several of the same files Phase 1 touches (`useGameSession.ts`, `GameOverOverlay.tsx`, `GameController.tsx`); tackling them on a fresh branch off `main` avoids merge conflicts on the controller.

---

## File structure

### Phase 1 — Reveal pipeline

**Modified**
- `src/game/shared/useGameSession.ts` — `endOfRound` always returns status `'round-ended'`; add `'finalize'` action; expose `finalize()` from the hook
- `src/game/shared/GameSessionProvider.tsx` — extend `GameSessionApi` with `finalize: () => void`; destructure it from `useGameSession()` and add to the `useMemo` `api` value
- `src/game/GameController.tsx` — pull `finalize` from context; rewrite the round-ended auto-advance block (lines ~302–356) to dispatch `finalize` when `lastOutcome.endsGame`; `onEndGame` no longer needs the `'game-over'` short-circuit since `finishFree` already handles it
- `src/App.tsx` — `advanceRoundEndPanel` dispatches `finalize` when `lastOutcome.endsGame`; pull `finalize` from context
- `src/game/shared/__tests__/useGameSession.test.ts` — extend with: `endOfRound` always returns `'round-ended'` even when `endsGame`; new `finalize` action transitions `round-ended → game-over`; `finalize` is a no-op when `endsGame` is false
- `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx` — update fixtures to call `finalize()` after `attempt()` (existing tests construct game-over directly)
- `e2e/daily-best-of-3.spec.ts` — relax assertion timing: game-over modal appears after `data-testid="reveal-marker"` is observed (was: appears immediately after attempt 3)

**Created**
- `e2e/daily-reveal-on-final-attempt.spec.ts` — Playwright regression: after 3rd daily attempt, the dashed-arc reveal renders and remains visible for ≥1 frame before the game-over modal opens

### Phase 2 — Independent fixes

**Modified**
- `src/components/DailyRevealOverlay.tsx` — when `date === today` and a mode is not played, replace the country/city headline with "Not played — finish today's daily first."
- `src/game/shared/useGameSession.ts` — add `endedEarly: boolean` to `GameSession`; default `false`; `finishFree` sets it `true`; `start` and `endGame` reset it
- `src/game/shared/types.ts` — add `endedEarly: boolean` to `GameSession`
- `src/game/shared/hud/GameOverOverlay.tsx` — branch the description copy on `session.endedEarly`
- `src/game/daily/storage.ts` — `updateStreak` resets `lastMilestoneShown` to 0 when the streak breaks (`current` resets to 1 with a previous `lastActiveDate`)
- `src/components/LauncherModeCard.tsx` — extract per-mode denominator copy; add `'past-unplayed'` `LauncherCardState`; render "See reveal" CTA for that state
- `src/components/Launcher.tsx` — `cardState` returns `'past-unplayed'` when puzzle exists, no prior, and `date < today`; route the click to `seeReveal(modeId)`
- `src/game/GameController.tsx` — gate the round-start announcement on a `lastAnnouncedRoundKeyRef` so it fires once per round (not once per attempt); change `daily_attempted.attemptIndex` from `prev` to `prev + 1` to match the documented `1|2|3` schema
- `src/game/shared/hud/AttemptsIndicator.tsx` — gate the `+pts` toast on `pts > 0`
- `src/game/shared/__tests__/useGameSession.test.ts` — `endedEarly` flag tests
- `src/game/daily/__tests__/storage.test.ts` — `lastMilestoneShown` reset on streak break
- `src/components/__tests__/LauncherMilestoneOverlay.test.tsx` — no change (overlay logic untouched)

**Created**
- `src/components/__tests__/DailyRevealOverlay.test.tsx` — spoiler gate test (today + unplayed → headline hidden; today + played → headline shown; past + unplayed → headline shown)
- `src/components/__tests__/LauncherModeCard.test.tsx` — past-unplayed CTA reads "See reveal"; country-pinning denominator copy; city denominator copy
- `src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx` — no toast when `pts === 0`; toast shown when `pts > 0`

---

## Task order rationale

**Phase 1**: types → reducer → reducer tests → context plumb → controller → app round-end → e2e. Strict dependency chain. Each task ends with a commit.

**Phase 2** tasks are independent of each other. Tackle in any order; the listing below is commit-sequence order to keep the diff bisectable.

---

# Phase 1 — Reveal pipeline rework

**Branch:** `fix/reveal-pipeline`
**Target merge:** `main`

Start by creating the branch:

```bash
git checkout main && git pull
git checkout -b fix/reveal-pipeline
```

---

### Task 1: Make `endOfRound` always return `'round-ended'`

**Files:**
- Modify: `src/game/shared/useGameSession.ts:50-75`
- Test: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/game/shared/__tests__/useGameSession.test.ts` after the existing reducer suite:

```ts
describe('endOfRound transitions to round-ended (even when endsGame=true)', () => {
  it('best-of-3 final attempt sets status round-ended with endsGame=true', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), 1, 3, '2026-05-02'))
    act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)))
    act(() => result.current.attempt(countryInput('ESP'), miss('FRA', 'ESP', 30)))
    act(() => result.current.attempt(countryInput('ITA'), miss('FRA', 'ITA', 40)))
    expect(result.current.session.status).toBe('round-ended')
    expect(result.current.session.lastOutcome?.endsGame).toBe(true)
  })

  it('free country lives-out attempt sets status round-ended with endsGame=true', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
    act(() => result.current.advance(round('ITA')))
    act(() => result.current.attempt(countryInput('ESP'), miss('ITA', 'ESP')))
    act(() => result.current.advance(round('PRT')))
    act(() => result.current.attempt(countryInput('GBR'), miss('PRT', 'GBR')))
    expect(result.current.session.status).toBe('round-ended')
    expect(result.current.session.lives).toBe(0)
    expect(result.current.session.lastOutcome?.endsGame).toBe(true)
  })

  it('non-final round still returns round-ended (regression)', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
    expect(result.current.session.status).toBe('round-ended')
    expect(result.current.session.lastOutcome?.endsGame).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: first two tests FAIL with `expected 'game-over' to be 'round-ended'`. Third test PASSES.

- [ ] **Step 3: Change `endOfRound` to always return round-ended**

In `src/game/shared/useGameSession.ts:59-74`, replace the return:

```ts
  return {
    ...state,
    status: 'round-ended',
    lives: nextLives,
    score: state.score + best.pointsEarned,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    attemptsRemaining: 0,
    currentAttempts: attempts,
    lastOutcome: {
      pointsEarned: best.pointsEarned,
      livesDelta,
      endsGame,
      reveal: best.reveal,
    },
  }
```

(The change is one literal: `status: endsGame ? 'game-over' : 'round-ended'` → `status: 'round-ended'`. `endsGame` is still computed and stored on `lastOutcome`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: all three tests PASS. Other reducer tests likely fail at this point — that's expected, fix them in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/game/shared/useGameSession.ts src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): endOfRound always returns 'round-ended' (endsGame on lastOutcome)"
```

---

### Task 2: Add `finalize` reducer action

**Files:**
- Modify: `src/game/shared/useGameSession.ts`
- Test: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the suite started in Task 1:

```ts
describe("finalize action", () => {
  it('transitions round-ended → game-over when lastOutcome.endsGame is true', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), 1, 3, '2026-05-02'))
    act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
    act(() => result.current.attempt(countryInput('ESP'), miss('FRA', 'ESP')))
    act(() => result.current.attempt(countryInput('ITA'), miss('FRA', 'ITA')))
    expect(result.current.session.status).toBe('round-ended')
    act(() => result.current.finalize())
    expect(result.current.session.status).toBe('game-over')
  })

  it('is a no-op when lastOutcome.endsGame is false', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
    expect(result.current.session.status).toBe('round-ended')
    act(() => result.current.finalize())
    expect(result.current.session.status).toBe('round-ended')
  })

  it('is a no-op when status !== round-ended', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    expect(result.current.session.status).toBe('playing')
    act(() => result.current.finalize())
    expect(result.current.session.status).toBe('playing')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: TypeScript error or runtime "finalize is not a function".

- [ ] **Step 3: Add `finalize` to the reducer + hook**

In `src/game/shared/useGameSession.ts`:

1. Extend the `Action` union (line 14-22) with:

```ts
  | { type: 'finalize' }
```

2. Add a case to the reducer switch (after `case 'finishFree'`, before the closing brace of `reducer`):

```ts
    case 'finalize': {
      if (state.status !== 'round-ended') return state
      if (!state.lastOutcome?.endsGame) return state
      return { ...state, status: 'game-over' }
    }
```

3. Extend the hook return type signature (line 185-194):

```ts
  endGame: () => void
  finishFree: () => void
  finalize: () => void
```

4. Add the callback inside `useGameSession()`:

```ts
  const finalize = useCallback(() => dispatch({ type: 'finalize' }), [])
```

5. Add to the return object:

```ts
  return { session, start, attempt, completeNow, resume, advance, overrideRound, endGame, finishFree, finalize }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: PASS for the three new `finalize` tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/shared/useGameSession.ts src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): add finalize reducer action for round-ended → game-over"
```

---

### Task 3: Repair existing reducer tests broken by Task 1

**Files:**
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1: Run the full reducer suite to see what broke**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: failures in tests that asserted `status === 'game-over'` directly after a final attempt. They now read `'round-ended'`.

- [ ] **Step 2: Update each failing test to dispatch `finalize` before asserting game-over**

Pattern: tests that previously did

```ts
act(() => result.current.attempt(input, finalResult))
expect(result.current.session.status).toBe('game-over')
```

become

```ts
act(() => result.current.attempt(input, finalResult))
expect(result.current.session.status).toBe('round-ended')
act(() => result.current.finalize())
expect(result.current.session.status).toBe('game-over')
```

This is the contract: callers transition through `round-ended` to allow the reveal animation, then dispatch `finalize` (the controller does this for them in production).

- [ ] **Step 3: Run again to verify**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/shared/__tests__/useGameSession.test.ts
git commit -m "test(game): adapt reducer tests to two-step finalize transition"
```

---

### Task 4: Expose `finalize` through `GameSessionProvider`

**Files:**
- Modify: `src/game/shared/GameSessionProvider.tsx`

- [ ] **Step 1: Read the current `GameSessionApi` shape**

Run: `grep -n "GameSessionApi\|api =\|useMemo" src/game/shared/GameSessionProvider.tsx | head -20`

- [ ] **Step 2: Add `finalize` to the API**

In `src/game/shared/GameSessionProvider.tsx`:

1. Add to the `GameSessionApi` interface:

```ts
  finalize: () => void
```

2. Destructure from `useGameSession()`:

```ts
  const { session, mode, start, ..., finishFree, finalize } = useGameSession()
```

(The exact existing destructure adds `finalize` to the trailing list.)

3. Include in the `api` `useMemo` value (and its dep array):

```ts
  const api = useMemo(
    () => ({ ..., finishFree, finalize }),
    [..., finishFree, finalize],
  )
```

4. **Required** — add the `finalize` test seam under the existing `VITE_TEST_HOOKS` block (mirror of `endGame`/`completeNow` at line 63-64). This is load-bearing for the Phase 1 e2e sweep (Task 7); it lets specs jump past the reveal hold without a brittle 3000 ms wait.

```ts
  w.__funworldmap_game.finalize = () => apiRef.current.finalize()
```

Add the matching cleanup in the return block:

```ts
  delete w.__funworldmap_game.finalize
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/game/shared/GameSessionProvider.tsx
git commit -m "feat(game): expose finalize via GameSessionProvider"
```

---

### Task 5: Wire `finalize` into the controller's auto-advance

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Update the destructure**

`src/game/GameController.tsx:102`:

```ts
  const { session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame, finishFree, finalize } = useGameSessionContext()
```

- [ ] **Step 2: Rewrite the round-ended `advanceNow` to dispatch `finalize` on endsGame**

`src/game/GameController.tsx:311-314`. Replace:

```ts
      const advanceNow = () => {
        const next = mode.nextRound(session.used)
        advance(next)
      }
```

with:

```ts
      const advanceNow = () => {
        if (session.lastOutcome?.endsGame) {
          finalize()
          return
        }
        const next = mode.nextRound(session.used)
        advance(next)
      }
```

- [ ] **Step 3: Adjust the country-pinning final-outcome branch to always run a timer when endsGame**

Currently `GameController.tsx:334-356` has two paths for country-pinning final outcome:
- correct → 3000 ms timer + Enter/Esc/Space skip (lines 335-348)
- wrong → no timer; Esc advances (lines 351-356)

For endsGame, a "no timer" path leaves the user staring at the reveal indefinitely with the game-over modal never appearing. Tighten the wrong-and-endsGame branch to also auto-advance:

After the existing `if (isCorrect)` block ending at line 349, replace the final block (lines 351-356):

```ts
      // Country-pinning final outcome + wrong:
      // - intra-game (free, lives>0): no timer; Esc advances (Continue button is the primary path).
      // - end-of-game: auto-advance after the reveal animation finishes; Esc / Enter / Space skip early.
      //   `holdMs` honours the existing per-mode `animatedMs` so long-distance arcs aren't truncated; floor at 3000 ms.
      if (session.lastOutcome.endsGame) {
        const holdMs = Math.max(animatedMs ?? 0, 3000)
        const t = window.setTimeout(advanceNow, holdMs)
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
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') advanceNow()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
```

- [ ] **Step 4: Verify the dep array still satisfies hook lint**

`GameController.tsx:383-388`. Add `finalize` to the dep array:

```ts
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    session.currentAttempts, session.dailyDate,
    advance, mode, record, recordDailyResult, byCca3, finalize,
  ])
```

- [ ] **Step 5: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "feat(game): controller auto-advance dispatches finalize on endsGame"
```

---

### Task 6: Wire `finalize` into `App.advanceRoundEndPanel`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update `useGameSessionContext()` destructure (line 89)**

```ts
  const { session, submitGuessInput, advance, mode, finalize } = useGameSessionContext()
```

- [ ] **Step 2: Rewrite `advanceRoundEndPanel` (line 151-155)**

```ts
  const advanceRoundEndPanel = useCallback(() => {
    if (session.status !== 'round-ended' || !mode) return
    if (session.lastOutcome?.endsGame) {
      finalize()
      return
    }
    const next = mode.nextRound(session.used)
    advance(next)
  }, [session.status, session.lastOutcome, session.used, advance, finalize, mode])
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): round-end panel close dispatches finalize on endsGame"
```

---

### Task 7: E2E sweep — adapt every spec that asserted instant game-over

**Files:**
- Create: `e2e/daily-reveal-on-final-attempt.spec.ts`
- Modify: `e2e/daily-best-of-3.spec.ts`, `e2e/daily-deep-link.spec.ts`, `e2e/daily-share-block-immediate.spec.ts`, `e2e/daily-share.spec.ts`, `e2e/daily-streak.spec.ts`, `e2e/daily-puzzle.spec.ts`, `e2e/game-country-pinning.spec.ts`, `e2e/game-city-guessing.spec.ts`, `e2e/game-over-mode-switch.spec.ts`, `e2e/mobile-daily-flow.spec.ts`, `e2e/reveal-animation.spec.ts`, `e2e/reveal-animation-reduced-motion.spec.ts`
- Modify: `docs/systems/daily-puzzle.md` (one-line note on the round-ended pause for daily)

- [ ] **Step 1: Audit which specs assert game-over after a final attempt**

Run: `grep -ln "game-over" e2e/*.spec.ts | xargs grep -l "submitCountryGuess\|browser_click.*map-canvas\|completeNow\|finishFree"`

That produces the canonical list — cross-check it against the file list above. If a spec is missing from this plan but appears in the grep output, add it to your patch list.

- [ ] **Step 2: Write the new positive-coverage spec**

Create `e2e/daily-reveal-on-final-attempt.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForGameTestHook, stubDailyIndex, routeMapTiles } from './helpers'

test.describe('daily best-of-3 final attempt holds before game-over', () => {
  test('country-pinning attempt 3 → status round-ended → finalize → game-over', async ({ page }) => {
    await routeMapTiles(page)
    await stubDailyIndex(page, '2026-05-02', { country: 'FRA', city: 'FR-paris' })
    await gotoAndWaitForMap(page, '/#daily/2026-05-02/country-pinning')
    await waitForGameTestHook(page)

    await page.evaluate(() => (window as any).__funworldmap_game.submitCountryGuess('DEU'))
    await page.evaluate(() => (window as any).__funworldmap_game.submitCountryGuess('ESP'))
    await page.evaluate(() => (window as any).__funworldmap_game.submitCountryGuess('ITA'))

    // The reveal hold has begun; game-over modal must NOT be attached yet.
    await expect(page.getByTestId('game-over')).not.toBeAttached()
    // Round-ended status is observable via the test seam.
    expect(await page.evaluate(() => (window as any).__funworldmap_game.getSession().status)).toBe('round-ended')

    await page.evaluate(() => (window as any).__funworldmap_game.finalize())
    await expect(page.getByTestId('game-over')).toBeVisible()
  })
})
```

The assertion uses the `getSession()` seam (already exposed at `GameSessionProvider.tsx:62`) to verify the new round-ended hold, and the new `finalize()` seam (added in Task 4) to skip the timer cleanly.

- [ ] **Step 3: Patch each existing spec — the rule**

Wherever a spec asserts `getByTestId('game-over').toBeVisible()` *immediately after a final attempt or `completeNow`/`finishFree` call*, insert the seam call first:

```ts
await page.evaluate(() => (window as any).__funworldmap_game.finalize())
await expect(page.getByTestId('game-over')).toBeVisible()
```

The `finalize()` seam is a no-op when status is not `round-ended`, so it's safe to add unconditionally where the test path is "final attempt → game-over".

For specs that drive a *non-final* round (round 1 of a free city game, attempt 1 of a daily without `completeNow`), nothing changes — `finalize()` would be a no-op there.

- [ ] **Step 4: Spec-by-spec patch checklist**

Open each file in turn, search for `game-over` and `submitCountryGuess`/`completeNow`/`finishFree`, and insert the `finalize()` call ahead of the game-over visibility assertion. Tick when patched:

- [ ] `e2e/daily-best-of-3.spec.ts`
- [ ] `e2e/daily-deep-link.spec.ts`
- [ ] `e2e/daily-share-block-immediate.spec.ts`
- [ ] `e2e/daily-share.spec.ts`
- [ ] `e2e/daily-streak.spec.ts`
- [ ] `e2e/daily-puzzle.spec.ts`
- [ ] `e2e/game-country-pinning.spec.ts` (free country lives-out)
- [ ] `e2e/game-city-guessing.spec.ts` (free city round 10)
- [ ] `e2e/game-over-mode-switch.spec.ts`
- [ ] `e2e/mobile-daily-flow.spec.ts`
- [ ] `e2e/reveal-animation.spec.ts` (already a positive reveal test — verify it still passes; consider extending to daily)
- [ ] `e2e/reveal-animation-reduced-motion.spec.ts`

- [ ] **Step 5: Update `docs/systems/daily-puzzle.md`**

Append to the "Lifecycle" section (or wherever Phase 5b documented the game-over flow), one paragraph:

> **Round-end pause.** Daily and free games now transition `playing → round-ended → game-over` via a `finalize` reducer action. The intermediate `round-ended` status is the window in which the existing reveal-animation effects fire (border highlight, dashed-arc geodesic, country-panel slide). The controller schedules `finalize` after the reveal animation completes (≥ 3 s for country, ≥ 2 s for city); a key press (Enter / Esc / Space) skips the hold. E2E specs use `__funworldmap_game.finalize()` to bypass the wall-clock wait.

- [ ] **Step 6: Run e2e — targeted, then full**

Run: `npm run test:e2e -- daily-reveal-on-final-attempt daily-best-of-3 --project=chromium-gpu`
Expected: PASS.

Run: `npm run test:e2e`
Expected: PASS. If a spec still fails, the assertion site was missed in Step 4 — patch and re-run.

- [ ] **Step 7: Commit + open PR**

```bash
git add e2e/ docs/systems/daily-puzzle.md
git commit -m "test(e2e): adapt suite to round-ended → finalize → game-over flow"
git push -u origin fix/reveal-pipeline
gh pr create --title "Reveal pipeline: surface the answer on the final round" --body "$(cat <<'EOF'
## Summary
- Reducer's endOfRound now always returns 'round-ended'; new finalize action transitions to 'game-over'
- Controller and App.advanceRoundEndPanel dispatch finalize on lastOutcome.endsGame
- Daily best-of-3 and free kill-shot rounds now play the existing reveal animation before the game-over modal

## Test plan
- [ ] All vitest unit tests pass (npm run test:unit)
- [ ] daily-reveal-on-final-attempt.spec.ts asserts ordering
- [ ] All other e2e green on chromium and chromium-gpu

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for PR review + merge before starting Phase 2.

---

# Phase 2 — Independent fixes

**Branch:** `fix/assessment-2026-05-02-polish` (off `main` after Phase 1 merges)
**Target merge:** `main`

```bash
git checkout main && git pull
git checkout -b fix/assessment-2026-05-02-polish
```

---

### Task 8: `DailyRevealOverlay` — hide today's headline for unplayed modes

**Files:**
- Modify: `src/components/DailyRevealOverlay.tsx`
- Modify: `src/App.tsx` (resolve `puzzle` and `today`, pass as props)
- Create: `src/components/__tests__/DailyRevealOverlay.test.tsx`

> **Refactor approach:** Pass `puzzle` and `today` into `DailyRevealOverlay` as props rather than calling `useDailyPuzzlesContext()` and `toLocalDateString(new Date())` inside. This drops the test file's dependency on a real `DailyPuzzlesProvider` (which fetches `/daily/index.json`) and keeps the component pure. App.tsx already has the puzzles context one level up — wiring is one line.

- [ ] **Step 1: Lift `puzzle` and `today` into props**

In `src/components/DailyRevealOverlay.tsx`:

1. Replace the `Props` interface:

```ts
import type { DailyPuzzle } from '../game/daily/types' // existing type

interface Props {
  date: string
  modeId: ModeId | null
  puzzle: DailyPuzzle | null
  today: string                 // YYYY-MM-DD
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
}
```

2. Drop the `useDailyPuzzlesContext` call and `byDate(date)`. Replace with the `puzzle` prop directly:

```tsx
export function DailyRevealOverlay({ date, modeId, puzzle, today, countries, cities, onClose }: Props) {
  const { get, streak } = useDailyHistory()
  // ... (rest of body unchanged except puzzle is now from props)
```

3. Add the spoiler gate. After `cpRecord` and `cgRecord` are computed:

```ts
  const isToday = date === today
  const hideCountryHeadline = isToday && !cpRecord
  const hideCityHeadline = isToday && !cgRecord
```

- [ ] **Step 2: Update the country render block (was line 103-122)**

```tsx
        {puzzle && showCountry && country && (
          <div data-testid="daily-reveal-country" className="mb-4 pb-4 border-b border-sand-200 dark:border-dark-300">
            <div className="text-[11px] uppercase tracking-widest text-teal-accessible dark:text-teal-light mb-1">Country</div>
            {hideCountryHeadline ? (
              <div className="text-sand-700 dark:text-dark-100">Finish today's daily first.</div>
            ) : (
              <>
                <div className="text-xl font-bold text-sand-900 dark:text-dark-50">{country.name.common}</div>
                {cpRecord ? (
                  <div className="mt-2 text-sm text-sand-700 dark:text-dark-100">
                    Your attempts:{' '}
                    <span className="tabular-nums">
                      {cpRecord.attempts.map((a, i) => (
                        <span key={i} aria-label={scoreDot(a.pointsEarned).label}>{scoreDot(a.pointsEarned).emoji}</span>
                      ))}
                    </span>{' '}
                    <span className="font-semibold">{cpRecord.score}/100</span>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-sand-600 dark:text-dark-100">Not played.</div>
                )}
              </>
            )}
          </div>
        )}
```

Mirror the same shape for the city block — replace `hideCountryHeadline` with `hideCityHeadline`, swap `country.name.common` for `${city.name}, ${city.countryName}`, and reuse `cgRecord`.

- [ ] **Step 3: Wire from `App.tsx` (line 414-425)**

```tsx
      {revealState && (
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
      )}
```

`byDate` is on the puzzles context — App already consumes the context elsewhere; if not in this scope, add `const { byDate } = useDailyPuzzlesContext()` near the other hook calls in `AppInner`. Import `toLocalDateString` from `./game/daily/dates`.

- [ ] **Step 4: Write the failing test**

Create `src/components/__tests__/DailyRevealOverlay.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DailyRevealOverlay } from '../DailyRevealOverlay'
import { __resetForTests as resetHistoryStore } from '../../game/daily/historyStore'
import { setHistory } from '../../game/daily/historyStore'
import type { CountryLike, CityLike } from '../../game/shared/types'
import type { DailyPuzzle } from '../../game/daily/types'

const countries: CountryLike[] = [{ cca3: 'FRA', name: { common: 'France' }, flag: 'flags/FR.svg', latlng: [46, 2], independent: true }]
const cities: CityLike[] = [{ id: 'FR-paris', name: 'Paris', countryCca3: 'FRA', countryName: 'France', countryFlag: 'flags/FR.svg', latlng: [48.85, 2.35], scalerank: 1 }]
const puzzle: DailyPuzzle = { date: '2026-05-02', country: { cca3: 'FRA' }, city: { id: 'FR-paris' } } as DailyPuzzle

describe('DailyRevealOverlay spoiler gate', () => {
  beforeEach(() => { resetHistoryStore(); cleanup() })

  it('today + unplayed: country headline hidden', () => {
    render(<DailyRevealOverlay date="2026-05-02" today="2026-05-02" modeId={null} puzzle={puzzle} countries={countries} cities={cities} onClose={() => {}} />)
    expect(screen.queryByText('France')).toBeNull()
    expect(screen.getAllByText(/Finish today's daily/i).length).toBeGreaterThan(0)
  })

  it('today + played country: country headline rendered', () => {
    setHistory((p) => ({
      ...p,
      days: { ...p.days, '2026-05-02': { 'country-pinning': { score: 80, attempts: [], completedAt: 0 } } },
    }))
    render(<DailyRevealOverlay date="2026-05-02" today="2026-05-02" modeId={null} puzzle={puzzle} countries={countries} cities={cities} onClose={() => {}} />)
    expect(screen.getByText('France')).toBeInTheDocument()
  })

  it('past + unplayed: headline rendered (past days are inert)', () => {
    render(<DailyRevealOverlay date="2026-04-25" today="2026-05-02" modeId={null} puzzle={puzzle} countries={countries} cities={cities} onClose={() => {}} />)
    expect(screen.getByText('France')).toBeInTheDocument()
  })
})
```

> **Implementer note:** Confirm `historyStore.ts` exports `__resetForTests` and `setHistory`. They're used by `useDailyHistory.test.tsx`; if the names differ in the actual file, mirror what's already there.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test:unit -- src/components/__tests__/DailyRevealOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check both call sites**

Run: `npm run build`
Expected: SUCCESS. App.tsx now passes `puzzle` and `today`; the component signature requires them.

- [ ] **Step 7: Commit**

```bash
git add src/components/DailyRevealOverlay.tsx src/App.tsx src/components/__tests__/DailyRevealOverlay.test.tsx
git commit -m "fix(daily): hide today's reveal headline for unplayed modes (spoiler gate)"
```

---

### Task 9: `endedEarly` flag + accurate game-over copy

**Files:**
- Modify: `src/game/shared/types.ts`
- Modify: `src/game/shared/useGameSession.ts`
- Modify: `src/game/shared/hud/GameOverOverlay.tsx`
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`
- Modify: `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`

- [ ] **Step 1: Write the failing reducer test**

Append to `useGameSession.test.ts`:

```ts
describe('endedEarly flag', () => {
  it('start sets endedEarly false', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    expect(result.current.session.endedEarly).toBe(false)
  })

  it('finishFree sets endedEarly true', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.finishFree())
    expect(result.current.session.endedEarly).toBe(true)
  })

  it('endOfRound natural ending leaves endedEarly false', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
    act(() => result.current.advance(round('ITA')))
    act(() => result.current.attempt(countryInput('ESP'), miss('ITA', 'ESP')))
    act(() => result.current.advance(round('PRT')))
    act(() => result.current.attempt(countryInput('GBR'), miss('PRT', 'GBR')))
    expect(result.current.session.lives).toBe(0)
    expect(result.current.session.endedEarly).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: TypeScript error on `result.current.session.endedEarly`.

- [ ] **Step 3: Add the field**

`src/game/shared/types.ts`. Add to `GameSession`:

```ts
  endedEarly: boolean
```

`src/game/shared/useGameSession.ts`:

1. Add to `EMPTY` (line 24-40):

```ts
  endedEarly: false,
```

2. `start` case (line 86-97): the spread `...EMPTY` already resets it. No change.

3. `finishFree` case (line 177-181):

```ts
    case 'finishFree': {
      if (state.status === 'idle' || state.status === 'game-over') return state
      if (state.dailyDate !== null) return state
      return { ...state, status: 'game-over', endedEarly: true }
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:unit -- src/game/shared/__tests__/useGameSession.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `GameOverOverlay` copy**

`src/game/shared/hud/GameOverOverlay.tsx:65-71`. Replace:

```tsx
        <p className="text-sm text-sand-600 dark:text-dark-100 mb-4">
          {session.endedEarly
            ? 'Game ended early.'
            : session.maxRounds === null
              ? 'Three wrong guesses.'
              : session.maxRounds === 1
                ? '1 round complete.'
                : `${session.maxRounds} rounds complete.`}
        </p>
```

- [ ] **Step 6: Update inline `GameSession` fixtures across the test tree**

The new field forces every `as GameSession` literal to add `endedEarly`. Find them with:

```bash
grep -rn "GameSession\|baseSession" src/ --include="*.test.*" --include="*.tsx" --include="*.ts" | grep -v "import"
```

Add `endedEarly: false` to each fixture object. Touched files at minimum:
- `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`
- `src/game/shared/hud/__tests__/ScoreBadge.test.tsx` (if it constructs a session)
- Any `__tests__/*.test.tsx` you grep up

Plus add a test in `GameOverOverlay.test.tsx`:

```tsx
it('renders "Game ended early." when session.endedEarly is true', () => {
  render(<GameOverOverlay session={{ ...baseSession, endedEarly: true }} ... />)
  expect(screen.getByText('Game ended early.')).toBeInTheDocument()
})
```

- [ ] **Step 7: Type-check + run**

Run: `npm run build && npm run test:unit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/shared/types.ts src/game/shared/useGameSession.ts src/game/shared/hud/GameOverOverlay.tsx src/game/shared/__tests__/useGameSession.test.ts src/game/shared/hud/__tests__/GameOverOverlay.test.tsx
git commit -m "fix(game-over): accurate copy when free game ended early"
```

---

### Task 10: Reset `lastMilestoneShown` on streak break

**Files:**
- Modify: `src/game/daily/storage.ts`
- Modify: `src/game/daily/__tests__/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/game/daily/__tests__/storage.test.ts`:

```ts
describe('updateStreak resets lastMilestoneShown on break', () => {
  it('streak break (gap > 1 day) resets lastMilestoneShown to 0', () => {
    const h: DailyHistoryV1 = {
      version: 1,
      streak: { current: 30, longest: 30, lastActiveDate: '2026-04-01', lastMilestoneShown: 30 },
      days: {},
    }
    const next = updateStreak(h, '2026-05-01') // 30 days later
    expect(next.streak.current).toBe(1)
    expect(next.streak.lastMilestoneShown).toBe(0)
  })

  it('streak continue preserves lastMilestoneShown', () => {
    const h: DailyHistoryV1 = {
      version: 1,
      streak: { current: 5, longest: 5, lastActiveDate: '2026-05-01', lastMilestoneShown: 3 },
      days: {},
    }
    const next = updateStreak(h, '2026-05-02')
    expect(next.streak.current).toBe(6)
    expect(next.streak.lastMilestoneShown).toBe(3)
  })

  it('first ever play (last=null) leaves lastMilestoneShown at 0', () => {
    const h: DailyHistoryV1 = {
      version: 1,
      streak: { current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0 },
      days: {},
    }
    const next = updateStreak(h, '2026-05-02')
    expect(next.streak.current).toBe(1)
    expect(next.streak.lastMilestoneShown).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- src/game/daily/__tests__/storage.test.ts`
Expected: first test FAILs with `30 to be 0`.

- [ ] **Step 3: Update `updateStreak` (storage.ts:65-79)**

```ts
export function updateStreak(h: DailyHistoryV1, date: string): DailyHistoryV1 {
  const last = h.streak.lastActiveDate
  if (last === date) return h
  const continued = !!last && daysBetween(last, date) === 1
  const current = continued ? h.streak.current + 1 : 1
  const longest = Math.max(h.streak.longest, current)
  // On streak break (had a previous active date but gap > 1 day), reset
  // milestone-shown so the user can re-celebrate 3/7/14/30 on rebuild.
  const broke = !!last && !continued
  const lastMilestoneShown = broke ? 0 : h.streak.lastMilestoneShown
  return {
    ...h,
    streak: { ...h.streak, current, longest, lastActiveDate: date, lastMilestoneShown },
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:unit -- src/game/daily/__tests__/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/daily/storage.ts src/game/daily/__tests__/storage.test.ts
git commit -m "fix(streak): reset lastMilestoneShown on streak break"
```

---

### Task 11: Launcher card — per-mode best denominator + past-unplayed CTA

**Files:**
- Modify: `src/components/LauncherModeCard.tsx`
- Modify: `src/components/Launcher.tsx`
- Create: `src/components/__tests__/LauncherModeCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/LauncherModeCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherModeCard } from '../LauncherModeCard'

const baseBest = { bestScore: 432, bestStreak: 5, gamesPlayed: 3 }

describe('LauncherModeCard', () => {
  it('country-pinning best is shown without /1000 denominator', () => {
    render(<LauncherModeCard modeId="country-pinning" todayDate="2026-05-02" state="unplayed" freeBest={baseBest} onStartDaily={() => {}} onStartFree={() => {}} />)
    expect(screen.getByTestId('launcher-card-country-pinning-free-best').textContent).toMatch(/432\s*pts/)
    expect(screen.getByTestId('launcher-card-country-pinning-free-best').textContent).not.toContain('/ 1000')
  })

  it('city-guessing best keeps the /1000 denominator', () => {
    render(<LauncherModeCard modeId="city-guessing" todayDate="2026-05-02" state="unplayed" freeBest={baseBest} onStartDaily={() => {}} onStartFree={() => {}} />)
    expect(screen.getByTestId('launcher-card-city-guessing-free-best').textContent).toMatch(/432\s*\/\s*1000/)
  })

  it("past-unplayed state renders 'See reveal' CTA, not Play", () => {
    render(<LauncherModeCard modeId="country-pinning" anchorDate="2026-04-25" todayDate="2026-05-02" state="past-unplayed" freeBest={baseBest} onStartDaily={() => {}} onStartFree={() => {}} onSeeReveal={() => {}} />)
    expect(screen.queryByText(/Play\s*·\s*3 attempts/)).toBeNull()
    expect(screen.getByTestId('launcher-card-country-pinning-see-reveal')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- src/components/__tests__/LauncherModeCard.test.tsx`
Expected: FAIL — denominator not branched, `'past-unplayed'` is not a valid state.

- [ ] **Step 3: Update `LauncherCardState` and rendering**

`src/components/LauncherModeCard.tsx`:

1. Extend the union (line 4):

```ts
export type LauncherCardState = 'unplayed' | 'played' | 'past-unplayed' | 'unavailable'
```

2. Add a `'past-unplayed'` render block right after the `'unplayed'` block (after line 83):

```tsx
      {state === 'past-unplayed' && onSeeReveal && (
        <button
          type="button"
          onClick={onSeeReveal}
          data-testid={`${testIdBase}-see-reveal`}
          className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60"
        >
          See reveal
        </button>
      )}
```

3. Update the "Best (free)" footer (line 121):

```tsx
        <span data-testid={`${testIdBase}-free-best`} className="tabular-nums">
          {freeBest.gamesPlayed > 0
            ? (modeId === 'country-pinning' ? `${freeBest.bestScore} pts` : `${freeBest.bestScore} / 1000`)
            : (modeId === 'country-pinning' ? '— pts' : '— / 1000')}
        </span>
```

- [ ] **Step 4: Update `Launcher.cardState` to return `'past-unplayed'` for past anchor dates**

`src/components/Launcher.tsx:55-62`:

```tsx
  function cardState(modeId: ModeId): LauncherCardState {
    if (puzzlesStatus === 'unavailable') return 'unavailable'
    if (puzzlesStatus === 'loading') return 'unavailable'
    const puzzle = byDate(date)
    if (!puzzle) return 'unavailable'
    const prior = getDay(date, modeId)
    if (prior) return 'played'
    if (date < today) return 'past-unplayed'
    return 'unplayed'
  }
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test:unit -- src/components/__tests__/LauncherModeCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/LauncherModeCard.tsx src/components/Launcher.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "fix(launcher): country-pinning denominator + past-unplayed See-reveal CTA"
```

---

### Task 12: Gate the round-start announcement on round-key transition

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Add the round-key ref**

Near the other refs (`GameController.tsx:106-113`):

```ts
  const lastAnnouncedRoundKeyRef = useRef<string | null>(null)
```

- [ ] **Step 2: Gate the announcement (line 293-300)**

Replace:

```ts
    if (session.status === 'playing' && session.currentRound) {
      if (session.roundIndex === 0) recordedRef.current = false
      if (session.currentRound.kind === 'country-pinning') {
        dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
      } else {
        const r = session.currentRound
        dispatchAnnouncement(`Round ${session.roundIndex + 1}. Where is ${r.targetName}, ${r.targetCountryName}? Click anywhere on the map.`)
      }
    }
```

with:

```ts
    if (session.status === 'playing' && session.currentRound) {
      if (session.roundIndex === 0) recordedRef.current = false
      const key = session.currentRound.kind === 'country-pinning'
        ? session.currentRound.targetCca3
        : session.currentRound.targetId
      if (lastAnnouncedRoundKeyRef.current !== key) {
        lastAnnouncedRoundKeyRef.current = key
        if (session.currentRound.kind === 'country-pinning') {
          dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
        } else {
          const r = session.currentRound
          dispatchAnnouncement(`Round ${session.roundIndex + 1}. Where is ${r.targetName}, ${r.targetCountryName}? Click anywhere on the map.`)
        }
      }
    }
```

- [ ] **Step 3: Reset the ref when the session ends**

In the existing `if (session.status === 'game-over' && !recordedRef.current)` block (line 358), append:

```ts
      lastAnnouncedRoundKeyRef.current = null
```

So the next `start` re-announces from a clean slate.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`. With NVDA or VoiceOver, start a daily. Click attempt 1, observe SR speaks "Pin: France" once. Click attempt 2, observe SR does NOT re-announce. Advance round (free mode), observe SR announces the new target.

If you don't have a screen reader available, fall back to: open devtools, watch `[data-testid="announce-region"]`'s textContent — it should set on round transition only, not per attempt.

- [ ] **Step 5: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "fix(a11y): announce round target once per round, not per attempt"
```

---

### Task 13: `+0` toast suppression

**Files:**
- Modify: `src/game/shared/hud/AttemptsIndicator.tsx`
- Create: `src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttemptsIndicator } from '../AttemptsIndicator'
import type { GameSession } from '../../types'

const baseSession: GameSession = {
  modeId: 'country-pinning', status: 'playing', lives: 3, score: 0, streak: 0, bestStreak: 0,
  roundIndex: 0, maxRounds: 1, attemptsPerRound: 3, attemptsRemaining: 2,
  currentAttempts: [], currentRound: null, lastOutcome: null, dailyDate: '2026-05-02',
  used: new Set(), endedEarly: false,
}

describe('AttemptsIndicator', () => {
  it('renders +pts toast when last attempt scored > 0', () => {
    const sess = { ...baseSession, currentAttempts: [{ pointsEarned: 42, input: { kind: 'skip' } as const, reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: null, clickedName: null, distanceKm: null } as const }] }
    render(<AttemptsIndicator session={sess} />)
    expect(screen.getByText('+42')).toBeInTheDocument()
  })

  it('does NOT render toast when last attempt scored 0', () => {
    const sess = { ...baseSession, currentAttempts: [{ pointsEarned: 0, input: { kind: 'skip' } as const, reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: null, clickedName: null, distanceKm: null } as const }] }
    render(<AttemptsIndicator session={sess} />)
    expect(screen.queryByText('+0')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx`
Expected: second test FAILs (`+0` rendered).

- [ ] **Step 3: Gate the toast**

`src/game/shared/hud/AttemptsIndicator.tsx:9-17`. Replace:

```ts
  useEffect(() => {
    if (!last || session.status !== 'playing') {
      setToast(null)
      return
    }
    setToast({ pts: last.pointsEarned, key: used })
    const t = window.setTimeout(() => setToast(null), 1000)
    return () => window.clearTimeout(t)
  }, [used, last, session.status])
```

with:

```ts
  useEffect(() => {
    if (!last || session.status !== 'playing' || last.pointsEarned <= 0) {
      setToast(null)
      return
    }
    setToast({ pts: last.pointsEarned, key: used })
    const t = window.setTimeout(() => setToast(null), 1000)
    return () => window.clearTimeout(t)
  }, [used, last, session.status])
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/shared/hud/AttemptsIndicator.tsx src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx
git commit -m "fix(hud): suppress +0 toast on zero-point attempts"
```

---

### Task 14: `daily_attempted.attemptIndex` 1-based to match docs

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Read the doc reference**

Run: `grep -n "attemptIndex" docs/systems/daily-puzzle.md src/game/GameController.tsx`. The doc says `1|2|3`; the impl emits `prev` (0|1|2).

- [ ] **Step 2: Update the impl (`GameController.tsx:412-418`)**

Replace:

```ts
      if (session.attemptsPerRound > 1) {
        track('daily_attempted', {
          mode: session.modeId,
          attemptIndex: prev,
          scoreBucket: Math.min(4, Math.floor(a.pointsEarned / 20)),
        })
      }
```

with:

```ts
      if (session.attemptsPerRound > 1) {
        track('daily_attempted', {
          mode: session.modeId,
          attemptIndex: (prev + 1) as 1 | 2 | 3,
          scoreBucket: Math.min(4, Math.floor(a.pointsEarned / 20)),
        })
      }
```

- [ ] **Step 3: Note the analytics deployment caveat**

If the Cloudflare Worker queries (`cloudflare-worker/queries/`) currently filter `attemptIndex IN (0, 1, 2)`, they'll go silent until updated. Add a brief mention to the PR body when opening it.

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "fix(telemetry): emit daily_attempted.attemptIndex as 1-based per docs"
```

---

### Task 15: Phase 2 verification gate (and Phase 1 focus sanity)

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 2: Run lint + typecheck**

Run: `npm run lint && npm run build`
Expected: SUCCESS.

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS. Phase 2 changes are component-level and shouldn't affect e2e flow; if `launcher-history` fails, the past-unplayed CTA may have broken an old assertion that expected the "Play" button on past days.

- [ ] **Step 4: Phase 1 focus-management spot check**

Specific to the `round-ended → game-over` transition Phase 1 introduced — covered here because Phase 2 is the first time this PR is reviewed alongside accumulated UX:

Boot dev server with `VITE_TEST_HOOKS=1 npm run dev`. In a daily best-of-3 country-pinning round:
- Make three wrong guesses.
- During the reveal hold, the `CountryPanel` (with `inGameRound={true}`) renders. Verify focus lands inside it (the "Continue"/close button per `App.tsx:398-412`).
- Press Enter to skip the hold. Verify focus moves to `[data-testid="game-over-back"]` (or `game-over-play-again`).
- Tab and Shift-Tab inside the game-over modal — focus must stay trapped, not escape to the now-unmounted panel.
- Press Escape — game-over should close to launcher, focus on a launcher card or "Just explore the map".

If focus skips a step (e.g., lands on `<body>` between panel unmount and modal mount), file a follow-up — focus-return logic on the `inGameRound` panel may need a guard to skip its return when game-over is the next state. Don't gate the merge on this unless it's catastrophic.

- [ ] **Step 5: Manual smoke walk-through (15 min, Phase 2 features)**

Same boot. Walk through:
- Today, both modes unplayed → click calendar today cell → reveal opens; country and city headlines BOTH read "Finish today's daily first." (no spoilers).
- Play country, complete daily → re-open reveal → country headline now reads "France" (or whatever); city still says "Finish today's daily first."
- End game in free country mid-round → game-over copy reads "Game ended early."
- End game in free city after 4 of 10 rounds → same copy.
- Build a 3-day streak (devtools seed two prior days, play today) → milestone overlay fires on next launcher render.
- Seed a 30-day streak with `lastMilestoneShown: 30` then skip a day; on completion check `localStorage.getItem('funworldmap-daily-history')` — `lastMilestoneShown` should be 0.
- Open `/#daily/2026-04-25` → mode card CTA reads "See reveal", not "Play · 3 attempts".
- Country-pinning launcher card footer shows "X pts"; city card shows "X / 1000".
- Make 3 daily attempts; the round-prompt SR announce fires once (verify via `[data-testid="announce-region"]` textContent inspection in devtools). Misclicks scoring 0 produce no `+0` toast.

- [ ] **Step 5: Open Phase 2 PR**

```bash
git push -u origin fix/assessment-2026-05-02-polish
gh pr create --title "Assessment 2026-05-02 polish: 8 independent fixes" --body "$(cat <<'EOF'
## Summary
- Spoiler gate on /reveal for unplayed today
- "Game ended early." copy for free End-game
- Milestone re-eligible after streak break
- Per-mode launcher denominator + past-unplayed See-reveal CTA
- SR announcement once per round; suppress +0 toast
- daily_attempted.attemptIndex emitted as 1-based to match docs (worker queries may need updating)

## Test plan
- [ ] All vitest unit tests pass
- [ ] Full e2e suite green
- [ ] Manual smoke walkthrough completed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## What this plan does NOT cover

These bullets from the assessment were considered and de-scoped:

- **Daily End game save-scum loophole** (#9 in the final ranked list). Behaviour is design-intentional or design-ambiguous; needs a product decision before code. If product wants a confirmation dialog, file a follow-up.
- **Multiple `role="status"` regions in the HUD** (#11 in the final ranked list). Real but assistive-tech-dependent. The cleanup is a refactor across six components; recommend opening a tracked issue rather than bundling here.
- **`cellKind: 'rolled-off'` documented but unreachable** (#12). One-line doc fix or one-line code emit; do whichever you prefer in a drive-by commit, no plan needed.

---

## Self-review notes

**Spec coverage:** Findings 1–8 from the final ranked list each map to a task (1–7 → Phase 1; 8–14 → Phase 2 except telemetry which is also Phase 2). Findings 9, 11, 12 deferred above with reasons.

**Type consistency:** `finalize` is the action name throughout (reducer, hook, context, controller, App). `endedEarly` is the field name on `GameSession`. `'past-unplayed'` is the new `LauncherCardState`. `lastAnnouncedRoundKeyRef` is the ref name. No name drift across tasks.

**Placeholder scan:** No "TBD" / "implement later" / "similar to". Every code step shows the actual code; every test step shows the actual assertions; every command step shows the exact command.

**File-path consistency:** All paths are absolute from repo root. Task 11 spans three files which match the file-structure section. Task 8 lifts both `puzzle` and `today` into props of `DailyRevealOverlay` (App.tsx wires both via `useDailyPuzzlesContext().byDate` and `toLocalDateString(new Date())`); the test file constructs both directly without instantiating a real provider.

**Revision log (2026-05-02 critical pass):**
- Task 4 — `finalize` test seam upgraded from optional to required. It's load-bearing for the Task 7 e2e sweep (cleanly skips the new reveal hold without 3 s wall-clock waits).
- Task 5 — wrong-and-endsGame country-pinning timer now uses `Math.max(animatedMs ?? 0, 3000)` instead of a hard-coded 3000 ms, so long-distance arc animations aren't truncated.
- Task 7 — was a one-spec patch; now a suite-wide sweep. Twelve files enumerated (the 10 game-flow specs plus both `reveal-animation` specs); pattern is `__funworldmap_game.finalize()` before any post-final-attempt game-over assertion. Includes the `docs/systems/daily-puzzle.md` lifecycle update.
- Task 8 — refactored to pass `puzzle: DailyPuzzle | null` and `today: string` as props rather than calling `useDailyPuzzlesContext()` and `new Date()` inside. The component is now context-free for tests; App.tsx resolves both one level up.
- Task 9 — added a concrete grep command for the inline-fixture sweep so the implementer doesn't have to discover them by failure.
- Task 15 — new explicit Phase 1 focus-management spot check (round-ended panel → game-over modal transition).

**Risk callouts:**
- Task 1 changes a reducer invariant; Task 3 explicitly repairs the existing tests it breaks. If a separate test file relies on the old transition, the repair pattern from Task 3 applies there too.
- Task 7 — the e2e sweep is the largest source of churn in Phase 1. Use the explicit file checklist in Step 4 to avoid missing one. The `reveal-animation.spec.ts` cases that currently target free-mode round-ended should still pass without modification — they don't reach an `endsGame` path.
- Task 14 changes a public telemetry contract. The PR body should mention the worker query side-effect; if `cloudflare-worker/queries/*.sql` filters `attemptIndex IN (0, 1, 2)`, those queries go silent until updated.
- Task 8 — verify `historyStore.ts` actually exports `__resetForTests` and `setHistory` with those names before relying on the test imports. They're used by `useDailyHistory.test.tsx`, which is the canonical pattern.
