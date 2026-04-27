import { useCallback, useSyncExternalStore } from 'react'
import type { PersonalBest, ModeId } from './types'
import { subscribe, getSnapshot, record as storeRecord } from './personalBestsStore'

export function usePersonalBests(modeId: ModeId): {
  best: PersonalBest
  record: (score: number, streak: number) => PersonalBest
} {
  const subscribeForMode = useCallback(
    (listener: () => void) => subscribe(modeId, listener),
    [modeId],
  )
  const getSnapshotForMode = useCallback(() => getSnapshot(modeId), [modeId])

  const best = useSyncExternalStore(subscribeForMode, getSnapshotForMode, getSnapshotForMode)

  const record = useCallback(
    (score: number, streak: number): PersonalBest => storeRecord(modeId, score, streak),
    [modeId],
  )

  return { best, record }
}
