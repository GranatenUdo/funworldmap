import { useEffect, useRef, useState } from 'react'

const EXPLORE_HINT_KEY = 'funworldmap-hint-explore-shown'
const GAME_HINT_KEY = 'funworldmap-hint-game-shown'

export type OnboardingHint = 'explore' | 'game'

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

/** Hint pill copy. Coarse pointers get tap wording without the `/` clause (A14). */
export function hintCopy(hint: OnboardingHint, finePointer: boolean): string {
  if (hint === 'game') return 'Try a game — guess countries and cities'
  return finePointer
    ? 'Click a country to explore — or press / to search'
    : 'Tap a country to explore'
}

/**
 * Drives the two one-time onboarding hints (each gated by localStorage —
 * once per browser, ever):
 * - 'explore': 1.5s after the map is ready, while nothing is selected and no
 *   game is active.
 * - 'game': immediately after the user closes their first country panel.
 *   Starting a game marks it moot without showing it.
 * Whichever hint is visible dismisses as soon as the user selects a country
 * or starts a game.
 */
export function useFirstVisitHint({
  mapReady,
  hasSelection,
  gameActive,
}: {
  mapReady: boolean
  hasSelection: boolean
  gameActive: boolean
}): { hint: OnboardingHint | null } {
  const [hint, setHint] = useState<OnboardingHint | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const prevSelectionRef = useRef(hasSelection)

  useEffect(() => {
    if (!mapReady || hasSelection || dismissed || gameActive || hint !== null) return
    if (wasShown(EXPLORE_HINT_KEY)) return
    const timer = setTimeout(() => {
      setHint('explore')
      markShown(EXPLORE_HINT_KEY)
    }, 1500)
    return () => clearTimeout(timer)
  }, [mapReady, hasSelection, dismissed, gameActive, hint])

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

  useEffect(() => {
    if ((hasSelection || gameActive) && hint) {
      setHint(null)
      setDismissed(true)
    }
  }, [hasSelection, gameActive, hint])

  return { hint }
}
