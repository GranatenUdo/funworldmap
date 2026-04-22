# Country-Pinning — Anti-Cheat + Round-End UX Reform Design

**Date:** 2026-04-22
**Status:** Draft — pending user review
**Sibling plan (deferred):** [`2026-04-22-country-news-feed-design.md`](./2026-04-22-country-news-feed-design.md) (not yet written) — the country news-feed feature is a separate brainstorm scoped to its own plan because it introduces backend/external-API concerns orthogonal to this work.

---

## Goal

Remove two cheat surfaces from the country-pinning game and replace the auto-advance round-end with a panel-driven flow that doubles as an educational reward.

**Primary success criteria.**
- During a country-pinning guess phase, hovering a country on the map reveals **nothing** about its identity beyond the standard hover highlight.
- The "Guess by name" typing input no longer exists in any form.
- After a guess (free-play, or final daily attempt), the target country's `SingleCountryPanel` opens on the right with mode-aware chrome.
- Wrong guesses wait for the user to click Continue. Correct guesses auto-advance after up to 3000 ms with any click/key skipping early.
- Daily 3-attempt rounds keep the existing incremental-distance puzzle: the panel is suppressed for attempts 1-2, opens for the final outcome.

**Explicit non-goals.**
- City-guessing receives the same tooltip cheat (a city's tooltip identifies its country); fix deferred to a separate plan.
- News-feed-on-CountryPanel is a separate plan.
- No visual redesign of `SingleCountryPanel`'s header — Continue reuses the existing close-button slot.
- No changes to per-attempt scoring, reveal-marker rendering, or the daily content pipeline.

---

## Scope

### In scope

1. **Tooltip suppression during guess phase.** `useMapInteractions.ts:40-82`'s `mousemoveHover` is gated on a new `gameActive` flag (or, more precisely, "country-pinning session is in `playing` status"). When suppressed, only the existing feature-state hover + extrusion + hover-border filter run; no DOM tooltip is written.
2. **Delete `GuessByNameButton`.** Source file removed; its render site and any orphaned reducer plumbing removed too.
3. **Round-end panel.** `GameController` renders `<SingleCountryPanel>` for the target country when the round ends, except for daily intermediate attempts.
4. **Continue / auto-advance flow.** Wrong → wait for Continue click (Continue replaces Close in the panel header). Correct → 3000 ms timer with any pointer/key event advancing early.
5. **`SingleCountryPanel` `inGameRound` mode.** New prop hides Compare and Copy-link buttons; renames Close to Continue (visually + semantically the dismiss action that also fires `advance`).
6. **Test updates.** E2E specs for country-pinning + daily-puzzle updated to match the new flow.

### Out of scope (deferred)

- City-guessing tooltip cheat (same class of bug, separate plan).
- News-feed feature (separate plan; see Country News Feed brainstorm next).
- Visual chrome changes beyond the in-round button hide/relabel.
- Refactoring the daily 3-attempt scoring or attempt-tracking model.

---

## Architecture

### Tooltip gating

`useMapInteractions.ts` already accepts a `loaded` flag. Add a `tooltipsEnabled` boolean — true when no game is active OR when the game is not in a guess phase. When false, `mousemoveHover` skips the tooltip-write block (lines 53-81 of the current file) but keeps the highlight/extrusion/cursor changes (lines 41-51).

Wiring:
- `App.tsx` already has `gameActive` derived from session status (`App.tsx:354`). Define `tooltipsEnabled = !gameActive` (or, more precisely, `!(gameActive && session.status === 'playing')` once session is in scope).
- Pass through `WorldMap` props → `useMapInstance` → `useMapInteractions` (or directly to `useMapInteractions` if it already takes a hook on its own).

Simpler alternative: read the session status via `useGameSessionContext()` inside `useMapInteractions`. Cleaner, no prop-drilling. The interactions hook does not currently consume game session — adding it is acceptable since the cheat-suppression rule is fundamentally a game-state concern.

**Decision: read via `useGameSessionContext()` inside `useMapInteractions`.** Avoids prop-drilling.

### `GuessByNameButton` removal

- Delete `src/game/shared/hud/GuessByNameButton.tsx`.
- Remove the `<GuessByNameButton ... />` JSX from whichever HUD component renders it (likely `src/game/GameController.tsx` or a sibling — confirm via grep).
- Search for `submitGuessInput` callers. If GuessByName is the only caller, remove the action from the reducer + the `submitGuessInput` export from `useGameSession` + the destructure in `GameSessionProvider`. If anything else uses it (the daily-puzzle e2e shim might), keep the action and only remove the UI.
- Delete unit tests targeting `submitGuessInput` if any are dedicated; relax tests that incidentally call it.

### Round-end panel rendering

When `session.status === 'round-ended'` AND we are in country-pinning AND it's a "final outcome":

- Final outcome = `attemptsPerRound === 1` (free-play) OR `attemptsRemaining === 0` (daily final attempt) OR `lastOutcome.reveal.kind === 'country'` and the daily session was reveal-early'd.
- Look up the target country: `byCca3.get(session.lastOutcome.reveal.targetCca3)`.
- Render `<SingleCountryPanel country={target} inGameRound={true} onClose={advanceNow} ... />` inside the existing layout slot (right side on desktop, bottom drawer on mobile — the panel already handles responsive layout).

`advanceNow` is the same callback the existing setTimeout fires today: `mode.nextRound(used)` → `advance(next)`.

The current setTimeout in `GameController.tsx:228-233` becomes conditional:

```ts
const isFinalOutcome = session.attemptsPerRound === 1 || session.attemptsRemaining === 0
const isDailyIntermediate = !isFinalOutcome
const isCorrect = !!session.lastOutcome?.reveal?.correct

if (isDailyIntermediate) {
  // Existing per-attempt timer for daily 1-2 (keep current 1200/2000 ms).
  const t = window.setTimeout(advanceNow, revealMs)
  return () => window.clearTimeout(t)
}

if (isCorrect) {
  // Final outcome + correct: 3000 ms max with early-skip.
  const t = window.setTimeout(advanceNow, 3000)
  const onAnyEvent = () => { window.clearTimeout(t); cleanup(); advanceNow() }
  const cleanup = () => {
    window.removeEventListener('pointerdown', onAnyEvent)
    window.removeEventListener('keydown', onAnyEvent)
  }
  window.addEventListener('pointerdown', onAnyEvent)
  window.addEventListener('keydown', onAnyEvent)
  return () => { window.clearTimeout(t); cleanup() }
}

// Final outcome + wrong: no timer; Continue is the only path.
return // no cleanup needed
```

### `SingleCountryPanel` `inGameRound` prop

Add an optional `inGameRound?: boolean` prop. When true:
- Hide the Compare-with-another-country button (`SingleCountryPanel.tsx:148-159`).
- Hide the Copy-link button (`SingleCountryPanel.tsx:162-171`).
- Keep the Close button visually identical but with the label/aria-label `"Continue"` and the same handler signature (the parent passes `advanceNow` as `onClose`).
- Keep the expand/collapse mobile button (`SingleCountryPanel.tsx:173-188`) — needed for mobile users to read more.

The default behavior (`inGameRound` undefined or false) is the existing free-play behavior.

### Daily intermediate-attempt suppression

A daily 3-attempt round fires `round-ended` after each attempt. Today the existing `setTimeout` (1200/2000 ms) advances to the next attempt. This plan keeps that exact timer for intermediate attempts and only suppresses the panel — no other change to the daily-attempt scoring, reveal animation, or distance feedback.

The check `attemptsPerRound > 1 && attemptsRemaining > 0` distinguishes intermediate from final. (`attemptsRemaining === 0` after the final attempt; the reducer also flips status to `game-over` once all rounds are done — both states represent "show the panel".)

---

## Data flow

```
User clicks country
  → submitGuess({ kind: 'country', cca3 })
  → reducer transitions status='round-ended', sets lastOutcome
  → GameController round-end effect:
      ├── intermediate daily attempt? → existing setTimeout, no panel
      └── final outcome? → render SingleCountryPanel(target, inGameRound)
            ├── correct → 3000ms timer + global event listener (early-skip)
            └── wrong → no timer; await Continue click in panel
  → advance(mode.nextRound(used))
  → reducer transitions status='playing' (or 'game-over' on last round)
  → panel unmounts (round-ended cleared)
```

---

## Tests

### E2E to update

- **`e2e/game-country-pinning.spec.ts`:**
  - Replace any test asserting "round auto-advances after wrong guess" with: round-end → `getByTestId('country-panel')` visible → `panel-close` click (now Continue) → next round.
  - Remove any test exercising `game-guess-by-name`, `game-guess-input`, `game-guess-results` test-ids.
  - Add: hover a country during guess phase, assert `.country-tooltip.visible` is NOT present in the DOM.
  - Add: correct guess → panel opens → wait 3500 ms → next round started (auto-advance).
  - Add: correct guess → panel opens → press Enter → next round starts immediately (early-skip).

- **`e2e/daily-puzzle.spec.ts`:**
  - Add: 3-attempt daily, attempt 1 wrong → existing reveal animation visible, but `country-panel` NOT mounted; auto-advances to attempt 2.
  - Add: same for attempt 2.
  - Add: attempt 3 (or `revealEarly`) → `country-panel` mounts; Continue click ends the daily; `daily_completed` event fires.

### Unit

- If `submitGuessInput` is removed, delete its dedicated reducer tests.
- If `useMapInteractions` reads `useGameSessionContext()`, add a unit test for the gating: with mocked `'playing'` status, `mousemoveHover` does not write to the tooltip; with `'idle'` status, it does.

### Manual smoke

- After implementation, eyeball the round-end flow on desktop + mobile: panel position, Continue button reachability without scroll, animation feel.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Existing free-play country-pinning expectations of auto-advance break the muscle-memory of returning users | The auto-advance still fires on correct (3000 ms with early-skip). Wrong-guess users now read the panel — desired behavior per the spec. |
| Removing `submitGuessInput` breaks an unexpected caller | Pre-flight grep before deletion. If anything depends on it (e.g., the daily-puzzle e2e's `__funworldmap_game.submitCountryGuess`), keep the reducer action and only remove the UI. |
| `inGameRound` prop on `SingleCountryPanel` is a feature flag that grows over time | Document the prop as "in-round chrome only — Compare + Copy-link hidden, Close labeled Continue". Future changes go through this single switch. If a third in-round behavior shows up, refactor to a discriminated state object. |
| Window-level early-skip listener catches user's Compare-panel click | Compare is hidden in `inGameRound` mode, so no conflict. Listener self-unregisters on first event. |
| Mobile users miss the Continue button below the fold | Place Continue at the panel header (the existing close-button slot is at the top). Mobile bottom-drawer panels already render the header at the top. |
| Tooltip suppression also disables tooltip after the round-ended state | Acceptable: round-ended → panel is open showing the target's full info; tooltip would be redundant. Tooltip returns to active when status flips back to `'playing'` (next round) or `'idle'` (game ended). |

---

## Definition of done

- All cheat surfaces removed (verified by E2E tooltip + GuessByName tests).
- Round-end panel opens for free-play and for final daily attempt.
- Continue button advances on wrong guesses; correct auto-advances within 3000 ms with early-skip.
- Daily 3-attempt scoring unchanged; intermediate panel suppression verified.
- All E2E + unit tests green.
- Manual smoke on desktop + mobile clean.
