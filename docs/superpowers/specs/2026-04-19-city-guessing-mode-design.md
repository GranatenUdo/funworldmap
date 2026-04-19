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
- **Reveal:** on each guess, drop a static warm-accent marker at the correct city, draw a dashed line from the click to the marker, and `fitBounds` around both points with viewport-relative padding (`clamp(40, viewport min / 10, 120)` pixels). Reveal lasts `REVEAL_MS = 2000 ms`, then the camera flies back to the world view and the next prompt shows. A pulsing / animated marker is deferred to a future polish PR — see `docs/roadmap.md`.
- **Data source:** Natural Earth Populated Places (public domain). Top 500 sorted by `(scalerank ASC, pop_max DESC)` — deterministic. Bundled at build time as `src/data/cities.json` with country name and flag path included per record (no runtime join).
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

### Deep-link vs pool-load race

A user landing on `#game/city-guessing/play` before `cities.json` finishes loading would crash `getMode` (empty pool). Guard: `GameController` treats the hash as pending until `cityPool.length > 0`, then calls `start()`. Country Pinning inherits the same guard via `countryPool.length > 0`. Small extra check in the bootstrap effect; no user-visible delay beyond network latency.

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
2. Parses features, sorts ascending by `(scalerank ASC, pop_max DESC)`, takes top 500. Deterministic tie-break.
3. For each feature, joins `adm0_a3` against `countries.json`'s `byCca3` map **once at build time** to inline the country's common name and flag path into the city record — no runtime join, one fewer cross-dataset dependency.
4. Maps each feature to a compact record:

    ```ts
    type CityRecord = {
      id: string                // `${countryCca3}-${slug(name)}` — unique key for `used` set
      name: string              // "Paris"
      countryCca3: string       // "FRA" (from adm0_a3)
      countryName: string       // "France" (joined at build from countries.json)
      countryFlag: string       // "flags/FR.svg" (joined at build)
      latlng: [number, number]  // [lat, lng]
      scalerank: number
    }
    ```

5. Verifies that all 500 `id` values are unique; fails the build with a clear error listing any collisions so the fetch script can pick a disambiguating strategy (e.g., append ADM1/state). Natural Earth top-500 is expected to be collision-free, but verification is cheap insurance.
6. Writes `src/data/cities.json`. Expected size: ~75 KB unminified (~25 KB gzip). Country-data inlining adds ~25 KB over the join-at-runtime approach; saves a runtime dependency and simplifies the mode factory.

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
   - `game-reveal-marker`: FeatureCollection with a single Point at `round.targetCentroid`. Paint: static circle, 10 px radius, warm-accent fill, white stroke.
   - `game-reveal-line`: FeatureCollection with a single LineString from `clickedPoint` to `targetCentroid`. Paint: dashed warm-accent line, 2 px wide.
2. Computes a bounding box covering both points and calls `map.fitBounds(bbox, { duration: 1000, padding })` where `padding = Math.max(40, Math.min(120, Math.min(viewportWidth, viewportHeight) * 0.1))` pixels — viewport-relative, clamped.
3. After `REVEAL_MS = 2000`, dispatches `advance(nextRound)`. On the next render, the mode's round-start effect flies back to the world view.

Reduced motion: `fitBounds` uses `duration: 0`; line appears statically.

### Reveal geometry cleanup

`game-reveal-marker` and `game-reveal-line` sources are added on game start and removed on **any** transition into `idle` (`endGame()`, Escape, hash navigate-away). A dedicated `useEffect` in `GameController` handles teardown. Prevents a stale line/marker from a prior game appearing on the map after "Back to map".

### Skip button

```tsx
<button onClick={() => submitGuess({ kind: 'skip' })} data-testid="city-skip">Skip round</button>
```

No confirmation, no penalty beyond the zero score. Keyboard accessible via Tab.

---

## Mode picker UI

### Component

`src/components/PlayMenu.tsx` — controlled popover anchored to the header Play button.

- Trigger: the existing Play button. Click opens the menu. Click outside / Escape / selection closes it.
- Items: `listModes()` output in order — most-recently-played first (from `funworldmap-game-last-mode`).
- Selection writes the hash via `writeHash({ kind: 'game', modeId, playing: true })`. The existing GameController hash listener starts the session.
- Unknown / corrupt `funworldmap-game-last-mode` value falls back to `'country-pinning'`.
- Mobile: same popover, full-width from the header.
- No routing via component state — all transitions go through the hash so deep links stay consistent.

### A11y contract

- Trigger button: `aria-haspopup="menu"`, `aria-expanded={open}`, `aria-controls="play-menu"`.
- Popover: `role="menu"`, `aria-orientation="vertical"`, `id="play-menu"`.
- Items: `role="menuitem"`, each focusable via Arrow keys.
- Open: first menu item is auto-focused.
- Close: Escape, outside click, or selection. Focus returns to the trigger button.
- Arrow Up/Down cycles items; Home/End jumps to first/last; Enter activates.

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

- `window.__funworldmap_game.setRound(id: string)` gains city-mode support. For city mode, `id` is `${countryCca3}-${citySlug}`. For country mode, `id` remains the cca3. Implementation branches on the current mode.
- **New:** `window.__funworldmap_game.submitGuess(input: GuessInput)` — passes the input straight through to the controller's submit path. Lets a single e2e surface simulate any mode's interaction (country click, point click, skip). Existing `window.__funworldmap_guess(cca3)` stays as an alias for Country Pinning compat — delegates to `submitGuess({ kind: 'country', cca3, centroid })`.

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
- **Reveal marker animation** (pulse / breathing effect) — dropped from v1 in favour of the simpler static marker; can land later without framework changes
- **Runtime country-data join** — if `cities.json` grows enough that the ~25 KB of inlined country names/flags starts to matter, we can switch to a runtime join against `countries.json`'s `byCca3` map

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
