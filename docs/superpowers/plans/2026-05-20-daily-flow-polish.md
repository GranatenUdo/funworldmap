# Daily flow polish — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the daily completion path post-#91: fix three mechanical hygiene items + eliminate the "Not played." flash + close the refresh-during-race window.

**Architecture:** Two independent commits. Commit 1 is mechanical cleanup (docstring, `writeLastMode` wiring, three stale 🟠 markers removed). Commit 2 introduces a `recordDailyCompletion(session)` helper called from two sites in `useGameAnnouncements`: `advanceNow`'s `endsGame` branch (production path — gets the race fix) and the game-over `useEffect`'s daily branch (fallback for test-seam `__funworldmap_game.finalize()` and any future code that dispatches `finalize` directly). A new `announcedGameOverRef` dedupes the screen-reader announcement since `recordedRef` is now set pre-finalize.

**Tech Stack:** React + TypeScript + Vitest + Playwright. No new libraries. Reducer untouched.

**Spec:** [`docs/superpowers/specs/2026-05-20-daily-flow-polish-design.md`](../specs/2026-05-20-daily-flow-polish-design.md)

---

## File Structure

**Modify:**

- `src/game/hooks/useRevealMapEffects.ts` — update the JSDoc at lines 84-90 to reflect the post-#91 hook structure (Item 1).
- `src/App.tsx` — extend `lastMode` import to include `writeLastMode`; call it inside the reveal-route `onPlayUnlimited` handler (Item 2).
- `src/game/GameController.tsx` — add `writeLastMode` import; call it inside the `onPlayUnlimited` `useCallback` (Item 2).
- `docs/testing/game-unhappy-paths.md` — replace the 🟠 markers at lines 225, 409, 683 with verified-behavior lines. Leave lines 261 and 272 untouched (Item 3).
- `src/game/hooks/useGameAnnouncements.ts` — extract `recordDailyCompletion(session)` helper, call from `advanceNow` pre-finalize, add `announcedGameOverRef`, update game-over useEffect with daily fallback (Item 4).
- `src/game/hooks/__tests__/useGameAnnouncements.test.tsx` — add four new tests for the dual-call pattern (Item 4).

**Not touched:** `useGameSession.ts` (reducer), any other source file, any other test file, any e2e spec.

---

## Commit 1 — `chore(daily): mechanical polish (docstring + writeLastMode + stale doc markers)`

### Task 1: Update `useRevealMapEffects` docstring (Item 1)

**Files:**

- Modify: `src/game/hooks/useRevealMapEffects.ts:84-90`

- [ ] **Step 1: Update the docstring**

Open `src/game/hooks/useRevealMapEffects.ts`. Find the JSDoc immediately above `export function useRevealMapEffects` (currently lines 84-90):

```ts
/**
 * Drives the MapLibre reveal layer (geometry, arc animation, intermediate
 * flashes), the city-mode any-click handler, and the idle-state reveal-source
 * clear. Owns two anchor refs that track "previous status" / "previous attempt
 * count" so transitions into the intermediate-flash effect don't replay
 * already-recorded attempts on resume.
 */
```

Replace with:

```ts
/**
 * Drives the MapLibre reveal layer (round-end geometry + arc animation),
 * the country-mode intermediate flash (anchor refs gate replay on resume),
 * the city-mode persistent click marker (no anchor — re-paints latest on
 * resume), the city click-to-guess handler, and the idle-state clear.
 */
```

- [ ] **Step 2: Type-check and lint to confirm no other change leaked in**

Run: `npm run lint -- src/game/hooks/useRevealMapEffects.ts && npm run typecheck`

Expected: 0 errors. Pre-existing warnings (e.g. `react-hooks/exhaustive-deps` for `mapRef`) may still appear — those are not introduced by this edit.

Do not commit yet — Tasks 2 and 3 land in the same commit.

---

### Task 2: Wire `writeLastMode` on both `onPlayUnlimited` call sites (Item 2)

**Files:**

- Modify: `src/App.tsx` (lines 23, 538-544)
- Modify: `src/game/GameController.tsx` (lines 18-19 area, 131-135)

**Reference**: `src/game/shared/lastMode.ts:6-22` exports both `readLastMode(): ModeId` and `writeLastMode(modeId: ModeId): void`. Both wrap localStorage with try/catch — safe to call in any environment.

- [ ] **Step 1: Extend the `lastMode` import in `App.tsx`**

In `src/App.tsx`, find line 23:

```ts
import { readLastMode } from './game/shared/lastMode'
```

Replace with:

```ts
import { readLastMode, writeLastMode } from './game/shared/lastMode'
```

- [ ] **Step 2: Call `writeLastMode` in the reveal-route handler**

In `src/App.tsx`, find the `onPlayUnlimited` prop on `<DailyRevealOverlay>` (around lines 538-544):

```tsx
onPlayUnlimited={() => {
  const id = revealState.modeId ?? readLastMode()
  // No track() here — the hash router's free_started event fires when
  // the game boots, which is the durable signal. Adding launcher_dismissed
  // here would be a category error (the reveal overlay is not the launcher).
  window.location.hash = writeHash({ kind: 'game', modeId: id })
}}
```

Add `writeLastMode(id)` between the `id` declaration and the hash assignment:

```tsx
onPlayUnlimited={() => {
  const id = revealState.modeId ?? readLastMode()
  // No track() here — the hash router's free_started event fires when
  // the game boots, which is the durable signal. Adding launcher_dismissed
  // here would be a category error (the reveal overlay is not the launcher).
  writeLastMode(id)
  window.location.hash = writeHash({ kind: 'game', modeId: id })
}}
```

- [ ] **Step 3: Add `writeLastMode` import to `GameController.tsx`**

In `src/game/GameController.tsx`, find the imports near the top of the file (around lines 1-18). Locate where the imports from `./shared/...` modules are clustered (after the React imports and before component imports). Add a new line:

```ts
import { writeLastMode } from './shared/lastMode'
```

Put it adjacent to existing `./shared/...` imports — alphabetical or by-domain ordering is fine, follow the file's existing pattern.

- [ ] **Step 4: Call `writeLastMode` in `GameController`'s `onPlayUnlimited`**

In `src/game/GameController.tsx`, find the `onPlayUnlimited` `useCallback` (around lines 131-135 after the PR #91 + simplify follow-up rename):

```tsx
const onPlayUnlimited = useCallback(() => {
  // Atomic restart via hash-router: avoids the intermediate idle render.
  window.location.hash = writeHash({ kind: 'game', modeId: session.modeId })
}, [session.modeId])
```

Add `writeLastMode(session.modeId)` before the hash assignment:

```tsx
const onPlayUnlimited = useCallback(() => {
  // Atomic restart via hash-router: avoids the intermediate idle render.
  writeLastMode(session.modeId)
  window.location.hash = writeHash({ kind: 'game', modeId: session.modeId })
}, [session.modeId])
```

- [ ] **Step 5: Run unit tests + lint + typecheck**

Run: `npm run check`

Expected: all unit tests PASS (483/483 + any new tests if added since), 0 lint errors, typecheck clean. Pre-existing lint warnings are fine.

Do not commit yet — Task 3 lands in the same commit.

---

### Task 3: Remove 3 verified-stale 🟠 markers (Item 3)

**Files:**

- Modify: `docs/testing/game-unhappy-paths.md` (lines 225, 409, 683)

**Verified**: lines 225, 409, and 683 are stale (fixed in code). Lines 261 and 272 are still valid known gaps (no user-facing toast/banner for localStorage failures — silent degradation by design) — **do NOT edit those**.

- [ ] **Step 1: Edit line 225 (C1 corrupted blob)**

In `docs/testing/game-unhappy-paths.md`, find the line currently reading:

```markdown
- After: 🟠 **Risk per prior audit:** no Sentry breadcrumb is emitted — corruption is invisible to ops.
```

Replace with:

```markdown
- After: localStorage parse failure is captured to Sentry via `captureDailyStorage('parse-failure')` in `src/game/daily/storage.ts:36`. Ops will see it as a Sentry event.
```

- [ ] **Step 2: Edit line 409 (E4 cold load)**

Find:

```markdown
- After: 🟠 **Bug 1 from divergence report:** for free-play hash on fresh load, no game bootstraps — user sees blank map with no launcher.
```

Replace with:

```markdown
- After: Free-play hash on fresh load bootstraps via `useHashGameRouter.ts:196-216` plus the deferred-pool drain effect at lines 229-255. Verified working.
```

- [ ] **Step 3: Edit line 683 (I. Telemetry — general Sentry breadcrumbs)**

Find:

```markdown
- After: 🟠 **Known gap per prior audit:** localStorage corruption paths (`storage.ts`/`resume.ts`) currently do NOT emit Sentry breadcrumbs. This is a separate fix.
```

Replace with:

```markdown
- After: localStorage corruption + write-failure paths emit Sentry breadcrumbs/events via `captureDailyStorage` and `breadcrumbDailyStorage` (`src/game/daily/storage.ts`, `src/game/daily/resume.ts`).
```

- [ ] **Step 4: Verify lines 261 and 272 are unchanged**

Run: `git grep -n '🟠' docs/testing/game-unhappy-paths.md`

Expected: exactly 2 matches — line 261 (C5 localStorage disabled) and line 272 (C6 quota exceeded). Both still valid known gaps. If you see any other 🟠 in this file, you missed a stale marker or accidentally added one.

---

### Task 4: Verify and commit (Commit 1)

**Files:**

- (verify only; no edits in this task)

- [ ] **Step 1: Inspect the staged diff**

Run:

```bash
git add src/game/hooks/useRevealMapEffects.ts src/App.tsx src/game/GameController.tsx docs/testing/game-unhappy-paths.md
git diff --cached --stat
```

Expected: 4 files changed. Approximate line counts: useRevealMapEffects.ts (≈+5/-5 — docstring swap), App.tsx (≈+2/-1), GameController.tsx (≈+2/-0), game-unhappy-paths.md (≈+3/-3 — three line replacements).

- [ ] **Step 2: Run the full unit suite**

Run: `npm test`

(If `npm test` isn't a script in this repo, run `npm run test:unit` instead — the project exposes `test:unit` and `test:e2e` as separate scripts.)

Expected: all PASS.

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run check`

Expected: 0 errors. Pre-existing warnings only.

- [ ] **Step 4: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
chore(daily): mechanical polish (docstring + writeLastMode + stale doc markers)

Three Bucket A items from the post-#91 critical review:

- useRevealMapEffects docstring: replaced the "two anchor refs" wording
  (accurate before #91) with an enumeration of the five effects and which
  use the anchor refs. The city persistent marker effect deliberately
  re-paints on resume and has no anchor.
- writeLastMode wiring: both onPlayUnlimited handlers (App.tsx reveal
  route + GameController daily-city game-over) now persist the mode
  preference before navigating, matching the launcher's startFree
  pattern. Next launcher visit defaults focus to the mode the user was
  just playing.
- game-unhappy-paths.md: removed three verified-stale 🟠 markers
  (Sentry breadcrumb gap at lines 225 + 683, free-play cold-load bug at
  line 409). Lines 261 + 272 (no user-facing signal for localStorage
  persistence failure) are still valid known gaps — left untouched.

Spec: docs/superpowers/specs/2026-05-20-daily-flow-polish-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Commit 2 — `fix(daily): pre-finalize history write + resume clear`

### Task 5: Add failing unit tests for the dual-call pattern (Item 4 — TDD red phase)

**Files:**

- Modify: `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`

**Reference factories** (in `src/game/shared/__tests__/factories.ts`, already imported by the test file):

- `makeSession(overrides)` — default-idle session.
- `makeAttempt(overrides)` — `pointsEarned: 0`, default country input + reveal.
- `makePointReveal(overrides)` — `clickedPoint: [-74.006, 40.7128]` default, `distanceKm: 5800`.
- `makeOutcome(reveal, endsGame = false)` — wraps a reveal into a `GuessOutcome`.

**Reference test seams** (in existing test file):

- `buildAnnouncementsArgs({ session, mode, advance, finalize, record, recordDailyResult })` — returns a complete args object with `vi.fn()` defaults.
- `getMode('city-guessing', POOLS)` — get a real city mode for the round-ended → advanceNow path.
- `RESUME_KEY` — re-exported from `../daily/resume`; the localStorage key for the resume blob.
- `vi.useFakeTimers()` + `vi.advanceTimersByTime(REVEAL_MS_CITY)` — drive the round-ended auto-advance. `REVEAL_MS_CITY === 2000`.
- `captureAnnouncements()` — captures `funworldmap:announce` events into an array.

- [ ] **Step 1: Add the call-order test (the load-bearing one for the race fix)**

In `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`, find the existing `describe('with fake timers', () => { ... })` block (starts around line 151). At the END of that inner describe (after the existing `'calls finalize() ... not country-pinning'` test, around line 210), add:

```ts
it('records daily history and clears resume BEFORE finalize for daily completion via advanceNow', () => {
  // Pre-seed the resume blob — simulates a daily mid-play that has just
  // had its 3rd (final) attempt land. advanceNow must clear this before
  // dispatching finalize so a refresh-during-race sees clean state.
  localStorage.setItem(
    RESUME_KEY,
    JSON.stringify({
      version: 1,
      date: '2026-05-20',
      modeId: 'city-guessing',
      attempts: [],
    }),
  )

  const recordDailyResult = vi.fn()
  const finalize = vi.fn(() => {
    // Inside finalize: the daily writes MUST already have happened. This
    // is the load-bearing assertion — if recordDailyResult or
    // clearResume run after finalize dispatches, the race fix is broken.
    expect(recordDailyResult).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  const reveal = makePointReveal({ clickedPoint: null })
  const session = makeSession({
    status: 'round-ended',
    modeId: 'city-guessing',
    attemptsPerRound: 3,
    attemptsRemaining: 0,
    dailyDate: '2026-05-20',
    score: 80,
    currentAttempts: [
      makeAttempt({
        pointsEarned: 80,
        input: { kind: 'point', lngLat: [0, 0] },
        reveal,
      }),
    ],
    lastOutcome: makeOutcome(reveal, true),
  })

  renderAnnouncementsHook(
    buildAnnouncementsArgs({
      session,
      mode: getMode('city-guessing', POOLS),
      finalize,
      recordDailyResult,
    }),
  )

  act(() => {
    vi.advanceTimersByTime(2000)
  })

  expect(finalize).toHaveBeenCalledTimes(1)
  expect(recordDailyResult).toHaveBeenCalledWith(
    '2026-05-20',
    'city-guessing',
    expect.objectContaining({ score: 80 }),
  )
  expect(localStorage.getItem(RESUME_KEY)).toBeNull()
})
```

- [ ] **Step 2: Add the free-play regression test**

Below the call-order test (still inside `'with fake timers'`), add:

```ts
it('does NOT record daily history when advanceNow fires for free-play endsGame', () => {
  const recordDailyResult = vi.fn()
  const finalize = vi.fn()

  const reveal = makePointReveal({ clickedPoint: null })
  const session = makeSession({
    status: 'round-ended',
    modeId: 'city-guessing',
    attemptsPerRound: 1,
    dailyDate: null, // free play
    lastOutcome: makeOutcome(reveal, true),
  })

  renderAnnouncementsHook(
    buildAnnouncementsArgs({
      session,
      mode: getMode('city-guessing', POOLS),
      finalize,
      recordDailyResult,
    }),
  )

  act(() => {
    vi.advanceTimersByTime(2000)
  })

  expect(finalize).toHaveBeenCalledTimes(1)
  expect(recordDailyResult).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Add the dedup test (post-advanceNow useEffect doesn't double-record)**

OUTSIDE the `'with fake timers'` block (back in the outer `describe('useGameAnnouncements')`, around line 213+), add a new test alongside the existing `'records daily-history on game-over when dailyDate is set, and clears resume'` test:

```ts
it('dedups daily recording across the advanceNow path and the game-over useEffect', () => {
  // Simulate the sequence: round-ended → advanceNow fires (sets refs +
  // records) → finalize dispatches → re-render with status='game-over'.
  // The game-over useEffect must NOT re-call recordDailyResult.
  vi.useFakeTimers()
  try {
    const recordDailyResult = vi.fn()
    const finalize = vi.fn()

    localStorage.setItem(
      RESUME_KEY,
      JSON.stringify({
        version: 1,
        date: '2026-05-20',
        modeId: 'city-guessing',
        attempts: [],
      }),
    )

    const reveal = makePointReveal({ clickedPoint: null })
    const roundEndedSession = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 0,
      dailyDate: '2026-05-20',
      score: 80,
      currentAttempts: [
        makeAttempt({
          pointsEarned: 80,
          input: { kind: 'point', lngLat: [0, 0] },
          reveal,
        }),
      ],
      lastOutcome: makeOutcome(reveal, true),
    })
    const args = buildAnnouncementsArgs({
      session: roundEndedSession,
      mode: getMode('city-guessing', POOLS),
      finalize,
      recordDailyResult,
    })

    const { rerender } = renderHook(({ s }) => useGameAnnouncements({ ...args, session: s }), {
      initialProps: { s: roundEndedSession },
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // advanceNow ran; recordDailyResult fired once.
    expect(recordDailyResult).toHaveBeenCalledTimes(1)

    // Now simulate the post-finalize re-render: status flips to 'game-over'.
    // The game-over useEffect MUST NOT re-record.
    const gameOverSession = { ...roundEndedSession, status: 'game-over' as const }
    rerender({ s: gameOverSession })

    expect(recordDailyResult).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})
```

- [ ] **Step 4: Add the announcement-dedup test**

Below the dedup test, add:

```ts
it('announces "Game over" exactly once even when game-over re-renders', () => {
  const captured = captureAnnouncements()
  try {
    const session = makeSession({
      status: 'game-over',
      modeId: 'country-pinning',
      score: 250,
      dailyDate: null,
    })
    const args = buildAnnouncementsArgs({ session })
    const { rerender } = renderHook(({ s }) => useGameAnnouncements({ ...args, session: s }), {
      initialProps: { s: session },
    })
    // Re-render with a benign change.
    rerender({ s: { ...session, score: 250 } })
    rerender({ s: { ...session, score: 250 } })

    const announces = captured.events.filter((e) => e.startsWith('Game over.'))
    expect(announces.length).toBe(1)
  } finally {
    captured.detach()
  }
})
```

Note: this test verifies the NEW `announcedGameOverRef` introduced in Task 6. It will FAIL today because the current code resets `lastAnnouncedRoundKeyRef` to null on every game-over render and re-dispatches the announcement via the round-key logic — see the implementation in Task 6 for the fix shape.

- [ ] **Step 5: Run the tests, verify the new tests FAIL in the expected ways**

Run: `npm run test:unit -- src/game/hooks/__tests__/useGameAnnouncements.test.tsx`

Expected:

- Existing tests (announcement, auto-advance, game-over recording) STILL PASS.
- New "records daily history and clears resume BEFORE finalize" — FAIL: today `advanceNow` calls `finalize()` synchronously and the useEffect-driven recording fires post-paint. The `finalize` mock's assertion that `recordDailyResult` was already called will fail.
- New "does NOT record daily history when advanceNow fires for free-play" — likely PASS today (free play already takes the useEffect path, which is unchanged for free play). Acceptable as a future regression guard.
- New "dedups daily recording across advanceNow and useEffect" — FAIL: today `recordDailyResult` is called once by the useEffect post-paint (not by advanceNow), so the count after the timer is 0, not 1. Or it may be called once after the rerender — but not double.
- New "announces Game over exactly once" — likely PASS today: today's code already dedupes via `recordedRef` (the announcement lives inside the `!recordedRef.current` block, which only fires once). This test exists as a regression guard for the refactor in Task 6, which moves the announcement OUT of the `recordedRef` block and into a new `announcedGameOverRef` block. If the refactor accidentally drops the dedup, this test catches it.

If any test fails for a DIFFERENT reason than described above, stop and reconcile with the spec before implementing.

Do not commit yet — implementation is in Task 6.

---

### Task 6: Implement the dual-call pattern in `useGameAnnouncements` (Item 4 — TDD green phase)

**Files:**

- Modify: `src/game/hooks/useGameAnnouncements.ts`

- [ ] **Step 1: Add `announcedGameOverRef` next to `recordedRef`**

In `src/game/hooks/useGameAnnouncements.ts`, find the ref declarations near the top of the hook body (currently lines 70-71):

```ts
const recordedRef = useRef(false)
const lastAnnouncedRoundKeyRef = useRef<string | null>(null)
```

Add `announcedGameOverRef` between them:

```ts
const recordedRef = useRef(false)
const announcedGameOverRef = useRef(false)
const lastAnnouncedRoundKeyRef = useRef<string | null>(null)
```

- [ ] **Step 2: Extract the `recordDailyCompletion` helper inside the hook body**

After the ref declarations and BEFORE the `useEffect` block (currently around line 72-73, before `useEffect(() => {`), add the helper function:

```ts
const recordDailyCompletion = (s: GameSession) => {
  if (s.dailyDate === null) return // safety guard; callers should also check
  const attempts = s.currentAttempts
  recordDailyResult(s.dailyDate, s.modeId, {
    score: s.score,
    attempts: attempts.map((a) => ({
      pointsEarned: a.pointsEarned,
      guessCca3: a.input.kind === 'country' ? a.input.cca3 : undefined,
      guessLngLat: a.input.kind === 'point' ? a.input.lngLat : undefined,
      distanceKm: a.reveal.distanceKm,
    })),
    completedAt: Date.now(),
  })
  clearResume()
  track('daily_completed', {
    mode: s.modeId,
    bestScoreBucket: Math.min(4, Math.floor(s.score / 20)),
    attemptsUsed: attempts.length,
  })
}
```

Note: the helper closes over `recordDailyResult`, `clearResume`, and `track` from the surrounding scope. `clearResume` is imported at the top of the file from `'../daily/resume'`; `track` is imported from `'../../lib/analytics'`. Both already exist as imports — verify they're present.

- [ ] **Step 3: Add a daily pre-finalize call to `advanceNow`**

Find the `advanceNow` closure inside the round-ended branch (currently around lines 99-106):

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

Replace with:

```ts
const advanceNow = () => {
  if (session.lastOutcome?.endsGame) {
    // Daily: pre-finalize write so DailyRevealOverlay sees populated history
    // on its first render, and so the resume blob doesn't outlive the history
    // write under a mid-race reload. See spec 2026-05-20-daily-flow-polish.
    if (session.dailyDate !== null && !recordedRef.current) {
      recordedRef.current = true
      recordDailyCompletion(session)
    }
    finalize()
    return
  }
  const next = mode.nextRound(session.used)
  advance(next)
}
```

- [ ] **Step 4: Update the `roundIndex === 0` reset to also clear `announcedGameOverRef`**

Find the reset line in the playing branch (currently line 76):

```ts
if (session.roundIndex === 0) recordedRef.current = false
```

Replace with a block:

```ts
if (session.roundIndex === 0) {
  recordedRef.current = false
  announcedGameOverRef.current = false
}
```

- [ ] **Step 5: Rewrite the game-over useEffect block**

Find the `if (session.status === 'game-over' && !recordedRef.current) { ... }` block (currently lines 143-168). Replace the entire block with:

```ts
if (session.status === 'game-over') {
  if (!recordedRef.current) {
    recordedRef.current = true
    if (session.dailyDate === null) {
      record(session.score, session.bestStreak)
    } else {
      // Fallback: advanceNow didn't run (test-seam .finalize() bypass, or any
      // future code path that dispatches `finalize` directly). The race fix
      // doesn't apply here, but the write must still happen.
      recordDailyCompletion(session)
    }
  }
  if (!announcedGameOverRef.current) {
    announcedGameOverRef.current = true
    lastAnnouncedRoundKeyRef.current = null
    dispatchAnnouncement(`Game over. Final score ${session.score}.`)
  }
}
```

Note: the imports needed by this block (`AttemptRecord`, `clearResume`, `track`) were already required by the previous block — they should all still be present. Verify the import section near the top of the file still imports `clearResume from '../daily/resume'`, `track from '../../lib/analytics'`, and the `AttemptRecord` type from `../shared/types`.

- [ ] **Step 6: Run the unit tests, verify all PASS**

Run: `npm run test:unit -- src/game/hooks/__tests__/useGameAnnouncements.test.tsx`

Expected: all tests in this file PASS (existing + 4 new). If the announcement-dedup test fails because today's announcement code already deduped via a different mechanism, that's fine — the new ref provides explicit dedup. If anything else fails, re-read Task 6's instructions and reconcile.

- [ ] **Step 7: Run the full unit suite for regressions**

Run: `npm run test:unit`

Expected: all PASS. Particular focus on tests around game flow, history, resume — they all live under `src/game/`.

- [ ] **Step 8: Run lint and typecheck**

Run: `npm run check`

Expected: 0 errors. The new helper function may attract a `react-hooks/exhaustive-deps` warning if you put it inside a `useCallback` — but per the implementation in Step 2 it's a plain function defined inside the hook body, so no deps array, no warning.

Do not commit yet — Task 7 is the commit step.

---

### Task 7: Commit 2 + final verification

**Files:** (verify only)

- [ ] **Step 1: Inspect the staged diff**

Run:

```bash
git add src/game/hooks/useGameAnnouncements.ts src/game/hooks/__tests__/useGameAnnouncements.test.tsx
git diff --cached --stat
```

Expected: 2 files changed. `useGameAnnouncements.ts` should show ≈+30/-10 (helper added, advanceNow extended, game-over block rewritten, one ref added). `useGameAnnouncements.test.tsx` should show ≈+120/-0 (4 new tests).

- [ ] **Step 2: Run the full test suite + lint + typecheck one more time**

Run: `npm run check`

Expected: green.

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "$(cat <<'EOF'
fix(daily): pre-finalize history write + resume clear

Move recordDailyResult + clearResume + track('daily_completed') from the
post-paint useEffect into useGameAnnouncements' advanceNow endsGame branch,
BEFORE the finalize() dispatch. Extracted as recordDailyCompletion(session)
helper called from two sites: advanceNow (production race fix) and the
game-over useEffect (fallback for the __funworldmap_game.finalize() test
seam and any future code that dispatches finalize directly). recordedRef
dedupes; a new announcedGameOverRef dedupes the screen-reader announcement
which used to live inside the recordedRef gate.

Fixes:
- DailyRevealOverlay "Not played." flash on first paint after game-over
  (history store was empty until the post-paint useEffect ran).
- Refresh-during-race window where the resume blob outlived the history
  write — reload would land on idle map with the daily result lost.

Free-play recording (record(score, bestStreak)) stays in the useEffect —
no race coupling. finishFree (free-play end-early) untouched.

Spec: docs/superpowers/specs/2026-05-20-daily-flow-polish-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Manual verification (post-implementation, before PR)

The unit test on call order is the load-bearing verification — if it passes, the production race fix is correct. The following manual checks confirm there are no UI regressions.

- [ ] **Step 1: Kill any background dev server** (per the project's e2e-dev-server-conflict memory).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Daily city completion check**

1. Open `http://localhost:5173`, clear `localStorage` if you've already played today.
2. Open the launcher, click "Play" on the city daily card.
3. Submit 3 city guesses (any locations).
4. After the round-end hold (~2s), `DailyRevealOverlay` mounts.
5. **Expected**: the overlay shows the city name + dot summary + score immediately. No "Not played." text visible at any point.

- [ ] **Step 4: Daily country completion check**

Same as Step 3 but for the country card. **Expected**: `GameOverOverlay` (not `DailyRevealOverlay`) — daily country is unchanged. No regression.

- [ ] **Step 5: Refresh during race check (best-effort)**

This race is narrow (≤16 ms in production) and hard to trigger manually. Skip if you can't repro:

1. Open daily city, submit 3 guesses.
2. As soon as the 3rd attempt registers (before the 2s hold expires), press F5.
3. **Expected**: on reload, you land on the reveal route (`#daily/<date>/city-guessing/reveal`), seeing `DailyRevealOverlay` with the just-completed result. NOT the bare map.

If this can't be reproduced, the unit test on call order is sufficient verification.

- [ ] **Step 6: Free-play regression check**

1. Open `/#game/city-guessing` directly.
2. Play through 10 rounds.
3. **Expected**: `GameOverOverlay` shows with score + Play Again. Personal best recorded (verify in localStorage or by playing again and checking the "Best:" line).

- [ ] **Step 7: writeLastMode check (Item 2)**

1. Open daily city (a fresh one or via reveal route).
2. From the reveal overlay or the game-over overlay, click "Play unlimited".
3. After the free city game starts, end the game (Esc or End-game button).
4. Open the launcher (header play button).
5. **Expected**: keyboard focus defaults to the city-card "Play" button (not country). Verify via Tab order or visible focus ring.

---

## Self-review notes (for the implementing agent)

If any of these fail, stop and re-read the spec — the implementation has drifted:

- **No reducer changes.** `git log main..HEAD -- src/game/shared/useGameSession.ts` should be empty.
- **No new analytics events.** `git diff main..HEAD` should NOT add any new `track(<new-name>)` call; only the existing `track('daily_completed')` moves.
- **Lines 261 and 272 of `game-unhappy-paths.md` MUST remain unchanged.** They're still valid known gaps (no user-facing toast for localStorage failures).
- **`recordDailyCompletion` is called from exactly TWO sites.** `advanceNow` and the game-over useEffect's daily fallback branch. If you find it called from anywhere else, that's a deviation.
- **`finalize()` is still called from `advanceNow` AFTER the daily writes.** Don't accidentally re-order; the race fix depends on writes-before-dispatch.

If the implementation reveals a spec gap (a requirement that's ambiguous or self-contradictory), surface it before writing more code — do not invent semantics on the fly.
