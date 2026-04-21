import { useCallback, useEffect, useState } from 'react'
import type { DailyIndex, DailyPuzzleRef } from './types'

export type DailyPuzzlesStatus = 'loading' | 'ready' | 'unavailable'

export interface UseDailyPuzzles {
  status: DailyPuzzlesStatus
  index: DailyIndex | null
  byDate(date: string): DailyPuzzleRef | null
}

export function useDailyPuzzles(): UseDailyPuzzles {
  const [status, setStatus] = useState<DailyPuzzlesStatus>('loading')
  const [index, setIndex] = useState<DailyIndex | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/daily/index.json', { cache: 'default' })
      .then((r) => {
        if (!r.ok) throw new Error(`http ${r.status}`)
        return r.json() as Promise<DailyIndex>
      })
      .then((json) => {
        if (cancelled) return
        setIndex(json)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('unavailable')
      })
    return () => { cancelled = true }
  }, [])

  const byDate = useCallback(
    (date: string): DailyPuzzleRef | null => {
      if (!index) return null
      if (date < index.window.start || date > index.window.end) return null
      return index.days[date] ?? null
    },
    [index],
  )

  return { status, index, byDate }
}
