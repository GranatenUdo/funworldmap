import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

function isDailyRoot(hash: string): boolean {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  return /^daily\/\d{4}-\d{2}-\d{2}$/.test(clean)
}

export interface LauncherVisibility {
  visible: boolean
  anchorDate: string | null
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

  const visible = isDailyRoot(currentHash) && !dismissed && session.status === 'idle'

  let anchorDate: string | null = null
  if (isDailyRoot(currentHash)) {
    const clean = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash
    anchorDate = clean.slice('daily/'.length)
  }

  return { visible, anchorDate, dismiss, show }
}
