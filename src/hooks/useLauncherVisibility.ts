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
