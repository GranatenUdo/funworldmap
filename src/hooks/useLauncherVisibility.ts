import { useCallback, useEffect, useState } from 'react'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

export function useLauncherVisibility() {
  const { session } = useGameSessionContext()
  const [visible, setVisible] = useState(() => !window.location.hash)
  const dismiss = useCallback(() => setVisible(false), [])
  const show = useCallback(() => setVisible(true), [])
  useEffect(() => {
    const routeChanged = () => {
      if (window.location.hash) setVisible(false)
    }
    window.addEventListener('hashchange', routeChanged)
    return () => window.removeEventListener('hashchange', routeChanged)
  }, [])
  return { visible: visible && session.status === 'idle', dismiss, show }
}
