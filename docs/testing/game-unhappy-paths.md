# Game Unhappy-Path Test Scenarios

Date: 2026-05-11
Companion to: [`game-happy-paths.md`](./game-happy-paths.md)

> ⚠️ **Verification status (2026-05-11):** Most scenarios in this document are **design hypotheses derived from code reading, not from live observation**. The exceptions personally verified live are: D6/D7 (reducer rejects out-of-state submits — verified via test seam), F4 (last-life endsGame suppresses Continue panel — verified live in country pinning), the daily-route resume behavior (verified live).
>
> All of **section A (animations)** — red flash, dashed geodesic arc, globe rotation, panel slide-in timing — is hypothesized from CSS conventions and code structure. Before treating any "After" line in section A as a test contract, **observe the live behavior and update the line to match reality** (screenshots or video help). Sections C (storage), E (concurrency), and parts of F (boundary) are similarly speculative.
>
> The structure of this document — numbered user actions paired with observable post-conditions — is the artifact. The content needs validation. Treat unverified "After" lines as **questions to test**, not answers to assert.

This document describes **failure-mode and edge-case** user flows. If happy-paths.md says "what should happen when everything goes right," this file says "what should happen when something goes wrong, when the user does something unexpected, or when the environment is hostile."

Same structure as the happy-paths doc: numbered steps as short user-intent sentences with "After:" post-conditions. Tests derive observations from the "After" lines. A failure to match an "After" line is the bug.

Animations get a dedicated section because they are the most fragile happy-path component — they are wallclock-timed, GPU-dependent, interruptible, and reduce-motion-gated, and they are the user's primary "did the game work?" signal.

---

## Common preconditions (apply unless overridden)

- Browser supports WebGL2 (except for scenario set H).
- `localStorage` is empty (except for scenarios that seed it).
- Network reaches the dev/preview server (except for scenarios that simulate offline).
- A current daily puzzle exists in `/daily/index.json` (except scenarios that simulate missing content).
- Reduced-motion preference: assume "no preference" unless the scenario varies it.
- A game session has been started where needed; the preconditions on each scenario say which.

---

## A. Animation & reveal behavior

The reveal animation is the moment of feedback after a guess. It carries the gameplay's emotional payload. These scenarios verify the animations actually fire, that they end, and that they don't fire when they shouldn't.

### A1. Wrong country guess — country panel opens with the correct country

**Pre:** Free Country Pinning, `status=playing`, target is FRA.

1. **User clicks JPN on the map (or submits `JPN` via the seam).**
   - After: `lastOutcome.reveal.kind === 'country'`, `correct: false`, `clickedCca3='JPN'`, `targetCca3='FRA'`.
   - After: The **JPN polygon flashes red/wrong-color** and stays highlighted for the duration of the reveal hold.
   - After: The **FRA polygon highlights green/correct-color**.
   - After: The country panel slides in (`role="complementary"`) populated with FRA's data: flag, name, capital, region, neighbors.
   - After: A "Continue" button is focusable and visible inside the panel.
   - After: HUD reveal line reads "Wrong — that was Japan. +X points. The answer was France. −1 life."
   - After: No auto-advance occurs even after 10 s. Game waits for Continue.

### A2. Correct country guess — auto-advance with no panel

**Pre:** Free Country Pinning, `status=playing`, target is FRA.

1. **User clicks FRA.**
   - After: FRA polygon highlights as correct (no wrong-flash).
   - After: HUD reveal line: "Correct! +100 points. That was France."
   - After: No country panel opens (mid-game; correct guesses are pure HUD).
   - After: ~3.0-3.5 s later, session transitions back to `playing` with the next target. The HUD prompt updates atomically with the transition.

### A3. City guess — dashed geodesic arc from click to target

**Pre:** Free City Guessing, `status=playing`, target Shenzhen at `[114.06, 22.55]`.

1. **User clicks somewhere far (e.g. `[-100, 40]`).**
   - After: A **dashed line (geodesic arc)** animates on the map from the click point to the target city centroid.
   - After: A **target marker** appears at the city centroid.
   - After: The animation duration is ≤ 2 s; on completion the arc remains visible until next round.
   - After: HUD reveal line: "Far — 12,000 km. That was Shenzhen." (or "Near" if < 1000 km, "Spot on!" if < 1 km).
   - After: Auto-advance to next round at ~200-300 ms after animation completes (no Continue button for city mode).

### A4. City skip — no arc, marker only

**Pre:** Free City Guessing, `status=playing`, "Skip" button visible.

1. **User clicks "Skip".**
   - After: `lastOutcome.reveal.clickedPoint === null`.
   - After: **No dashed arc** is drawn (nothing to draw from).
   - After: The target marker still appears at the city centroid for the reveal hold.
   - After: HUD reveal line: "Skipped. <City> was there."
   - After: `pointsEarned: 0`. Auto-advance.

### A5. Globe rotates toward the reveal target

**Pre:** Free Country Pinning, target is on the opposite side of the world from the current camera (e.g. camera at Tuvalu, target Iceland).

1. **User submits a wrong guess (any cca3 ≠ ISL).**
   - After: The map smoothly pans/rotates from the current center toward the **midpoint of the click point and the target** (or directly toward the target — verify which the design intends).
   - After: The pan duration matches `REVEAL_MS_COUNTRY` (~1.2 s visual or ~3 s hold, whichever the design pins).
   - After: At end of pan, both the wrong (red) and correct (green) polygons are within the viewport.

### A6. Reduced motion: animations skip, gameplay still works

**Pre:** Browser has `prefers-reduced-motion: reduce`. Free Country Pinning, `status=playing`.

1. **User submits a wrong guess.**
   - After: Polygon highlight applies **instantly** (no fade).
   - After: Map camera **cuts** to the reveal viewport (no pan animation).
   - After: Country panel **appears without slide** (no transform animation).
   - After: HUD reveal line text appears immediately.
   - After: All reducer state transitions are identical to the unreduced case — only the visual gating differs.

2. **Same user, City Guessing, submits a wrong guess.**
   - After: **No dashed-arc animation**. The arc either renders instantly to its end state or is replaced by a static line/marker pair.
   - After: Auto-advance happens at the same wallclock time as the unreduced case (the reducer doesn't speed up; only the paint).

### A7. Animation interruption — rapid Continue

**Pre:** Free Country Pinning, `status=round-ended` after a wrong guess. Country panel slide-in animation is mid-flight (within 300 ms of round-end).

1. **User clicks Continue before the slide-in completes.**
   - After: The panel slide-in animation **cancels cleanly** (no visual stutter, no leftover panel).
   - After: Session transitions to `playing` with next round.
   - After: No console errors. No half-rendered DOM.

### A8. Animation interruption — Escape mid-reveal

**Pre:** Free Country Pinning, mid-reveal animation (after a correct guess, before auto-advance).

1. **User presses Escape.**
   - After: `endGame` dispatches (or end-game confirm opens — see scenario E1). Either way, the in-progress reveal animation aborts.
   - After: Map returns to a sensible state (default view or current view, not stuck mid-pan).
   - After: No reveal artifacts (highlight, arc, marker) remain on screen.

   **2026-05-13 update:** The "After" lines above are incorrect for the country-pinning mode. In country-pinning, `status=round-ended` + Escape is handled by `holdThenAdvance` (`GameController.tsx:51-64`), which **advances to the next round** rather than ending the game. `endGame` is NOT dispatched. The global exit handler explicitly excludes this sub-state (see E1 update). For correct-guess reveals specifically (no panel, auto-advance hold), Escape short-circuits the ~3 s hold and transitions immediately to `status=playing, roundIndex+1`.

### A9. Animation completes — `data-animation-state="idle"` is set

**Pre:** Animated component (`Launcher`, `SingleCountryPanel`, `LauncherMilestoneOverlay`).

1. **User triggers a state change that begins an animation.**
   - After: Component's `data-animation-state` attribute is `entering`.
   - After: When all CSS animations on the element and its descendants finish, the attribute flips to `idle`.
   - After: The flip is observable to tests via `waitForAnimationIdle(locator)` (`e2e/helpers.ts:459`).
   - After: If `getAnimations()` returns no animations, attribute is `idle` within the first frame (no infinite "entering").

### A10. Reveal animation timing — observable invariant

**Pre:** Free Country Pinning, post-correct-guess.

1. **User does not press any key.**
   - After: At t ≈ 1.2 s, the polygon highlight peaks (configurable via `REVEAL_MS_COUNTRY=1200`).
   - After: At t ≈ 3.0-3.5 s, the reducer dispatches `advance` and HUD shows the next round's prompt.
   - After: For Daily Country Pinning final-attempt, `finalize` dispatches in the same window and game-over overlay mounts.
   - After: For Free City Guessing, auto-advance happens around t ≈ 200-300 ms (no extended hold).
   - After: For Daily City Guessing final-attempt, `finalize` dispatches at t ≈ 1.5 s.

---

## B. Network & content failures

### B1. Daily index missing or stale

**Pre:** `/daily/index.json` has no entry for today. (Example: local dev with a 4-day-old generated file.)

1. **User opens `/`.**
   - After: Launcher renders.
   - After: Both mode cards show **"Today's puzzle isn't ready yet"** state.
   - After: A fallback link **"Try May 7's daily →"** (or whichever is the latest available date) points to `#daily/<latest>/reveal`.
   - After: "Play free" link is still functional on each card.
   - After: Streak pill is still rendered with current/longest from history.
   - After: No console errors, no crash.

### B2. Daily index 404 or network error

**Pre:** Block `/daily/index.json` at the network layer.

1. **User opens `/`.**
   - After: Launcher renders.
   - After: Daily cards show `unavailable-error` state (distinguishable from `no-puzzle-today`).
   - After: "Play free" links are still functional.
   - After: No error toast bubbles up to the page (the failure is local to the launcher).

### B3. Basemap tiles unreachable

**Pre:** Block OpenFreeMap CDN.

1. **User opens `/`.**
   - After: Map canvas mounts.
   - After: A "basemap unavailable" banner or fallback message renders (see `BasemapBanner.tsx`).
   - After: Country polygons render from bundled TopoJSON.
   - After: Game flows (free, daily) still work.

### B4. Country GeoJSON fails to load

**Pre:** Force `world-atlas/countries-10m.json` chunk to fail (e.g. block via DevTools network throttling, or corrupt the cache).

1. **User opens `/`.**
   - After: Map basemap renders.
   - After: Country polygons do not render.
   - After: An error state appears: "Country data unavailable." (`overview.md:113-114`).
   - After: Search and panel are non-functional.
   - After: Free-play card "Play free" button is disabled or starting a game shows a graceful error rather than a blank HUD.

### B5. Analytics endpoint fails

**Pre:** Block `funworldmap.com/api/event`.

1. **User completes a daily.**
   - After: Game-over overlay mounts normally.
   - After: Failed analytics POSTs are silently dropped (`lib/analytics.ts:46-61`).
   - After: No banner, no console error, no impact on gameplay.

### B6. News JSON for a country 404s

**Pre:** User opens panel for a country with no `news/<cca3>.json` file.

1. **User opens the panel.**
   - After: Panel renders all non-news fields.
   - After: News section either shows "No recent news" or is omitted entirely. No spinner-forever.

---

## C. Storage failures

### C1. Corrupted daily history blob

**Pre:** `localStorage['funworldmap-daily-history'] = '{not json'`.

1. **User opens `/`.**
   - After: `readHistory` (`game/daily/storage.ts:18`) catches the parse error.
   - After: Launcher renders with `streakMode: 'first'` (history reset to empty).
   - After: Daily cards show `unplayed` state for today.
   - After: 🟠 **Risk per prior audit:** no Sentry breadcrumb is emitted — corruption is invisible to ops.

### C2. Daily history version mismatch

**Pre:** `localStorage['funworldmap-daily-history'] = '{"version":99,...}'`.

1. **User opens `/`.**
   - After: Version gate (`daily-puzzle.md:41`) rejects unknown version, history resets to empty.
   - After: Same render as C1.

### C3. Stale resume blob (yesterday's date)

**Pre:** `localStorage['funworldmap-daily-resume'] = {version:1, date:'2026-05-10', modeId:'country-pinning', attempts:[…]}` while today is 2026-05-11.

1. **User opens `#daily/2026-05-11/country-pinning`.**
   - After: Resume code sees the date mismatch, ignores the stale blob, and starts a fresh round.
   - After: Stale blob is removed from `localStorage` after read.
   - After: `attemptsRemaining=3`, `currentAttempts=[]`, target is today's puzzle.

### C4. Resume blob for a mode the user is not in

**Pre:** `localStorage['funworldmap-daily-resume'] = {…, modeId:'city-guessing', attempts:[…]}`. User navigates to `#daily/2026-05-11/country-pinning`.

1. **User opens that hash.**
   - After: Resume is **not applied** (mode mismatch).
   - After: Country-pinning starts fresh.
   - After: City-guessing's resume blob is preserved (in case the user opens that mode next).

### C5. `localStorage` is disabled (private mode, Safari ITP, etc.)

**Pre:** `localStorage.setItem` throws.

1. **User plays a daily.**
   - After: Each attempt write fails silently (write-side catch is acceptable per `daily-puzzle.md`).
   - After: Refresh mid-game **does not resume** — game restarts from scratch (acceptable degradation).
   - After: After completion, history doesn't persist; on next open, card shows `unplayed`.
   - After: 🟠 **Risk per prior audit:** no error surfaced to the user explaining that streaks won't persist.

### C6. `localStorage` quota exceeded mid-write

**Pre:** localStorage near quota.

1. **User completes a daily that would trigger a write.**
   - After: Write fails; catch swallows the exception.
   - After: Game-over overlay still renders with this run's score.
   - After: Streak does not increment.
   - After: Next page open shows card as `unplayed`. User retries; same failure.
   - After: 🟠 **Risk:** no user-facing signal of the persistence failure.

### C7. History entry exists but is malformed

**Pre:** `history.days['2026-05-11']['country-pinning'] = { score: 'oops' }` (string instead of number).

1. **User opens `/`.**
   - After: Either the corrupted day is treated as unplayed, or the entire history resets. Either is acceptable.
   - After: No crash.

---

## D. Invalid input & hash

### D1. Future-dated daily hash

**Pre:** Today is 2026-05-11. URL hash = `#daily/2026-12-31/country-pinning`.

1. **User opens the URL.**
   - After: Per `daily-puzzle.md:94` ("future → redirect to root"), hash clears to `#`.
   - After: Launcher opens.
   - After: No error toast.

### D2. Past-dated daily hash, never played

**Pre:** Today is 2026-05-11. URL hash = `#daily/2026-04-15/country-pinning`. No history for that day.

1. **User opens the URL.**
   - After: Per `daily-puzzle.md:94` ("past or already-played → redirect to .../reveal"), hash becomes `#daily/2026-04-15/country-pinning/reveal`.
   - After: Reveal overlay shows the puzzle's correct answers for that day.
   - After: User cannot replay the past day.

### D3. Invalid daily date format

**Pre:** URL hash = `#daily/not-a-date/country-pinning`.

1. **User opens the URL.**
   - After: Hash is rejected silently, redirects to `#` (launcher).
   - After: No crash.

### D4. Invalid mode in daily hash

**Pre:** URL hash = `#daily/2026-05-11/space-invaders`.

1. **User opens the URL.**
   - After: Hash is rejected, redirects to launcher anchored at the date (`#daily/2026-05-11`) per `daily-puzzle.md:93`, or to bare `#`.
   - After: No crash.

### D5. Country deep-link with invalid cca3

**Pre:** URL hash = `#XYZ`.

1. **User opens the URL.**
   - After: Per `overview.md:111`, `byCca3` lookup returns no match; hash is silently cleared.
   - After: No country selected, default view shown.

### D6. Submit guess when status is `idle`

**Pre:** No game started.

1. **Test seam dispatches `submitGuess({…})`.**
   - After: Reducer rejects (`useGameSession.ts:103`: `if (state.status !== 'playing') return state`).
   - After: No state change. No reveal. No score.

### D7. Submit guess when status is `round-ended`

**Pre:** Country mode, last attempt has fired, country panel is open awaiting Continue.

1. **Test seam dispatches a second `submitGuess(…)` without clicking Continue.**
   - After: Reducer rejects. State unchanged. No double-scoring.

### D8. `completeNow` called with 0 attempts in daily mode

**Pre:** Daily Country Pinning, `status=playing`, `currentAttempts.length=0`.

1. **Test seam dispatches `completeNow`.**
   - After: Reducer rejects (`useGameSession.ts:125-126`: requires `attemptsPerRound > 1` and `currentAttempts.length > 0`).
   - After: State unchanged.

### D9. `restart` with `attemptsPerRound > 1 && maxRounds === null`

**Pre:** Any state.

1. **Test seam dispatches `restart(modeId, round, null, 3)`.**
   - After: Reducer rejects (`useGameSession.ts:198-202`), logs error.
   - After: State unchanged.

### D10. Hash mutated mid-game (e.g. user pastes a new hash into the address bar while playing)

**Pre:** Daily Country Pinning, `attemptsRemaining=1`, mid-round.

1. **User types `#game/city-guessing` into the URL bar.**
   - After: Session transitions to a fresh city-guessing free-play game (per `restart` action, which the controller dispatches to avoid the bug-#32 race).
   - After: The in-progress daily attempt is **lost**, resume blob is **not** preserved (because game ended without completion).
   - After: 🟠 **Possible bug surface** — verify whether the resume blob is cleared correctly (it should be, per `daily-puzzle.md:83`).

   **2026-05-13 update:** The hashchange bootstrap handler (`GameController.tsx:271-295`) only re-routes when `statusRef.current === 'idle'`. Hash mutations during `playing` or `round-ended` are **silently ignored** — no mode switch occurs. The `wasGameOver` atomic-restart path (`GameController.tsx:204`) only handles `game-over → playable-route`, not `round-ended → playable-route`. Consequently, the "After" lines above describe an aspirational contract, not current behaviour. This is a documented gap, not an intentional design choice. A test asserting the mode switch was dropped (see `e2e/animation-interrupt.spec.ts` history) because the code doesn't support it.

---

## E. Concurrency & race conditions

### E1. Escape mid-game

**Pre:** Free Country Pinning, `status=playing`.

1. **User presses Escape.**
   - After: Either an "End game?" confirm dialog opens, or `endGame` dispatches directly.
   - After: If confirmed: session → `idle`, hash returns to `#`, launcher reopens, map camera flies to default view.
   - After: If a confirm dialog: focus moves to the dialog, second Escape dismisses (does NOT end game), Enter on the confirm button ends.

   **2026-05-13 update:** The global Escape handler (`GameController.tsx:767-783`) covers `status=playing` as described. However, it **explicitly excludes** the `round-ended + country-pinning` sub-state from this exit path (see comment at `GameController.tsx:407`). In that sub-state, Escape is handled by `holdThenAdvance` (`GameController.tsx:51-64`), which **skips the reveal hold and advances to the next round** — it does NOT abort to the launcher. The "After" lines above apply only when `status=playing`, not when `status=round-ended`.

### E2. Rapid double-submit (the bug-#32 territory)

**Pre:** Free Country Pinning, `status=playing`, `roundIndex=0`.

1. **Test fires two `submitCountryGuess(targetCca3)` calls within 16 ms.**
   - After: Only **one** attempt is recorded. The second is rejected because the first transitioned to `round-ended` (the reducer guard at `useGameSession.ts:103-104`).
   - After: Score reflects only one round's points.
   - After: No duplicate reveal animation. No double-counted streak.

### E3. Mode switch from game-over (bug #32 origin)

**Pre:** Free Country Pinning, `status=game-over`, overlay mounted.

1. **User clicks a different mode (e.g. via launcher → city-guessing daily, or by hash mutation).**
   - After: Reducer dispatches `restart` (single tick), **not** `endGame` + `start` (two ticks). This avoids the intermediate `status='idle'` render that unmounts the HUD between dispatches.
   - After: City-guessing game starts cleanly; no HUD flicker.
   - After: `lastOutcome` from the old game is cleared.

### E4. Refresh during reveal hold

**Pre:** Free Country Pinning, mid-reveal animation (post-correct).

1. **User reloads the page (F5).**
   - After: Free-play state is not persisted; game restarts from `idle` → launcher.
   - After: 🟠 **Bug 1 from divergence report:** for free-play hash on fresh load, no game bootstraps — user sees blank map with no launcher.

### E5. Refresh during daily reveal (after 3 attempts, before finalize)

**Pre:** Daily Country Pinning, `status=round-ended`, post-final-attempt, before `finalize` fires (within ~3 s window).

1. **User reloads the page.**
   - After: On reload, `useDailyHistory` checks for an entry for today + mode. If it was already written (resume code wrote after the third attempt), card shows `played` and route redirects to `/reveal`.
   - After: If the entry was NOT written (very tight race), the resume blob may still be present; on reload, resume restores the 3-attempt state and the user re-finalizes.
   - After: 🟠 **Audit risk:** verify the order of operations: write history → clear resume → dispatch finalize. If write/clear is post-finalize, refresh in the gap could lose the result.

### E6. Tab backgrounded mid-reveal

**Pre:** Free City Guessing, mid-reveal animation. User switches tabs for 30 s, then returns.

1. **User refocuses the tab.**
   - After: Animations may have paused or run to completion; reducer state is whatever it would have been at wallclock-now.
   - After: HUD reflects current state correctly (next round target if advance fired during background).
   - After: No console errors.

### E7. Same daily completed twice in one session

**Pre:** Daily Country Pinning completed today.

1. **User opens `#daily/2026-05-11/country-pinning` again.**
   - After: Per `daily-puzzle.md:94`, hash redirects to `.../reveal`.
   - After: User cannot dispatch `start` for the same daily.
   - After: If the user somehow forces a `start` via the test seam: a second history entry should NOT overwrite the first (verify guard in `writeHistory`).

---

## F. Boundary conditions

### F1. All three daily attempts wrong

**Pre:** Daily Country Pinning, target FRA.

1. **User submits 3 wrong cca3 values (e.g. JPN, BRA, CAN).**
   - After: After attempt 3, `round-ended` triggers with `endsGame=true`.
   - After: Score = best of the three (highest partial-points attempt).
   - After: History entry records all 3 attempts with their distances.
   - After: Streak **does not increment** (best attempt < 100 points).
   - After: Game-over overlay shows the partial score, NOT a "you failed" message — daily is a partial-credit puzzle.

### F2. Done early after attempt 1

**Pre:** Daily City Guessing, attempt 1 submitted (any quality).

1. **User clicks the "Done" button.**
   - After: A confirm dialog opens with two options: "Use remaining attempts" and "Done anyway".
2. **User clicks "Use remaining attempts".**
   - After: Dialog dismisses. Game continues with attempts 2 available. Focus returns to the previously-focused HUD element.
3. **(Alt) User clicks "Done anyway".**
   - After: `completeNow` dispatches. Round ends with the best of the recorded attempts. Game-over flow proceeds normally.

### F3. Done early with 0 attempts

**Pre:** Daily Country Pinning, `attemptsRemaining=3`, `currentAttempts=[]`.

1. **User tries to click "Done".**
   - After: The Done button is either **hidden** or **disabled** before any attempt has been recorded. If the user reaches it programmatically, `completeNow` is rejected at the reducer level (D8).

### F4. Last-life wrong in free country-pinning

**Pre:** Free Country Pinning, `lives=1`, target FRA.

1. **User clicks a wrong country.**
   - After: `lives=0`, `livesDelta=-1`, `endsGame=true`.
   - After: Per Scenario 1 Step 7 (happy paths): country panel **does NOT open** with Continue (because endsGame supersedes the wrong-guess-Continue flow).
   - After: Auto-transition to game-over at ~3 s.
   - After: Game-over overlay shows. No stuck "Continue" state.
   - After: 🟠 **Edge to verify:** my divergence walkthrough did not observe whether the Continue/panel flow is suppressed when `endsGame=true`. The reducer treats them identically; the UI must distinguish.

### F5. Streak rollover at UTC midnight

**Pre:** User completed yesterday's daily, current streak = 5. It is now 23:55 UTC.

1. **User waits 10 minutes, then opens `/`.**
   - After: Today is now 2026-05-12 (UTC). Launcher's `today` recomputes via `toLocalDateString(new Date())`.
   - After: 🟠 **Known limitation per `daily-puzzle.md:127-129`:** East-of-UTC users up to +14 h may see "yesterday" until UTC rolls over. Document, not bug.
   - After: Streak is preserved until a full day is missed.

### F6. Streak broken (skipped a day)

**Pre:** User played 2026-05-09, missed 2026-05-10, opens 2026-05-11.

1. **User opens `/`.**
   - After: `streakMode === 'broken'` (lastActiveDate < yesterday).
   - After: Streak pill renders the "broken" state visually (distinct from active/first).
   - After: Playing today's daily resets streak to 1, not 0+1.

### F7. Milestone day (e.g. day 3, 7, 14)

**Pre:** User completes their 3rd consecutive daily.

1. **After game-over, user clicks "Back to launcher".**
   - After: `LauncherMilestoneOverlay` mounts on top of the launcher.
   - After: Overlay traps focus.
   - After: Dismissing it sets `lastMilestoneShown` so it does not re-appear next session.
   - After: `streak_reached_milestone` event fires exactly once for this milestone.

### F8. Game-over fires while reveal panel is still animating in

**Pre:** Free Country Pinning, last life, wrong final guess.

1. **At t=0, user submits wrong guess.**
   - After: At t=300 ms, country panel slide-in animation is in progress.
   - After: At t≈3 s, `finalize` dispatches, game-over overlay mounts on top.
   - After: The country panel beneath should either: (a) close cleanly, (b) be visually preserved but inert. No half-rendered state.

---

## G. Browser environment

### G1. WebGL2 not supported

**Pre:** Browser does not support WebGL2 (`maplibregl.supported()` returns false).

1. **User opens `/`.**
   - After: Map canvas does not initialize.
   - After: An error overlay renders with "browser upgrade guidance" (`overview.md:110`).
   - After: Launcher is NOT shown (or is shown with the game CTAs disabled — verify which).
   - After: No silent crash.

### G2. WebGL context lost mid-game

**Pre:** Free Country Pinning, mid-round. Force `webglcontextlost` event.

1. **GPU/driver issues a context-loss event.**
   - After: `MapErrorOverlay` renders with reason `webgl-lost` (`useMapInstance.ts:161-217`).
   - After: HUD is hidden or overlaid.
   - After: After ≤ 1 s, restore is attempted (`useMapInstance.ts:222-241`).

2. **Context restores successfully.**
   - After: Map re-mounts, country polygons re-render.
   - After: Game session state is preserved (the reducer didn't lose anything during the GPU outage).
   - After: User can continue playing from where they were.

3. **Context fails to restore.**
   - After: Page reload is offered as recovery.

### G3. Theme toggle mid-game

**Pre:** Free Country Pinning, `status=playing`, light theme.

1. **User clicks theme-toggle button.**
   - After: `<html>` class flips to dark.
   - After: MapLibre paint properties re-apply.
   - After: Reveal animation, HUD, panel, button colors all switch consistently.
   - After: No game-state interruption.

### G4. Reduced-motion preference toggled mid-game

**Pre:** Free Country Pinning, mid-reveal animation, reduced-motion was OFF.

1. **OS-level reduced-motion is enabled while the reveal is animating.**
   - After: In-flight animations are not retroactively shortened (browsers don't fire mid-animation).
   - After: The NEXT animation respects the new preference.
   - After: No crash, no console error.

### G5. Color-scheme preference toggled mid-game

**Pre:** Theme is set to "system". OS-level dark-mode is toggled mid-game.

1. **OS switches color scheme.**
   - After: `prefers-color-scheme` media query fires.
   - After: `<html>` class updates.
   - After: Map paint and UI colors re-apply.
   - After: No game-state interruption.

### G6. Tab visibility / suspend

**Pre:** Free City Guessing, `status=playing`. User switches to another tab and the OS suspends the browser tab.

1. **User returns to the tab after 10 minutes.**
   - After: Game state is exactly as it was at suspend time.
   - After: Any in-flight animation either: (a) resumed and completed during background, (b) was cancelled, (c) is still mid-animation. Test should not assume.
   - After: User can submit a new guess and the reducer behaves normally.

### G7. Window resize (mobile orientation change)

**Pre:** Mobile viewport, panel open in bottom-sheet mode (`< 1024px`).

1. **User rotates device to landscape, viewport becomes `> 1024px`.**
   - After: Panel transitions from bottom-sheet to sidebar layout.
   - After: No content lost.
   - After: Focus is preserved on whatever element was focused.

### G8. Map click coordinate at -180/+180 longitude wrap

**Pre:** Country mode, map panned so longitude=180 is on screen.

1. **User clicks a country near the antimeridian (e.g. Fiji or Russia).**
   - After: `queryRenderedFeatures` returns the correct country.
   - After: Score and reveal apply normally — no off-by-360 distance computation.

---

## H. Accessibility-specific unhappy paths

### H1. Screen reader announces reveal

**Pre:** NVDA / VoiceOver active. Free Country Pinning, just submitted wrong guess.

1. **Reveal fires.**
   - After: Live region (`role="status"` on `[data-testid="game-reveal"]`) announces the reveal line.
   - After: Country panel heading is reachable via Tab.
   - After: Continue button is reachable and announces correctly.

### H2. Keyboard-only player completes a daily

**Pre:** No mouse. Daily Country Pinning. User uses keyboard to drive the map (arrow keys + Enter).

1. **User navigates to a country via search.**
   - After: Search dropdown opens.
   - After: ArrowDown moves through options, Enter selects.
   - After: Selection submits as a country guess.
   - After: Continue button is reachable via Tab from the HUD.
   - After: Player can complete the full game without ever clicking the map canvas.

### H3. Focus management on game-over

**Pre:** Game-over overlay just mounted.

1. **Overlay enters.**
   - After: Focus moves to "Play again" (or "Back" if Play Again is hidden in daily mode).
   - After: Focus is trapped within the overlay.
   - After: Tab cycles among the overlay's buttons only.
   - After: Escape closes the overlay (returns to launcher).

### H4. Forced colors / Windows high-contrast mode

**Pre:** Windows high-contrast mode is on.

1. **User opens `/` and starts a game.**
   - After: All interactive elements have visible focus indicators using system colors.
   - After: Map reveal highlights still distinguish correct/wrong (e.g. via patterns or system-color overrides, not just opacity).
   - After: 🟠 **Known gap per prior audit:** no `forced-colors` CSS rules exist; this scenario likely surfaces bugs.

### H5. Excessive zoom / reflow

**Pre:** Browser zoom at 200% or 400%.

1. **User opens `/`.**
   - After: Layout reflows; no horizontal overflow on mobile widths.
   - After: All buttons remain clickable; no overlap.
   - After: Modal dialogs (launcher, milestone overlay) stay within the viewport.

---

## I. Telemetry & observability

### I1. Telemetry endpoint slow but succeeds

**Pre:** Analytics endpoint takes 3 s to respond.

1. **User completes a daily.**
   - After: Game UI is not blocked on the POST.
   - After: Event is sent via `navigator.sendBeacon` if available, else `fetch` with `keepalive`.

### I2. Page closes mid-event

**Pre:** User closes the tab immediately after game-over.

1. **Page unloads.**
   - After: `daily_completed` event sent via `sendBeacon`, survives the unload.
   - After: 🟠 **Verify:** `lib/analytics.ts:46-61` actually uses `sendBeacon` for the final event.

### I3. Sentry breadcrumb on rare events

**Pre:** A rare client-side error occurs (e.g. unhandled rejection during reveal).

1. **Error fires.**
   - After: Sentry captures it (DSN configured at build time).
   - After: 🟠 **Known gap per prior audit:** localStorage corruption paths (`storage.ts`/`resume.ts`) currently do NOT emit Sentry breadcrumbs. This is a separate fix.

---

## How to use this document

These scenarios are intentionally adversarial. For each:

1. **Verify the "After" lines describe the intended graceful degradation.** Some are "we don't care if X happens, just don't crash"; others are "the user must see Y feedback." Treat each "After" line as a contract.
2. **Treat 🟠 markers as known/suspected risks.** They cross-reference the divergence report and prior assessment. Do not let them creep into the silent-failure category.
3. **Animations especially:** write tests that wait on `data-animation-state="idle"`, not on a hardcoded duration. The CLAUDE.md e2e rules already require this.
4. **For each bug found** when running these scenarios, file: scenario ID (e.g. A3), expected "After" line that was missed, observed behavior, and the commit SHA.

The unhappy-path coverage gap is largest in **A (animations)** and **C (storage)**. The happy-path coverage gap is largest in **deep-link routing** (Bug 1 from the divergence report). Both should drive the next round of e2e additions.
