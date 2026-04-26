import { useCallback, useMemo, useState } from 'react'
import type { ModeId } from '../shared/types'
import type { DailyHistoryV1, DailyDayResult, Milestone, StreakState } from './types'
import {
  readHistory,
  writeHistory,
  mergeDay,
  updateStreak,
  pruneOlderThan,
  pendingMilestone as derivePendingMilestone,
  withMilestoneShown,
} from './storage'
import { clearResume } from './resume'

export interface UseDailyHistory {
  history: DailyHistoryV1
  streak: StreakState
  pendingMilestone: Milestone | null
  get(date: string, modeId: ModeId): DailyDayResult | null
  record(date: string, modeId: ModeId, result: DailyDayResult): void
  markMilestoneShown(): void
}

export function useDailyHistory(): UseDailyHistory {
  const [history, setHistory] = useState<DailyHistoryV1>(() => {
    const raw = readHistory()
    const pruned = pruneOlderThan(raw, 90)
    if (pruned !== raw) writeHistory(pruned)
    return pruned
  })

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
      clearResume()
    },
    [],
  )

  const pendingMilestone = useMemo(() => derivePendingMilestone(history), [history])

  const markMilestoneShown = useCallback(() => {
    setHistory((prev) => {
      const m = derivePendingMilestone(prev)
      if (!m) return prev
      const next = withMilestoneShown(prev, m)
      writeHistory(next)
      return next
    })
  }, [])

  return { history, streak: history.streak, pendingMilestone, get, record, markMilestoneShown }
}
