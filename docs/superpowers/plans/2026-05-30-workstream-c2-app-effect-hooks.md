# Workstream C2 — Extract App effects into named hooks · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the ~550-LOC `AppInner` by extracting three self-contained effect clusters into named, unit-tested hooks — `useMapReady`, `useFirstVisitHint`, `useLiveAnnouncements` — with no observable behavior change.

**Architecture:** Each hook owns the state/refs/effects of one concern, exposes a minimal interface, and is unit-tested in isolation. `AppInner` calls the three hooks instead of inlining the logic. The extractions are behavior-preserving: the effects only depend on truthiness (`!!selected`, `gameActive`) and the selected country's name, not object identity, so passing booleans/strings is equivalent to the original object deps. The existing e2e suite (a11y, tutorial-first-click, panel-focus, keyboard-map-nav) is the regression net.

**Tech Stack:** React 19 hooks, Vitest + `@testing-library/react` (`renderHook`, fake timers, jsdom `MutationObserver`).

**Spec:** [`docs/superpowers/specs/2026-05-30-flagship-continuation-roadmap-design.md`](../specs/2026-05-30-flagship-continuation-roadmap-design.md) (Workstream C2)

---

## Scope out (NOT in this plan)

- The global `keydown` handler effect (`App.tsx` ~327-378) and the focus-return effect (~266-288) — the most coupled to `AppInner` state; left in place to keep this low-risk.
- Any behavior change. Pure refactor: same DOM, same timings, same announcements.
- Workstreams D (release), E (dependabot).

## File Structure

| File                                                       | Responsibility                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Create `src/hooks/useMapReady.ts`                          | Boolean: has the map signalled first load/error (`data-map-loaded`/`data-map-error`) |
| Create `src/hooks/__tests__/useMapReady.test.tsx`          | Unit test                                                                            |
| Create `src/hooks/useFirstVisitHint.ts`                    | First-visit "click a country" hint state machine                                     |
| Create `src/hooks/__tests__/useFirstVisitHint.test.tsx`    | Unit test                                                                            |
| Create `src/hooks/useLiveAnnouncements.ts`                 | aria-live region: selection + ad-hoc announcements; returns the ref                  |
| Create `src/hooks/__tests__/useLiveAnnouncements.test.tsx` | Unit test                                                                            |
| Modify `src/App.tsx`                                       | Replace the inlined state/refs/effects with the three hook calls                     |

## Pre-flight

- [ ] **Confirm branch + clean tree + green baseline.**

Run: `git branch --show-current && git status --porcelain && npm run lint 2>&1 | tail -1`
Expected: `docs/flagship-continuation-roadmap`, clean tree, lint 0 problems.

---

## Task 1: Extract `useMapReady`

**Files:** Create `src/hooks/useMapReady.ts` + test; modify `src/App.tsx`.

- [ ] **Step 1: Write the failing test.**

Create `src/hooks/__tests__/useMapReady.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMapReady } from '../useMapReady'

describe('useMapReady', () => {
  afterEach(() => {
    document.body
      .querySelectorAll('[data-map-loaded], [data-map-error]')
      .forEach((el) => el.remove())
  })

  it('starts false and flips true once a [data-map-loaded] element appears', async () => {
    const { result } = renderHook(() => useMapReady())
    expect(result.current).toBe(false)
    await act(async () => {
      const el = document.createElement('div')
      el.setAttribute('data-map-loaded', 'true')
      document.body.appendChild(el)
      // let the MutationObserver microtask flush
      await Promise.resolve()
    })
    expect(result.current).toBe(true)
  })

  it('is true immediately if the marker already exists at mount', () => {
    const el = document.createElement('div')
    el.setAttribute('data-map-error', 'true')
    document.body.appendChild(el)
    const { result } = renderHook(() => useMapReady())
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run it — expect failure (module not found).**

Run: `npx vitest run src/hooks/__tests__/useMapReady.test.tsx`
Expected: FAIL — cannot resolve `../useMapReady`.

- [ ] **Step 3: Write the hook.**

Create `src/hooks/useMapReady.ts`:

```ts
import { useEffect, useState } from 'react'

/**
 * True once the map has signalled it finished its first load (or errored), via
 * the `data-map-loaded` / `data-map-error` attribute WorldMap sets. Watches the
 * document for that attribute and disconnects once seen. Extracted from App.tsx.
 */
export function useMapReady(): boolean {
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    const check = () => document.querySelector('[data-map-loaded], [data-map-error]')
    const observer = new MutationObserver(() => {
      if (check()) {
        setMapReady(true)
        observer.disconnect()
      }
    })
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-map-loaded', 'data-map-error'],
    })
    if (check()) {
      setMapReady(true)
      observer.disconnect()
    }
    return () => observer.disconnect()
  }, [])
  return mapReady
}
```

- [ ] **Step 4: Run the test — expect pass.**

Run: `npx vitest run src/hooks/__tests__/useMapReady.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Use it in `App.tsx`.**

In `src/App.tsx`: add `import { useMapReady } from './hooks/useMapReady'` with the other hook imports. Replace the declaration `const [mapReady, setMapReady] = useState(false)` (around line 107) with `const mapReady = useMapReady()`. Delete the entire MutationObserver `useEffect` (around lines 290-308). Confirm `setMapReady` has no other references (`grep -n setMapReady src/App.tsx` → none).

- [ ] **Step 6: Verify + commit.**

Run: `npm run lint && tsc -b && npm run test:unit 2>&1 | tail -3`
Expected: lint 0; tsc 0; vitest all pass (489 now — +2).

```bash
git add src/hooks/useMapReady.ts src/hooks/__tests__/useMapReady.test.tsx src/App.tsx
git commit -m "refactor(app): extract useMapReady hook"
```

---

## Task 2: Extract `useFirstVisitHint`

**Files:** Create `src/hooks/useFirstVisitHint.ts` + test; modify `src/App.tsx`.

- [ ] **Step 1: Write the failing test.**

Create `src/hooks/__tests__/useFirstVisitHint.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFirstVisitHint } from '../useFirstVisitHint'

const args = (
  o: Partial<{ mapReady: boolean; hasSelection: boolean; gameActive: boolean }> = {},
) => ({
  mapReady: true,
  hasSelection: false,
  gameActive: false,
  ...o,
})

describe('useFirstVisitHint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the hint 1.5s after map-ready when idle, once per session', () => {
    const { result } = renderHook(() => useFirstVisitHint(args()))
    expect(result.current.showHint).toBe(false)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.showHint).toBe(true)
    expect(sessionStorage.getItem('funworldmap-hint-shown')).toBe('1')
  })

  it('does not show if the map is not ready', () => {
    const { result } = renderHook(() => useFirstVisitHint(args({ mapReady: false })))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.showHint).toBe(false)
  })

  it('does not show if a hint was already shown this session', () => {
    sessionStorage.setItem('funworldmap-hint-shown', '1')
    const { result } = renderHook(() => useFirstVisitHint(args()))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.showHint).toBe(false)
  })

  it('dismisses (and suppresses) once a selection or game starts', () => {
    const { result, rerender } = renderHook((p) => useFirstVisitHint(p), { initialProps: args() })
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.showHint).toBe(true)
    rerender(args({ hasSelection: true }))
    expect(result.current.showHint).toBe(false)
    // stays dismissed even back at idle
    rerender(args({ hasSelection: false }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.showHint).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — expect failure.**

Run: `npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx`
Expected: FAIL — cannot resolve `../useFirstVisitHint`.

- [ ] **Step 3: Write the hook.**

Create `src/hooks/useFirstVisitHint.ts`:

```ts
import { useEffect, useState } from 'react'

const HINT_SHOWN_KEY = 'funworldmap-hint-shown'

/**
 * Drives the first-visit "click a country to explore" hint: shows it once per
 * session, 1.5s after the map is ready, but only while nothing is selected and
 * no game is active; dismisses (and suppresses for the session) as soon as the
 * user selects a country or starts a game. Extracted from App.tsx.
 */
export function useFirstVisitHint({
  mapReady,
  hasSelection,
  gameActive,
}: {
  mapReady: boolean
  hasSelection: boolean
  gameActive: boolean
}): { showHint: boolean } {
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)

  useEffect(() => {
    if (!mapReady || hasSelection || hintDismissed || gameActive) return
    if (sessionStorage.getItem(HINT_SHOWN_KEY)) return
    const timer = setTimeout(() => {
      setShowHint(true)
      sessionStorage.setItem(HINT_SHOWN_KEY, '1')
    }, 1500)
    return () => clearTimeout(timer)
  }, [mapReady, hasSelection, hintDismissed, gameActive])

  useEffect(() => {
    if ((hasSelection || gameActive) && showHint) {
      setShowHint(false)
      setHintDismissed(true)
    }
  }, [hasSelection, gameActive, showHint])

  return { showHint }
}
```

- [ ] **Step 4: Run the test — expect pass.**

Run: `npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Use it in `App.tsx`.**

Add `import { useFirstVisitHint } from './hooks/useFirstVisitHint'`. Replace the two declarations `const [showHint, setShowHint] = useState(false)` and `const [hintDismissed, setHintDismissed] = useState(false)` (around lines 108-109) with `const { showHint } = useFirstVisitHint({ mapReady, hasSelection: !!selected, gameActive })`. Delete both hint `useEffect`s (around lines 310-325). Confirm `setShowHint`/`setHintDismissed`/`hintDismissed` have no other references in `App.tsx`. The JSX hint guard `{showHint && !selected && !gameActive && (…)}` stays unchanged.

- [ ] **Step 6: Verify + commit.**

Run: `npm run lint && tsc -b && npm run test:unit 2>&1 | tail -3`
Expected: lint 0; tsc 0; vitest all pass (493 now — +4).

```bash
git add src/hooks/useFirstVisitHint.ts src/hooks/__tests__/useFirstVisitHint.test.tsx src/App.tsx
git commit -m "refactor(app): extract useFirstVisitHint hook"
```

---

## Task 3: Extract `useLiveAnnouncements`

**Files:** Create `src/hooks/useLiveAnnouncements.ts` + test; modify `src/App.tsx`.

- [ ] **Step 1: Write the failing test.**

Create `src/hooks/__tests__/useLiveAnnouncements.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveAnnouncements } from '../useLiveAnnouncements'

function Harness({ name }: { name: string | null }) {
  const ref = useLiveAnnouncements(name)
  return <div ref={ref} data-testid="live" />
}

describe('useLiveAnnouncements', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('announces selection and panel-close transitions', () => {
    const { getByTestId, rerender } = render(<Harness name={null} />)
    const live = getByTestId('live')
    rerender(<Harness name="France" />)
    expect(live.textContent).toBe('France selected')
    rerender(<Harness name={null} />)
    expect(live.textContent).toBe('Country panel closed')
  })

  it('mirrors a funworldmap:announce event and clears it after 8s', () => {
    const { getByTestId } = render(<Harness name={null} />)
    const live = getByTestId('live')
    window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: 'Round 2 of 3' }))
    expect(live.textContent).toBe('Round 2 of 3')
    vi.advanceTimersByTime(8000)
    expect(live.textContent).toBe('')
  })
})
```

- [ ] **Step 2: Run it — expect failure.**

Run: `npx vitest run src/hooks/__tests__/useLiveAnnouncements.test.tsx`
Expected: FAIL — cannot resolve `../useLiveAnnouncements`.

- [ ] **Step 3: Write the hook.**

Create `src/hooks/useLiveAnnouncements.ts`:

```ts
import { useEffect, useRef, type RefObject } from 'react'

/**
 * Owns the visually-hidden aria-live region. Announces country selection
 * changes (driven by `selectedName`) and ad-hoc messages dispatched as
 * `funworldmap:announce` CustomEvents (auto-cleared after 8s). Returns the ref
 * to attach to the live-region element. Extracted from App.tsx.
 */
export function useLiveAnnouncements(
  selectedName: string | null,
): RefObject<HTMLDivElement | null> {
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const clearTimerRef = useRef<number | null>(null)
  const prevSelectedRef = useRef<string | null>(null)

  useEffect(() => {
    const name = selectedName
    const prevName = prevSelectedRef.current
    if (liveRegionRef.current) {
      if (name && name !== prevName) liveRegionRef.current.textContent = `${name} selected`
      else if (!name && prevName) liveRegionRef.current.textContent = 'Country panel closed'
    }
    prevSelectedRef.current = name
  }, [selectedName])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (!liveRegionRef.current || !detail) return
      liveRegionRef.current.textContent = detail
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = window.setTimeout(() => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = ''
      }, 8000)
    }
    window.addEventListener('funworldmap:announce', handler)
    return () => {
      window.removeEventListener('funworldmap:announce', handler)
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
    }
  }, [])

  return liveRegionRef
}
```

- [ ] **Step 4: Run the test — expect pass.**

Run: `npx vitest run src/hooks/__tests__/useLiveAnnouncements.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Use it in `App.tsx`.**

Add `import { useLiveAnnouncements } from './hooks/useLiveAnnouncements'`. Delete the three ref declarations `liveRegionRef`, `clearTimerRef`, `prevSelectedRef` (around lines 104-106) and the two announce `useEffect`s (around lines 239-247 and 249-264). In their place add (near the other hook calls): `const liveRegionRef = useLiveAnnouncements(selected?.name.common ?? null)`. The JSX `<div ref={liveRegionRef} data-testid="announce-region" …>` stays unchanged. Confirm `clearTimerRef` / `prevSelectedRef` have no other references in `App.tsx`.

- [ ] **Step 6: Verify + commit.**

Run: `npm run lint && tsc -b && npm run test:unit 2>&1 | tail -3`
Expected: lint 0; tsc 0; vitest all pass (495 now — +2).

```bash
git add src/hooks/useLiveAnnouncements.ts src/hooks/__tests__/useLiveAnnouncements.test.tsx src/App.tsx
git commit -m "refactor(app): extract useLiveAnnouncements hook"
```

---

## Task 4: Behavior-preservation verification (e2e)

**Files:** none.

- [ ] **Step 1: Free port 5173** (the reuseExistingServer trap).

Run: `npx --yes kill-port 5173 2>/dev/null || true`

- [ ] **Step 2: Run the e2e specs that exercise the extracted behaviors.**

Run: `npx playwright test --project=chromium tutorial-first-click.spec.ts accessibility.spec.ts a11y-keyboard-smoke.spec.ts panel-focus.spec.ts keyboard-map-nav.spec.ts`
Expected: all pass. These cover the first-visit hint (`tutorial-first-click`), the aria-live announcements (`accessibility`, `a11y-keyboard-smoke`), focus management around selection (`panel-focus`), and keyboard nav — i.e. every behavior the three hooks touch. If anything fails, read the trace; do not re-run blindly.

- [ ] **Step 3: Confirm `AppInner` shrank.**

Run: `awk '/^function AppInner/,0' src/App.tsx | grep -c useEffect`
Expected: 3 fewer `useEffect`s than before (the mapReady, two announce, and two hint effects are gone; the hashchange, game-start-deselect, focus-return, and keyboard effects remain).

---

## Acceptance (workstream C2)

- Three new hooks under `src/hooks/`, each with passing unit tests; `npm run test:unit` green (+8 tests).
- `npm run lint` 0 problems; `tsc -b` clean.
- The five e2e specs in Task 4 green — no behavior change to the hint, announcements, focus, or keyboard paths.
- `AppInner` no longer inlines the mapReady / hint / announcement state, refs, and effects.

---

## Self-review notes (author)

- **Spec coverage:** C2 requires extracting 2-3 self-contained effects → Tasks 1-3 extract three (`useMapReady`, `useFirstVisitHint`, `useLiveAnnouncements`); the keyboard + focus-return effects are explicitly scoped out as too coupled.
- **Behavior-preservation argument:** the original effects' deps were the `selected` object, but the logic only reads `!!selected` (truthiness) and `selected.name.common` (a string unique per country). Passing `hasSelection`/`selectedName` is therefore equivalent; e2e (Task 4) is the empirical net.
- **No placeholders:** every hook and test is complete code.
- **Type consistency:** `useMapReady(): boolean`; `useFirstVisitHint({mapReady,hasSelection,gameActive}): {showHint}`; `useLiveAnnouncements(selectedName): RefObject<HTMLDivElement|null>` — call sites in Task N steps match these signatures.
