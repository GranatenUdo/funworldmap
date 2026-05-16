import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ModeId } from '../shared/types'
import type { DailyHistoryV1, DailyDayResult, Milestone, StreakState } from './types'
import {
  mergeDay,
  updateStreak,
  pendingMilestone as derivePendingMilestone,
  withMilestoneShown,
} from './storage'
import { subscribe, getSnapshot, setHistory } from './historyStore'

export interface UseDailyHistory {
  history: DailyHistoryV1
  streak: StreakState
  pendingMilestone: Milestone | null
  get: (date: string, modeId: ModeId) => DailyDayResult | null
  record: (date: string, modeId: ModeId, result: DailyDayResult) => void
  markMilestoneShown: () => void
}

export function useDailyHistory(): UseDailyHistory {
  const history = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Read via getSnapshot() directly so the callback identity stays stable
  // across store updates — consumers passing `get` as a dep don't churn.
  const get = useCallback(
    (date: string, modeId: ModeId): DailyDayResult | null =>
      getSnapshot().days[date]?.[modeId] ?? null,
    [],
  )

  const record = useCallback((date: string, modeId: ModeId, result: DailyDayResult) => {
    setHistory((prev) => {
      const merged = mergeDay(prev, date, modeId, result)
      return updateStreak(merged, date)
    })
  }, [])

  const pendingMilestone = useMemo(() => derivePendingMilestone(history), [history])

  const markMilestoneShown = useCallback(() => {
    setHistory((prev) => {
      const m = derivePendingMilestone(prev)
      if (!m) return prev
      return withMilestoneShown(prev, m)
    })
  }, [])

  return { history, streak: history.streak, pendingMilestone, get, record, markMilestoneShown }
}
