import { useCallback, useState } from 'react'
import type { ModeId } from '../shared/types'
import type { DailyHistoryV1, DailyDayResult, StreakState } from './types'
import { readHistory, writeHistory, mergeDay, updateStreak } from './storage'

export interface UseDailyHistory {
  history: DailyHistoryV1
  streak: StreakState
  get(date: string, modeId: ModeId): DailyDayResult | null
  record(date: string, modeId: ModeId, result: DailyDayResult): void
}

export function useDailyHistory(): UseDailyHistory {
  const [history, setHistory] = useState<DailyHistoryV1>(() => readHistory())

  const get = useCallback(
    (date: string, modeId: ModeId): DailyDayResult | null =>
      history.days[date]?.[modeId] ?? null,
    [history],
  )

  const record = useCallback(
    (date: string, modeId: ModeId, result: DailyDayResult) => {
      setHistory((prev) => {
        const merged = mergeDay(prev, date, modeId, result)
        const streaked = updateStreak(merged, date)
        writeHistory(streaked)
        return streaked
      })
    },
    [],
  )

  return { history, streak: history.streak, get, record }
}
