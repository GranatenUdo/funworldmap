# City Guessing Game Mode

**Date:** 2026-04-19
**Status:** Draft — pending user review
**Depends on:** Game-mode framework shipped via the 2026-04-18 Country Pinning design.

## Overview

Second game mode for funworldmap. A round presents a city (flag + country + name), the user clicks the location on the map, the map reveals the actual city with a line showing the user's error, and the user is scored by distance. Fixed 10 rounds per game; score out of 1 000. Adds a mode picker to the header so users can choose between Country Pinning and City Guessing.

---

## Confirmed v1 scope

- **Session shape:** fixed 10 rounds. No lives. Game ends after round 10.
- **Scoring:** per-round `round(100 * exp(-distanceKm / 500))`. 0 km = 100; 50 km ≈ 90; 200 km ≈ 67; 500 km ≈ 37; 1 000 km ≈ 14; 2 000 km ≈ 2. Max score 1 000.
- **Prompt:** city name + country name + country flag (all three, stacked in the HUD).
- **Click semantics during play:** any map click is a guess, including ocean — unlike Country Pinning where ocean was a no-op.
- **Skip round:** a visible `Skip round` button submits a zero-score guess and advances. Keyboard-accessible.
- **Reveal:** on each guess, drop a pulsing marker at the correct city, draw a line from the click to the marker, and `flyTo` a bounding box containing both with ~15 % padding. Reveal lasts `REVEAL_MS = 2000 ms`, then the camera flies back to the world view and the next prompt shows.
- **Data source:** Natural Earth Populated Places (public domain). Top 500 by `scalerank`. Bundled at build time as `src/data/cities.json`. Join with existing `countries.json` for flag + country name (no duplication).
- **Pool:** all 500 cities globally. No region filter.
- **Persistence:** `localStorage` stores `bestTotalScore` (out of 1 000) per mode. Reuses `usePersonalBests`.
- **Post-game summary:** overlay shows total score / 1 000, total distance, round-by-round breakdown (distance + score), `Play again`, `Back to map`.
- **Mode picker:** header Play button opens a small popover with the two modes. Most-recently-played mode is remembered in `localStorage` (`funworldmap-game-last-mode`) and pre-selected.
- **URL routing:** `#game/city-guessing` and `#game/city-guessing/play` via the existing discriminated-union hash grammar. No parser changes.
- **Streak:** hidden for city mode. A 100-point round requires distance = 0, which is effectively impossible; the HUD simply doesn't render `StreakBadge`.

---

## Framework generalisations (required)

Country Pinning's framework assumed every mode shares its click contract, pool type, and lives-based end condition. All three must bend for City Guessing. Changes are minimal, backwards-compatible for Country Pinning, and keep each mode's folder self-contained.

### `src/game/shared/types.ts` — key changes

```ts
export type ModeId = 'country-pinning' | 'city-guessing'

export type GuessInput =
  | { kind: 'country'; cca3: string; centroid: [number, number] }
  | { kind: 'point';   lngLat: [number, number] }
  | { kind: 'skip' }

export type CountryRoundSpec = {
  kind: 'country-pinning'
  targetCca3: string
  targetName: string
  targetFlag: string
  targetCentroid: [number, number]
}

export type CityRoundSpec = {
  kind: 'city-guessing'
  targetName: string
  targetCountryName: string
  targetCountryFlag: string
  targetCentroid: [number, number]
}

export type RoundSpec = CountryRoundSpec | CityRoundSpec

export type CountryReveal = {
  kind: 'country'
  correct: boolean
  targetCca3: string
  clickedCca3: string | null
  distanceKm: number | null
}

export type PointReveal = {
  kind: 'point'
  targetCentroid: [number, number]
  clickedPoint: [number, number] | null
  distanceKm: number
}

export type ModeGuessResult = {
  pointsEarned: number
  livesDelta: -1 | 0
  reveal: CountryReveal | PointReveal
}

// Only the controller constructs this. `endsGame` is NOT the mode's concern.
export type GuessOutcome = ModeGuessResult & { endsGame: boolean }

export type GameSession = {
  modeId: ModeId
  status: GameStatus
  lives: 0 | 1 | 2 | 3
  score: number
  streak: number
  bestStreak: number
  roundIndex: number
  maxRounds: number | null       // null = endless (Country Pinning); 10 (City Guessing)
  currentRound: RoundSpec | null
  lastOutcome: GuessOutcome | null
  used: Set<string>
}

export type GameMode = {
  id: ModeId
  title: string
  description: string
  hashSegment: string
  maxRounds: number | null
  initialCameraView: 'world' | 'preserve'
  HudComponent: React.FC<{ session: GameSession }>
  nextRound(used: Set<string>): RoundSpec
  onGuess(input: GuessInput, round: RoundSpec): ModeGuessResult
}
```

### Reducer change (`useGameSession.ts`)

The `guess` case replaces its hard-coded lives check with the outcome's `endsGame` flag. The controller computes `endsGame` from session state (`lives + livesDelta <= 0` for Country Pinning; `roundIndex + 1 >= maxRounds` for City Guessing). Mode stays pure.

```ts
case 'guess': {
  const nextLives = Math.max(0, state.lives + action.outcome.livesDelta) as GameSession['lives']
  const nextStreak = action.outcome.pointsEarned >= 100 ? state.streak + 1 : 0
  return {
    ...state,
    status: action.outcome.endsGame ? 'game-over' : 'round-ended',
    lives: nextLives,
    score: state.score + action.outcome.pointsEarned,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    lastOutcome: action.outcome,
  }
}
```

### `HudShell` branching

```tsx
{session.maxRounds
  ? <RoundCounter current={session.roundIndex + 1} total={session.maxRounds} />
  : <LivesIndicator lives={session.lives} />}
<ScoreBadge score={session.score} />
{session.maxRounds ? null : <StreakBadge streak={session.streak} />}
```

### GameController — controller owns end-game logic

```ts
const result = mode.onGuess(input, session.currentRound)
const endsGame = session.maxRounds
  ? session.roundIndex + 1 >= session.maxRounds
  : session.lives + result.livesDelta <= 0
submitGuess({ ...result, endsGame })
```

### Click routing

- Country Pinning: `country-fill`-layer click handler in `useMapInteractions` dispatches via `App.tsx`'s `onMapSelect` as today.
- City Guessing: GameController adds a `map.on('click', …)` that fires `submitGuess({ kind: 'point', lngLat })`. Bound only while `session.modeId === 'city-guessing' && session.status === 'playing'`. The country-layer handler still fires but its path (`onMapSelect` → `__funworldmap_guess`) early-returns for city mode, so clicks count exactly once.

---

## City Guessing mode specifics

### Folder layout

```
src/game/modes/city-guessing/
  index.ts                    # mode definition + factory (getCityGuessingMode(cities))
  CityGuessingHud.tsx         # prompt (flag + country + city name), round counter, reveal line, skip button
  roundGenerator.ts           # no-repeat picker; resets when pool exhausted
  scoring.ts                  # exponential decay, DECAY_KM = 500
  messages.ts                 # English strings (i18n-ready)
```

### Data pipeline (`scripts/fetch-cities.ts`)

Build-time script, run manually like `scripts/fetch-countries.ts`:

1. Downloads (or reads vendored copy of) `ne_50m_populated_places_simple.geojson` from Natural Earth.
2. Parses features, sorts ascending by `scalerank` (lower = more important), takes top 500.
3. Maps each feature to a compact record:

    ```ts
    type CityRecord = {
      id: string                // `${countryCca3}-${slug(name)}` — unique key for `used` set
      name: string              // "Paris"
      countryCca3: string       // "FRA" (from adm0_a3)
      latlng: [number, number]  // [lat, lng]
      scalerank: number
    }
    ```

4. Writes `src/data/cities.json`. Expected size: ~50 KB unminified.
5. Resolves `countryName` and `flag` at app load by joining against `countries.json`'s `byCca3` map — no duplicated country strings in `cities.json`.

### `scoring.ts`

```ts
export const DECAY_KM = 500
export const MAX_DISTANCE_KM = 20_015

export function scoreCityGuess(
  input: GuessInput,
  round: CityRoundSpec,
): ModeGuessResult {
  if (input.kind === 'skip') {
    return {
      pointsEarned: 0,
      livesDelta: 0,
      reveal: { kind: 'point', targetCentroid: round.targetCentroid, clickedPoint: null, distanceKm: MAX_DISTANCE_KM },
    }
  }
  if (input.kind !== 'point') {
    // Defensive: city mode should never receive a country click.
    return { pointsEarned: 0, livesDelta: 0, reveal: { kind: 'point', targetCentroid: round.targetCentroid, clickedPoint: null, distanceKm: 0 } }
  }
  const distanceKm = haversineKm(round.targetCentroid, input.lngLat)
  const pointsEarned = Math.round(100 * Math.exp(-distanceKm / DECAY_KM))
  return {
    pointsEarned,
    livesDelta: 0,
    reveal: { kind: 'point', targetCentroid: round.targetCentroid, clickedPoint: input.lngLat, distanceKm },
  }
}
```

### HUD

```
┌─────────────────────────────────────────┐
│  Round 3 / 10    Score 270    [End]     │  (HudShell)
│                                         │
│   [🇫🇷] Paris                            │
│   France                                │  (CityGuessingHud)
│                                         │
│   [Skip round]                          │
│                                         │
│   ── round-ended reveal ──              │
│   You were 423 km off. +85 points.      │
└─────────────────────────────────────────┘
```

- Round counter and score come from `HudShell`.
- Flag size matches Country Pinning (48 px desktop / 36 px mobile).
- `Skip round` is always visible during `playing` state.
- Reveal line shown during `round-ended` state.
- `aria-live="polite"` announcement fires via the existing `funworldmap:announce` CustomEvent ("Round 3 of 10. Paris, France. Click anywhere on the map.")

### Camera and reveal animation

On each round start (when `mode.initialCameraView === 'world'`): `mapRef.current.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 700 })`. Prompt updates mid-flight.

On `round-ended`, the reveal effect:

1. Updates two GeoJSON sources added at game start:
   - `game-reveal-marker`: FeatureCollection with a single Point at `round.targetCentroid`. Paint: pulsing circle (radius 8 → 14 → 8 over 1 s), warm accent colour.
   - `game-reveal-line`: FeatureCollection with a single LineString from `clickedPoint` to `targetCentroid`. Paint: dashed warm-accent line, 2 px wide.
2. Computes a bounding box covering both points with ~15 % padding and calls `map.fitBounds(bbox, { duration: 1000, padding: 60 })`.
3. After `REVEAL_MS = 2000`, dispatches `advance(nextRound)`. On the next render, the mode's round-start effect flies back to the world view.

Reduced motion: pulse disabled; line appears without dash-animation; `fitBounds` keeps `duration: 0`.

### Skip button

```tsx
<button onClick={() => submitGuess({ kind: 'skip' })} data-testid="city-skip">Skip round</button>
```

No confirmation, no penalty beyond the zero score. Keyboard accessible via Tab.

---

## Mode picker UI

### Component

`src/components/PlayMenu.tsx` — controlled popover anchored to the header Play button.

- Trigger: the existing Play button in the header. Click opens the menu. Click outside / Escape / selection closes it.
- Items: `listModes()` output in order — most-recently-played first (from `funworldmap-game-last-mode`).
- Selection writes the hash via `writeHash({ kind: 'game', modeId, playing: true })`. The existing GameController hash listener starts the session.
- Keyboard: Tab moves into menu; Arrow keys navigate items; Enter starts; Escape closes.
- Mobile: same popover, full-width from the header.
- No routing via state — all transitions go through the hash so deep links stay consistent.

### Header changes

- Keep the Play button icon.
- Replace its `onClick` with menu open/close.
- Add `data-testid="header-play-menu"` on the popover for e2e.

### Last-played persistence

```
funworldmap-game-last-mode → 'country-pinning' | 'city-guessing'
```

Read on menu open, written on mode selection. Falls back to `'country-pinning'` if missing or corrupt.

---

## URL routing

No parser changes. The existing discriminated union accepts any `modeId` segment:

- `#game/country-pinning` / `#game/country-pinning/play` (existing)
- `#game/city-guessing` / `#game/city-guessing/play` (new)

Unknown mode ids resolve to `{ kind: 'game', modeId, playing }` but `getMode(id)` would throw if reached — the PlayMenu only writes known ids, and deep links to unknown ids fall through to a safe "no game" idle state (a small guard added in `GameController`).

---

## Testing

### Unit (Vitest)

- `city-guessing/scoring.test.ts`: 0 km → 100; 500 km ≈ 37 (tolerance ±3); 2 000 km ≈ 2; antipode → 0; `skip` input → zero score + max distance; `country`-input (defensive) → 0.
- `city-guessing/roundGenerator.test.ts`: no repeats within 10 calls; resets pool after exhaustion; deterministic with injected picker.
- `useGameSession.test.ts`: new cases for (a) game ends via `endsGame=true` regardless of lives; (b) round index increments to `maxRounds` and triggers game-over when endsGame is true; (c) country-pinning path unchanged.
- Controller end-game logic (integration): `roundIndex + 1 >= maxRounds` triggers `endsGame=true` in city mode.

### E2E (Playwright, chromium-gpu)

- `game-city-guessing.spec.ts`:
  - Enter via header Play menu → select City Guessing → HUD appears with "Round 1 / 10", score 0.
  - Deep link `#game/city-guessing/play` boots into playing.
  - Deterministic round: `window.__funworldmap_game.setRound('FRA-Paris')` → verify prompt shows "Paris" + "France".
  - Click at Paris's exact lng/lat via `map.fire('click', {lngLat: {lng: 2.35, lat: 48.86}})` → score = 100, reveal shows distance 0, round counter advances to "2 / 10" after reveal.
  - Click at [0, 0] (ocean) → score < 20, reveal line appears, distance labelled in HUD.
  - Skip button → score unchanged, counter advances, reveal shows "Skipped".
  - Play 10 rounds deterministically (loop of `setRound` + click) → `game-over` overlay visible, total score / 1000 rendered, round-by-round breakdown present, "new personal best" flag on first game.
  - `Back to map` → hash clears, HUD detaches.
  - Last-played mode: after finishing a City Guessing game and reopening the Play menu, City Guessing is the first item.

- `game-country-pinning.spec.ts` — unchanged; continues to pass via the `endsGame` generalisation.
- `satellite-default.spec.ts` — unchanged.

### Test hook additions

`window.__funworldmap_game.setRound(id: string)` gains city-mode support. For city mode, `id` is `${countryCca3}-${citySlug}`. For country mode, `id` remains the cca3. Implementation branches on the current mode.

---

## Files touched

**New:**
- `src/game/modes/city-guessing/index.ts`
- `src/game/modes/city-guessing/CityGuessingHud.tsx`
- `src/game/modes/city-guessing/roundGenerator.ts`
- `src/game/modes/city-guessing/scoring.ts`
- `src/game/modes/city-guessing/messages.ts`
- `src/game/modes/city-guessing/__tests__/scoring.test.ts`
- `src/game/modes/city-guessing/__tests__/roundGenerator.test.ts`
- `src/game/shared/hud/RoundCounter.tsx`
- `src/components/PlayMenu.tsx`
- `scripts/fetch-cities.ts`
- `src/data/cities.json` (generated artefact)
- `e2e/game-city-guessing.spec.ts`

**Modified:**
- `src/game/shared/types.ts` — ModeId union, discriminated `RoundSpec` + reveal, `GuessInput`, `GameSession.maxRounds`, `GameMode.initialCameraView`, split `ModeGuessResult` / `GuessOutcome`.
- `src/game/shared/useGameSession.ts` — reducer honours `outcome.endsGame`; `start` action takes `maxRounds`.
- `src/game/shared/hud/HudShell.tsx` — conditional `RoundCounter` vs `LivesIndicator`; hide `StreakBadge` when `maxRounds` is set.
- `src/game/GameController.tsx` — generalised `submitGuess` via `GuessInput`; map-click handler for city mode; reveal geometry sources + camera `fitBounds`; per-round `flyTo` world view when `mode.initialCameraView === 'world'`; computes `endsGame`.
- `src/game/modes/index.ts` — second case in `getMode` switch; new `listModes` entry.
- `src/game/modes/country-pinning/index.ts` — `onGuess` adapted to new `GuessInput` contract (destructures `kind: 'country'`, ignores others defensively).
- `src/game/modes/country-pinning/scoring.ts` — returns `ModeGuessResult`; no `endsGame` field.
- `src/components/Header.tsx` — Play button triggers `PlayMenu` popover.
- `package.json` — new script `"fetch-cities": "tsx scripts/fetch-cities.ts"`.

**Unchanged:**
- `src/hooks/useSelectedCountry.ts`, `src/lib/hashState.ts` (grammar already supports arbitrary `modeId`).
- All map-source / tile configuration.
- `src/game/shared/distance.ts`, `src/game/shared/usePersonalBests.ts`.

---

## Risks

- **Natural Earth data freshness.** The dataset is occasionally updated; our build script is manual. If a city's lat/lng shifts, we'd need to regenerate `cities.json`. Low risk — Natural Earth is stable year-to-year.
- **"City is in the ocean" confusion.** If the reveal marker lands on a coastal city (Lisbon, Sydney), the line from an ocean click may visually clip the city's land. Acceptable; purely cosmetic.
- **Reveal animation cost on mobile.** `fitBounds` triggers MapLibre redraws. 10 rounds × 1 s flyTo = 10 s of animation per game on mobile. Acceptable based on Country Pinning's flyTo-on-game-start already being tested on mobile.
- **First-paint latency.** `cities.json` is ~50 KB — trivial. No observable impact.
- **Framework blast radius.** The `RoundSpec` union and `GuessInput` change touch Country Pinning's mode file. Tests (unit + e2e) must confirm unchanged behaviour there.

---

## Out of scope (v1)

All deferred items go to `docs/roadmap.md`. In this spec for reference only:

- Region / difficulty filters ("Europe only", "Capitals only")
- Multiplayer or online leaderboard (violates the no-backend principle)
- Share-score image / OG card / tweet card
- Sound effects
- i18n of game strings (English only; strings routed through `messages.ts` for future swap)
- Adjustable round count (fixed at 10 for v1)
- Population / tooltips / metadata shown alongside the reveal marker
- Per-round timer
- Difficulty tiers (beginner pool of ~50 capitals, hard pool of lesser-known cities)
- Camera animation smoothness knob beyond `prefers-reduced-motion`

---

## Shipping order

Single PR. Framework changes (types, reducer, HudShell, PlayMenu) ship atomically with the City Guessing mode — splitting would briefly break Country Pinning mid-way through.

---

## Constraints

- Zero new npm dependencies.
- All existing accessibility features preserved (ARIA, keyboard, screen reader, reduced-motion).
- All existing `data-testid` attributes preserved. New testids: `round-counter`, `city-skip`, `game-reveal-line`, `header-play-menu`.
- Bundle size increase: ~50 KB for `cities.json`, plus ~15 KB for the mode code. Net ~65 KB raw / ~20 KB gzip.
- No backend, no external runtime API calls — `cities.json` is bundled at build.
