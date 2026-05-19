# Daily-city per-click feedback + reveal-overlay swap — design

**Date:** 2026-05-19
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

In daily-city play (best-of-3, 1 round), the per-attempt feedback is functionally invisible: a 10px marker held 600ms, no HUD text until round-end, and a `+pts` toast that's gated on `pointsEarned > 0` (which fails for far clicks scoring 0). Users report attempts 1 and 2 feel "unregistered" and game-over after attempt 3 feels like the game ended after a single guess. Then `GameOverOverlay` shows a numeric score with no city-name reveal, which the user reads as "ends abruptly."

Reported in-session 2026-05-19: _"the first two clicks go unregistered and are shown as red on the map ... no feedback to the user as to why the clicks are marked as red ... after guessing the daily city, it shows the results but just ends the game."_

This spec keeps the daily best-of-3 format (the structure isn't the bug — the surface is) and makes three focused changes:

1. **Surface per-click distance + points in the HUD** during `status === 'playing'`, so each attempt produces legible text feedback, not just a brief marker.
2. **Persist the click marker** at the latest guess location for the duration of the round, replaced (not accumulated) on the next click. The 600ms hold becomes "until next click or round-end."
3. **Swap `GameOverOverlay` → `DailyRevealOverlay` for daily-city game-over only.** Daily country and free play are unchanged.

Total surface: one HUD gate change, one map effect split into two, one `GameController` overlay-rendering branch, plus tests and doc updates. No reducer changes, no new state, no new analytics events, no URL/hash changes.

## Goals & non-goals

**Goals**

- After each click in daily city, the user immediately sees "X km off · +N points" in the HUD (not just on the 3rd attempt).
- The user's previous click stays visible on the map until they make the next click, so the second click is informed by the first's landing.
- After completing the daily city, the user sees the city name + their dot summary + share block + "Play unlimited" — the same content the reveal route shows — instead of a numeric `GameOverOverlay`.
- All other daily and free flows are byte-identical: country daily best-of-3 + `GameOverOverlay`; free city/country + `GameOverOverlay`.

**Non-goals**

- No change to the 3-attempt best-of-3 format for daily city. The reducer (`attemptsPerRound`, `endsGame`) is not touched.
- No change to daily country mode. Its 600ms hover-border flash works as intended (full-country highlight at click location).
- No accumulation of markers across attempts — replace-only, per user clarification 2026-05-19.
- No change to scoring (`scoreCityGuess`), distance bands, or marker colors. Red ≥500km stays; the HUD text gives the meaning.
- No new analytics events. `daily_attempted` and `daily_completed` continue to fire from the existing `useHashGameRouter` and `useGameAnnouncements` hooks.
- No URL/hash change. Daily-city game-over still happens at `#daily/<date>/city-guessing`; only the React component rendered above the map changes.

## Branch & PR

- **Branch:** `feat/daily-city-feedback` (off `main` after PR #90 merged).
- **Commits, in load-bearing order:**
  1. `feat(city): persist intermediate marker + surface per-click HUD text`
  2. `feat(city): swap daily-city game-over to DailyRevealOverlay`
  3. `docs(daily-puzzle): note overlay swap for daily city`

Three commits, each independently revertable. Commit 1 ships the per-click feedback (both HUD + marker). Commit 2 ships the overlay swap. Commit 3 updates the system doc. Tests land with the commit they cover.

---

## Item 1 — Per-click HUD text (CityGuessingHud)

### Where

- `src/game/modes/city-guessing/CityGuessingHud.tsx` — the `revealLine` `useMemo` (lines 14-25) and its render (lines 62-70).

### What today

```tsx
const revealLine = useMemo(() => {
  if (session.status !== 'round-ended' || !outcome) return null
  // ...
}, [session.status, outcome, round])
```

The `revealLine` is computed only on `round-ended`. During `playing` (attempts 1 and 2 of best-of-3), nothing renders below the mode card except the AttemptsIndicator pips at the top of the HUD shell.

### What changes

Loosen the gate to include intermediate `playing` attempts in best-of-N mode. Pull the "last attempt" reveal from `session.currentAttempts` when the game is still `playing`.

```tsx
const revealLine = useMemo(() => {
  // Round-ended: read from outcome (best-of-N picks best, attemptsPerRound=1 picks the only attempt).
  if (session.status === 'round-ended' && outcome && outcome.reveal.kind === 'point') {
    return revealLineFor(outcome.reveal, outcome.pointsEarned, round)
  }
  // Playing + best-of-N + at least one attempt: read from the latest attempt.
  if (
    session.status === 'playing' &&
    session.attemptsPerRound > 1 &&
    session.currentAttempts.length > 0
  ) {
    const last = session.currentAttempts[session.currentAttempts.length - 1]
    if (last.reveal.kind === 'point') {
      return revealLineFor(last.reveal, last.pointsEarned, round)
    }
  }
  return null
}, [session.status, session.attemptsPerRound, session.currentAttempts, outcome, round])
```

`revealLineFor(reveal, pts, round)` is a small extracted helper holding the existing branches (skipped / correct / near / far). Same `MESSAGES.revealCorrect` / `revealNear` / `revealFar` strings — no new copy. The function is local to the file; no new module.

The render block (lines 62-70) is unchanged — it already renders `{revealLine && <div data-testid="game-reveal">...</div>}`. The `data-testid="game-reveal"` is now present during `playing` for best-of-N city, which existing e2e specs need to know about (see Testing).

### Why the helper

The existing inline branches reference `round.targetName`, `outcome.reveal.distanceKm`, `outcome.reveal.clickedPoint`, `outcome.pointsEarned`. The new "playing" branch needs the same shape but reads from `last.reveal` / `last.pointsEarned`. Extracting a `revealLineFor(reveal: PointReveal, pts: number, round: CityRoundSpec | null): ReactNode | null` removes duplication and keeps the gate readable.

### Why this doesn't double-render on round-ended

When `status` transitions `playing → round-ended`, the playing-branch condition becomes false (status check) and the round-ended branch takes over. They are mutually exclusive by the leading `status` check.

---

## Item 2 — Persistent intermediate marker (useRevealMapEffects)

### Where

- `src/game/hooks/useRevealMapEffects.ts` — the intermediate-flash `useEffect` (lines 271-363).

### What today

```ts
useEffect(() => {
  // anchor + early-returns ...
  if (last.reveal.kind === 'country') {
    // country: setFilter + setPaintProperty on hoverBorder, hold 600ms, then clear.
    return /* cleanup clears border + clears timeout */
  }
  // city: setData marker + setPaintProperty circle-color, hold 600ms, then clear.
  return /* cleanup clears sources + clears timeout */
}, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])
```

One effect with two branches sharing the 600ms timeout pattern. The anchor (`lastIntermediateAttemptCountRef`) skips re-firing on resume.

### What changes

Split into two effects with distinct invariants:

```ts
// Effect A — Country intermediate flash (UNCHANGED, just narrower scope)
// Status: 'playing', attemptsPerRound > 1, last attempt is COUNTRY, count increased.
// Behavior: paint hoverBorder, 600ms timeout, clear on cleanup. Anchor still skips
// resume replay. Identical to today, minus the city branch.

// Effect B — City persistent marker (NEW)
// Status: 'playing', attemptsPerRound > 1, currentAttempts.length > 0, last attempt
// is POINT. No anchor — the effect always reflects "show the marker for the latest
// attempt." On effect re-run (next click, status change), setData replaces with the
// new latest point. On status change out of 'playing', the round-ended geometry
// effect's setData overrides this marker; idle clear handles cleanup.
useEffect(() => {
  if (session.status !== 'playing') return
  if (session.attemptsPerRound <= 1) return
  if (!isCityGuessing(session.modeId)) return
  const last = session.currentAttempts[session.currentAttempts.length - 1]
  if (!last || last.reveal.kind !== 'point' || !last.reveal.clickedPoint) return
  const map = mapRef.current
  if (!map) return
  const d = last.reveal.distanceKm
  const colour = d < 50 ? REVEAL_CORRECT : d < 500 ? REVEAL_WRONG : REVEAL_FAR
  try {
    ensureRevealSources(map)
    const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
    markerSrc.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: last.reveal.clickedPoint },
          properties: { intermediate: true },
        },
      ],
    })
    map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', colour)
  } catch {
    /* style still resolving */
  }
  // No timeout, no cleanup-clear. Next effect run replaces via setData; the
  // round-ended geometry effect or idle-clear effect handle later teardown.
}, [session.status, session.attemptsPerRound, session.modeId, session.currentAttempts, mapRef])
```

The country flash stays in the original effect (renamed for clarity to e.g. `useCountryIntermediateFlash` block — but we keep it inline as one of the hook's named effects rather than extracting). The `lastIntermediateAttemptCountRef` and `prevStatusForIntermediateRef` refs continue to drive the country effect's "skip resume replay" logic. They are no longer used for city.

### Why no anchor for city

For country, the hover-border highlight is visually expensive: re-firing on resume would re-flash a country the user already saw flash, which is noise. For city, the marker is the _current state_ of "where you last clicked" — re-painting on resume restores that state. No replay problem; the marker simply re-appears at the right place.

### Resume case verified

1. User clicks twice, refreshes mid-round.
2. `useHashGameRouter` reads resume blob, dispatches `resume` action with `attempts: [a1, a2]`.
3. Status flips `idle → playing` with `currentAttempts.length === 2`.
4. Effect B fires (deps include `session.currentAttempts`), reads `last = a2`, paints the marker for a2.
5. User sees their last guess marked on the map. ✓

### Round-end transition verified

1. Click 3 dispatched: reducer transitions `playing → round-ended`, sets `lastOutcome.reveal = best.reveal`.
2. Effect B re-runs (status changed). Status check returns early; no setData call.
3. Round-end geometry effect (lines 104-267, unchanged) runs: `ensureRevealSources` + `markerSrc.setData(plan.to)` + arc setData + ease/jump. The marker at the _latest click point_ (a2) is overwritten with the marker at the _target city centroid_.
4. Arc animation runs from `plan.from` (best attempt's clickedPoint) to `plan.to` (target centroid). ✓

### Why marker color is set per-effect-run

In the original code, the 600ms cleanup resets `circle-color` to `REVEAL_WRONG`. With the persistent marker, the next click re-sets `circle-color` to its distance-banded value. Between clicks the color stays at the previous attempt's band — which is correct (it reflects the previous attempt's distance, not a stale "default amber"). On round-end, the round-end geometry effect doesn't repaint `circle-color` for its own target marker — the target marker inherits whatever color was last set. To avoid showing a "your last guess was bad-red" color on the _target_ marker, the round-end geometry effect must reset `circle-color` to `REVEAL_WRONG` (the documented default) when it sets its own marker. **One-line addition** in the round-end geometry effect's `markerSrc.setData` block.

---

## Item 3 — Overlay swap (GameController)

### Where

- `src/game/GameController.tsx` — the `session.status === 'game-over'` block (lines 146-154).

### What today

```tsx
{
  session.status === 'game-over' && (
    <GameOverOverlay
      session={session}
      personalBest={best}
      beatPersonalBest={beatPB}
      onPlayAgain={onPlayAgain}
      onBackToMap={onBackToMap}
    />
  )
}
```

Single overlay for every game-over (free + daily, both modes).

### What changes

Branch on (daily-city) vs (everything else):

```tsx
{
  session.status === 'game-over' &&
    (session.dailyDate !== null && isCityGuessing(session.modeId) ? (
      <DailyRevealOverlay
        date={session.dailyDate}
        modeId={session.modeId}
        puzzle={dailyPuzzles.byDate(session.dailyDate) ?? null}
        today={toLocalDateString(new Date())}
        countries={countries}
        cities={cities}
        onClose={onBackToMap}
        onPlayUnlimited={onPlayUnlimitedFree}
      />
    ) : (
      <GameOverOverlay
        session={session}
        personalBest={best}
        beatPersonalBest={beatPB}
        onPlayAgain={onPlayAgain}
        onBackToMap={onBackToMap}
      />
    ))
}
```

Where:

- `onClose` reuses `onBackToMap` (which clears resume + endGame + writes idle hash) — closing the reveal returns the user to the bare map, consistent with the existing reveal-route close behavior.
- `onPlayUnlimitedFree` is a new handler in `GameController` that mirrors `App.tsx`'s reveal-route `onPlayUnlimited` (line 538-544): tracks no event (the hash router's `free_started` fires on game boot), writes `#game/<modeId>` to the hash. The hash router then calls `restart(...)` from the existing game-over → playable-route branch (the bug-#32 atomic-restart path).
- `dailyPuzzles` is already in scope in `GameController` (line 51).
- `countries` and `cities` are already props of `GameController` (line 28-32).
- `toLocalDateString` is imported alongside the existing `clearResume` import.

### Esc / focus handling

`GameController`'s top-level Esc handler (lines 93-107) currently fires `endGame()` on Esc when `status !== 'idle'`. During `game-over` with the new `DailyRevealOverlay`, the overlay has its own modal Esc handler that calls `onClose` (line 53-55 of `DailyRevealOverlay`). Two Esc handlers will both fire on the same Esc keypress unless one stops propagation.

Resolution: narrow `GameController`'s Esc handler to skip when `status === 'game-over'`. `GameOverOverlay` doesn't have its own Esc handler today, but the `onBackToMap` button is the natural close affordance and Esc-to-close-game-over isn't an existing tested behavior (no `e2e/` spec asserts it). Adding the narrow is safe.

```ts
// Existing block, line 95:
if (session.status === 'round-ended' && isCountryPinning(session.modeId)) return
// Adds:
if (session.status === 'game-over') return // overlays own their own Esc
```

### History recording order verified

`useGameAnnouncements` (lines 143-168 of useGameAnnouncements.ts) records daily history _inside_ the `status === 'game-over'` block. The effect runs on the same render that transitions to game-over. `DailyRevealOverlay` reads from `useDailyHistory` on its first render, which is the same render. React renders parent before children, but effects fire post-render. Sequence:

1. Reducer transitions `round-ended → game-over` via `finalize()` (called from `useGameAnnouncements`'s `advanceNow`).
2. Re-render: `GameController` evaluates the new branch, mounts `DailyRevealOverlay`.
3. `DailyRevealOverlay` reads `history.days[date]['city-guessing']` — at this point the history store has NOT been written yet (the effect that writes it runs after render).
4. `useGameAnnouncements` effect fires, calls `recordDailyResult(...)`, which writes to the module-level store via `useSyncExternalStore`.
5. `DailyRevealOverlay` re-renders with the populated history.

This is the same render order `GameOverOverlay` lives with today (it also reads `dailyHistory` and re-renders when the store populates — the daily share block depends on it). No new race.

### Free-play unchanged

When `session.dailyDate === null`, the branch falls through to `GameOverOverlay` with `onPlayAgain` and `onBackToMap` exactly as today. The "Play again" button in `GameOverOverlay` calls `onPlayAgain` which calls `start(...)` for a fresh unlimited game. No regression.

---

## Edge cases & invariants

- **Round-end pause timing.** `useGameAnnouncements` schedules `finalize()` after `REVEAL_MS_CITY = 2000ms` (or `animatedMs` if the arc takes longer). This is preserved — the arc reveal + revealLine read first, _then_ the DailyRevealOverlay mounts. Trigger order unchanged.
- **Test seam `__funworldmap_game.finalize()`** still works; it dispatches `finalize` synchronously, transitioning to `game-over`, which mounts whichever overlay the branch selects.
- **Resume + game-over.** If a user resumes a daily city with 3 attempts already recorded, the resume reducer guard (`action.attempts.length >= action.attemptsPerRound`) returns state unchanged — but the daily history check in `useHashGameRouter` (line 157) already redirects 3-attempt-completed daily to the reveal route. Existing safe path.
- **DailyRevealOverlay close behavior.** Its existing `onClose` returns to the bare map (clears reveal hash). When invoked from game-over, we reuse `onBackToMap` which also writes the idle hash. The user lands on the bare map with no game/daily route — identical end state.
- **Telemetry.** No new events. `daily_completed` continues to fire from `useGameAnnouncements`. `daily_shared` continues to fire from the share block. `free_started` fires from the hash router when the user clicks "Play unlimited" in the reveal overlay (existing path).
- **A11y.** `DailyRevealOverlay` is already `role="dialog" aria-modal="true"` with focus trap and Esc handling. Replacing `GameOverOverlay` (also dialog + modal) for the daily-city path keeps modal semantics intact. Initial focus moves from `data-testid="game-over-play-again"` to `data-testid="daily-reveal-play-unlimited"` (or `daily-reveal-close` fallback) — both buttons present and labeled.

## Testing

### Unit / hook tests

- **`src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx`** (new file)
  - Renders no `data-testid="game-reveal"` during `playing` with `attemptsPerRound=1` (free city).
  - Renders no `data-testid="game-reveal"` during `playing` with `currentAttempts.length === 0` (best-of-N before any click).
  - Renders `data-testid="game-reveal"` with the latest attempt's distance + points during `playing` with `attemptsPerRound=3` and `currentAttempts.length >= 1`.
  - Renders `data-testid="game-reveal"` with the round-ended outcome's distance + points during `round-ended`.
  - Text content matches `MESSAGES.revealNear`/`revealFar`/`revealCorrect` strings.

- **`src/game/hooks/__tests__/useRevealMapEffects.test.tsx`** (update)
  - Existing "city intermediate flash" test (if present) → replace with: "city intermediate marker persists across attempts, no timeout clear" — assert `setData` is called once on attempt 1, again on attempt 2 (replacing), and no `setTimeout`-driven clear in between. (Use `vi.useFakeTimers()` and assert no setTimeout for the city branch.)
  - Add: "city intermediate marker re-paints on resume" — render with `status='playing'` and `currentAttempts=[a1, a2]` from initial state (simulating resume); assert `setData` is called with `a2.reveal.clickedPoint`.
  - Add: "round-end geometry effect resets circle-color to REVEAL_WRONG before setting target marker" (the one-line addition in Item 2).
  - Keep: country intermediate flash 600ms cleanup test (unchanged behavior).

- **`src/game/__tests__/GameController.test.tsx`** (update or add)
  - New: "daily city game-over renders DailyRevealOverlay, not GameOverOverlay"
  - New: "daily country game-over renders GameOverOverlay" (regression guard)
  - New: "free city game-over renders GameOverOverlay" (regression guard)

### E2E tests

- **`e2e/daily-city-*.spec.ts`** — audit all specs that match `data-testid="game-over"` after a daily city completion. Replace with `data-testid="daily-reveal"` and update the close/play-unlimited test seam IDs (`daily-reveal-close`, `daily-reveal-play-unlimited`).
- **`e2e/daily-city-feedback.spec.ts`** (new) — single golden path: load daily city, click off-target, assert `data-testid="game-reveal"` appears with "km off" text; click second time, assert text updated; complete (3rd click or Done), assert `daily-reveal` overlay mounts.
- **Other daily / free e2e specs** — no expected change since the branch only triggers for daily-city. Run the suite to confirm.

### Manual verification (per CLAUDE.md "test in browser")

The change is map + HUD + overlay — covered by the dev server. Run through the daily city flow once locally:

1. Open launcher → click daily city Play.
2. Click off-target → verify HUD text "X km off · +N points" appears and the marker stays visible.
3. Click second time → verify HUD text updates and marker moves to the new click.
4. Click third time → verify arc reveal + HUD text, then `DailyRevealOverlay` mounts after ~2s with city name, dot summary, share, and "Play unlimited" button.
5. Click "Play unlimited" → verify free city game starts and runs normally.
6. Refresh mid-attempt (after click 1 or 2) → verify the marker re-appears at the last click location and the HUD text reads from the persisted attempt.

## Doc updates

- **`docs/systems/daily-puzzle.md`** — under "Lifecycle" section 6 ("Reveal"), add a sentence: "Daily-city game-over renders `DailyRevealOverlay` directly (city's single-overlay flow); daily-country game-over renders `GameOverOverlay` with the share block."
- **`docs/systems/overview.md`** — no change (game architecture unchanged).
- **No new ADR.** The change is scoped + localized; the rationale lives here.

## Risk / rollback

- **Risk:** Low. Reducer untouched; map effect split is mechanical; overlay branch is a one-condition fork. The marker-persistence change could regress if a future feature mounts a different reveal layer that doesn't expect the marker to already be present — mitigated by Item 2's note on the round-end effect resetting `circle-color` and explicitly setting target marker data.
- **Rollback:** Revert any of the 3 commits independently. Commit 1 (persistence + HUD text) and commit 2 (overlay swap) are functionally independent — reverting one doesn't break the other.

## Out of scope

- Daily country mode changes.
- Free unlimited city mode changes (already 1-attempt with full reveal on each round).
- HUD layout / pip-indicator redesign (Approach C in brainstorming).
- Accumulating markers across attempts (Approach "Accumulate" in brainstorming).
- New analytics events.
