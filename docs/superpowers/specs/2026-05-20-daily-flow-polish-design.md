# Daily flow polish — design

**Date:** 2026-05-20
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan
**Follows:** [`2026-05-19-daily-city-feedback-design.md`](2026-05-19-daily-city-feedback-design.md) (merged as PR #91, `94b565b`)

## Summary

A small follow-up to PR #91 surfaced four items during the post-merge critical review. Two are mechanical cleanups (stale docstring, missing `writeLastMode` call); two are stale 🟠 markers in `docs/testing/game-unhappy-paths.md` that misled this session's planning. One is a latent race in the daily completion path that PR #91 made more user-visible (the new `DailyRevealOverlay` shows a brief "Not played." flash on its first render after game-over because `recordDailyResult` runs in a `useEffect` that fires post-paint). The same race also leaves the resume blob alive ~16 ms after the history is supposed to be written, so a refresh in that window can lose the result.

This spec bundles all five fixes into one PR ("daily flow polish"), two commits:

1. **Commit 1 — Mechanical cleanups**: stale docstring fix, `writeLastMode(modeId)` added to both `onPlayUnlimited` call sites, stale 🟠 markers removed from `game-unhappy-paths.md`.
2. **Commit 2 — Pre-finalize daily write**: move `recordDailyResult` + `clearResume` + `track('daily_completed')` from the post-paint `useEffect` into `advanceNow`'s `endsGame` branch in `useGameAnnouncements`, _before_ the `finalize()` dispatch. Fixes both the "Not played." flash and the refresh-during-race window.

Total surface: one comment block, two one-line additions, one doc edit, one hook refactor. No reducer changes (`useGameSession.ts` untouched). No new analytics events. No URL/hash changes. No new components.

## Goals & non-goals

**Goals**

- The `DailyRevealOverlay`, when it mounts on daily-city game-over, renders the just-completed mode's result on its first paint — no "Not played." flash.
- If a user reloads the page between the final-attempt advance and the React render that reflects the new state, the localStorage state on disk is consistent: history written, resume blob cleared. `useHashGameRouter` detects "already played today" and redirects to the reveal route — no data loss.
- Unlimited entry from a reveal-route `Play unlimited` button persists the mode preference (`lastMode`), so the next launcher visit defaults focus to that mode.
- Docs reflect reality: no 🟠 markers pointing at fixed work; the `useRevealMapEffects` docstring accurately describes the post-#91 hook structure.

**Non-goals**

- `AttemptsIndicator` redesign (separate Bucket D #5 brainstorm).
- `forced-colors` a11y support (separate Bucket C #3 brainstorm).
- Mobile tap precision for city guessing (separate Bucket D #8 brainstorm).
- Reveal-depth asymmetry between daily-country `CountryPanel` and daily-city `HUD-only` round-end states (separate Bucket D #4 brainstorm — possible wontfix).
- Reducer changes. `src/game/shared/useGameSession.ts` stays byte-identical.
- New analytics events. `daily_completed` still fires once per daily completion; only its timing changes (now pre-finalize-dispatch instead of post-paint).
- Changes to free-play game-over recording (`record(score, bestStreak)`). The race only matters for daily because daily has the history+resume coupling; free-play personal-best is a single store write with no coupling.

## Branch & PR

- **Branch:** `feat/daily-flow-polish` (off `main` after PR #91 merged at `94b565b`).
- **Commits, in load-bearing order:**
  1. `chore(daily): mechanical polish (docstring + writeLastMode + stale doc markers)`
  2. `fix(daily): pre-finalize history write + resume clear`

Two commits, each independently revertable. Commit 2 is the load-bearing change; if a regression surfaces, revert it without losing commit 1's hygiene wins.

---

## Item 1 — Stale docstring in `useRevealMapEffects`

### Where

- `src/game/hooks/useRevealMapEffects.ts:84-90`

### What today

```ts
/**
 * Drives the MapLibre reveal layer (geometry, arc animation, intermediate
 * flashes), the city-mode any-click handler, and the idle-state reveal-source
 * clear. Owns two anchor refs that track "previous status" / "previous attempt
 * count" so transitions into the intermediate-flash effect don't replay
 * already-recorded attempts on resume.
 */
```

The "two anchor refs" claim was accurate before PR #91 when the intermediate-flash effect handled both country and city branches and gated both on the anchor. After #91, the city persistent marker effect deliberately re-paints on resume (it has no anchor — re-paint _is_ the resume-recovery feature). The docstring now under-describes the hook structure and over-attributes anchor refs to behavior that no longer needs them.

### What changes

Replace the docstring with an accurate one that enumerates the five effects:

```ts
/**
 * Drives the MapLibre reveal layer (round-end geometry + arc animation),
 * the country-mode intermediate flash (anchor refs gate replay on resume),
 * the city-mode persistent click marker (no anchor — re-paints latest on
 * resume), the city click-to-guess handler, and the idle-state clear.
 */
```

### Why bother

Future-Claude reading the hook docstring should know which sub-effect uses the anchor refs (only country flash) and which doesn't (city persistent marker). The current text implied a uniform anchor pattern that no longer exists; the next person editing this hook would get the model wrong on a five-second glance.

---

## Item 2 — `writeLastMode` on `onPlayUnlimited` (both call sites)

### Where

- `src/App.tsx:538-544` — the reveal-route `onPlayUnlimited` handler on the `DailyRevealOverlay` rendered from the URL `#daily/<date>/<mode>/reveal`.
- `src/game/GameController.tsx:131-135` — the `onPlayUnlimited` handler added by PR #91 for the daily-city game-over `DailyRevealOverlay`.

### What today

`src/App.tsx:538-544`:

```tsx
onPlayUnlimited={() => {
  const id = revealState.modeId ?? readLastMode()
  // No track() here — the hash router's free_started event fires when
  // the game boots, which is the durable signal. ...
  window.location.hash = writeHash({ kind: 'game', modeId: id })
}}
```

`src/game/GameController.tsx:131-135`:

```tsx
const onPlayUnlimited = useCallback(() => {
  // Atomic restart via hash-router: avoids the intermediate idle render.
  window.location.hash = writeHash({ kind: 'game', modeId: session.modeId })
}, [session.modeId])
```

Both navigate to `#game/<mode>` but neither calls `writeLastMode(id)`. The launcher's `startFree` ([`Launcher.tsx:191-198`](../../../src/components/Launcher.tsx#L191)) does:

```tsx
const startFree = useCallback(
  (id: ModeId) => {
    track('launcher_dismissed', { path: 'card' })
    writeLastMode(id)        // ← canonical pattern
    onDismiss()
    window.location.hash = writeHash({ kind: 'game', modeId: id })
  },
  ...
)
```

### What changes

In both call sites, call `writeLastMode(id)` immediately before the hash write. App.tsx:

```tsx
onPlayUnlimited={() => {
  const id = revealState.modeId ?? readLastMode()
  writeLastMode(id)
  window.location.hash = writeHash({ kind: 'game', modeId: id })
}}
```

GameController.tsx:

```tsx
const onPlayUnlimited = useCallback(() => {
  writeLastMode(session.modeId)
  window.location.hash = writeHash({ kind: 'game', modeId: session.modeId })
}, [session.modeId])
```

Both files already import from the game module; add `writeLastMode` to the existing `lastMode` import (App.tsx already imports `readLastMode` from `./game/shared/lastMode`; extend it). GameController.tsx needs a new import line.

### Why bother

Users who play daily-city, see the reveal overlay, and click "Play unlimited" expect the launcher's mode-card focus on their next visit to default to city. Without `writeLastMode`, the focus defaults to the previous `lastMode` value (which might be country-pinning, the canonical default). It's a one-line consistency fix matching the launcher's own pattern.

---

## Item 3 — Stale 🟠 markers in `game-unhappy-paths.md`

### Where

- `docs/testing/game-unhappy-paths.md:225` — "🟠 Risk per prior audit: no Sentry breadcrumb is emitted — corruption is invisible to ops."
- `docs/testing/game-unhappy-paths.md:261` — "🟠 Risk per prior audit: no error surfaced to the user explaining that streaks won't persist."
- `docs/testing/game-unhappy-paths.md:272` — "🟠 Risk: no user-facing signal of the persistence failure."
- `docs/testing/game-unhappy-paths.md:683` — "🟠 Known gap per prior audit: localStorage corruption paths (`storage.ts`/`resume.ts`) currently do NOT emit Sentry breadcrumbs. This is a separate fix."
- `docs/testing/game-unhappy-paths.md:409` — "🟠 Bug 1 from divergence report: for free-play hash on fresh load, no game bootstraps — user sees blank map with no launcher."

### What today

Five 🟠 markers claim known gaps that have since been fixed.

### Verified state

- **Sentry breadcrumbs**: `src/game/daily/storage.ts:36` calls `captureDailyStorage(err, 'parse-failure')` on the parse-error branch. `src/game/daily/storage.ts:45` calls `breadcrumbDailyStorage('writeHistory failed', err)`. `src/game/daily/resume.ts:4,21,52,60` similarly wire `captureDailyStorage` and `breadcrumbDailyStorage`. So the four breadcrumb-related 🟠 markers (lines 225, 261, 272, 683) are stale.
- **Free-play cold load**: `src/game/hooks/useHashGameRouter.ts:196-216` checks `state.kind === 'game' && statusRef.current === 'idle'`, verifies pool availability, and either dispatches `start(...)` or defers via `pendingStartRef`. The deferred drain effect at lines 229-255 dispatches once pools arrive. The 🟠 marker on line 409 was diagnosed before the deferred-drain landed and is stale.

### What changes

For lines 225, 261, 272, 683: replace each `🟠 ...` line with a non-emoji line stating the current behavior. Example for line 225:

```markdown
- After: localStorage corruption is captured to Sentry via `captureDailyStorage('parse-failure')` in `src/game/daily/storage.ts:36`. Ops will see the error rate.
```

For line 409: replace with the verified-working description:

```markdown
- After: Free-play hash on fresh load bootstraps via `useHashGameRouter.ts:196-216` plus the deferred-pool drain effect at lines 229-255. Verified working.
```

Each edit removes one 🟠 token and shifts the line from "suspected risk" to "verified behavior."

### Why bother

The 🟠 markers are a triage signal — they tell readers (and future-Claude) where bugs are suspected to still live. Carrying stale markers degrades the signal's value. This session's planning was misled by exactly these markers; I researched fixes that were already in the codebase. Update the doc to match reality.

---

## Item 4 — Pre-finalize daily write (the load-bearing change)

### Where

- `src/game/hooks/useGameAnnouncements.ts:99-106` (the `advanceNow` closure inside the round-ended branch) and lines 143-168 (the `status === 'game-over'` block inside the useEffect).

### What today

`advanceNow` is the function called by the round-ended setTimeout (≈2000 ms for city, ≈3000 ms for country) to either advance to the next round or finalize the game:

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

The history write, resume clear, and analytics fire in the same effect's separate `status === 'game-over'` block, post-finalize:

```ts
if (session.status === 'game-over' && !recordedRef.current) {
  recordedRef.current = true
  const dailyDate = session.dailyDate
  if (dailyDate === null) record(session.score, session.bestStreak)
  else {
    const attempts: AttemptRecord[] = session.currentAttempts
    recordDailyResult(dailyDate, session.modeId, {
      score: session.score,
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
      mode: session.modeId,
      bestScoreBucket: Math.min(4, Math.floor(session.score / 20)),
      attemptsUsed: attempts.length,
    })
  }
  lastAnnouncedRoundKeyRef.current = null
  dispatchAnnouncement(`Game over. Final score ${session.score}.`)
}
```

### Verified consequences

**#6 "Not played." flash** — `useEffect` fires after paint. Sequence on daily-city completion:

1. `advanceNow` calls `finalize()` (round-ended setTimeout fires this).
2. React processes the dispatch, transitions `round-ended → game-over`.
3. Re-render: `GameController` evaluates the game-over branch, mounts `DailyRevealOverlay`.
4. `DailyRevealOverlay` reads `useDailyHistory().history.days[date]['city-guessing']` — `undefined` (write hasn't happened yet).
5. `DailyRevealOverlay` renders the `Not played.` fallback (line 187 of `src/components/DailyRevealOverlay.tsx`).
6. **Browser paints.** User sees "Not played." for ≈ 1 paint frame (≈ 16 ms at 60 Hz, longer if main thread is busy).
7. `useEffect` fires. `recordDailyResult` writes to the module-level store via `useSyncExternalStore`.
8. Store subscribers re-render. `DailyRevealOverlay` now reads the populated entry.
9. Browser paints the real result.

The user sees a brief "Not played." flash. On a slow render (mid-tier mobile, throttled tab) this can be perceptibly longer than one frame.

**#7 Refresh during race** — narrow but real window. If the user reloads the page between step 1 (`finalize` dispatched) and step 7 (`useEffect` fires) — anywhere from microseconds to several paint frames on a busy main thread:

- `localStorage`: history NOT yet written; resume blob STILL present (`writeResume` was called on every attempt during play).
- On reload, `useHashGameRouter` parses the hash `#daily/<date>/<mode>`, checks `dailyHistoryGet(date, mode)` — returns `null`.
- The "alreadyPlayed → redirect to reveal" branch (line 157) is skipped.
- `startOrResumeDaily` reads the resume blob, finds 3 attempts, calls `resume({ modeId, round, attemptsPerRound: 3, attempts: [a1, a2, a3], dailyDate })`.
- The reducer's `resume` case (line 130-145 of `useGameSession.ts`) has the guard `if (action.attempts.length >= action.attemptsPerRound) return state`. Returns unchanged. Status stays `idle`.
- `useHashGameRouter`'s caller doesn't dispatch anything else. The user lands on the bare map. Game state lost.

The window is narrow (≤ 1-3 paint frames) but real. A motivated user (or one whose browser auto-reloads due to a service-worker update) can hit it.

### What changes

Move the _daily_ record/clear/track block from the useEffect into `advanceNow`'s `endsGame` branch, _before_ the `finalize()` dispatch. Keep the free-play `record(score, bestStreak)` and the announcement in the useEffect (they don't have the race-window problem — the personal-best store is a single write with no resume coupling). Add a separate `announcedGameOverRef` so the announcement still fires once even though `recordedRef.current` is set early.

```ts
// Inside the round-ended branch, replacing the existing advanceNow closure.
const advanceNow = () => {
  if (session.lastOutcome?.endsGame) {
    // Daily: pre-finalize write so DailyRevealOverlay sees populated history
    // on its first render, and so the resume blob doesn't outlive the history
    // write under a mid-race reload. See spec 2026-05-20-daily-flow-polish.
    if (session.dailyDate !== null && !recordedRef.current) {
      recordedRef.current = true
      const attempts = session.currentAttempts
      recordDailyResult(session.dailyDate, session.modeId, {
        score: session.score,
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
        mode: session.modeId,
        bestScoreBucket: Math.min(4, Math.floor(session.score / 20)),
        attemptsUsed: attempts.length,
      })
    }
    finalize()
    return
  }
  const next = mode.nextRound(session.used)
  advance(next)
}
```

Add a new ref above the existing `recordedRef`:

```ts
const recordedRef = useRef(false)
const announcedGameOverRef = useRef(false)
const lastAnnouncedRoundKeyRef = useRef<string | null>(null)
```

Reset both refs on the same `roundIndex === 0` reset that already resets `recordedRef` (line 77):

```ts
if (session.roundIndex === 0) {
  recordedRef.current = false
  announcedGameOverRef.current = false
}
```

Rewrite the useEffect's game-over block to handle the post-pre-write state:

```ts
if (session.status === 'game-over') {
  if (!recordedRef.current) {
    recordedRef.current = true
    if (session.dailyDate === null) record(session.score, session.bestStreak)
    // Daily case: already recorded in advanceNow pre-finalize.
  }
  if (!announcedGameOverRef.current) {
    announcedGameOverRef.current = true
    lastAnnouncedRoundKeyRef.current = null
    dispatchAnnouncement(`Game over. Final score ${session.score}.`)
  }
}
```

### Why this fixes both #6 and #7

**#6 fixed**: `recordDailyResult` runs synchronously _inside_ `advanceNow`, before the `finalize()` dispatch is queued. The next render (the first one with `status === 'game-over'`) reads a populated history store. `DailyRevealOverlay`'s first paint shows the real result. No flash.

**#7 fixed**: `clearResume()` runs synchronously _inside_ `advanceNow`, before the `finalize()` dispatch is queued. React 18 batches event-handler dispatches, so React doesn't apply `finalize()` until `advanceNow` returns and the event handler completes. localStorage writes happen during `advanceNow`, before any rendering or possible reload. If the user reloads in the gap between `advanceNow` returning and React applying the dispatch:

- localStorage: history written, resume cleared.
- On reload: `useHashGameRouter` sees `dailyHistoryGet(date, mode) !== null` → redirects to `#daily/<date>/<mode>/reveal`. ✓

### Free-play untouched

Free-play game-over (`session.dailyDate === null`) takes the `record(session.score, session.bestStreak)` branch in the existing useEffect, unchanged. The race doesn't apply (no resume coupling), and personal-best display isn't on the first-paint critical path (it's "Best: N pts" text in `GameOverOverlay`, not "Not played."). No reason to move free-play recording.

### Finishfree (free-play early end) untouched

`onEndGame` calls `finishFree()` for free games, which transitions `playing → game-over` with `endedEarly=true`. This path does NOT go through `advanceNow` (it's an immediate dispatch from a click handler, not the round-ended setTimeout). The useEffect catches the new game-over status and records personal best as today. No change needed.

### Daily abandon (user-initiated end) untouched

`onEndGame` for daily calls `clearResume() + endGame()` (status → `idle`, no history write — abandon semantics). This path bypasses both `advanceNow` and the game-over useEffect. No change needed.

### Test plan

**Unit (vitest):**

- New test in `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`: with a daily session in `round-ended` + `lastOutcome.endsGame === true` + `attemptsPerRound === 3`, fire the auto-advance timer (`vi.useFakeTimers()` + `vi.advanceTimersByTime(REVEAL_MS_CITY)`); assert the call order is `recordDailyResult` → `clearResume` → `track` → `finalize`. Use `vi.fn()` for each and inspect `mock.invocationCallOrder`.
- New test: with a daily session that just transitioned to `game-over` AND `recordedRef.current === true` (simulating post-advanceNow), assert the game-over useEffect does NOT call `recordDailyResult` again. Verifies the dedupe.
- New test: with a free session in `round-ended` + `endsGame === true`, fire the timer; assert `recordDailyResult` is NOT called (free play stays in the useEffect path) and `finalize` IS called.
- New test: with a free session transitioning to `game-over`, assert `record(score, bestStreak)` IS called by the useEffect (regression guard).
- New test: assert `dispatchAnnouncement` is called exactly once per game-over (via `announcedGameOverRef`), even if the effect re-runs.

**E2E (Playwright):**

- New test in `e2e/daily-best-of-3.spec.ts` (or a new `e2e/daily-completion-no-flash.spec.ts`): after the 3rd attempt + `finalizeGame(page)`, assert that within the first 50 ms of `daily-reveal` being attached, `daily-reveal-city` (or `daily-reveal-country`) does NOT contain the text "Not played." — only the populated dot summary. Use `page.locator('[data-testid="daily-reveal-city"]').textContent()` immediately after visibility. (If this is flaky, fall back to asserting at the end of the test that the populated state is reached — which our existing tests already do.)
- Modification to `e2e/mobile-daily-flow.spec.ts`: same first-paint assertion after the 3rd city attempt.

### Risk

- Medium. `useGameAnnouncements` is the choreographer for all post-game side effects; moving any of them changes timing. The `recordedRef` + new `announcedGameOverRef` pattern mirrors the existing dedup logic.
- The `track('daily_completed')` event timing shifts from post-paint to pre-finalize. Analytics dashboards that join `daily_completed` against rendering events would see a ≈ 1 paint frame shift. None of the saved CF queries in `cloudflare-worker/queries/` join on render timing, so impact is zero.
- If a future change introduces a new code path that reaches `game-over` without going through `advanceNow` (other than `finishFree` and `endGame`), it would need to manually record. Unlikely but worth a defensive assertion: the game-over useEffect's `!recordedRef.current` branch handles this as a fallback (it'll record the daily on first sight, just with the pre-fix race).

### Rollback

Revert commit 2 only. Commit 1 (mechanical cleanups) is independent and stays.

---

## Edge cases & invariants

- **`advanceNow` retry**: if `advanceNow` is called twice for the same game (e.g., a future change), `recordedRef.current` prevents double-recording, double-clearing, and double-analytics. The current code already relies on this for the useEffect path.
- **Animated reveal hold > 2000 ms**: the `animatedMs` ceiling (`Math.max(plan.durationMs + 300, 1800)`) doesn't change. The pre-finalize write fires at the same moment as today's `finalize()`, just bundled with the writes.
- **Keyboard early-skip (Enter/Esc/Space)**: `holdThenAdvance` (line 19) calls `advanceNow()` synchronously on keypress. With the refactor, the keypress now does record + clear + track + finalize before the React state transition. Tested via the existing keyboard-skip e2e tests in `e2e/daily-best-of-3.spec.ts`.
- **Multiple game-over re-renders**: React may re-render `GameController` while `status === 'game-over'` for unrelated reasons (e.g., a parent state change). The useEffect's `!recordedRef.current` and `!announcedGameOverRef.current` guards prevent re-running side effects.
- **Daily abandon then immediate restart**: user presses End-game then re-opens the daily. The reducer's `endGame` action resets `recordedRef` and `announcedGameOverRef` because `roundIndex === 0` after start. Verify in tests.

## Files touched

| File                                                     | Change                                                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/game/hooks/useRevealMapEffects.ts`                  | Update docstring at lines 84-90                                                                                            |
| `src/App.tsx`                                            | Add `writeLastMode(id)` call in reveal-route handler; extend `lastMode` import                                             |
| `src/game/GameController.tsx`                            | Add `writeLastMode(session.modeId)` call in `onPlayUnlimited`; add `writeLastMode` import                                  |
| `docs/testing/game-unhappy-paths.md`                     | Remove 5 stale 🟠 markers; update language to reflect verified behaviour                                                   |
| `src/game/hooks/useGameAnnouncements.ts`                 | Move daily record/clear/track into `advanceNow` pre-finalize; add `announcedGameOverRef`; update game-over useEffect block |
| `src/game/hooks/__tests__/useGameAnnouncements.test.tsx` | Add tests for call order + dedupe + free-play regression + announcement (existing file extended)                           |
| `e2e/daily-best-of-3.spec.ts` (or new file)              | Assert no "Not played." on first paint after game-over                                                                     |

## Out of scope (named explicitly)

- AttemptsIndicator visibility / "Attempt N of M" text (#5 — separate spec).
- `forced-colors` CSS support (#3 — separate spec).
- Mobile city tap precision (#8 — separate spec or research).
- Reveal-depth asymmetry between daily-country and daily-city round-end (#4 — possible wontfix; the `DailyRevealOverlay` already provides post-game city context).
- Reducer side effects in `useGameSession.ts`.
- Any new analytics events.
