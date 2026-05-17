import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

function isDailyRoot(hash: string): boolean {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  return /^daily\/\d{4}-\d{2}-\d{2}$/.test(clean)
}

export interface LauncherVisibility {
  visible: boolean
  anchorDate: string | null
  initialHistoryOpen: boolean
  dismiss: () => void
  show: (opts?: { historyOpen?: boolean }) => void
}

type IntentState =
  | { kind: 'default' }
  | { kind: 'open'; historyOpen: boolean }
  | { kind: 'dismissed' }

export function useLauncherVisibility(): LauncherVisibility {
  const { session } = useGameSessionContext()
  const initialHash = typeof window !== 'undefined' ? window.location.hash : ''
  const [currentHash, setCurrentHash] = useState(initialHash)
  const [intent, setIntent] = useState<IntentState>({ kind: 'default' })
  const prevSessionStatusRef = useRef(session.status)

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  const show = useCallback((opts?: { historyOpen?: boolean }) => {
    const wantHistoryOpen = !!opts?.historyOpen
    setIntent((prev) => {
      if (prev.kind === 'open' && prev.historyOpen === wantHistoryOpen) return prev
      return { kind: 'open', historyOpen: wantHistoryOpen }
    })
  }, [])

  const visible =
    (intent.kind === 'open' || (isDailyRoot(currentHash) && intent.kind !== 'dismissed')) &&
    session.status === 'idle'

  const initialHistoryOpen = intent.kind === 'open' ? intent.historyOpen : false

  let anchorDate: string | null = null
  if (isDailyRoot(currentHash)) {
    const clean = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash
    anchorDate = clean.slice('daily/'.length)
  }

  return { visible, anchorDate, initialHistoryOpen, dismiss, show }
}
