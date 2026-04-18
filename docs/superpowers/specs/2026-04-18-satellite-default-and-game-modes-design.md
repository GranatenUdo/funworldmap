# Satellite Default + Game-Mode Framework (Country Pinning)

**Date:** 2026-04-18
**Status:** Draft — pending user review
**Scope:** Two independent changes, shipped as two PRs

## Overview

Two user-facing changes:

1. **Satellite as the default basemap.** Flip the initial state from vector (OpenFreeMap positron) to EOX Sentinel-2 cloudless + AWS Terrain. The toggle, tiles, and paint overrides already exist — this is a one-line default change plus an e2e assertion sweep.
2. **A small game-mode framework with "Country Pinning" as the first mode.** Endless play, 3 lives, top-middle HUD showing a flag + country name, click the matching country on the map. Hybrid scoring: 100 points for an exact click, exponential decay by centroid distance otherwise. Mode registry + shared primitives designed so future modes (city guessing and others) land as a single folder with no refactor of the framework.

Both changes are independently shippable. PR 1 (satellite default) can land on its own.

---

## Part A — Satellite as Default

### Changes

- `src/App.tsx:22`: `useState(false)` → `useState(true)`.
- Update any e2e assertions that read `aria-pressed="false"` on `[data-testid="satellite-toggle"]` at initial load — they will now read `"true"`. Known candidates: accessibility spec, scaffold spec; audit all specs in `e2e/`.
- Add `e2e/satellite-default.spec.ts` (GPU project): first load has the satellite raster layer visible and the toggle pressed.

### Explicitly not changed

- No `localStorage` persistence of the user's toggle preference. Satellite is simply the default; if the user toggles off, that state lives in React for the session only.
- No new loading skeleton. MapLibre handles partial-load gracefully, and existing `BasemapBanner` + `MapErrorOverlay` already cover the error/slow path.
- No dark-mode contrast pass. `useSatelliteMode.ts:55-63` already overrides border colour to `rgba(255,255,255,0.35)` and adjusts fill opacity when satellite is on — independent of theme. Only touch this if smoke-testing surfaces a real issue.
- No change to the satellite button position, icon, or copy.
- No change to the terrain DEM behaviour (it remains coupled to the satellite toggle, per the 2026-04-16 globe/terrain design).

### Risks logged

- **Licence:** EOX Sentinel-2 cloudless is CC BY-NC-SA 4.0. Acceptable for a free non-commercial site; blocks future monetisation without a tile-source swap. Record as a project memory.
- **Mobile bandwidth:** raster tiles are heavier than positron vector tiles. The landing experience consumes more data by default. Acceptable trade-off for the headline visual; revisit if analytics show first-paint or bounce-rate regressions.
- **No documented rate limit** on EOX or AWS Terrain for static CDN-deployed traffic. Public services, respectful usage expected.

---

## Part B — Game-Mode Framework + Country Pinning

### Confirmed v1 scope

- **Session shape:** endless streak with 3 lives. No round timer. No mode selection beyond Country Pinning.
- **Scoring:** exact country = 100 points. Otherwise, exponential decay by centroid distance: `round(100 * exp(-distanceKm / 3000))`.
- **Miss semantics:** a "miss" is a click on any country that is not the target. Ocean clicks are no-ops (no guess, no life lost). Lives only deduct on a concrete wrong-country click.
- **Country pool:** the 194 independent countries in `countries.json` where `independent === true`. No dependent territories. No region / difficulty filters in v1.
- **Entry points:** (1) a new Play button in the header opens a tiny menu listing available modes; (2) URL hash `#game/country-pinning` and `#game/country-pinning/play` for deep links.
- **Persistence:** best score and best streak for Country Pinning in `localStorage`. No accounts, no server leaderboards — consistent with the no-backend project principle.
- **Accessibility:** keyboard play via a "Guess by name" button in the HUD that opens a Fuse.js-backed country search; Enter submits a guess equivalent to a map click. Announcements via the existing `funworldmap:announce` CustomEvent.

### Folder layout

```
src/game/
  GameController.tsx
  modes/
    index.ts
    country-pinning/
      index.ts
      CountryPinningHud.tsx
      roundGenerator.ts
      scoring.ts
      messages.ts
  shared/
    types.ts
    useGameSession.ts
    usePersonalBests.ts
    distance.ts
    hud/
      HudShell.tsx
      LivesIndicator.tsx
      ScoreBadge.tsx
      StreakBadge.tsx
      GuessByNameButton.tsx
      GameOverOverlay.tsx
```

### Types

```ts
// shared/types.ts
export type GameStatus = 'idle' | 'playing' | 'round-ended' | 'game-over'

export type RoundSpec = {
  targetCca3: string
  targetName: string
  targetFlag: string
  targetCentroid: [number, number]  // [lng, lat]
}

export type GuessOutcome = {
  correct: boolean
  pointsEarned: number
  livesDelta: -1 | 0
  reveal: {
    targetCca3: string
    clickedCca3: string | null
    distanceKm: number | null
  }
}

export type GameSession = {
  modeId: 'country-pinning'
  status: GameStatus
  lives: 0 | 1 | 2 | 3
  score: number
  streak: number
  bestStreak: number
  roundIndex: number
  currentRound: RoundSpec | null
  lastOutcome: GuessOutcome | null
  used: Set<string>
}

export type GameMode = {
  id: 'country-pinning'             // union grows as modes are added
  title: string
  description: string
  hashSegment: string               // 'country-pinning'
  HudComponent: React.FC<{ session: GameSession }>
  nextRound(used: Set<string>): RoundSpec
  onGuess(clickedCca3: string | null, round: RoundSpec): GuessOutcome
}
```

No generic parameters on `GameMode`. When city mode arrives we expand the `id` union and add a sibling folder.

### Session state machine

```
idle        → playing        start game (button or hash /play)
playing     → round-ended    map click = guess
round-ended → playing        after REVEAL_MS (1200ms, tunable)
round-ended → game-over      if lives hit 0 on that guess
game-over   → playing        Play again
game-over   → idle           Back to map
any         → idle           Escape key / hash navigate away
```

Single reducer in `useGameSession.ts`. No external state library.

### Wiring into the existing app

- `App.tsx` wraps its tree in a `<GameSessionProvider>` that owns the session reducer. This lets both `App.tsx` (for click branching) and `<GameController>` (for HUD/overlay rendering) read the same state via `useGameSession()`.
- `<GameController>` is a sibling of `<WorldMap>`. It reads/writes the URL hash, renders `HudShell` + mode-specific HUD when status is `playing` or `round-ended`, and renders `GameOverOverlay` when status is `game-over`.
- The existing `onMapSelect` in `App.tsx:32-44` already branches on `comparePickingMode`. Extend it to check game status: `if (game.status === 'playing') game.submitGuess(cca3); else ...existing`. No new prop or context on `WorldMap`; it keeps receiving a single `onSelect` callback.
- **Click behaviour during play.** `useMapInteractions.ts` registers two handlers: `clickCountry` (country layer → `onSelect`) and `clickMap` (any click → `onDeselect` when no feature). During gameplay, `onDeselect` is a no-op because `selected` is already null (GameController cleared it on game start). Ocean clicks therefore don't cost a life and don't disturb the HUD. No changes needed in `useMapInteractions.ts`.
- On `status` entering `playing`: clear `selected`, disable `comparePickingMode`, and `flyTo` the default world view (`DEFAULT_CENTER`, `DEFAULT_ZOOM`). This prevents a user zoomed into Europe being asked to pin Japan without the target in view.
- On `status` returning to `idle`: map and panel behave exactly as today.

### Country-pinning mode specifics

- **Pool:** 194 independent countries (verified: `countries.json` has `independent === true` on 194 rows).
- **No repeats within a session.** Session tracks `used: Set<string>`; if exhausted, silently reset.
- **Centroid:** `countries.json` stores `latlng: [lat, lng]`; `targetCentroid` swaps to `[lng, lat]` for MapLibre.
- **Scoring (`scoring.ts`):**

    ```ts
    export function scoreGuess(
      round: RoundSpec,
      clickedCca3: string,
      clickedCentroid: [number, number],
    ): GuessOutcome {
      if (clickedCca3 === round.targetCca3) {
        return { correct: true, pointsEarned: 100, livesDelta: 0,
                 reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm: 0 } }
      }
      const d = haversineKm(round.targetCentroid, clickedCentroid)
      const pts = Math.round(100 * Math.exp(-d / 3000))
      return { correct: false, pointsEarned: pts, livesDelta: -1,
               reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm: d } }
    }
    ```

- **Reference scoring curve:** 0 km = 100; 500 km ≈ 85; 2 000 km ≈ 51; 5 000 km ≈ 19; 10 000 km ≈ 4; 20 000 km ≈ 0. Tunable constant `3000` lives in `scoring.ts`.
- **Distance metric (explicit decision):** distance is measured between **country centroids** (target-country-centroid ↔ clicked-country-centroid), not click pixel. Rationale: the game is "pinning a country," so the scoring unit is countries. Edge case: clicking a country's overseas territory (e.g., French Guiana when the target is Brazil) scores as if the user clicked the country's mainland centroid. Acceptable for v1; revisit if playtesting flags it.
- **`REVEAL_MS = 1200`**, tunable.

### HUD and overlays

- `HudShell`: fixed top-centre container at `z-40` (below header `z-50`). Renders child mode HUD + status row (`LivesIndicator`, `ScoreBadge`, `StreakBadge`).
- `CountryPinningHud`: flag thumbnail (48px desktop / 36px mobile) + country name label + `GuessByNameButton`. During `round-ended`, renders a reveal line ("+87 points. Correct: France." or "Wrong. Correct: France. −1 life.").
- While the game is active, the `Header` hides the search bar and shows a compact "End game" button in its place. Passed via a new `Header` prop `gameActive: boolean`. The wordmark, theme toggle, and satellite toggle remain.
- Reveal animation: pulse the target polygon's `line-color` twice via `setPaintProperty` (matches the paint-swap pattern already in `useSatelliteMode`). On wrong guesses, briefly tint the clicked polygon red. `prefers-reduced-motion` disables pulses (static outline only).
- `GameOverOverlay`: centred card with final score, longest streak, personal best (with "new best!" badge if beaten), and two buttons (`Play again`, `Back to map`). Bottom-anchored card on mobile (< 1024px).
- **First-session tutorial:** a one-shot tooltip above the HUD on the first session, using the existing `sessionStorage` hint convention. Key: `funworldmap-game-tutorial-shown`.

### URL routing

Rewrite `src/lib/hashState.ts` to return a discriminated union. Current parser (23 lines) splits on commas and upper-cases, which would mangle a hash like `#game/country-pinning` — it cannot be patched, it must be rewritten.

```ts
export type HashState =
  | { kind: 'empty' }
  | { kind: 'country'; cca3: string; compareWith: string | null }
  | { kind: 'game'; modeId: string; playing: boolean }

export function parseHash(hash: string): HashState { /* ... */ }
export function writeHash(state: HashState): string  { /* ... */ }
```

Grammar:

- `#` / empty → `{ kind: 'empty' }`
- `#FRA` → `{ kind: 'country', cca3: 'FRA', compareWith: null }`
- `#FRA,DEU` → `{ kind: 'country', cca3: 'FRA', compareWith: 'DEU' }`
- `#game/country-pinning` → `{ kind: 'game', modeId: 'country-pinning', playing: false }`
- `#game/country-pinning/play` → `{ kind: 'game', modeId: 'country-pinning', playing: true }`

Starting a game pushes `/play`; ending a game pops back to `#game/country-pinning`; `Back to map` writes `#`. All existing hashes remain backward-compatible. `useSelectedCountry` consumers read only the `country` case; game routing is handled in `GameController`.

### Persistence

Keys aligned with the existing `funworldmap-*` convention:

```
funworldmap-game-country-pinning-bests → JSON { bestScore, bestStreak, gamesPlayed }
```

`usePersonalBests(modeId)` wraps `localStorage` with a graceful in-memory fallback (private-mode browsers). Writes debounced 200 ms. No mid-session state is persisted — a mid-game reload starts a fresh session (deliberate UX choice).

### Accessibility

- All status changes announced via the existing `funworldmap:announce` CustomEvent (`App.tsx:62-70`): round prompt, guess outcome (points + lives remaining), game-over summary. No new aria-live region.
- All interactive elements are `<button>` with visible focus rings.
- `GuessByNameButton` expands a country-search input backed by Fuse.js (already bundled for the header search) over the same country dataset, filtered to the remaining pool. Whether `SearchBar`'s index is directly reused or a parallel index is built is an implementation detail left to the plan. Enter submits a guess with the chosen country's centroid — identical code path to a map click.
- Escape exits the game (clears session, writes hash to `#`). Works alongside the existing Escape handler in `App.tsx:141-172`.
- `prefers-reduced-motion` disables reveal pulses and overlay slide animations.
- Colour-blind safety: lives use hearts with an `aria-label` count, not red/green only.

### Testing

**Unit (Vitest)**

- `distance.haversineKm`: Paris → Berlin ≈ 878 km; NY → LA ≈ 3 944 km; antipode ≈ 20 015 km.
- `scoring.scoreGuess`: exact = 100; 3 000 km → 37; 10 000 km → 4; antipode → 0.
- `useGameSession` reducer: life decrement on wrong guess; streak reset on wrong; game-over transition at 0 lives; `used` set prevents repeats; abort transitions from every status to `idle`.
- `hashState.parseHash` + `writeHash`: all five grammar cases round-trip.
- `roundGenerator.nextRound`: respects `used`; resets when exhausted.

**E2E (Playwright)**

Test hook: expose `window.__funworldmap_game` with `{ setRound(cca3), getSession(), endGame() }`. Parallel to existing `__funworldmap_map`. Exposed unconditionally — footprint is tiny and Playwright runs against the preview build.

- `e2e/game-country-pinning.spec.ts` (GPU project):
  - Enter via header Play button → HUD visible, search hidden, `data-game-mode="country-pinning"` on root.
  - Force target via `setRound('FRA')` → click France polygon → score 100, streak 1, lives 3.
  - Force target via `setRound('FRA')` → click a far polygon (e.g., AUS) → streak 0, lives 2, score incremented by a small value.
  - Lose 3 lives sequentially → `GameOverOverlay` appears with correct totals.
  - Click ocean → no state change.
  - Deep link `#game/country-pinning/play` → game is playing on first paint.
  - `GuessByNameButton` → type + Enter submits a guess identically.
  - Escape mid-game returns to idle and writes `#`.
- `e2e/satellite-default.spec.ts` (GPU project):
  - First load: `[data-testid="satellite-toggle"]` has `aria-pressed="true"`.
  - Satellite raster layer is visible (query `window.__funworldmap_map` layer visibility).
  - Clicking the toggle switches to vector basemap and back.

### Out of scope (v1)

- Share-score image / OG card / tweet card
- Sound effects
- Multiplayer / online leaderboard (would require backend — excluded by project principle)
- Region or difficulty filters for the country pool
- Neighbour-graph scoring bonus
- i18n of game strings (strings routed through `messages.ts` for future swap, but English only in v1)
- Mode-picker expansion beyond a single-item menu (grows when the second mode lands)

### Files touched

**New**

- `src/game/GameController.tsx`
- `src/game/modes/index.ts`
- `src/game/modes/country-pinning/index.ts`
- `src/game/modes/country-pinning/CountryPinningHud.tsx`
- `src/game/modes/country-pinning/roundGenerator.ts`
- `src/game/modes/country-pinning/scoring.ts`
- `src/game/modes/country-pinning/messages.ts`
- `src/game/shared/types.ts`
- `src/game/shared/useGameSession.ts`
- `src/game/shared/usePersonalBests.ts`
- `src/game/shared/distance.ts`
- `src/game/shared/hud/HudShell.tsx`
- `src/game/shared/hud/LivesIndicator.tsx`
- `src/game/shared/hud/ScoreBadge.tsx`
- `src/game/shared/hud/StreakBadge.tsx`
- `src/game/shared/hud/GuessByNameButton.tsx`
- `src/game/shared/hud/GameOverOverlay.tsx`
- `e2e/game-country-pinning.spec.ts`
- `e2e/satellite-default.spec.ts`
- Unit test files co-located with the modules under test.

**Modified**

- `src/App.tsx` — flip satellite default; mount `GameController`; branch `onMapSelect` on game status; pass `gameActive` prop to `Header`.
- `src/components/Header.tsx` — add Play button + mode menu; hide search bar and show "End game" button when `gameActive`.
- `src/lib/hashState.ts` — rewrite to discriminated union.
- `src/hooks/useSelectedCountry.ts` — adapt to the new `parseHash` return type (read only the `country` case).
- `e2e/` existing specs — update any `aria-pressed="false"` assertions on the satellite toggle.

### Shipping order

1. **PR 1 — Satellite default.** Small, independently shippable. Must land before PR 2 to keep the e2e delta on the satellite toggle focused.
2. **PR 2 — Game framework + Country Pinning.** Built on top of PR 1.

### Constraints

- Zero new npm dependencies. Haversine is ~20 lines; Fuse.js is already bundled.
- All existing accessibility features preserved (ARIA, keyboard, screen reader, reduced-motion).
- All existing `data-testid` attributes preserved.
- Bundle size increase: small (game folder + haversine). No large libraries.
- No backend, no external APIs at runtime — client-side only.
