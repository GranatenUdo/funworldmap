import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyIndex, DailyPuzzleRef } from './types'

export type DailyPuzzlesStatus = 'loading' | 'ready' | 'unavailable'

export interface UseDailyPuzzles {
  status: DailyPuzzlesStatus
  index: DailyIndex | null
  byDate: (date: string) => DailyPuzzleRef | null
  refetch: () => Promise<void>
}

export function useDailyPuzzles(): UseDailyPuzzles {
  const [status, setStatus] = useState<DailyPuzzlesStatus>('loading')
  const [index, setIndex] = useState<DailyIndex | null>(null)
  const cancelRef = useRef<{ cancelled: boolean } | null>(null)

  const doFetch = useCallback(async (): Promise<void> => {
    // Cancel any in-flight fetch so its setState doesn't race with a fresh one.
    if (cancelRef.current) cancelRef.current.cancelled = true
    const token = { cancelled: false }
    cancelRef.current = token
    setStatus('loading')
    try {
      const r = await fetch('/daily/index.json', { cache: 'default' })
      if (!r.ok) throw new Error(`http ${r.status}`)
      const json = (await r.json()) as DailyIndex
      if (token.cancelled) return
      setIndex(json)
      setStatus('ready')
    } catch {
      if (token.cancelled) return
      setStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    void doFetch()
    return () => {
      if (cancelRef.current) cancelRef.current.cancelled = true
    }
  }, [doFetch])

  const byDate = useCallback(
    (date: string): DailyPuzzleRef | null => {
      if (!index) return null
      if (date < index.window.start || date > index.window.end) return null
      return index.days[date] ?? null
    },
    [index],
  )

  return { status, index, byDate, refetch: doFetch }
}
