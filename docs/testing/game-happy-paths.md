# Game Happy-Path Test Scenarios

Date: 2026-05-11

This document describes the **designed** user flow for each playable mode. It is the upstream artifact for test plans: each numbered step is a short user-intent sentence, paired with the observable outcome the system is supposed to produce. From these flows, concrete test steps (Playwright, manual QA, screen-reader smoke) are derived.

If actual behaviour diverges from any "After" line below, that is the bug. The reference behaviour is the design as encoded in `src/game/shared/useGameSession.ts` and the mode modules under `src/game/modes/`.

---

## Common preconditions (apply to all scenarios)

- Browser supports WebGL2. MapLibre canvas renders without an error overlay.
- `localStorage` is empty for `funworldmap-*` keys (clean slate).
- Reduced-motion preference: assume "no preference" unless a scenario explicitly varies it.
- Network: basemap tiles available; flag SVGs reachable.
- The dev/preview server is at `/`. The hash fragment encodes the route.

---

## 1. Free Play — Country Pinning

**Goal:** Identify a sequence of countries by clicking the correct polygon on the map. Three lives, unlimited rounds, game-over when lives reach 0.

### Pre

- Hash is empty or `#`. Launcher is the foreground element.
- Pool of countries is loaded (countries.length > 0).

### Steps

1. **User opens the page on `/`.**
   - After: Launcher dialog is visible (opened via the header Play button). Two mode cards render, each showing a personal-best line. Map is rendered behind a dimmed backdrop.

2. **User clicks the "Play" button on the Country Pinning card.**
   - After: Hash becomes `#game/country-pinning`. Launcher unmounts. HUD shows a target flag + country name. Map remains in its current camera (no fly-to). Session: `status=playing`, `lives=3`, `maxRounds=null`, `roundIndex=0`.

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

7. **User clicks on water/ocean (no country under the click).** _[Not personally verified — design intent.]_
   - After: No round transition. No score change. No lives lost. Reveal does not fire. HUD is unchanged. (Map click with `queryRenderedFeatures` returns no country layer match → ignored.)

8. **User repeats steps 3-6 until lives = 0.**
   - After: Final wrong guess triggers `endsGame=true`. **The Continue-panel flow is suppressed in this terminal case** — auto-transition to `game-over` fires at ~3 s with no user input required. (Verified live 2026-05-11: lives 1→0 wrong guess produced game-over overlay at ~3 s.)

9. **Game-over overlay is shown.**
   - After: Overlay displays total score, best streak this session, and (if applicable) a new personal-best badge. Focus is on the "Play again" button. "Back" button is reachable by Tab.

10. **User clicks "Play again".**
    - After: Reducer dispatches `restart` (single tick, no intermediate idle). Map camera flies back to the default view. New round begins from `roundIndex=0`. Session is identical in shape to Step 2's post-state.

11. **User clicks "Back" instead.** _[Not personally verified.]_
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
   - After: Launcher visible (opened via the header Play button).

2. **User clicks the "Play" button on the City Guessing card.**
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

## 3. Cross-game invariants (apply everywhere)

These are not standalone scenarios but must hold during any of the flows above:

- **URL hash drives selection.** Every selection path (map click, search, launcher CTA) ultimately writes to `window.location.hash`. After the write, all consumers (launcher, game controller, country panel) reflect the same state on the next render.
- **Escape precedence.** Escape is handled in this order: open compare picker → open country panel → search-dropdown clear. Each layer that intercepts must `stopPropagation` so a lower layer never closes accidentally.
- **Reduced motion.** Every `flyTo`, every CSS transition >100 ms, every dashed-arc reveal must be gated by `prefers-reduced-motion: reduce`. With reduce on, the map cuts to the new camera, the reveal renders instantly, and the panel/overlay appears without fade.
- **Test seams.** During e2e, `window.__funworldmap_game` exposes `submitGuessInput`, `finalize`, `endGame`. These dispatch the same reducer actions as a real click but skip wall-clock holds. They must be present after `waitForGameTestHook(page)` resolves and absent in production builds (gated by `VITE_TEST_HOOKS`).
- **Personal bests.** Every completed game writes a personal-best entry to `localStorage`. The launcher shows the best score, best streak, and games-played count per mode on next open.

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
