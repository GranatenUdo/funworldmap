# Game Unhappy-Path Test Scenarios

Date: 2026-05-11
Companion to: [`game-happy-paths.md`](./game-happy-paths.md)

> ⚠️ **Verification status (2026-05-11):** Most scenarios in this document are **design hypotheses derived from code reading, not from live observation**. The exceptions personally verified live are: D2/D3 (reducer rejects out-of-state submits — verified via test seam), E1 (last-life endsGame flow — the 2026-05-11 "panel suppressed" observation no longer holds; see E1's updated contract).
>
> All of **section A (animations)** — red flash, dashed geodesic arc, globe rotation, panel slide-in timing — is hypothesized from CSS conventions and code structure. Before treating any "After" line in section A as a test contract, **observe the live behavior and update the line to match reality** (screenshots or video help). Sections E (concurrency) and parts of F (boundary) are similarly speculative.
>
> The structure of this document — numbered user actions paired with observable post-conditions — is the artifact. The content needs validation. Treat unverified "After" lines as **questions to test**, not answers to assert.
>
> Line-number references below reflect the 2026-05-13 tree; the game-controller extraction (2026-05-14) moved most of them.

This document describes **failure-mode and edge-case** user flows. If happy-paths.md says "what should happen when everything goes right," this file says "what should happen when something goes wrong, when the user does something unexpected, or when the environment is hostile."

Same structure as the happy-paths doc: numbered steps as short user-intent sentences with "After:" post-conditions. Tests derive observations from the "After" lines. A failure to match an "After" line is the bug.

Animations get a dedicated section because they are the most fragile happy-path component — they are wallclock-timed, GPU-dependent, interruptible, and reduce-motion-gated, and they are the user's primary "did the game work?" signal.

---

## Common preconditions (apply unless overridden)

- Browser supports WebGL2 (except for scenario set G).
- `localStorage` is empty (except for scenarios that seed it).
- Network reaches the dev/preview server (except for scenarios that simulate offline).
- Reduced-motion preference: assume "no preference" unless the scenario varies it.
- A game session has been started where needed; the preconditions on each scenario say which.

---

## A. Animation & reveal behavior

The reveal animation is the moment of feedback after a guess. It carries the gameplay's emotional payload. These scenarios verify the animations actually fire, that they end, and that they don't fire when they shouldn't.

### A1. Wrong country guess — country panel opens with the correct country

**Pre:** Free Country Pinning, `status=playing`, target is FRA.

1. **User clicks JPN on the map (or submits `JPN` via the seam).**
   - After: `lastOutcome.reveal.kind === 'country'`, `correct: false`, `clickedCca3='JPN'`, `targetCca3='FRA'`.
   - After: A **tessellated dashed line** (65-vertex geodesic arc) renders on the globe from the JPN centroid to the FRA centroid. The camera pans toward the target. (Verified by `e2e/reveal-animation.spec.ts:9-41` which asserts the line geometry.)
   - After: The country panel slides in (`role="complementary"`) populated with FRA's data: flag, name, capital, region, neighbors.
   - After: A "Continue" button is focusable and visible inside the panel.
   - After: HUD reveal line reads "Wrong — that was Japan. +X points. The answer was France. −1 life."
   - After: No auto-advance occurs even after 10 s. Game waits for Continue (or Esc/Space/Enter which skip-the-hold and advance early — see A8).

> **2026-05-13 update** (`docs/testing/animation-verification-2026-05-13.md`): the original contract claimed "JPN polygon flashes red, FRA polygon highlights green." That was speculative. Actual reveal mechanic is the dashed-line arc described above. No polygon-fill highlighting in country mode.

### A2. Correct country guess — panel opens with target info

**Pre:** Free Country Pinning, `status=playing`, target is FRA.

1. **User clicks FRA.**
   - After: HUD reveal line: "Correct! +100 points. That was France."
   - After: The country panel slides in with France's data: flag, name, capital, region, neighbors. **Same panel as the wrong-guess case** — `App.tsx:137-153` computes `roundEndTarget` for any final outcome (correct or wrong) in country-pinning round-end.
   - After: Continue button is focusable inside the panel.
   - After: ~3.0-3.5 s later (if the user doesn't press a key), auto-advance fires and the next round begins. Pressing Continue or Esc/Space/Enter advances immediately.

> **2026-05-13 update** (`docs/testing/animation-verification-2026-05-13.md`): the original contract claimed "no country panel opens; correct guesses are pure HUD." That was wrong — the panel renders for both correct and wrong guesses in country-pinning free play. The HUD reveal line differs by outcome but the panel UX is the same.

### A3. City guess — dashed geodesic arc from click to target

**Pre:** Free City Guessing, `status=playing`, target Shenzhen at `[114.06, 22.55]`.

1. **User clicks somewhere far (e.g. `[-100, 40]`).**
   - After: A **tessellated dashed geodesic line** (65 vertices) renders from the click point to the target city centroid. Verified by `e2e/reveal-animation.spec.ts:43-60`.
   - After: A **target marker** appears at the city centroid (visible as a yellow dot at the target location).
   - After: HUD reveal line: "Far — X km" / "Near — X km" / "Spot on!" depending on distance.
   - After: Auto-advance is rapid (~200 ms); the rendered line is brief.

> **2026-05-13 update** (`docs/testing/animation-verification-2026-05-13.md`): captured a screenshot during `round-ended` and confirmed the target marker is rendered. The dashed-arc line is real but visually faint at low resolution; primary signal is the target marker. Behavior of the underlying line is verified at the geometric level by the existing spec.

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

**Pre:** Animated component (`Launcher`, `SingleCountryPanel`).

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
   - After: For Free City Guessing, auto-advance happens around t ≈ 200-300 ms (no extended hold).

---

## B. Network & content failures

### B1. Basemap tiles unreachable

**Pre:** Block OpenFreeMap CDN.

1. **User opens `/`.**
   - After: Map canvas mounts.
   - After: A "basemap unavailable" banner or fallback message renders (see `BasemapBanner.tsx`).
   - After: Country polygons render from bundled TopoJSON.
   - After: Free-play game flows still work.

### B2. Country GeoJSON fails to load

**Pre:** Force `world-atlas/countries-50m.json` chunk to fail (e.g. block via DevTools network throttling, or corrupt the cache).

1. **User opens `/`.**
   - After: Map basemap renders.
   - After: Country polygons do not render.
   - After: An error state appears: "Country data unavailable." (`overview.md:113-114`).
   - After: Search and panel are non-functional.
   - After: Free-play card "Play free" button is disabled or starting a game shows a graceful error rather than a blank HUD.

### B3. Analytics endpoint fails

**Pre:** Block `funworldmap.com/api/event`.

1. **User completes a game.**
   - After: Game-over overlay mounts normally.
   - After: Failed analytics POSTs are silently dropped (`lib/analytics.ts:46-61`).
   - After: No banner, no console error, no impact on gameplay.

---

## C. Invalid input & hash

### C1. Country deep-link with invalid cca3

**Pre:** URL hash = `#XYZ`.

1. **User opens the URL.**
   - After: Per `overview.md:111`, `byCca3` lookup returns no match; hash is silently cleared.
   - After: No country selected, default view shown.

### C2. Submit guess when status is `idle`

**Pre:** No game started.

1. **Test seam dispatches `submitGuess({…})`.**
   - After: Reducer rejects (`useGameSession.ts:103`: `if (state.status !== 'playing') return state`).
   - After: No state change. No reveal. No score.

### C3. Submit guess when status is `round-ended`

**Pre:** Country mode, last attempt has fired, country panel is open awaiting Continue.

1. **Test seam dispatches a second `submitGuess(…)` without clicking Continue.**
   - After: Reducer rejects. State unchanged. No double-scoring.

---

## D. Concurrency & race conditions

### D1. Escape mid-game

**Pre:** Free Country Pinning, `status=playing`.

1. **User presses Escape.**
   - After: Either an "End game?" confirm dialog opens, or `endGame` dispatches directly.
   - After: If confirmed: session → `idle`, hash returns to `#`, the user returns to the bare map (no launcher auto-open, no camera reset).
   - After: If a confirm dialog: focus moves to the dialog, second Escape dismisses (does NOT end game), Enter on the confirm button ends.

   **2026-05-13 update:** The global Escape handler (`GameController.tsx:767-783`) covers `status=playing` as described. However, it **explicitly excludes** the `round-ended + country-pinning` sub-state from this exit path (see comment at `GameController.tsx:407`). In that sub-state, Escape is handled by `holdThenAdvance` (`GameController.tsx:51-64`), which **skips the reveal hold and advances to the next round** — it does NOT abort to the launcher. The "After" lines above apply only when `status=playing`, not when `status=round-ended`.

### D2. Rapid double-submit (the bug-#32 territory)

**Pre:** Free Country Pinning, `status=playing`, `roundIndex=0`.

1. **Test fires two `submitCountryGuess(targetCca3)` calls within 16 ms.**
   - After: Only **one** attempt is recorded. The second is rejected because the first transitioned to `round-ended` (the reducer guard at `useGameSession.ts:103-104`).
   - After: Score reflects only one round's points.
   - After: No duplicate reveal animation. No double-counted streak.

### D3. Mode switch from game-over (bug #32 origin)

**Pre:** Free Country Pinning, `status=game-over`, overlay mounted.

1. **User clicks a different mode (e.g. via launcher → free city-guessing, or by hash mutation).**
   - After: Reducer dispatches `restart` (single tick), **not** `endGame` + `start` (two ticks). This avoids the intermediate `status='idle'` render that unmounts the HUD between dispatches.
   - After: City-guessing game starts cleanly; no HUD flicker.
   - After: `lastOutcome` from the old game is cleared.

### D4. Refresh during reveal hold

**Pre:** Free Country Pinning, mid-reveal animation (post-correct).

1. **User reloads the page (F5).**
   - After: Free-play state is not persisted; game restarts from `idle` → launcher.
   - After: Free-play hash on fresh load bootstraps via `useHashGameRouter.ts:196-216` plus the deferred-pool drain effect at lines 229-255. Verified working.

### D5. Tab backgrounded mid-reveal

**Pre:** Free City Guessing, mid-reveal animation. User switches tabs for 30 s, then returns.

1. **User refocuses the tab.**
   - After: Animations may have paused or run to completion; reducer state is whatever it would have been at wallclock-now.
   - After: HUD reflects current state correctly (next round target if advance fired during background).
   - After: No console errors.

---

## E. Boundary conditions

### E1. Last-life wrong in free country-pinning

**Pre:** Free Country Pinning, `lives=1`, target FRA.

1. **User clicks a wrong country.**
   - After: `lives=0`, `livesDelta=-1`, `endsGame=true`.
   - After: The country panel still opens (the round-end panel renders regardless of `endsGame`); Continue, Enter / Space / Escape, or the ~3 s hold finalize to `game-over`.
   - After: Game-over overlay shows. No stuck "Continue" state.
   - After: ✅ Resolved 2026-06-12: the panel renders regardless of `endsGame` (`App.tsx` `roundEndTarget` has no endsGame check).

### E2. Game-over fires while reveal panel is still animating in

**Pre:** Free Country Pinning, last life, wrong final guess.

1. **At t=0, user submits wrong guess.**
   - After: At t=300 ms, country panel slide-in animation is in progress.
   - After: At t≈3 s, `finalize` dispatches, game-over overlay mounts on top.
   - After: The country panel beneath should either: (a) close cleanly, (b) be visually preserved but inert. No half-rendered state.

---

## F. Browser environment

### F1. WebGL2 not supported

**Pre:** Browser does not support WebGL2 (the `maplibregl.Map` constructor throws, caught in `useMapInstance`).

1. **User opens `/`.**
   - After: Map canvas does not initialize.
   - After: An error overlay renders with "browser upgrade guidance" (`overview.md:110`).
   - After: Launcher is NOT shown (or is shown with the game CTAs disabled — verify which).
   - After: No silent crash.

### F2. WebGL context lost mid-game

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

### F3. Theme toggle mid-game

**Pre:** Free Country Pinning, `status=playing`, light theme.

1. **User clicks theme-toggle button.**
   - After: `<html>` class flips to dark.
   - After: MapLibre paint properties re-apply.
   - After: Reveal animation, HUD, panel, button colors all switch consistently.
   - After: No game-state interruption.

### F4. Reduced-motion preference toggled mid-game

**Pre:** Free Country Pinning, mid-reveal animation, reduced-motion was OFF.

1. **OS-level reduced-motion is enabled while the reveal is animating.**
   - After: In-flight animations are not retroactively shortened (browsers don't fire mid-animation).
   - After: The NEXT animation respects the new preference.
   - After: No crash, no console error.

### F5. Color-scheme preference toggled mid-game

**Pre:** Theme is set to "system". OS-level dark-mode is toggled mid-game.

1. **OS switches color scheme.**
   - After: `prefers-color-scheme` media query fires.
   - After: `<html>` class updates.
   - After: Map paint and UI colors re-apply.
   - After: No game-state interruption.

### F6. Tab visibility / suspend

**Pre:** Free City Guessing, `status=playing`. User switches to another tab and the OS suspends the browser tab.

1. **User returns to the tab after 10 minutes.**
   - After: Game state is exactly as it was at suspend time.
   - After: Any in-flight animation either: (a) resumed and completed during background, (b) was cancelled, (c) is still mid-animation. Test should not assume.
   - After: User can submit a new guess and the reducer behaves normally.

### F7. Window resize (mobile orientation change)

**Pre:** Mobile viewport, panel open in bottom-sheet mode (`< 1024px`).

1. **User rotates device to landscape, viewport becomes `> 1024px`.**
   - After: Panel transitions from bottom-sheet to sidebar layout.
   - After: No content lost.
   - After: Focus is preserved on whatever element was focused.

### F8. Map click coordinate at -180/+180 longitude wrap

**Pre:** Country mode, map panned so longitude=180 is on screen.

1. **User clicks a country near the antimeridian (e.g. Fiji or Russia).**
   - After: `queryRenderedFeatures` returns the correct country.
   - After: Score and reveal apply normally — no off-by-360 distance computation.

---

## G. Accessibility-specific unhappy paths

### G1. Screen reader announces reveal

**Pre:** NVDA / VoiceOver active. Free Country Pinning, just submitted wrong guess.

1. **Reveal fires.**
   - After: Live region (`role="status"` on `[data-testid="game-reveal"]`) announces the reveal line.
   - After: Country panel heading is reachable via Tab.
   - After: Continue button is reachable and announces correctly.

### G2. Keyboard-only player completes a game

**Pre:** No mouse. Free Country Pinning. User uses keyboard to drive the map (arrow keys + Enter).

1. **User navigates to a country via search.**
   - After: Search dropdown opens.
   - After: ArrowDown moves through options, Enter selects.
   - After: Selection submits as a country guess.
   - After: Continue button is reachable via Tab from the HUD.
   - After: Player can complete the full game without ever clicking the map canvas.

### G3. Focus management on game-over

**Pre:** Game-over overlay just mounted.

1. **Overlay enters.**
   - After: Focus moves to "Play again".
   - After: Focus is trapped within the overlay.
   - After: Tab cycles among the overlay's buttons only.
   - After: Escape closes the overlay (returns to launcher).

### G4. Forced colors / Windows high-contrast mode

**Pre:** Windows high-contrast mode is on.

1. **User opens `/` and starts a game.**
   - After: All interactive elements have visible focus indicators using system colors.
   - After: Map reveal highlights still distinguish correct/wrong (e.g. via patterns or system-color overrides, not just opacity).
   - After: 🟠 **Known gap per prior audit:** no `forced-colors` CSS rules exist; this scenario likely surfaces bugs.

### G5. Excessive zoom / reflow

**Pre:** Browser zoom at 200% or 400%.

1. **User opens `/`.**
   - After: Layout reflows; no horizontal overflow on mobile widths.
   - After: All buttons remain clickable; no overlap.
   - After: Modal dialogs (launcher, game-over overlay) stay within the viewport.

---

## H. Telemetry & observability

### H1. Telemetry endpoint slow but succeeds

**Pre:** Analytics endpoint takes 3 s to respond.

1. **User completes a game.**
   - After: Game UI is not blocked on the POST.
   - After: Event is sent via `navigator.sendBeacon` if available, else `fetch` with `keepalive`.

### H2. Page closes mid-event

**Pre:** User closes the tab immediately after game-over.

1. **Page unloads.**
   - After: The game-completion event is sent via `sendBeacon`, survives the unload.
   - After: 🟠 **Verify:** `lib/analytics.ts:46-61` actually uses `sendBeacon` for the final event.

### H3. Sentry breadcrumb on rare events

**Pre:** A rare client-side error occurs (e.g. unhandled rejection during reveal).

1. **Error fires.**
   - After: Sentry captures it (DSN configured at build time).

---

## How to use this document

These scenarios are intentionally adversarial. For each:

1. **Verify the "After" lines describe the intended graceful degradation.** Some are "we don't care if X happens, just don't crash"; others are "the user must see Y feedback." Treat each "After" line as a contract.
2. **Treat 🟠 markers as known/suspected risks.** They cross-reference the divergence report and prior assessment. Do not let them creep into the silent-failure category.
3. **Animations especially:** write tests that wait on `data-animation-state="idle"`, not on a hardcoded duration. The CLAUDE.md e2e rules already require this.
4. **For each bug found** when running these scenarios, file: scenario ID (e.g. A3), expected "After" line that was missed, observed behavior, and the commit SHA.

The unhappy-path coverage gap is largest in **A (animations)**. The happy-path coverage gap is largest in **deep-link routing** (Bug 1 from the divergence report). Both should drive the next round of e2e additions.
