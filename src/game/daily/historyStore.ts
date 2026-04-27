import type { DailyHistoryV1 } from './types'
import { readHistory, writeHistory, pruneOlderThan } from './storage'

type Listener = () => void

let snapshot: DailyHistoryV1 = hydrate()
const listeners = new Set<Listener>()

function hydrate(): DailyHistoryV1 {
  const raw = readHistory()
  const pruned = pruneOlderThan(raw, 90)
  if (pruned !== raw) writeHistory(pruned)
  return pruned
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getSnapshot(): DailyHistoryV1 {
  return snapshot
}

export function setHistory(updater: (prev: DailyHistoryV1) => DailyHistoryV1): void {
  const next = updater(snapshot)
  if (next === snapshot) return
  snapshot = next
  writeHistory(next)
  // Snapshot of listeners so a subscriber that unsubscribes during dispatch
  // doesn't perturb iteration.
  for (const l of [...listeners]) l()
}

/** Test seam — re-hydrate from localStorage and clear listeners. */
export function __resetForTests(): void {
  snapshot = hydrate()
  listeners.clear()
}
