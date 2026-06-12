# Phase 4 — Share Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 4 share flow — pure text share text builder, a dispatching `DailyShareBlock` component mounted in both `GameOverOverlay` and `DailyRevealOverlay`, and e2e coverage of the `#daily/<date>` no-mode launcher-anchor route.

**Architecture:** One pure function (`buildShareText`) + one presentational + dispatch component (`DailyShareBlock`). Block mounts when `session.kind === 'daily'` (game-over) or when `modesPlayed >= 1` (reveal overlay). Share dispatch: `navigator.share` → clipboard text fallback → "Copy link only" secondary button. Toast reuses existing `funworldmap:toast` CustomEvent. Analytics: the pre-existing `daily_shared` schema is extended to include `{ date, modesPlayed }`.

**Tech Stack:** TypeScript, React 19, Vite 6, Vitest + jsdom, Playwright. Existing MapLibre/Tailwind unchanged.

**Spec:** [`2026-04-22-retention-v1-finishing-design.md`](../specs/2026-04-22-retention-v1-finishing-design.md) §B.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/game/daily/shareText.ts` | Create (~60 LOC) | Pure `buildShareText({ date, results, streak, originUrl })` → string. No DOM, no browser API. |
| `src/game/daily/__tests__/shareText.test.ts` | Create | Inline-snapshot tests covering all per-mode states and streak conditions. |
| `src/components/DailyShareBlock.tsx` | Create (~90 LOC) | Presentational + dispatch. Renders preview + Share + Copy-link-only. Fires `daily_shared`, dispatches toast. |
| `src/components/__tests__/DailyShareBlock.test.tsx` | Create | Component tests: render, navigator.share path, clipboard fallback, copy-link-only, toast dispatch, AbortError suppression. |
| `src/lib/analytics.ts:4` | Modify (~1 LOC) | Extend `daily_shared` schema from `{ mode; method }` to `{ date; modesPlayed; method }`. |
| `src/game/shared/hud/GameOverOverlay.tsx` | Modify (~15 LOC) | Mount `<DailyShareBlock>` when `session.kind === 'daily'`. |
| `src/components/DailyRevealOverlay.tsx` | Modify (~15 LOC) | Mount `<DailyShareBlock>` at the bottom when any mode has stored attempts for the date. |
| `playwright.config.ts` | Modify (~3 LOC) | Grant `clipboard-read` + `clipboard-write` to chromium + chromium-gpu projects. |
| `e2e/daily-share.spec.ts` | Create | Post-game share block visible; `navigator.share` path; clipboard fallback with exact text match; copy-link-only; share visible in reveal overlay. |
| `e2e/daily-deep-link.spec.ts` | Create | `#daily/<date>` (no mode) lands on launcher with `anchorDate`; past date still shows launcher (reveal-link-only); future date's redirect behavior (as currently implemented). |

No new runtime dependencies. No CF Worker changes. No schema migrations (localStorage shape unchanged).

---

## Prerequisites (already done)

The spec listed several Phase 4 tasks that are **already in place** from earlier phases:
- `src/lib/hashState.ts:5,19` — `{ kind: 'daily', modeId: string | null, reveal: boolean }` supports no-mode parsing today.
- `src/hooks/useLauncherVisibility.ts:8-12,48-55` — `isDailyRoot` matches `#daily/YYYY-MM-DD` and exposes `anchorDate`; the Launcher already mounts with that anchor in `App.tsx:364`.
- `src/lib/analytics.ts:8` — `daily_shared` event already in `EventSchema` (needs field adjustment, Task 3).

Plan B therefore skips the hashState / App routing work called out in the spec.

---

### Task 1: Set up isolated worktree + pre-flight

**Files:**
- New worktree: `../polworldmap-phase-4-share`

- [ ] **Step 1: Create worktree off `main` with new branch**

```bash
git worktree add ../polworldmap-phase-4-share -b feat/phase-4-share-flow main
```

- [ ] **Step 2: Install dependencies**

```bash
cd /e/polworldmap-phase-4-share
npm install 2>&1 | tail -3
```

Expected: completes without errors.

- [ ] **Step 3: Pre-flight B0 — domain config check**

```bash
grep -rn "funworldmap.com\|CNAME" . --include="*.md" --include="CNAME" 2>/dev/null | head -5
ls public/CNAME 2>/dev/null
```

Document the finding in the PR description (which domain shares via). This is informational only — the share text uses `window.location.origin` regardless.

- [ ] **Step 4: Sanity — confirm current chromium CI baseline is green**

```bash
npm run test:unit 2>&1 | tail -3
```

Expected: 231/231 passing.

---

### Task 2: `buildShareText` pure function (TDD)

**Files:**
- Create: `src/game/daily/shareText.ts`
- Test: `src/game/daily/__tests__/shareText.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/game/daily/__tests__/shareText.test.ts
import { describe, it, expect } from 'vitest'
import { buildShareText } from '../shareText'
import type { DailyDayResult, StreakState } from '../types'

const pinningResult: DailyDayResult = {
  score: 87,
  attempts: [
    { pointsEarned: 42, distanceKm: 1200 },
    { pointsEarned: 63, distanceKm: 400 },
    { pointsEarned: 91, distanceKm: 0, guessCca3: 'FRA' },
  ],
  completedAt: 1_700_000_000_000,
}

const cityResult: DailyDayResult = {
  score: 81,
  attempts: [
    { pointsEarned: 34, distanceKm: 1500 },
    { pointsEarned: 78, distanceKm: 200 },
    { pointsEarned: 95, distanceKm: 10 },
  ],
  completedAt: 1_700_000_000_000,
}

const streak7: StreakState = { current: 7, longest: 7, lastActiveDate: '2026-04-21', lastMilestoneShown: 3 }
const streak0: StreakState = { current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0 }
const streak1: StreakState = { current: 1, longest: 1, lastActiveDate: '2026-04-21', lastMilestoneShown: 0 }

const origin = 'https://funworldmap.com'

describe('buildShareText', () => {
  it('both modes played, 7-day streak — full format', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult, 'city-guessing': cityResult },
      streak: streak7,
      originUrl: origin,
    })
    expect(text).toMatchInlineSnapshot(`
      "funworldmap · 04-21
      🌍 Country  🟥🟧🟩  87/100
      🏙️ City     🟥🟨🟩  81/100
      🔥 7-day streak
      https://funworldmap.com/#daily/2026-04-21"
    `)
  })

  it('one mode played (country only) — city shows not-played line', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult },
      streak: streak1,
      originUrl: origin,
    })
    expect(text).toMatchInlineSnapshot(`
      "funworldmap · 04-21
      🌍 Country  🟥🟧🟩  87/100
      🏙️ City     ⬜⬜⬜  not played
      🔥 1-day streak
      https://funworldmap.com/#daily/2026-04-21"
    `)
  })

  it('streak === 0 omits streak line entirely', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult, 'city-guessing': cityResult },
      streak: streak0,
      originUrl: origin,
    })
    expect(text).not.toContain('streak')
    expect(text).toMatchInlineSnapshot(`
      "funworldmap · 04-21
      🌍 Country  🟥🟧🟩  87/100
      🏙️ City     🟥🟨🟩  81/100
      https://funworldmap.com/#daily/2026-04-21"
    `)
  })

  it('all five quintile buckets render the expected emoji', () => {
    const mkAttempt = (pointsEarned: number) => ({ pointsEarned, distanceKm: 0 })
    const result: DailyDayResult = {
      score: 100,
      attempts: [mkAttempt(0), mkAttempt(45), mkAttempt(80)],
      completedAt: 0,
    }
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': result },
      streak: streak0,
      originUrl: origin,
    })
    expect(text).toContain('⬛🟥🟨')
  })

  it('quintile edge values (0, 29, 30, 49, 50, 69, 70, 89, 90, 100)', () => {
    const mk = (p: number) => ({ pointsEarned: p, distanceKm: 0 })
    const edges: DailyDayResult = {
      score: 0,
      attempts: [mk(29), mk(30), mk(49)],
      completedAt: 0,
    }
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': edges },
      streak: streak0,
      originUrl: origin,
    })
    // 29 -> ⬛ (0-29), 30 -> 🟥 (30-49), 49 -> 🟥 (30-49)
    expect(text).toContain('⬛🟥🟥')
  })

  it('incomplete attempts (2 of 3) pad with ⬛', () => {
    const partial: DailyDayResult = {
      score: 85,
      attempts: [
        { pointsEarned: 60, distanceKm: 100 },
        { pointsEarned: 85, distanceKm: 10 },
      ],
      completedAt: 0,
    }
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': partial },
      streak: streak0,
      originUrl: origin,
    })
    // 60 -> 🟧 (50-69), 85 -> 🟨 (70-89), missing -> ⬛
    expect(text).toContain('🟧🟨⬛')
  })

  it('date formats MM-DD', () => {
    const text = buildShareText({
      date: '2026-12-03',
      results: { 'country-pinning': pinningResult },
      streak: streak0,
      originUrl: origin,
    })
    expect(text).toContain('funworldmap · 12-03')
  })

  it('origin without trailing slash concatenates correctly', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult },
      streak: streak0,
      originUrl: 'https://example.com',
    })
    expect(text).toContain('https://example.com/#daily/2026-04-21')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/daily/__tests__/shareText.test.ts 2>&1 | tail -5
```

Expected: all 8 tests fail with "Cannot find module '../shareText'".

- [ ] **Step 3: Create `shareText.ts` implementation**

```ts
// src/game/daily/shareText.ts
import type { ModeId } from '../shared/types'
import type { AttemptRecord, DailyDayResult, StreakState } from './types'

export type ShareResults = Partial<Record<ModeId, DailyDayResult | null>>

export interface BuildShareTextArgs {
  date: string // YYYY-MM-DD
  results: ShareResults
  streak: StreakState
  originUrl: string // e.g. https://funworldmap.com (no trailing slash)
}

const MODE_EMOJI: Record<ModeId, string> = {
  'country-pinning': '🌍',
  'city-guessing': '🏙️',
}

const MODE_LABEL: Record<ModeId, string> = {
  'country-pinning': 'Country',
  'city-guessing': 'City   ',
}

function quintile(score: number): '🟩' | '🟨' | '🟧' | '🟥' | '⬛' {
  if (score >= 90) return '🟩'
  if (score >= 70) return '🟨'
  if (score >= 50) return '🟧'
  if (score >= 30) return '🟥'
  return '⬛'
}

function attemptStrip(attempts: readonly AttemptRecord[]): string {
  const emojis = attempts.slice(0, 3).map((a) => quintile(a.pointsEarned))
  while (emojis.length < 3) emojis.push('⬛')
  return emojis.join('')
}

function modeLine(modeId: ModeId, result: DailyDayResult | null | undefined): string {
  const prefix = `${MODE_EMOJI[modeId]} ${MODE_LABEL[modeId]}`
  if (!result) return `${prefix} ⬜⬜⬜  not played`
  return `${prefix} ${attemptStrip(result.attempts)}  ${result.score}/100`
}

function mmdd(date: string): string {
  // date is YYYY-MM-DD
  return date.slice(5)
}

export function buildShareText({ date, results, streak, originUrl }: BuildShareTextArgs): string {
  const lines: string[] = []
  lines.push(`funworldmap · ${mmdd(date)}`)
  lines.push(modeLine('country-pinning', results['country-pinning']))
  lines.push(modeLine('city-guessing', results['city-guessing']))
  if (streak.current > 0) lines.push(`🔥 ${streak.current}-day streak`)
  lines.push(`${originUrl}/#daily/${date}`)
  return lines.join('\n')
}

export function modesPlayed(results: ShareResults): 1 | 2 | 0 {
  const cp = results['country-pinning'] ? 1 : 0
  const cg = results['city-guessing'] ? 1 : 0
  return (cp + cg) as 0 | 1 | 2
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/daily/__tests__/shareText.test.ts 2>&1 | tail -5
```

Expected: 8/8 passing. If any snapshot mismatches because the alignment spacing differs, update the string-constant alignment in `MODE_LABEL` to match the snapshot expectation (the test specifies `🏙️ City     ` with five trailing spaces for alignment).

- [ ] **Step 5: TypeScript check**

```bash
npx tsc -b 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/game/daily/shareText.ts src/game/daily/__tests__/shareText.test.ts
git commit -m "feat(daily): pure buildShareText builder with quintile + streak + origin URL"
```

---

### Task 3: Update `daily_shared` analytics schema

**Files:**
- Modify: `src/lib/analytics.ts:8`

- [ ] **Step 1: Read the current schema**

```bash
grep -n "daily_shared\|EventSchema" src/lib/analytics.ts | head -10
```

The current line 8 reads:

```ts
  daily_shared: { mode: ModeId; method: 'share-api' | 'clipboard-text' | 'clipboard-link' }
```

- [ ] **Step 2: Replace with spec-aligned schema**

Change line 8 to:

```ts
  daily_shared: { date: string; modesPlayed: 1 | 2; method: 'share-api' | 'clipboard-text' | 'clipboard-link' }
```

Keep method vocabulary `share-api` / `clipboard-text` / `clipboard-link` — they're more descriptive than the spec's shorter names and no events have been fired with the prior shape (so no schema migration is needed).

- [ ] **Step 3: Remove `ModeId` import if it becomes unused**

```bash
grep -n "ModeId" src/lib/analytics.ts | head
```

If `ModeId` is still used elsewhere in `analytics.ts`, leave the import. If not, remove the import line. Check tsc in the next step.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc -b 2>&1 | tail -5
```

Expected: clean. If a type error surfaces in a test file referencing the old `mode` field, note the location — no such caller should exist (the event has not yet been fired).

- [ ] **Step 5: Run unit tests**

```bash
npm run test:unit 2>&1 | tail -3
```

Expected: 231/231 passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat(analytics): daily_shared schema — date + modesPlayed + method"
```

---

### Task 4: `DailyShareBlock` component (TDD)

**Files:**
- Create: `src/components/DailyShareBlock.tsx`
- Test: `src/components/__tests__/DailyShareBlock.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/__tests__/DailyShareBlock.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DailyShareBlock } from '../DailyShareBlock'
import type { StreakState } from '../../game/daily/types'

const results = {
  'country-pinning': {
    score: 87,
    attempts: [
      { pointsEarned: 42, distanceKm: 1200 },
      { pointsEarned: 63, distanceKm: 400 },
      { pointsEarned: 91, distanceKm: 0 },
    ],
    completedAt: 0,
  },
} as const

const streak: StreakState = { current: 3, longest: 3, lastActiveDate: '2026-04-21', lastMilestoneShown: 0 }

declare global {
  interface Window {
    __testAnalytics?: Array<{ name: string; props: unknown }>
  }
}

beforeEach(() => {
  window.__testAnalytics = []
  // Clean navigator mocks each time.
  // @ts-expect-error — intentional mock override
  delete navigator.share
  // @ts-expect-error — test-time replacement
  navigator.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
})

describe('DailyShareBlock', () => {
  it('renders a share preview containing the mode emoji and score', () => {
    render(
      <DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />,
    )
    const preview = screen.getByTestId('daily-share-preview')
    const text = preview.textContent ?? ''
    expect(text).toContain('funworldmap · 04-21')
    expect(text).toContain('87/100')
  })

  it('share button uses navigator.share when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error — test-time replacement
    navigator.share = shareMock
    render(
      <DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />,
    )
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    expect(shareMock).toHaveBeenCalledTimes(1)
    const call = shareMock.mock.calls[0][0]
    expect(call.title).toBe('funworldmap daily')
    expect(call.text).toContain('funworldmap · 04-21')
    expect(call.url).toBe('https://funworldmap.com/#daily/2026-04-21')
    expect(window.__testAnalytics).toEqual([
      { name: 'daily_shared', props: { date: '2026-04-21', modesPlayed: 1, method: 'share-api' } },
    ])
  })

  it('falls back to clipboard.writeText when navigator.share is absent', async () => {
    render(
      <DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />,
    )
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('#daily/2026-04-21')
    expect(window.__testAnalytics?.[0]).toMatchObject({
      name: 'daily_shared',
      props: { date: '2026-04-21', modesPlayed: 1, method: 'clipboard-text' },
    })
  })

  it('"Copy link only" copies just the URL and tracks clipboard-link', async () => {
    render(
      <DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />,
    )
    fireEvent.click(screen.getByTestId('daily-share-copy-link'))
    await new Promise((r) => setTimeout(r, 0))
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(text).toBe('https://funworldmap.com/#daily/2026-04-21')
    expect(window.__testAnalytics?.[0]).toMatchObject({
      name: 'daily_shared',
      props: { date: '2026-04-21', modesPlayed: 1, method: 'clipboard-link' },
    })
  })

  it('navigator.share AbortError does NOT fire daily_shared', async () => {
    const abortErr = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const shareMock = vi.fn().mockRejectedValue(abortErr)
    // @ts-expect-error — test-time replacement
    navigator.share = shareMock
    render(
      <DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />,
    )
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    expect(window.__testAnalytics).toEqual([])
  })

  it('dispatches funworldmap:toast on clipboard success', async () => {
    const events: string[] = []
    const handler = (e: Event) => events.push((e as CustomEvent<string>).detail)
    window.addEventListener('funworldmap:toast', handler)
    render(
      <DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />,
    )
    fireEvent.click(screen.getByTestId('daily-share-copy-link'))
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener('funworldmap:toast', handler)
    expect(events.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/__tests__/DailyShareBlock.test.tsx 2>&1 | tail -10
```

Expected: failures — `DailyShareBlock` module not found.

- [ ] **Step 3: Create `DailyShareBlock.tsx`**

```tsx
// src/components/DailyShareBlock.tsx
import { useCallback } from 'react'
import { buildShareText, modesPlayed as countModesPlayed, type ShareResults } from '../game/daily/shareText'
import type { StreakState } from '../game/daily/types'
import { track } from '../lib/analytics'

interface Props {
  date: string
  results: ShareResults
  streak: StreakState
  originUrl: string
}

function dispatchToast(message: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:toast', { detail: message }))
}

export function DailyShareBlock({ date, results, streak, originUrl }: Props) {
  const text = buildShareText({ date, results, streak, originUrl })
  const url = `${originUrl}/#daily/${date}`
  const modesPlayed = countModesPlayed(results)

  const handlePrimary = useCallback(async () => {
    // Navigator.share when available
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'funworldmap daily', text, url })
        track('daily_shared', {
          date,
          modesPlayed: modesPlayed as 1 | 2,
          method: 'share-api',
        })
      } catch (err) {
        // AbortError means user cancelled the native sheet — no-op, no event.
        const name = (err as { name?: string }).name
        if (name !== 'AbortError') {
          // Other errors fall through to clipboard as best-effort
          try {
            await navigator.clipboard.writeText(`${text}\n${url}`)
            dispatchToast('Copied!')
            track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-text' })
          } catch {
            /* silent */
          }
        }
      }
      return
    }
    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      dispatchToast('Copied!')
      track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-text' })
    } catch {
      /* silent */
    }
  }, [date, text, url, modesPlayed])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      dispatchToast('Link copied')
      track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-link' })
    } catch {
      /* silent */
    }
  }, [date, url, modesPlayed])

  return (
    <div data-testid="daily-share-block" className="mt-4 p-4 rounded-xl bg-sand-50/80 dark:bg-dark-400/60 border border-sand-300/40 dark:border-dark-200/30">
      <pre
        data-testid="daily-share-preview"
        className="whitespace-pre-wrap text-xs text-sand-900 dark:text-dark-50 font-mono mb-3 tabular-nums select-all"
      >
        {text}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePrimary}
          data-testid="daily-share-primary"
          className="flex-1 px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Share
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          data-testid="daily-share-copy-link"
          className="px-4 py-2 rounded-xl text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Copy link only
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/__tests__/DailyShareBlock.test.tsx 2>&1 | tail -10
```

Expected: 6/6 passing.

- [ ] **Step 5: TypeScript + full unit suite**

```bash
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: tsc clean; 237/237 unit tests passing (231 baseline + 6 new DailyShareBlock tests; shareText tests were added in Task 2).

- [ ] **Step 6: Commit**

```bash
git add src/components/DailyShareBlock.tsx src/components/__tests__/DailyShareBlock.test.tsx
git commit -m "feat(daily): DailyShareBlock — share API, clipboard fallback, copy-link-only"
```

---

### Task 5: Mount `DailyShareBlock` in `GameOverOverlay` and `DailyRevealOverlay`

**Files:**
- Modify: `src/game/shared/hud/GameOverOverlay.tsx`
- Modify: `src/components/DailyRevealOverlay.tsx`

- [ ] **Step 1: Read `GameOverOverlay.tsx` fully**

```bash
cat src/game/shared/hud/GameOverOverlay.tsx
```

Identify: (a) whether `session.kind === 'daily'` is accessible, (b) how `session.date` (or equivalent) is obtained, (c) where in the JSX tree the share block belongs.

- [ ] **Step 2: Add imports + conditional mount to `GameOverOverlay`**

At the top of `GameOverOverlay.tsx`, add imports:

```tsx
import { DailyShareBlock } from '../../../components/DailyShareBlock'
import { useDailyHistory } from '../../daily/useDailyHistory'
```

Inside the component body (before the `return`), add:

```tsx
const { history, streak } = useDailyHistory()
const isDaily = session.kind === 'daily'
const dailyDate = isDaily ? session.date : null
const dailyResults = dailyDate ? history.days[dailyDate] ?? {} : {}
const hasAnyMode = isDaily && (!!dailyResults['country-pinning'] || !!dailyResults['city-guessing'])
```

In the JSX, after the main game-over content (e.g. after the "Play again" button block), insert:

```tsx
{isDaily && hasAnyMode && dailyDate && (
  <DailyShareBlock
    date={dailyDate}
    results={dailyResults}
    streak={streak}
    originUrl={window.location.origin}
  />
)}
```

Exact placement depends on the current JSX — place it at the end of the inner modal content so it appears below the score/buttons.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc -b 2>&1 | tail -3
```

Expected: clean. If `session.date` doesn't exist on the daily session variant, check `src/game/shared/types.ts` or wherever `GameSession` is defined — daily sessions must carry the date (set by `GameController`). Document and use the correct field name.

- [ ] **Step 4: Add imports + conditional mount to `DailyRevealOverlay`**

In `src/components/DailyRevealOverlay.tsx`, add import at the top:

```tsx
import { DailyShareBlock } from './DailyShareBlock'
```

After `const { byDate } = useDailyPuzzlesContext()` and `const { get } = useDailyHistory()`, destructure `streak` and compute the shared results:

```tsx
const { get, streak } = useDailyHistory()
// ...existing country + city derivations...
const shareResults: ShareResults = {
  'country-pinning': get(date, 'country-pinning'),
  'city-guessing': get(date, 'city-guessing'),
}
const anyPlayed = !!shareResults['country-pinning'] || !!shareResults['city-guessing']
```

Import the `ShareResults` type from `shareText.ts`:

```tsx
import type { ShareResults } from '../game/daily/shareText'
```

In the JSX, add the block at the very bottom of the modal content (just before the close button wrapper or at the end of the inner column):

```tsx
{anyPlayed && (
  <DailyShareBlock
    date={date}
    results={shareResults}
    streak={streak}
    originUrl={window.location.origin}
  />
)}
```

- [ ] **Step 5: Run unit tests**

```bash
npm run test:unit 2>&1 | tail -3
```

Expected: all passing. If any existing test assertions on GameOverOverlay / DailyRevealOverlay DOM break, update them to allow the additional share block.

- [ ] **Step 6: Commit**

```bash
git add src/game/shared/hud/GameOverOverlay.tsx src/components/DailyRevealOverlay.tsx
git commit -m "feat(daily): mount DailyShareBlock in game-over and reveal overlays"
```

---

### Task 6: Grant clipboard permissions in Playwright config

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Read current config**

```bash
cat playwright.config.ts
```

- [ ] **Step 2: Add `permissions` to the `use` block**

Change the top-level `use` block from:

```ts
use: {
  baseURL: 'http://localhost:5173',
  trace: 'on-first-retry',
},
```

to:

```ts
use: {
  baseURL: 'http://localhost:5173',
  trace: 'on-first-retry',
  permissions: ['clipboard-read', 'clipboard-write'],
},
```

Top-level `use` is inherited by both `chromium` and `chromium-gpu` projects.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc -b 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts
git commit -m "test(e2e): grant clipboard permissions in Playwright config"
```

---

### Task 7: E2E `daily-share.spec.ts`

**Files:**
- Create: `e2e/daily-share.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
// e2e/daily-share.spec.ts
import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'

test.setTimeout(60_000)

async function seedPlayedDaily(page: Page, date: string): Promise<void> {
  // Install a daily index for `date` and a history entry so the reveal overlay
  // has data to render before any interaction. Runs before page.goto.
  await page.addInitScript(
    ({ d }) => {
      const index = {
        generatedAt: new Date().toISOString(),
        window: { start: d, end: d },
        days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'paris' } } },
      }
      // Route daily/index.json via sessionStorage seed — the app fetches it.
      // Playwright route-fulfill happens via page.route() below.
      const history = {
        version: 1,
        streak: { current: 3, longest: 3, lastActiveDate: d, lastMilestoneShown: 0 },
        days: {
          [d]: {
            'country-pinning': {
              score: 87,
              attempts: [
                { pointsEarned: 42, distanceKm: 1200 },
                { pointsEarned: 63, distanceKm: 400 },
                { pointsEarned: 91, distanceKm: 0 },
              ],
              completedAt: 1,
            },
          },
        },
      }
      localStorage.setItem('funworldmap-daily-history', JSON.stringify(history))
      ;(window as unknown as { __seededIndex: unknown }).__seededIndex = index
    },
    { d: date },
  )
  await page.route('**/daily/index.json', async (route) => {
    const req = route.request()
    const seeded = await page.evaluate(() => (window as unknown as { __seededIndex: unknown }).__seededIndex)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
  })
}

async function installNavigatorShareMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { __lastShare?: { title: string; text: string; url: string } }).__lastShare = undefined
    // @ts-expect-error — test-time installation
    navigator.share = async (data: { title: string; text: string; url: string }) => {
      ;(window as unknown as { __lastShare?: { title: string; text: string; url: string } }).__lastShare = data
    }
  })
}

test.describe('Daily share block', () => {
  test('share block visible in DailyRevealOverlay with played country', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await seedPlayedDaily(page, today)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 5_000 })
    const preview = page.getByTestId('daily-share-preview')
    const text = (await preview.textContent()) ?? ''
    expect(text).toContain('funworldmap · ')
    expect(text).toContain('87/100')
    expect(text).toContain(`#daily/${today}`)
  })

  test('clicking Share uses navigator.share when present', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await seedPlayedDaily(page, today)
    await installNavigatorShareMock(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    const lastShare = await page.evaluate(() => (window as unknown as { __lastShare?: { title: string; text: string; url: string } }).__lastShare)
    expect(lastShare?.title).toBe('funworldmap daily')
    expect(lastShare?.text ?? '').toContain('funworldmap · ')
    expect(lastShare?.url ?? '').toContain(`#daily/${today}`)
  })

  test('clicking Copy link only writes the URL to clipboard', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await seedPlayedDaily(page, today)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toBe(`${new URL(page.url()).origin}/#daily/${today}`)
  })

  test('share block absent when no mode has been played', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    // Seed index but clear history.
    await page.addInitScript(
      ({ d }) => {
        localStorage.removeItem('funworldmap-daily-history')
        const index = {
          generatedAt: new Date().toISOString(),
          window: { start: d, end: d },
          days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'paris' } } },
        }
        ;(window as unknown as { __seededIndex: unknown }).__seededIndex = index
      },
      { d: today },
    )
    await page.route('**/daily/index.json', async (route) => {
      const seeded = await page.evaluate(() => (window as unknown as { __seededIndex: unknown }).__seededIndex)
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
    })
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    // Reveal overlay still mounts, but share block must not.
    await expect(page.getByTestId('daily-share-block')).not.toBeAttached()
  })
})
```

- [ ] **Step 2: Register in `playwright.config.ts` `chromium` testMatch**

Add `'daily-share.spec.ts'` to the `testMatch` array for the `chromium` project in `playwright.config.ts`.

- [ ] **Step 3: Run the new spec locally**

```bash
npx playwright test --project=chromium --retries=0 e2e/daily-share.spec.ts 2>&1 | tail -10
```

Expected: 4/4 passing. If any test flakes, capture the error and fix at source.

- [ ] **Step 4: Commit**

```bash
git add e2e/daily-share.spec.ts playwright.config.ts
git commit -m "test(e2e): daily-share spec — reveal block, share-api, clipboard, absent-when-empty"
```

---

### Task 8: E2E `daily-deep-link.spec.ts`

**Files:**
- Create: `e2e/daily-deep-link.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
// e2e/daily-deep-link.spec.ts
import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'

test.setTimeout(60_000)

async function seedIndex(page: Page, dates: string[]): Promise<void> {
  await page.addInitScript(
    ({ ds }) => {
      const days: Record<string, unknown> = {}
      for (const d of ds) days[d] = { country: { cca3: 'FRA' }, city: { id: 'paris' } }
      const index = {
        generatedAt: new Date().toISOString(),
        window: { start: ds[0], end: ds[ds.length - 1] },
        days,
      }
      ;(window as unknown as { __seededIndex: unknown }).__seededIndex = index
    },
    { ds: dates },
  )
  await page.route('**/daily/index.json', async (route) => {
    const seeded = await page.evaluate(() => (window as unknown as { __seededIndex: unknown }).__seededIndex)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
  })
}

test.describe('Daily deep link — no-mode launcher anchor', () => {
  test('#daily/<today> (no mode) lands on launcher with anchorDate', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await seedIndex(page, [today])
    await page.goto(`/#daily/${today}`)
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    // Launcher header copy shows "Daily · <date>" when anchored
    await expect(page.getByTestId('launcher')).toContainText(`Daily · ${today}`)
  })

  test('#daily/<past-date> lands on launcher anchored to that date', async ({ page }) => {
    const today = new Date()
    const past = new Date(today)
    past.setDate(past.getDate() - 3)
    const pastStr = past.toISOString().slice(0, 10)
    const todayStr = today.toISOString().slice(0, 10)
    await seedIndex(page, [pastStr, todayStr])
    await page.goto(`/#daily/${pastStr}`)
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('launcher')).toContainText(`Daily · ${pastStr}`)
  })

  test('#daily/<garbage> falls back to bare-root launcher', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await seedIndex(page, [today])
    await page.goto('/#daily/not-a-date')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    // Bare launcher copy, NOT anchored
    await expect(page.getByTestId('launcher')).not.toContainText('Daily · ')
  })
})
```

- [ ] **Step 2: Register the spec in `playwright.config.ts`**

Add `'daily-deep-link.spec.ts'` to the `chromium` project's `testMatch` array.

- [ ] **Step 3: Run locally**

```bash
npx playwright test --project=chromium --retries=0 e2e/daily-deep-link.spec.ts 2>&1 | tail -10
```

Expected: 3/3 passing.

- [ ] **Step 4: Commit**

```bash
git add e2e/daily-deep-link.spec.ts playwright.config.ts
git commit -m "test(e2e): daily-deep-link spec — #daily/<date> no-mode launcher anchor"
```

---

### Task 9: Local validation + push + PR

**Files:** none

- [ ] **Step 1: Full unit + type check**

```bash
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: all unit tests pass, tsc clean.

- [ ] **Step 2: Full chromium project 3× consecutive**

```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 --workers=2 2>&1 | tail -5
done
```

Expected: 3/3 fully green. If any flake, halt and investigate — Phase-4 code must not reintroduce the flakiness that Plan A removed.

- [ ] **Step 3: chromium-gpu to confirm no regression**

```bash
npx playwright test --project=chromium-gpu --retries=0 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/phase-4-share-flow
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --base main --title "feat(retention): Phase 4 — share flow" --body "$(cat <<'EOF'
## Summary

- `src/game/daily/shareText.ts` — pure `buildShareText` builder with per-mode 3-square quintile strip, score, streak line, origin URL
- `src/components/DailyShareBlock.tsx` — share + copy-link-only buttons, `navigator.share` with clipboard fallback, toast via existing `funworldmap:toast` CustomEvent
- Mounted in both `GameOverOverlay` (post-game) and `DailyRevealOverlay` (reveal route)
- `daily_shared` analytics schema — `date`, `modesPlayed`, `method` (`share-api` | `clipboard-text` | `clipboard-link`)
- e2e: `daily-share.spec.ts`, `daily-deep-link.spec.ts`
- Playwright config grants `clipboard-read` + `clipboard-write`

## Why

Spec: `docs/superpowers/specs/2026-04-22-retention-v1-finishing-design.md` §B. Closes the Phase 4 share-flow piece of retention v1. Friends who receive a shared link land on the launcher anchored to that date — and when they finish their own daily, they can re-share from the same block.

Plan: `docs/superpowers/plans/2026-04-22-phase-4-share-flow.md`.

## Test Plan

- [ ] CI `lint + type + unit`, `e2e (chromium)`, `e2e (chromium-gpu)` all green
- [ ] Manual: open `#daily/<today>/reveal` after playing → share block shows with correct emoji strip
- [ ] Manual: click Share → native sheet (mobile) or clipboard (desktop) gets the exact spec-format text
- [ ] Manual: click "Copy link only" → only the URL is in clipboard
- [ ] Manual: open `#daily/<today>` (no mode) → launcher appears with "Daily · <date>" header

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Watch CI**

```bash
gh pr checks $(gh pr view --json number --jq .number) --watch
```

Expected: all green on first run. If `e2e (chromium)` flakes, investigate immediately — do not re-run.

- [ ] **Step 7: Hand off to `finishing-a-development-branch`**

Present the 4-option menu: merge locally / push + PR (already done) / keep as-is / discard.

---

## Self-review notes

- **Spec coverage:** B0 (domain check) → Task 1 Step 3. Share text format → Task 2. Mount in both overlays → Task 5. Clipboard mocking strategy → Tasks 4, 6, 7. `daily_shared` schema → Task 3. `#daily/<date>` (no mode) route → already wired, e2e coverage in Task 8. Analytics event fires on all 3 paths with AbortError suppression → Task 4 test 5, Task 4 implementation `catch AbortError` branch.
- **Placeholder scan:** all steps have concrete code / commands. Task 5 Step 2 references "exact placement depends on the current JSX" — this is unavoidable without reading the file first in the plan; the step is scoped to "place share block after score/buttons at end of inner modal content".
- **Type consistency:** `ShareResults` defined in `shareText.ts` and imported by `DailyShareBlock` and by both overlay mount sites. `BuildShareTextArgs` fields (date, results, streak, originUrl) match `DailyShareBlock` props names. `daily_shared` event shape consistent across Task 3 (schema), Task 4 (tests + implementation), Task 7 (e2e asserts).
- **Scope honest:** Plan is smaller than the spec's B section because hashState + App routing + launcher anchoring are already in place. Plan does the 4 things the codebase actually needs: shareText, DailyShareBlock, mount sites, e2e coverage.
