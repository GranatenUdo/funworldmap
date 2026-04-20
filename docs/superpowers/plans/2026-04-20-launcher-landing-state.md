# Launcher Landing State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a launcher overlay that takes over the default `/` view on cold tab load, offering two mode cards (Country Pinning, City Guessing) with personal bests, plus a "Just explore the map" dismiss link. Session-scoped: dismisses hide it for the session, a fresh tab re-shows, deep-link URLs bypass, game-end re-shows. Delete the existing PlayMenu popover (the launcher is the single source of truth for mode picking).

**Architecture:** New `Launcher` and `LauncherModeCard` components wired in `App.tsx`. Visibility state in a new `useLauncherVisibility` hook derived from `window.location.hash` + `session.status` + in-memory `dismissed` flag. Header simplifies while launcher is up; the header play button (post-dismiss) re-opens the launcher. Animations live in `src/index.css` alongside existing panel keyframes. Test-id anchors on the launcher and mode cards stabilise the new e2e spec; an `e2e/helpers.ts` `dismissLauncher` migrates ~10 existing specs in one pass. Three logical commits on the feature branch (foundation → components+integration → e2e), squash-merged on PR.

**Tech Stack:** TypeScript 5.7, React 19, Vite 6, Tailwind CSS 4, Playwright 1.59, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-04-20-launcher-landing-state-design.md` (committed `19dd21a`).

---

## Pre-flight

### Task 1: Clean state, baseline, feature branch

**Files:** none (git + baseline checks only).

- [ ] **Step 1: Verify working tree is clean**

Run: `git status`
Expected: `On branch main` and `nothing to commit, working tree clean` — except the untracked `docs/design-sketches/` directory (leftover artifact from earlier brainstorming; ignore).

- [ ] **Step 2: Pull latest main**

Run: `git pull origin main`
Expected: *"Already up to date."* or fast-forward.

- [ ] **Step 3: Run baseline checks**

Run: `npm run lint && npx tsc -b && npm run test:unit`
Expected: zero errors (1 pre-existing warning in `city-guessing/index.tsx` is unrelated — ignore), 121/121 unit tests pass.

- [ ] **Step 4: Create the feature branch**

Run: `git checkout -b feat/launcher-landing-state`
Expected: *"Switched to a new branch 'feat/launcher-landing-state'"*.

Full e2e suite is NOT run in pre-flight. The integration commit (Phase 3) changes default-route behaviour; existing e2e specs will fail until their `beforeEach` is migrated in Phase 5. Full e2e runs once at the end (Task 15).

---

## Phase 1 — Foundation (commit 1)

### Task 2: Extract `LAST_MODE_KEY` and helpers into `src/game/shared/lastMode.ts`

**Files:**
- Create: `src/game/shared/lastMode.ts`
- Modify: `src/components/PlayMenu.tsx` (replace local `readLastMode` with imported version — temporary; the file is deleted in Phase 3)

Rationale: the key + read helper currently live inside `PlayMenu.tsx` as a local constant. The new Launcher needs them too. Extracting now (before PlayMenu is deleted) keeps each commit compilable.

- [ ] **Step 1: Create `src/game/shared/lastMode.ts`**

```ts
import type { ModeId } from './types'

export const LAST_MODE_KEY = 'funworldmap-game-last-mode'

export function readLastMode(): ModeId {
  try {
    const v = localStorage.getItem(LAST_MODE_KEY)
    if (v === 'country-pinning' || v === 'city-guessing') return v
  } catch {
    /* ignore: private mode / disabled storage */
  }
  return 'country-pinning'
}

export function writeLastMode(modeId: ModeId): void {
  try {
    localStorage.setItem(LAST_MODE_KEY, modeId)
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: Update `src/components/PlayMenu.tsx` to import from the new module**

Replace lines 1–14 (the local constant + helper + imports) with:

```tsx
import { useEffect, useRef, useState } from 'react'
import { listModes } from '../game/modes'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { LAST_MODE_KEY, readLastMode, writeLastMode } from '../game/shared/lastMode'
```

Then update line 63 (inside `selectMode`) from:

```tsx
try { localStorage.setItem(LAST_MODE_KEY, id) } catch { /* ignore */ }
```

to:

```tsx
writeLastMode(id)
```

Remove the now-unused `LAST_MODE_KEY` import if the linter complains; keep it otherwise (it's explicitly re-exported style).

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit`
Expected: 121/121 pass.

### Task 3: Create `useLauncherVisibility` hook + unit tests

**Files:**
- Create: `src/hooks/useLauncherVisibility.ts`
- Create: `src/hooks/__tests__/useLauncherVisibility.test.tsx`
- Modify: `src/game/shared/GameSessionProvider.tsx` (export `GameSessionContext` so tests can inject)

- [ ] **Step 1: Export `GameSessionContext` from the provider**

Edit `src/game/shared/GameSessionProvider.tsx` line 18:

```ts
// Before:
const GameSessionContext = createContext<GameSessionApi | null>(null)

// After:
// eslint-disable-next-line react-refresh/only-export-components
export const GameSessionContext = createContext<GameSessionApi | null>(null)
```

Rationale: tests inject a mock `GameSessionApi` without booting the real provider (which requires pools of countries/cities). The `react-refresh/only-export-components` disable mirrors the existing one at line 76.

- [ ] **Step 2: Write the hook file**

Create `src/hooks/useLauncherVisibility.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

function isBareRoot(hash: string): boolean {
  return hash === '' || hash === '#'
}

export interface LauncherVisibility {
  visible: boolean
  dismiss: () => void
  show: () => void
}

export function useLauncherVisibility(): LauncherVisibility {
  const { session } = useGameSessionContext()
  const initialHash = typeof window !== 'undefined' ? window.location.hash : ''
  const [currentHash, setCurrentHash] = useState(initialHash)
  const [dismissed, setDismissed] = useState(false)
  const prevSessionStatusRef = useRef(session.status)

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Reset dismissal on non-idle → idle transitions (game end).
  useEffect(() => {
    const prev = prevSessionStatusRef.current
    if (prev !== 'idle' && session.status === 'idle') {
      setDismissed(false)
    }
    prevSessionStatusRef.current = session.status
  }, [session.status])

  const dismiss = useCallback(() => setDismissed(true), [])
  const show = useCallback(() => setDismissed(false), [])

  const visible = isBareRoot(currentHash) && !dismissed && session.status === 'idle'

  return { visible, dismiss, show }
}
```

- [ ] **Step 3: Write the unit tests**

Create `src/hooks/__tests__/useLauncherVisibility.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { GameSessionContext } from '../../game/shared/GameSessionProvider'
import type { GameSessionApi } from '../../game/shared/GameSessionProvider'
import type { GameSession } from '../../game/shared/types'
import { useLauncherVisibility } from '../useLauncherVisibility'

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    modeId: 'country-pinning',
    status: 'idle',
    lives: 3,
    score: 0,
    streak: 0,
    bestStreak: 0,
    roundIndex: 0,
    maxRounds: null,
    currentRound: null,
    lastOutcome: null,
    used: new Set(),
    ...overrides,
  }
}

function makeApi(session: GameSession): GameSessionApi {
  return {
    session,
    mode: null,
    start: () => {},
    submitGuess: () => {},
    submitGuessInput: () => {},
    advance: () => {},
    overrideRound: () => {},
    endGame: () => {},
  }
}

function wrapper(api: GameSessionApi) {
  return ({ children }: { children: ReactNode }) => (
    <GameSessionContext.Provider value={api}>{children}</GameSessionContext.Provider>
  )
}

function setHash(hash: string) {
  window.history.replaceState(null, '', hash === '' ? window.location.pathname : `${window.location.pathname}${hash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

describe('useLauncherVisibility', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('visible at /', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
  })

  it('visible at /# (bare hash)', () => {
    window.history.replaceState(null, '', '/#')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
  })

  it('hidden at /#FRA (deep-link bypass)', () => {
    window.history.replaceState(null, '', '/#FRA')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
  })

  it('hidden at /#game/country-pinning/play', () => {
    window.history.replaceState(null, '', '/#game/country-pinning/play')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
  })

  it('dismiss() hides launcher', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
  })

  it('show() re-reveals when on bare root', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
    act(() => result.current.show())
    expect(result.current.visible).toBe(true)
  })

  it('game-end transition (playing → idle) resets dismissed', () => {
    const playingApi = makeApi(makeSession({ status: 'playing' }))
    const { result, rerender } = renderHook(() => useLauncherVisibility(), {
      wrapper: wrapper(playingApi),
    })
    // While playing, visible is false regardless of hash.
    expect(result.current.visible).toBe(false)

    // User dismisses (no-op effect since already hidden, but sets the flag).
    act(() => result.current.dismiss())

    // Game ends: transition to idle.
    const idleApi = makeApi(makeSession({ status: 'idle' }))
    rerender(({ children }: { children: ReactNode }) => (
      <GameSessionContext.Provider value={idleApi}>{children}</GameSessionContext.Provider>
    ))

    // dismissed has been reset; at bare root, visible === true.
    expect(result.current.visible).toBe(true)
  })

  it('hashchange from / to /#FRA hides launcher', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
    act(() => setHash('#FRA'))
    expect(result.current.visible).toBe(false)
  })

  it('hashchange from /#FRA back to / with dismissed=false shows launcher', () => {
    window.history.replaceState(null, '', '/#FRA')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
    act(() => setHash(''))
    expect(result.current.visible).toBe(true)
  })
})
```

- [ ] **Step 4: Run the new tests**

Run: `npm run test:unit -- useLauncherVisibility`
Expected: all tests pass.

If any fail due to the `rerender` wrapper remount rebuilding state: adjust the last test to use a single wrapper that holds session state in a parent `useState` and toggles it. The pattern above is correct for most renderHook setups; if Vitest's older `renderHook` behaves differently, inline-restructure.

- [ ] **Step 5: Run the full unit suite**

Run: `npm run test:unit`
Expected: 121 + new tests all pass.

### Task 4: Add `onNonEmptyChange` prop to `SearchBar`

**Files:**
- Modify: `src/components/SearchBar.tsx`

- [ ] **Step 1: Add the prop to the interface and the onChange handler**

Edit `src/components/SearchBar.tsx`. Update the `Props` interface at lines 5–9:

```tsx
interface Props {
  countries: CountryData[]
  comparePickingMode?: boolean
  onSelect: (cca3: string) => void
  onNonEmptyChange?: () => void
}
```

Update the component signature at line 22:

```tsx
export default function SearchBar({ countries, comparePickingMode, onSelect, onNonEmptyChange }: Props) {
```

Update the input's onChange at line 107. Current:

```tsx
onChange={(e) => setQuery(e.target.value)}
```

Change to:

```tsx
onChange={(e) => {
  const next = e.target.value
  setQuery(next)
  if (next.length > 0) onNonEmptyChange?.()
}}
```

No ref-guard — the handler is idempotent (setDismissed(true) on an already-true state is a no-op).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: all pass.

### Task 5: Commit the foundation

- [ ] **Step 1: Stage and commit**

```bash
git add src/game/shared/lastMode.ts src/game/shared/GameSessionProvider.tsx src/components/PlayMenu.tsx src/hooks/useLauncherVisibility.ts src/hooks/__tests__/useLauncherVisibility.test.tsx src/components/SearchBar.tsx
git commit -m "$(cat <<'EOF'
feat(launcher): foundation — lastMode module, useLauncherVisibility hook, SearchBar onNonEmptyChange

Extracts LAST_MODE_KEY + helpers from PlayMenu into a reusable
module that survives the upcoming PlayMenu deletion. Adds the
visibility state machine hook (in-memory dismissed flag, hash
listener, game-end reset) with nine unit tests. Adds the
onNonEmptyChange prop on SearchBar that the launcher will use
for its search-typed dismiss path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Launcher components (commit 2)

### Task 6: Add launcher keyframes to `src/index.css`

**Files:**
- Modify: `src/index.css` (append after the existing `@keyframes loading-dots` block around line 143)

- [ ] **Step 1: Append the four keyframes**

Insert immediately after the `@keyframes loading-dots` block (around line 143):

```css
@keyframes launcher-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes launcher-card-in {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes launcher-text-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes launcher-exit {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

- [ ] **Step 2: Build to verify CSS compiles**

Run: `npx vite build` (abort with Ctrl+C once it starts the actual bundling — we just need Tailwind + CSS parse to succeed, which happens early).

Alternative quick check: `npm run lint` — Prettier/ESLint may not catch CSS errors, so skipping in favour of a full build is fine. If build is too slow, inspect `src/index.css` manually for balanced braces.

### Task 7: Create `LauncherModeCard` component

**Files:**
- Create: `src/components/LauncherModeCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { ModeId } from '../game/shared/types'
import type { PersonalBest } from '../game/shared/types'

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
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z" />
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

interface Props {
  modeId: ModeId
  title: string
  tagline: string
  best: PersonalBest
  onStart: () => void
}

export function LauncherModeCard({ modeId, title, tagline, best, onStart }: Props) {
  const hasPlayed = best.gamesPlayed > 0
  return (
    <button
      type="button"
      onClick={onStart}
      data-testid={`launcher-mode-${modeId}`}
      className="group text-left p-5 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 border border-sand-300/50 dark:border-dark-200/30 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60"
    >
      <div className="flex items-start gap-3 mb-3">
        {ICONS[modeId]}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {title}
          </div>
          <p className="text-[13px] text-sand-600 dark:text-dark-100 mt-1 leading-snug">
            {tagline}
          </p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-sand-200/70 dark:border-dark-200/30">
        <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light">
          Best
        </div>
        <div
          className="mt-0.5 text-sand-900 dark:text-dark-50 tabular-nums"
          data-testid={`launcher-best-${modeId}`}
        >
          {hasPlayed ? (
            <>
              <span className="text-2xl font-bold">{best.bestScore}</span>
              <span className="text-[13px] text-sand-600 dark:text-dark-100 ml-1">
                / 1000
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold">—</span>
              <span className="text-[13px] text-sand-600 dark:text-dark-100 ml-1">
                / 1000
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
```

Assumes `PersonalBest` type from `src/game/shared/types.ts` — verify the import resolves. If `PersonalBest` is not exported from `types.ts`, check `src/game/shared/usePersonalBests.ts` for the import source and adjust.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean. If the `PersonalBest` type import fails, find its source (likely `src/game/shared/types.ts`) and update the import line.

### Task 8: Create `Launcher` component

**Files:**
- Create: `src/components/Launcher.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useCallback, useEffect, useRef } from 'react'
import { listModes } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { usePersonalBests } from '../game/shared/usePersonalBests'
import { LauncherModeCard } from './LauncherModeCard'

interface Props {
  onDismiss: () => void
}

const TAGLINES: Record<ModeId, string> = {
  'country-pinning': 'Click where the country is. 10 rounds.',
  'city-guessing': 'Drop a pin near the city. 10 rounds.',
}

function focusSearchInput(): void {
  const el = document.getElementById('search-input') as HTMLInputElement | null
  el?.focus()
}

export function Launcher({ onDismiss }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { best: countryPinningBest } = usePersonalBests('country-pinning')
  const { best: cityGuessingBest } = usePersonalBests('city-guessing')
  const modes = listModes()
  const lastMode = readLastMode()

  const bestFor = (id: ModeId) =>
    id === 'country-pinning' ? countryPinningBest : cityGuessingBest

  const dismissWithFocus = useCallback(() => {
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const startMode = useCallback(
    (id: ModeId) => {
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
    },
    [onDismiss],
  )

  // Initial focus on last-played mode's card; fall back to country-pinning.
  useEffect(() => {
    const selector = `[data-testid="launcher-mode-${lastMode}"]`
    const target = rootRef.current?.querySelector<HTMLButtonElement>(selector)
    target?.focus()
  }, [lastMode])

  // Focus trap across the three focusable elements: mode card 1, mode card 2, dismiss link.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = Array.from(
        root.querySelectorAll<HTMLButtonElement>('button[data-testid^="launcher-"]'),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose how to play"
      data-testid="launcher"
      className="fixed inset-0 z-[210] flex items-center justify-center p-6"
    >
      {/* Backdrop — dimmed + blurred map */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 dark:bg-[rgba(11,15,26,0.7)] backdrop-blur-[4px]"
        style={{ animation: 'launcher-backdrop-in 220ms ease-out' }}
      />

      {/* Card cluster */}
      <div className="relative w-full max-w-2xl mx-auto">
        <header
          className="text-center mb-6"
          style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}
        >
          <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </div>
          <p className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2">
            194 countries. Explore or guess.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {modes.map((m, i) => (
            <div
              key={m.id}
              style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}
            >
              <LauncherModeCard
                modeId={m.id}
                title={m.title}
                tagline={TAGLINES[m.id]}
                best={bestFor(m.id)}
                onStart={() => startMode(m.id)}
              />
            </div>
          ))}
        </div>

        <div
          className="mt-6 text-center"
          style={{ animation: 'launcher-text-in 180ms ease-out 260ms both' }}
        >
          <button
            type="button"
            onClick={dismissWithFocus}
            data-testid="launcher-dismiss"
            className="text-[13px] text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60 rounded px-2 py-1"
          >
            Just explore the map
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean. If `usePersonalBests` import path differs from `../game/shared/usePersonalBests`, adjust.

### Task 9: Commit launcher components + CSS keyframes

```bash
git add src/index.css src/components/LauncherModeCard.tsx src/components/Launcher.tsx
git commit -m "$(cat <<'EOF'
feat(launcher): Launcher + LauncherModeCard components, entrance keyframes

Presentational component pair for the launcher. Card is a single
<button> — whole surface tappable, one focus target per card.
Personal bests displayed in Q11-C two-line format with em-dash
empty state. Dialog semantics + focus trap across the three
focusable elements (two mode cards, dismiss link). Initial focus
lands on the last-played mode.

Four new keyframes in src/index.css (backdrop, card, text, exit)
staggered per the Section 5 choreography. prefers-reduced-motion
is honoured via the existing global rule.

Not yet wired into App/Header — that's the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Integration (commit 3)

### Task 10: Integrate launcher in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports and hook call**

At the top of `src/App.tsx`, add to the existing import list:

```tsx
import { Launcher } from './components/Launcher'
import { useLauncherVisibility } from './hooks/useLauncherVisibility'
```

Inside `AppInner()`, after the existing `const { session, submitGuessInput } = useGameSessionContext()` line (around line 86), add:

```tsx
const { visible: launcherVisible, dismiss: dismissLauncher, show: showLauncher } = useLauncherVisibility()
```

- [ ] **Step 2: Add the play-button handler**

Inside `AppInner()`, add alongside the other `useCallback` declarations (near line 93 where `toggleSatellite` is defined):

```tsx
const openLauncher = useCallback(() => {
  showLauncher()
}, [showLauncher])
```

Note: does NOT call `deselect()`. Per the spec, the play button only re-shows the launcher; country selection is preserved underneath the backdrop.

- [ ] **Step 3: Extend the Escape handler**

In the Escape handler around line 220-243, add a branch BEFORE the existing `if (compareWith || comparePickingMode)` check:

```tsx
if (e.key === 'Escape') {
  if (gameActive) return
  if (launcherVisible) {
    dismissLauncher()
    const searchInput = document.getElementById('search-input') as HTMLInputElement | null
    searchInput?.focus()
    return
  }
  if (compareWith || comparePickingMode) { exitCompare(); return }
  // ...existing code
}
```

Update the effect's dependency array to include `launcherVisible` and `dismissLauncher`.

- [ ] **Step 4: Render the launcher and pass props to Header**

At the end of the JSX, alongside the existing `<Toast />`, `<WorldMap />`, `<Header />`, `<GameController />`, and conditional panel render, add:

```tsx
{launcherVisible && <Launcher onDismiss={dismissLauncher} />}
```

Place it AFTER `<Toast />` and `<Header />` but BEFORE `<GameController />`. The z-[210] class on the launcher handles stacking.

Update the existing `<Header>` call to pass new props:

```tsx
<Header
  countries={countries}
  theme={theme}
  satellite={satellite}
  comparePickingMode={comparePickingMode}
  gameActive={gameActive}
  launcherVisible={launcherVisible}
  onSelect={onMapSelect}
  onThemeCycle={cycle}
  onSatelliteToggle={toggleSatellite}
  onOpenLauncher={openLauncher}
  onLauncherDismiss={dismissLauncher}
/>
```

(The `onLauncherDismiss` prop will be forwarded by Header to SearchBar's `onNonEmptyChange` in Task 11.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: errors in `Header.tsx` about unknown props — that's fine, fixed in Task 11.

### Task 11: Update `Header.tsx` + delete `PlayMenu.tsx`

**Files:**
- Modify: `src/components/Header.tsx`
- Delete: `src/components/PlayMenu.tsx`

- [ ] **Step 1: Rewrite `src/components/Header.tsx`**

Replace the entire file contents with:

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
  launcherVisible: boolean
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
  onSatelliteToggle: () => void
  onOpenLauncher: () => void
  onLauncherDismiss: () => void
}

export default function Header({
  countries,
  theme,
  satellite,
  comparePickingMode,
  gameActive,
  launcherVisible,
  onSelect,
  onThemeCycle,
  onSatelliteToggle,
  onOpenLauncher,
  onLauncherDismiss,
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
            <SearchBar
              countries={countries}
              comparePickingMode={comparePickingMode}
              onSelect={onSelect}
              onNonEmptyChange={launcherVisible ? onLauncherDismiss : undefined}
            />
          </div>
        )}

        <div className="pointer-events-auto ml-3 flex items-center gap-2">
          {!gameActive && !launcherVisible && (
            <button
              onClick={onOpenLauncher}
              aria-label="Play a game"
              className="w-10 h-10 rounded-xl backdrop-blur-sm border bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-teal dark:text-teal-light hover:bg-sand-200/90 dark:hover:bg-dark-300/80 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
              data-testid="header-play"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {!launcherVisible && (
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
          )}

          <ThemeToggle theme={theme} onCycle={onThemeCycle} />
        </div>
      </div>
    </header>
  )
}
```

Changes from the pre-launcher version: `PlayMenu` import removed, `useRef`/`useState` removed (popover state gone), `triggerRef` removed, play button `onClick` now calls `onOpenLauncher` directly, play+satellite buttons guarded by `!launcherVisible`, SearchBar receives `onNonEmptyChange` forwarded from `onLauncherDismiss`.

- [ ] **Step 2: Delete `src/components/PlayMenu.tsx`**

```bash
git rm src/components/PlayMenu.tsx
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: clean. If anything still imports PlayMenu, update it (there should be nothing — grep confirmed earlier).

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit`
Expected: all pass (no unit test touches PlayMenu directly).

- [ ] **Step 5: Manual sanity via dev server**

Run: `npm run dev` (background)
Wait ~3s, visit `http://localhost:5173/`. The launcher should appear over the map. Click "Just explore the map" — launcher should disappear, play + satellite buttons should reappear in the header. Click the play button — launcher re-appears. Close the dev server with Ctrl+C.

### Task 12: Commit the integration

```bash
git add src/App.tsx src/components/Header.tsx
git commit -m "$(cat <<'EOF'
feat(launcher): wire launcher in App, simplify Header, delete PlayMenu

On cold load at bare-root hashes, the launcher overlay mounts
over the map. Header hides play + satellite while the launcher
is visible; theme toggle stays. Search stays visible and dismisses
the launcher on first non-empty keystroke. Play button (post-
dismiss) re-opens the launcher — single source of truth for mode
picking.

Escape handler extended: launcher-visible takes precedence over
the existing compare/panel/search chain.

PlayMenu popover deleted — its role is fully covered by the
launcher. ~150 lines removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Copy fix (commit 4)

### Task 13: Fix "195 countries" → "194 countries" in `index.html`

**Files:**
- Modify: `index.html` (three lines)

- [ ] **Step 1: Apply the three edits**

In `index.html`, change these three lines:

Line 10 (meta description):
```html
<meta name="description" content="Explore 195 countries on a fast, free, interactive world map. Borders, capitals, populations, and more — with per-field source attribution." />
```
to:
```html
<meta name="description" content="Explore 194 countries on a fast, free, interactive world map. Borders, capitals, populations, and more — with per-field source attribution." />
```

Line 17 (og:description):
```html
<meta property="og:description" content="Explore 195 countries on a fast, free, interactive world map. Borders, capitals, populations, and more — with per-field source attribution." />
```
to the same string with `195` → `194`.

Line 24 (twitter:description):
```html
<meta name="twitter:description" content="Explore 195 countries on a fast, free, interactive world map." />
```
to the same string with `195` → `194`.

- [ ] **Step 2: Verify no "195 countries" remains**

Run: `grep -rn "195 countries" .` (from repo root; ignore `node_modules/`)
Expected: zero matches.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
fix(copy): correct "195 countries" to 194 in meta tags

The independent-country count in src/data/countries.json is 194,
not 195. Meta description, og:description, and twitter:description
all claimed 195 — pre-existing inaccuracy. Corrected alongside
the launcher tagline for product-copy consistency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — E2E (commit 5)

### Task 14: Create `e2e/helpers.ts` with `dismissLauncher`

**Files:**
- Create: `e2e/helpers.ts`

- [ ] **Step 1: Write the helper**

```ts
import { expect, type Page } from '@playwright/test'

/**
 * Dismiss the launcher if it is visible. No-op if the test uses a deep-link
 * URL (e.g. /#FRA) that bypasses the launcher.
 *
 * Call from beforeEach in any spec that relies on map-first entry via
 * page.goto('/') — after this PR, '/' shows the launcher by default.
 */
export async function dismissLauncher(page: Page): Promise<void> {
  const launcher = page.getByTestId('launcher')
  const isVisible = await launcher.isVisible().catch(() => false)
  if (!isVisible) return
  await page.getByTestId('launcher-dismiss').click()
  await expect(launcher).not.toBeVisible({ timeout: 5_000 })
}
```

### Task 15: Migrate existing e2e specs

**Files:**
- Modify each of the specs listed below by adding `dismissLauncher(page)` in its `beforeEach` (after `page.goto('/')`) or by updating `page.goto()` to a deep-link URL.

Strategy: specs that load `/` and interact with map/search/header need `dismissLauncher`. Specs that load `/#<cca3>` or other deep-links already bypass the launcher and need no change.

- [ ] **Step 1: Audit each spec**

Run:

```bash
grep -nE "page\.goto\(['\"]/?" e2e/*.spec.ts
```

For each match, decide: does the test need the launcher dismissed, or should the URL be changed to a deep link? General rule — if the test does anything with `getByTestId('search-input')`, `getByTestId('header-play')`, `getByTestId('satellite-toggle')`, or map interaction before opening a country panel, it needs `dismissLauncher`.

- [ ] **Step 2: Apply dismissLauncher to each affected spec**

For each spec file (`e2e/scaffold.spec.ts`, `e2e/search.spec.ts`, `e2e/theme-and-responsive.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/satellite-default.spec.ts`, `e2e/panel-focus.spec.ts`, `e2e/keyboard-map-nav.spec.ts`, `e2e/map-and-countries.spec.ts`, `e2e/map-reliability.spec.ts`, `e2e/compare-view-dimming.spec.ts`):

1. Add the import at the top: `import { dismissLauncher } from './helpers'`.
2. In the existing `beforeEach` (or add one if missing), after the `page.goto('/')` or `page.waitForTimeout()` line, add: `await dismissLauncher(page)`.

For `e2e/panel-and-deeplink.spec.ts`: inspect — most tests already use deep-link URLs via the local `openPanel()` helper, so no migration needed. Verify by running the spec after Phase 3 integration: if any test fails, migrate it individually.

For `e2e/game-country-pinning.spec.ts` and `e2e/game-city-guessing.spec.ts`: these currently click `header-play` then `play-menu-<mode>`. Replace those two clicks with ONE click on the launcher mode card:

Old pattern:
```ts
await page.getByTestId('header-play').click()
await page.getByTestId('play-menu-country-pinning').click()
```

New pattern:
```ts
await page.getByTestId('launcher-mode-country-pinning').click()
```

No `dismissLauncher` needed here — starting a mode from the launcher dismisses it implicitly.

Also remove the `getByTestId('play-menu')` reference in `game-city-guessing.spec.ts:158-159` — that test block tests an old popover behaviour that no longer exists. If it's solely testing popover UI, delete the test; if it's testing something else with PlayMenu as incidental setup, update it to use the launcher card.

For `e2e/meta-and-static.spec.ts`: no migration likely needed (tests static HTML / sitemap). Inspect and confirm. If it asserts the "195 countries" string, update to "194 countries" to match the index.html fix.

- [ ] **Step 3: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all existing tests pass again. If any fail, the audit in Step 1 missed a case — migrate that spec and re-run.

### Task 16: Write `e2e/launcher.spec.ts` and register it in `playwright.config.ts`

**Files:**
- Create: `e2e/launcher.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Register the new spec**

Add `'launcher.spec.ts'` to the `chromium` project's `testMatch` array in `playwright.config.ts` (lines 24–33). After the edit, the array should end with `'launcher.spec.ts'` as a new entry alongside the existing SwiftShader-compatible specs.

- [ ] **Step 2: Write the spec**

Create `e2e/launcher.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function freshTab(page: Page, hash = ''): Promise<void> {
  await page.goto(hash === '' ? '/' : `/${hash}`)
}

test.describe('Launcher — visibility', () => {
  test('appears on cold load at /', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })

  test('does NOT appear on cold load at /#FRA (deep-link bypass)', async ({ page }) => {
    await freshTab(page, '#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })

  test('does NOT appear on cold load at /#game/country-pinning', async ({ page }) => {
    await freshTab(page, '#game/country-pinning')
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })
})

test.describe('Launcher — dismiss paths', () => {
  test('clicking "Just explore the map" dismisses and focuses search', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('typing in search dismisses on first non-empty change', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-input').fill('F')
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('focusing search without typing does NOT dismiss', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-input').focus()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('clicking a mode card dismisses and starts that game', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-mode-country-pinning').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toContain('game/country-pinning')
  })

  test('pressing Escape dismisses and focuses search', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('clicking the backdrop area does NOT dismiss', async ({ page }) => {
    await freshTab(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible({ timeout: 10_000 })
    // Click at 5px from each corner — clearly on the backdrop, not on any card.
    const viewport = page.viewportSize() || { width: 1280, height: 720 }
    await page.mouse.click(10, 10)
    await page.waitForTimeout(400)
    await expect(launcher).toBeVisible()
    await page.mouse.click(viewport.width - 10, viewport.height - 10)
    await page.waitForTimeout(400)
    await expect(launcher).toBeVisible()
  })
})

test.describe('Launcher — session scope', () => {
  test('dismissing + reloading re-shows launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await page.reload()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })

  test('dismissing + closing a country panel does NOT re-show launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await page.getByTestId('search-input').fill('France')
    const firstResult = page.getByTestId('search-results').getByRole('option').first()
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    await firstResult.click({ force: true })
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('panel-close').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })
})

test.describe('Launcher — header behaviour', () => {
  test('play + satellite hidden while launcher visible', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('header-play')).not.toBeVisible()
    await expect(page.getByTestId('satellite-toggle')).not.toBeVisible()
  })

  test('play + satellite restored after dismiss', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('header-play')).toBeVisible()
    await expect(page.getByTestId('satellite-toggle')).toBeVisible()
  })

  test('play button re-opens launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 3_000 })
  })
})

test.describe('Launcher — personal bests', () => {
  test('first-play state shows em-dash placeholder', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('funworldmap-game-country-pinning-bests')
      localStorage.removeItem('funworldmap-game-city-guessing-bests')
    })
    await freshTab(page)
    const cpBest = page.getByTestId('launcher-best-country-pinning')
    await expect(cpBest).toContainText('—')
    await expect(cpBest).toContainText('/ 1000')
  })

  test('numeric best displays when stored', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'funworldmap-game-country-pinning-bests',
        JSON.stringify({ bestScore: 920, bestStreak: 6, gamesPlayed: 3 }),
      )
    })
    await freshTab(page)
    const cpBest = page.getByTestId('launcher-best-country-pinning')
    await expect(cpBest).toContainText('920')
  })
})

test.describe('Launcher — accessibility', () => {
  test('has dialog role + aria-modal + aria-label', async ({ page }) => {
    await freshTab(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible({ timeout: 10_000 })
    await expect(launcher).toHaveAttribute('role', 'dialog')
    await expect(launcher).toHaveAttribute('aria-modal', 'true')
    await expect(launcher).toHaveAttribute('aria-label', 'Choose how to play')
  })

  test('initial focus lands on last-played mode card', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher-mode-city-guessing')).toBeFocused({ timeout: 5_000 })
  })

  test('Tab cycles through mode card 1, mode card 2, dismiss link, wraps', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'country-pinning')
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher-mode-country-pinning')).toBeFocused({ timeout: 5_000 })
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-mode-city-guessing')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-dismiss')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-mode-country-pinning')).toBeFocused()
  })
})
```

- [ ] **Step 3: Run the new spec**

Run: `npx playwright test e2e/launcher.spec.ts --reporter=list`
Expected: all ~15 tests pass.

If the "mode card dismisses and starts that game" test races (launcher hidden assertion before game hash settles), increase the dismiss-hidden timeout or split into sequential checks.

- [ ] **Step 4: Commit e2e work**

```bash
git add e2e/helpers.ts e2e/launcher.spec.ts playwright.config.ts e2e/*.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): launcher spec + dismissLauncher migration across existing specs

New e2e/helpers.ts with dismissLauncher(page) used by every spec
that relies on map-first entry via page.goto('/'). New
launcher.spec.ts covers visibility, dismiss paths, session scope,
header behaviour, personal bests, and accessibility (~15 tests).
game-country-pinning and game-city-guessing specs migrated to
click launcher mode cards directly (replacing the old
header-play + play-menu sequence).

playwright.config.ts chromium testMatch updated to include
launcher.spec.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Finalize

### Task 17: Full lint + tsc + unit + e2e

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: zero errors (1 pre-existing warning OK).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: 121 + 9 new launcher-visibility tests pass.

- [ ] **Step 4: Full Playwright suite**

Run: `npm run test:e2e`
Expected: all pre-existing + new launcher tests pass. If `chromium-gpu` map tests show the same flakiness pattern we saw on the a11y PR, note but do not block — that's pre-existing environmental GPU flakiness (verified on main, documented in the PR body).

### Task 18: Manual cross-browser smoke

**Files:** none (manual verification with running dev server).

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (background). Visit `http://localhost:5173/`.

- [ ] **Step 2: Desktop light**

- Launcher appears on cold load; card cluster centered; map dimmed behind.
- Click "Just explore the map" → launcher dismisses, play + satellite buttons reappear in the header.
- Click header play button → launcher re-appears.
- Click "Country Pinning" card → game starts, launcher gone.
- Let the game end (skip all rounds) → summary appears → click "Back to map" → launcher re-appears.
- Select France via search → panel appears → close panel → launcher does NOT re-appear (session-dismissed state preserved).
- `prefers-reduced-motion: reduce` in devtools → launcher entrance collapses to near-instant fade.

- [ ] **Step 3: Desktop dark**

Toggle theme. Repeat the same checks. Backdrop should be warm-dark (not pure black); card and mode cards should be visible with good contrast.

- [ ] **Step 4: Mobile light + dark**

Switch to iPhone 12 / 375px emulation. Mode cards should stack vertically. Card cluster should fill the viewport with reasonable padding. Dismiss link legible.

- [ ] **Step 5: Deep-link verification**

Paste `http://localhost:5173/#FRA` into a fresh tab. Expected: France panel, no launcher flash.

- [ ] **Step 6: Stop dev server**

Ctrl+C.

### Task 19: Push and open PR

**Files:** none (git + gh only).

- [ ] **Step 1: Push the branch**

Run: `git push -u origin feat/launcher-landing-state`

- [ ] **Step 2: Open the PR**

Run:

```bash
gh pr create --title "feat(ux): launcher landing state with mode picker" --body "$(cat <<'EOF'
## Summary

Replaces the default `/` home view with a launcher — a centered card over a dimmed, blurred map offering two mode cards (Country Pinning, City Guessing) with personal bests, plus a "Just explore the map" dismiss link.

- **Session-scoped visibility.** Dismissal hides the launcher for the tab session; a fresh tab re-shows it; deep-link URLs (`/#FRA`, `/#game/*`) bypass it entirely; finishing a game re-shows it.
- **Header simplifies** while the launcher is up (wordmark + search + theme only). The header play button (post-dismiss) re-opens the launcher — single source of truth for mode picking.
- **PlayMenu deleted.** Its role is fully covered by the launcher; ~150 lines removed.
- **Accessibility.** `role="dialog"` + `aria-modal="true"` + focus trap across three focusable elements. Initial focus respects `funworldmap-game-last-mode`. Escape dismisses.
- **Copy fix (bundled).** Three "195 countries" occurrences in `index.html` meta tags corrected to "194" to match the actual independent-country count in `src/data/countries.json`.

Spec: `docs/superpowers/specs/2026-04-20-launcher-landing-state-design.md`.

## Test plan

- [x] New unit spec `useLauncherVisibility` (9 tests).
- [x] New e2e spec `launcher.spec.ts` (~15 tests).
- [x] `npm run lint && npx tsc -b && npm run test:unit && npm run test:e2e` all green.
- [ ] Manual smoke: desktop light/dark, mobile light/dark, reduced-motion, deep-link bypass. To be run by reviewer before merge.

## Known limitations (documented in spec)

- Browser back/forward does not undo launcher dismissal (in-memory state, session-scoped by design).
- Backdrop blur may cost paint on low-end devices; tuning deferred to observation.

## Out of scope

- Surface palette overhaul (the other piece of user feedback that prompted this design direction). Deferred to a separate spec now that the launcher is in place to anchor palette decisions.
- Game HUD polish, post-round reveal, post-game summary polish.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Return it for review.

- [ ] **Step 3: Wait for CI**

Monitor with `gh pr checks <N> --watch --interval 30`. All checks must pass before merging.

---

## Reference — expected repo state after each commit

| Commit | Touches | App state at commit |
|---|---|---|
| 1 (foundation) | lastMode module, hook + tests, SearchBar prop, GameSessionContext export | Compiles. No UI change. |
| 2 (launcher components) | Launcher, LauncherModeCard, keyframes | Compiles. No UI change (not rendered yet). |
| 3 (integration) | App, Header, delete PlayMenu | UI changes: launcher appears on cold load. Existing e2e may fail here. |
| 4 (copy fix) | index.html | Three meta strings corrected. No functional change. |
| 5 (e2e) | helpers, launcher spec, migrated specs, config | All tests green. |
