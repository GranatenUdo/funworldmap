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
