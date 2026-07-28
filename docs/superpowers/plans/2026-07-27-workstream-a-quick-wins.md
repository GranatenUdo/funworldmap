# Workstream A — Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 16 unanimous quick-win fixes from the 2026-07-26 UX/visual program spec (workstream A) as ~14 ordered commits, plus the one-hour B1 glyph spike — bugs first (Escape discards runs, iOS focus zoom, AA failures), then panel/search/hint/compare restructures, touch targets last.

**Architecture:** No new systems. Every change lands inside existing components/hooks and follows the repo's single-owner patterns; the only new modules are one extracted hook (`useEscapeExit`) and test files. Tasks execute strictly in order 1 → 15 — later tasks quote code as it exists after earlier tasks land (the search tasks share one input line; the touch-target task pads the post-restructure button set).

**Tech Stack:** React 19, TypeScript, Tailwind 4, MapLibre GL 5, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` — workstream A and the "A-batch commit structure". Task ↔ spec map: T1=A1, T2=A6, T3=A10, T4=A16, T5=A4+A5, T6=A7, T7=A2, T8=A11, T9=A3, T10=A12+A14(hint half), T11=A9, T12=A15, T13=A8 (descoped to map clicks), T14=A13, T15=B1 spike.

## Global Constraints

- e2e rules (CLAUDE.md): no `page.waitForTimeout`, no `click({ force: true })`, auto-retrying `expect()` over manual polls, readiness via `e2e/helpers.ts` (`gotoAndWaitForMap`, `waitForAppReady`, `routeMapTiles`, `waitForAnimationIdle`, game/map test seams).
- Kill any stray `npm run dev` before running Playwright — `reuseExistingServer` would reuse it without `VITE_TEST_HOOKS` (project memory).
- e2e commands use `--project=chromium --workers=2`; 13 of 38 specs are local-only on CI (`docs/systems/testing.md` § "What Runs in CI") — where a task touches a local-only spec it says so and must be run locally before merge.
- WCAG AA on both themes for every color change; touch targets ≥ 44px on coarse pointers (pinned by Task 14's convention test).
- New localStorage keys follow the `funworldmap-*` naming convention; no sessionStorage for cross-session gates.
- Field-level source attribution must never silently regress (project constitution) — Task 5 carries the interim attribution affordance.
- Commits: conventional prefix (`fix:`/`feat:`/`test:`/`chore:`), imperative one-liner, body when needed, ending with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- After the batch: full `npm run check`, then `npm run test:e2e` locally, then a live pass of the touched flows on desktop + 390px mobile in both themes.

---

### Task 1: A1 — Escape mid-round records the run (route through `finishFree()`)

**Files:**
- Create: `src/game/hooks/useEscapeExit.ts`
- Create: `src/game/hooks/__tests__/useEscapeExit.test.tsx`
- Modify: `src/game/GameController.tsx:1-4` (imports), `src/game/GameController.tsx:78-93` (Escape effect)
- Test: `src/game/hooks/__tests__/useEscapeExit.test.tsx`, `e2e/game-country-pinning.spec.ts` (new test appended after line 162)

**Interfaces:**
- Consumes: `GameSessionApi.finishFree: () => void` and `endGame: () => void` (from `src/game/shared/GameSessionProvider.tsx`), `GameStatus` / `ModeId` (from `src/game/shared/types.ts`), `isCountryPinning` (from `src/game/shared/modePredicates.ts`).
- Produces: `useEscapeExit(args: UseEscapeExitArgs): void` where `UseEscapeExitArgs = { status: GameStatus; modeId: ModeId; finishFree: () => void; exitToIdle: () => void }`.

Context: today `GameController.tsx`'s Escape handler (lines 80–93) calls `endGame()` + `writeIdleHash()` for every non-idle status except country-pinning `round-ended` — so a mid-run Escape silently discards the score and never records the personal best, while the HUD's End-game button correctly routes `finishFree()` → game-over → record. Per the spec (workstream A, item A1): `playing` (both modes) and city-guessing `round-ended` must route through `finishFree()`; game-over Escape keeps `endGame()` + `writeIdleHash()` (`finishFree` is a no-op on game-over — see the reducer guard in `src/game/shared/useGameSession.ts:107` — and the `#game` hash must reset); Escape-as-advance on country-pinning `round-ended` stays owned by `useGameAnnouncements` (its `holdThenAdvance` / `onKey` branches) and is untouched. No unit test currently pins the Escape behavior, and no e2e asserts the mid-run exit path — this task adds both. The extraction-to-hook follows the repo's established pattern ("the effect formerly inlined in GameController", see the header comment of `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`).

- [ ] **Step 1: Write the failing unit test.** Create `src/game/hooks/__tests__/useEscapeExit.test.tsx` with exactly:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useEscapeExit, type UseEscapeExitArgs } from '../useEscapeExit'

afterEach(() => cleanup())

// Dispatch on document.body (bubbles to the window listener) — dispatching on
// window directly would make e.target the window object, which has no
// .matches() and does not model a real browser keydown (target = focused el).
function pressEscape(target: HTMLElement = document.body) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  )
}

function renderEscapeExit(overrides: Partial<UseEscapeExitArgs> = {}) {
  const finishFree = vi.fn()
  const exitToIdle = vi.fn()
  renderHook(() =>
    useEscapeExit({
      status: 'playing',
      modeId: 'country-pinning',
      finishFree,
      exitToIdle,
      ...overrides,
    }),
  )
  return { finishFree, exitToIdle }
}

describe('useEscapeExit', () => {
  it('routes Escape during playing through finishFree so the run is recorded', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({ status: 'playing' })
    pressEscape()
    expect(finishFree).toHaveBeenCalledTimes(1)
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('routes Escape during city-guessing round-ended through finishFree', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({
      status: 'round-ended',
      modeId: 'city-guessing',
    })
    pressEscape()
    expect(finishFree).toHaveBeenCalledTimes(1)
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('does nothing on country-pinning round-ended (Escape advances via the round-end effect)', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({
      status: 'round-ended',
      modeId: 'country-pinning',
    })
    pressEscape()
    expect(finishFree).not.toHaveBeenCalled()
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('routes Escape on game-over through exitToIdle (finishFree is a no-op there; hash must reset)', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({ status: 'game-over' })
    pressEscape()
    expect(exitToIdle).toHaveBeenCalledTimes(1)
    expect(finishFree).not.toHaveBeenCalled()
  })

  it('does nothing while idle', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({ status: 'idle' })
    pressEscape()
    expect(finishFree).not.toHaveBeenCalled()
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('ignores Escape originating from a text input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    try {
      const { finishFree, exitToIdle } = renderEscapeExit({ status: 'playing' })
      pressEscape(input)
      expect(finishFree).not.toHaveBeenCalled()
      expect(exitToIdle).not.toHaveBeenCalled()
    } finally {
      input.remove()
    }
  })
})
```

- [ ] **Step 2: See it fail.** Run:

```
npx vitest run src/game/hooks/__tests__/useEscapeExit.test.tsx
```

Expected failure: the suite errors with `Failed to resolve import "../useEscapeExit"` (the module does not exist yet).

- [ ] **Step 3: Implement the hook.** Create `src/game/hooks/useEscapeExit.ts` with exactly:

```ts
import { useEffect, useRef } from 'react'
import type { GameStatus, ModeId } from '../shared/types'
import { isCountryPinning } from '../shared/modePredicates'

export interface UseEscapeExitArgs {
  status: GameStatus
  modeId: ModeId
  /** Ends the run with a recorded score — game-over overlay shows (matches the HUD End-game button). */
  finishFree: () => void
  /** Full exit to the idle map: endGame() + game-hash reset. */
  exitToIdle: () => void
}

/**
 * Escape exits, per status:
 * - idle: no handler.
 * - country-pinning round-ended: not handled here — Escape is owned by the
 *   round-end effect in useGameAnnouncements (advance, not exit).
 * - playing (both modes) and city-guessing round-ended: finishFree() — the
 *   score is shown and the personal best recorded via the game-over overlay
 *   instead of being silently discarded (2026-07 UX audit item A1).
 * - game-over: exitToIdle() — finishFree would be a reducer no-op there and
 *   the #game hash must reset.
 *
 * Callbacks are read via refs so the window listener re-registers only on
 * status/modeId changes, not on every render (same pattern as
 * useMapInteractions).
 */
export function useEscapeExit({ status, modeId, finishFree, exitToIdle }: UseEscapeExitArgs): void {
  const finishFreeRef = useRef(finishFree)
  finishFreeRef.current = finishFree
  const exitToIdleRef = useRef(exitToIdle)
  exitToIdleRef.current = exitToIdle

  useEffect(() => {
    if (status === 'idle') return
    if (status === 'round-ended' && isCountryPinning(modeId)) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      if (status === 'game-over') {
        exitToIdleRef.current()
      } else {
        finishFreeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, modeId])
}
```

- [ ] **Step 4: Unit test green.** Run:

```
npx vitest run src/game/hooks/__tests__/useEscapeExit.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Wire GameController.** In `src/game/GameController.tsx`, replace the inline effect. Current code (lines 78–93):

```tsx
  // Escape exits.
  // Country-pinning round-ended: Escape is owned by the round-end effect above (advance, not exit).
  useEffect(() => {
    if (session.status === 'idle') return
    if (session.status === 'round-ended' && isCountryPinning(session.modeId)) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      endGame()
      writeIdleHash()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.status, session.modeId, endGame])
```

New code:

```tsx
  // Escape exits — per-status routing (record via finishFree vs full exit)
  // lives in useEscapeExit.
  useEscapeExit({
    status: session.status,
    modeId: session.modeId,
    finishFree,
    exitToIdle: () => {
      endGame()
      writeIdleHash()
    },
  })
```

Then fix the imports. Current line 1:

```tsx
import { useEffect, useMemo } from 'react'
```

becomes (`useEffect` is now unused):

```tsx
import { useMemo } from 'react'
```

Current line 4:

```tsx
import { isCountryPinning } from './shared/modePredicates'
```

Delete this line entirely (`isCountryPinning` was only used in the removed effect) and add, next to the other hook imports (after line 6, `import { useGameTestSeams } from './hooks/useGameTestSeams'`):

```tsx
import { useEscapeExit } from './hooks/useEscapeExit'
```

- [ ] **Step 6: Game unit suite + typecheck green.** Run:

```
npx vitest run src/game
npm run typecheck
```

Expected: all existing game tests pass (nothing pinned the old Escape routing) and `tsc -b` reports no errors (proves the removed imports really are unused).

- [ ] **Step 7: Add the e2e assertion.** In `e2e/game-country-pinning.spec.ts`, append the following test inside the `test.describe('Country Pinning game', ...)` block, directly after the `'End game opens game-over; Back to map exits cleanly and clears hash'` test (after line 162). No new helper imports are needed (`waitForMapLoaded` is already imported on line 3):

```ts
  test('Escape mid-round records the run: game-over shows instead of a silent exit', async ({
    page,
  }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMapLoaded(page)
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // A1: mid-run Escape routes through finishFree() → game-over overlay
    // (score shown, personal best recorded), matching the HUD End-game button —
    // instead of the old endGame() + hash reset that discarded the run.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })

    // A second Escape on game-over keeps the old full exit: HUD gone, hash cleared.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('game-hud')).toHaveCount(0)
    expect(page.url().endsWith('/')).toBe(true)
  })
```

- [ ] **Step 8: Run the e2e spec.** First kill any stray dev server on port 5173 — `reuseExistingServer: !process.env.CI` in `playwright.config.ts` would silently reuse a server built without `VITE_TEST_HOOKS` (project memory: this produces baffling seam failures). In PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
npx playwright test e2e/game-country-pinning.spec.ts --project=chromium --workers=2
```

Expected: all tests in the spec pass, including the new one (the spec is already in the chromium project's `testMatch` — no `playwright.config.ts` change needed since no new spec file was added).

- [ ] **Step 9: Commit.**

```bash
git add src/game/hooks/useEscapeExit.ts src/game/hooks/__tests__/useEscapeExit.test.tsx src/game/GameController.tsx e2e/game-country-pinning.spec.ts
git commit -m "$(cat <<'EOF'
fix(game): record the run when Escape ends it mid-round (A1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: A6 — Wrong-guess copy leads with distance

**Files:**
- Modify: `src/game/modes/country-pinning/messages.ts:3-6`
- Modify: `src/game/modes/country-pinning/CountryPinningHud.tsx:19`
- Create: `src/game/modes/country-pinning/__tests__/messages.test.ts`
- Create: `src/game/modes/country-pinning/__tests__/CountryPinningHud.test.tsx`
- Test: both new files above

**Interfaces:**
- Produces new signature: `MESSAGES.wrong(points: number, target: string, clicked: string | null, distanceKm: number | null): string` (was 3-arg).
- Consumes: `CountryReveal.distanceKm: number | null` (from `src/game/shared/types.ts:60`) — computed by `scoreGuess` in `src/game/modes/country-pinning/scoring.ts` (haversine to the target centroid; `null` only when the clicked centroid is unknown or on the defensive skip/point no-op paths).

Context: the current wrong-guess line — `` `Wrong — that was ${clicked}. +${points} points. The answer was ${target}. −1 life.` `` — never shows `distanceKm`, the number the whole proximity-scoring formula decays on, and repeats the target name that the HUD prompt (`game-prompt-name`, always visible above the reveal line) already shows. New shape per spec: `"That was Germany — 7,050 km from Bangladesh. +9 proximity pts · −1 life."` — distance rounded and formatted via `toLocaleString`, redundant answer sentence dropped. The reveal line `<div data-testid="game-reveal" role="status">` in `CountryPinningHud.tsx` IS the screen-reader announcement channel (`role="status"` is a live region), so threading `distanceKm` into `MESSAGES.wrong` covers both the visual line and the SR announcement in one change — `useGameAnnouncements.ts` only announces round entry ("Pin: X") and game-over, and needs no edit. No e2e test asserts the wrong-guess copy (verified: no `e2e/` match for "answer was" or country-mode `game-reveal` text), so this is unit-only.

- [ ] **Step 1: Write the failing message test.** Create `src/game/modes/country-pinning/__tests__/messages.test.ts` with exactly (expected strings are built with the same `toLocaleString()` call the implementation uses, so the test is locale-independent — the `formatPersonalBest.test.ts` precedent):

```ts
import { describe, expect, it } from 'vitest'
import { MESSAGES } from '../messages'

const km = (n: number) => Math.round(n).toLocaleString()

describe('MESSAGES.wrong — distance-led copy (A6)', () => {
  it('leads with the clicked country and its distance from the target', () => {
    expect(MESSAGES.wrong(9, 'Bangladesh', 'Germany', 7050)).toBe(
      `That was Germany — ${km(7050)} km from Bangladesh. +9 proximity pts · −1 life.`,
    )
  })

  it('rounds fractional distances before formatting', () => {
    expect(MESSAGES.wrong(85, 'France', 'Belgium', 493.6)).toContain(`${km(493.6)} km from France`)
  })

  it('drops the distance clause when distanceKm is unknown', () => {
    expect(MESSAGES.wrong(9, 'Bangladesh', 'Germany', null)).toBe(
      'That was Germany. +9 proximity pts · −1 life.',
    )
  })

  it('keeps a generic line when no country was clicked', () => {
    expect(MESSAGES.wrong(0, 'Bangladesh', null, null)).toBe('Wrong. +0 proximity pts · −1 life.')
  })

  it('never repeats the answer sentence — the HUD prompt already names the target', () => {
    expect(MESSAGES.wrong(9, 'Bangladesh', 'Germany', 7050)).not.toContain('The answer was')
  })
})
```

- [ ] **Step 2: See it fail.** Run:

```
npx vitest run src/game/modes/country-pinning/__tests__/messages.test.ts
```

Expected failure: all 5 tests fail — the current 3-arg `wrong` ignores the extra argument and returns the old `"Wrong — that was Germany. +9 points. The answer was Bangladesh. −1 life."` string.

- [ ] **Step 3: Implement the new copy.** In `src/game/modes/country-pinning/messages.ts`, replace the current `wrong` entry. Current code (whole file):

```ts
export const MESSAGES = {
  correct: (points: number, name: string) => `Correct! +${points} points. That was ${name}.`,
  wrong: (points: number, target: string, clicked: string | null) =>
    clicked
      ? `Wrong — that was ${clicked}. +${points} points. The answer was ${target}. −1 life.`
      : `Wrong. +${points} points. The answer was ${target}. −1 life.`,
}
```

New code (whole file — `correct` unchanged):

```ts
export const MESSAGES = {
  correct: (points: number, name: string) => `Correct! +${points} points. That was ${name}.`,
  // Distance-led: distanceKm is the number the proximity formula decays on, so
  // it leads. The HUD prompt above the reveal line already names the target —
  // no redundant "The answer was X" sentence (2026-07 UX audit item A6).
  wrong: (points: number, target: string, clicked: string | null, distanceKm: number | null) => {
    const tail = `+${points} proximity pts · −1 life.`
    if (!clicked) return `Wrong. ${tail}`
    if (distanceKm === null) return `That was ${clicked}. ${tail}`
    return `That was ${clicked} — ${Math.round(distanceKm).toLocaleString()} km from ${target}. ${tail}`
  },
}
```

Run `npx vitest run src/game/modes/country-pinning/__tests__/messages.test.ts` — expected: 5 tests pass.

- [ ] **Step 4: Write the failing HUD-threading test.** Create `src/game/modes/country-pinning/__tests__/CountryPinningHud.test.tsx` with exactly (mirrors `src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx`; factories come from `src/game/shared/__tests__/factories.ts`):

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import CountryPinningHud from '../CountryPinningHud'
import {
  makeSession,
  makeCountryRound,
  makeCountryReveal,
} from '../../../shared/__tests__/factories'

afterEach(() => cleanup())

describe('CountryPinningHud — wrong-guess reveal line (A6)', () => {
  it('threads reveal.distanceKm into the distance-led copy on the role=status line', () => {
    const reveal = makeCountryReveal({
      correct: false,
      clickedName: 'Germany',
      distanceKm: 7050,
    })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: { pointsEarned: 9, livesDelta: -1, endsGame: false, reveal },
      currentRound: makeCountryRound({ targetName: 'Bangladesh' }),
    })
    render(<CountryPinningHud session={session} />)
    const line = screen.getByTestId('game-reveal')
    // role="status" makes this same line the screen-reader announcement — no
    // separate announce path needed for the reveal copy.
    expect(line.getAttribute('role')).toBe('status')
    expect(line.textContent).toContain(
      `That was Germany — ${(7050).toLocaleString()} km from Bangladesh`,
    )
    expect(line.textContent).not.toContain('The answer was')
  })
})
```

- [ ] **Step 5: See it fail.** Run:

```
npx vitest run src/game/modes/country-pinning/__tests__/CountryPinningHud.test.tsx
```

Expected failure: the rendered line reads `"That was Germany — NaN km from Bangladesh. …"` — the HUD still calls the 3-arg form, so `distanceKm` arrives as `undefined` (vitest transpiles without typechecking, so the arity mismatch surfaces at runtime, not compile time).

- [ ] **Step 6: Thread `distanceKm` in the HUD.** In `src/game/modes/country-pinning/CountryPinningHud.tsx`, line 19. Current code:

```tsx
    return MESSAGES.wrong(reveal.pointsEarned, targetName, r.clickedName)
```

New code:

```tsx
    return MESSAGES.wrong(reveal.pointsEarned, targetName, r.clickedName, r.distanceKm)
```

(`r` is the `CountryReveal` narrowed on line 16; `distanceKm` is already on the type — no type changes needed.)

- [ ] **Step 7: All green + typecheck.** Run:

```
npx vitest run src/game/modes/country-pinning
npm run typecheck
```

Expected: both new test files plus the existing `roundGenerator.test.ts` / `scoring.test.ts` pass; `tsc -b` clean (the required 4th parameter proves no other caller of `MESSAGES.wrong` exists — `CountryPinningHud.tsx` is the only one).

- [ ] **Step 8: Commit.**

```bash
git add src/game/modes/country-pinning/messages.ts src/game/modes/country-pinning/CountryPinningHud.tsx src/game/modes/country-pinning/__tests__/messages.test.ts src/game/modes/country-pinning/__tests__/CountryPinningHud.test.tsx
git commit -m "$(cat <<'EOF'
feat(game): lead wrong-guess copy with distance to target (A6)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: A10 — Hover tooltip clamps and flips at map container edges

**Files:**
- Create: `src/lib/tooltipPosition.ts`
- Create: `src/lib/__tests__/tooltipPosition.test.ts`
- Modify: `src/hooks/useMapInteractions.ts:4-5` (imports), `src/hooks/useMapInteractions.ts:119-136` (rAF positioning callback)
- Modify: `src/hooks/__tests__/useMapInteractions.test.ts` (append one wiring describe block after line 274)
- Test: `src/lib/__tests__/tooltipPosition.test.ts`, `src/hooks/__tests__/useMapInteractions.test.ts`

**Interfaces:**
- Produces: `clampTooltipPosition(input: TooltipPositionInput): { left: number; top: number }` and `TOOLTIP_CURSOR_OFFSET = 15`, where `TooltipPositionInput = { x: number; y: number; tooltipWidth: number; tooltipHeight: number; containerWidth: number; containerHeight: number }` (x/y are the cursor point in map-container coordinates, i.e. `e.point`).
- Consumes: `maplibregl.Map.getContainer()` inside the existing rAF callback in `useMapInteractions.ts`.

Context: the `.country-tooltip` element (raw DOM, appended next to the map container in `useMapInstance.ts:107-110`, `position: absolute` per `src/index.css:176-198`) is positioned at cursor `+15/+15` with no bounds check (`useMapInteractions.ts:133-134`), so it clips at the right/bottom viewport edges and under the open panel. Fix: clamp-and-flip inside the existing rAF positioning callback using the tooltip's measured `offsetWidth`/`offsetHeight` against the map container's client box. The geometry goes in a pure function (unit-testable — jsdom can't measure layout) and the rAF callback consumes it. No CSS change: positioning is entirely JS-driven and `.country-tooltip` in `src/index.css` stays as-is. No e2e: hover-position pixel assertions are exactly the camera/viewport-dependent flake class CLAUDE.md bans; the pure function plus a synchronous wiring test give deterministic coverage.

- [ ] **Step 1: Write the failing pure-function test.** Create `src/lib/__tests__/tooltipPosition.test.ts` with exactly:

```ts
import { describe, expect, it } from 'vitest'
import { clampTooltipPosition, TOOLTIP_CURSOR_OFFSET } from '../tooltipPosition'

const box = { containerWidth: 800, containerHeight: 600 }
const size = { tooltipWidth: 160, tooltipHeight: 44 }

describe('clampTooltipPosition', () => {
  it('places the tooltip below-right of the cursor when there is room', () => {
    expect(clampTooltipPosition({ x: 100, y: 100, ...size, ...box })).toEqual({
      left: 100 + TOOLTIP_CURSOR_OFFSET,
      top: 100 + TOOLTIP_CURSOR_OFFSET,
    })
  })

  it('flips to the left of the cursor at the right edge', () => {
    const { left } = clampTooltipPosition({ x: 780, y: 100, ...size, ...box })
    expect(left).toBe(780 - TOOLTIP_CURSOR_OFFSET - size.tooltipWidth) // 605
    expect(left + size.tooltipWidth).toBeLessThanOrEqual(box.containerWidth)
  })

  it('flips above the cursor at the bottom edge', () => {
    const { top } = clampTooltipPosition({ x: 100, y: 590, ...size, ...box })
    expect(top).toBe(590 - TOOLTIP_CURSOR_OFFSET - size.tooltipHeight) // 531
    expect(top + size.tooltipHeight).toBeLessThanOrEqual(box.containerHeight)
  })

  it('clamps to the container origin when even the flipped position would overflow', () => {
    // Tooltip larger than the container: flip goes negative → clamp to 0.
    const out = clampTooltipPosition({ x: 4, y: 4, tooltipWidth: 900, tooltipHeight: 700, ...box })
    expect(out.left).toBe(0)
    expect(out.top).toBe(0)
  })

  it('never returns a position outside the container box', () => {
    for (const x of [0, 400, 800]) {
      for (const y of [0, 300, 600]) {
        const { left, top } = clampTooltipPosition({ x, y, ...size, ...box })
        expect(left).toBeGreaterThanOrEqual(0)
        expect(top).toBeGreaterThanOrEqual(0)
        expect(left + size.tooltipWidth).toBeLessThanOrEqual(box.containerWidth)
        expect(top + size.tooltipHeight).toBeLessThanOrEqual(box.containerHeight)
      }
    }
  })
})
```

- [ ] **Step 2: See it fail.** Run:

```
npx vitest run src/lib/__tests__/tooltipPosition.test.ts
```

Expected failure: `Failed to resolve import "../tooltipPosition"` (module does not exist yet).

- [ ] **Step 3: Implement the pure function.** Create `src/lib/tooltipPosition.ts` with exactly:

```ts
/** Cursor→tooltip gap, in px. Was the hardcoded `+15` in useMapInteractions. */
export const TOOLTIP_CURSOR_OFFSET = 15

export interface TooltipPositionInput {
  /** Cursor position in map-container coordinates (maplibre `e.point`). */
  x: number
  y: number
  tooltipWidth: number
  tooltipHeight: number
  containerWidth: number
  containerHeight: number
}

/**
 * Clamp-and-flip tooltip placement (2026-07 UX audit item A10). Preferred
 * position is below-right of the cursor; when that would overflow the map
 * container's right/bottom edge the tooltip flips to the opposite side of the
 * cursor, and the result is finally clamped into the container box so the
 * tooltip can never be clipped.
 */
export function clampTooltipPosition({
  x,
  y,
  tooltipWidth,
  tooltipHeight,
  containerWidth,
  containerHeight,
}: TooltipPositionInput): { left: number; top: number } {
  let left = x + TOOLTIP_CURSOR_OFFSET
  if (left + tooltipWidth > containerWidth) left = x - TOOLTIP_CURSOR_OFFSET - tooltipWidth
  left = Math.min(Math.max(left, 0), Math.max(containerWidth - tooltipWidth, 0))

  let top = y + TOOLTIP_CURSOR_OFFSET
  if (top + tooltipHeight > containerHeight) top = y - TOOLTIP_CURSOR_OFFSET - tooltipHeight
  top = Math.min(Math.max(top, 0), Math.max(containerHeight - tooltipHeight, 0))

  return { left, top }
}
```

Run `npx vitest run src/lib/__tests__/tooltipPosition.test.ts` — expected: 5 tests pass.

- [ ] **Step 4: Write the failing wiring test.** In `src/hooks/__tests__/useMapInteractions.test.ts`, append this describe block at the end of the file (after the closing `})` of the `'useMapInteractions click-origin marking'` block, line 274). All needed imports (`vi`, `renderHook`, `createFakeMapRef`, `h`, `baseOptions`) already exist in the file:

```ts
describe('useMapInteractions tooltip clamping (A10)', () => {
  it('flips the tooltip to the other side of the cursor at the container edges', () => {
    const fake = createFakeMapRef()
    // The fake map has no getContainer; give it a fixed 800×600 box.
    Object.assign(fake.map, {
      getContainer: () => ({ clientWidth: 800, clientHeight: 600 }) as unknown as HTMLElement,
    })
    const tooltip = document.createElement('div')
    // jsdom has no layout — pin the measured size the clamp math reads.
    Object.defineProperty(tooltip, 'offsetWidth', { value: 160 })
    Object.defineProperty(tooltip, 'offsetHeight', { value: 44 })
    tooltip.classList.add('visible')
    h.mapRef.current = fake.map
    h.tooltipRef.current = tooltip
    // Run the coalescing rAF synchronously so the position write is observable.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    try {
      renderHook(() => useMapInteractions({ ...baseOptions, loaded: true }))
      // Cursor near the bottom-right corner: +15/+15 would overflow → flip.
      fake.fire('mousemove', null, { point: { x: 780, y: 590 } })
      expect(tooltip.style.left).toBe('605px') // 780 − 15 − 160
      expect(tooltip.style.top).toBe('531px') // 590 − 15 − 44
    } finally {
      rafSpy.mockRestore()
    }
  })
})
```

Run and see it fail:

```
npx vitest run src/hooks/__tests__/useMapInteractions.test.ts
```

Expected failure: the new test gets `left: '795px'` / `top: '605px'` (the old unclamped `+15` writes); all pre-existing tests still pass.

- [ ] **Step 5: Wire the clamp into the rAF callback.** In `src/hooks/useMapInteractions.ts`, first add the import after line 5 (`import { markClickOrigin } from '../lib/selectionOrigin'`):

```ts
import { clampTooltipPosition } from '../lib/tooltipPosition'
```

Then replace the positioning callback. Current code (lines 119–136):

```ts
    // Coalesce tooltip position updates to one write per animation frame.
    // mousemove fires faster than the display refresh rate; writing
    // style.left/top twice per event triggered redundant layout work.
    let pendingFrame: number | null = null
    let pendingX = 0
    let pendingY = 0
    const mousemovePosition = (e: maplibregl.MapMouseEvent) => {
      pendingX = e.point.x
      pendingY = e.point.y
      if (pendingFrame !== null) return
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = null
        const tooltip = tooltipRef.current
        if (!tooltip || !tooltip.classList.contains('visible')) return
        tooltip.style.left = `${pendingX + 15}px`
        tooltip.style.top = `${pendingY + 15}px`
      })
    }
```

New code:

```ts
    // Coalesce tooltip position updates to one write per animation frame.
    // mousemove fires faster than the display refresh rate; writing
    // style.left/top twice per event triggered redundant layout work.
    let pendingFrame: number | null = null
    let pendingX = 0
    let pendingY = 0
    const mousemovePosition = (e: maplibregl.MapMouseEvent) => {
      pendingX = e.point.x
      pendingY = e.point.y
      if (pendingFrame !== null) return
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = null
        const tooltip = tooltipRef.current
        if (!tooltip || !tooltip.classList.contains('visible')) return
        // Clamp-and-flip against the map container box so the tooltip never
        // clips at the right/bottom edges or under the open panel (A10).
        const container = map.getContainer()
        const { left, top } = clampTooltipPosition({
          x: pendingX,
          y: pendingY,
          tooltipWidth: tooltip.offsetWidth,
          tooltipHeight: tooltip.offsetHeight,
          containerWidth: container.clientWidth,
          containerHeight: container.clientHeight,
        })
        tooltip.style.left = `${left}px`
        tooltip.style.top = `${top}px`
      })
    }
```

(`map` is already in scope — the enclosing effect reads it from `mapRef.current` at line 59. `getContainer()` is only reached after the `visible` check, so existing fake-map tests that never show the tooltip are unaffected.)

- [ ] **Step 6: All green + typecheck.** Run:

```
npx vitest run src/hooks/__tests__/useMapInteractions.test.ts src/lib/__tests__/tooltipPosition.test.ts
npm run typecheck
```

Expected: all pass, `tsc -b` clean.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/tooltipPosition.ts src/lib/__tests__/tooltipPosition.test.ts src/hooks/useMapInteractions.ts src/hooks/__tests__/useMapInteractions.test.ts
git commit -m "$(cat <<'EOF'
fix(map): clamp-and-flip hover tooltip at map container edges (A10)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: A16 — Launcher first-run copy (subtitle gate + no "Best 0 pts")

**Files:**
- Modify: `src/components/Launcher.tsx:1-8` (imports), `:26-27` (component body), `:156-161` (subtitle)
- Modify: `src/components/LauncherModeCard.tsx:53-56` (component body), `:82-94` (bests line)
- Create: `src/components/__tests__/Launcher.test.tsx`
- Modify: `src/components/__tests__/LauncherModeCard.test.tsx` (append one test)
- Test: `src/components/__tests__/Launcher.test.tsx`, `src/components/__tests__/LauncherModeCard.test.tsx`

**Interfaces:**
- Consumes: `usePersonalBests(modeId: ModeId): { best: PersonalBest }` (from `src/game/shared/usePersonalBests.ts`), `PersonalBest.gamesPlayed` / `.bestScore` (from `src/game/shared/types.ts:95-99`), `record` / `__resetForTests` from `src/game/shared/personalBestsStore.ts` (test setup — `record(modeId, 0, 0)` increments `gamesPlayed` and leaves `bestScore` at 0).

Context: the launcher subtitle "Pick a mode and beat your best" (`Launcher.tsx:160`) addresses a player with no bests. Per spec: until **either** mode has `gamesPlayed > 0`, show "Two quick geography games" — the Launcher must read both modes' bests (two static `usePersonalBests` calls; hooks can't loop). Separately, `LauncherModeCard.tsx:86-90` renders "Best 0 pts · 1 game" for a played-but-scoreless mode — whenever `bestScore === 0`, suppress the Best fragment and show the games count only. The rules-at-a-glance line is E6's, not this task's. e2e is unaffected: no spec asserts the subtitle text, and `e2e/launcher-card-loading-states.spec.ts` only asserts the fresh-state "No games yet" copy, which is unchanged.

- [ ] **Step 1: Write the failing Launcher subtitle test.** Create `src/components/__tests__/Launcher.test.tsx` with exactly (the `stubGetAnimations` util is the repo's shared jsdom patch for `Element.getAnimations`, which `Launcher.tsx:68` calls inside a rAF):

```tsx
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Launcher } from '../Launcher'
import { record, __resetForTests } from '../../game/shared/personalBestsStore'
import { stubGetAnimations } from './singleCountryPanelTestUtils'

// jsdom doesn't implement Element.getAnimations; the launcher's
// animation-state effect calls it inside a rAF.
let animationsStub: { restore: () => void }
beforeAll(() => {
  animationsStub = stubGetAnimations()
})
afterAll(() => animationsStub.restore())

afterEach(() => {
  cleanup()
  __resetForTests()
  localStorage.clear()
})

describe('Launcher subtitle first-run gate (A16)', () => {
  it('addresses first-time visitors while neither mode has been played', () => {
    render(<Launcher onDismiss={vi.fn()} />)
    expect(screen.getByTestId('launcher-subtitle').textContent).toBe('Two quick geography games')
  })

  it('switches to the beat-your-best subtitle once country-pinning has a game', () => {
    record('country-pinning', 300, 2)
    render(<Launcher onDismiss={vi.fn()} />)
    expect(screen.getByTestId('launcher-subtitle').textContent).toBe(
      'Pick a mode and beat your best',
    )
  })

  it('a played city-guessing game also flips the subtitle (either mode counts)', () => {
    record('city-guessing', 0, 0) // even a 0-score run counts as played
    render(<Launcher onDismiss={vi.fn()} />)
    expect(screen.getByTestId('launcher-subtitle').textContent).toBe(
      'Pick a mode and beat your best',
    )
  })
})
```

- [ ] **Step 2: See it fail.** Run:

```
npx vitest run src/components/__tests__/Launcher.test.tsx
```

Expected failure: the first test fails with received `'Pick a mode and beat your best'` (the subtitle is currently hardcoded); tests 2–3 pass vacuously.

- [ ] **Step 3: Implement the subtitle gate.** In `src/components/Launcher.tsx`, add the import after line 3 (`import { readLastMode, writeLastMode } from '../game/shared/lastMode'`):

```tsx
import { usePersonalBests } from '../game/shared/usePersonalBests'
```

In the component body, directly after line 27 (`const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')`), add:

```tsx
  // A16: "beat your best" presumes a best exists — gate on either mode having
  // a recorded game. Two static calls because hooks can't run in a loop.
  const { best: countryBest } = usePersonalBests('country-pinning')
  const { best: cityBest } = usePersonalBests('city-guessing')
  const hasPlayedAnyMode = countryBest.gamesPlayed > 0 || cityBest.gamesPlayed > 0
```

Then replace the subtitle. Current code (lines 156–161):

```tsx
          <p
            className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2"
            data-testid="launcher-subtitle"
          >
            Pick a mode and beat your best
          </p>
```

New code:

```tsx
          <p
            className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2"
            data-testid="launcher-subtitle"
          >
            {hasPlayedAnyMode ? 'Pick a mode and beat your best' : 'Two quick geography games'}
          </p>
```

Run `npx vitest run src/components/__tests__/Launcher.test.tsx` — expected: 3 tests pass.

- [ ] **Step 4: Write the failing zero-score card test.** In `src/components/__tests__/LauncherModeCard.test.tsx`, append inside the `describe('LauncherModeCard (free-play)', ...)` block, after the `'shows the best score for city-guessing without a streak line'` test (after line 42):

```tsx
  it('shows only the games count when games were played but the best score is 0', () => {
    record('city-guessing', 0, 0)
    render(<LauncherModeCard modeId="city-guessing" onPlay={vi.fn()} />)
    const best = screen.getByTestId('launcher-card-city-guessing-best').textContent ?? ''
    expect(best).not.toMatch(/best/i) // no "Best 0 pts" noise
    expect(best).toMatch(/1 game played/)
  })
```

Run and see it fail:

```
npx vitest run src/components/__tests__/LauncherModeCard.test.tsx
```

Expected failure: received text is `'Best 0 pts · 1 game'`, so the `not.toMatch(/best/i)` assertion fails; the 4 pre-existing tests still pass.

- [ ] **Step 5: Implement the bests line.** In `src/components/LauncherModeCard.tsx`, extend the component body. Current code (lines 53–56):

```tsx
export function LauncherModeCard({ modeId, onPlay }: Props) {
  const testIdBase = `launcher-card-${modeId}`
  const { best } = usePersonalBests(modeId)
  const hasPlayed = best.gamesPlayed > 0
```

New code:

```tsx
export function LauncherModeCard({ modeId, onPlay }: Props) {
  const testIdBase = `launcher-card-${modeId}`
  const { best } = usePersonalBests(modeId)
  const hasPlayed = best.gamesPlayed > 0
  const gamesCount = `${best.gamesPlayed} ${best.gamesPlayed === 1 ? 'game' : 'games'}`
  // "Best 0 pts" carries no information — when no scoring run exists yet, show
  // only how many games were played (A16).
  const bestsLine = !hasPlayed
    ? 'No games yet — play your first'
    : best.bestScore === 0
      ? `${gamesCount} played`
      : `Best ${formatPersonalBest(best, modeId)} · ${gamesCount}`
```

Then replace the render block. Current code (lines 82–94):

```tsx
      <div
        className="text-xs text-sand-600 dark:text-dark-100 mt-2 text-center tabular-nums"
        data-testid={`${testIdBase}-best`}
      >
        {hasPlayed ? (
          <>
            Best {formatPersonalBest(best, modeId)} · {best.gamesPlayed}{' '}
            {best.gamesPlayed === 1 ? 'game' : 'games'}
          </>
        ) : (
          'No games yet — play your first'
        )}
      </div>
```

New code:

```tsx
      <div
        className="text-xs text-sand-600 dark:text-dark-100 mt-2 text-center tabular-nums"
        data-testid={`${testIdBase}-best`}
      >
        {bestsLine}
      </div>
```

- [ ] **Step 6: All green + typecheck.** Run:

```
npx vitest run src/components/__tests__/Launcher.test.tsx src/components/__tests__/LauncherModeCard.test.tsx
npm run typecheck
```

Expected: all 8 tests pass (3 + 5), `tsc -b` clean. The pre-existing card tests keep passing because the played-with-score path renders the identical string (`Best 1,240 pts · 31 streak · 1 game`) and the fresh path is unchanged.

- [ ] **Step 7: e2e regression guard.** The launcher e2e specs assert only testid visibility and the fresh-state "No games yet" copy (both unchanged), but run them since this task touched their surfaces. Kill any stray dev server first (`reuseExistingServer` would reuse one built without `VITE_TEST_HOOKS` — project memory), then run:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
npx playwright test e2e/launcher.spec.ts e2e/launcher-card-loading-states.spec.ts --project=chromium --workers=2
```

Expected: all pass.

- [ ] **Step 8: Commit.**

```bash
git add src/components/Launcher.tsx src/components/LauncherModeCard.tsx src/components/__tests__/Launcher.test.tsx src/components/__tests__/LauncherModeCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(launcher): first-run subtitle and zero-score bests line (A16)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

### Task 5: Panel prime-grid dedupe + boolean cells → exception badges (A4+A5, one commit)

Merges spec items A4 and A5 (`docs/superpowers/specs/2026-07-26-ux-visual-program-design.md`) — they rewrite the same `SingleCountryPanel` blocks, so they ship as ONE commit, together with the two e2e re-anchors the spec's "A-batch commit structure" names for this commit.

What changes, in plain terms:
- Delete the **Capital** and **Region** DataCells (they duplicate the header caption and region badge). The header caption takes over multi-capital display (`country.capital.join(', ')` — today it shows only `capital[0]`).
- Delete the **UN Member** and **Independent** DataCells. In their place, small amber *exception* badges render next to the region badge, only when a flag is `false`: `unMember === false` → "UN observer state"; `independent === false` → "Not independent". The flags diverge in real data (Vatican/VAT: `unMember: false, independent: true` → one badge; Palestine/PSE: both `false` → both badges; France → none).
- Promote **Government** and **Languages** into the always-visible prime grid, so the grid holds four non-redundant facts: Population, Area, Government, Languages.
- Interim attribution (until D2's consolidated footer): the caption gains a `SourceTooltip` for `capital` (the region badge shares the same source in `_fieldSources`), so deleting the cells loses no source attribution.

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx:1-7` (imports), `:55-62` (badge consts), `:189-194` (caption), `:266-275` (badge row), `:280-351` (grids), `:356` (stagger class)
- Modify: `src/components/FieldLabel.tsx:19` (add `data-field` anchor for e2e)
- Modify: `src/index.css:125` (delete the now-unused `.panel-field-in-4` rule)
- Test (modify): `src/components/__tests__/SingleCountryPanel.test.tsx` (append a describe block)
- Test (modify, SAME COMMIT): `e2e/panel-and-deeplink.spec.ts:75-83`, `e2e/source-tooltip-edge.spec.ts:15-17,27-33,73-75`

**Interfaces:** Consumes `CountryData` from `src/lib/types.ts` (`capital: string[]`, `unMember: boolean`, `independent: boolean`, `_fieldSources: Record<string, string>` — field name → key into `CountriesFile['_sources']`) and the default export of `src/components/SourceTooltip.tsx` (`{ field: string; fieldSources: Record<string, string>; sources: CountriesFile['_sources'] }`).

- [ ] **Step 1: Write the failing unit tests.** Append this describe block at the end of `src/components/__tests__/SingleCountryPanel.test.tsx` (after the closing `})` of the `'SingleCountryPanel — heading, subtitle, and region-badge layout (2026-07-10 review)'` describe). All imports it uses (`render`, `makeCountry`, `sources`, `CountryData`) are already imported at the top of the file; `SingleCountryPanel` is the module-level variable loaded by the first describe's `beforeAll` (the existing layout describe relies on the same file-order guarantee):

```tsx
describe('SingleCountryPanel — prime grid dedupe + exception badges (A4+A5)', () => {
  function renderWith(country: CountryData) {
    return render(
      <SingleCountryPanel
        country={country}
        comparePickingMode={false}
        sources={sources}
        isDesktop={true}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        byCca3={new Map()}
      />,
    )
  }

  it('prime grid shows Population, Area, Government, Languages; Capital/Region/UN Member/Independent cells are gone', () => {
    const { getByText, queryByText } = renderWith(makeCountry())
    expect(getByText('Population')).toBeTruthy()
    expect(getByText('Area')).toBeTruthy()
    expect(getByText('Government')).toBeTruthy()
    expect(getByText('Languages')).toBeTruthy()
    expect(queryByText('Capital')).toBeNull()
    expect(queryByText('Region')).toBeNull()
    expect(queryByText('UN Member')).toBeNull()
    expect(queryByText('Independent')).toBeNull()
  })

  it('header caption joins all capitals and carries the interim capital SourceTooltip', () => {
    const { getByTestId, getByRole } = renderWith(
      makeCountry({
        cca3: 'ZAF',
        cca2: 'ZA',
        ccn3: '710',
        name: { common: 'South Africa', official: 'Republic of South Africa' },
        capital: ['Pretoria', 'Bloemfontein', 'Cape Town'],
        region: 'Africa',
        subregion: 'Southern Africa',
        _fieldSources: { capital: 'restcountries' },
      }),
    )
    expect(getByTestId('capital-caption').textContent).toContain(
      'Pretoria, Bloemfontein, Cape Town',
    )
    // Interim attribution: the caption keeps a Source affordance for capital
    // (region shares the same source) until D2's consolidated footer.
    expect(getByRole('button', { name: 'Source: REST Countries' })).toBeTruthy()
  })

  it('Vatican (unMember false, independent true) renders only the UN observer badge', () => {
    const { getByText, queryByText } = renderWith(
      makeCountry({
        cca3: 'VAT',
        cca2: 'VA',
        ccn3: '336',
        name: { common: 'Vatican City', official: 'Vatican City State' },
        capital: ['Vatican City'],
        region: 'Europe',
        subregion: 'Southern Europe',
        population: 764,
        area: 0.44,
        governmentType: 'ecclesiastical elective monarchy',
        unMember: false,
        independent: true,
      }),
    )
    expect(getByText('UN observer state')).toBeTruthy()
    expect(queryByText('Not independent')).toBeNull()
  })

  it('Palestine (unMember false, independent false) renders both exception badges', () => {
    const { getByText } = renderWith(
      makeCountry({
        cca3: 'PSE',
        cca2: 'PS',
        ccn3: '275',
        name: { common: 'Palestine', official: 'State of Palestine' },
        capital: ['Ramallah'],
        region: 'Asia',
        subregion: 'Western Asia',
        population: 4_803_269,
        area: 6_220,
        unMember: false,
        independent: false,
      }),
    )
    expect(getByText('UN observer state')).toBeTruthy()
    expect(getByText('Not independent')).toBeTruthy()
  })

  it('a UN member (France) renders no exception badges', () => {
    const { queryByText } = renderWith(makeCountry())
    expect(queryByText('UN observer state')).toBeNull()
    expect(queryByText('Not independent')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests and see them fail.** Run `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx`. Expected failures: `queryByText('Capital')` is non-null (the Capital DataCell still exists), `getByTestId('capital-caption')` throws "Unable to find an element by: [data-testid=\"capital-caption\"]", and both badge tests throw "Unable to find an element with the text: UN observer state". The five pre-existing lifecycle/layout tests must stay green.

- [ ] **Step 3: Implement the panel restructure in `src/components/SingleCountryPanel.tsx`.** Five edits:

(3a) Add the SourceTooltip import. Replace:
```tsx
import { TimezoneList } from './TimezoneList'
```
with:
```tsx
import { TimezoneList } from './TimezoneList'
import SourceTooltip from './SourceTooltip'
```

(3b) Add the exception-badge class constant directly after the `REGION_BADGE` record (which ends with `Antarctic: 'bg-slate-100/80 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',` and a closing `}`). Insert after that closing `}`:
```tsx
// A5: near-constant booleans render as exceptions only. Muted amber is a data
// encoding (like the region badge), not a chrome accent — kept through E4.
const EXCEPTION_BADGE =
  'inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
```

(3c) Multi-capital caption with interim attribution. Replace:
```tsx
              {country.capital.length > 0 && (
                <p className="text-xs text-teal dark:text-teal-light truncate mt-0.5">
                  {country.capital[0]}
                </p>
              )}
```
with:
```tsx
              {country.capital.length > 0 && (
                <p
                  data-testid="capital-caption"
                  className="text-xs text-teal dark:text-teal-light mt-0.5 flex items-center min-w-0"
                >
                  <span className="truncate">{country.capital.join(', ')}</span>
                  {/* Interim attribution (A4): the caption absorbed the deleted
                      Capital DataCell; the region badge shares this source.
                      Superseded by D2's consolidated footer. */}
                  <SourceTooltip
                    field="capital"
                    fieldSources={country._fieldSources}
                    sources={sources}
                  />
                </p>
              )}
```

(3d) Wrap the region badge in a flex row and add the exception badges. Replace:
```tsx
        <span
          data-testid="region-badge"
          className={`inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full mt-2 ${
            REGION_BADGE[country.region] ||
            'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
          }`}
        >
          {country.region}
          {country.subregion && ` / ${country.subregion}`}
        </span>
```
with:
```tsx
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span
            data-testid="region-badge"
            className={`inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full ${
              REGION_BADGE[country.region] ||
              'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
            }`}
          >
            {country.region}
            {country.subregion && ` / ${country.subregion}`}
          </span>
          {country.unMember === false && (
            <span data-testid="exception-badge-un-member" className={EXCEPTION_BADGE}>
              UN observer state
            </span>
          )}
          {country.independent === false && (
            <span data-testid="exception-badge-independent" className={EXCEPTION_BADGE}>
              Not independent
            </span>
          )}
        </div>
```
(The existing unit test "region badge is a full-width row, not nested inside the name column" only checks `badge.parentElement !== heading.parentElement` and `whitespace-nowrap` — both still hold.)

(3e) Rebuild the field grids. Replace the entire block from the prime grid through the Currencies/Timezones group — i.e. everything from:
```tsx
        <div className="grid grid-cols-2 gap-x-4 panel-field-in-1">
          <DataCell label="Capital" field="capital" country={country} sources={sources}>
            {country.capital.length > 0 ? country.capital.join(', ') : '—'}
          </DataCell>
          <DataCell label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Region" field="region" country={country} sources={sources}>
            {country.region}
          </DataCell>
        </div>

        {showSecondary && (
          <>
            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div className="panel-field-in-2">
              {country.governmentType && (
                <DataCell
                  label="Government"
                  field="governmentType"
                  country={country}
                  sources={sources}
                >
                  {country.governmentType}
                </DataCell>
              )}
              <div className="grid grid-cols-2 gap-x-4">
                <DataCell label="UN Member" field="unMember" country={country} sources={sources}>
                  {country.unMember ? 'Yes' : 'No'}
                </DataCell>
                <DataCell
                  label="Independent"
                  field="independent"
                  country={country}
                  sources={sources}
                >
                  {country.independent ? 'Yes' : 'No'}
                </DataCell>
              </div>
            </div>

            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div className="panel-field-in-3">
              <div className="grid grid-cols-2 gap-x-4">
                {Object.keys(country.languages).length > 0 && (
                  <DataCell label="Languages" field="languages" country={country} sources={sources}>
                    {Object.values(country.languages).join(', ')}
                  </DataCell>
                )}
                {Object.keys(country.currencies).length > 0 && (
                  <DataCell
                    label="Currencies"
                    field="currencies"
                    country={country}
                    sources={sources}
                  >
                    {Object.values(country.currencies)
                      .map((c) => `${c.name} (${c.symbol})`)
                      .join(', ')}
                  </DataCell>
                )}
              </div>
              <DataCell label="Timezones" field="timezones" country={country} sources={sources}>
                <TimezoneList timezones={country.timezones} />
              </DataCell>
            </div>
```
with:
```tsx
        <div className="grid grid-cols-2 gap-x-4 panel-field-in-1">
          <DataCell label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Government" field="governmentType" country={country} sources={sources}>
            {country.governmentType || '—'}
          </DataCell>
          <DataCell label="Languages" field="languages" country={country} sources={sources}>
            {Object.keys(country.languages).length > 0
              ? Object.values(country.languages).join(', ')
              : '—'}
          </DataCell>
        </div>

        {showSecondary && (
          <>
            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div className="panel-field-in-2">
              {Object.keys(country.currencies).length > 0 && (
                <DataCell label="Currencies" field="currencies" country={country} sources={sources}>
                  {Object.values(country.currencies)
                    .map((c) => `${c.name} (${c.symbol})`)
                    .join(', ')}
                </DataCell>
              )}
              <DataCell label="Timezones" field="timezones" country={country} sources={sources}>
                <TimezoneList timezones={country.timezones} />
              </DataCell>
            </div>
```
Then in the Borders block a few lines below, replace `<div className="panel-field-in-4">` with `<div className="panel-field-in-3">` (keeps the entrance stagger contiguous at 50/100/150 ms now that one group is gone).

- [ ] **Step 4: Remove the now-dead stagger class and add the e2e anchor.** In `src/index.css`, delete the line (nothing else uses `-4` — verified by grep across `src/`):
```css
.panel-field-in-4 { animation: panel-field-in 200ms ease-out 200ms both; }
```
In `src/components/FieldLabel.tsx`, replace:
```tsx
    <div className={className ?? DEFAULT_CLASSNAME}>
```
with:
```tsx
    <div className={className ?? DEFAULT_CLASSNAME} data-field={field}>
```
(`data-field` gives e2e a stable per-field anchor — needed because the caption's capital tooltip is now the first `Source:` button in DOM order.)

- [ ] **Step 5: Run the unit tests green.** Run `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx` — all tests pass, including the pre-existing lifecycle, layout, and focus tests.

- [ ] **Step 6: Re-anchor `e2e/panel-and-deeplink.spec.ts` (SAME COMMIT — this spec IS CI-covered).** The mobile peek-state sentinel "UN Member" no longer exists; Currencies is the surviving collapsed-hidden field (the collapsed sheet now shows the prime grid — Population, Area, Government, Languages — so the sentinel must be a `showSecondary`-gated field; Japan has currencies). Replace:
```ts
  test('expand button shows secondary fields on mobile', async ({ page }) => {
    const panel = await openPanel(page, 'JPN', 'Japan')
    // Peek state: secondary fields (UN Member, Languages, Government…)
    // only render once showSecondary is true.
    await expect(panel.getByText('UN Member')).toBeHidden()
    await page.getByLabel('Expand panel').click()
    await expect(panel.getByText('UN Member')).toBeVisible({ timeout: 10_000 })
  })
```
with:
```ts
  test('expand button shows secondary fields on mobile', async ({ page }) => {
    const panel = await openPanel(page, 'JPN', 'Japan')
    // Peek state: secondary fields (Currencies, Timezones) only render once
    // showSecondary is true. Currencies is the sentinel — the prime grid
    // (Population, Area, Government, Languages) is always visible after A4+A5.
    await expect(panel.getByText('Currencies')).toBeHidden()
    await page.getByLabel('Expand panel').click()
    await expect(panel.getByText('Currencies')).toBeVisible({ timeout: 10_000 })
  })
```

- [ ] **Step 7: Re-anchor `e2e/source-tooltip-edge.spec.ts` (SAME COMMIT).** Three edits. First, the file docstring — replace:
```ts
 * This test targets the "Capital" field source button on France (/#FRA), which
 * lives in the left column of the two-column grid and historically triggered
 * the clip.
```
with:
```ts
 * This test targets the "Population" field source button on France (/#FRA) —
 * the first DataCell (left column) after the A4/A5 panel restructure — which
 * triggers the same left-edge geometry as the original "Capital" cell.
```
Second, in the first test, replace:
```ts
    // First Source button in DOM order = the Capital cell (first DataCell). The edge test only needs an 'i' button near the panel's left edge; update if cell order changes.
    const capitalSourceBtn = page.getByRole('button', { name: /^Source:/i }).first()
    await expect(capitalSourceBtn).toBeVisible({ timeout: 10_000 })

    // Hover to trigger the tooltip (Floating UI useHover handles this on
    // pointer-capable devices; desktop Chromium always has hover: hover).
    await capitalSourceBtn.hover()
```
with:
```ts
    // Population is the first DataCell (left column) after A4/A5. Anchor via
    // FieldLabel's data-field so the header caption's capital tooltip (now the
    // first Source button in DOM order) can't shift this test's target.
    const populationSourceBtn = panel
      .locator('[data-field="population"]')
      .getByRole('button', { name: /^Source:/i })
    await expect(populationSourceBtn).toBeVisible({ timeout: 10_000 })

    // Hover to trigger the tooltip (Floating UI useHover handles this on
    // pointer-capable devices; desktop Chromium always has hover: hover).
    await populationSourceBtn.hover()
```
Third, in the second test (`tooltip closes when focus moves away`), replace:
```ts
    // Focus the source button to open the tooltip
    const capitalSourceBtn = page.getByRole('button', { name: /^Source:/i }).first()
    await capitalSourceBtn.focus()
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 5_000 })
```
with:
```ts
    // Focus the first Source button (after A4/A5 this is the header caption's
    // capital tooltip) — any Source button exercises the useDismiss path.
    const firstSourceBtn = page.getByRole('button', { name: /^Source:/i }).first()
    await firstSourceBtn.focus()
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 5_000 })
```

- [ ] **Step 8: Run the affected e2e specs.** First kill any stray dev server — `reuseExistingServer: !CI` would silently reuse a `npm run dev` server that lacks `VITE_TEST_HOOKS` (project memory). PowerShell:
```powershell
try { Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force } } catch {}
```
Then:
```powershell
npx playwright test e2e/panel-and-deeplink.spec.ts e2e/source-tooltip-edge.spec.ts --project=chromium --workers=2
```
Expected: all tests pass (panel-and-deeplink's other assertions — "Paris", "Europe", "semi-presidential republic" — are satisfied by the caption, region badge, and the promoted Government cell respectively).

- [ ] **Step 9: Full check, then commit everything as ONE commit.** Run `npm run check` (lint + `tsc -b` + full vitest) and confirm green. Then (Bash tool):
```bash
git add src/components/SingleCountryPanel.tsx src/components/FieldLabel.tsx src/index.css src/components/__tests__/SingleCountryPanel.test.tsx e2e/panel-and-deeplink.spec.ts e2e/source-tooltip-edge.spec.ts
git commit -m "$(cat <<'EOF'
feat(panel): dedupe prime grid, replace boolean cells with exception badges (A4+A5)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Compare-picking banner gets a visible Cancel (A7)

Spec item A7 (`docs/superpowers/specs/2026-07-26-ux-visual-program-design.md`): the "Pick a country to compare with..." banner in `SingleCountryPanel` is passive — Escape is the only exit from picking mode, which doesn't exist on touch. Add an inline Cancel (×) button to the banner that calls a new `onCancelCompare` callback threaded App → CountryPanel → SingleCountryPanel (App binds its existing `exitCompare`, which does `setComparePickingMode(false)` + `clearCompare()` — `src/App.tsx:120-123`), and give the banner `role="status"`.

Depends on Task 5 having landed (quotes the post-Task-5 state of `SingleCountryPanel.test.tsx`; the component edits themselves touch blocks Task 5 leaves untouched).

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx` (Props interface ~:9-19, destructuring ~:64-74, picking banner ~:157-161)
- Modify: `src/components/CountryPanel.tsx:5-45`
- Modify: `src/App.tsx:369-404` (both `CountryPanel` call sites)
- Test (modify): `src/components/__tests__/SingleCountryPanel.test.tsx`, `src/components/__tests__/SingleCountryPanel.focus.test.tsx`
- Test (modify): `e2e/compare-view-dimming.spec.ts` (append one describe)

**Interfaces:** Produces prop `onCancelCompare: () => void` on `SingleCountryPanel` and `CountryPanel`. Consumes App's existing `exitCompare` callback and the existing testids `country-panel`, plus the compare-entry button's `aria-label="Compare with another country"` (`SingleCountryPanel.tsx:202`).

- [ ] **Step 1: Write the failing unit tests.** In `src/components/__tests__/SingleCountryPanel.test.tsx`, make three preparatory edits so the new test typechecks, then append the describe. (1) Replace the import line:
```tsx
import { act, render } from '@testing-library/react'
```
with:
```tsx
import { act, fireEvent, render } from '@testing-library/react'
```
(2) In the module-level `ComponentType` declaration, replace:
```tsx
  onEnterCompare: () => void
  byCca3: Map<string, CountryData>
```
with:
```tsx
  onEnterCompare: () => void
  onCancelCompare: () => void
  byCca3: Map<string, CountryData>
```
(3) In `renderPanel()`, and in the `renderWith()` helper inside the Task-5 describe, add the prop — in both, replace:
```tsx
      onEnterCompare={() => {}}
      byCca3={new Map()}
```
with:
```tsx
      onEnterCompare={() => {}}
      onCancelCompare={() => {}}
      byCca3={new Map()}
```
(`replace_all` is safe here — both occurrences want the same change.) Then append at the end of the file:

```tsx
describe('SingleCountryPanel — compare-picking banner (A7)', () => {
  it('banner has role="status" and its inline Cancel calls onCancelCompare', () => {
    const onCancelCompare = vi.fn()
    const { getByRole, getByTestId } = render(
      <SingleCountryPanel
        country={makeCountry()}
        comparePickingMode={true}
        sources={sources}
        isDesktop={true}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={onCancelCompare}
        byCca3={new Map()}
      />,
    )
    const banner = getByRole('status')
    expect(banner.textContent).toContain('Pick a country to compare with')
    fireEvent.click(getByTestId('compare-picking-cancel'))
    expect(onCancelCompare).toHaveBeenCalledTimes(1)
  })

  it('renders no banner or Cancel button outside picking mode', () => {
    const { queryByRole, queryByTestId } = renderPanel()
    expect(queryByRole('status')).toBeNull()
    expect(queryByTestId('compare-picking-cancel')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests and see the new ones fail.** Run `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx`. Expected failure: `getByRole('status')` throws "Unable to find an accessible element with the role \"status\"" (the banner div has no role yet); the second new test passes trivially; all pre-existing tests stay green.

- [ ] **Step 3: Implement the banner Cancel in `src/components/SingleCountryPanel.tsx`.** Three edits. (1) Props interface — replace:
```tsx
  onEnterCompare: () => void
  byCca3: Map<string, CountryData>
```
with:
```tsx
  onEnterCompare: () => void
  onCancelCompare: () => void
  byCca3: Map<string, CountryData>
```
(2) Destructuring — replace:
```tsx
  onEnterCompare,
  byCca3,
  inGameRound = false,
}: Props) {
```
with:
```tsx
  onEnterCompare,
  onCancelCompare,
  byCca3,
  inGameRound = false,
}: Props) {
```
(3) The banner — replace:
```tsx
        {comparePickingMode && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-teal/10 dark:bg-teal-light/10 border border-teal/20 dark:border-teal-light/20 text-xs text-teal dark:text-teal-light">
            Pick a country to compare with...
          </div>
        )}
```
with:
```tsx
        {comparePickingMode && (
          <div
            role="status"
            className="mb-3 px-3 py-2 rounded-lg bg-teal/10 dark:bg-teal-light/10 border border-teal/20 dark:border-teal-light/20 text-xs text-teal dark:text-teal-light flex items-center justify-between gap-2"
          >
            <span>Pick a country to compare with...</span>
            {/* A7: the only touch-reachable exit from picking mode (Escape is
                keyboard-only). Calls the same exit path as Escape. */}
            <button
              type="button"
              onClick={onCancelCompare}
              data-testid="compare-picking-cancel"
              aria-label="Cancel compare"
              className="shrink-0 p-1 -m-1 rounded-md hover:bg-teal/20 dark:hover:bg-teal-light/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
```

- [ ] **Step 4: Thread the prop through `src/components/CountryPanel.tsx`.** Three edits. (1) Interface — replace:
```tsx
  onEnterCompare: () => void
  onExitCompare: () => void
```
with:
```tsx
  onEnterCompare: () => void
  onCancelCompare: () => void
  onExitCompare: () => void
```
(2) Destructuring — replace:
```tsx
  onEnterCompare,
  onExitCompare,
```
with:
```tsx
  onEnterCompare,
  onCancelCompare,
  onExitCompare,
```
(3) The `SingleCountryPanel` JSX — replace:
```tsx
      onEnterCompare={onEnterCompare}
      byCca3={byCca3}
```
with:
```tsx
      onEnterCompare={onEnterCompare}
      onCancelCompare={onCancelCompare}
      byCca3={byCca3}
```
(`CompareCountryPanel` doesn't need it — the banner only renders in the single panel.)

- [ ] **Step 5: Bind the callback in `src/App.tsx` at both call sites.** Main call site — replace:
```tsx
          onClose={deselect}
          onEnterCompare={enterComparePicking}
          onExitCompare={exitCompare}
```
with:
```tsx
          onClose={deselect}
          onEnterCompare={enterComparePicking}
          onCancelCompare={exitCompare}
          onExitCompare={exitCompare}
```
Round-end call site — replace:
```tsx
          onEnterCompare={() => {
            /* no-op — hidden by inGameRound */
          }}
          onExitCompare={() => {
            /* no-op — hidden by inGameRound */
          }}
```
with:
```tsx
          onEnterCompare={() => {
            /* no-op — hidden by inGameRound */
          }}
          onCancelCompare={() => {
            /* no-op — picking mode is never active during a round */
          }}
          onExitCompare={() => {
            /* no-op — hidden by inGameRound */
          }}
```

- [ ] **Step 6: Update the focus test's props so typecheck stays green.** In `src/components/__tests__/SingleCountryPanel.focus.test.tsx`: (1) in its `ComponentType` declaration, replace:
```tsx
  onEnterCompare: () => void
  byCca3: Map<string, CountryData>
```
with:
```tsx
  onEnterCompare: () => void
  onCancelCompare: () => void
  byCca3: Map<string, CountryData>
```
(2) In `baseProps`, replace:
```tsx
    onEnterCompare: () => {},
    byCca3: new Map(),
```
with:
```tsx
    onEnterCompare: () => {},
    onCancelCompare: () => {},
    byCca3: new Map(),
```

- [ ] **Step 7: Run the unit tests green.** Run `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx` — all pass.

- [ ] **Step 8: Add the e2e test.** In `e2e/compare-view-dimming.spec.ts`, replace the import line:
```ts
import { waitForMapLoaded } from './helpers'
```
with:
```ts
import { waitForAnimationIdle, waitForMapLoaded } from './helpers'
```
and append this describe at the end of the file (conventions of this spec: real tiles via `waitForMapLoaded`, no stubbing; the chromium project's `reducedMotion: 'reduce'` plus `waitForAnimationIdle` make the panel click deterministic — no `waitForTimeout`, no `force: true`):
```ts
test.describe('compare picking mode cancel (A7)', () => {
  test('inline Cancel exits picking mode without closing the panel', async ({ page }) => {
    await page.goto('/#FRA')
    await waitForMapLoaded(page)

    const panel = page.getByTestId('country-panel')
    await expect(panel).toContainText('France', { timeout: 15_000 })
    await waitForAnimationIdle(panel)

    // Enter picking mode via the panel's compare entry button.
    await page.getByRole('button', { name: 'Compare with another country' }).click()
    const banner = page.getByRole('status').filter({ hasText: 'Pick a country to compare with' })
    await expect(banner).toBeVisible()

    // The touch-reachable exit: the banner's inline Cancel.
    await page.getByTestId('compare-picking-cancel').click()
    await expect(banner).not.toBeAttached()
    // Picking mode exited: the compare entry button re-renders (it is hidden
    // while picking) and the panel itself survived the cancel.
    await expect(page.getByRole('button', { name: 'Compare with another country' })).toBeVisible()
    await expect(panel).toContainText('France')
  })
})
```

- [ ] **Step 9: Run the e2e spec.** Kill any stray dev server first (`reuseExistingServer` would reuse a `npm run dev` server without `VITE_TEST_HOOKS` — project memory). PowerShell:
```powershell
try { Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force } } catch {}
```
Then:
```powershell
npx playwright test e2e/compare-view-dimming.spec.ts --project=chromium --workers=2
```
Expected: the three pre-existing dimming/colour tests and the new cancel test all pass.

- [ ] **Step 10: Full check, then commit.** Run `npm run check` (lint + `tsc -b` + full vitest) and confirm green. Then (Bash tool):
```bash
git add src/components/SingleCountryPanel.tsx src/components/CountryPanel.tsx src/App.tsx src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx e2e/compare-view-dimming.spec.ts
git commit -m "$(cat <<'EOF'
feat(compare): visible Cancel on the compare-picking banner (A7)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

### Task 7: A2 — 16px search input on small viewports (kills iOS focus auto-zoom)

**Files:**
- Modify: `src/components/SearchBar.tsx:139` (the input `className` line)
- Test: `src/components/__tests__/SearchBar.test.tsx`

**Interfaces:** Standalone. Note for the executor: Tasks 7 → 8 → 9 edit `src/components/SearchBar.tsx` and MUST land in that order (they touch the same input `className` line and surrounding JSX). Line numbers below are as of Task 7's start; always locate edits by the quoted code, not the line number.

**Context:** Mobile Safari force-zooms any focused input whose font-size is under 16px. The search input is `text-sm` (14px). Fix: `max-sm:text-base` (16px below the `sm` breakpoint) while `text-sm` keeps the compact 14px at `sm+`. Do NOT touch the viewport meta — `user-scalable=no` violates WCAG 1.4.4.

**Test-placement decision (explicit):** the class-literal pin lives HERE, in `SearchBar.test.tsx`, not in Task 16's touch-target convention test. Rationale: Task 16's convention test pins **44px hit areas** (WCAG 2.5.5/2.5.8 — a different criterion over a different element set: sheet buttons, search-clear, HUD text buttons). The 16px **font floor** is a single-element, search-specific constraint; colocating its pin with the component's own tests means a SearchBar restyle fails the SearchBar test file, which is where the restyler is already looking. jsdom cannot evaluate media queries, so pinning the class literal (the `layoutConstants.test.ts` drift-alarm style) is the only viable unit-level assertion.

- [ ] **Step 1: Write the failing class-pin test.** Append this describe block at the end of `src/components/__tests__/SearchBar.test.tsx` (after the closing `})` of `describe('SearchBar Enter behavior', ...)`). The file already imports `describe, expect, it` from vitest and has the `setup()` helper returning `{ onSelect, input }`:

```tsx
describe('search input font-size floor (A2)', () => {
  it('pins max-sm:text-base + text-sm on the input (iOS auto-zoom guard)', () => {
    const { input } = setup()
    // jsdom cannot evaluate media queries, so pin the class literals — the
    // layoutConstants.test.ts drift-alarm style. max-sm:text-base keeps the
    // focused input at >=16px below sm so mobile Safari does not force-zoom;
    // text-sm keeps the compact 14px at sm+. (Note: "max-sm:text-base" does
    // not substring-match "text-sm", so both assertions are independent.)
    expect(input.className).toContain('max-sm:text-base')
    expect(input.className).toContain('text-sm')
  })
})
```

- [ ] **Step 2: Run the test and see it fail.** Command: `npx vitest run src/components/__tests__/SearchBar.test.tsx`. Expected: the new test fails with `AssertionError: expected 'w-full pl-10 pr-9 py-3 rounded-xl bg-…' to contain 'max-sm:text-base'`; all 5 pre-existing tests stay green.

- [ ] **Step 3: Add the class.** In `src/components/SearchBar.tsx`, the input's `className` currently reads (one line, ~line 139):

```tsx
        className="w-full pl-10 pr-9 py-3 rounded-xl bg-sand-100/80 dark:bg-dark-400/80 backdrop-blur-md border border-sand-300/50 dark:border-dark-200/30 text-sand-900 dark:text-dark-50 text-sm placeholder-sand-400 dark:placeholder-dark-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus:border-teal/40 dark:focus:border-teal-light/30 transition-all duration-150"
```

Replace `text-sm` with `text-sm max-sm:text-base` so the line becomes:

```tsx
        className="w-full pl-10 pr-9 py-3 rounded-xl bg-sand-100/80 dark:bg-dark-400/80 backdrop-blur-md border border-sand-300/50 dark:border-dark-200/30 text-sand-900 dark:text-dark-50 text-sm max-sm:text-base placeholder-sand-400 dark:placeholder-dark-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus:border-teal/40 dark:focus:border-teal-light/30 transition-all duration-150"
```

- [ ] **Step 4: Run tests green.** Command: `npx vitest run src/components/__tests__/SearchBar.test.tsx`. Expected: 6 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/components/SearchBar.tsx src/components/__tests__/SearchBar.test.tsx
git commit -m "$(cat <<'EOF'
fix(search): 16px input font on small viewports to stop iOS focus auto-zoom

Mobile Safari force-zooms focused inputs under 16px; max-sm:text-base lifts the search input to 16px below the sm breakpoint while text-sm keeps 14px at sm+. Viewport meta untouched (user-scalable=no would violate WCAG 1.4.4). Class literal pinned in SearchBar.test.tsx, layoutConstants-drift-alarm style.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: A11 — permanent `/` shortcut chip in the search input

**Files:**
- Modify: `src/lib/layoutConstants.ts:6-7` (new exported media-query constant)
- Modify: `src/components/SearchBar.tsx` (imports ~1-3, state ~29-33, input `onFocus`/new `onBlur` ~136-138, new `<kbd>` chip after the clear-button block ~144-164)
- Test: `src/components/__tests__/SearchBar.test.tsx`

**Interfaces:**
- Consumes: `useMediaQuery(query: string): boolean` from `src/hooks/useMediaQuery.ts` (existing hook — it subscribes to `window.matchMedia` and re-renders on change); `stubMatchMedia(matches?: (query: string) => boolean): () => void` from `src/test/matchMediaStub.ts` (jsdom has no `matchMedia`; returns a restore fn).
- Produces: `export const FINE_POINTER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)'` in `src/lib/layoutConstants.ts` (spec item A14 will reuse it for capability-gated hint copy).

**Context:** The app already has a global `/` keyboard shortcut that focuses search (`src/App.tsx:253`, `if (e.key === '/')`), but nothing advertises it. Render a small `<kbd>`-styled `/` chip at the input's right edge. Visibility rule: `isFinePointer && !isFocused && query === ''`.

**Coexistence rule with the clear button (explicit contract):** the existing clear button (`data-testid="search-clear"`) renders iff `query` is non-empty and sits at `absolute right-2.5 top-1/2 -translate-y-1/2`. The chip sits at the **same** position but renders iff `query === ''`. The two render conditions are **disjoint on `query`**, so the elements can never coexist, hence never overlap — no layout shuffling needed. This rule is pinned by a test below. (Additionally, clicking clear refocuses the input, so the chip stays hidden until blur — also pinned.)

**Ordering constraint:** runs after Task 7 (same file); the input `className` line is NOT touched by this task.

- [ ] **Step 1: Add matchMedia stubbing to the whole test file + the failing chip tests.** `SearchBar` will now call `useMediaQuery`, whose `useState` initializer and `useEffect` call `window.matchMedia` — which **does not exist in jsdom**, so every existing SearchBar test would throw `TypeError: window.matchMedia is not a function` without a stub. Install the stub file-wide. In `src/components/__tests__/SearchBar.test.tsx`, replace the vitest import line:

```tsx
import { describe, expect, it, vi } from 'vitest'
```

with:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

and below the existing `import { makeCountryData } from '../../test/countryFixtures'` add:

```tsx
import { stubMatchMedia } from '../../test/matchMediaStub'
import { FINE_POINTER_MEDIA_QUERY } from '../../lib/layoutConstants'

// SearchBar calls useMediaQuery (A11 chip) and jsdom has no matchMedia —
// every render needs the stub. `finePointer` steers only the fine-pointer
// query; it is read lazily at matchMedia call time, so tests set it before
// calling setup().
let finePointer = false
let restoreMatchMedia: () => void

beforeEach(() => {
  restoreMatchMedia = stubMatchMedia((query) => query === FINE_POINTER_MEDIA_QUERY && finePointer)
})

afterEach(() => {
  restoreMatchMedia()
  finePointer = false
})
```

Then append this describe block at the end of the file (this repo does NOT use `@testing-library/jest-dom` — plain `.toBeNull()` / `.toBeTruthy()` assertions only):

```tsx
describe('"/" shortcut chip (A11)', () => {
  it('renders on fine-pointer devices when the input is idle and empty', () => {
    finePointer = true
    setup()
    expect(screen.getByTestId('search-shortcut-hint').textContent).toBe('/')
  })

  it('does not render on coarse pointers', () => {
    // finePointer stays false (touch devices: no hardware "/" to advertise)
    setup()
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
  })

  it('hides while the input is focused and returns on blur', () => {
    finePointer = true
    const { input } = setup()
    fireEvent.focus(input)
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
    fireEvent.blur(input)
    expect(screen.getByTestId('search-shortcut-hint')).toBeTruthy()
  })

  it('never coexists with the clear button (render conditions disjoint on query)', () => {
    finePointer = true
    const { input } = setup()
    // Non-empty query: clear button in, chip out — both target right-2.5,
    // so this disjointness is what prevents overlap.
    fireEvent.change(input, { target: { value: 'fran' } })
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
    expect(screen.getByTestId('search-clear')).toBeTruthy()
    // Clearing refocuses the input, so the chip stays hidden until blur.
    fireEvent.click(screen.getByTestId('search-clear'))
    expect(screen.queryByTestId('search-clear')).toBeNull()
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
    fireEvent.blur(input)
    expect(screen.getByTestId('search-shortcut-hint')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run and see the new tests fail.** Command: `npx vitest run src/components/__tests__/SearchBar.test.tsx`. Expected: import of `FINE_POINTER_MEDIA_QUERY` fails first (`does not provide an export named 'FINE_POINTER_MEDIA_QUERY'`) — that is the failing state for Step 3. (After Step 3 alone, re-running shows 3 of the 4 new tests failing with `TestingLibraryElementError: Unable to find an element by: [data-testid="search-shortcut-hint"]`; the coarse-pointer test passes vacuously until the chip exists. All 6 pre-existing tests must stay green — that proves the file-wide stub is sound.)

- [ ] **Step 3: Add the constant to `src/lib/layoutConstants.ts`.** Directly after:

```ts
/** Must match useMediaQuery's default query. */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'
```

insert:

```ts
/** Fine-pointer capability gate (spec A11/A14): keyboard-shortcut affordances
 *  render only where a hover-capable fine pointer (mouse/trackpad) exists. */
export const FINE_POINTER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)'
```

- [ ] **Step 4: Implement the chip in `src/components/SearchBar.tsx`.** Four edits:

(a) Imports — replace:

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { useCountrySearch } from '../hooks/useCountrySearch'
import type { CountryData } from '../lib/types'
```

with:

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { useCountrySearch } from '../hooks/useCountrySearch'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { FINE_POINTER_MEDIA_QUERY } from '../lib/layoutConstants'
import type { CountryData } from '../lib/types'
```

(b) State — replace:

```tsx
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { results, isStale } = useCountrySearch(countries, query)
```

with:

```tsx
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { results, isStale } = useCountrySearch(countries, query)
  const isFinePointer = useMediaQuery(FINE_POINTER_MEDIA_QUERY)
```

(c) Focus tracking — replace the input's:

```tsx
        onFocus={() => {
          if (query.trim()) setIsOpen(true)
        }}
```

with:

```tsx
        onFocus={() => {
          setIsFocused(true)
          if (query.trim()) setIsOpen(true)
        }}
        onBlur={() => setIsFocused(false)}
```

(Only `isFocused` changes on blur — the dropdown's open state is untouched, so click-selecting an option keeps working exactly as before.)

(d) The chip — immediately AFTER the clear-button conditional block, which ends with:

```tsx
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
```

insert:

```tsx
      {/* "/" shortcut affordance (A11) — advertises the App.tsx global "/"
          focus shortcut. Coexistence with the clear button: clear renders iff
          query !== '', this chip iff query === '' — disjoint on query, so the
          two can never occupy right-2.5 at the same time. */}
      {isFinePointer && !isFocused && query === '' && (
        <kbd
          aria-hidden="true"
          data-testid="search-shortcut-hint"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none px-1.5 py-0.5 rounded-md border border-sand-300/60 dark:border-dark-200/40 bg-sand-200/60 dark:bg-dark-300/60 text-[11px] font-medium text-sand-500 dark:text-dark-100"
        >
          /
        </kbd>
      )}
```

(`aria-hidden` because it is a visual affordance for a shortcut, not an interactive element; `pointer-events-none` so it can never intercept input clicks — the CLAUDE.md occluder class of flake.)

- [ ] **Step 5: Run tests green.** Command: `npx vitest run src/components/__tests__/SearchBar.test.tsx`. Expected: all 10 tests pass (6 pre-existing + 4 new). Then `npx vitest run src/lib/__tests__/layoutConstants.test.ts` — expected: 4 tests pass (the constants file changed; its drift-alarm must stay green).

- [ ] **Step 6: Commit.**

```bash
git add src/lib/layoutConstants.ts src/components/SearchBar.tsx src/components/__tests__/SearchBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(search): permanent "/" shortcut chip on fine-pointer viewports

kbd-styled chip at the input's right edge, gated on (hover: hover) and (pointer: fine) via useMediaQuery, hidden while focused. Render condition is disjoint on query with the clear button (chip iff empty, clear iff non-empty), so the two never overlap at right-2.5. FINE_POINTER_MEDIA_QUERY exported from layoutConstants for A14's reuse.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: A3 — light-theme chrome parity + AA (header, MapLibre chrome, search field)

**Files:**
- Modify: `src/components/Header.tsx:39-43` (wordmark), `:66` (Play button className), `:81-85` (satellite-toggle active branch)
- Modify: `src/components/SearchBar.tsx` (the input `className` line — as left by Tasks 7/8)
- Modify: `src/index.css:175-275` (country-tooltip, maplibregl-ctrl group, attribution)
- Test: `e2e/a11y-contrast.spec.ts` (inside the existing `Meta-color contrast` describe, lines 55-89)

**Interfaces:** Consumes the existing token `--color-teal-accessible: #065f56` (`src/index.css:57`) and its Tailwind classes (`text-teal-accessible` — already used in `CompareCountryPanel.tsx`, `GameOverOverlay.tsx`, `SingleCountryPanel.tsx`, `TimezoneList.tsx`; the header never adopted it).

**Context:** In light mode the header wordmark and Play button render `--color-teal` (#14b8a6) on pale surfaces — ~2.5:1, failing AA's 4.5:1. The MapLibre chrome (country tooltip, nav-control group, attribution) is hardcoded dark-only in `index.css`, with `!important` on the attribution. This task: header teal → `teal-accessible` in light (dark keeps `teal-light`); base CSS becomes the light theme with `.dark` overrides restoring the exact current dark values; attribution `!important` replaced by higher specificity; light search field gets a full-opacity `border-sand-300` + `bg-sand-100`. The space-dark page **backdrop** stays as-is in both themes (settled decision — do not touch `body`).

**Ordering constraint:** runs after Tasks 7 and 8 — the SearchBar input `className` quoted below includes Task 7's `max-sm:text-base`. Locate by quoted code, not line numbers.

**Testing shape (explicit):** the header color gets a real TDD'd e2e pin in `a11y-contrast.spec.ts` (that spec is **CI-covered** — it is not in the chromium `testIgnore`). The `index.css` MapLibre-chrome work is pure CSS with no sensible unit test — jsdom does not apply stylesheets, and the tooltip/attribution colors live on MapLibre-owned DOM; verification is the local-only theme/axe e2e run plus the manual contrast checklist in Step 7.

- [ ] **Step 1: Write the failing e2e color pins.** In `e2e/a11y-contrast.spec.ts`, inside `test.describe('Meta-color contrast', ...)`, add after the existing const declarations (`SAND_600_RGB` / `DARK_100_RGB`):

```ts
    const TEAL_ACCESSIBLE_RGB = '6, 95, 86' // #065f56 — --color-teal-accessible
    const TEAL_LIGHT_RGB = '94, 234, 212' // #5eead4 — --color-teal-light
```

and after the existing `test('close-button icon uses sand-600 in light mode', ...)` block, add:

```ts
    test('header wordmark uses teal-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const wordmark = page.getByTestId('header-wordmark')
      await expect(wordmark).toBeVisible()
      expect(await computedColor(wordmark)).toContain(TEAL_ACCESSIBLE_RGB)
    })

    test('header Play button uses teal-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const play = page.getByTestId('header-play')
      await expect(play).toBeVisible()
      expect(await computedColor(play)).toContain(TEAL_ACCESSIBLE_RGB)
    })

    test('header wordmark keeps teal-light in dark mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const wordmark = page.getByTestId('header-wordmark')
      await expect(wordmark).toBeVisible()
      expect(await computedColor(wordmark)).toContain(TEAL_LIGHT_RGB)
    })
```

- [ ] **Step 2: Run and see them fail.** Kill any stray dev server first (a dev server on 5173 would be reused by Playwright's `reuseExistingServer` WITHOUT `VITE_TEST_HOOKS` — project memory):

```powershell
try { Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force } } catch {}
```

Then: `npx playwright test e2e/a11y-contrast.spec.ts --project=chromium --workers=2`. Expected: the two new light-mode tests and the dark-mode test fail on `expect(wordmark).toBeVisible()` timing out — `data-testid="header-wordmark"` does not exist yet. All pre-existing tests in the spec stay green.

- [ ] **Step 3: Header — adopt `teal-accessible` in light mode.** In `src/components/Header.tsx`, three edits (all keep the `dark:` variant on today's colors):

(a) Wordmark — replace:

```tsx
          <span className="text-lg font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </span>
```

with:

```tsx
          <span
            data-testid="header-wordmark"
            className="text-lg font-bold tracking-wide text-teal-accessible dark:text-teal-light drop-shadow-sm"
          >
            funworldmap
          </span>
```

(b) Play button — in its `className`, replace the substring `text-teal dark:text-teal-light` so the line becomes:

```tsx
              className="h-10 px-3 rounded-xl backdrop-blur-sm border flex items-center gap-2 font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-teal-accessible dark:text-teal-light hover:bg-sand-200/90 dark:hover:bg-dark-300/80"
```

(c) Satellite toggle, active branch (same header interactive-text failure) — replace:

```tsx
                ? 'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal dark:text-teal-light'
```

with:

```tsx
                ? 'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal-accessible dark:text-teal-light'
```

(The SearchBar magnifier icon at `text-teal dark:text-teal-light` is left alone: it is a decorative non-text graphic beside an AA-passing placeholder, out of A3's "brand/interactive text" scope.)

- [ ] **Step 4: Light search field — visible border + solid fill.** In `src/components/SearchBar.tsx`, the input `className` (as left by Task 7; Task 8 did not touch this line) reads:

```tsx
        className="w-full pl-10 pr-9 py-3 rounded-xl bg-sand-100/80 dark:bg-dark-400/80 backdrop-blur-md border border-sand-300/50 dark:border-dark-200/30 text-sand-900 dark:text-dark-50 text-sm max-sm:text-base placeholder-sand-400 dark:placeholder-dark-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus:border-teal/40 dark:focus:border-teal-light/30 transition-all duration-150"
```

Replace `bg-sand-100/80` → `bg-sand-100` and `border-sand-300/50` → `border-sand-300` (the `dark:` variants already override both in dark mode, so dark is unchanged):

```tsx
        className="w-full pl-10 pr-9 py-3 rounded-xl bg-sand-100 dark:bg-dark-400/80 backdrop-blur-md border border-sand-300 dark:border-dark-200/30 text-sand-900 dark:text-dark-50 text-sm max-sm:text-base placeholder-sand-400 dark:placeholder-dark-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus:border-teal/40 dark:focus:border-teal-light/30 transition-all duration-150"
```

- [ ] **Step 5: `index.css` — tooltip + nav controls become light-base with `.dark` overrides.** Replace the block from `/* Country name tooltip — positioned by JS, not React */` down through the `.maplibregl-ctrl-icon` filter rule (currently lines ~175-255) with:

```css
/* Country name tooltip — positioned by JS, not React.
   Base = light chrome (A3): sand surface, teal-accessible text; the .dark
   overrides below restore the original dark values exactly. */
.country-tooltip {
  position: absolute;
  /* Initial resting position. Without this the hidden tooltip sits at its
     static position after the map container and stretches the document 12px
     past the viewport — permanent page scrollbars (2026-07-10 review). */
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 100;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(250, 247, 242, 0.92);
  border: 1px solid var(--color-sand-300);
  color: var(--color-teal-accessible);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 100ms ease-out;
}

/* Dark keeps a near-invisible border (not `none`) so box metrics match light. */
.dark .country-tooltip {
  background: rgba(18, 21, 24, 0.88);
  border-color: rgba(51, 65, 85, 0.35);
  color: #5eead4;
}

.country-tooltip.visible {
  opacity: 1;
}

.country-tooltip img {
  width: 24px;
  height: 16px;
  object-fit: cover;
  border-radius: 2px;
}

/* Tooltip two-line layout (name + capital) */
.country-tooltip .tooltip-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.country-tooltip .tooltip-name {
  font-weight: 500;
  font-size: 13px;
  color: var(--color-teal-accessible);
}

.dark .country-tooltip .tooltip-name {
  color: #5eead4;
}

.country-tooltip .tooltip-capital {
  font-size: 11px;
  color: var(--color-sand-600);
}

.dark .country-tooltip .tooltip-capital {
  color: rgba(148, 163, 184, 0.7);
}

/* MapLibre navigation control restyling — scoped to bottom-right.
   Base = light chrome (A3); .dark restores the original dark look. */
.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group {
  background: rgba(250, 247, 242, 0.92);
  border: 1px solid var(--color-sand-300);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group {
  background: rgba(18, 21, 24, 0.88);
  border-color: rgba(94, 234, 212, 0.25);
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
  color: var(--color-teal-accessible);
  background: transparent;
}

.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
  color: #5eead4;
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:hover {
  background: rgba(6, 95, 86, 0.08);
}

.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:hover {
  background: rgba(94, 234, 212, 0.12);
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button + button {
  border-top: 1px solid var(--color-sand-300);
}

.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button + button {
  border-top-color: rgba(94, 234, 212, 0.15);
}

/* MapLibre compass/zoom icon color override (uses an img element with filter).
   Dark only — MapLibre's stock icons are dark gray, already correct on the
   light sand surface. */
.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-icon {
  filter: brightness(0) saturate(100%) invert(83%) sepia(37%) saturate(356%) hue-rotate(122deg) brightness(92%) contrast(93%);
}
```

- [ ] **Step 6: `index.css` — attribution loses `!important`, gains light + dark rules.** Replace the attribution block (currently lines ~257-274, the three rules containing `!important`) with:

```css
/* MapLibre attribution control — theme-scoped, no !important. MapLibre's own
   sheet styles the pill at up to (0,2,0) specificity
   (.maplibregl-ctrl-attrib.maplibregl-compact); prefixing .maplibregl-map
   plus the .maplibregl-ctrl double class gives (0,3,0), which outranks it
   regardless of stylesheet import order. WCAG AA needs >=4.5:1 for the
   small link text on both themes. */
.maplibregl-map .maplibregl-ctrl.maplibregl-ctrl-attrib,
.maplibregl-map .maplibregl-ctrl-attrib .maplibregl-ctrl-attrib-inner {
  background: rgba(250, 247, 242, 0.9);
  color: var(--color-sand-600);
}

.dark .maplibregl-map .maplibregl-ctrl.maplibregl-ctrl-attrib,
.dark .maplibregl-map .maplibregl-ctrl-attrib .maplibregl-ctrl-attrib-inner {
  background: rgba(4, 6, 13, 0.82);
  color: #cbd5e1;
}

/* Covers links in both the pill and its inner container (descendant match). */
.maplibregl-map .maplibregl-ctrl-attrib a {
  color: var(--color-teal-accessible);
}

.dark .maplibregl-map .maplibregl-ctrl-attrib a {
  color: #7dd3c0;
}

.maplibregl-map .maplibregl-ctrl-attrib a:hover {
  color: var(--color-teal-accessible);
  text-decoration: underline;
}

.dark .maplibregl-map .maplibregl-ctrl-attrib a:hover {
  color: #5eead4;
  text-decoration: none;
}
```

- [ ] **Step 7: Automated verification.** Kill any stray dev server (same PowerShell one-liner as Step 2), then:
  1. `npx playwright test e2e/a11y-contrast.spec.ts --project=chromium --workers=2` — expected: all tests pass, including the three new pins. This spec IS CI-covered, so the header colors stay guarded after merge.
  2. `npx playwright test e2e/theme-and-responsive.spec.ts e2e/axe-snapshot.spec.ts --project=chromium --workers=2` — expected: all pass. Both specs are in the chromium project's CI `testIgnore` (local-only, tracking issue #106), so **this local run is the only automated coverage they provide** — do not skip it.
  3. `npx vitest run src/components/__tests__/SearchBar.test.tsx` — expected: 10 tests pass (the Task 7 class pin only asserts `text-sm`/`max-sm:text-base`, untouched here).

- [ ] **Step 8: Manual contrast checklist (both themes).** No unit test exists for these — jsdom applies no stylesheets and the tooltip/attribution DOM is MapLibre-owned; this checklist plus Step 7's e2e run is the verification. Run `npm run dev`, open http://localhost:5173, dismiss the launcher if open. Click the theme toggle until **light** (cycle is system → light → dark), then verify:
  - Header wordmark "funworldmap": deep teal #065f56. DevTools color-picker contrast check against its backdrop reads ≥ 4.5:1.
  - Play button label + icon: deep teal on sand pill.
  - Satellite toggle while active (satellite is default-on): deep teal glyph on the teal-tinted pill.
  - Search field: visible sand-300 border, solid sand-100 fill (no translucent wash).
  - Hover a country: tooltip is a pale sand pill with sand-300 border, deep-teal country name, sand-600 capital line.
  - Bottom-right zoom/compass group: sand pill, sand-300 border, dark stock icons (no teal filter).
  - Attribution pill: pale sand background, sand-600 text, deep-teal links, underline on hover; ≥4.5:1 on the link text via DevTools picker.

  Switch to **dark** and verify everything above renders exactly as before this change: teal-light wordmark/Play/toggle, dark tooltip with #5eead4 name, dark nav pill with teal icon filter, dark attribution with #7dd3c0 links. Stop the dev server (Ctrl+C) when done — a leftover dev server on 5173 poisons later Playwright runs (project memory).

- [ ] **Step 9: Commit.**

```bash
git add src/components/Header.tsx src/components/SearchBar.tsx src/index.css e2e/a11y-contrast.spec.ts
git commit -m "$(cat <<'EOF'
fix(theme): light-mode chrome parity + AA for header and MapLibre chrome

Header wordmark/Play/satellite-toggle adopt text-teal-accessible in light (dark keeps teal-light); country tooltip, nav-control group, and attribution become light-base sand surfaces with .dark overrides restoring the exact dark values; attribution drops !important in favor of (0,3,0) specificity; light search field gets full-opacity border-sand-300 + bg-sand-100. Light header colors pinned in a11y-contrast.spec.ts (CI-covered); theme-and-responsive + axe-snapshot verified locally (CI testIgnore).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

### Task 10: Hint commit — A12 (second onboarding hint + localStorage gates) merged with A14's hint half (capability-gated copy, kbd footer drop), one commit

**Files:**
- Modify: src/hooks/useFirstVisitHint.ts:1-41 (full rewrite)
- Modify: src/hooks/__tests__/useFirstVisitHint.test.tsx:1-65 (full rewrite)
- Modify: src/hooks/useMediaQuery.ts:3 (add exported `FINE_POINTER_QUERY` constant)
- Modify: src/App.tsx:10,14 (imports), src/App.tsx:103-107 (hook call), src/App.tsx:359-367 (hint pill JSX)
- Modify: src/components/SearchBar.tsx:1-3 (imports), src/components/SearchBar.tsx:28-33 (hook call), src/components/SearchBar.tsx:228-246 (kbd footer)
- Test: src/hooks/__tests__/useFirstVisitHint.test.tsx
- Test: src/components/__tests__/SearchBar.test.tsx

**Interfaces:**
- Consumes: `useMediaQuery(query: string): boolean` from `src/hooks/useMediaQuery.ts` (already imported by App.tsx).
- Produces: `useFirstVisitHint({ mapReady, hasSelection, gameActive }): { hint: 'explore' | 'game' | null }` (replaces the current `{ showHint: boolean }` return — App.tsx:103 is the only caller), `hintCopy(hint: OnboardingHint, finePointer: boolean): string`, and `FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'` (shared by App.tsx and SearchBar.tsx).

**New localStorage keys** (follow the `funworldmap-*` convention from `personalBestsStore.ts`'s `funworldmap-game-${modeId}-bests-v2` and `legacyStorageCleanup.ts`'s `funworldmap-daily-*`):
- `funworldmap-hint-explore-shown` — replaces the sessionStorage key `funworldmap-hint-shown` for the existing click-hint.
- `funworldmap-hint-game-shown` — gates the new "Try a game" hint.

**Storage cleanup decision — no cleanup step for the old key.** `funworldmap-hint-shown` lives in *sessionStorage*, which is per-tab and self-expires when the tab closes. The `legacyStorageCleanup.ts` precedent exists for *localStorage* keys, which persist indefinitely — a stale sessionStorage entry can only survive inside an already-open tab, nothing reads it after this change, and it evaporates on its own. Do NOT add it to `legacyStorageCleanup.ts` (that file is documented as localStorage-only).

**Why one commit:** per the A-batch commit structure in `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` (item 4), A12 and A14's hint half rewrite the same hook, unit-test file, and pill JSX; the `pointer-events-none` rides along because A12 makes the pill appear after every first panel close — a state many e2e specs click through.

- [ ] **Step 1: Rewrite the hook unit tests to pin the new contract (failing).** Replace the entire contents of `src/hooks/__tests__/useFirstVisitHint.test.tsx` (it currently pins the sessionStorage gate and the `showHint` boolean) with:

```tsx
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hintCopy, useFirstVisitHint } from '../useFirstVisitHint'

const args = (
  o: Partial<{ mapReady: boolean; hasSelection: boolean; gameActive: boolean }> = {},
) => ({
  mapReady: true,
  hasSelection: false,
  gameActive: false,
  ...o,
})

describe('useFirstVisitHint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('explore hint', () => {
    it('shows 1.5s after map-ready when idle and persists the gate in localStorage', () => {
      const { result } = renderHook(() => useFirstVisitHint(args()))
      expect(result.current.hint).toBe(null)
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(result.current.hint).toBe('explore')
      expect(localStorage.getItem('funworldmap-hint-explore-shown')).toBe('1')
    })

    it('does not show if the map is not ready', () => {
      const { result } = renderHook(() => useFirstVisitHint(args({ mapReady: false })))
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.hint).toBe(null)
    })

    it('does not show again on a later pageload — localStorage gate, not per-tab', () => {
      localStorage.setItem('funworldmap-hint-explore-shown', '1')
      const { result } = renderHook(() => useFirstVisitHint(args()))
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.hint).toBe(null)
    })

    it('dismisses (and suppresses) once a selection or game starts', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), { initialProps: args() })
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(result.current.hint).toBe('explore')
      rerender(args({ gameActive: true }))
      expect(result.current.hint).toBe(null)
      // stays dismissed even back at idle
      rerender(args())
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.hint).toBe(null)
    })
  })

  describe('game hint', () => {
    it('shows when the first country panel closes and persists the gate in localStorage', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ hasSelection: true }),
      })
      expect(result.current.hint).toBe(null)
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe('game')
      expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
    })

    it('never shows twice — gate honored on a later pageload', () => {
      localStorage.setItem('funworldmap-hint-game-shown', '1')
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ hasSelection: true }),
      })
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe(null)
    })

    it('shows even after the explore hint was shown and dismissed', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), { initialProps: args() })
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(result.current.hint).toBe('explore')
      rerender(args({ hasSelection: true })) // selecting dismisses the explore hint
      expect(result.current.hint).toBe(null)
      rerender(args({ hasSelection: false })) // first panel close
      expect(result.current.hint).toBe('game')
    })

    it('a game session marks it moot without showing it', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args(),
      })
      rerender(args({ gameActive: true }))
      expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
      rerender(args())
      rerender(args({ hasSelection: true }))
      rerender(args({ hasSelection: false })) // panel close after having played
      expect(result.current.hint).toBe(null)
    })

    it('dismisses on the next selection and never re-shows', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ hasSelection: true }),
      })
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe('game')
      rerender(args({ hasSelection: true }))
      expect(result.current.hint).toBe(null)
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe(null)
    })
  })

  describe('hintCopy', () => {
    it('gives fine pointers the click + slash copy', () => {
      expect(hintCopy('explore', true)).toBe('Click a country to explore — or press / to search')
    })

    it('gives coarse pointers tap copy without the slash clause', () => {
      expect(hintCopy('explore', false)).toBe('Tap a country to explore')
    })

    it('game copy is pointer-independent', () => {
      expect(hintCopy('game', true)).toBe('Try a game — guess countries and cities')
      expect(hintCopy('game', false)).toBe('Try a game — guess countries and cities')
    })
  })
})
```

- [ ] **Step 2: Run the hook tests and see them fail.** Run:

```
npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx
```

Expected: all 12 tests fail — the hook still returns `{ showHint }` so `result.current.hint` is `undefined` (`expected undefined to be null`), and the `hintCopy` tests throw `TypeError: hintCopy is not a function` (the export doesn't exist yet).

- [ ] **Step 3: Rewrite the hook.** Replace the entire contents of `src/hooks/useFirstVisitHint.ts` (currently the single-hint, sessionStorage version with `const HINT_SHOWN_KEY = 'funworldmap-hint-shown'`) with:

```tsx
import { useEffect, useRef, useState } from 'react'

const EXPLORE_HINT_KEY = 'funworldmap-hint-explore-shown'
const GAME_HINT_KEY = 'funworldmap-hint-game-shown'

export type OnboardingHint = 'explore' | 'game'

// localStorage, not sessionStorage: each hint shows once per browser, ever —
// the old per-tab gate re-nagged returning users in every new tab (A12).
// A storage failure (blocked cookies) counts as "shown": a hint that cannot
// persist its gate would otherwise re-nag on every load.
function wasShown(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return true
  }
}

function markShown(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* private-mode / quota — best effort */
  }
}

/** Hint pill copy. Coarse pointers get tap wording without the `/` clause (A14). */
export function hintCopy(hint: OnboardingHint, finePointer: boolean): string {
  if (hint === 'game') return 'Try a game — guess countries and cities'
  return finePointer
    ? 'Click a country to explore — or press / to search'
    : 'Tap a country to explore'
}

/**
 * Drives the two one-time onboarding hints (each gated by localStorage —
 * once per browser, ever):
 * - 'explore': 1.5s after the map is ready, while nothing is selected and no
 *   game is active.
 * - 'game': immediately after the user closes their first country panel.
 *   Starting a game marks it moot without showing it.
 * Whichever hint is visible dismisses as soon as the user selects a country
 * or starts a game.
 */
export function useFirstVisitHint({
  mapReady,
  hasSelection,
  gameActive,
}: {
  mapReady: boolean
  hasSelection: boolean
  gameActive: boolean
}): { hint: OnboardingHint | null } {
  const [hint, setHint] = useState<OnboardingHint | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const prevSelectionRef = useRef(hasSelection)

  useEffect(() => {
    if (!mapReady || hasSelection || dismissed || gameActive || hint !== null) return
    if (wasShown(EXPLORE_HINT_KEY)) return
    const timer = setTimeout(() => {
      setHint('explore')
      markShown(EXPLORE_HINT_KEY)
    }, 1500)
    return () => clearTimeout(timer)
  }, [mapReady, hasSelection, dismissed, gameActive, hint])

  // Game hint: fires on the selected → deselected transition (a panel close).
  // Any game session marks it moot instead — including App's automatic
  // deselect when round 0 starts, where gameActive is already true on the
  // same render, so a game start can never masquerade as a panel close.
  useEffect(() => {
    const wasSelected = prevSelectionRef.current
    prevSelectionRef.current = hasSelection
    if (gameActive) {
      markShown(GAME_HINT_KEY)
      return
    }
    if (!wasSelected || hasSelection) return
    if (wasShown(GAME_HINT_KEY)) return
    setHint('game')
    markShown(GAME_HINT_KEY)
  }, [hasSelection, gameActive])

  useEffect(() => {
    if ((hasSelection || gameActive) && hint) {
      setHint(null)
      setDismissed(true)
    }
  }, [hasSelection, gameActive, hint])

  return { hint }
}
```

- [ ] **Step 4: Run the hook tests green.** Run:

```
npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx
```

Expected: 12 passed.

- [ ] **Step 5: Wire App.tsx — new hook return, capability-gated copy, `pointer-events-none` pill.** Four edits. No new unit test for this step: `AppInner` needs the full `MapProvider`/`GameSessionProvider`/map stack to render, the copy selection and hint state machine are already unit-tested via `hintCopy` and the hook (Steps 1–4), and the wiring is covered by `npm run typecheck` (the old `showHint` name no longer exists, so a missed edit fails the build) plus the e2e run in Step 11.

  In `src/hooks/useMediaQuery.ts`, above the existing `/** Returns true when viewport is >= 1024px (desktop). Handles live resize. */` doc comment, add:

```tsx
/** Hover-capable fine pointer (mouse/trackpad) — false on touch-first devices (A14). */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
```

  In `src/App.tsx` line 10, replace:

```tsx
import { useMediaQuery } from './hooks/useMediaQuery'
```

  with:

```tsx
import { FINE_POINTER_QUERY, useMediaQuery } from './hooks/useMediaQuery'
```

  In `src/App.tsx` line 14, replace:

```tsx
import { useFirstVisitHint } from './hooks/useFirstVisitHint'
```

  with:

```tsx
import { hintCopy, useFirstVisitHint } from './hooks/useFirstVisitHint'
```

  In `src/App.tsx` lines 103–107, replace:

```tsx
  const { showHint } = useFirstVisitHint({
    mapReady,
    hasSelection: !!selected,
    gameActive: session.status !== 'idle',
  })
```

  with:

```tsx
  const finePointer = useMediaQuery(FINE_POINTER_QUERY)
  const { hint } = useFirstVisitHint({
    mapReady,
    hasSelection: !!selected,
    gameActive: session.status !== 'idle',
  })
```

  In `src/App.tsx` lines 359–367, replace the pill JSX:

```tsx
      {showHint && !selected && !gameActive && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-teal/20 dark:border-teal-light/20 text-teal-light text-sm shadow-lg"
          style={{ animation: 'fade-up 300ms ease-out' }}
        >
          Click a country to explore — or press / to search
        </div>
      )}
```

  with (`pointer-events-none` added because the game hint now appears after every first panel close — a state many e2e specs click through; the pill must never intercept a map click):

```tsx
      {hint && !selected && !gameActive && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-teal/20 dark:border-teal-light/20 text-teal-light text-sm shadow-lg pointer-events-none"
          style={{ animation: 'fade-up 300ms ease-out' }}
        >
          {hintCopy(hint, finePointer)}
        </div>
      )}
```

  Then verify the wiring compiles:

```
npm run typecheck
```

Expected: exit 0, no errors.

- [ ] **Step 6: Write the failing SearchBar footer tests.** In `src/components/__tests__/SearchBar.test.tsx`, make three edits. First, replace the vitest import on line 6:

```tsx
import { describe, expect, it, vi } from 'vitest'
```

  with:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

  Second, after the existing `import { makeCountryData } from '../../test/countryFixtures'` (line 9), add the stub imports and a file-level matchMedia stub (jsdom has no `window.matchMedia`, and SearchBar is about to media-query pointer capability — without the stub every existing test in this file would crash after Step 8):

```tsx
import { stubMatchMedia } from '../../test/matchMediaStub'
import { FINE_POINTER_QUERY } from '../../hooks/useMediaQuery'

let restoreMatchMedia: () => void
beforeEach(() => {
  // Default: fine pointer, so the pre-existing Enter-behavior tests are unaffected.
  restoreMatchMedia = stubMatchMedia((q) => q === FINE_POINTER_QUERY)
})
afterEach(() => {
  restoreMatchMedia()
})
```

  Third, append a new describe block at the end of the file (after the closing `})` of `describe('SearchBar Enter behavior', ...)`):

```tsx
describe('SearchBar keyboard-hint footer (A14)', () => {
  it('renders the kbd footer on fine-pointer devices', async () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'fran' } })
    await screen.findByRole('option', { name: /France/ })
    expect(screen.getByTestId('search-keyboard-hint')).toBeTruthy()
  })

  it('drops the kbd footer on coarse pointers', async () => {
    restoreMatchMedia()
    restoreMatchMedia = stubMatchMedia(() => false)
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'fran' } })
    await screen.findByRole('option', { name: /France/ })
    expect(screen.queryByTestId('search-keyboard-hint')).toBeNull()
  })
})
```

- [ ] **Step 7: Run the SearchBar tests and see the coarse-pointer test fail.** Run:

```
npx vitest run src/components/__tests__/SearchBar.test.tsx
```

Expected: 1 failed, 6 passed — `drops the kbd footer on coarse pointers` fails because the footer is still rendered unconditionally (`expected <div data-testid="search-keyboard-hint" …/> to be null`). The fine-pointer test and all five pre-existing Enter-behavior tests pass.

- [ ] **Step 8: Gate the kbd footer on pointer capability.** In `src/components/SearchBar.tsx`, make three edits. First, after the existing imports on lines 1–3:

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { useCountrySearch } from '../hooks/useCountrySearch'
import type { CountryData } from '../lib/types'
```

  add:

```tsx
import { FINE_POINTER_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
```

  Second, inside the component, after the existing line 33:

```tsx
  const { results, isStale } = useCountrySearch(countries, query)
```

  add:

```tsx
  // Coarse pointers have no keyboard to hint at — drop the kbd footer (A14).
  const finePointer = useMediaQuery(FINE_POINTER_QUERY)
```

  Third, at line 228 replace the footer's render condition:

```tsx
          {results.length > 0 && (
            <li role="presentation" aria-hidden="true">
```

  with:

```tsx
          {results.length > 0 && finePointer && (
            <li role="presentation" aria-hidden="true">
```

  (the rest of the footer block, lines 230–246, is unchanged).

- [ ] **Step 9: Run the SearchBar tests green.** Run:

```
npx vitest run src/components/__tests__/SearchBar.test.tsx
```

Expected: 7 passed.

- [ ] **Step 10: Full check.** Run:

```
npm run check
```

Expected: lint, typecheck, and the whole unit suite green (this also proves no other unit test rendered SearchBar without a matchMedia stub).

- [ ] **Step 11: Run the affected e2e specs.** `search.spec.ts` keeps asserting the kbd footer (lines 130–162) — it runs only in the desktop `chromium` project, where `(hover: hover) and (pointer: fine)` matches, so no spec edit is needed. `panel-and-deeplink`, `panel-focus`, and `map-and-countries` all close panels, which now makes the game-hint pill appear — they verify `pointer-events-none` keeps every click path working. Kill any stray dev server first (reuseExistingServer would reuse one without VITE_TEST_HOOKS), then run:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }
npx playwright test e2e/search.spec.ts e2e/panel-and-deeplink.spec.ts e2e/panel-focus.spec.ts e2e/map-and-countries.spec.ts --project=chromium --workers=2
```

Expected: all tests pass. If a click starts failing with an actionability error naming the hint pill, the `pointer-events-none` class from Step 5 is missing — do not add `force: true`.

- [ ] **Step 12: Commit.** One commit for the merged A12 + A14-hint change:

```
git add src/hooks/useFirstVisitHint.ts src/hooks/__tests__/useFirstVisitHint.test.tsx src/hooks/useMediaQuery.ts src/App.tsx src/components/SearchBar.tsx src/components/__tests__/SearchBar.test.tsx
git commit -m "feat(hints): one-time game hint, localStorage gates, capability-gated copy (A12+A14)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 11: A9 — Compare borders "+N" becomes real (all chips render, column scrolls)

**Files:**
- Modify: src/components/CountryColumn.tsx:99-114 (the borders chip block)
- Modify: src/components/CompareCountryPanel.tsx:37 (desktop grid row sizing so the column can actually scroll)
- Test: src/components/__tests__/CountryColumn.test.tsx

**Interfaces:** Standalone. Consumes `CountryData.borders: string[]` and `BorderChip` (`src/components/BorderChip.tsx`, props `{ code, neighbor, onSelect, size }`) — no interface changes.

Context: the compare column currently renders `country.borders.slice(0, 6)` as chips plus an inert `+{n-6}` span (the single panel shows all chips). Spec A9: drop the slice — chips wrap and the column scrolls. The column root already has `overflow-y-auto` (`CountryColumn.tsx:36`), but on desktop the panel's `grid grid-cols-2 h-full` wrapper lets the implicit auto row grow past the panel height, so long content clips instead of scrolling — the one-class `grid-rows-1` fix below (Tailwind's `grid-rows-1` is `repeat(1, minmax(0, 1fr))`) pins the row to the panel height. No e2e asserts the "+N" span (verified by grep), so only the component test changes.

- [ ] **Step 1: Write the failing component test.** Append this describe block to `src/components/__tests__/CountryColumn.test.tsx` (after the existing `describe('CountryColumn border chips', ...)` block; `makeCountry`, `render`, `screen`, `vi` are already imported at the top of the file):

```tsx
describe('CountryColumn borders show every neighbour (A9)', () => {
  it('renders a chip for every border with no inert "+N" overflow suffix', () => {
    const neighbours = [
      ['AUT', '040', 'Austria'],
      ['BEL', '056', 'Belgium'],
      ['CZE', '203', 'Czechia'],
      ['DNK', '208', 'Denmark'],
      ['FRA', '250', 'France'],
      ['LUX', '442', 'Luxembourg'],
      ['NLD', '528', 'Netherlands'],
      ['POL', '616', 'Poland'],
    ] as const
    const byCca3 = new Map(
      neighbours.map(([cca3, ccn3, common]) => [
        cca3,
        makeCountry({ cca3, ccn3, name: { common, official: common } }),
      ]),
    )
    const germany = makeCountry({
      cca3: 'DEU',
      ccn3: '276',
      name: { common: 'Germany', official: 'Federal Republic of Germany' },
      borders: neighbours.map(([cca3]) => cca3),
    })
    render(
      <CountryColumn
        country={germany}
        byCca3={byCca3}
        onSelect={vi.fn()}
        onClose={() => {}}
        badgeLetter="A"
        badgeColor="a"
        showColumnClose={false}
      />,
    )
    // 8 borders — the old code sliced to 6 chips and rendered an inert "+2".
    for (const [, , common] of neighbours) {
      expect(screen.getByRole('button', { name: common })).toBeTruthy()
    }
    expect(screen.queryByText('+2')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and see it fail.** Run:

```bash
npx vitest run src/components/__tests__/CountryColumn.test.tsx
```

Expected failure: `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Netherlands"` (the 7th border falls past the `slice(0, 6)` cut). Do not proceed until you see exactly this class of failure.

- [ ] **Step 3: Drop the slice and the inert span.** In `src/components/CountryColumn.tsx`, replace this block (currently lines 99-114):

```tsx
            <div className="flex flex-wrap gap-1">
              {country.borders.slice(0, 6).map((code) => (
                <BorderChip
                  key={code}
                  code={code}
                  neighbor={byCca3.get(code)}
                  onSelect={onSelect}
                  size="compare"
                />
              ))}
              {country.borders.length > 6 && (
                <span className="px-2 py-0.5 text-[11px] text-sand-400 dark:text-dark-100">
                  +{country.borders.length - 6}
                </span>
              )}
            </div>
```

with:

```tsx
            <div className="flex flex-wrap gap-1">
              {country.borders.map((code) => (
                <BorderChip
                  key={code}
                  code={code}
                  neighbor={byCca3.get(code)}
                  onSelect={onSelect}
                  size="compare"
                />
              ))}
            </div>
```

- [ ] **Step 4: Make the desktop column actually scroll.** In `src/components/CompareCountryPanel.tsx`, replace line 37:

```tsx
      <div className={isDesktop ? 'grid grid-cols-2 h-full' : 'flex flex-col h-full'}>
```

with:

```tsx
      {/* grid-rows-1 = repeat(1, minmax(0, 1fr)): pins the single row to the
          panel height so each column's overflow-y-auto engages — without it
          the implicit auto row grows past the panel and long content (now all
          border chips) clips instead of scrolling. */}
      <div
        className={isDesktop ? 'grid grid-cols-2 grid-rows-1 h-full' : 'flex flex-col h-full'}
      >
```

(The mobile branch already bounds each half with `flex-1 … min-h-0` in the wrappers below, so `overflow-y-auto` engages there today.)

- [ ] **Step 5: Run the tests green.**

```bash
npx vitest run src/components/__tests__/CountryColumn.test.tsx
npm run check
```

Both must pass (check = lint + typecheck + full unit suite).

- [ ] **Step 6: Manual scroll verification (pure layout — no sensible unit test for scroll engagement, jsdom has no layout engine).** Start the dev server, open a many-borders pair, and check both columns:

```bash
npm run dev
```

Open `http://localhost:5173/#DEU,BRA` (Germany: 9 borders, Brazil: 10). Verify: every border chip renders in each column (no "+N" text anywhere), and wheel-scrolling inside each column reaches the last chip (columns scroll independently). Check at a short window height (~700px) where scrolling is forced. Then stop the dev server (Ctrl+C) — a lingering dev server poisons later Playwright runs (`reuseExistingServer` would reuse it without `VITE_TEST_HOOKS`).

- [ ] **Step 7: Commit.**

```bash
git add src/components/CountryColumn.tsx src/components/CompareCountryPanel.tsx src/components/__tests__/CountryColumn.test.tsx
git commit -m "$(cat <<'EOF'
fix(compare): render every border chip — drop the slice(0,6) and inert "+N" (A9)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: A15 — Compare share + honest close (copy-link, labeled "Exit compare", × closes the whole panel)

**Files:**
- Modify: src/components/CompareCountryPanel.tsx (full-file rewrite, ~90 lines; Task 11 already changed its line 37)
- Modify: src/components/CountryColumn.tsx:1-70 (remove `onClose`/`showColumnClose` props and the column-B ×)
- Test: src/components/__tests__/CompareCountryPanel.test.tsx (new)
- Modify: src/components/__tests__/CountryColumn.test.tsx (drop the removed props from both render calls)
- Modify: e2e/compare-source-attribution.spec.ts (new describe block; already in the chromium `testMatch`, CI-covered)

**Interfaces:**
- Consumes: `dispatchToast(message: string): void` from `src/lib/toast.ts`; `CloseButton` from `src/components/CloseButton.tsx` (props `{ onClick, ariaLabel, testId?, className? }`); `CompareCountryPanel`'s existing props `onClose: () => void` (App wires this to `deselect` — closes the whole panel) and `onExitCompare: () => void` (App wires this to `exitCompare` — back to single).
- Produces: compare header controls — button `aria-label="Copy link to this comparison"`, button `data-testid="exit-compare"` with visible label "Exit compare", and `data-testid="panel-close"` × wired to `onClose`. Task 13's e2e consumes `exit-compare`.
- Breaking: `CountryColumn` Props lose `onClose: () => void` and `showColumnClose: boolean` (obsolete-code removal in the same change, per project memory). `CompareCountryPanel` is the only consumer.

Context: today the compare panel's only visible control is column B's × labeled "Exit compare" (top-right by position), which violates the top-right-×-closes convention, and there is no copy-link even though the `#FRA,DEU` hash already round-trips as a deep link. A15: add a compare header with copy-link (reusing the single panel's clipboard→toast→prompt fallback chain from `SingleCountryPanel.tsx` `onShareLink`), a labeled "Exit compare" control (keeps compare→single reachable on touch), and make the top-right × close the whole panel. Escape's staged exit (compare → single → closed) lives in `App.tsx`'s window keydown handler and is deliberately untouched. Side effect of the flex-column restructure: the sources footer becomes part of the fixed-height layout instead of overflowing past the `h-full` grid. App's panel-open focus effect (`App.tsx:202`, querySelector `[data-testid="panel-close"]`) now finds a target on compare deep links too — an improvement, no spec pins the old absence. No new telemetry in this task (the A-plan's analytics statement declines the A15 candidate event).

- [ ] **Step 1: Write the failing component test.** Create `src/components/__tests__/CompareCountryPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CompareCountryPanel } from '../CompareCountryPanel'
import { makeCountry, sources } from './singleCountryPanelTestUtils'

const FRA = makeCountry()
const DEU = makeCountry({
  cca3: 'DEU',
  ccn3: '276',
  name: { common: 'Germany', official: 'Federal Republic of Germany' },
})

function renderPanel() {
  const onClose = vi.fn()
  const onExitCompare = vi.fn()
  render(
    <CompareCountryPanel
      country={FRA}
      compareWith={DEU}
      isDesktop={true}
      onSelect={vi.fn()}
      onClose={onClose}
      onExitCompare={onExitCompare}
      byCca3={new Map()}
      sources={sources}
    />,
  )
  return { onClose, onExitCompare }
}

describe('CompareCountryPanel header controls (A15)', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    // jsdom has no navigator.clipboard; install a resolving stub so the
    // clipboard branch (not the window.prompt fallback) runs.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  })

  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard
  })

  it('copy-link copies the #FRA,DEU deep link and announces via toast', async () => {
    const toasts: string[] = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent<string>).detail)
    window.addEventListener('funworldmap:toast', onToast)
    try {
      renderPanel()
      fireEvent.click(screen.getByRole('button', { name: 'Copy link to this comparison' }))
      await waitFor(() => expect(toasts).toContain('Link copied'))
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}${window.location.pathname}#FRA,DEU`,
      )
    } finally {
      window.removeEventListener('funworldmap:toast', onToast)
    }
  })

  it('the top-right × closes the WHOLE panel (its position convention), not just compare', () => {
    const { onClose, onExitCompare } = renderPanel()
    fireEvent.click(screen.getByTestId('panel-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onExitCompare).not.toHaveBeenCalled()
  })

  it('"Exit compare" is a labeled control returning to the single panel (touch-reachable)', () => {
    const { onClose, onExitCompare } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Exit compare' }))
    expect(onExitCompare).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test and see it fail.**

```bash
npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx
```

Expected failure: `Unable to find an accessible element with the role "button" and name "Copy link to this comparison"` (the compare header does not exist yet). The `panel-close` test also fails (`Unable to find an element by: [data-testid="panel-close"]`).

- [ ] **Step 3: Rewrite CompareCountryPanel with the header bar.** Replace the entire content of `src/components/CompareCountryPanel.tsx` with:

```tsx
import type { CountryData, CountriesFile } from '../lib/types'
import { CloseButton } from './CloseButton'
import { CountryColumn } from './CountryColumn'
import { dispatchToast } from '../lib/toast'

interface Props {
  country: CountryData
  compareWith: CountryData
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onExitCompare: () => void
  byCca3: Map<string, CountryData>
  sources: CountriesFile['_sources']
}

export function CompareCountryPanel({
  country,
  compareWith,
  isDesktop,
  onSelect,
  onClose,
  onExitCompare,
  byCca3,
  sources,
}: Props) {
  // Same clipboard → toast → window.prompt fallback chain as the single
  // panel's onShareLink — the #FRA,DEU hash already round-trips as a deep link.
  const onShareLink = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const url = `${base}#${country.cca3},${compareWith.cca3}`
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(url)
        .then(() => dispatchToast('Link copied'))
        .catch(() => window.prompt('Copy this link:', url))
    } else {
      window.prompt('Copy this link:', url)
    }
  }

  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[656px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 rounded-2xl border border-sand-200/50 dark:border-dark-200/20 overflow-hidden'
    : 'fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-2xl h-[80vh] overflow-hidden'

  return (
    <div
      className={panelClasses}
      role="complementary"
      aria-label="Country comparison"
      data-testid="country-panel"
      style={isDesktop ? { animation: 'panel-card-in 250ms cubic-bezier(0.34, 1.3, 0.64, 1)' } : undefined}
    >
      {/* flex column: header / columns (flex-1 + min-h-0 so each column's
          overflow-y-auto engages) / sources footer — the footer is part of the
          fixed-height layout instead of overflowing past an h-full grid. */}
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end gap-1 px-3 py-2 border-b border-sand-200/50 dark:border-dark-200/30">
          <button
            type="button"
            onClick={onShareLink}
            className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors"
            aria-label="Copy link to this comparison"
            title="Copy link"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
              />
            </svg>
          </button>
          {/* Compare→single must stay reachable without a keyboard — this
              labeled control is the touch counterpart of Escape's staged exit
              (A15). The × beside it closes the WHOLE panel, matching its
              top-right position's convention. */}
          <button
            type="button"
            onClick={onExitCompare}
            data-testid="exit-compare"
            className="px-3 py-1.5 rounded-xl text-sm font-medium text-teal-accessible dark:text-teal-light hover:bg-sand-200 dark:hover:bg-dark-300 transition-colors"
          >
            Exit compare
          </button>
          <CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />
        </div>
        <div
          className={
            isDesktop ? 'grid grid-cols-2 grid-rows-1 flex-1 min-h-0' : 'flex flex-col flex-1 min-h-0'
          }
        >
          <div
            className={
              isDesktop
                ? 'border-r border-sand-200/50 dark:border-dark-200/30 min-h-0'
                : 'flex-1 border-b-2 border-dashed border-sand-300/50 dark:border-dark-200/30 min-h-0'
            }
          >
            <CountryColumn
              country={country}
              byCca3={byCca3}
              onSelect={onSelect}
              badgeLetter="A"
              badgeColor="a"
            />
          </div>
          <div className={isDesktop ? 'min-h-0' : 'flex-1 min-h-0'}>
            <CountryColumn
              country={compareWith}
              byCca3={byCca3}
              onSelect={onSelect}
              badgeLetter="B"
              badgeColor="b"
            />
          </div>
        </div>
        <footer
          className="px-4 py-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
          data-testid="compare-sources"
        >
          <span className="uppercase tracking-wider text-teal dark:text-teal-light font-medium">Sources:</span>{' '}
          {Object.values(sources).map((s, i) => (
            <span key={s.name}>
              {i > 0 && ' · '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-accessible dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded"
              >
                {s.name}
              </a>
            </span>
          ))}
        </footer>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Remove the now-dead column close from CountryColumn.** Three edits in `src/components/CountryColumn.tsx`. First, the import block (current lines 1-3):

```tsx
import type { CountryData } from '../lib/types'
import { BorderChip } from './BorderChip'
import { CloseButton } from './CloseButton'
```

becomes:

```tsx
import type { CountryData } from '../lib/types'
import { BorderChip } from './BorderChip'
```

Second, the Props interface + destructuring (current lines 16-34):

```tsx
interface Props {
  country: CountryData
  byCca3: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onClose: () => void
  badgeLetter: 'A' | 'B'
  badgeColor: 'a' | 'b'
  showColumnClose: boolean
}

export function CountryColumn({
  country,
  byCca3,
  onSelect,
  onClose,
  badgeLetter,
  badgeColor,
  showColumnClose,
}: Props) {
```

becomes:

```tsx
interface Props {
  country: CountryData
  byCca3: Map<string, CountryData>
  onSelect: (cca3: string) => void
  badgeLetter: 'A' | 'B'
  badgeColor: 'a' | 'b'
}

export function CountryColumn({ country, byCca3, onSelect, badgeLetter, badgeColor }: Props) {
```

Third, delete the column-close render line (current line 67 — the compare header's × and "Exit compare" replace it):

```tsx
          {showColumnClose && <CloseButton onClick={onClose} ariaLabel="Exit compare" />}
        </div>
```

becomes:

```tsx
        </div>
```

- [ ] **Step 5: Update CountryColumn's tests for the removed props.** In `src/components/__tests__/CountryColumn.test.tsx` there are two render calls carrying the removed props (the Morocco/ESH test and Task 11's Germany test). In both, delete the two lines:

```tsx
        onClose={() => {}}
```
and
```tsx
        showColumnClose={false}
```

(everything else in each `<CountryColumn ...>` render stays as is).

- [ ] **Step 6: Run unit tests + full check green.**

```bash
npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx src/components/__tests__/CountryColumn.test.tsx
npm run check
```

`npm run check` catches any leftover reference to the removed props (typecheck) and the unused-import lint.

- [ ] **Step 7: Add the e2e coverage to the compare spec.** Append this describe block to `e2e/compare-source-attribution.spec.ts` (after the existing `test.describe('compare view source attribution footer', ...)` block; `test`, `expect`, `gotoAndWaitForMap` are already imported):

```ts
test.describe('compare header controls (A15)', () => {
  test('copy-link copies the compare deep link and shows the toast', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Copy link to this comparison' }).click()

    // Observe the toast, never navigator.clipboard.readText (readText hangs
    // under automation — project memory). clipboard-write is granted
    // project-wide in playwright.config.ts.
    await expect(page.getByText('Link copied')).toBeVisible()
  })

  test('"Exit compare" returns to the single-country panel', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('exit-compare').click()

    await expect(page.getByTestId('exit-compare')).not.toBeAttached()
    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect(page.getByTestId('country-panel')).toContainText('France')
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#FRA')
  })

  test('the top-right × closes the whole panel', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('panel-close')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('panel-close').click()

    await expect(page.getByTestId('country-panel')).not.toBeAttached()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
  })
})
```

- [ ] **Step 8: Run the e2e spec.** First kill any stray dev server (`reuseExistingServer` would reuse it without `VITE_TEST_HOOKS` — project memory):

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

then:

```bash
npx playwright test e2e/compare-source-attribution.spec.ts --project=chromium --workers=2
```

All 5 tests (2 existing + 3 new) must pass.

- [ ] **Step 9: Live sanity pass (visual restructure has no automatable assertion for "footer no longer clipped").** `npm run dev`, open `http://localhost:5173/#FRA,DEU`: header row shows copy-link icon, "Exit compare", ×; the Sources footer is visible at the panel bottom (previously it overflowed past the h-full grid); columns still scroll; check both themes via the theme toggle and mobile at 390px via devtools. Stop the dev server afterwards.

- [ ] **Step 10: Commit.**

```bash
git add src/components/CompareCountryPanel.tsx src/components/CountryColumn.tsx src/components/__tests__/CompareCountryPanel.test.tsx src/components/__tests__/CountryColumn.test.tsx e2e/compare-source-attribution.spec.ts
git commit -m "$(cat <<'EOF'
feat(compare): header with copy-link, labeled Exit compare, and honest top-right close (A15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: A8 — Stray map clicks stop destroying comparisons (third country replaces B; A/ocean no-op)

**Files:**
- Create: src/lib/compareMapClick.ts
- Test: src/lib/__tests__/compareMapClick.test.ts (new)
- Modify: src/hooks/useMapInteractions.ts:4-5 (imports), :172-193 (`clickCountry` mark gate)
- Test: src/hooks/__tests__/useMapInteractions.test.ts (append to the `click-origin marking` describe)
- Test: src/hooks/__tests__/useSelectionHighlight.test.tsx (append one camera-decision pinning test)
- Modify: src/App.tsx:23-24 (import), :183-193 (new callbacks after `onMapSelect`), :337-338 (WorldMap props)
- Create: e2e/compare-map-clicks.spec.ts
- Modify: playwright.config.ts:67 (register the new spec in the chromium `testMatch`)

**Interfaces:**
- Produces: `compareMapClick(clickedCca3: string, selectedCca3: string, compareWithCca3: string): { kind: 'replace-b'; cca3: string } | { kind: 'noop' }` in `src/lib/compareMapClick.ts`.
- Consumes: `compareSelect(cca3: string)` / `deselect()` from `useSelectedCountry` (already destructured in `AppInner`); `parseHash` from `src/lib/hashState.ts` (`{ kind: 'country'; cca3; compareWith: string | null } | ...`); `data-testid="exit-compare"` shipped in the previous commit (`src/components/CompareCountryPanel.tsx`); the `__funworldmap_map` e2e seam (typed `maplibregl.Map` in `e2e/test-globals.d.ts`).

Context: with `compareWith` set, a map click on a third country currently falls through to `select()` in `App.tsx`'s `onMapSelect` and tears down the pair, and an ocean click reaches `deselect()` via `useMapInteractions.clickMap → onDeselect` and closes the whole panel. A8 (descoped to map clicks — search and border chips keep their current select behavior; per-column chip semantics land with workstream C): third country replaces B; clicking A or ocean is a no-op; Escape and A15's "Exit compare" remain the exits.

**Camera decision (resolves the spec's named risk):** a replace-B click changes the hash, so `useMapInteractions.clickCountry`'s `willChangeSelectionHash` would mark click-origin and `resolveHash` would consume it into `selectionOriginRef` — but `selected` doesn't change, so `flyToCountry` (the only `preserveZoom` consumer, `useSelectionHighlight.ts:59`) never runs, and `flyToComparePair` (read in full: it takes no origin/zoom input — it always reframes the pair via `cameraForBounds`, with the wide-pair midpoint and `GLOBE_SCALE_ZOOM` fallbacks) ignores the mark entirely. **Decision: replace-B always reframes the new pair via `flyToComparePair`; preserveZoom does not apply to the compare camera path (batch-2 §3's framing contract wins — preserving zoom could leave the new B off-screen).** Consequently the click-origin mark must NOT be set while a compare pair is active: for a replace-B click it would be consumed but misdescribe the move, and for an A/B no-op click **no hashchange follows at all, so the mark would leak `preserveZoom` into the next auto selection** (the exact 2026-07-10 failure mode). Both halves are encoded in unit tests below. No new telemetry in this task (the A-plan's analytics statement declines the A8 candidate event).

- [ ] **Step 1: Write the failing decision-table test.** Create `src/lib/__tests__/compareMapClick.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { compareMapClick } from '../compareMapClick'

describe('compareMapClick (A8 map-click semantics while a compare pair is active)', () => {
  it('replaces B when a third country is clicked', () => {
    expect(compareMapClick('ESP', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'ESP' })
  })

  it('uppercases the incoming code', () => {
    expect(compareMapClick('esp', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'ESP' })
  })

  it('is a no-op when A (the selected country) is clicked', () => {
    expect(compareMapClick('FRA', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
  })

  it('is a no-op when the current B is clicked (replacing B with itself is a dead hash write)', () => {
    expect(compareMapClick('DEU', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
  })
})
```

- [ ] **Step 2: Run and see it fail.**

```bash
npx vitest run src/lib/__tests__/compareMapClick.test.ts
```

Expected failure: `Failed to resolve import "../compareMapClick"` (module doesn't exist).

- [ ] **Step 3: Implement the pure decision.** Create `src/lib/compareMapClick.ts`:

```ts
/** A8 (2026-07-26 UX spec): MAP-click semantics while a compare pair is
 *  active. A third country replaces B; clicking A or the current B is a
 *  no-op — Escape and the compare header's Exit compare / × are the only
 *  exits. Scoped to map clicks: search and border chips keep select().
 *  Pure so the decision table is unit-testable without a map. */
export type CompareMapClickAction = { kind: 'replace-b'; cca3: string } | { kind: 'noop' }

export function compareMapClick(
  clickedCca3: string,
  selectedCca3: string,
  compareWithCca3: string,
): CompareMapClickAction {
  const code = clickedCca3.toUpperCase()
  if (code === selectedCca3 || code === compareWithCca3) return { kind: 'noop' }
  return { kind: 'replace-b', cca3: code }
}
```

Run green: `npx vitest run src/lib/__tests__/compareMapClick.test.ts`.

- [ ] **Step 4: Write the failing click-origin-mark tests.** In `src/hooks/__tests__/useMapInteractions.test.ts`, inside `describe('useMapInteractions click-origin marking', ...)`, append these two tests after the existing `does NOT mark while compare-picking...` test (before the describe's closing `})`; `renderHook`, `vi`, `makeCountryData`, `createFakeMapRef`, `LAYER`, `takeOrigin`, `baseOptions`, and `h` are all in scope):

```ts
  it('does NOT mark when clicking A while a compare pair is active (App no-ops — no hashchange would consume it)', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    window.location.hash = '#FRA,DEU'
    const { country, onSelect } = renderWithCountry() // FRA / ccn3 250

    fake.fire('click', LAYER.fill, { features: [{ id: country.ccn3 }] })

    expect(onSelect).toHaveBeenCalledWith('FRA')
    // An unconsumed mark would leak preserveZoom into the NEXT auto selection.
    expect(takeOrigin()).toBe('auto')
  })

  it('does NOT mark for a replace-B click (compare hashchange, not a selection — flyToComparePair ignores origin)', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    window.location.hash = '#FRA,DEU'
    const spain = makeCountryData({ cca3: 'ESP', ccn3: '724' })
    const onSelect = vi.fn()
    renderHook(() =>
      useMapInteractions({
        ...baseOptions,
        onSelect,
        byNumeric: new Map([[spain.ccn3, spain]]),
        loaded: true,
      }),
    )

    fake.fire('click', LAYER.fill, { features: [{ id: spain.ccn3 }] })

    expect(onSelect).toHaveBeenCalledWith('ESP')
    // #FRA,DEU → #FRA,ESP is a compare hash: selected is unchanged so
    // flyToCountry (the only preserveZoom consumer) never runs, and
    // flyToComparePair always reframes the pair (A8 camera decision).
    expect(takeOrigin()).toBe('auto')
  })
```

Run and see both fail:

```bash
npx vitest run src/hooks/__tests__/useMapInteractions.test.ts
```

Expected failure on both new tests: `expected 'click' to be 'auto'` (the current gate only checks idle status, picking mode, and the single-selection hash).

- [ ] **Step 5: Gate the mark on compare state.** In `src/hooks/useMapInteractions.ts`, add the import (current lines 4-5):

```ts
import { EMPTY_FILTER, LAYER } from '../lib/mapLayers'
import { markClickOrigin } from '../lib/selectionOrigin'
```

becomes:

```ts
import { parseHash } from '../lib/hashState'
import { EMPTY_FILTER, LAYER } from '../lib/mapLayers'
import { markClickOrigin } from '../lib/selectionOrigin'
```

Then in `clickCountry` (current lines 176-190), replace:

```ts
          // This is the ONLY click-origin site — onSelect in App is shared
          // with search and border chips, so the mark must live here. Mark
          // only when this click will produce a selection hashchange: takeOrigin()
          // runs solely in resolveHash, so a mark set by a game guess click, a
          // compare-picking click, or a re-click of the already-selected
          // country (identical hash → no hashchange) would never be consumed
          // and would leak preserveZoom into the NEXT auto selection
          // (2026-07-10 review finding).
          const willChangeSelectionHash =
            sessionRef.current.status === 'idle' &&
            !comparePickingRef.current &&
            window.location.hash !== `#${country.cca3}`
          if (willChangeSelectionHash) markClickOrigin()
```

with:

```ts
          // This is the ONLY click-origin site — onSelect in App is shared
          // with search and border chips, so the mark must live here. Mark
          // only when this click will produce a selection hashchange: takeOrigin()
          // runs solely in resolveHash, so a mark set by a game guess click, a
          // compare-picking click, or a re-click of the already-selected
          // country (identical hash → no hashchange) would never be consumed
          // and would leak preserveZoom into the NEXT auto selection
          // (2026-07-10 review finding).
          // While a compare pair is active (A8), a click either replaces B (a
          // compare hashchange — selected is unchanged so flyToCountry never
          // runs, and flyToComparePair always reframes the pair, ignoring
          // origin: the batch-2 §3 framing contract wins over preserveZoom)
          // or is an App-level no-op on A/B (no hashchange at all) — never a
          // single-selection hashchange, so it must not mark.
          const hashState = parseHash(window.location.hash)
          const compareActive = hashState.kind === 'country' && hashState.compareWith !== null
          const willChangeSelectionHash =
            sessionRef.current.status === 'idle' &&
            !comparePickingRef.current &&
            !compareActive &&
            window.location.hash !== `#${country.cca3}`
          if (willChangeSelectionHash) markClickOrigin()
```

Run green: `npx vitest run src/hooks/__tests__/useMapInteractions.test.ts`.

- [ ] **Step 6: Pin the camera decision at the fly layer.** Append this test inside `describe('useSelectionHighlight', ...)` in `src/hooks/__tests__/useSelectionHighlight.test.tsx`, after the `does not fly again when compare is cleared` test (`CountryData`, `makeCountryData`, `originRef`, `makeFakeMap`, `makeMapWrapper`, `flyToCountry`, `flyToComparePair` are already imported). **This test passes immediately — it is a pinning test, not TDD-red:** it encodes the A8 camera decision so future changes to the compare camera path cannot silently route replace-B through the `preserveZoom` fly.

```tsx
  it('replacing B reframes the pair and never re-flies the single-selection camera (A8 camera decision)', () => {
    const fake = makeFakeMap()
    const selected = makeCountry('250')
    const germany = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
    const spain = makeCountryData({ cca3: 'ESP', ccn3: '724', latlng: [40, -4] })
    // Stable ref across rerenders (like the real hook's useRef). 'click'
    // simulates a consumed click-origin mark: even then the compare path must
    // ignore preserveZoom — the batch-2 §3 framing contract wins on replace-B.
    const origin = originRef('click')
    const { rerender } = renderHook<void, { compareWith: CountryData | null }>(
      (props) =>
        useSelectionHighlight({
          loaded: true,
          selected,
          selectionOriginRef: origin,
          compareWith: props.compareWith,
        }),
      { wrapper: makeMapWrapper(fake), initialProps: { compareWith: germany } },
    )
    expect(flyToCountry).toHaveBeenCalledTimes(1) // mount only

    rerender({ compareWith: spain })

    expect(flyToComparePair).toHaveBeenCalledTimes(2)
    expect(flyToComparePair).toHaveBeenLastCalledWith(expect.anything(), selected, spain)
    expect(flyToCountry).toHaveBeenCalledTimes(1) // replace-B never re-flies the single camera
  })
```

Run green: `npx vitest run src/hooks/__tests__/useSelectionHighlight.test.tsx`.

- [ ] **Step 7: Write the failing 4-case e2e matrix.** Create `e2e/compare-map-clicks.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import { gotoAndWaitForMap, waitForCountryTilesRendered } from './helpers'

/**
 * A8 — map-click semantics while a compare pair is active (#FRA,DEU):
 *   1. clicking a third country replaces B (never tears down the pair)
 *   2. clicking A is a no-op
 *   3. clicking ocean is a no-op (must NOT close the compare panel)
 *   4. Escape keeps the staged exit: compare → single → closed
 *
 * Clicks are synthetic `map.fire('click', …)` — camera-agnostic (CLAUDE.md).
 * Every fired point carries a queryRenderedFeatures precondition so the test
 * fails loudly if the point stops landing where the case requires.
 */

const FRA_ID = '250' // ccn3 of A
const DEU_ID = '276' // ccn3 of B

async function openComparePair(page: Page): Promise<void> {
  await gotoAndWaitForMap(page, '/#FRA,DEU')
  await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })
  await waitForCountryTilesRendered(page)
}

/**
 * Grid-scan the canvas for a point matching `want` on the country-fill layer
 * ('ocean' = zero rendered features; 'country' = a feature whose id passes
 * the idIs / idNot constraints), fire a synthetic click there, and return the
 * clicked feature id ('' for ocean; null when no point qualified — callers
 * assert non-null as the loud precondition). The country geojson is the
 * canonical 195 (canonical-195.spec.ts), so any rendered id resolves in
 * App's byNumeric.
 */
function fireClickWhere(
  page: Page,
  want: { kind: 'ocean' } | { kind: 'country'; idIs?: string; idNot?: string[] },
): Promise<string | null> {
  return page.evaluate((w) => {
    const map = window.__funworldmap_map
    if (!map) throw new Error('map test seam not exposed — is VITE_TEST_HOOKS set?')
    const canvas = map.getCanvas()
    for (let x = 20; x < canvas.clientWidth - 20; x += 40) {
      for (let y = 20; y < canvas.clientHeight - 20; y += 40) {
        const features = map.queryRenderedFeatures([x, y], { layers: ['country-fill'] })
        const id = features.length > 0 ? String(features[0].id) : null
        const matches =
          w.kind === 'ocean'
            ? id === null
            : id !== null &&
              (w.idIs === undefined || id === w.idIs) &&
              (w.idNot === undefined || !w.idNot.includes(id))
        if (matches) {
          map.fire('click', { point: { x, y }, lngLat: map.unproject([x, y]) })
          return id ?? ''
        }
      }
    }
    return null
  }, want)
}

test.describe('A8 — map clicks while comparing', () => {
  test('clicking a third country replaces B and keeps the compare view', async ({ page }) => {
    await openComparePair(page)

    const clickedId = await fireClickWhere(page, { kind: 'country', idNot: [FRA_ID, DEU_ID] })
    // Precondition: the compare framing must show some third country to click.
    expect(clickedId).not.toBeNull()

    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/^#FRA,[A-Z]{3}$/)
    expect(await page.evaluate(() => window.location.hash)).not.toBe('#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible()
  })

  test('clicking A leaves the pair untouched', async ({ page }) => {
    await openComparePair(page)

    const clickedId = await fireClickWhere(page, { kind: 'country', idIs: FRA_ID })
    // Precondition: flyToComparePair frames both countries, so A is on screen.
    expect(clickedId).toBe(FRA_ID)

    // A regression (select('FRA')) writes the hash synchronously inside the
    // click handler, so this immediate read is a deterministic signal.
    expect(await page.evaluate(() => window.location.hash)).toBe('#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible()
  })

  test('clicking ocean does not tear down the comparison', async ({ page }) => {
    await openComparePair(page)

    const clickedId = await fireClickWhere(page, { kind: 'ocean' })
    // Precondition (CLAUDE.md): the synthetic point must NOT land on a country.
    expect(clickedId).toBe('')

    // A regression (deselect()) clears the hash synchronously via
    // history.replaceState, so this immediate read is deterministic.
    expect(await page.evaluate(() => window.location.hash)).toBe('#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect(page.getByTestId('exit-compare')).toBeVisible()
  })

  test('Escape keeps the staged exit: compare → single → closed', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('exit-compare')).not.toBeAttached()
    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#FRA')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('country-panel')).not.toBeAttached()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
  })
})
```

Register the spec in `playwright.config.ts` — replace line 67:

```ts
        'compare-view-dimming.spec.ts',
```

with:

```ts
        'compare-view-dimming.spec.ts',
        'compare-map-clicks.spec.ts',
```

(chromium project only; it uses `queryRenderedFeatures`, same profile as `map-and-countries.spec.ts` which runs on CI — do not add it to `testIgnore`.)

- [ ] **Step 8: Run the e2e and see 3 of 4 fail.** Kill any stray dev server first:

```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

then:

```bash
npx playwright test e2e/compare-map-clicks.spec.ts --project=chromium --workers=2
```

Expected: `clicking a third country…` fails (`expect(received).toMatch(/^#FRA,[A-Z]{3}$/)` — hash became `#XXX` because the click fell through to `select()`), `clicking A…` fails (hash became `#FRA`), `clicking ocean…` fails (hash became `''` — `deselect()` tore down compare). `Escape keeps the staged exit` passes (existing behavior).

- [ ] **Step 9: Wire the App-level semantics.** Three edits in `src/App.tsx`. First, the import block (current lines 23-24):

```tsx
import { track } from './lib/analytics'
import { dispatchToast } from './lib/toast'
```

becomes:

```tsx
import { track } from './lib/analytics'
import { compareMapClick } from './lib/compareMapClick'
import { dispatchToast } from './lib/toast'
```

Second, insert the two map-only callbacks between the end of `onMapSelect` and the round-start effect. Replace (current lines 173-187):

```tsx
    [
      gameActive,
      session.modeId,
      poolByCca3,
      submitGuessInput,
      comparePickingMode,
      selected,
      select,
      compareSelect,
    ],
  )

  useEffect(() => {
    if (session.status !== 'playing' || session.roundIndex !== 0) return
```

with:

```tsx
    [
      gameActive,
      session.modeId,
      poolByCca3,
      submitGuessInput,
      comparePickingMode,
      selected,
      select,
      compareSelect,
    ],
  )

  // A8 — map-click semantics while a compare pair is active. Scoped to MAP
  // clicks only: search and border chips still route through onMapSelect and
  // keep select() (per-column chip semantics land with workstream C).
  const onMapCountryClick = useCallback(
    (cca3: string) => {
      if (!gameActive && !comparePickingMode && selected && compareWith) {
        const action = compareMapClick(cca3, selected.cca3, compareWith.cca3)
        if (action.kind === 'replace-b') compareSelect(action.cca3)
        return
      }
      onMapSelect(cca3)
    },
    [gameActive, comparePickingMode, selected, compareWith, compareSelect, onMapSelect],
  )

  // A8 — an ocean click must not tear down an active comparison; Escape and
  // the compare header's Exit compare / × are the only exits.
  const onMapDeselect = useCallback(() => {
    if (compareWith) return
    deselect()
  }, [compareWith, deselect])

  useEffect(() => {
    if (session.status !== 'playing' || session.roundIndex !== 0) return
```

Third, the WorldMap wiring (current lines 337-338 — only the map gets the new callbacks; `Header` keeps `onSelect={onMapSelect}` unchanged):

```tsx
          onSelect={onMapSelect}
          onDeselect={deselect}
```

becomes:

```tsx
          onSelect={onMapCountryClick}
          onDeselect={onMapDeselect}
```

- [ ] **Step 10: Run everything green.**

```bash
npx playwright test e2e/compare-map-clicks.spec.ts --project=chromium --workers=2
```

All 4 pass. Then the regression net — ocean-deselect WITHOUT compare must still work, and the A15 controls must be unaffected:

```bash
npx playwright test e2e/map-and-countries.spec.ts e2e/compare-source-attribution.spec.ts e2e/compare-view-dimming.spec.ts --project=chromium --workers=2
```

Then the full gate:

```bash
npm run check
```

- [ ] **Step 11: Commit.**

```bash
git add src/lib/compareMapClick.ts src/lib/__tests__/compareMapClick.test.ts src/hooks/useMapInteractions.ts src/hooks/__tests__/useMapInteractions.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx src/App.tsx e2e/compare-map-clicks.spec.ts playwright.config.ts
git commit -m "$(cat <<'EOF'
feat(compare): map clicks replace B instead of tearing down the pair; A/ocean clicks are no-ops (A8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

### Task 14: A13 — 44px coarse-pointer touch targets via a shared `::after` hit-area convention (last commit of the A batch)

**Files:**
- Modify: `src/lib/layoutConstants.ts` (append after `panelScreenOffset`, currently ends at line 28)
- Modify: `src/components/CloseButton.tsx:8-19`
- Modify: `src/components/SingleCountryPanel.tsx` (header action buttons, ~lines 197-263 pre-restructure — see drift note below)
- Modify: `src/components/SearchBar.tsx:144-164` (clear button)
- Modify: `src/game/shared/hud/HudShell.tsx:40-47` (End game button)
- Modify: `src/game/modes/city-guessing/CityGuessingHud.tsx:59-68` (Skip button)
- Test: `src/lib/__tests__/layoutConstants.test.ts`

**Interfaces:** Produces `TOUCH_TARGET_BASE`, `TOUCH_TARGET_FROM_36`, `TOUCH_TARGET_FROM_24`, `TOUCH_TARGET_TEXT_XS` (exported `string` constants from `src/lib/layoutConstants.ts`), interpolated into consumer `className` template literals.

**Context — what this delivers (spec A13):** Sheet/panel header buttons are 36px (p-2 padding + w-5 h-5 glyph), search-clear is 24px (p-1 + w-4 h-4 — the WCAG 2.5.8 floor exactly), and the HUD "End game" / "Skip round" text buttons are ~16px tall (text-xs, no vertical padding). All get ≥44px hit areas on touch surfaces without changing glyph sizes or visible chrome.

**Mechanism decision — `::after` hit-area expansion, NOT padding + negative margin.** Justification: padding also grows the visible rounded hover pill (`p-2 rounded-xl hover:bg-sand-200 ...`), so the chrome would change even though the glyph doesn't; and negative margins fight the `gap-1` flex header row and the absolutely-positioned search-clear button (each call site would need bespoke compensation). An invisible `::after` overlay hit-tests as part of its originating button, changes zero rendered pixels, and is gated to `pointer-coarse:` so desktop hover/click behavior is untouched (on fine pointers the `::after` is a zero-size box). `pointer-coarse:` requires tailwindcss ≥ 4.1 — the repo has 4.3.0 (verified via `npm ls tailwindcss`). Consumers interpolate the constants into `className`; this is safe for Tailwind's scanner because the whole class tokens appear literally in `layoutConstants.ts`, which Tailwind 4 scans. Accepted trade-off (note it in the commit body if you like): in the `gap-1` header row, adjacent 44px hit areas overlap by 4px per side on touch; the overlap resolves to the later DOM sibling — a tiny misfire zone, standard for this technique.

**Positioning constraint (important):** the `::after` needs a positioned ancestor, so most constants include `relative`. The search-clear button is ALREADY `absolute` — adding `relative` there would create a stylesheet-order-dependent conflict between `.absolute` and `.relative`. That is why `TOUCH_TARGET_FROM_24` deliberately omits `relative` (the button's own `absolute` establishes the containing block). Do not "fix" this by unifying.

**Drift note:** Tasks 5-13 (A1-A12, A14-A16) have landed before this task. They restructure the SingleCountryPanel DataCell grid, the compare panel header, and the search input — but NOT the header action buttons quoted below (compare / share / expand / Continue / CloseButton), which A4/A5/A15 leave in place. If a quoted `className` string has drifted, the class list may differ slightly — the edit is always the same shape: convert the string to a template literal and append `${<constant>}`. Step 9 sweeps the buttons the earlier tasks *added*.

- [ ] **Step 1: Write the failing pinning test.** Open `src/lib/__tests__/layoutConstants.test.ts`. Extend the existing import block (lines 7-18) and append a new `describe` at the end of the file:

```tsx
// ADD to the existing ?raw imports (after line 10, `useMediaQuerySource`):
import searchBarSource from '../../components/SearchBar.tsx?raw'
import closeButtonSource from '../../components/CloseButton.tsx?raw'
import hudShellSource from '../../game/shared/hud/HudShell.tsx?raw'
import cityGuessingHudSource from '../../game/modes/city-guessing/CityGuessingHud.tsx?raw'

// ADD to the existing `from '../layoutConstants'` import list (lines 11-18):
  TOUCH_TARGET_BASE,
  TOUCH_TARGET_FROM_36,
  TOUCH_TARGET_FROM_24,
  TOUCH_TARGET_TEXT_XS,

// APPEND at end of file:
describe('A13 touch-target convention drift alarm', () => {
  it('constants pin the coarse-pointer ::after mechanism and the inset math', () => {
    expect(TOUCH_TARGET_BASE).toBe("after:absolute after:content-['']")
    // 36px sources (p-2 + w-5/h-5 icon buttons, 36px-tall Continue): 36 + 2*4 = 44
    expect(TOUCH_TARGET_FROM_36).toBe(`relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-1`)
    // 24px search-clear (p-1 + w-4/h-4): 24 + 2*10 = 44. No `relative`: the
    // consumer is itself `absolute`, which already positions the ::after —
    // adding `relative` would conflict with stylesheet-order-dependent results.
    expect(TOUCH_TARGET_FROM_24).toBe(`${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-2.5`)
    // 16px-tall text-xs buttons: 16 + 2*14 = 44 tall; +-8px x for short labels
    expect(TOUCH_TARGET_TEXT_XS).toBe(
      `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3.5`,
    )
  })

  it('every touch surface references its convention constant', () => {
    expect(closeButtonSource).toContain('TOUCH_TARGET_FROM_36')
    expect(singleCountryPanelSource).toContain('TOUCH_TARGET_FROM_36')
    expect(searchBarSource).toContain('TOUCH_TARGET_FROM_24')
    expect(hudShellSource).toContain('TOUCH_TARGET_TEXT_XS')
    expect(cityGuessingHudSource).toContain('TOUCH_TARGET_TEXT_XS')
  })

  it('pins the base sizes the inset math assumes', () => {
    // CloseButton visual box: p-2 (2*8px) + w-5 h-5 (20px) = 36px
    expect(closeButtonSource).toContain('p-2 rounded-xl')
    expect(closeButtonSource).toContain('w-5 h-5')
    // HUD text buttons are text-xs (16px line box, no vertical padding)
    expect(hudShellSource).toContain('text-xs')
    expect(cityGuessingHudSource).toContain('text-xs')
  })
})
```

- [ ] **Step 2: Run the test and see it fail.** Run `npx vitest run src/lib/__tests__/layoutConstants.test.ts`. Expected failure: the whole file errors with `SyntaxError: The requested module '../layoutConstants' does not provide an export named 'TOUCH_TARGET_BASE'` (the constants don't exist yet).

- [ ] **Step 3: Add the constants to `src/lib/layoutConstants.ts`.** Append after the closing brace of `panelScreenOffset` (line 28):

```ts
/** ── A13 touch-target convention ────────────────────────────────────────
 * Coarse-pointer hit areas grow to >=44px (WCAG 2.5.5 / platform HIGs)
 * without changing glyphs or visible chrome: an invisible ::after overlay
 * extends the button's hit-test box (pseudo-elements hit-test as part of
 * their originating element). Gated to `pointer-coarse:` (tailwindcss >=4.1)
 * so desktop behavior is untouched — on fine pointers the ::after is a
 * zero-size box. Chosen over padding+negative-margin because padding also
 * grows the visible rounded hover pill, and negative margins fight the
 * gap-1 header rows and the absolutely-positioned search-clear button.
 * Interpolating these into className is scanner-safe: the whole class
 * tokens appear literally in this file. layoutConstants.test.ts pins the
 * strings and every consumer — restyling a target fails that test. */
export const TOUCH_TARGET_BASE = "after:absolute after:content-['']"

/** 36px sources — p-2 + w-5/h-5 icon buttons, the 36px-tall Continue CTA: 36 + 2·4 = 44. */
export const TOUCH_TARGET_FROM_36 = `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-1`

/** 24px search-clear (p-1 + w-4/h-4): 24 + 2·10 = 44. No `relative` — the
 *  consumer is itself `absolute`, which already positions the ::after. */
export const TOUCH_TARGET_FROM_24 = `${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-2.5`

/** 16px-tall text-xs buttons (HUD End game / Skip): 16 + 2·14 = 44 tall, ±8px wide. */
export const TOUCH_TARGET_TEXT_XS = `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3.5`
```

Run `npx vitest run src/lib/__tests__/layoutConstants.test.ts` again — the first new test passes; the "references its convention constant" test now fails with `AssertionError: expected '...' to contain 'TOUCH_TARGET_FROM_36'` (components don't consume them yet).

- [ ] **Step 4: Apply the convention to `src/components/CloseButton.tsx`.** All CloseButton call sites (panel-close in SingleCountryPanel, "Exit compare" in CountryColumn/compare header) inherit automatically. Add the import at the top and append the constant so it applies even when a caller overrides `className`. Replace:

```tsx
const DEFAULT_CLASSNAME =
  'p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors'
```
with
```tsx
import { TOUCH_TARGET_FROM_36 } from '../lib/layoutConstants'

const DEFAULT_CLASSNAME =
  'p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors'
```
and replace
```tsx
      className={className ?? DEFAULT_CLASSNAME}
```
with
```tsx
      className={`${className ?? DEFAULT_CLASSNAME} ${TOUCH_TARGET_FROM_36}`}
```

- [ ] **Step 5: Apply the convention to the `src/components/SingleCountryPanel.tsx` header buttons.** Add `import { TOUCH_TARGET_FROM_36 } from '../lib/layoutConstants'` to the import block (after the `dispatchToast` import). Then convert each header action button's `className` string to a template literal with the constant appended — four edits:

Compare button (currently line 201):
```tsx
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-teal dark:text-teal-light transition-colors"
```
becomes
```tsx
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-teal dark:text-teal-light transition-colors ${TOUCH_TARGET_FROM_36}`}
```

Share (copy link) button (currently line 215) and the mobile expand/collapse button (currently line 233) both carry the identical string:
```tsx
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors"
```
each becomes
```tsx
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors ${TOUCH_TARGET_FROM_36}`}
```

Continue button (game rounds; 36px tall: py-2 + text-sm — currently line 256):
```tsx
                className="px-4 py-2 rounded-xl bg-teal-accessible text-white font-semibold text-sm hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/60"
```
becomes
```tsx
                className={`px-4 py-2 rounded-xl bg-teal-accessible text-white font-semibold text-sm hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/60 ${TOUCH_TARGET_FROM_36}`}
```
(The `focus-visible:ring` stays on the visual box — rings render on the button, not the `::after`. The CloseButton on this header was covered by Step 4.)

- [ ] **Step 6: Apply the convention to the `src/components/SearchBar.tsx` clear button.** Add `import { TOUCH_TARGET_FROM_24 } from '../lib/layoutConstants'` after the `useCountrySearch` import. Replace the clear button's className (currently line 151):

```tsx
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-sand-400 hover:text-sand-600 dark:text-dark-100 dark:hover:text-dark-50"
```
with
```tsx
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-sand-400 hover:text-sand-600 dark:text-dark-100 dark:hover:text-dark-50 ${TOUCH_TARGET_FROM_24}`}
```
The 10px expansion reaches into the input's right edge on touch — intended (it is the clear affordance's tap zone). No conflict with A11's `/` kbd chip: that chip is hidden on coarse pointers (A11/A14), which is exactly and only when this hit area is active.

- [ ] **Step 7: Apply the convention to the HUD text buttons.** Both buttons carry the identical className string. In `src/game/shared/hud/HudShell.tsx`, add `import { TOUCH_TARGET_TEXT_XS } from '../../../lib/layoutConstants'` after the `types` import, then replace the End game button's className (currently line 43); in `src/game/modes/city-guessing/CityGuessingHud.tsx`, add `import { TOUCH_TARGET_TEXT_XS } from '../../../lib/layoutConstants'` after the `MESSAGES` import, then replace the Skip button's className (currently line 63). Both edits:

```tsx
          className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
```
becomes
```tsx
          className={`text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1 ${TOUCH_TARGET_TEXT_XS}`}
```
The ±14px vertical expansion overlaps only non-interactive HUD text (prompt/reveal lines) — safe.

- [ ] **Step 8: Run the pinning test green.** `npx vitest run src/lib/__tests__/layoutConstants.test.ts` — all tests pass (7 total: 4 pre-existing + 3 new).

- [ ] **Step 9: Sweep the buttons added by the earlier A-batch commits.** A13 is deliberately last so the padding applies once to the FINAL button set. Tasks 5-13 added controls this task's frozen snapshot cannot quote: A7's Cancel (×) in the compare-picking banner (SingleCountryPanel), and A15's "Exit compare" + copy-link controls in the compare header (CompareCountryPanel — the ones NOT rendered via `<CloseButton>`, which Step 4 already covers). Enumerate them:

```
grep -n "<button" src/components/SingleCountryPanel.tsx src/components/CompareCountryPanel.tsx src/components/CountryColumn.tsx
```

Classification rule — for every `<button>` in the output not yet carrying a `TOUCH_TARGET_*` constant: `p-2` icon button (36px) → append `${TOUCH_TARGET_FROM_36}`; `p-1` + `w-4 h-4` (24px) → `${TOUCH_TARGET_FROM_24}` (only if the button is already `absolute`; otherwise use `FROM_36`'s pattern logic: bare text-xs → `${TOUCH_TARGET_TEXT_XS}`, everything else 36px-shaped → `${TOUCH_TARGET_FROM_36}`); buttons already ≥44px in both dimensions (e.g. launcher mode cards) → no change. Same edit shape as Steps 5-7 (template literal + import). If `CompareCountryPanel.tsx` gains a direct constant reference, extend the "references its convention constant" test with `import compareCountryPanelSource` … `expect(compareCountryPanelSource).toContain('TOUCH_TARGET_FROM_36')` — the file is already `?raw`-imported at the top of the test. Acceptance: every button in the grep output is either ≥44px natively or references a `TOUCH_TARGET_*` constant. Re-run `npx vitest run src/lib/__tests__/layoutConstants.test.ts` if the test was extended.

- [ ] **Step 10: Full check.** Run `npm run check` (lint + typecheck + all unit tests) — expect green. Type errors here mean a wrong relative import path (`../lib/layoutConstants` from `src/components/`, `../../../lib/layoutConstants` from `src/game/shared/hud/` and `src/game/modes/city-guessing/`).

- [ ] **Step 11: Re-run the affected chromium e2e specs.** These specs click the touched controls (`panel-close`, `search-clear`, `game-end`, `city-skip` — verified by grep). First kill any stray dev server (project memory: `reuseExistingServer` would reuse it WITHOUT `VITE_TEST_HOOKS`):

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

then

```
npx playwright test e2e/search.spec.ts e2e/panel-and-deeplink.spec.ts e2e/panel-focus.spec.ts e2e/mobile-panel-header.spec.ts e2e/accessibility.spec.ts e2e/a11y-contrast.spec.ts e2e/axe-snapshot.spec.ts e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts e2e/header-play-reopens-launcher.spec.ts --project=chromium --workers=2
```

Expect all green — the `::after` overlay changes no rendered pixels and Playwright clicks element centers, so no assertions should move. If a click starts hitting the wrong element, the cause is hit-area overlap in a `gap-1` row (later sibling wins) — fix by shrinking that button's x-inset, not with `force: true`.

- [ ] **Step 12: Run the mobile projects — these are LOCAL-ONLY (CI runs only the chromium project; see `docs/systems/testing.md` § "What Runs in CI"), so this run is the only automated coverage of coarse-pointer behavior before merge:**

```
npx playwright test --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch --workers=2
```

This runs each project's full testMatch (`mobile-smoke`, `mobile-tap`, `mobile-free-play`, `tutorial-first-click`, `theme-and-responsive`, `launcher-card-loading-states`) — small sets. Expect green.

- [ ] **Step 13: Manual hit-box verification (no unit test can do this — jsdom does not lay out `::after` boxes, and the pinning test intentionally checks source strings, not geometry).** Run `npm run dev`, open http://localhost:5173, press F12 → toggle device toolbar → iPhone 12 Pro (390px, emulates `pointer: coarse`). Select a country (tap Germany), then in the Elements panel select the `[data-testid="panel-close"]` button's `::after` and confirm the highlighted overlay box is ≥44×44 CSS px (button 36px + 4px each side). Repeat for `[data-testid="search-clear"]` (type "fr" first; 24px + 10px each side) and — after starting a city game via the Play button — `[data-testid="city-skip"]` (44px tall). Then switch the device toolbar off (fine pointer) and confirm the `::after` boxes collapse to zero size. Stop the dev server before any further e2e runs.

- [ ] **Step 14: Commit (Git Bash):**

```bash
git add src/lib/layoutConstants.ts src/lib/__tests__/layoutConstants.test.ts src/components/CloseButton.tsx src/components/SingleCountryPanel.tsx src/components/SearchBar.tsx src/game/shared/hud/HudShell.tsx src/game/modes/city-guessing/CityGuessingHud.tsx src/components/CompareCountryPanel.tsx src/components/CountryColumn.tsx
git commit -m "$(cat <<'EOF'
feat(a11y): A13 44px coarse-pointer hit areas via shared ::after convention

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

(Drop the two compare-panel paths from `git add` if Step 9's sweep found nothing to change there.)

### Task 15: B1 glyph spike — verify `Noto Sans Bold` renders from the positron glyphs endpoint (throwaway)

**This is a spike, not TDD.** No tests are written and no production code is committed. The entire code change lives on a scratch branch that is deleted at the end; the only artifact that survives is a dated findings note. Time-box: **one hour** from branch creation. If the hour expires before all checks are done, record what was observed and discard anyway.

**Why:** Workstream B1 will add an app-owned `country-labels` symbol layer. Its glyph decision (`text-font: ['Noto Sans Bold']` served by the positron style's existing glyphs endpoint — no self-hosted PBFs) was live-verified at the HTTP level on 2026-07-27, but never inside a running MapLibre globe. This spike confirms it end-to-end before B1's plan is written: glyphs load, labels render over satellite imagery on the globe, and the visibility rule shape (`satellite && !hideLabels`) behaves during a game.

**Files:**
- Modify (scratch branch only, then discarded): `src/components/WorldMap.tsx` (the `onLoad` callback, lines 52-61)
- Modify (scratch branch only, then discarded): `src/lib/mapLayers.ts` (`applyBasemapLayerVisibility`, lines 301-317)
- Create (the only surviving artifact, committed on `main`): `docs/superpowers/notes/2026-07-27-b1-glyph-spike.md`

**Interfaces:** none produced — findings note only. Consumes `applyBasemapLayerVisibility(map, { satellite, hideLabels })` from `src/lib/mapLayers.ts` (called by `src/hooks/useSatelliteMode.ts:33` with `hideLabels: playing`).

- [ ] **Step 1: Create the scratch branch**

  ```bash
  cd /e/polworldmap
  git status   # must be clean before branching; stash if not
  git switch -c spike/b1-glyphs
  ```

- [ ] **Step 2: Add the temporary symbol layer in `WorldMap.tsx`**

  In `src/components/WorldMap.tsx`, the current `onLoad` callback is:

  ```tsx
  const onLoad = useCallback(async (map: maplibregl.Map) => {
    const geojson = await loadCountryGeojson()
    addRasterSources(map)
    addCountrySource(map, geojson)
    addBaseCountryLayers(map)
    addHoverLayers(map)
    addSelectionLayers(map)
    addCompareLayers(map)
    applyWarmLighting(map)
  }, [])
  ```

  Add the spike source + layer at the end (last in the onLoad sequence, matching where B1's real layer will go):

  ```tsx
  const onLoad = useCallback(async (map: maplibregl.Map) => {
    const geojson = await loadCountryGeojson()
    addRasterSources(map)
    addCountrySource(map, geojson)
    addBaseCountryLayers(map)
    addHoverLayers(map)
    addSelectionLayers(map)
    addCompareLayers(map)
    applyWarmLighting(map)

    // SPIKE (throwaway, spike/b1-glyphs): B1 glyph verification.
    // 3 hardcoded centroids from bundled country.latlng ([lat,lng] → GeoJSON [lng,lat]).
    map.addSource('country-labels-spike', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'France' },
            geometry: { type: 'Point', coordinates: [2, 46] },
          },
          {
            type: 'Feature',
            properties: { name: 'Brazil' },
            geometry: { type: 'Point', coordinates: [-55, -10] },
          },
          {
            type: 'Feature',
            properties: { name: 'Japan' },
            geometry: { type: 'Point', coordinates: [138, 36] },
          },
        ],
      },
    })
    map.addLayer({
      id: 'country-labels-spike',
      type: 'symbol',
      source: 'country-labels-spike',
      layout: {
        'text-field': ['get', 'name'],
        // Explicit font is load-bearing: MapLibre's default stack 404s on the
        // positron glyphs endpoint; Noto Sans Bold is what it actually serves.
        'text-font': ['Noto Sans Bold'],
        'text-size': 14,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.5,
      },
    })
  }, [])
  ```

  The `country-` id prefix matters: it puts the layer in the visibility owner's custom-layer skip (`customPrefixes` in `applyBasemapLayerVisibility`), exactly like B1's real layer will be.

- [ ] **Step 3: Add the explicit spike visibility rule to `applyBasemapLayerVisibility`**

  B1's spec says the owner gains an explicit rule — **visible iff `satellite && !hideLabels`** — because the custom-layer skip means the generic rules never touch `country-*` layers. Prototype that rule. In `src/lib/mapLayers.ts`, the current loop body is:

  ```ts
  const customPrefixes = ['country-', 'satellite-']
  for (const layer of style.layers) {
    if (customPrefixes.some((p) => layer.id.startsWith(p))) continue
    const visible = !opts.satellite && (layer.type !== 'symbol' || !opts.hideLabels)
  ```

  Insert the spike rule *before* the prefix skip (the skip would otherwise swallow it):

  ```ts
  const customPrefixes = ['country-', 'satellite-']
  for (const layer of style.layers) {
    // SPIKE (throwaway): B1's planned explicit rule for the app label layer.
    if (layer.id === 'country-labels-spike') {
      map.setLayoutProperty(
        layer.id,
        'visibility',
        opts.satellite && !opts.hideLabels ? 'visible' : 'none',
      )
      continue
    }
    if (customPrefixes.some((p) => layer.id.startsWith(p))) continue
    const visible = !opts.satellite && (layer.type !== 'symbol' || !opts.hideLabels)
  ```

- [ ] **Step 4: Run the dev server**

  Kill any stray dev server first (project memory: a background `npm run dev` left running will later poison Playwright's `reuseExistingServer`), then start fresh:

  ```bash
  cd /e/polworldmap
  npm run dev
  ```

  Open `http://localhost:5173/` in a browser with DevTools → Network open.

- [ ] **Step 5: Verify labels render in satellite mode on the globe (screenshot)**

  Manual checks — record each answer for the note in Step 8:

  1. **Endpoint**: On load (satellite is the default basemap), filter Network by `pbf`. Expect exactly one glyph request of the shape `https://tiles.openfreemap.org/fonts/Noto Sans Bold/0-255.pbf` returning **200** (all three names are Latin-1, so one range PBF covers them). A 404 here means the endpoint/font-name assumption is wrong — that is the spike's kill finding.
  2. **Render**: "France", "Brazil", "Japan" appear in white text with a dark halo over the satellite imagery on the globe at the default z1.8 view. Rotate the globe to bring Japan into view.
  3. **Collision at z1.8**: note whether all three labels survive MapLibre's collision pass at the default zoom, or whether any drop (they are far apart, so a drop indicates something worth knowing for B1's `symbol-sort-key` design).
  4. **Halo legibility**: zoom into France (~z4-5) so the label sits over bright terrain (Alps); judge whether 1.5px `#0f172a` halo keeps 14px white text readable over bright imagery. Note "readable / marginal / unreadable".
  5. **Screenshot**: capture the globe with the labels visible and save it OUTSIDE the repo (e.g. your temp directory) — it must not be committed; reference its observations in the note instead.

- [ ] **Step 6: Verify the labels hide when `hideLabels` fires (start a game)**

  1. Click the header **Play** button, pick **Country Pinning**, and start a game. `useSatelliteMode` re-runs `applyBasemapLayerVisibility` with `hideLabels: true` (session `playing`) — all three spike labels must disappear.
  2. Press **Escape** (or the HUD End game button) to leave the game — the labels must come back.
  3. While idle, toggle the basemap to vector — the labels must hide too (`satellite && !hideLabels` requires satellite). Toggle back to satellite — they return. Record all three observations.

- [ ] **Step 7: Discard the spike branch**

  Stop the dev server (Ctrl+C — do not leave it running; it would be reused by a later Playwright run without `VITE_TEST_HOOKS`). Then throw the code away:

  ```bash
  cd /e/polworldmap
  git add -A
  git commit -m "spike: WIP b1 glyph layer (to be discarded)"   # commit so the switch is clean; the branch dies next
  git switch main
  git branch -D spike/b1-glyphs
  git log --oneline -1   # confirm main is untouched
  ```

- [ ] **Step 8: Record findings in the dated note on `main`**

  Create `docs/superpowers/notes/2026-07-27-b1-glyph-spike.md` (if executing on a different date, use that date in the filename) with this exact structure, filling every `<...>` from Steps 5-6 — no field may be left blank:

  ```markdown
  # B1 glyph spike — Noto Sans Bold via the positron glyphs endpoint

  **Date:** 2026-07-27
  **Branch:** spike/b1-glyphs (discarded; no production code)
  **Time spent:** <minutes>

  One-hour throwaway spike ahead of workstream B1
  (`docs/superpowers/specs/2026-07-26-ux-visual-program-design.md`): a temporary
  `country-labels-spike` symbol layer with `text-font: ['Noto Sans Bold']` and a
  hardcoded 3-point GeoJSON (France [2,46], Brazil [-55,-10], Japan [138,36]),
  plus a prototype of B1's explicit visibility rule
  (`visible iff satellite && !hideLabels`) in `applyBasemapLayerVisibility`.

  ## Findings

  - **Endpoint worked:** <yes/no> — glyph request `<observed URL>` returned
    <status>; <one PBF covered all three names? yes/no>.
  - **Collision behavior at z1.8:** <all three labels rendered / which dropped
    and when>.
  - **Halo legibility:** <readable / marginal / unreadable> — 14px white text,
    1.5px #0f172a halo over <what imagery was checked, e.g. Alps at z4.5>.
  - **Game gating:** labels <hid/did not hide> when a country-pinning session
    entered `playing`; <returned/did not return> on exit; <hid/did not hide>
    in vector mode.

  ## Consequences for B1

  <2-4 bullets: anything that changes B1's plan — e.g. halo width, text-size
  floor, sort-key need, or "no changes; proceed as specced">.
  ```

- [ ] **Step 9: Commit the note (the spike's only commit)**

  ```bash
  cd /e/polworldmap
  git add docs/superpowers/notes/2026-07-27-b1-glyph-spike.md
  git commit -m "docs: record B1 glyph spike findings (Noto Sans Bold via positron endpoint)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

  Sanity check afterwards: `git show --stat HEAD` must list only the note file — if any `src/` file appears, the spike leaked; reset and redo Step 7.