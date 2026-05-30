import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

export interface LauncherVisibility {
  visible: boolean
  dismiss: () => void
  show: () => void
}

type IntentState = { kind: 'default' } | { kind: 'open' } | { kind: 'dismissed' }

export function useLauncherVisibility(): LauncherVisibility {
  const { session } = useGameSessionContext()
  const [intent, setIntent] = useState<IntentState>({ kind: 'default' })
  const prevSessionStatusRef = useRef(session.status)

  // Reset to default on non-idle → idle transitions (game end).
  // Map-first: do NOT set intent to 'open' here — the launcher stays hidden
  // until the user explicitly clicks the header-play button after a game ends.
  useEffect(() => {
    const prev = prevSessionStatusRef.current
    if (prev !== 'idle' && session.status === 'idle') {
      setIntent({ kind: 'default' })
    }
    prevSessionStatusRef.current = session.status
  }, [session.status])

  const dismiss = useCallback(() => {
    setIntent((prev) => (prev.kind === 'dismissed' ? prev : { kind: 'dismissed' }))
  }, [])

  const show = useCallback(() => {
    setIntent((prev) => (prev.kind === 'open' ? prev : { kind: 'open' }))
  }, [])

  const visible = intent.kind === 'open' && session.status === 'idle'

  return { visible, dismiss, show }
}
