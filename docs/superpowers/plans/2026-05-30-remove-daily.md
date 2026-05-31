# Remove the Daily — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the daily-puzzle feature (daily city + daily country) from funworldmap everywhere, and reframe the launcher as a free-play hub whose hook is per-mode personal-best high scores.

**Architecture:** Two phases. **Phase A** removes the daily feature (UI, routes, content pipeline, telemetry, docs, tests) — after it the app is fully daily-free and shippable, with the best-of-N reducer capability left present but unreachable. **Phase B** deletes that now-dead best-of-N machinery test-first. Tasks are ordered so the build (`npm run typecheck`) and the unit suite stay green after every commit: readers of a symbol are removed before the symbol itself, and each telemetry event type is removed in the same commit as its last call site.

**Tech Stack:** React 19, TypeScript, Vite, MapLibre, Vitest (unit), Playwright (e2e), Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-30-remove-daily-design.md`

**Branch:** `refactor/remove-daily` (already created; spec already committed).

---

## Conventions for every task

- Run `npm run typecheck` after edits to surface dangling references; it is the primary safety net for a deletion of this size.
- Unit tests: `npm run test:unit` (Vitest). A single file: `npx vitest run path/to/file.test.ts`.
- e2e: `npm run test:e2e` (Playwright). Do **not** run e2e as a gate until Task A6 (specs/helpers reference removed daily surfaces until then).
- Commit after each task with the message shown. Pre-commit hooks run prettier/eslint automatically.

---

# Phase A — Remove the daily feature

## Task A1: One-time legacy-storage cleanup

**Files:**

- Create: `src/lib/legacyStorageCleanup.ts`
- Create: `src/lib/__tests__/legacyStorageCleanup.test.ts`
- Modify: `src/main.tsx` (call it once on bootstrap)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/legacyStorageCleanup.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupLegacyDailyStorage } from '../legacyStorageCleanup'

describe('cleanupLegacyDailyStorage', () => {
  afterEach(() => localStorage.clear())

  it('removes the two legacy daily keys', () => {
    localStorage.setItem('funworldmap-daily-history', '{"version":1}')
    localStorage.setItem('funworldmap-daily-resume', '{"version":1}')
    localStorage.setItem('funworldmap-game-country-pinning-bests-v2', '{"bestScore":5}')

    cleanupLegacyDailyStorage()

    expect(localStorage.getItem('funworldmap-daily-history')).toBeNull()
    expect(localStorage.getItem('funworldmap-daily-resume')).toBeNull()
    // does not touch unrelated keys
    expect(localStorage.getItem('funworldmap-game-country-pinning-bests-v2')).not.toBeNull()
  })

  it('is idempotent and safe when keys are absent', () => {
    expect(() => {
      cleanupLegacyDailyStorage()
      cleanupLegacyDailyStorage()
    }).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run src/lib/__tests__/legacyStorageCleanup.test.ts`
Expected: FAIL — cannot resolve `../legacyStorageCleanup`.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/legacyStorageCleanup.ts
/**
 * One-time, idempotent removal of localStorage keys left behind by the
 * retired daily-puzzle feature. Safe in private mode / quota-restricted
 * contexts. Mirrors the v1 self-clean in personalBestsStore.ts.
 */
const LEGACY_DAILY_KEYS = ['funworldmap-daily-history', 'funworldmap-daily-resume'] as const

export function cleanupLegacyDailyStorage(): void {
  for (const key of LEGACY_DAILY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* private-mode / unavailable — best effort */
    }
  }
}
```

- [ ] **Step 4: Wire into bootstrap**

In `src/main.tsx`, add the import after the existing imports and call it once before `createRoot(...)`:

```ts
import { cleanupLegacyDailyStorage } from './lib/legacyStorageCleanup'

initSentry(import.meta.env.VITE_SENTRY_DSN as string | undefined)
cleanupLegacyDailyStorage()
```

- [ ] **Step 5: Run tests; verify pass**

Run: `npx vitest run src/lib/__tests__/legacyStorageCleanup.test.ts` → PASS. Then `npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/legacyStorageCleanup.ts src/lib/__tests__/legacyStorageCleanup.test.ts src/main.tsx
git commit -m "feat(cleanup): remove legacy daily localStorage keys on bootstrap"
```

---

## Task A2: Launcher → free-play high-score hub (+ Header, visibility, telemetry)

Rewrites the launcher and its card around personal bests, makes the header CTA a plain "Play", and removes the launcher/header daily telemetry. After this task the launcher and header are daily-free; the `src/game/daily/` module still exists (consumed only by the App reveal effect + GameController, removed in A3).

**Files:**

- Rewrite: `src/components/LauncherModeCard.tsx`
- Rewrite: `src/components/__tests__/LauncherModeCard.test.tsx`
- Rewrite: `src/components/Launcher.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useLauncherVisibility.ts`
- Modify: `src/hooks/__tests__/useLauncherVisibility.test.tsx`
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: Rewrite the card test (defines the new behavior)**

```tsx
// src/components/__tests__/LauncherModeCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LauncherModeCard } from '../LauncherModeCard'
import { record, __resetForTests } from '../../game/shared/personalBestsStore'

afterEach(() => {
  cleanup()
  __resetForTests()
  localStorage.clear()
})

describe('LauncherModeCard (free-play)', () => {
  it('shows the mode title and a Play button that calls onPlay', () => {
    const onPlay = vi.fn()
    render(<LauncherModeCard modeId="country-pinning" onPlay={onPlay} />)
    expect(screen.getByText('Country')).toBeTruthy()
    screen.getByTestId('launcher-card-country-pinning-play').click()
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('shows the fresh-player state when no games have been played', () => {
    render(<LauncherModeCard modeId="city-guessing" onPlay={vi.fn()} />)
    expect(screen.getByTestId('launcher-card-city-guessing-best').textContent).toMatch(
      /no games yet/i,
    )
  })

  it('shows the personal best once games are recorded', () => {
    record('country-pinning', 1240, 31)
    render(<LauncherModeCard modeId="country-pinning" onPlay={vi.fn()} />)
    const best = screen.getByTestId('launcher-card-country-pinning-best').textContent ?? ''
    expect(best).toMatch(/1,?240/)
    expect(best).toMatch(/31/) // longest streak surfaced for country-pinning
  })
})
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run src/components/__tests__/LauncherModeCard.test.tsx`
Expected: FAIL — current `LauncherModeCard` requires daily props (`state`, `onStartDaily`, …).

- [ ] **Step 3: Rewrite `LauncherModeCard.tsx`**

```tsx
// src/components/LauncherModeCard.tsx
import type { ModeId } from '../game/shared/types'
import { isCountryPinning } from '../game/shared/modePredicates'
import { usePersonalBests } from '../game/shared/usePersonalBests'

const ICONS: Record<ModeId, React.ReactNode> = {
  'country-pinning': (
    <svg
      className="w-8 h-8 text-teal dark:text-teal-light"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z"
      />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  'city-guessing': (
    <svg
      className="w-8 h-8 text-teal dark:text-teal-light"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V10l4-2 4 2 4-3 4 2v12H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6M12 21v-6M16 21v-6" />
    </svg>
  ),
}

const TITLE: Record<ModeId, string> = {
  'country-pinning': 'Country',
  'city-guessing': 'City',
}

const SUBTITLE: Record<ModeId, string> = {
  'country-pinning': 'Click the right country on the map',
  'city-guessing': 'Pin where the city is',
}

interface Props {
  modeId: ModeId
  onPlay: () => void
}

export function LauncherModeCard({ modeId, onPlay }: Props) {
  const testIdBase = `launcher-card-${modeId}`
  const { best } = usePersonalBests(modeId)
  const hasPlayed = best.gamesPlayed > 0

  return (
    <div
      data-testid={testIdBase}
      className="p-5 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 border border-sand-300/50 dark:border-dark-200/30 shadow-lg transition-all duration-150"
    >
      <div className="flex items-start gap-3 mb-3">
        {ICONS[modeId]}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
          <div className="text-xs text-sand-600 dark:text-dark-100 mt-0.5">{SUBTITLE[modeId]}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onPlay}
        data-testid={`${testIdBase}-play`}
        className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
      >
        Play
      </button>

      <div
        className="text-xs text-sand-600 dark:text-dark-100 mt-2 text-center tabular-nums"
        data-testid={`${testIdBase}-best`}
      >
        {hasPlayed ? (
          <>
            {/* bestScore is cumulative (country accrues 100/round, city sums 10 rounds),
                so show the raw number + "pts" — matching GameOverOverlay — NOT formatModeScore,
                which is a per-round "/100"/"/1000" denominator formatter. */}
            Best {best.bestScore.toLocaleString()} pts
            {isCountryPinning(modeId) && <> · {best.bestStreak} streak</>} · {best.gamesPlayed}{' '}
            {best.gamesPlayed === 1 ? 'game' : 'games'}
          </>
        ) : (
          'No games yet — play your first'
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the card test; verify pass**

Run: `npx vitest run src/components/__tests__/LauncherModeCard.test.tsx` → PASS.

- [ ] **Step 5: Rewrite `Launcher.tsx`**

```tsx
// src/components/Launcher.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listModes } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { track } from '../lib/analytics'
import { installFocusTrap } from '../lib/focusTrap'
import { LauncherModeCard } from './LauncherModeCard'

interface Props {
  onDismiss: () => void
}

function focusSearchInput(): void {
  // Header returns null while the launcher is open, so the search input is not
  // in the DOM until the launcher unmounts. A double-rAF waits for that commit.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById('search-input') as HTMLInputElement | null
      el?.focus()
    })
  })
}

export function Launcher({ onDismiss }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const modes = useMemo(() => listModes(), [])
  const lastMode = readLastMode()
  const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')

  const dismissWithCloseButton = useCallback(() => {
    track('launcher_dismissed', { path: 'close' })
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const dismissWithBackdrop = useCallback(() => {
    track('launcher_dismissed', { path: 'backdrop' })
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const startFree = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id })
    },
    [onDismiss],
  )

  // Flip data-animation-state to 'idle' once entry animations finish (or after a
  // 1s CI fallback). Lets e2e wait via waitForAnimationIdle instead of timeouts.
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      setAnimationState('idle')
      return
    }
    let cancelled = false
    let resolved = false
    const flipToIdle = () => {
      if (cancelled || resolved) return
      resolved = true
      setAnimationState('idle')
    }
    const rafId = window.requestAnimationFrame(() => {
      if (cancelled) return
      const animations = root.getAnimations({ subtree: true })
      if (animations.length === 0) {
        flipToIdle()
        return
      }
      Promise.all(animations.map((a) => a.finished))
        .then(flipToIdle)
        .catch(flipToIdle)
    })
    const timeoutId = window.setTimeout(flipToIdle, 1000)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }, [])

  // Focus the last-played mode's Play button, else the first Play button.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !root.isConnected) return
    const active = document.activeElement
    if (active !== document.body && root.contains(active)) return
    const preferred = lastMode
      ? root.querySelector<HTMLButtonElement>(`[data-testid="launcher-card-${lastMode}-play"]`)
      : null
    const firstPlay = root.querySelector<HTMLButtonElement>('[data-testid$="-play"]')
    ;(
      preferred ??
      firstPlay ??
      root.querySelector<HTMLButtonElement>('button:not([disabled])')
    )?.focus()
  }, [lastMode])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return installFocusTrap(root)
  }, [])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose how to play"
      data-testid="launcher"
      data-animation-state={animationState}
      className="fixed inset-0 z-[210] flex items-center justify-center p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 dark:bg-[rgba(11,15,26,0.7)] backdrop-blur-[4px]"
        style={{ animation: 'launcher-backdrop-in 220ms ease-out' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismissWithBackdrop()
        }}
      />
      <div className="relative w-full max-w-2xl mx-auto">
        <button
          type="button"
          onClick={dismissWithCloseButton}
          data-testid="launcher-close"
          aria-label="Close"
          className="absolute -top-2 right-0 w-9 h-9 rounded-full text-sand-50 dark:text-dark-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 flex items-center justify-center"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        <div
          role="presentation"
          className="text-center mb-6 pointer-events-none"
          style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}
        >
          <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </div>
          <p
            className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2"
            data-testid="launcher-subtitle"
          >
            Pick a mode and beat your best
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {modes.map((m, i) => (
            <div
              key={m.id}
              style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}
            >
              <LauncherModeCard modeId={m.id} onPlay={() => startFree(m.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Update `Header.tsx`** — make the CTA a plain "Play" and drop the streak chip.

Replace the `Props` interface (`Header.tsx:7-23`) — remove `ctaState`, `streakCurrent`, `streakActive`, `onOpenLauncherHistory`:

```tsx
interface Props {
  countries: CountryData[]
  theme: Theme
  satellite: boolean
  comparePickingMode: boolean
  gameActive: boolean
  launcherVisible: boolean
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
  onSatelliteToggle: () => void
  onOpenLauncher: () => void
  onLauncherDismiss: () => void
}
```

Update the destructure (`Header.tsx:25-41`) to drop the same four names, and remove the `import { track, type CtaState }` → `import { track } from '../lib/analytics'`.

Replace the streak-chip block + the Play button block (`Header.tsx:65-133`) with a single plain Play button:

```tsx
{
  !gameActive && (
    <button
      type="button"
      onClick={() => {
        track('header_cta_clicked', {})
        onOpenLauncher()
      }}
      aria-label="Play"
      data-testid="header-play"
      className="h-10 px-3 rounded-xl backdrop-blur-sm border flex items-center gap-2 font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-teal dark:text-teal-light hover:bg-sand-200/90 dark:hover:bg-dark-300/80"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
      <span className="hidden sm:inline">Play</span>
    </button>
  )
}
```

- [ ] **Step 7: Update `App.tsx`** — drop daily streak/CTA derivation and launcher/header props.
  - Remove the `useDailyHistory`/`deriveStreakMode`/`getToday`/`getYesterday` block that computes `streakActive`/`ctaState` (`App.tsx:152-165`) and the `openLauncherHistory` callback (`:133-135`).
  - In the `useLauncherVisibility()` destructure, remove `anchorDate` and `initialHistoryOpen`.
  - In `<Header .../>` (`:389-405`), remove props `ctaState`, `streakCurrent`, `streakActive`, `onOpenLauncherHistory`.
  - In `<Launcher .../>` (`:407-415`), reduce to `{launcherVisible && <Launcher onDismiss={dismissLauncher} />}`.
  - Leave `DailyPuzzlesProvider`, the reveal effect, and the `DailyRevealOverlay` render for Task A3.

- [ ] **Step 8: Simplify `useLauncherVisibility.ts`** — remove `isDailyRoot`/`anchorDate`.

Make `visible` independent of the hash. Concretely:

- Delete the `isDailyRoot` function (`:4-7`).
- Delete the `initialHash`/`currentHash` `useState` and the `hashchange` `useEffect` (`:24-33`) — the hook no longer reads the hash.
- Drop `anchorDate` and `initialHistoryOpen` from the `LauncherVisibility` interface and from the returned object.
- Simplify `show` to take no argument (no `historyOpen`), so `IntentState` is `{ kind: 'default' } | { kind: 'open' } | { kind: 'dismissed' }`.
- Change the `visible` expression to:

```ts
const visible = intent.kind === 'open' && session.status === 'idle'
```

Update `src/hooks/__tests__/useLauncherVisibility.test.tsx`: remove the daily-root/`anchorDate` cases and the `historyOpen` assertions; keep the open/dismiss/idle-gating cases.

- [ ] **Step 9: Trim launcher/header telemetry in `analytics.ts`**

Remove these keys from `EventSchema`: `daily_opened`, `history_opened`, `history_cell_clicked`. Remove the `export type CtaState`. Change `header_cta_clicked` to `header_cta_clicked: Record<string, never>`. (Leave `daily_started`, `daily_attempted`, `daily_completed`, `daily_shared`, `daily_done_low_score_prompt`, `streak_reached_milestone`, `deep_link_opened` for later tasks — their call sites still exist.)

Also update `src/lib/__tests__/analytics.test.ts`: it uses `track('daily_opened', …)` as the example payload for the generic-mechanism tests (sendBeacon, doNotTrack, test-buffer) — repoint those to a surviving event, e.g. `track('free_started', { mode: 'country-pinning' })`. Leave the `deep_link_opened` test for A3.

- [ ] **Step 10: Verify + commit**

Run: `npm run typecheck` → clean. `npx vitest run src/components/__tests__/LauncherModeCard.test.tsx src/hooks/__tests__/useLauncherVisibility.test.tsx` → PASS.

```bash
git add src/components/LauncherModeCard.tsx src/components/__tests__/LauncherModeCard.test.tsx src/components/Launcher.tsx src/components/Header.tsx src/App.tsx src/hooks/useLauncherVisibility.ts src/hooks/__tests__/useLauncherVisibility.test.tsx src/lib/analytics.ts
git commit -m "feat(launcher): reframe launcher+header as a free-play high-score hub"
```

---

## Task A3: Cut the daily out of the live game flow (+ its telemetry)

Removes the daily provider, reveal overlay, daily routing, daily history/resume wiring, and the daily-flow telemetry. Best-of-N reducer state is **kept** (Phase B) — only daily concerns are touched here.

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/game/GameController.tsx`
- Modify: `src/game/hooks/useGameAnnouncements.ts`
- Modify: `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`
- Modify: `src/game/hooks/useHashGameRouter.ts`
- Modify: `src/game/hooks/__tests__/useHashGameRouter.test.tsx`
- Modify: `src/lib/hashState.ts`
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: `hashState.ts` — drop the `daily` variant**

Remove `{ kind: 'daily'; ... }` from `HashState`, the `daily`/`daily/` early returns, and the entire `if (clean.startsWith('daily/'))` block in `parseHash`, and the `case 'daily'` in `writeHash`. Keep `empty`, `country`, `game`. `DATE_RE` and `KNOWN_MODE_IDS` become unused — remove them.

- [ ] **Step 2: `App.tsx` — remove the daily provider + reveal**
  - Remove imports: `DailyRevealOverlay`, `DailyPuzzlesProvider`, `useDailyPuzzlesContext`, `useDailyHistory`, `toLocalDateString`/`getToday`/`getYesterday` (from `game/daily/dates`), `deriveStreakMode`, `readLastMode`/`writeLastMode` if now only used by the removed reveal `onPlayUnlimited` (check — keep if used elsewhere).
  - Unwrap `<DailyPuzzlesProvider>` (`:58-68`) so `<AppInner .../>` is a direct child of `<GameSessionProvider>`.
  - Remove `const { byDate } = useDailyPuzzlesContext()`.
  - Remove the `revealState` state, its `useEffect` (`:116-132`), and the `<DailyRevealOverlay .../>` render (`:466-487`).

- [ ] **Step 3: `GameController.tsx` — remove daily branches/wiring**
  - Remove imports: `useDailyPuzzlesContext`, `useDailyHistory`, `clearResume`, `DailyRevealOverlay`, `toLocalDateString`, `useDailyResumePersistence`, `isCityGuessing` (if now unused).
  - Remove `const dailyPuzzles = useDailyPuzzlesContext()` and `const { record: recordDailyResult, get: dailyHistoryGet } = useDailyHistory()`.
  - Remove `useDailyResumePersistence(session)`.
  - In `useHashGameRouter({...})` drop `dailyPuzzles`, `dailyHistoryGet`, and `resume`.
  - In `useGameAnnouncements({...})` drop `recordDailyResult`.
  - In the Escape handler and `onEndGame`, remove the `clearResume()` calls. `onEndGame` becomes:

```tsx
const onEndGame = () => {
  if (session.status !== 'idle' && session.status !== 'game-over') {
    finishFree()
    return
  }
  endGame()
  writeIdleHash()
}
```

- `writeIdleHash`: change the guard to `if (h.startsWith('#game'))`.
- Replace the game-over render (`:155-175`) with the `GameOverOverlay` branch only:

```tsx
{
  session.status === 'game-over' && (
    <GameOverOverlay
      session={session}
      personalBest={best}
      beatPersonalBest={beatPB}
      onPlayAgain={onPlayAgain}
      onBackToMap={onBackToMap}
    />
  )
}
```

- [ ] **Step 4: `GameOverOverlay.tsx` — drop the daily branch**

Remove the `DailyShareBlock`/`useDailyHistory` imports and the `isDaily`/`dailyDate`/`dailyResults`/`hasAnyMode` logic. The title is always `Game over`; always render the score/PB block, the `Play again`/`Back to map` buttons, and never the share block. Remove the dead `session.maxRounds === 1` branch from `describeGameEnd`.

- [ ] **Step 5: `useGameAnnouncements.ts` — drop daily recording**
  - Remove imports `DailyDayResult`, `clearResume`.
  - Delete the `recordDailyCompletion` helper.
  - Remove `recordDailyResult` from `UseGameAnnouncementsArgs` and the destructure.
  - In `advanceNow`, delete the `if (session.dailyDate !== null && !recordedRef.current) { … }` block (keep the `finalize()` / `advance(next)` logic).
  - In the `game-over` branch, replace the daily/free split with `record(session.score, session.bestStreak)` unconditionally.
  - Leave `isFinalOutcome`, `currentAttempts`, and `dailyDate` references for Phase B (they still compile; `session.dailyDate` is always null but the field still exists until B3).

  Update `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`: delete the daily-recording tests ("records daily history…BEFORE finalize", any `recordDailyResult` assertions); keep the free-play `record`/`finalize`/`advance` tests.

- [ ] **Step 6: `useHashGameRouter.ts` — remove daily routing + telemetry**
  - Remove imports: `UseDailyPuzzles`, `UseDailyHistory`, `readResume`, `clearResume`, `toLocalDateString`, `classifyDate`, `buildCountryDailyRound`, `buildCityDailyRound`, and `DAILY_ATTEMPTS_PER_ROUND`.
  - From `UseHashGameRouterOptions` remove `dailyPuzzles`, `dailyHistoryGet`, `resume`.
  - Delete `startOrResumeDaily`, the reveal-route emit block, the entire daily branch in `check()` (the `if (state.kind === 'daily' …)` block), the daily branch in the drain effect, and the entire `daily_attempted` telemetry effect (`:257-290`) plus its refs.
  - Simplify `isPlayableRoute` to `state.kind === 'game' && state.modeId`.
  - Keep the `#game` branch, the deferred drain for `#game`, and the bug-#32 atomic `restart`.

  Update `src/game/hooks/__tests__/useHashGameRouter.test.tsx`: delete daily-bootstrap/resume/redirect cases; keep `#game` start/defer/restart cases.

- [ ] **Step 7: Remove the daily-flow telemetry types**

In `analytics.ts` remove `daily_started`, `daily_attempted`, `daily_completed`, `deep_link_opened` from `EventSchema`. (`daily_shared`, `streak_reached_milestone` remain — their call sites are in `src/game/daily/` files, deleted in A4. `daily_done_low_score_prompt` remains for Phase B.) Update `src/lib/__tests__/analytics.test.ts`: delete the `'emits deep_link_opened with all four outcome values'` test.

- [ ] **Step 8: Verify + commit**

Run: `npm run typecheck` → clean (proves no live code imports the daily routing/provider). Then `npm run test:unit` → PASS for everything except the daily-module unit tests still present in `src/game/daily/__tests__` (those are deleted in A4; if a couple of them fail because they import now-changed shared code, that is expected — note it and proceed; A4 deletes them). To avoid a red gate here, run the targeted suites instead: `npx vitest run src/game/hooks src/components src/lib`.

```bash
git add src/App.tsx src/game/GameController.tsx src/game/shared/hud/GameOverOverlay.tsx src/game/hooks/useGameAnnouncements.ts src/game/hooks/__tests__/useGameAnnouncements.test.tsx src/game/hooks/useHashGameRouter.ts src/game/hooks/__tests__/useHashGameRouter.test.tsx src/lib/hashState.ts src/lib/analytics.ts
git commit -m "refactor(game): remove daily routing, reveal, history wiring and telemetry"
```

---

## Task A4: Delete the orphaned daily source, components, hooks, and their telemetry

Nothing in live code imports `src/game/daily/` after A3. Delete it and the daily-only components/hooks, plus the two remaining daily telemetry types whose call sites live in those files.

**Files (delete):**

- `src/game/daily/` (entire directory, incl. `__tests__/`)
- `src/components/DailyRevealOverlay.tsx` + `src/components/__tests__/DailyRevealOverlay.test.tsx`
- `src/components/DailyShareBlock.tsx` + `src/components/__tests__/DailyShareBlock.test.tsx`
- `src/components/LauncherStreakPill.tsx` + test
- `src/components/LauncherCountdown.tsx` + test
- `src/components/LauncherHistoryPanel.tsx` + test
- `src/components/LauncherCalendarCell.tsx` + test
- `src/components/LauncherMilestoneOverlay.tsx` + test
- `src/game/hooks/useDailyResumePersistence.ts` + `src/game/hooks/__tests__/useDailyResumePersistence.test.tsx`
- `src/hooks/useNextDailyCountdown.ts` + `src/hooks/__tests__/useNextDailyCountdown.test.ts`

**Files (modify):** `src/lib/analytics.ts`

- [ ] **Step 1: Confirm no live importers remain**

Run: `git grep -n "game/daily\|DailyRevealOverlay\|DailyShareBlock\|LauncherStreakPill\|LauncherCountdown\|LauncherHistoryPanel\|LauncherCalendarCell\|LauncherMilestoneOverlay\|useDailyResumePersistence\|useNextDailyCountdown" -- src ':!src/game/daily' ':!*__tests__*'`
Expected: no matches. If any appear, fix that consumer before deleting.

- [ ] **Step 2: Delete the files**

```bash
git rm -r src/game/daily
git rm src/components/DailyRevealOverlay.tsx src/components/__tests__/DailyRevealOverlay.test.tsx
git rm src/components/DailyShareBlock.tsx src/components/__tests__/DailyShareBlock.test.tsx
git rm src/components/LauncherStreakPill.tsx src/components/__tests__/LauncherStreakPill.test.tsx
git rm src/components/LauncherCountdown.tsx src/components/__tests__/LauncherCountdown.test.tsx
git rm src/components/LauncherHistoryPanel.tsx src/components/__tests__/LauncherHistoryPanel.test.tsx
git rm src/components/LauncherCalendarCell.tsx src/components/__tests__/LauncherCalendarCell.test.tsx
git rm src/components/LauncherMilestoneOverlay.tsx src/components/__tests__/LauncherMilestoneOverlay.test.tsx
git rm src/game/hooks/useDailyResumePersistence.ts src/game/hooks/__tests__/useDailyResumePersistence.test.tsx
git rm src/hooks/useNextDailyCountdown.ts src/hooks/__tests__/useNextDailyCountdown.test.tsx
git rm src/game/shared/formatScore.ts            # orphaned: only the old card + LauncherCalendarCell used it
git rm src/game/shared/__tests__/formatScore.test.ts   # if present
```

(Adjust any path that differs; use `git status` to confirm the working tree matches.) Add `formatModeScore` to the Step 1 `git grep` to prove `formatScore.ts` is orphaned before deleting it.

- [ ] **Step 3: Remove the last daily telemetry types**

In `analytics.ts` remove `daily_shared` and `streak_reached_milestone` from `EventSchema`. The schema should now contain only non-daily events (`free_started`, `launcher_dismissed`, `header_cta_clicked`, and `daily_done_low_score_prompt` — the last is removed in Phase B).

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck` → clean. `npm run test:unit` → PASS (all daily unit tests gone). `npm run build` → succeeds.

```bash
git add -A
git commit -m "refactor(daily): delete orphaned daily module, components, hooks, telemetry"
```

---

## Task A5: Build, content pipeline, deploy, docs

**Files:**

- Delete: `.github/workflows/daily-puzzle.yml`, `scripts/daily-content/` (recursive), `cloudflare-worker/queries/{daily_funnel,daily_opened_rate,daily_shared_by_method,history_opened_rate,streak_milestone_distribution}.sql`, `docs/systems/daily-puzzle.md`, `docs/adr/0004-daily-content-data-branch.md`
- Modify: `package.json`, `playwright.config.ts`, `.github/workflows/deploy.yml`, `cloudflare-worker/queries/README.md`, `docs/systems/overview.md`, `docs/systems/testing.md`, `docs/purpose.md`, `README.md`, `docs/roadmap.md`, `docs/ops/runbook.md`, `docs/testing/game-happy-paths.md`, `CLAUDE.md`

- [ ] **Step 1: Delete content pipeline + CF queries + daily docs**

```bash
git rm .github/workflows/daily-puzzle.yml
git rm -r scripts/daily-content
git rm cloudflare-worker/queries/daily_funnel.sql cloudflare-worker/queries/daily_opened_rate.sql cloudflare-worker/queries/daily_shared_by_method.sql cloudflare-worker/queries/history_opened_rate.sql cloudflare-worker/queries/streak_milestone_distribution.sql
git rm docs/systems/daily-puzzle.md docs/adr/0004-daily-content-data-branch.md
```

- [ ] **Step 2: `package.json`**

Remove the `"predev"`, `"daily:generate"`, `"daily:validate"` scripts. Change `"description"` to `"Interactive political world map with country-pinning and city-guessing games. Fully client-side; deployable to any static host."` and remove `"daily-puzzle"` from `keywords`.

- [ ] **Step 3: `playwright.config.ts`**
  - `webServer.command`: change to `'npm run build:e2e && npm run preview -- --port 5173 --strictPort'` (drop `npm run daily:generate &&`).
  - In the `chromium` `testMatch`, remove the entries for every spec deleted in A6 below (the `daily-*`, `share-branches`, `telemetry-deep-link`, `header-cta`, `launcher-history` specs, and `done-confirm-low-score`). Leave the launcher/header specs that A6 **rewrites** (`launcher.spec.ts`, `launcher-focus-order.spec.ts`, `launcher-card-loading-states.spec.ts`, `launcher-backdrop-dismiss.spec.ts`, `header-play-reopens-launcher.spec.ts`).
  - In the CI `testIgnore`, remove `daily-puzzle.spec.ts`, `daily-best-of-3.spec.ts`, `done-confirm-low-score.spec.ts`, `header-play-reopens-launcher.spec.ts` (the last only if A6 stabilises it; otherwise leave it ignored on CI per the existing flake note).
  - In `mobile-chromium` `testMatch`, remove `mobile-daily-flow.spec.ts` (keep `mobile-free-play.spec.ts`).

- [ ] **Step 4: `.github/workflows/deploy.yml`**

Remove the `data`-branch checkout step and the step that copies `index.json` into `public/daily/` (the steps generating/serving `/daily/index.json`). Leave the build + GH-Pages publish steps.

- [ ] **Step 5: Docs**
  - `cloudflare-worker/queries/README.md`: remove references to the five deleted `.sql` files and the daily/streak/history funnels.
  - `docs/systems/overview.md`: in the "Game system" section, remove mentions of the daily layer, best-of-N (`attemptsPerRound > 1`), `resume`, and `src/game/daily/`.
  - `docs/systems/testing.md`, `docs/testing/game-happy-paths.md`, `docs/purpose.md`, `README.md`, `docs/roadmap.md`: remove daily/streak/share feature descriptions; describe the launcher as a free-play high-score hub.
  - `docs/ops/runbook.md`: remove the "Daily content (`data` branch)" section; add a one-line note that the orphan `data` branch can be deleted (`git push origin --delete data`) as optional cleanup.
  - `CLAUDE.md`: remove the `daily-puzzle.md` row from the doc table; in the e2e section remove the `stubDailyIndex`/`seedDailyHistory` helper rows; correct the `dismissLauncher` row note — the launcher is map-first and opens only via the header Play button (it does **not** show on bare `/`).

- [ ] **Step 6: Verify + commit**

Run: `npm run typecheck` → clean. `npm run build` → succeeds (confirms the e2e build command's removal of `daily:generate` didn't break the normal build). Do **not** run e2e yet.

```bash
git add -A
git commit -m "chore(daily): remove content pipeline, CF queries, deploy steps, docs"
```

---

## Task A6: e2e — delete daily specs, rewrite launcher/header specs, clean helpers

**Files:**

- Delete: `e2e/{daily-puzzle,daily-best-of-3,daily-city-feedback,daily-deep-link,daily-reveal,daily-reveal-on-final-attempt,daily-share,daily-share-block-immediate,daily-streak,daily-survives-ocean-click,mobile-daily-flow,share-branches,telemetry-deep-link,header-cta,launcher-history}.spec.ts`
- Rewrite: `e2e/launcher.spec.ts`, `e2e/launcher-focus-order.spec.ts`, `e2e/launcher-card-loading-states.spec.ts`, `e2e/launcher-backdrop-dismiss.spec.ts`, `e2e/header-play-reopens-launcher.spec.ts`
- Modify: `e2e/helpers.ts`, `e2e/cold-load-deep-link.spec.ts`, `e2e/game-country-pinning.spec.ts`, `e2e/game-city-guessing.spec.ts`

- [ ] **Step 1: Delete the daily/share/deep-link specs**

```bash
git rm e2e/daily-puzzle.spec.ts e2e/daily-best-of-3.spec.ts e2e/daily-city-feedback.spec.ts e2e/daily-deep-link.spec.ts e2e/daily-reveal.spec.ts e2e/daily-reveal-on-final-attempt.spec.ts e2e/daily-share.spec.ts e2e/daily-share-block-immediate.spec.ts e2e/daily-streak.spec.ts e2e/daily-survives-ocean-click.spec.ts e2e/mobile-daily-flow.spec.ts e2e/share-branches.spec.ts e2e/telemetry-deep-link.spec.ts e2e/header-cta.spec.ts e2e/launcher-history.spec.ts
```

- [ ] **Step 2: Clean `e2e/helpers.ts`**

Remove `seedDailyHistory`, `stubDailyIndex`, `seedPlayedDaily`, and `installShareStub` if it becomes unused after the share specs are gone (grep `installShareStub` across `e2e/`; remove if zero remaining references). Keep `waitForAppReady`, `waitForGameTestHook`, `waitForCountryTilesRendered`, `waitForAnimationIdle`, `dismissLauncher`, `gotoAndWaitForMap`, `routeMapTiles`, `submitAndWait`, `finalizeGame`.

- [ ] **Step 3: Rewrite `e2e/launcher.spec.ts`** as a free-play hub spec

```ts
import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAppReady, waitForAnimationIdle } from './helpers'

test.describe('Launcher (free-play hub)', () => {
  test('header Play opens the launcher; choosing a mode starts a free game', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)

    await page.getByTestId('header-play').click()
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible()
    await waitForAnimationIdle(launcher)

    // both mode cards present, each showing a personal-best line
    await expect(page.getByTestId('launcher-card-country-pinning')).toBeVisible()
    await expect(page.getByTestId('launcher-card-city-guessing-best')).toBeVisible()

    await page.getByTestId('launcher-card-country-pinning-play').click()
    await expect(launcher).not.toBeAttached()
    await expect(page).toHaveURL(/#game\/country-pinning/)
    await expect(page.getByTestId('game-hud')).toBeVisible()
  })
})
```

- [ ] **Step 4: Rewrite the other four launcher/header specs**
  - `launcher-backdrop-dismiss.spec.ts`: open via `header-play`, click the backdrop, assert `launcher` `not.toBeAttached()`.
  - `launcher-focus-order.spec.ts`: open via `header-play`, assert focus lands on a `[data-testid$="-play"]` button; Tab moves to the next focusable; `launcher-close` is reachable.
  - `launcher-card-loading-states.spec.ts`: rename intent to a free-play DOM smoke — assert both cards render with title + Play + `-best` line. (Keep the filename so the `mobile-webkit`/`desktop-firefox-touch` `testMatch` entries stay valid.)
  - `header-play-reopens-launcher.spec.ts`: start a game, end it (Esc/End game → game-over → Back to map), then `header-play` reopens the launcher; assert visible.

  Follow CLAUDE.md e2e rules: use `waitForAnimationIdle`/state waits, never `waitForTimeout` or `force:true`.

- [ ] **Step 5: Guard — confirm no KEPT spec imports a removed daily helper**

Run: `git grep -nE "seedDailyHistory|stubDailyIndex|seedPlayedDaily|#daily" -- e2e`
Expected: no matches (all were in the deleted daily specs/helpers). If any kept spec matches, fix it now.

Note: `cold-load-deep-link.spec.ts` (asserts `session.attemptsPerRound`/`dailyDate`) and `toast-above-modal.spec.ts` (drives `__funworldmap_game.completeNow()`) still **pass in Phase A** — those fields/seams exist until Phase B. They are edited in **Phase B** (its e2e/helpers task), not here. `game-country-pinning.spec.ts`/`game-city-guessing.spec.ts` reference no removed symbols and need no edit.

- [ ] **Step 6: Verify + commit**

Run: `npm run test:e2e` → green (locally; if CI-only flake appears on a launcher spec, apply the CLAUDE.md quarantine pattern with a tracking issue rather than `waitForTimeout`). Also re-confirm `npm run typecheck`.

```bash
git add -A
git commit -m "test(e2e): remove daily specs; rewrite launcher/header specs for free play"
```

**End of Phase A — the app is fully daily-free and shippable.**

---

# Phase B — Delete the dead best-of-N machinery (test-first)

With the daily gone, `attemptsPerRound` is always 1, `completeNow` is a no-op, and `resume` is never dispatched. **Remove every reader before deleting the fields.** A code sweep found readers in more places than the HUD shell — they must all be handled or B4 (the field removal) breaks `typecheck`:

| Reader                                                                                                                                                                                   | What it reads                                                                               | Task |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- |
| `hud/HudShell.tsx`, `hud/AttemptsIndicator.tsx`                                                                                                                                          | `attemptsPerRound`, `currentAttempts`, `attemptsRemaining`, `deriveBest`                    | B1   |
| `hooks/useRevealMapEffects.ts`                                                                                                                                                           | `attemptsPerRound`/`attemptsRemaining`/`currentAttempts` (intermediate-attempt marker)      | B2   |
| `modes/city-guessing/CityGuessingHud.tsx`, `modes/country-pinning/CountryPinningHud.tsx`                                                                                                 | `attemptsPerRound > 1` reveal branches                                                      | B2   |
| `hud/FirstSessionTutorial.tsx` (+ `GameController` prop)                                                                                                                                 | `attemptsPerRound` → `-daily`/`-free` copy variant                                          | B2   |
| `App.tsx` `roundEndTarget`, `useGameAnnouncements.ts`, `GameSessionProvider.tsx` (API + seams)                                                                                           | `attemptsPerRound`/`attemptsRemaining`/`currentAttempts`/`dailyDate`/`completeNow`/`resume` | B3   |
| `shared/__tests__/factories.ts` + several `*.test.*`                                                                                                                                     | session-shape literals                                                                      | B4   |
| `e2e/helpers.ts` `waitForGameTestHook` (probes `completeNow`!) + `submitAndWait` (`currentAttempts`); `e2e/toast-above-modal.spec.ts` (`completeNow`); `e2e/cold-load-deep-link.spec.ts` | seams / fields                                                                              | B5   |

`finalize` is **not** best-of-N — it stays.

## Task B1: Strip best-of-N from the HUD

**Files:**

- Rewrite: `src/game/shared/hud/HudShell.tsx`
- Modify: `src/game/shared/hud/__tests__/HudShell.test.tsx` (if present)
- Delete: `src/game/shared/hud/AttemptsIndicator.tsx` + `src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx` (if present)
- Modify: `src/game/GameController.tsx`
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: Rewrite `HudShell.tsx`** (no best-of-N)

```tsx
import { type ReactNode } from 'react'
import { LivesIndicator } from './LivesIndicator'
import { ScoreBadge } from './ScoreBadge'
import { StreakBadge } from './StreakBadge'
import { RoundCounter } from './RoundCounter'
import type { GameSession } from '../types'

interface Props {
  session: GameSession
  onEndGame: () => void
  children: ReactNode
}

export function HudShell({ session, onEndGame, children }: Props) {
  const fixedRounds = session.maxRounds !== null && session.maxRounds > 1

  return (
    <div
      role="region"
      aria-label="Game HUD"
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[95vw]"
      data-testid="game-hud"
      data-game-status={session.status}
      data-game-mode={session.modeId}
    >
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {fixedRounds ? (
            <RoundCounter
              current={Math.min(session.roundIndex + 1, session.maxRounds!)}
              total={session.maxRounds!}
            />
          ) : (
            <LivesIndicator lives={session.lives} />
          )}
          <div className="flex items-center gap-2">
            <ScoreBadge score={session.score} pending={false} />
            {fixedRounds ? null : <StreakBadge streak={session.streak} />}
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

(The previous `confirmAsked`/`promptShownThisRound` state and its reset effect are gone, so `HudShell` no longer imports `useState`/`useEffect`. If `ScoreBadge`'s `pending` prop has no other caller passing `true` after this, dropping it is a tidy follow-up — out of scope here.)

- [ ] **Step 2: Delete `AttemptsIndicator`**

```bash
git rm src/game/shared/hud/AttemptsIndicator.tsx
git rm src/game/shared/hud/__tests__/AttemptsIndicator.test.tsx  # if it exists
```

- [ ] **Step 3: `GameController.tsx`** — drop the Done wiring + tutorial signal
  - Remove `completeNow` from the `useGameSessionContext()` destructure.
  - `<HudShell session={session} onEndGame={onEndGame} onDone={completeNow}>` → `<HudShell session={session} onEndGame={onEndGame}>`.
  - `firstAttemptMade={session.currentAttempts.length > 0 || session.lastOutcome !== null}` → `firstAttemptMade={session.lastOutcome !== null}`.

- [ ] **Step 4: Remove `daily_done_low_score_prompt`**

In `analytics.ts` remove `daily_done_low_score_prompt` from `EventSchema` (its only call site was the deleted Done-confirm in `HudShell`).

- [ ] **Step 5: Update HudShell test (if present)** to assert no Done button renders and the indicator is lives/rounds by mode. Then verify + commit.

Run: `npm run typecheck` → clean. `npm run test:unit` → PASS.

```bash
git add -A
git commit -m "refactor(hud): remove best-of-N Done/attempts UI from the HUD"
```

---

## Task B2: Strip best-of-N from mode HUDs, reveal effects, and the tutorial

These all key off `attemptsPerRound > 1` (daily) vs `=== 1` (free). After removal the daily branch is dead and the free branch is unconditional. They still compile against the present fields, so do this task before B4.

**Files:**

- Modify: `src/game/hooks/useRevealMapEffects.ts` + `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`
- Modify: `src/game/modes/city-guessing/CityGuessingHud.tsx` + `src/game/modes/city-guessing/__tests__/CityGuessingHud.test.tsx`
- Modify: `src/game/modes/country-pinning/CountryPinningHud.tsx`
- Modify: `src/game/shared/hud/FirstSessionTutorial.tsx`
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: `useRevealMapEffects.ts`** — remove the intermediate-attempt marker logic. The effect(s) guarded by `if (session.attemptsPerRound <= 1) return` (the country-mode intermediate flash and the city resume re-paint) exist only for best-of-N; delete those effects/branches and the `attemptsPerRound`/`attemptsRemaining`/`currentAttempts` reads and deps. Keep the round-end reveal animation that free play uses (driven by `lastOutcome`/`status`). Read the file first; the round-end vs intermediate-attempt effects are separate — remove only the intermediate ones. Update `useRevealMapEffects.test.tsx`: delete the intermediate-attempt/resume marker cases (those building `attemptsPerRound: 3`), keep the round-end reveal cases.

- [ ] **Step 2: `CityGuessingHud.tsx`** — remove the `session.attemptsPerRound > 1` reveal branch (lines ~43–48) and the `attemptsPerRound === 1` guard (line ~74, now always true → render unconditionally). Drop the `AttemptRecord` import and the `latestPointAttempt(session.currentAttempts)` helper. Update `CityGuessingHud.test.tsx`: drop the `attemptsPerRound>1` cases; keep the free-play (`attemptsPerRound: 1`) render case (rewritten to not set the field once B4 lands — for now it can still set it).

- [ ] **Step 3: `CountryPinningHud.tsx`** — remove the `session.attemptsPerRound > 1` branch (line ~19) and its dep; the reveal is shown based on `reveal`/`status` only.

- [ ] **Step 4: `FirstSessionTutorial.tsx`** — remove the `attemptsPerRound` prop; the COPY variant is always `${modeId}-free`. Delete the `${modeId}-daily` entries from the `COPY` map. In `GameController.tsx`, change `<FirstSessionTutorial modeId={session.modeId} attemptsPerRound={session.attemptsPerRound} firstAttemptMade={…} />` to drop the `attemptsPerRound` prop.

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck` → clean. `npm run test:unit` → PASS.

```bash
git add -A
git commit -m "refactor(game): remove best-of-N branches from mode HUDs, reveal effects, tutorial"
```

---

## Task B3: Remove remaining best-of-N reads in app, announcements, provider

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/game/hooks/useGameAnnouncements.ts`
- Modify: `src/game/shared/GameSessionProvider.tsx`

- [ ] **Step 1: `App.tsx` `roundEndTarget`** (`:167-182`)

Remove the `attemptsPerRound`/`attemptsRemaining` check:

```tsx
const roundEndTarget = useMemo(() => {
  if (session.status !== 'round-ended') return null
  if (!isCountryPinning(session.modeId)) return null
  const reveal = session.lastOutcome?.reveal
  if (!reveal || reveal.kind !== 'country') return null
  return byCca3.get(reveal.targetCca3) ?? null
}, [session.status, session.modeId, session.lastOutcome, byCca3])
```

- [ ] **Step 2: `useGameAnnouncements.ts`** — drop the always-true derivation + dead branch

Remove `const isFinalOutcome = session.attemptsPerRound === 1 || session.attemptsRemaining === 0` and the unreachable `if (inCountryMode && !isFinalOutcome) { … }` branch. The country flow becomes: city branch (`!inCountryMode`) → timer; country correct → `holdThenAdvance(3000, …)`; country wrong+endsGame → `holdThenAdvance(…)`; country wrong+intra-game → Esc-only. Remove `session.currentAttempts` and `session.dailyDate` from the deps array.

- [ ] **Step 3: `GameSessionProvider.tsx`** — trim the API + seams
  - From `GameSessionApi` remove `completeNow` and `resume`; trim `start`/`restart` to `(modeId, firstRound, maxRounds)`.
  - In `useGameSession()` destructure drop `completeNow`, `resume`.
  - Remove `completeNow`/`resume` from the `api` object + its deps.
  - In the test-seam effect remove the `window.__funworldmap_game.completeNow = …` line and its cleanup `delete`; trim the `restart` seam to `(modeId, firstRound, maxRounds)`. **Keep `finalize`, `endGame`, `getSession`, `restart`.**

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck` → clean. `npm run test:unit` → PASS.

```bash
git add -A
git commit -m "refactor(game): drop best-of-N reads in app, announcements, provider"
```

---

## Task B4: Simplify the reducer + the session type, factory, and dependent tests

**Files:**

- Modify: `src/game/shared/useGameSession.ts`
- Modify: `src/game/shared/types.ts` (`GameSession` + delete `AttemptRecord`)
- Modify: `src/game/shared/__tests__/useGameSession.test.ts`
- Modify: `src/game/shared/__tests__/factories.ts` (shared session factory)
- Modify: `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`
- Modify: `src/hooks/__tests__/useLauncherVisibility.test.tsx` (mock API)
- Modify: `src/game/hooks/useGameTestSeams.ts` (signature only)

- [ ] **Step 1: Update the reducer tests first**

In `useGameSession.test.ts`: delete all `resume`-action tests, all `completeNow` tests, and all best-of-N tests (`attemptsPerRound: 3`, running-best, `deriveBest`). Keep/extend the single-attempt tests: `start` sets `attemptsRemaining`-free state; `attempt` ends the round immediately, adds the attempt's points to `score`, updates `streak`/`bestStreak`, decrements lives on wrong country guesses; `advance` increments `roundIndex`; `finishFree` → game-over `endedEarly`; `finalize` from round-ended-endsGame → game-over; `restart` resets. Add a test asserting a single country guess of 100 pts yields `score === 100` and `streak === 1`.

Run: `npx vitest run src/game/shared/__tests__/useGameSession.test.ts` → FAIL (old API still present / new expectations unmet).

- [ ] **Step 2: Edit the `GameSession` type** in `src/game/shared/types.ts`

Remove fields `attemptsPerRound`, `attemptsRemaining`, `currentAttempts`, and `dailyDate` from `GameSession`. (Keep `lives`, `score`, `streak`, `bestStreak`, `roundIndex`, `maxRounds`, `currentRound`, `lastOutcome`, `endedEarly`, `used`, `modeId`, `status`.) Also **delete the `AttemptRecord` type** — after B1–B3 its only users (`currentAttempts`, `deriveBest`, the daily resume payload, `CityGuessingHud`) are gone. `lastOutcome` uses `GuessOutcome`/reveal, not `AttemptRecord`. (Confirm with `git grep AttemptRecord` → only the definition + soon-to-be-edited test factory remain.)

- [ ] **Step 3: Rewrite `useGameSession.ts`**

Remove the `resume` and `completeNow` actions; remove `attemptsPerRound`/`dailyDate` from `start`/`restart`; remove `attemptsRemaining`/`currentAttempts`/`attemptsPerRound`/`dailyDate` from `EMPTY`; delete the exported `deriveBest`; delete the `attemptsPerRound>1` config guards. New `attempt` and `endOfRound`:

```ts
    case 'attempt': {
      if (state.status !== 'playing' || !state.currentRound) return state
      const nextLives = Math.max(0, state.lives + action.result.livesDelta) as GameSession['lives']
      const nextStreak = action.result.pointsEarned >= 100 ? state.streak + 1 : 0
      const endsGame =
        state.maxRounds !== null ? state.roundIndex + 1 >= state.maxRounds : nextLives <= 0
      return {
        ...state,
        status: 'round-ended',
        lives: nextLives,
        score: state.score + action.result.pointsEarned,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        lastOutcome: {
          pointsEarned: action.result.pointsEarned,
          livesDelta: action.result.livesDelta,
          endsGame,
          reveal: action.result.reveal,
        },
      }
    }
```

Trim `start`/`restart` to set `{ ...EMPTY, modeId, status:'playing', maxRounds, currentRound: firstRound, used: new Set([roundKey(firstRound)]) }`. Update the hook's return type and the `start`/`restart` callbacks to the 3-arg signatures. Remove `completeNow`/`resume` from the returned object.

- [ ] **Step 4: `useGameTestSeams.ts`** — trim the `start` signature in `UseGameTestSeamsArgs` to `(modeId, firstRound, maxRounds)` (drop `attemptsPerRound`/`dailyDate`).

- [ ] **Step 5: Update the shared factory + dependent tests**
  - `src/game/shared/__tests__/factories.ts`: remove `attemptsPerRound: 1`, `attemptsRemaining: 1`, `currentAttempts: []` from the base session object, and delete the `makeAttempt` helper (it returns `AttemptRecord`). Many tests build sessions via this factory — this is the single point that fixes most of them.
  - `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`: remove `attemptsPerRound`/`attemptsRemaining`/`dailyDate` from the inline session literals, and delete the daily ("Today's results"/share) test (already non-functional after A3's `GameOverOverlay` rewrite).
  - `src/hooks/__tests__/useLauncherVisibility.test.tsx`: remove `completeNow: () => {}` and `resume: () => {}` from the mock `GameSessionApi` value (the API dropped them in B3).

- [ ] **Step 6: Run + verify**

Run: `npx vitest run src/game/shared/__tests__/useGameSession.test.ts` → PASS. Then `npm run typecheck` → clean (no readers of the removed fields remain after B1–B3). `npm run test:unit` → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(reducer): remove best-of-N and daily fields from game session"
```

---

## Task B5: Phase B e2e + helpers + final sweep

This is the task that fixes the e2e seams. **`waitForGameTestHook` gates on `completeNow`, which B3 removed — every game spec using it would time out** until this is fixed.

**Files:**

- Modify: `e2e/helpers.ts`
- Modify: `e2e/toast-above-modal.spec.ts`
- Modify: `e2e/cold-load-deep-link.spec.ts`
- Modify: `e2e/test-globals.d.ts`
- Delete: `e2e/done-confirm-low-score.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Fix `e2e/helpers.ts`**
  - `waitForGameTestHook`: delete the `typeof g.completeNow === 'function' &&` clause from the readiness probe (keep `submitCountryGuess` + `finalize`). Update its doc comment to drop `completeNow`.
  - `submitAndWait`: it polls `getSession().currentAttempts.length`. With `currentAttempts` gone, change it to poll a surviving signal — for a single-attempt round, a submitted guess transitions to `round-ended` with `lastOutcome !== null`. Replace the poll body with `getSession().lastOutcome !== null ? 1 : 0` (or assert `status === 'round-ended'`), and check callers still pass `expectAfter: 1`. If only deleted daily specs used it, delete the helper instead.

- [ ] **Step 2: Rework `e2e/toast-above-modal.spec.ts`** — it drives `__funworldmap_game.completeNow()` to reach a state where a toast overlays the modal. `completeNow` is gone; reach the same end state via free play: submit guesses (or `End game` → `finishFree` → game-over), then trigger the toast. Read the spec first to see which toast it asserts, then re-derive the path without `completeNow`.

- [ ] **Step 3: `e2e/cold-load-deep-link.spec.ts`** — remove the `expect(session.attemptsPerRound).toBe(1)` and `expect(session.dailyDate).toBeNull()` assertions (both fields removed in B4).

- [ ] **Step 4: `e2e/test-globals.d.ts`** — update the `getSession` return type to drop `currentAttempts` (and `completeNow` from the `__funworldmap_game` shape if declared there).

- [ ] **Step 5: Delete the best-of-N spec + config entry**

```bash
git rm e2e/done-confirm-low-score.spec.ts
```

Remove `'done-confirm-low-score.spec.ts'` from `playwright.config.ts` `testMatch` and from the CI `testIgnore`.

- [ ] **Step 6: Final grep sweep**

Run: `git grep -niE "daily|streak_reached|attemptsPerRound|best-of|completeNow|deriveBest|currentAttempts|stubDailyIndex|seedDailyHistory" -- src e2e scripts .github cloudflare-worker docs/systems docs/adr`
Expected: only incidental, non-functional matches (e.g. the word "streak" in `bestStreak`/`StreakBadge`, which are free-play concepts and correct to keep). Investigate anything else.

- [ ] **Step 7: Full verification**

Run, in order:

- `npm run typecheck` → clean
- `npm run lint` → clean
- `npm run test:unit` → PASS
- `npm run build` → succeeds
- `npm run test:e2e` → green

- [ ] **Step 8: Manual smoke (both modes)**

`npm run dev`, then: header **Play** → launcher → **Country** → play a few rounds → 3 wrong → game-over shows score + longest streak + PB → **Play again** works; back to map; header **Play** → **City** → play 10 rounds → game-over shows score + PB. Refresh mid-game: no errors, no `/daily/index.json` 404 in the console.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test(e2e): remove best-of-N done-confirm spec; final daily-removal sweep"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** every spec section maps to a task — launcher hub (A2), header (A2), daily module/components/hooks (A3–A4), routing (A3), telemetry (A2–A4, B1), build/content/deploy (A5), docs (A5), storage cleanup (A1), reducer/best-of-N (B1–B4), e2e (A6, B5).
- **Type-coupling rule:** each telemetry event type is removed in the same commit as its last call site (A2/A3/A4/B1) — never earlier, or the build breaks mid-task. The `analytics.test.ts` assertions are updated alongside (A2 `daily_opened`, A3 `deep_link_opened`).
- **Reader-before-symbol rule (Phase B):** ALL readers are emptied before B4 deletes the fields — HUD shell (B1), mode HUDs + reveal effects + tutorial (B2), app/announcements/provider (B3), then the type + factory + dependent tests (B4), then e2e seams/helpers (B5). A `git grep` for each doomed symbol after its reader-task should return only the definition/factory.
- **e2e seam trap:** `waitForGameTestHook` (helpers.ts) gates on `completeNow`; B5 must drop that clause or the whole game e2e suite times out. `toast-above-modal.spec.ts` and `submitAndWait` also depend on removed seams/fields — all handled in B5.
- **Phase B is large** (≈8 source files + 6 test files + 4 e2e files). It is pure dead-code deletion gated behind the shippable Phase A — consider landing Phase A and Phase B as **two separate PRs**.
- **`finalize` stays; `completeNow`/`resume` go.** Do not remove `finalize` — free play depends on it (`App.tsx`, city/country end-of-game, the e2e `__funworldmap_game.finalize()` seam).
- If `npm run test:unit` is used as a gate in A3 before A4 deletes the daily unit tests, scope it to `src/game/hooks src/components src/lib` as noted, to avoid a spurious red from soon-to-be-deleted tests.
