# Game-flow cascade fixes — design

**Date:** 2026-04-27
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

A targeted fix for seven bugs surfaced in the 2026-04-27 critical assessment, all six of the highest-severity ones traceable to a single architectural defect: `GameController` and `GameOverOverlay` re-parse `window.location.hash` to answer "is this a daily?" at game-over and per-attempt resume-write time. The hash, however, is also a routing input that any *other* code is free to mutate — and `useMapInteractions.clickMap` does exactly that on ocean / off-globe clicks (`onDeselect` → `history.replaceState(null, '', pathname)`). One off-target click during a daily silently corrupts the entire end-of-game flow.

This spec stops treating the URL hash as the source of truth for session-state derivable questions, gates the deselect handler on game state for defense-in-depth, and bundles five smaller fixes (one HIGH, four LOW) into a follow-up PR.

**Two PRs.** Daily mode, free mode, share, history, streak, calendar — all preserved. No data migration. No telemetry schema change.

## Findings addressed

| # | Severity | Finding | Mechanism |
|---|---|---|---|
| 1 | CRITICAL | Off-target map clicks during a country-pinning game clear the URL hash via `clickMap → deselect → history.replaceState(null, '', pathname)`. Cascade: 1a daily history not saved · 1b resume blob not cleared at game-over · 1c resume blob stops updating mid-game · 1d free PB contaminated for daily plays · 1e daily game-over UI degenerates to free game-over UI · 1f Play Again button starts a fresh free game | PR 1: stash `dailyDate` on `GameSession`; gate `clickMap`'s deselect on `session.status !== 'idle'` |
| 2 | CRITICAL | Play Again on daily switches to free mode | Dissolves with #1 — Play Again is rendered behind `!isDaily`, and `isDaily` is now session-driven |
| 3 | HIGH | "End game" in free mode silently abandons without game-over UI or PB write | PR 2: new reducer action `finishFree`; `onEndGame` branches on `session.dailyDate === null` |
| 7 | LOW | "Plus 1 points" pluralization in screen-reader announcements | PR 2: `pts(n)` helper in `GameController`, applied at lines 302/303/310 |
| 8 | LOW | Triple announcement on country-pinning round-end (App live region + inline `[role="status"]` + AttemptsIndicator toast) | PR 2: drop the App-level `dispatchAnnouncement` for country-pinning round-end; the visible inline status auto-announces and is more informative |
| 9 | LOW | App live region keeps stale "Game over. Final score N." after navigation away | PR 2: per-announcement clear timer in `App.tsx` |
| 10 | LOW | `prefersReducedMotion()` value captured-once in `useMapInstance.ts:60` doesn't react to OS-toggle mid-session | PR 2: `subscribeReducedMotion(cb)` API in `lib/motion.ts`; `useMapInstance` re-applies map config on change |

Findings demoted from the original report (calendar dot size, zero-score-first-game PB labeling, calendar visual differentiation) are explicitly **out of scope**.

## Goals & non-goals

**Goals**
- One off-target map click no longer corrupts the daily end-of-game flow. Refresh during a daily preserves attempts up to the moment of refresh.
- The URL hash is a routing input only. Game-over and resume-write logic depend on session state, not on `parseHash(window.location.hash)`.
- Pressing "End game" mid-free-game shows the user their score and writes their PB.
- Round-end announcements stop competing with each other; "1 point" is grammatical.
- Reduced-motion OS-toggle mid-session takes effect on the next map operation.

**Non-goals**
- No removal of `parseHash` for the bootstrap routing flow — it remains the right tool there.
- No animation re-architecture beyond the narrow `useMapInstance` re-config on reduced-motion change.
- No daily content / cadence / generator changes.
- No telemetry schema change. Existing events keep their shapes.
- No backward compatibility shims — `dailyDate` is a new optional field on session state, default `null`. Old `localStorage` shapes are unchanged.

## Architectural decision: session-state, not URL, as the daily oracle

`GameController.tsx:368-392`, `GameController.tsx:271-283`, and `GameOverOverlay.tsx:23-27` all answer "is this a daily, and if so, for what date?" by re-parsing `window.location.hash`. That works exactly as long as nothing else mutates the hash mid-game — but `useMapInteractions.clickMap` *does* mutate it on every off-target click. PR #24 already had to add a `statusRef.current === 'game-over'` recovery branch to the bootstrap effect to work around hash mutations done elsewhere; this is the same anti-pattern at a different call site.

**The fix is to make the session itself carry the daily date.**

```ts
// src/game/shared/types.ts
interface GameSession {
  // ... existing fields ...
  dailyDate: string | null  // YYYY-MM-DD set at start() / resume(); null for free; null when idle
}
```

- Set in the `start` reducer action when the bootstrap detects a daily route (passes `dailyDate`).
- Set in the `resume` reducer action (passes `dailyDate` from the resume blob, which already carries `date`).
- Preserved through `attempt` / `completeNow` / `advance` / `overrideRound` (these spread `...state`).
- Reset to `null` by `endGame` (which returns `{ ...EMPTY, used: new Set() }`; `EMPTY.dailyDate = null`).

The three call sites that read the hash become:

```ts
// GameController.tsx — game-over recording branch
const isDaily = session.dailyDate !== null
if (!isDaily) record(session.score, session.bestStreak)
if (isDaily && session.modeId) {
  recordDailyResult(session.dailyDate!, session.modeId, { ... })
  clearResume()
  track('daily_completed', { ... })
}

// GameController.tsx — per-attempt resume write
if (session.dailyDate === null) return
writeResume({
  version: 1,
  date: session.dailyDate,
  modeId: session.modeId,
  attempts: session.currentAttempts,
})

// GameOverOverlay.tsx
const isDaily = session.dailyDate !== null
const dailyDate = session.dailyDate
```

The hash is now a routing input only, used by:
- `GameController` bootstrap (parses hash on mount and on `hashchange`, dispatches `start` / `resume` / overlay route — unchanged)
- `useSelectedCountry` (country deep-links — unchanged)
- `Launcher` / `DailyRevealOverlay` rendering (route-driven — unchanged)

## Defense in depth: gate the deselect

Even with the architectural change, the URL hash being silently rewritten mid-game is a separate user-facing concern (refresh / share / browser-back semantics). Gate the deselect:

```ts
// src/hooks/useMapInteractions.ts
const sessionRef = useRef(session)
sessionRef.current = session  // tracks current session, like onSelectRef pattern

// inside the effect
const clickMap = (e: maplibregl.MapMouseEvent) => {
  // Don't deselect during active gameplay — clearing the URL hash mid-game
  // strips routing state and was the root of the 2026-04-27 cascade.
  if (sessionRef.current.status !== 'idle') return
  const features = map.queryRenderedFeatures(e.point, { layers: [LAYER.fill] })
  if (features.length === 0) onDeselectRef.current()
}
```

The ref pattern matches the existing `onSelectRef` / `onDeselectRef` / `byNumericRef` style — listener stack stays attached once, no re-create on session change.

This makes #1 a defense-in-depth fix: if any future caller forgets to use `session.dailyDate` and reads the hash again, the hash is still preserved during play, so the bug doesn't reappear.

## Per-bug fix detail

### PR 1: Cascade

**`src/game/shared/types.ts`** — add `dailyDate: string | null` to `GameSession`.

**`src/game/shared/useGameSession.ts`**
- `EMPTY.dailyDate = null`.
- `start` action signature gains an optional `dailyDate?: string | null`. When omitted, defaults to `null`. The reducer writes it onto state.
- `resume` action signature gains required `dailyDate: string`. Reducer writes it. (Resume is daily-only, so non-null required.)
- `endGame` returns `{ ...EMPTY, used: new Set() }` — already resets `dailyDate` via the spread, no code change needed.
- `attempt`, `completeNow`, `advance`, `overrideRound` all spread `...state` already; they preserve `dailyDate` automatically.
- The hook's `start` and `resume` callbacks accept and forward the new arg.

**`src/game/GameController.tsx`**
- Bootstrap effect: when starting a daily, pass `state.date` to `start(...)`.
- Resume call: pass `state.date` to `resume(...)`.
- Game-over recording branch (lines ~368-392): replace `parseHash(window.location.hash)` with `session.dailyDate`.
- Per-attempt resume write (lines ~271-283): replace `parseHash(...)` guard + date with `session.dailyDate` guard + value.

**`src/game/shared/hud/GameOverOverlay.tsx`**
- Replace `const hashState = parseHash(window.location.hash)` with `const isDaily = session.dailyDate !== null` and `const dailyDate = session.dailyDate`.
- Drop the `parseHash` import.

**`src/hooks/useMapInteractions.ts`**
- Add `sessionRef` (mirrors `onSelectRef`).
- `clickMap` returns early if `sessionRef.current.status !== 'idle'`.

### PR 2: HIGH + LOW

**Bug 3 — End game (free) routes through game-over.**

`src/game/shared/useGameSession.ts`: new action.

```ts
case 'finishFree': {
  if (state.status === 'idle' || state.status === 'game-over') return state
  if (state.dailyDate !== null) return state  // daily keeps abandon semantics
  return { ...state, status: 'game-over' }
}
```

`src/game/GameController.tsx:732`:

```ts
const onEndGame = () => {
  if (session.dailyDate === null && session.status !== 'idle' && session.status !== 'game-over') {
    finishFree()  // free: show game-over UI, recordedRef branch fires PB write
    return
  }
  clearResume(); endGame(); writeIdleHash()  // daily / idle: existing abandon
}
```

`onBackToMap` keeps `= onEndGame` (after game-over, this is the dismissal path; both branches end up at the launcher).

**Bug 7 — pluralization.**

`src/game/GameController.tsx`: small helper near other local fns.

```ts
const pts = (n: number) => (n === 1 ? 'point' : 'points')
```

Apply at the three string-template sites (lines ~302, ~303, ~310). Existing `lives === 1 ? 'One life remaining.'` ternary is left untouched.

**Bug 8 — drop redundant country-pinning round-end announcement.**

`src/game/GameController.tsx:297-303`: the round-ended `dispatchAnnouncement` for `country` reveal is removed. The visible inline `[role="status"]` under the HUD already auto-announces and contains richer info ("Wrong — that was United States. The answer was Botswana. −1 life."). Game-over (`Game over. Final score N.`), round-start (`Pin: Spain` / `Where is X, Y?`), and the `kilometres off` city round-end announcement at line ~310 are kept — those have no inline status equivalent. The AttemptsIndicator `+N` toast is daily-best-of-N specific and stays untouched.

**Bug 9 — clear stale announcement.**

`src/App.tsx`: replace the simple announce handler with one that schedules a clear.

```ts
const clearTimerRef = useRef<number | null>(null)
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<string>).detail
    if (!liveRegionRef.current || !detail) return
    liveRegionRef.current.textContent = detail
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
    clearTimerRef.current = window.setTimeout(() => {
      if (liveRegionRef.current) liveRegionRef.current.textContent = ''
    }, 8000)
  }
  window.addEventListener('funworldmap:announce', handler)
  return () => {
    window.removeEventListener('funworldmap:announce', handler)
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
  }
}, [])
```

8 s is enough for a screen reader to read any current announcement (the longest is ~80 chars). Each new announcement cancels the prior timer.

**Bug 10 — reduced-motion OS-toggle.**

`src/lib/motion.ts`: add a subscribe API. The function `prefersReducedMotion()` is already correct — `matchMedia(q).matches` returns the live value on every call. The actual issue is `useMapInstance.ts:60`, which captures the value at map-init time and uses the captured value in subsequent `flyTo` calls.

```ts
// motion.ts
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function subscribeReducedMotion(cb: (reduced: boolean) => void): () => void {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handler = (e: MediaQueryListEvent) => cb(e.matches)
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}
```

`src/hooks/useMapInstance.ts`: capture-once → subscribe-and-re-apply. The exact knob to re-apply depends on what the captured value gates (likely `map.flyTo({ duration })` baseline or `easing`). Implementation will inspect and either (a) apply per-call by reading fresh, or (b) subscribe and re-set a stored config var. Plan-time decision.

## Files touched

**PR 1 (5 files + tests)**
- `src/game/shared/types.ts`
- `src/game/shared/useGameSession.ts`
- `src/game/GameController.tsx`
- `src/game/shared/hud/GameOverOverlay.tsx`
- `src/hooks/useMapInteractions.ts`
- `src/game/shared/__tests__/useGameSession.test.ts` — new tests for `dailyDate` plumbing
- `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx` — drop `window.location.hash` test setup; pass `session.dailyDate` directly
- `e2e/daily-survives-ocean-click.spec.ts` — new regression
- `docs/systems/daily-puzzle.md` — one-line note that session carries `dailyDate`

**PR 2 (4 files + tests)**
- `src/game/shared/useGameSession.ts` — `finishFree` action
- `src/game/GameController.tsx` — Bug 3 branching, Bug 7 pluralization, Bug 8 announcement drop
- `src/App.tsx` — Bug 9 clear timer
- `src/lib/motion.ts` — Bug 10 subscribe API
- `src/hooks/useMapInstance.ts` — Bug 10 re-apply
- `src/game/shared/__tests__/useGameSession.test.ts` — `finishFree` action tests
- (Bug 7/8/9/10 are mechanical; tests added at plan time as the implementation specifies them.)

## Test strategy

**Unit (Vitest)**

- `useGameSession.test.ts` — `start` accepts `dailyDate`; `resume` requires `dailyDate`; `attempt`/`completeNow`/`advance`/`overrideRound` preserve `dailyDate`; `endGame` resets to `null`; `finishFree` (PR 2) requires playing-or-round-ended status, refuses on `dailyDate !== null`, transitions to `game-over` preserving score.
- `GameOverOverlay.test.tsx` — replace the `window.location.hash = ...` setups (lines ~666-722) with `session.dailyDate = '2026-04-27'` / `null` directly. Covers PB-block-on-daily, share-block-on-daily, Play-Again-on-free.
- `useMapInteractions` — add a test asserting `clickMap` does NOT call `onDeselect` when `session.status === 'playing'` and there are zero features at the click point.

**E2E (Playwright)**

- `e2e/daily-survives-ocean-click.spec.ts`: seed today's daily index, navigate to `#daily/<today>/country-pinning`, dismiss tutorial, fire one attempt at a country, fire one click at a known-water coordinate, fire two more attempts, complete via Done. Assert: `localStorage['funworldmap-daily-history']` populated; `localStorage['funworldmap-daily-resume']` cleared; `localStorage['funworldmap-game-country-pinning-bests-v2']` is null; `[data-testid="daily-share-block"]` visible; `[data-testid="game-over-pb"]` not present; `[data-testid="game-over-play-again"]` not present; `location.hash === '#daily/<today>/country-pinning'` (preserved through ocean click).

**Existing suites stay green**

- `useDailyHistory`, `historyStore`, `personalBestsStore`, `usePersonalBests`, `bestsKeyMigration`, `LauncherMilestoneOverlay`, `LauncherHistoryPanel`, `DailyShareBlock`, `CountryNewsSection` — all touched code is additive on `GameSession`; none of these consume `session.dailyDate` directly.

## Branch & PR sequencing

**PR 1: Branch `game-flow-cascade-fix`**

Sequenced commits (bisectable):
1. `feat(game): add dailyDate to GameSession; thread through start/resume`
2. `refactor(game): use session.dailyDate in game-over recording and resume write`
3. `refactor(hud): GameOverOverlay reads session.dailyDate instead of URL hash`
4. `fix(map): suppress click-deselect during active gameplay`
5. `test(e2e): regress ocean-click during daily preserves end-of-game flow`
6. `docs(daily): note session-state daily-date plumbing`

**PR 2: Branch `game-flow-polish-fixes`** (after PR 1 merges)

Sequenced commits:
1. `feat(game): finishFree reducer action; End game in free mode shows game-over`
2. `fix(game): pluralize "1 point" in round-end announcements`
3. `fix(game): drop redundant country-pinning round-end announcement`
4. `fix(a11y): clear stale aria-live region 8s after each announcement`
5. `feat(motion): subscribe API for reduced-motion changes; useMapInstance re-applies`

## Rollback

Both PRs are pure code changes; no schema migration, no data migration, no telemetry-schema change, no Worker change.

`git revert <merge-commit>` on `main` is sufficient. The deploy pipeline republishes GH Pages automatically.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `session.dailyDate` plumbing missed at a 4th call site | Low | Plan-time grep `parseHash(window.location.hash)` to enumerate all call sites; only the three named are session-state queries. Routing call sites are correct. |
| Gate on `session.status !== 'idle'` over-suppresses deselect (e.g., post-game-over CountryPanel after `endGame`) | Low | After `endGame` the status is `idle`, so deselect re-enables. Verified by reducer reading. |
| `finishFree` interacts badly with the `recordedRef` flow | Low | `finishFree` transitions to `game-over`; `GameController.tsx:368` `recordedRef` branch fires; same path as natural game-over. Test covers this. |
| Reduced-motion subscribe creates listener leaks | Low | `subscribeReducedMotion` returns an `unsubscribe` fn; `useMapInstance` calls it in the effect cleanup. |
| Bug 8 fix removes an announcement a screen-reader user actually relied on | Low | The dropped announcement was strictly less informative than the surviving inline status. An NVDA pass during PR 2 review confirms. |

## Self-review

- **Placeholder scan:** The Bug 10 implementation note says "Plan-time decision" for whether to read fresh or store-and-resubscribe in `useMapInstance`. This is a real degree of freedom that depends on inspecting the existing capture site; deferring to the plan is correct, not vague. No `TBD` / `TODO` / `???` strings.
- **Internal consistency:** `dailyDate` is added in `types.ts`, threaded through reducer, consumed by 3 call sites — covered. `finishFree` is gated on `dailyDate !== null` — consistent with PR 1 architecture. `useMapInteractions` ref pattern matches existing code.
- **Scope:** Two PRs, sized for one-week and three-day landings respectively. Each PR is bisectable and reverts cleanly.
- **Ambiguity:** "is this a daily?" is now answered exactly one way (`session.dailyDate !== null`) at exactly three sites. The hash is no longer queried for that question.
