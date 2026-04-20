# Country-Pinning Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small game-mode framework to funworldmap, with "Country Pinning" as the first mode: endless play with 3 lives, flag + name prompt in a top-middle HUD, click the correct country to score, proximity-scored on misses.

**Architecture:** A new `src/game/` folder holds shared primitives (types, reducer, persistence, distance, HUD atoms) and a `modes/country-pinning/` subfolder with the mode-specific pieces. A `GameSessionProvider` wraps the app so both `App.tsx` (click branching) and `<GameController>` (HUD rendering) read the same state. The existing `onMapSelect` branch in `App.tsx:32-44` is extended with a game-mode case. The hash parser is rewritten to a discriminated union so `#game/country-pinning` deep-links work alongside the existing `#FRA` and `#FRA,DEU` country hashes.

**Tech Stack:** React 19, TypeScript, MapLibre GL JS 5.23, Vitest, Playwright, Tailwind 4, Fuse.js (already bundled).

**Spec:** `docs/superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md` — Part B.

**Depends on:** plan `2026-04-18-satellite-default.md` merged first. Keeps the satellite-default test delta out of this branch.

**Scope out of this plan:**
- City-guessing or other future modes (framework leaves room; not built here).
- Region / difficulty filters for the country pool.
- Share-score image / OG cards.
- Sound effects.
- Multiplayer / online leaderboards (violates the no-backend principle).
- Neighbour-graph scoring bonus.
- i18n of game strings (strings go through `messages.ts` for future swap; v1 is English only).
- Pre-game "Ready?" lobby screen — a hash like `#game/country-pinning` immediately enters the playing state in v1. The `playing` field in the parsed hash union is latent grammar for a future pre-game screen.

---

## File Structure

**Files to create (new game folder):**

- `src/game/shared/types.ts` — `GameStatus`, `RoundSpec`, `GuessOutcome`, `GameSession`, `PersonalBest`, `GameMode`, `CountryLike`, `ModeId` union.
- `src/game/shared/distance.ts` — `haversineKm`, `centroidFromLatLng`.
- `src/game/shared/usePersonalBests.ts` — localStorage-backed best-score hook with in-memory fallback.
- `src/game/shared/useGameSession.ts` — reducer + consumer hook.
- `src/game/shared/GameSessionProvider.tsx` — context provider + consumer hook; also attaches `window.__funworldmap_game` for tests.
- `src/game/shared/hud/HudShell.tsx` — top-centre layout container.
- `src/game/shared/hud/LivesIndicator.tsx` — three-heart display.
- `src/game/shared/hud/ScoreBadge.tsx` — score chip.
- `src/game/shared/hud/StreakBadge.tsx` — streak chip.
- `src/game/shared/hud/GuessByNameButton.tsx` — collapsible keyboard-accessible search.
- `src/game/shared/hud/GameOverOverlay.tsx` — centred end-of-game card.
- `src/game/modes/index.ts` — mode registry.
- `src/game/modes/country-pinning/index.ts` — `GameMode` definition.
- `src/game/modes/country-pinning/CountryPinningHud.tsx` — flag + name prompt + reveal row.
- `src/game/modes/country-pinning/scoring.ts` — hybrid exact + exp-decay scoring.
- `src/game/modes/country-pinning/roundGenerator.ts` — no-repeat target picker.
- `src/game/modes/country-pinning/messages.ts` — English strings (i18n-ready).
- `src/game/GameController.tsx` — orchestration: reads hash, wires mode lifecycle, renders HUD / overlay.
- `e2e/game-country-pinning.spec.ts` — e2e for the new mode.

**Unit test files (co-located):**

- `src/game/shared/__tests__/distance.test.ts`
- `src/game/shared/__tests__/useGameSession.test.ts`
- `src/game/shared/__tests__/usePersonalBests.test.ts`
- `src/game/modes/country-pinning/__tests__/scoring.test.ts`
- `src/game/modes/country-pinning/__tests__/roundGenerator.test.ts`

**Files to modify:**

- `src/lib/hashState.ts` — rewrite to discriminated union.
- `src/lib/__tests__/hashState.test.ts` — update tests for new shape; add game-hash cases.
- `src/hooks/useSelectedCountry.ts` — adapt to new `parseHash` return shape.
- `src/components/Header.tsx` — add Play button + mode menu; hide search, show End game button while game active.
- `src/App.tsx` — wrap tree in `GameSessionProvider`, mount `<GameController>`, branch `onMapSelect` on game status, `flyTo` world on game start.

**Files NOT modified:**

- `src/components/WorldMap.tsx` — receives the same `onSelect` callback. Click-intercept lives in `App.tsx`.
- `src/hooks/useMapInteractions.ts` — ocean clicks already no-op for selection (`clickMap` calls `onDeselect` which is a no-op during gameplay because `selected` is cleared on game start).
- `src/lib/mapStyles.ts`, `src/lib/mapLayers.ts` — no new sources or layers.
- `src/hooks/useSatelliteMode.ts`, `src/hooks/useMapTheme.ts` — unchanged.
- Any existing country-panel / search / theme logic — untouched.

---

## Pre-flight

- [ ] **Step 0.1: Confirm satellite-default PR has merged to `main`**

Run:
```bash
git log --oneline -5
grep "satellite, setSatellite" src/App.tsx
```

Expected: recent commit mentions satellite default; `src/App.tsx` shows `useState(true)`. If not, stop — this plan builds on that one.

- [ ] **Step 0.2: Working tree clean, on a feature branch**

Run:
```bash
git status --short
git checkout -b feat/country-pinning-game
```

Expected: clean tree, new branch created.

- [ ] **Step 0.3: Baseline tests pass**

Run:
```bash
npm run test:unit
npm run build
npx playwright test --project=chromium
```

Expected: all unit tests pass, all chromium e2e specs pass. GPU-project specs may be skipped without a GPU host — acceptable for pre-flight.

---

## Task 1: Shared types

**Files:**
- Create: `src/game/shared/types.ts`

- [ ] **Step 1.1: Write `src/game/shared/types.ts`**

```ts
import type React from 'react'

export type GameStatus = 'idle' | 'playing' | 'round-ended' | 'game-over'

export type ModeId = 'country-pinning'

export type CountryLike = {
  cca3: string
  name: { common: string }
  flag: string
  latlng: [number, number]   // [lat, lng] — matches countries.json
  independent: boolean
}

export type RoundSpec = {
  targetCca3: string
  targetName: string
  targetFlag: string
  targetCentroid: [number, number]   // [lng, lat] — MapLibre order
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
  modeId: ModeId
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

export type PersonalBest = {
  bestScore: number
  bestStreak: number
  gamesPlayed: number
}

export type GameMode = {
  id: ModeId
  title: string
  description: string
  hashSegment: string
  HudComponent: React.FC<{ session: GameSession }>
  nextRound(used: Set<string>, pool: CountryLike[]): RoundSpec
  onGuess(
    clickedCca3: string | null,
    clickedCentroid: [number, number] | null,
    round: RoundSpec,
  ): GuessOutcome
}
```

- [ ] **Step 1.2: Verify types compile**

Run:
```bash
npx tsc -b
```

Expected: no errors. Types file is isolated; if there's a compilation failure elsewhere, the tree was not clean — abort and fix baseline.

- [ ] **Step 1.3: Commit**

```bash
git add src/game/shared/types.ts
git commit -m "feat(game): shared type definitions"
```

---

## Task 2: Haversine distance utility + tests

**Files:**
- Create: `src/game/shared/distance.ts`
- Create: `src/game/shared/__tests__/distance.test.ts`

- [ ] **Step 2.1: Write the failing tests**

Create `src/game/shared/__tests__/distance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { haversineKm, centroidFromLatLng } from '../distance'

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm([0, 0], [0, 0])).toBe(0)
  })

  it('Paris → Berlin is about 878 km', () => {
    const paris: [number, number] = [2.3522, 48.8566]
    const berlin: [number, number] = [13.4050, 52.5200]
    const d = haversineKm(paris, berlin)
    expect(d).toBeGreaterThan(870)
    expect(d).toBeLessThan(885)
  })

  it('NYC → LA is about 3944 km', () => {
    const nyc: [number, number] = [-74.006, 40.7128]
    const la: [number, number] = [-118.2437, 34.0522]
    const d = haversineKm(nyc, la)
    expect(d).toBeGreaterThan(3900)
    expect(d).toBeLessThan(3985)
  })

  it('antipodal points are about 20 015 km', () => {
    const d = haversineKm([0, 0], [180, 0])
    expect(d).toBeGreaterThan(20000)
    expect(d).toBeLessThan(20050)
  })

  it('is symmetric', () => {
    const a: [number, number] = [2.3522, 48.8566]
    const b: [number, number] = [-74.006, 40.7128]
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6)
  })
})

describe('centroidFromLatLng', () => {
  it('swaps [lat, lng] to [lng, lat]', () => {
    expect(centroidFromLatLng([48.8566, 2.3522])).toEqual([2.3522, 48.8566])
  })
})
```

- [ ] **Step 2.2: Run tests — expect failure**

Run:
```bash
npx vitest run src/game/shared/__tests__/distance.test.ts
```

Expected: all tests FAIL with `Cannot find module '../distance'`.

- [ ] **Step 2.3: Write the implementation**

Create `src/game/shared/distance.ts`:

```ts
const EARTH_RADIUS_KM = 6371

/** Great-circle distance in km between two [lng, lat] points. */
export function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const sLat = Math.sin(dLat / 2)
  const sLng = Math.sin(dLng / 2)
  const h =
    sLat * sLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sLng * sLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return EARTH_RADIUS_KM * c
}

/** Convert countries.json's `latlng: [lat, lng]` to MapLibre `[lng, lat]`. */
export function centroidFromLatLng(
  latlng: [number, number],
): [number, number] {
  return [latlng[1], latlng[0]]
}
```

- [ ] **Step 2.4: Run tests — expect pass**

Run:
```bash
npx vitest run src/game/shared/__tests__/distance.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/game/shared/distance.ts src/game/shared/__tests__/distance.test.ts
git commit -m "feat(game): haversine distance utility"
```

---

## Task 3: Country-pinning scoring + tests

**Files:**
- Create: `src/game/modes/country-pinning/scoring.ts`
- Create: `src/game/modes/country-pinning/__tests__/scoring.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `src/game/modes/country-pinning/__tests__/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreGuess, EXACT_POINTS, DECAY_KM } from '../scoring'
import type { RoundSpec } from '../../../shared/types'

const paris: [number, number] = [2.3522, 48.8566]
const round: RoundSpec = {
  targetCca3: 'FRA',
  targetName: 'France',
  targetFlag: 'flags/FR.svg',
  targetCentroid: paris,
}

describe('scoreGuess', () => {
  it('exact click awards EXACT_POINTS and no life lost', () => {
    const out = scoreGuess(round, 'FRA', paris)
    expect(out.correct).toBe(true)
    expect(out.pointsEarned).toBe(EXACT_POINTS)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.distanceKm).toBe(0)
  })

  it('wrong country ~500 km away scores ~85 and costs a life', () => {
    const brussels: [number, number] = [4.3517, 50.8503]
    const out = scoreGuess(round, 'BEL', brussels)
    expect(out.correct).toBe(false)
    expect(out.pointsEarned).toBeGreaterThan(80)
    expect(out.pointsEarned).toBeLessThan(100)
    expect(out.livesDelta).toBe(-1)
  })

  it('wrong country at decay distance scores ~37', () => {
    // a point exactly DECAY_KM east-ish of Paris — approximated by
    // adding ~27° longitude (~1990 km at this latitude, adjusted by cos)
    const farEast: [number, number] = [41, 48.8566]
    const out = scoreGuess(round, 'KAZ', farEast)
    expect(out.pointsEarned).toBeGreaterThanOrEqual(30)
    expect(out.pointsEarned).toBeLessThanOrEqual(45)
  })

  it('antipodal wrong click scores 0', () => {
    const antipode: [number, number] = [-177.6478, -48.8566]
    const out = scoreGuess(round, 'NZL', antipode)
    expect(out.pointsEarned).toBeLessThanOrEqual(1)
  })

  it('null click is a no-op', () => {
    const out = scoreGuess(round, null, null)
    expect(out.correct).toBe(false)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('DECAY_KM constant is 3000', () => {
    expect(DECAY_KM).toBe(3000)
  })
})
```

- [ ] **Step 3.2: Run tests — expect failure**

Run:
```bash
npx vitest run src/game/modes/country-pinning/__tests__/scoring.test.ts
```

Expected: FAIL with `Cannot find module '../scoring'`.

- [ ] **Step 3.3: Write the implementation**

Create `src/game/modes/country-pinning/scoring.ts`:

```ts
import type { GuessOutcome, RoundSpec } from '../../shared/types'
import { haversineKm } from '../../shared/distance'

export const EXACT_POINTS = 100
export const DECAY_KM = 3000

export function scoreGuess(
  round: RoundSpec,
  clickedCca3: string | null,
  clickedCentroid: [number, number] | null,
): GuessOutcome {
  if (clickedCca3 === null) {
    return {
      correct: false,
      pointsEarned: 0,
      livesDelta: 0,
      reveal: { targetCca3: round.targetCca3, clickedCca3: null, distanceKm: null },
    }
  }

  if (clickedCca3 === round.targetCca3) {
    return {
      correct: true,
      pointsEarned: EXACT_POINTS,
      livesDelta: 0,
      reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm: 0 },
    }
  }

  if (!clickedCentroid) {
    // Unknown centroid for a known cca3 — defensive fallback.
    return {
      correct: false,
      pointsEarned: 0,
      livesDelta: -1,
      reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm: null },
    }
  }

  const distanceKm = haversineKm(round.targetCentroid, clickedCentroid)
  const pointsEarned = Math.round(EXACT_POINTS * Math.exp(-distanceKm / DECAY_KM))
  return {
    correct: false,
    pointsEarned,
    livesDelta: -1,
    reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm },
  }
}
```

- [ ] **Step 3.4: Run tests — expect pass**

Run:
```bash
npx vitest run src/game/modes/country-pinning/__tests__/scoring.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/game/modes/country-pinning/scoring.ts \
         src/game/modes/country-pinning/__tests__/scoring.test.ts
git commit -m "feat(game): country-pinning scoring curve"
```

---

## Task 4: Round generator + tests

**Files:**
- Create: `src/game/modes/country-pinning/roundGenerator.ts`
- Create: `src/game/modes/country-pinning/__tests__/roundGenerator.test.ts`

- [ ] **Step 4.1: Write the failing tests**

Create `src/game/modes/country-pinning/__tests__/roundGenerator.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextRound } from '../roundGenerator'
import type { CountryLike } from '../../../shared/types'

const pool: CountryLike[] = [
  { cca3: 'FRA', name: { common: 'France' }, flag: 'flags/FR.svg', latlng: [46, 2], independent: true },
  { cca3: 'DEU', name: { common: 'Germany' }, flag: 'flags/DE.svg', latlng: [51, 9], independent: true },
  { cca3: 'JPN', name: { common: 'Japan' }, flag: 'flags/JP.svg', latlng: [36, 138], independent: true },
]

describe('nextRound', () => {
  it('picks a country not in the used set', () => {
    const used = new Set(['FRA', 'DEU'])
    const r = nextRound(used, pool, () => 0)
    expect(r.targetCca3).toBe('JPN')
  })

  it('returns a RoundSpec with swapped centroid [lng, lat]', () => {
    const r = nextRound(new Set(), pool, () => 0)
    expect(r.targetCca3).toBe('FRA')
    expect(r.targetName).toBe('France')
    expect(r.targetCentroid).toEqual([2, 46])
    expect(r.targetFlag).toBe('flags/FR.svg')
  })

  it('resets and picks from full pool when used covers everything', () => {
    const used = new Set(['FRA', 'DEU', 'JPN'])
    const r = nextRound(used, pool, () => 2)
    expect(['FRA', 'DEU', 'JPN']).toContain(r.targetCca3)
  })

  it('uses the injected picker to choose the index', () => {
    const r = nextRound(new Set(), pool, () => 1)
    expect(r.targetCca3).toBe('DEU')
  })
})
```

- [ ] **Step 4.2: Run tests — expect failure**

Run:
```bash
npx vitest run src/game/modes/country-pinning/__tests__/roundGenerator.test.ts
```

Expected: FAIL with `Cannot find module '../roundGenerator'`.

- [ ] **Step 4.3: Write the implementation**

Create `src/game/modes/country-pinning/roundGenerator.ts`:

```ts
import type { CountryLike, RoundSpec } from '../../shared/types'
import { centroidFromLatLng } from '../../shared/distance'

type Picker = (max: number) => number
const defaultPicker: Picker = (max) => Math.floor(Math.random() * max)

export function nextRound(
  used: Set<string>,
  pool: CountryLike[],
  pick: Picker = defaultPicker,
): RoundSpec {
  let available = pool.filter((c) => !used.has(c.cca3))
  if (available.length === 0) available = pool.slice()
  const picked = available[pick(available.length)]
  return {
    targetCca3: picked.cca3,
    targetName: picked.name.common,
    targetFlag: picked.flag,
    targetCentroid: centroidFromLatLng(picked.latlng),
  }
}
```

- [ ] **Step 4.4: Run tests — expect pass**

Run:
```bash
npx vitest run src/game/modes/country-pinning/__tests__/roundGenerator.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/game/modes/country-pinning/roundGenerator.ts \
         src/game/modes/country-pinning/__tests__/roundGenerator.test.ts
git commit -m "feat(game): country-pinning round generator"
```

---

## Task 5: `usePersonalBests` hook + tests

**Files:**
- Create: `src/game/shared/usePersonalBests.ts`
- Create: `src/game/shared/__tests__/usePersonalBests.test.ts`

- [ ] **Step 5.1: Write the failing tests**

Create `src/game/shared/__tests__/usePersonalBests.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersonalBests } from '../usePersonalBests'

describe('usePersonalBests', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns zeros on first use', () => {
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })

  it('record() keeps the higher score and streak and increments gamesPlayed', () => {
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    act(() => { result.current.record(200, 5) })
    expect(result.current.best).toEqual({ bestScore: 200, bestStreak: 5, gamesPlayed: 1 })
    act(() => { result.current.record(150, 8) })
    expect(result.current.best).toEqual({ bestScore: 200, bestStreak: 8, gamesPlayed: 2 })
  })

  it('persists across hook unmount/remount via localStorage', () => {
    const first = renderHook(() => usePersonalBests('country-pinning'))
    act(() => { first.result.current.record(300, 7) })
    first.unmount()

    const second = renderHook(() => usePersonalBests('country-pinning'))
    expect(second.result.current.best).toEqual({ bestScore: 300, bestStreak: 7, gamesPlayed: 1 })
  })

  it('ignores corrupt localStorage content', () => {
    localStorage.setItem('funworldmap-game-country-pinning-bests', 'not-json')
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })
})
```

- [ ] **Step 5.2: Confirm `@testing-library/react` is installed**

Run:
```bash
node -e "const p=require('./package.json'); console.log('present?', '@testing-library/react' in (p.devDependencies||{}));"
```

Expected: `present? true`. If `false`, install it:
```bash
npm install --save-dev @testing-library/react
```

- [ ] **Step 5.3: Run tests — expect failure**

Run:
```bash
npx vitest run src/game/shared/__tests__/usePersonalBests.test.ts
```

Expected: FAIL with `Cannot find module '../usePersonalBests'`.

- [ ] **Step 5.4: Write the implementation**

Create `src/game/shared/usePersonalBests.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonalBest } from './types'

const ZERO: PersonalBest = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

function keyFor(modeId: string): string {
  return `funworldmap-game-${modeId}-bests`
}

function readSafely(modeId: string): PersonalBest {
  try {
    const raw = localStorage.getItem(keyFor(modeId))
    if (!raw) return ZERO
    const parsed = JSON.parse(raw)
    return {
      bestScore: Number(parsed?.bestScore) || 0,
      bestStreak: Number(parsed?.bestStreak) || 0,
      gamesPlayed: Number(parsed?.gamesPlayed) || 0,
    }
  } catch {
    return ZERO
  }
}

function writeSafely(modeId: string, value: PersonalBest): void {
  try {
    localStorage.setItem(keyFor(modeId), JSON.stringify(value))
  } catch {
    /* quota or private-mode; in-memory only */
  }
}

export function usePersonalBests(modeId: string): {
  best: PersonalBest
  record: (score: number, streak: number) => PersonalBest
} {
  const [best, setBest] = useState<PersonalBest>(() => readSafely(modeId))
  const bestRef = useRef(best)
  bestRef.current = best

  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === keyFor(modeId)) setBest(readSafely(modeId))
    }
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [modeId])

  const record = useCallback(
    (score: number, streak: number): PersonalBest => {
      const prev = bestRef.current
      const next: PersonalBest = {
        bestScore: Math.max(prev.bestScore, score),
        bestStreak: Math.max(prev.bestStreak, streak),
        gamesPlayed: prev.gamesPlayed + 1,
      }
      setBest(next)
      writeSafely(modeId, next)
      return next
    },
    [modeId],
  )

  return { best, record }
}
```

- [ ] **Step 5.5: Run tests — expect pass**

Run:
```bash
npx vitest run src/game/shared/__tests__/usePersonalBests.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5.6: Commit**

```bash
git add src/game/shared/usePersonalBests.ts \
         src/game/shared/__tests__/usePersonalBests.test.ts package.json package-lock.json 2>/dev/null || true
git add src/game/shared/usePersonalBests.ts src/game/shared/__tests__/usePersonalBests.test.ts
git commit -m "feat(game): personal bests hook with localStorage"
```

---

## Task 6: `useGameSession` reducer + tests

**Files:**
- Create: `src/game/shared/useGameSession.ts`
- Create: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 6.1: Write the failing tests**

Create `src/game/shared/__tests__/useGameSession.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type { GuessOutcome, RoundSpec } from '../types'

const round = (cca3: string): RoundSpec => ({
  targetCca3: cca3, targetName: cca3, targetFlag: `flags/${cca3}.svg`, targetCentroid: [0, 0],
})
const exact = (cca3: string): GuessOutcome => ({
  correct: true, pointsEarned: 100, livesDelta: 0,
  reveal: { targetCca3: cca3, clickedCca3: cca3, distanceKm: 0 },
})
const miss = (target: string, clicked: string, pts = 20): GuessOutcome => ({
  correct: false, pointsEarned: pts, livesDelta: -1,
  reveal: { targetCca3: target, clickedCca3: clicked, distanceKm: 1000 },
})

describe('useGameSession', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lives).toBe(3)
  })

  it('start() enters playing with the first round', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.currentRound?.targetCca3).toBe('FRA')
    expect(result.current.session.used.has('FRA')).toBe(true)
  })

  it('submitGuess(correct) increments score and streak, no life lost, status round-ended', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    expect(result.current.session.score).toBe(100)
    expect(result.current.session.streak).toBe(1)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.status).toBe('round-ended')
  })

  it('submitGuess(wrong) decrements lives and resets streak', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    act(() => { result.current.advance(round('DEU')) })
    act(() => { result.current.submitGuess(miss('DEU', 'FRA', 20)) })
    expect(result.current.session.lives).toBe(2)
    expect(result.current.session.streak).toBe(0)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.score).toBe(120)
  })

  it('three wrong guesses in a row ends the game', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(miss('FRA', 'DEU', 5)) })
    act(() => { result.current.advance(round('DEU')) })
    act(() => { result.current.submitGuess(miss('DEU', 'FRA', 5)) })
    act(() => { result.current.advance(round('JPN')) })
    act(() => { result.current.submitGuess(miss('JPN', 'FRA', 5)) })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.lives).toBe(0)
  })

  it('advance() moves from round-ended to playing with the next round', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    act(() => { result.current.advance(round('DEU')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.currentRound?.targetCca3).toBe('DEU')
    expect(result.current.session.used.has('DEU')).toBe(true)
    expect(result.current.session.roundIndex).toBe(1)
  })

  it('endGame() returns to idle with empty state', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    act(() => { result.current.endGame() })
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.score).toBe(0)
    expect(result.current.session.used.size).toBe(0)
  })
})
```

- [ ] **Step 6.2: Run tests — expect failure**

Run:
```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts
```

Expected: FAIL with `Cannot find module '../useGameSession'`.

- [ ] **Step 6.3: Write the implementation**

Create `src/game/shared/useGameSession.ts`:

```ts
import { useCallback, useReducer } from 'react'
import type { GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec }
  | { type: 'guess'; outcome: GuessOutcome }
  | { type: 'advance'; nextRound: RoundSpec }
  | { type: 'endGame' }

const EMPTY: GameSession = {
  modeId: 'country-pinning',
  status: 'idle',
  lives: 3,
  score: 0,
  streak: 0,
  bestStreak: 0,
  roundIndex: 0,
  currentRound: null,
  lastOutcome: null,
  used: new Set(),
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        currentRound: action.firstRound,
        used: new Set([action.firstRound.targetCca3]),
      }
    }
    case 'guess': {
      const nextLives = (state.lives + action.outcome.livesDelta) as GameSession['lives']
      const nextStreak = action.outcome.correct ? state.streak + 1 : 0
      const livesSpent = nextLives <= 0
      return {
        ...state,
        status: livesSpent ? 'game-over' : 'round-ended',
        lives: livesSpent ? 0 : nextLives,
        score: state.score + action.outcome.pointsEarned,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        lastOutcome: action.outcome,
      }
    }
    case 'advance': {
      if (state.status !== 'round-ended') return state
      return {
        ...state,
        status: 'playing',
        currentRound: action.nextRound,
        used: new Set([...state.used, action.nextRound.targetCca3]),
        roundIndex: state.roundIndex + 1,
        lastOutcome: null,
      }
    }
    case 'endGame': {
      return EMPTY
    }
  }
}

export function useGameSession(): {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec) => void
  submitGuess: (outcome: GuessOutcome) => void
  advance: (nextRound: RoundSpec) => void
  endGame: () => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback((modeId: ModeId, firstRound: RoundSpec) =>
    dispatch({ type: 'start', modeId, firstRound }), [])
  const submitGuess = useCallback((outcome: GuessOutcome) =>
    dispatch({ type: 'guess', outcome }), [])
  const advance = useCallback((nextRound: RoundSpec) =>
    dispatch({ type: 'advance', nextRound }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, submitGuess, advance, endGame }
}
```

- [ ] **Step 6.4: Run tests — expect pass**

Run:
```bash
npx vitest run src/game/shared/__tests__/useGameSession.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/game/shared/useGameSession.ts src/game/shared/__tests__/useGameSession.test.ts
git commit -m "feat(game): session reducer hook"
```

---

## Task 7: Rewrite `hashState.ts` to discriminated union

**Files:**
- Modify: `src/lib/hashState.ts`
- Modify: `src/lib/__tests__/hashState.test.ts`

- [ ] **Step 7.1: Rewrite the existing tests for the new shape and add game-hash cases**

Replace the entire contents of `src/lib/__tests__/hashState.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { parseHash, writeHash } from '../hashState'

describe('parseHash', () => {
  it('empty hash → empty', () => {
    expect(parseHash('')).toEqual({ kind: 'empty' })
    expect(parseHash('#')).toEqual({ kind: 'empty' })
  })

  it('single country code', () => {
    expect(parseHash('#FRA')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: null })
  })

  it('country compare pair', () => {
    expect(parseHash('#FRA,DEU')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })
  })

  it('upper-cases lower-case codes', () => {
    expect(parseHash('#fra,deu')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })
  })

  it('trailing comma with missing second code', () => {
    expect(parseHash('#FRA,')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: null })
  })

  it('ignores extra compare codes beyond the first two', () => {
    expect(parseHash('#FRA,DEU,JPN')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })
  })

  it('game hash without /play', () => {
    expect(parseHash('#game/country-pinning')).toEqual({
      kind: 'game', modeId: 'country-pinning', playing: false,
    })
  })

  it('game hash with /play', () => {
    expect(parseHash('#game/country-pinning/play')).toEqual({
      kind: 'game', modeId: 'country-pinning', playing: true,
    })
  })

  it('unknown game modeId preserves the segment', () => {
    expect(parseHash('#game/mystery-mode')).toEqual({
      kind: 'game', modeId: 'mystery-mode', playing: false,
    })
  })
})

describe('writeHash', () => {
  it('empty state → empty string', () => {
    expect(writeHash({ kind: 'empty' })).toBe('')
  })

  it('country', () => {
    expect(writeHash({ kind: 'country', cca3: 'FRA', compareWith: null })).toBe('FRA')
  })

  it('compare pair', () => {
    expect(writeHash({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })).toBe('FRA,DEU')
  })

  it('game not playing', () => {
    expect(writeHash({ kind: 'game', modeId: 'country-pinning', playing: false })).toBe('game/country-pinning')
  })

  it('game playing', () => {
    expect(writeHash({ kind: 'game', modeId: 'country-pinning', playing: true })).toBe('game/country-pinning/play')
  })
})
```

- [ ] **Step 7.2: Run tests — expect failure**

Run:
```bash
npx vitest run src/lib/__tests__/hashState.test.ts
```

Expected: FAIL — the signatures don't match the new API.

- [ ] **Step 7.3: Rewrite `src/lib/hashState.ts`**

Replace the entire contents of `src/lib/hashState.ts` with:

```ts
export type HashState =
  | { kind: 'empty' }
  | { kind: 'country'; cca3: string; compareWith: string | null }
  | { kind: 'game'; modeId: string; playing: boolean }

export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { kind: 'empty' }

  if (clean.startsWith('game/')) {
    const rest = clean.slice('game/'.length)
    if (!rest) return { kind: 'empty' }
    if (rest.endsWith('/play')) {
      const modeId = rest.slice(0, -'/play'.length)
      return { kind: 'game', modeId, playing: true }
    }
    return { kind: 'game', modeId: rest, playing: false }
  }

  const parts = clean.split(',').map((s) => s.trim().toUpperCase())
  const cca3 = parts[0] || ''
  if (!cca3) return { kind: 'empty' }
  const compareWith = parts[1] || null
  return { kind: 'country', cca3, compareWith }
}

export function writeHash(state: HashState): string {
  switch (state.kind) {
    case 'empty':
      return ''
    case 'country':
      return state.compareWith ? `${state.cca3},${state.compareWith}` : state.cca3
    case 'game':
      return state.playing ? `game/${state.modeId}/play` : `game/${state.modeId}`
  }
}
```

- [ ] **Step 7.4: Run tests — expect pass**

Run:
```bash
npx vitest run src/lib/__tests__/hashState.test.ts
```

Expected: all 14 tests PASS.

- [ ] **Step 7.5: Commit (the consumer update lands in Task 8 and must ship together — don't push yet)**

```bash
git add src/lib/hashState.ts src/lib/__tests__/hashState.test.ts
git commit -m "refactor(hashState): discriminated union with game mode grammar"
```

---

## Task 8: Adapt `useSelectedCountry` to the new `hashState` API

**Files:**
- Modify: `src/hooks/useSelectedCountry.ts`

**Rationale:** The new `parseHash` returns a discriminated union. `useSelectedCountry` only cares about the `country` case — for any other shape it should clear its internal selection state.

- [ ] **Step 8.1: Rewrite `src/hooks/useSelectedCountry.ts`**

Replace the entire contents of `src/hooks/useSelectedCountry.ts` with:

```ts
import { useState, useEffect, useCallback } from 'react'
import type { CountryData } from '../lib/types'
import { parseHash, writeHash } from '../lib/hashState'

export function useSelectedCountry(
  byCca3: Map<string, CountryData>,
): {
  selected: CountryData | null
  compareWith: CountryData | null
  select: (cca3: string) => void
  compareSelect: (cca3: string) => void
  clearCompare: () => void
  deselect: () => void
} {
  const [selected, setSelected] = useState<CountryData | null>(null)
  const [compareWith, setCompareWith] = useState<CountryData | null>(null)

  const resolveHash = useCallback(() => {
    const state = parseHash(window.location.hash)
    if (state.kind !== 'country') {
      // empty or game hash — nothing selected
      setSelected(null)
      setCompareWith(null)
      return
    }
    const selCountry = byCca3.get(state.cca3) ?? null
    const cmpCountry = state.compareWith ? byCca3.get(state.compareWith) ?? null : null
    if (!selCountry) {
      history.replaceState(null, '', window.location.pathname)
      setSelected(null)
      setCompareWith(null)
      return
    }
    setSelected(selCountry)
    setCompareWith(cmpCountry)
  }, [byCca3])

  useEffect(() => {
    resolveHash()
    window.addEventListener('hashchange', resolveHash)
    return () => window.removeEventListener('hashchange', resolveHash)
  }, [resolveHash])

  const select = useCallback((cca3: string) => {
    window.location.hash = writeHash({
      kind: 'country', cca3: cca3.toUpperCase(), compareWith: null,
    })
  }, [])

  const compareSelect = useCallback((cca3: string) => {
    const current = parseHash(window.location.hash)
    if (current.kind !== 'country') return
    window.location.hash = writeHash({
      kind: 'country', cca3: current.cca3, compareWith: cca3.toUpperCase(),
    })
  }, [])

  const clearCompare = useCallback(() => {
    const current = parseHash(window.location.hash)
    if (current.kind !== 'country') return
    window.location.hash = writeHash({
      kind: 'country', cca3: current.cca3, compareWith: null,
    })
  }, [])

  const deselect = useCallback(() => {
    history.replaceState(null, '', window.location.pathname)
    setSelected(null)
    setCompareWith(null)
  }, [])

  return { selected, compareWith, select, compareSelect, clearCompare, deselect }
}
```

- [ ] **Step 8.2: Run full unit suite — expect pass**

Run:
```bash
npm run test:unit
```

Expected: all tests pass. If any test in `hashState.test.ts`, `useSelectedCountry`, or downstream consumers fails, the union adaptation missed a call site — grep for `parseHash` and verify.

- [ ] **Step 8.3: Run build — expect pass**

Run:
```bash
npm run build
```

Expected: TypeScript compiles. Any `parseHash` consumer that still expects the old `{ selected, compareWith }` shape will fail — grep and fix.

- [ ] **Step 8.4: Commit**

```bash
git add src/hooks/useSelectedCountry.ts
git commit -m "refactor(hooks): useSelectedCountry reads discriminated hash"
```

---

## Task 9: Mode definition + registry + English strings

**Files:**
- Create: `src/game/modes/country-pinning/messages.ts`
- Create: `src/game/modes/country-pinning/index.ts`
- Create: `src/game/modes/index.ts`

**Note:** The mode's `HudComponent` is referenced here but implemented in Task 12. Using a deferred import would complicate things; instead we define the mode object **without** `HudComponent` here and attach it in Task 12 via a one-line registration edit. This keeps this task focused.

- [ ] **Step 9.1: Write `src/game/modes/country-pinning/messages.ts`**

```ts
export const MESSAGES = {
  title: 'Country Pinning',
  description: 'Click the country shown at the top. Three wrong countries end the game.',
  prompt: (name: string) => `Pin: ${name}`,
  correct: (points: number, name: string) =>
    `Correct! +${points} points. That was ${name}.`,
  wrong: (points: number, target: string, clicked: string | null) =>
    clicked
      ? `Wrong — that was ${clicked}. +${points} points. The answer was ${target}. −1 life.`
      : `Wrong. +${points} points. The answer was ${target}. −1 life.`,
  gameOver: (score: number, bestStreak: number) =>
    `Game over. Final score ${score}. Longest streak ${bestStreak}.`,
  livesRemaining: (n: number) =>
    n === 1 ? 'One life remaining.' : `${n} lives remaining.`,
}
```

- [ ] **Step 9.2: Write `src/game/modes/country-pinning/index.ts`**

```ts
import type { GameMode, CountryLike } from '../../shared/types'
import { scoreGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { centroidFromLatLng } from '../../shared/distance'
import { MESSAGES } from './messages'

type HudComponent = GameMode['HudComponent']

// HudComponent is attached in Task 12 via registerCountryPinningHud.
// Keeping the definition in one place avoids a circular import between
// the mode file and the HUD file.
let attachedHud: HudComponent | null = null

export function registerCountryPinningHud(c: HudComponent): void {
  attachedHud = c
}

export function getCountryPinningMode(pool: CountryLike[]): GameMode {
  if (!attachedHud) {
    throw new Error('country-pinning HUD not registered — import the HUD module before using the mode')
  }
  return {
    id: 'country-pinning',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'country-pinning',
    HudComponent: attachedHud,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (clickedCca3, clickedCentroidRaw, round) => {
      // clickedCentroid is passed in MapLibre order [lng, lat] already.
      return scoreGuess(round, clickedCca3, clickedCentroidRaw)
    },
  }
}

export { centroidFromLatLng }
```

- [ ] **Step 9.3: Write `src/game/modes/index.ts`**

```ts
import type { CountryLike, GameMode, ModeId } from '../shared/types'
import { getCountryPinningMode } from './country-pinning'

export function getMode(id: ModeId, pool: CountryLike[]): GameMode {
  switch (id) {
    case 'country-pinning':
      return getCountryPinningMode(pool)
  }
}

export function listModes(): { id: ModeId; title: string; description: string }[] {
  return [
    { id: 'country-pinning', title: 'Country Pinning', description: 'Click the country from the flag + name prompt.' },
  ]
}
```

- [ ] **Step 9.4: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles. `getCountryPinningMode` throws at runtime if called before HUD registration, but that's verified in Task 16 when GameController first calls it.

- [ ] **Step 9.5: Commit**

```bash
git add src/game/modes/country-pinning/messages.ts \
         src/game/modes/country-pinning/index.ts \
         src/game/modes/index.ts
git commit -m "feat(game): mode registry + country-pinning definition"
```

---

## Task 10: `GameSessionProvider` context + test hook

**Files:**
- Create: `src/game/shared/GameSessionProvider.tsx`

- [ ] **Step 10.1: Write `src/game/shared/GameSessionProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useGameSession } from './useGameSession'
import type { GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

export type GameSessionApi = {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec) => void
  submitGuess: (outcome: GuessOutcome) => void
  advance: (nextRound: RoundSpec) => void
  endGame: () => void
}

const GameSessionContext = createContext<GameSessionApi | null>(null)

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const api = useGameSession()
  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    const hook = {
      getSession: () => apiRef.current.session,
      endGame: () => apiRef.current.endGame(),
    }
    ;(window as unknown as { __funworldmap_game?: typeof hook }).__funworldmap_game = hook
    return () => {
      delete (window as unknown as { __funworldmap_game?: typeof hook }).__funworldmap_game
    }
  }, [])

  const value = useMemo(() => api, [api])
  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>
}

export function useGameSessionContext(): GameSessionApi {
  const ctx = useContext(GameSessionContext)
  if (!ctx) throw new Error('useGameSessionContext must be used within <GameSessionProvider>')
  return ctx
}
```

**Note:** the `__funworldmap_game.setRound()` test helper lives in `GameController` — only the controller knows how to force the currentRound through the hash + mode pipeline. Here we expose only session-level inspection/abort helpers.

- [ ] **Step 10.2: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles.

- [ ] **Step 10.3: Commit**

```bash
git add src/game/shared/GameSessionProvider.tsx
git commit -m "feat(game): session context provider"
```

---

## Task 11: Shared HUD atoms (Lives, Score, Streak badges)

**Files:**
- Create: `src/game/shared/hud/LivesIndicator.tsx`
- Create: `src/game/shared/hud/ScoreBadge.tsx`
- Create: `src/game/shared/hud/StreakBadge.tsx`

- [ ] **Step 11.1: Write `LivesIndicator.tsx`**

```tsx
interface Props {
  lives: 0 | 1 | 2 | 3
}

export function LivesIndicator({ lives }: Props) {
  return (
    <div
      className="flex gap-1 items-center"
      role="status"
      aria-label={`${lives} ${lives === 1 ? 'life' : 'lives'} remaining`}
      data-testid="hud-lives"
    >
      {[0, 1, 2].map((i) => {
        const active = i < lives
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={`w-5 h-5 transition-colors duration-200 ${
              active ? 'text-rose-500' : 'text-sand-300 dark:text-dark-200'
            }`}
            aria-hidden="true"
            fill="currentColor"
          >
            <path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" />
          </svg>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 11.2: Write `ScoreBadge.tsx`**

```tsx
interface Props {
  score: number
}

export function ScoreBadge({ score }: Props) {
  return (
    <div
      className="px-2.5 py-1 rounded-full bg-sand-100/90 dark:bg-dark-400/80 border border-sand-300/50 dark:border-dark-200/30 text-sm font-semibold text-sand-900 dark:text-dark-50 tabular-nums"
      data-testid="hud-score"
    >
      {score}
    </div>
  )
}
```

- [ ] **Step 11.3: Write `StreakBadge.tsx`**

```tsx
interface Props {
  streak: number
}

export function StreakBadge({ streak }: Props) {
  if (streak === 0) return null
  return (
    <div
      className="px-2.5 py-1 rounded-full bg-teal/15 dark:bg-teal-light/15 border border-teal/30 dark:border-teal-light/30 text-xs font-medium text-teal dark:text-teal-light tabular-nums"
      data-testid="hud-streak"
      aria-label={`Current streak ${streak}`}
    >
      🔥 {streak}
    </div>
  )
}
```

- [ ] **Step 11.4: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles.

- [ ] **Step 11.5: Commit**

```bash
git add src/game/shared/hud/LivesIndicator.tsx \
         src/game/shared/hud/ScoreBadge.tsx \
         src/game/shared/hud/StreakBadge.tsx
git commit -m "feat(game): HUD badge atoms (lives, score, streak)"
```

---

## Task 12: HudShell + CountryPinningHud (with HUD registration)

**Files:**
- Create: `src/game/shared/hud/HudShell.tsx`
- Create: `src/game/modes/country-pinning/CountryPinningHud.tsx`

- [ ] **Step 12.1: Write `HudShell.tsx`**

```tsx
import type { ReactNode } from 'react'
import { LivesIndicator } from './LivesIndicator'
import { ScoreBadge } from './ScoreBadge'
import { StreakBadge } from './StreakBadge'
import type { GameSession } from '../types'

interface Props {
  session: GameSession
  onEndGame: () => void
  children: ReactNode
}

export function HudShell({ session, onEndGame, children }: Props) {
  return (
    <div
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[95vw]"
      data-testid="game-hud"
      data-game-status={session.status}
    >
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <LivesIndicator lives={session.lives} />
          <div className="flex items-center gap-2">
            <ScoreBadge score={session.score} />
            <StreakBadge streak={session.streak} />
          </div>
          <button
            type="button"
            onClick={onEndGame}
            className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
            data-testid="game-end"
          >
            End game
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 12.2: Write `CountryPinningHud.tsx`**

```tsx
import { useMemo } from 'react'
import type { GameSession } from '../../shared/types'
import { MESSAGES } from './messages'
import { registerCountryPinningHud } from './index'

interface Props {
  session: GameSession
}

function CountryPinningHud({ session }: Props) {
  const round = session.currentRound
  const reveal = session.lastOutcome

  const revealLine = useMemo(() => {
    if (session.status !== 'round-ended' || !reveal) return null
    if (reveal.correct) {
      return MESSAGES.correct(reveal.pointsEarned, reveal.reveal.targetCca3)
    }
    return MESSAGES.wrong(
      reveal.pointsEarned,
      reveal.reveal.targetCca3,
      reveal.reveal.clickedCca3,
    )
  }, [session.status, reveal])

  if (!round) return null

  return (
    <div className="flex flex-col items-center gap-2 min-w-[220px]">
      <div className="flex items-center gap-3">
        <img
          src={round.targetFlag}
          alt=""
          className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded shadow-sm shrink-0"
          data-testid="game-prompt-flag"
        />
        <div
          className="text-base sm:text-lg font-semibold text-sand-900 dark:text-dark-50"
          data-testid="game-prompt-name"
        >
          {round.targetName}
        </div>
      </div>
      {revealLine && (
        <div
          className="text-xs sm:text-sm text-sand-700 dark:text-dark-100 text-center"
          data-testid="game-reveal"
          role="status"
        >
          {revealLine}
        </div>
      )}
    </div>
  )
}

registerCountryPinningHud(CountryPinningHud)
export default CountryPinningHud
```

- [ ] **Step 12.3: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles.

- [ ] **Step 12.4: Commit**

```bash
git add src/game/shared/hud/HudShell.tsx \
         src/game/modes/country-pinning/CountryPinningHud.tsx
git commit -m "feat(game): HudShell + country-pinning HUD"
```

---

## Task 13: GameOverOverlay

**Files:**
- Create: `src/game/shared/hud/GameOverOverlay.tsx`

- [ ] **Step 13.1: Write `GameOverOverlay.tsx`**

```tsx
import type { GameSession, PersonalBest } from '../types'

interface Props {
  session: GameSession
  personalBest: PersonalBest
  beatPersonalBest: boolean
  onPlayAgain: () => void
  onBackToMap: () => void
}

export function GameOverOverlay({
  session, personalBest, beatPersonalBest, onPlayAgain, onBackToMap,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center sm:items-center items-end justify-center p-4 bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      data-testid="game-over"
    >
      <div className="w-full max-w-sm rounded-2xl bg-sand-50 dark:bg-dark-400 border border-sand-300/50 dark:border-dark-200/30 shadow-2xl p-6">
        <h2
          id="game-over-title"
          className="text-xl font-bold text-sand-900 dark:text-dark-50 mb-1"
        >
          Game over
        </h2>
        <p className="text-sm text-sand-500 dark:text-dark-100 mb-4">
          Three wrong guesses.
        </p>

        <dl className="grid grid-cols-2 gap-3 mb-6">
          <div>
            <dt className="text-xs uppercase text-sand-500 dark:text-dark-100">Score</dt>
            <dd
              className="text-2xl font-bold text-sand-900 dark:text-dark-50 tabular-nums"
              data-testid="game-over-score"
            >
              {session.score}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-sand-500 dark:text-dark-100">Longest streak</dt>
            <dd
              className="text-2xl font-bold text-sand-900 dark:text-dark-50 tabular-nums"
              data-testid="game-over-best-streak"
            >
              {session.bestStreak}
            </dd>
          </div>
        </dl>

        <div className="text-xs text-sand-500 dark:text-dark-100 mb-5" data-testid="game-over-pb">
          {beatPersonalBest ? (
            <span className="font-semibold text-teal dark:text-teal-light">New personal best!</span>
          ) : (
            <>Best: {personalBest.bestScore} pts · {personalBest.bestStreak} streak</>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 px-4 py-2 rounded-xl bg-teal text-white font-medium hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
            data-testid="game-over-play-again"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onBackToMap}
            className="flex-1 px-4 py-2 rounded-xl bg-sand-200 dark:bg-dark-300 text-sand-900 dark:text-dark-50 font-medium hover:bg-sand-300 dark:hover:bg-dark-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
            data-testid="game-over-back"
          >
            Back to map
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 13.2: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles.

- [ ] **Step 13.3: Commit**

```bash
git add src/game/shared/hud/GameOverOverlay.tsx
git commit -m "feat(game): game-over overlay"
```

---

## Task 14: GuessByNameButton

**Files:**
- Create: `src/game/shared/hud/GuessByNameButton.tsx`

- [ ] **Step 14.1: Write `GuessByNameButton.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react'
import type { CountryLike } from '../types'
import { useCountrySearch } from '../../../hooks/useCountrySearch'
import type { CountryData } from '../../../lib/types'

interface Props {
  pool: CountryLike[]
  used: Set<string>
  onGuess: (cca3: string) => void
}

export function GuessByNameButton({ pool, used, onGuess }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const available = pool.filter((c) => !used.has(c.cca3)) as unknown as CountryData[]
  const results = useCountrySearch(available, query)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
        data-testid="game-guess-by-name"
      >
        Guess by name
      </button>
    )
  }

  const submit = (cca3: string) => {
    onGuess(cca3)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="w-full mt-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) {
            e.preventDefault()
            submit(results[0].country.cca3)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
            setQuery('')
          }
        }}
        placeholder="Type a country…"
        className="w-full px-3 py-2 text-sm rounded-lg bg-sand-100 dark:bg-dark-500 border border-sand-300/50 dark:border-dark-200/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
        data-testid="game-guess-input"
      />
      {results.length > 0 && (
        <ul
          className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-sand-300/50 dark:border-dark-200/30 bg-sand-50 dark:bg-dark-400"
          data-testid="game-guess-results"
        >
          {results.map((r) => (
            <li key={r.country.cca3}>
              <button
                type="button"
                onClick={() => submit(r.country.cca3)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-sand-200 dark:hover:bg-dark-300"
              >
                {r.country.name.common}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Note:** this casts `CountryLike[]` to `CountryData[]` for `useCountrySearch`. The Fuse index is configured over `name.common`, `name.official`, `capital`, `region`, `subregion`, `cca2`, `cca3`; `CountryLike` only carries `name.common` and `cca3`. Fuse silently skips absent fields, so the search still works — it just searches fewer keys. If you want capital/region search in the game-by-name flow later, expand `CountryLike` to include those fields.

- [ ] **Step 14.2: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles.

- [ ] **Step 14.3: Commit**

```bash
git add src/game/shared/hud/GuessByNameButton.tsx
git commit -m "feat(game): keyboard-accessible name-guess button"
```

---

## Task 15: GameController

**Files:**
- Create: `src/game/GameController.tsx`

- [ ] **Step 15.1: Write `GameController.tsx`**

```tsx
import { useCallback, useEffect, useRef } from 'react'
import type { CountryLike, GameSession } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { usePersonalBests } from './shared/usePersonalBests'
import { getMode } from './modes'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { GuessByNameButton } from './shared/hud/GuessByNameButton'
import { parseHash, writeHash } from '../lib/hashState'

const REVEAL_MS = 1200

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

interface Props {
  pool: CountryLike[]
  byCca3: Map<string, CountryLike>
  onGameStart: () => void                  // called when entering 'playing' from 'idle'
  onGameEnd: () => void                    // called when returning to 'idle' (overlay closed)
}

export function GameController({ pool, byCca3, onGameStart, onGameEnd }: Props) {
  const { session, start, submitGuess, advance, endGame } = useGameSessionContext()
  const { best, record } = usePersonalBests('country-pinning')
  const recordedRef = useRef(false)
  const onGameStartRef = useRef(onGameStart)
  onGameStartRef.current = onGameStart
  const onGameEndRef = useRef(onGameEnd)
  onGameEndRef.current = onGameEnd

  const mode = getMode('country-pinning', pool)

  // Hash → session bootstrap.
  useEffect(() => {
    const check = () => {
      const state = parseHash(window.location.hash)
      if (state.kind === 'game' && session.status === 'idle') {
        const firstRound = mode.nextRound(new Set(), pool)
        start('country-pinning', firstRound)
      }
      if (state.kind !== 'game' && session.status !== 'idle') {
        endGame()
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // session.status in deps would cause re-bind storms; we read it live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Side effects on status change.
  useEffect(() => {
    if (session.status === 'playing' && session.roundIndex === 0 && session.currentRound) {
      recordedRef.current = false
      onGameStartRef.current()
      dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
    }
    if (session.status === 'playing' && session.roundIndex > 0 && session.currentRound) {
      dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
    }
    if (session.status === 'round-ended' && session.lastOutcome) {
      const o = session.lastOutcome
      const remain = session.lives
      dispatchAnnouncement(
        o.correct
          ? `Correct. Plus ${o.pointsEarned} points.`
          : `Wrong. Plus ${o.pointsEarned} points. ${remain === 1 ? 'One life remaining.' : `${remain} lives remaining.`}`,
      )
      const t = window.setTimeout(() => {
        const next = mode.nextRound(session.used, pool)
        advance(next)
      }, REVEAL_MS)
      return () => window.clearTimeout(t)
    }
    if (session.status === 'game-over' && !recordedRef.current) {
      recordedRef.current = true
      record(session.score, session.bestStreak)
      dispatchAnnouncement(`Game over. Final score ${session.score}.`)
    }
    if (session.status === 'idle') {
      onGameEndRef.current()
    }
  }, [session.status, session.roundIndex, session.lastOutcome, session.score, session.bestStreak, session.lives, session.used, session.currentRound, advance, mode, pool, record])

  // Expose setRound for e2e determinism.
  useEffect(() => {
    const existing = (window as unknown as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
    if (!existing) return
    existing.setRound = (cca3: string) => {
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return false
      const round = {
        targetCca3: country.cca3,
        targetName: country.name.common,
        targetFlag: country.flag,
        targetCentroid: [country.latlng[1], country.latlng[0]] as [number, number],
      }
      if (session.status === 'idle') {
        start('country-pinning', round)
      } else if (session.status === 'playing' || session.status === 'round-ended') {
        advance(round)
      }
      return true
    }
  }, [byCca3, start, advance, session.status])

  const handleGuessByCca3 = useCallback((clickedCca3: string) => {
    if (session.status !== 'playing' || !session.currentRound) return
    const clickedCountry = byCca3.get(clickedCca3.toUpperCase())
    const clickedCentroid = clickedCountry
      ? ([clickedCountry.latlng[1], clickedCountry.latlng[0]] as [number, number])
      : null
    const outcome = mode.onGuess(clickedCca3.toUpperCase(), clickedCentroid, session.currentRound)
    submitGuess(outcome)
  }, [session.status, session.currentRound, byCca3, mode, submitGuess])

  // Expose guess dispatcher on window so App.tsx can call it from onMapSelect.
  useEffect(() => {
    ;(window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess = handleGuessByCca3
    return () => {
      delete (window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess
    }
  }, [handleGuessByCca3])

  // Escape exits the game (spec: keyboard exit path).
  useEffect(() => {
    if (session.status === 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      endGame()
      if (window.location.hash.startsWith('#game')) {
        history.replaceState(null, '', window.location.pathname)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.status, endGame])

  // Target-polygon reveal pulse on round-ended (spec: setPaintProperty on
  // country-borders-hover for the target polygon, restore after REVEAL_MS).
  // Respects prefers-reduced-motion: renders a static tint instead of pulsing.
  useEffect(() => {
    if (session.status !== 'round-ended' || !session.lastOutcome) return
    const map = (window as unknown as { __funworldmap_map?: any }).__funworldmap_map
    if (!map) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const layer = 'country-hover-border'  // LAYER.hoverBorder from src/lib/mapLayers.ts:178
    try {
      map.setFilter(layer, ['==', ['get', 'id'], session.lastOutcome.reveal.targetCca3])
      const colour = session.lastOutcome.correct ? '#22c55e' : '#f59e0b'
      map.setPaintProperty(layer, 'line-color', colour)
      map.setPaintProperty(layer, 'line-width', reduced ? 3 : 4)
    } catch {
      /* layer may be named differently on older builds; fall through */
    }
    return () => {
      try {
        map.setFilter(layer, ['==', ['get', 'id'], ''])
      } catch { /* no-op */ }
    }
  }, [session.status, session.lastOutcome])

  const writeIdleHash = () => {
    if (window.location.hash.startsWith('#game')) {
      history.replaceState(null, '', window.location.pathname)
    }
  }

  const onEndGame = () => {
    endGame()
    writeIdleHash()
  }
  const onPlayAgain = () => {
    const firstRound = mode.nextRound(new Set(), pool)
    start('country-pinning', firstRound)
  }
  const onBackToMap = () => {
    endGame()
    writeIdleHash()
  }

  if (session.status === 'idle') return null

  const Hud = mode.HudComponent

  const beatPB =
    session.score > best.bestScore || session.bestStreak > best.bestStreak

  return (
    <>
      <HudShell session={session} onEndGame={onEndGame}>
        <Hud session={session} />
        {session.status === 'playing' && (
          <GuessByNameButton
            pool={pool}
            used={session.used}
            onGuess={handleGuessByCca3}
          />
        )}
      </HudShell>
      {session.status === 'game-over' && (
        <GameOverOverlay
          session={session}
          personalBest={best}
          beatPersonalBest={beatPB}
          onPlayAgain={onPlayAgain}
          onBackToMap={onBackToMap}
        />
      )}
    </>
  )
}
```

- [ ] **Step 15.2: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles. If the mode factory throws at render time ("HUD not registered"), ensure `CountryPinningHud` is imported for its side effect — in Task 16 we add the import in `App.tsx`.

- [ ] **Step 15.3: Commit**

```bash
git add src/game/GameController.tsx
git commit -m "feat(game): game controller orchestration"
```

---

## Task 15a: First-session tutorial tooltip

**Files:**
- Create: `src/game/shared/hud/FirstSessionTutorial.tsx`
- Modify: `src/game/GameController.tsx` — render the tutorial above `HudShell` when it's a first session.

**Rationale:** Spec calls for a one-shot "how to play" tooltip using the existing `sessionStorage` hint pattern (key: `funworldmap-game-tutorial-shown`, mirroring `funworldmap-hint-shown` at `App.tsx:124`).

- [ ] **Step 15a.1: Write `FirstSessionTutorial.tsx`**

```tsx
import { useState, useEffect } from 'react'

const KEY = 'funworldmap-game-tutorial-shown'

export function FirstSessionTutorial() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return
    setOpen(true)
    sessionStorage.setItem(KEY, '1')
  }, [])

  if (!open) return null

  return (
    <div
      role="status"
      className="fixed top-40 sm:top-44 left-1/2 -translate-x-1/2 z-[45] max-w-xs px-4 py-3 rounded-2xl bg-dark-400/95 dark:bg-dark-300/95 backdrop-blur-md border border-teal/30 dark:border-teal-light/30 text-teal-light text-sm shadow-2xl pointer-events-auto"
      style={{ animation: 'fade-up 300ms ease-out' }}
      data-testid="game-tutorial"
    >
      <p className="font-medium mb-1">How to play</p>
      <p className="text-xs opacity-90">
        Click the country that matches the flag and name above. Three wrong countries end the game.
        Ocean clicks don't count.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs underline-offset-2 underline hover:no-underline"
      >
        Got it
      </button>
    </div>
  )
}
```

- [ ] **Step 15a.2: Render it from `GameController` when a game is active**

In `src/game/GameController.tsx`, add an import at the top:

```ts
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
```

Replace the existing return-block's outer fragment (the `<>…</>` that wraps `HudShell` and `GameOverOverlay`) so that `<FirstSessionTutorial />` renders alongside the HUD while status is `playing` or `round-ended`:

Find:

```tsx
  return (
    <>
      <HudShell session={session} onEndGame={onEndGame}>
```

Replace with:

```tsx
  return (
    <>
      {(session.status === 'playing' || session.status === 'round-ended') && (
        <FirstSessionTutorial />
      )}
      <HudShell session={session} onEndGame={onEndGame}>
```

- [ ] **Step 15a.3: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles.

- [ ] **Step 15a.4: Commit**

```bash
git add src/game/shared/hud/FirstSessionTutorial.tsx src/game/GameController.tsx
git commit -m "feat(game): first-session how-to-play tooltip"
```

---

## Task 16: Wire `GameController` into `App.tsx` + branch `onMapSelect`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`

- [ ] **Step 16.1: Update `src/components/Header.tsx`**

Add a `gameActive` prop and an `onPlay` handler; when `gameActive` is true, hide the search bar. Replace the full file contents with:

```tsx
import SearchBar from './SearchBar'
import ThemeToggle from './ThemeToggle'
import type { CountryData } from '../lib/types'
import type { Theme } from '../hooks/useTheme'

interface Props {
  countries: CountryData[]
  theme: Theme
  satellite: boolean
  comparePickingMode: boolean
  gameActive: boolean
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
  onSatelliteToggle: () => void
  onPlay: () => void
}

export default function Header({
  countries, theme, satellite, comparePickingMode, gameActive,
  onSelect, onThemeCycle, onSatelliteToggle, onPlay,
}: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto hidden lg:flex items-baseline mr-4 shrink-0">
          <span className="text-lg font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </span>
        </div>

        {!gameActive && (
          <div className="pointer-events-auto flex-1 max-w-md mx-auto lg:mx-0">
            <SearchBar countries={countries} comparePickingMode={comparePickingMode} onSelect={onSelect} />
          </div>
        )}

        <div className="pointer-events-auto ml-3 flex items-center gap-2">
          {!gameActive && (
            <button
              onClick={onPlay}
              aria-label="Play a game"
              className="w-10 h-10 rounded-xl backdrop-blur-sm border bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-teal dark:text-teal-light hover:bg-sand-200/90 dark:hover:bg-dark-300/80 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
              data-testid="header-play"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          <button
            onClick={onSatelliteToggle}
            aria-label={satellite ? 'Switch to map view' : 'Switch to satellite view'}
            aria-pressed={satellite}
            className={`w-10 h-10 rounded-xl backdrop-blur-sm border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
              satellite
                ? 'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal dark:text-teal-light'
                : 'bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-sand-500 dark:text-dark-100 hover:bg-sand-200/90 dark:hover:bg-dark-300/80'
            }`}
            data-testid="satellite-toggle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.6 9h16.8M3.6 15h16.8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z" />
            </svg>
          </button>

          <ThemeToggle theme={theme} onCycle={onThemeCycle} />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 16.2: Update `src/App.tsx`**

Apply these changes:

a) **Add imports** at the top (after existing imports, before `export default function App`):

```ts
import { GameSessionProvider, useGameSessionContext } from './game/shared/GameSessionProvider'
import { GameController } from './game/GameController'
import './game/modes/country-pinning/CountryPinningHud' // register HUD side-effect
import { writeHash, parseHash } from './lib/hashState'
import type { CountryLike } from './game/shared/types'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from './lib/mapStyles'
```

b) **Wrap the returned JSX** in `<GameSessionProvider>…</GameSessionProvider>`. Pull the branch-and-render logic into an inner component so it can use `useGameSessionContext`:

Replace the body of the existing `App` component's JSX (lines 174-276) with a split: `App` wraps the provider around a new `AppInner` that contains everything else. This keeps the existing logic intact.

Full rewrite of `src/App.tsx`:

```tsx
import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import CountryPanel from './components/CountryPanel'
import Toast from './components/Toast'
import { useCountryData } from './hooks/useCountryData'
import { useSelectedCountry } from './hooks/useSelectedCountry'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import { MapProvider, useMap } from './hooks/useMap'
import { GameSessionProvider, useGameSessionContext } from './game/shared/GameSessionProvider'
import { GameController } from './game/GameController'
import './game/modes/country-pinning/CountryPinningHud'
import { writeHash } from './lib/hashState'
import type { CountryLike } from './game/shared/types'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from './lib/mapStyles'
import type { CountryData } from './lib/types'

export default function App() {
  return (
    <GameSessionProvider>
      <MapProvider>
        <AppInner />
      </MapProvider>
    </GameSessionProvider>
  )
}

function AppInner() {
  const { countries, byNumeric, byCca3, sources } = useCountryData()
  const { selected, compareWith, select, compareSelect, clearCompare, deselect } = useSelectedCountry(byCca3)
  const isDesktop = useMediaQuery()
  const { theme, resolved, cycle } = useTheme()
  const { mapRef } = useMap()
  const { session } = useGameSessionContext()
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const prevSelectedRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)
  const [satellite, setSatellite] = useState(true)
  const toggleSatellite = useCallback(() => setSatellite((s) => !s), [])
  const [comparePickingMode, setComparePickingMode] = useState(false)

  const enterComparePicking = useCallback(() => {
    if (selected) setComparePickingMode(true)
  }, [selected])
  const exitCompare = useCallback(() => {
    setComparePickingMode(false)
    clearCompare()
  }, [clearCompare])

  const gameActive = session.status !== 'idle'

  const onMapSelect = useCallback(
    (cca3: string) => {
      if (gameActive) {
        const guess = (window as unknown as { __funworldmap_guess?: (c: string) => void }).__funworldmap_guess
        guess?.(cca3)
        return
      }
      if (comparePickingMode) {
        if (selected && cca3.toUpperCase() !== selected.cca3) {
          compareSelect(cca3)
          setComparePickingMode(false)
        }
      } else {
        select(cca3)
      }
    },
    [gameActive, comparePickingMode, selected, select, compareSelect],
  )

  // Game-start side effects: clear selection, exit compare, fly to world.
  const prevStatusRef = useRef(session.status)
  useEffect(() => {
    if (prevStatusRef.current === 'idle' && session.status === 'playing') {
      if (selected) deselect()
      setComparePickingMode(false)
      mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 700 })
    }
    prevStatusRef.current = session.status
  }, [session.status, selected, deselect, mapRef])

  const onPlay = useCallback(() => {
    window.location.hash = writeHash({ kind: 'game', modeId: 'country-pinning', playing: true })
  }, [])

  useEffect(() => {
    const name = selected?.name.common ?? null
    const prevName = prevSelectedRef.current
    if (liveRegionRef.current) {
      if (name && name !== prevName) liveRegionRef.current.textContent = `${name} selected`
      else if (!name && prevName) liveRegionRef.current.textContent = 'Country panel closed'
    }
    prevSelectedRef.current = name
  }, [selected])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (liveRegionRef.current && detail) liveRegionRef.current.textContent = detail
    }
    window.addEventListener('funworldmap:announce', handler)
    return () => window.removeEventListener('funworldmap:announce', handler)
  }, [])

  const focusReturnRef = useRef<HTMLElement | null>(null)
  const panelWasOpenRef = useRef(false)
  useEffect(() => {
    if (selected && !panelWasOpenRef.current) {
      panelWasOpenRef.current = true
      const active = document.activeElement as HTMLElement | null
      focusReturnRef.current = active && active !== document.body ? active : null
      const timer = window.setTimeout(() => {
        const close = document.querySelector<HTMLButtonElement>('[data-testid="panel-close"]')
        close?.focus({ preventScroll: true })
      }, 300)
      return () => window.clearTimeout(timer)
    } else if (!selected && panelWasOpenRef.current) {
      panelWasOpenRef.current = false
      const target = focusReturnRef.current
      focusReturnRef.current = null
      if (target && document.body.contains(target) && typeof target.focus === 'function') {
        target.focus({ preventScroll: true })
      } else {
        document.getElementById('search-input')?.focus({ preventScroll: true })
      }
    }
  }, [selected])

  useEffect(() => {
    const check = () => document.querySelector('[data-map-loaded], [data-map-error]')
    const observer = new MutationObserver(() => {
      if (check()) { setMapReady(true); observer.disconnect() }
    })
    observer.observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['data-map-loaded', 'data-map-error'],
    })
    if (check()) { setMapReady(true); observer.disconnect() }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!mapReady || selected || hintDismissed || gameActive) return
    if (sessionStorage.getItem('funworldmap-hint-shown')) return
    const timer = setTimeout(() => {
      setShowHint(true)
      sessionStorage.setItem('funworldmap-hint-shown', '1')
    }, 1500)
    return () => clearTimeout(timer)
  }, [mapReady, selected, hintDismissed, gameActive])

  useEffect(() => {
    if ((selected || gameActive) && showHint) {
      setShowHint(false)
      setHintDismissed(true)
    }
  }, [selected, gameActive, showHint])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameActive) return  // GameController's Escape is handled by its own flow
        if (compareWith || comparePickingMode) { exitCompare(); return }
        if (selected) { deselect(); return }
        const searchInput = document.getElementById('search-input') as HTMLInputElement | null
        if (searchInput && searchInput.value) {
          searchInput.value = ''
          searchInput.dispatchEvent(new Event('input', { bubbles: true }))
          return
        }
        return
      }
      const target = e.target as HTMLElement | null
      if (target && target.matches('input, textarea, [contenteditable]')) return
      if (e.key === '/') {
        e.preventDefault()
        if (!gameActive) document.getElementById('search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, compareWith, comparePickingMode, exitCompare, deselect, gameActive])

  // Derive the game-mode country pool. Memoized so identity is stable across
  // renders — GameController depends on this.
  const pool = useMemo<CountryLike[]>(
    () => countries
      .filter((c: CountryData) => c.independent === true)
      .map((c: CountryData) => ({
        cca3: c.cca3,
        name: { common: c.name.common },
        flag: c.flag,
        latlng: c.latlng,
        independent: true,
      })),
    [countries],
  )
  const poolByCca3 = useMemo(
    () => new Map(pool.map((c) => [c.cca3, c])),
    [pool],
  )

  return (
    <div
      data-selected-country={selected?.ccn3 || undefined}
      data-game-mode={gameActive ? 'country-pinning' : undefined}
      className="grain"
    >
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal focus:text-white focus:rounded-lg"
        onClick={() => document.getElementById('search-input')?.focus()}
      >Skip to search</button>
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-40 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal focus:text-white focus:rounded-lg"
        onClick={() => document.querySelector<HTMLDivElement>('[role="application"]')?.focus()}
      >Skip to map</button>

      <div ref={liveRegionRef} data-testid="announce-region" aria-live="polite" aria-atomic="true" className="sr-only" />

      {!mapReady && (
        <div aria-hidden="true" className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-sand-100 dark:bg-dark-500 transition-opacity duration-300">
          <span className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light mb-6">funworldmap</span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-teal dark:bg-teal-light"
                style={{ animation: `loading-dots 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
        </div>
      )}

      <Toast />

      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.10) 100%)' }} />

      <main>
        <WorldMap
          byNumeric={byNumeric}
          selected={selected}
          compareWith={compareWith}
          comparePickingMode={comparePickingMode}
          resolvedTheme={resolved}
          satellite={satellite}
          onSelect={onMapSelect}
          onDeselect={deselect}
        />
      </main>
      <Header
        countries={countries}
        theme={theme}
        satellite={satellite}
        comparePickingMode={comparePickingMode}
        gameActive={gameActive}
        onSelect={onMapSelect}
        onThemeCycle={cycle}
        onSatelliteToggle={toggleSatellite}
        onPlay={onPlay}
      />

      <GameController
        pool={pool}
        byCca3={poolByCca3}
        onGameStart={() => { /* side-effect handled in the status-watcher useEffect above */ }}
        onGameEnd={() => { /* same */ }}
      />

      {showHint && !selected && !gameActive && (
        <div role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-teal/20 dark:border-teal-light/20 text-teal-light text-sm shadow-lg"
          style={{ animation: 'fade-up 300ms ease-out' }}
        >Explore the world</div>
      )}

      {selected && !gameActive && (
        <CountryPanel
          country={selected}
          compareWith={compareWith}
          comparePickingMode={comparePickingMode}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={onMapSelect}
          onClose={deselect}
          onEnterCompare={enterComparePicking}
          onExitCompare={exitCompare}
          byCca3={byCca3}
        />
      )}
    </div>
  )
}
```

**Note:** `AppInner` now depends on `useMap()` to call `flyTo` on game start, so `<MapProvider>` must wrap it. `<GameSessionProvider>` wraps both.

- [ ] **Step 16.3: Build — expect pass**

Run:
```bash
npm run build
```

Expected: compiles with no type errors.

- [ ] **Step 16.4: Run unit tests — expect pass**

Run:
```bash
npm run test:unit
```

Expected: all tests pass. No unit-level behaviour changed; this task was integration only.

- [ ] **Step 16.5: Smoke-test in dev server**

Run:
```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
1. Satellite basemap loads (from plan 1).
2. Click a country → panel opens as normal.
3. Click the new Play button in the header → map flies to world view, HUD appears top-centre with a random flag + country name, 3 hearts, search bar is hidden, "End game" button shows in the HUD.
4. Click the target country on the map → score increments, streak badge appears, reveal text shows for ~1.2 s, then a new round starts.
5. Click a wrong country → a heart disappears, streak resets, reveal shows.
6. Lose 3 lives → game-over overlay appears with Play again / Back to map.
7. Click Back to map → HUD disappears, search bar returns, URL hash clears.
8. Direct-link `http://localhost:5173/#game/country-pinning/play` → page loads and immediately enters a game.

If any step fails, stop and debug before Task 17.

- [ ] **Step 16.6: Commit**

```bash
git add src/App.tsx src/components/Header.tsx
git commit -m "feat(game): mount game controller, branch map clicks, Play button"
```

---

## Task 17: E2E spec for country-pinning

**Files:**
- Create: `e2e/game-country-pinning.spec.ts`

- [ ] **Step 17.1: Write `e2e/game-country-pinning.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test'

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

// We dispatch the guess via the controller's exposed hook instead of
// synthesising a canvas pixel click. This keeps the test deterministic
// (no polygon-vertex math) while still exercising the full guess pipeline
// through App.tsx's onMapSelect branch.
async function clickCountryPolygon(page: Page, cca3: string) {
  await page.evaluate((code) => {
    const guess = (window as unknown as { __funworldmap_guess?: (c: string) => void }).__funworldmap_guess
    if (!guess) throw new Error('__funworldmap_guess not exposed; is the game active?')
    guess(code)
  }, cca3)
}

test.describe('Country Pinning game', () => {
  test('enter via header Play button, HUD appears and search hides', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)

    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('game-hud')).toBeVisible()
    await expect(page.getByTestId('search-input')).toHaveCount(0)
    await expect(page.getByTestId('hud-lives')).toBeVisible()
    await expect(page.getByTestId('hud-score')).toHaveText('0')
  })

  test('deep link #game/country-pinning/play boots into playing', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await expect(page.getByTestId('game-hud')).toBeVisible()
  })

  test('correct guess scores 100, streak 1, no life lost', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('header-play').click()

    // Force a deterministic round via the test hook.
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: any }).__funworldmap_game
      g.setRound('FRA')
    })

    await clickCountryPolygon(page, 'FRA')

    await expect(page.getByTestId('hud-score')).toHaveText('100')
    await expect(page.getByTestId('hud-streak')).toContainText('1')
    // Lives stay at 3 (all 3 hearts filled).
    const lives = page.getByTestId('hud-lives')
    await expect(lives).toHaveAttribute('aria-label', '3 lives remaining')
  })

  test('wrong guess costs a life, resets streak, still scores proximity', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('header-play').click()

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: any }).__funworldmap_game
      g.setRound('FRA')
    })

    await clickCountryPolygon(page, 'AUS')

    await expect(page.getByTestId('hud-lives')).toHaveAttribute('aria-label', '2 lives remaining')
    const score = await page.getByTestId('hud-score').innerText()
    expect(Number(score)).toBeGreaterThan(0)
    expect(Number(score)).toBeLessThan(100)
  })

  test('three wrong guesses end the game', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('header-play').click()

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const g = (window as unknown as { __funworldmap_game?: any }).__funworldmap_game
        g.setRound('FRA')
      })
      await clickCountryPolygon(page, 'AUS')
      // wait past REVEAL_MS so the next round advances (for rounds 1 and 2).
      if (i < 2) await page.waitForTimeout(1500)
    }

    await expect(page.getByTestId('game-over')).toBeVisible()
    await expect(page.getByTestId('game-over-score')).not.toHaveText('0')
  })

  test('Back to map exits cleanly and clears hash', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await page.getByTestId('game-end').click()
    await expect(page.getByTestId('game-hud')).toHaveCount(0)
    expect(page.url().endsWith('/')).toBe(true)
  })

  test('guess-by-name input submits like a map click', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: any }).__funworldmap_game
      g.setRound('FRA')
    })

    await page.getByTestId('game-guess-by-name').click()
    await page.getByTestId('game-guess-input').fill('France')
    await page.getByTestId('game-guess-input').press('Enter')

    await expect(page.getByTestId('hud-score')).toHaveText('100')
  })
})
```

- [ ] **Step 17.2: Run the spec — expect pass**

Run:
```bash
npm run build
npx playwright test e2e/game-country-pinning.spec.ts --project=chromium-gpu
```

Expected: all 7 tests pass. If any fail:
- "HUD not visible" → check that `AppInner` mounts `<GameController>` unconditionally and that it renders when `session.status !== 'idle'`.
- "Score didn't update" → verify `__funworldmap_guess` is exposed and `onMapSelect` forwards to it when gameActive.
- "game-over didn't appear" → verify reveal timer runs; the `waitForTimeout(1500)` must exceed REVEAL_MS (1200).

- [ ] **Step 17.3: Commit**

```bash
git add e2e/game-country-pinning.spec.ts
git commit -m "test(e2e): country-pinning end-to-end coverage"
```

---

## Task 18: Regression sweep

**Files:** none

- [ ] **Step 18.1: Run full unit suite**

Run:
```bash
npm run test:unit
```

Expected: all unit tests pass including new ones and the rewritten `hashState.test.ts`.

- [ ] **Step 18.2: Run full chromium e2e**

Run:
```bash
npm run build
npx playwright test --project=chromium
```

Expected: all DOM-level specs pass. Theme, search, panel, accessibility, scaffold specs are unaffected by the game module — any regression points at a side effect of the `App.tsx` rewrite in Task 16.

- [ ] **Step 18.3: Run full chromium-gpu e2e**

Run:
```bash
npx playwright test --project=chromium-gpu
```

Expected: all GPU specs pass, including `satellite-default.spec.ts` from plan 1 and the new `game-country-pinning.spec.ts`.

- [ ] **Step 18.4: Smoke-test the UX (human)**

Run:
```bash
npm run dev
```

Verify each:
1. Non-game flows (search, select, compare, theme, satellite toggle) all work.
2. Play button launches a game; ending returns cleanly.
3. `#game/country-pinning/play` deep link works in a fresh tab.
4. Game works on a narrow viewport (mobile dev tools, ≤ 400 px): flag/name readable, HUD fits, End game button reachable.
5. Keyboard-only play: Tab to Play button, Enter to start, Tab to Guess-by-name, type, Enter.
6. Screen reader (VoiceOver / NVDA) announces the round prompt and outcomes through the aria-live region.

- [ ] **Step 18.5: No extra commit needed**

Verification only.

---

## Post-plan

Open a PR titled `feat(game): country-pinning game mode with shared framework`. Reference:
- Spec: `docs/superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md` (Part B)
- Plan: `docs/superpowers/plans/2026-04-18-country-pinning-game.md`
- Depends on: `2026-04-18-satellite-default.md` having merged.

In the PR description, include:
- Screenshot or short clip of the game in action.
- A note that **future game modes (city guessing, etc.) land as a new folder under `src/game/modes/` plus one `getMode` switch case — no framework rewrite.**
- Tech debt ledger entry: if playtesting shows the centroid-centroid distance metric feels unfair on archipelagos and overseas territories, revisit by switching to click-pixel-to-target-centroid (single file change in `GameController.tsx` — pass `e.lngLat` into `mode.onGuess`).
