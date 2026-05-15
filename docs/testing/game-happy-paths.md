# Game Happy-Path Test Scenarios

Date: 2026-05-11

This document describes the **designed** user flow for each playable mode. It is the upstream artifact for test plans: each numbered step is a short user-intent sentence, paired with the observable outcome the system is supposed to produce. From these flows, concrete test steps (Playwright, manual QA, screen-reader smoke) are derived.

If actual behaviour diverges from any "After" line below, that is the bug. The reference behaviour is the design as encoded in `src/game/shared/useGameSession.ts`, the mode modules under `src/game/modes/`, and `docs/systems/daily-puzzle.md`.

---

## Common preconditions (apply to all scenarios)

- Browser supports WebGL2. MapLibre canvas renders without an error overlay.
- `localStorage` is empty for `funworldmap-*` keys (clean slate). Tests that depend on prior state must seed it via `seedDailyHistory` rather than relying on session leak.
- Reduced-motion preference: assume "no preference" unless a scenario explicitly varies it.
- Network: basemap tiles available; `/daily/index.json` returns a valid puzzle for the test date; flag SVGs reachable.
- The dev/preview server is at `/`. The hash fragment encodes the route.

---

## 1. Free Play — Country Pinning

**Goal:** Identify a sequence of countries by clicking the correct polygon on the map. Three lives, unlimited rounds, game-over when lives reach 0.

### Pre

- Hash is empty or `#`. Launcher is the foreground element.
- Pool of countries is loaded (countries.length > 0).

### Steps

1. **User opens the page on `/`.**
   - After: Launcher dialog is visible. Two mode cards render. Focus lands on the first daily CTA (or first free-link if no daily today). Map is rendered behind a dimmed backdrop.

2. **User clicks the "Play free" link on the Country Pinning card.**
   - After: Hash becomes `#game/country-pinning`. Launcher unmounts. HUD shows a target flag + country name. Map remains in its current camera (no fly-to). Session: `status=playing`, `lives=3`, `attemptsPerRound=1`, `maxRounds=null`, `roundIndex=0`.

3. **User clicks on the correct country on the map.**
   - After: Session transitions `playing → round-ended`. Score increases by points earned (100 for an exact match). Streak increments. The correct country's border is highlighted (reveal animation). HUD shows a "correct" reveal line. Country panel is **not** opened (mid-game; panel is a post-reveal artifact only).

4. **User presses Enter (or waits ~3 s).**
   - After: Reveal animation ends. Session advances `round-ended → playing` with the next round. HUD updates to show the new target flag + name. Lives unchanged at 3.

5. **User clicks the wrong country (a country other than the target).**
   - After: Score increases by partial points (distance-weighted, see `country-pinning/scoring.ts`, decay over 3000 km). Streak resets to 0. Lives decrement by 1 (`livesDelta=-1`). HUD shows a "wrong" reveal line naming both the target and the clicked country. Wrong country is highlighted in the reveal.
   - After: **The country panel slides in populated with the correct country's data** (flag, name, capital, region). A **"Continue" button** is rendered inside the panel.
   - After: **There is no auto-advance.** The game stays in `round-ended` until the user clicks Continue. (Verified live 2026-05-11: waited 15 s with no transition; pressing Enter / Space had no effect.)

6. **User clicks Continue.**
   - After: Session advances `round-ended → playing` with the next round. Panel unmounts. HUD updates to the new target.

7. **User clicks on water/ocean (no country under the click).** *[Not personally verified — design intent.]*
   - After: No round transition. No score change. No lives lost. Reveal does not fire. HUD is unchanged. (Map click with `queryRenderedFeatures` returns no country layer match → ignored.)

8. **User repeats steps 3-6 until lives = 0.**
   - After: Final wrong guess triggers `endsGame=true`. **The Continue-panel flow is suppressed in this terminal case** — auto-transition to `game-over` fires at ~3 s with no user input required. (Verified live 2026-05-11: lives 1→0 wrong guess produced game-over overlay at ~3 s.)

9. **Game-over overlay is shown.**
   - After: Overlay displays total score, best streak this session, and (if applicable) a new personal-best badge. Focus is on the "Play again" button. "Back" button is reachable by Tab.

10. **User clicks "Play again".**
    - After: Reducer dispatches `restart` (single tick, no intermediate idle). Map camera flies back to the default view. New round begins from `roundIndex=0`. Session is identical in shape to Step 2's post-state.

11. **User clicks "Back" instead.** *[Not personally verified.]*
    - After: `endGame` dispatched. Hash returns to `#`. Launcher reopens. Map camera flies back to the default view.

### Negative-path notes (still part of the happy-path contract)

- During play, pressing Escape opens an "End game?" confirm or directly dispatches `endGame` (depending on the launched flow). Either way, the user returns to the launcher without errors.
- Closing a country panel while a round is in progress does **not** end the round; the panel is a side artifact.

---

## 2. Free Play — City Guessing

**Goal:** Guess the location of a named city by clicking the map. Up to 10 rounds. The click is scored by distance to the true city centroid (any point on the globe is a valid input — ocean clicks count).

### Pre

- Cities pool loaded (cities.length > 0).

### Steps

1. **User opens the page.**
   - After: Launcher visible.

2. **User clicks the "Play free" link on the City Guessing card.**
   - After: Hash becomes `#game/city-guessing`. Launcher unmounts. Map flies to a "world" view (zoomed-out, no specific country). HUD shows the target city's flag + city name + country name. A "Skip" button is visible inside the HUD.

3. **User clicks anywhere on the map.**
   - After: Session transitions `playing → round-ended`. The click point is treated as the guess (whether or not it is over land). Score = `scoreCityGuess` output (**max 100 points per round**, distance-decayed via `DECAY_KM=500`; per-game total caps at 1000 over 10 rounds). A dashed geodesic arc animates from the click point to the true city for ~2 s. HUD shows a reveal line: "Spot on!" (< 1 km), "Near" (< 1000 km), or "Far" (≥ 1000 km).

4. **User waits for the reveal hold.**
   - After: Round advances at ~200-300 ms after the reveal renders (city mode does **not** have the 3 s country-mode hold). New city target appears in the HUD. Camera returns to a world view for the new round. (Verified live 2026-05-11.)

5. **User clicks the "Skip" button instead of placing a guess.**
   - After: Round transitions `playing → round-ended` with `clickedPoint=null`. Score for this round is 0. Reveal animates to the city centroid but no arc starts from a user point. HUD shows the "skipped" reveal line.

6. **User completes 10 rounds.**
   - After: After the 10th round-end, `endsGame=true` is set on `lastOutcome`. Session transitions to `game-over` at ~1.5 s after the final attempt. Game-over overlay shows total score (**out of 1,000**, not 10,000) and best streak. (Verified live 2026-05-11.)

7. **Game-over overlay flow is identical to Free Country Pinning steps 9-11**, except totals are out of 1,000 and the personal-best comparison uses `usePersonalBests('city-guessing')`.

### Special invariants

- An ocean click is **valid** in city-guessing but **ignored** in country-pinning. Mixing these (ocean click ending a country-pinning round) is a bug.
- The camera-reset between rounds is gated by reduced-motion (uses `flyToCountry` / world-view helper). Confirm no jump occurs when `prefers-reduced-motion: reduce` is set.

---

## 3. Daily — Country Pinning (best-of-3)

**Goal:** Identify today's country puzzle in at most three attempts. Best of the three attempts is the daily score. Played once per UTC day.

### Pre

- A valid puzzle exists for today in `/daily/index.json`.
- No prior history for today in `funworldmap-daily-history`.
- No in-progress resume blob in `funworldmap-daily-resume`.

### Steps

1. **User opens the page.**
   - After: Launcher visible. Country-Pinning card shows a "TODAY · COUNTRY" pill and a "Play today's daily" CTA. Streak pill shows current/longest. `daily_opened` analytics event fires once for this mode + date.

2. **User clicks "Play today's daily" on the Country-Pinning card.**
   - After: Hash becomes `#daily/<today>/country-pinning`. Launcher unmounts. HUD shows the target country flag + name. Session: `status=playing`, `attemptsPerRound=3`, `attemptsRemaining=3`, `maxRounds=1`, `dailyDate=<today>`. `daily_started` fires.

3. **User clicks on a wrong country (attempt 1).**
   - After: `attemptsRemaining` becomes 2. Session stays in `playing` (does **not** transition to `round-ended`). HUD reveals partial info: the clicked country is recorded; the target is not yet revealed; no fully-scored reveal animation plays. Resume blob is written to `localStorage`. `daily_attempted` fires with `attemptIndex=1`.

4. **User clicks on another wrong country (attempt 2).**
   - After: `attemptsRemaining` becomes 1. Same state shape as Step 3 with `attemptIndex=2`. The best attempt so far is the higher-scoring of the two.

5. **User clicks the correct country (attempt 3).**
   - After: `attemptsRemaining` becomes 0. Round ends. Best attempt = this one (100 pts). Session transitions `playing → round-ended`. Full reveal animation runs (border highlight). HUD shows the correct reveal line. `daily_attempted` fires with `attemptIndex=3`. After the reveal hold, `finalize` is dispatched → `status=game-over`. History is written to `funworldmap-daily-history`. Resume blob is cleared. `daily_completed` fires.

6. **Game-over overlay shows.**
   - After: Score is the best attempt's score. A "Share" block is mounted inside the overlay. "Play again" is disabled (or hidden) for daily games. "Back" returns to the launcher.

7. **User clicks "Share".**
   - After: `navigator.share` is invoked if available; otherwise the share text is copied to clipboard. A toast confirms "Copied". `daily_shared` fires with the correct `method`. The share text mentions the puzzle date, modes played, and per-mode score quintile bucket (not the raw score).

8. **User clicks "Back to launcher".**
   - After: Hash returns to `#`. Launcher reopens. Country-Pinning card now shows "PLAYED" state with the score. Streak pill increments if this is the first daily mode played today.

### Alternate completions

- **Done early after attempt 1 or 2.** User clicks the "Done" button (HUD). A confirm dialog opens with two buttons: "Use remaining attempts" and "Done anyway". Clicking "Done anyway" dispatches `completeNow`. Round-end + game-over follow the same flow as Step 5 onwards, with the score = best of the attempts taken.
- **All three attempts wrong.** Step 5 still ends the round with the best partial-score attempt; reveal still plays; game-over flow identical.
- **Refresh mid-game (after attempt 1 or 2).** Reload the page. Hash unchanged. `useDailyPuzzles` rehydrates; `resume.ts` reads the blob; reducer dispatches `resume` with the recorded attempts. HUD shows `attemptsRemaining = 3 - attemptsRecorded`. User continues from the next attempt.

### Daily-specific invariants

- A user who already played today cannot start the daily again. Card state becomes `played`; clicking the card opens the reveal route, not the game.
- Same UTC calendar day always shows the same target. Two users in different timezones playing at 23:30 local may see "yesterday's" puzzle near rollover (accepted v1 limitation).

---

## 4. Daily — City Guessing (best-of-3)

**Goal:** Locate today's city puzzle in at most three attempts. Same best-of-3 mechanics as Daily Country Pinning.

### Pre

- Same as Daily Country Pinning, but for city-guessing.

### Steps

1. **User opens the page.**
   - After: Launcher visible. City-Guessing card shows "TODAY · CITY" pill and CTA.

2. **User clicks "Play today's daily" on the City Guessing card.**
   - After: Hash becomes `#daily/<today>/city-guessing`. HUD shows target city + country flag + country name. Skip button is **not** present in best-of-3 mode (skip is only for free play single-attempt).

3. **User clicks a point on the map (attempt 1).**
   - After: `attemptsRemaining=2`. No round-end. Attempt is recorded with `pointsEarned` (distance-decayed), `distanceKm`, and `guessLngLat`. Resume blob written. `daily_attempted` fires with `attemptIndex=1`.
   - **Intermediate visual**: a small ephemeral marker may flash at the click point during best-of-3, but the full reveal arc does not play between attempts (the full arc is reserved for round-end).

4. **User clicks again (attempt 2).**
   - After: `attemptsRemaining=1`. Same as Step 3, `attemptIndex=2`.

5. **User clicks again (attempt 3).**
   - After: `attemptsRemaining=0`. Round ends. Full reveal animation: geodesic arc from the **best** attempt's click point to the city target, distance label, ~2 s hold. HUD shows the corresponding reveal line. `daily_attempted` then `finalize` then `daily_completed` fire. History persisted, resume cleared.

6. **Game-over overlay, Share, Back-to-launcher** — identical to Daily Country Pinning steps 6-8.

### Alternate completions

- **Done early.** "Done" button + confirm dialog flow identical to Daily Country Pinning, scored on best of attempts taken.
- **Refresh mid-game.** Same resume flow as Daily Country Pinning.
- **Mixed daily.** A user who completes Daily Country Pinning earlier in the day can later open Daily City Guessing. The launcher card states are independent per mode.

---

## 5. Launcher / History calendar

**Goal:** Browse past daily results, view a single-day reveal, or jump back into today's puzzle.

### Pre

- `funworldmap-daily-history` contains at least one prior day's result (seed via `seedDailyHistory` in tests).

### Steps

1. **User opens the page on `/`.**
   - After: Launcher visible. Streak pill is interactive (button).

2. **User clicks the streak pill.**
   - After: History calendar panel opens inside the launcher. Shows the last 30 days as cells. Played cells render with a score chip; unplayed-in-window cells are dimmed; rolled-off cells (>30 days ago) are inert. `history_opened` fires.

3. **User clicks a played cell.**
   - After: Launcher unmounts. Hash becomes `#daily/<that-date>/reveal`. `DailyRevealOverlay` mounts with both modes' results for that date and a share block. `history_cell_clicked` fires with `cellKind='played'`.

4. **User presses Escape on the reveal overlay.**
   - After: Overlay closes. Hash returns to `#`. Launcher reopens. Focus returns to the previously-focused launcher element.

5. **User clicks the "Just explore the map" link at the bottom of the launcher.**
   - After: Launcher dismisses without starting a game. Map is interactive. Focus moves to the search input via `focusSearchInput()` (double-rAF after dismiss). `launcher_dismissed` fires with `path='link'`.

6. **User reaches a "streak milestone" (e.g. day 3, 7, 14).**
   - After: On the next launcher open after the milestone-triggering completion, `LauncherMilestoneOverlay` appears on top of the launcher. Focus is trapped inside the overlay. `streak_reached_milestone` fires at most once per milestone (deduped via `streak.lastMilestoneShown`). Dismissing the overlay returns focus to the launcher.

---

## 6. Cross-game invariants (apply everywhere)

These are not standalone scenarios but must hold during any of the flows above:

- **URL hash drives selection.** Every selection path (map click, search, launcher CTA, history cell) ultimately writes to `window.location.hash`. After the write, all consumers (launcher, game controller, country panel, daily overlay) reflect the same state on the next render.
- **Escape precedence.** Escape is handled in this order: open milestone overlay → open compare picker → open country panel → search-dropdown clear. Each layer that intercepts must `stopPropagation` so a lower layer never closes accidentally.
- **Reduced motion.** Every `flyTo`, every CSS transition >100 ms, every dashed-arc reveal must be gated by `prefers-reduced-motion: reduce`. With reduce on, the map cuts to the new camera, the reveal renders instantly, and the panel/overlay appears without fade.
- **Test seams.** During e2e, `window.__funworldmap_game` exposes `submitGuessInput`, `completeNow`, `finalize`, `endGame`. These dispatch the same reducer actions as a real click but skip wall-clock holds. They must be present after `waitForGameTestHook(page)` resolves and absent in production builds (gated by `VITE_TEST_HOOKS`).
- **Persistence.** Every successful daily completion writes exactly one history entry per `(date, mode)`. A second completion attempt for the same `(date, mode)` is rejected: card state becomes `played` and the CTA is replaced by "See reveal".

---

## How to use this document

1. **Pick a scenario above.** Each one is a self-contained user journey.
2. **For each numbered step, derive at least one assertion.** The "After" line names the post-condition. The test should:
   - assert the prior state (e.g. session is in expected `status` before the action),
   - take the action (click, key press, hash write, dispatch),
   - assert the post-condition.
3. **Translate to test seam where possible.** Game-flow assertions in e2e should prefer `__funworldmap_game.submitGuessInput(...)` over UI clicks, per `CLAUDE.md` rules. Only use real UI clicks when the test is verifying UI behaviour (focus, animation, ARIA), not game-state behaviour.
4. **Verify timing-sensitive steps with state, not timeouts.** A reveal "hold" is a reducer state (`round-ended`), not a wallclock duration — wait on the state, not the time. The wallclock guard exists only as a UX floor; the test should drive `finalize()` directly when verifying the post-game state.

If a scenario step fails to match its "After" line on real hardware, that is the bug. File it with: scenario number, step number, observed behaviour, expected behaviour from this doc, and a `git rev-parse HEAD` to anchor the fact in time.
