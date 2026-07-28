import { useEffect, useRef, useState } from 'react'

const EXPLORE_HINT_KEY = 'funworldmap-hint-explore-shown'
const GAME_HINT_KEY = 'funworldmap-hint-game-shown'
const COMPARE_HINT_KEY = 'funworldmap-hint-compare-shown'

export type OnboardingHint = 'explore' | 'game' | 'compare'

// localStorage, not sessionStorage: each hint shows once per browser, ever —
// the old per-tab gate re-nagged returning users in every new tab (A12).
// A storage failure (blocked cookies) counts as "shown": a hint that cannot
// persist its gate would otherwise re-nag on every load.
function wasShown(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return true
  }
}

function markShown(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* private-mode / quota — best effort */
  }
}

/** Hint pill copy. Coarse pointers get tap wording without the `/` clause (A14).
 *  The game and compare copy name no input modality, so they are deliberately
 *  pointer-independent — no capability gating needed (C5). */
export function hintCopy(hint: OnboardingHint, finePointer: boolean): string {
  if (hint === 'game') return 'Try a game — guess countries and cities'
  if (hint === 'compare') return 'Tip: compare two countries side by side'
  return finePointer
    ? 'Click a country to explore — or press / to search'
    : 'Tap a country to explore'
}

/**
 * Drives the three one-time onboarding hints (each gated by localStorage —
 * once per browser, ever):
 * - 'explore': 1.5s after the map is ready, while nothing is selected and no
 *   game is active.
 * - 'game': immediately after the user closes their first country panel.
 *   Starting a game marks it moot without showing it.
 * - 'compare' (C5): on the user's second DISTINCT country selection of the
 *   session (in-memory count — a "session" is one page lifetime), only while
 *   a country panel is open, never during games, and only on desktop where
 *   the labeled Compare pill exists (D4 owns the mobile chip and revisits
 *   the gate — the localStorage gate is deliberately NOT burned on mobile).
 *   Entering compare before the tip ever showed marks it moot.
 *
 * Visibility contract per kind: explore/game live only while nothing is
 * selected; compare lives only while a panel is open. Games and entering
 * compare dismiss everything.
 *
 * Precedence (so 'game' and 'compare' never race): their firing conditions
 * are disjoint (game fires on the selected → deselected edge; compare fires
 * while a selection exists), and on the one render where both the game-hint
 * DISMISSAL and the compare SET can queue state (second distinct selection
 * while the game hint is visible), the dismissal effect is defined before
 * the compare effect, so setHint('compare') is queued last and wins the
 * commit. The reverse handoff (compare tip visible, panel closes, game hint
 * not yet shown) resolves the same way: dismissal queues null, then the
 * game effect (defined last) queues 'game' — sequential handoff, never a race.
 */
export function useFirstVisitHint({
  mapReady,
  selectedCca3,
  gameActive,
  compareActive,
  isDesktop,
}: {
  mapReady: boolean
  selectedCca3: string | null
  gameActive: boolean
  compareActive: boolean
  isDesktop: boolean
}): { hint: OnboardingHint | null } {
  const [hint, setHint] = useState<OnboardingHint | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const hasSelection = selectedCca3 !== null
  const prevSelectionRef = useRef(hasSelection)
  // In-memory on purpose: the distinct-selection count resets on reload
  // (the localStorage gate still caps the tip at once per browser, ever).
  const distinctSelectionsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!mapReady || hasSelection || dismissed || gameActive || hint !== null) return
    if (wasShown(EXPLORE_HINT_KEY)) return
    const timer = setTimeout(() => {
      setHint('explore')
      markShown(EXPLORE_HINT_KEY)
    }, 1500)
    return () => clearTimeout(timer)
  }, [mapReady, hasSelection, dismissed, gameActive, hint])

  // Dismissal — MUST stay defined before the compare effect (see the
  // precedence note in the hook docstring).
  useEffect(() => {
    if (!hint) return
    const outlivedItsState = hint === 'compare' ? !hasSelection || compareActive : hasSelection
    if (gameActive || outlivedItsState) {
      setHint(null)
      setDismissed(true)
    }
  }, [hasSelection, gameActive, compareActive, hint])

  // Compare tip (C5). hasSelection is true on the render that adds the
  // second cca3, so the tip only ever fires while a panel is open.
  useEffect(() => {
    if (gameActive || selectedCca3 === null) return
    distinctSelectionsRef.current.add(selectedCca3)
    if (compareActive) {
      // The user already found compare on their own — never nag them.
      markShown(COMPARE_HINT_KEY)
      return
    }
    if (!isDesktop) return
    if (distinctSelectionsRef.current.size < 2) return
    if (wasShown(COMPARE_HINT_KEY)) return
    setHint('compare')
    markShown(COMPARE_HINT_KEY)
  }, [selectedCca3, gameActive, compareActive, isDesktop])

  // Game hint: fires on the selected → deselected transition (a panel close).
  // Any game session marks it moot instead — including App's automatic
  // deselect when round 0 starts, where gameActive is already true on the
  // same render, so a game start can never masquerade as a panel close.
  useEffect(() => {
    const wasSelected = prevSelectionRef.current
    prevSelectionRef.current = hasSelection
    if (gameActive) {
      markShown(GAME_HINT_KEY)
      return
    }
    if (!wasSelected || hasSelection) return
    if (wasShown(GAME_HINT_KEY)) return
    setHint('game')
    markShown(GAME_HINT_KEY)
  }, [hasSelection, gameActive])

  return { hint }
}
