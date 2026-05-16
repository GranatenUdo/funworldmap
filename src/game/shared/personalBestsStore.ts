import type { ModeId } from './types'
import type { PersonalBest } from './types'

const ZERO: PersonalBest = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

function v2Key(modeId: string): string {
  return `funworldmap-game-${modeId}-bests-v2`
}

function v1Key(modeId: string): string {
  return `funworldmap-game-${modeId}-bests`
}

function readSafely(modeId: string): PersonalBest {
  // One-time cleanup of v1 (polluted by daily plays). Idempotent.
  try {
    localStorage.removeItem(v1Key(modeId))
  } catch {
    /* no-op */
  }
  try {
    const raw = localStorage.getItem(v2Key(modeId))
    if (!raw) return ZERO
    const parsed = JSON.parse(raw) as Partial<PersonalBest> | null
    return {
      bestScore: Number(parsed?.bestScore) || 0,
      bestStreak: Number(parsed?.bestStreak) || 0,
      gamesPlayed: Number(parsed?.gamesPlayed) || 0,
    }
  } catch {
    return ZERO
  }
}

function writeSafely(modeId: string, value: PersonalBest): void {
  try {
    localStorage.setItem(v2Key(modeId), JSON.stringify(value))
  } catch {
    /* private-mode / quota — best effort */
  }
}

const snapshots = new Map<ModeId, PersonalBest>()
const listenersByMode = new Map<ModeId, Set<() => void>>()

function ensureLoaded(modeId: ModeId): PersonalBest {
  let cur = snapshots.get(modeId)
  if (cur) return cur
  cur = readSafely(modeId)
  snapshots.set(modeId, cur)
  return cur
}

export function getSnapshot(modeId: ModeId): PersonalBest {
  return ensureLoaded(modeId)
}

export function subscribe(modeId: ModeId, listener: () => void): () => void {
  let set = listenersByMode.get(modeId)
  if (!set) {
    set = new Set()
    listenersByMode.set(modeId, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

export function record(modeId: ModeId, score: number, streak: number): PersonalBest {
  const prev = ensureLoaded(modeId)
  const next: PersonalBest = {
    bestScore: Math.max(prev.bestScore, score),
    bestStreak: Math.max(prev.bestStreak, streak),
    gamesPlayed: prev.gamesPlayed + 1,
  }
  snapshots.set(modeId, next)
  writeSafely(modeId, next)
  const set = listenersByMode.get(modeId)
  if (set) for (const l of [...set]) l()
  return next
}

/** Test seam — clear all cached snapshots and listeners. */
export function __resetForTests(): void {
  snapshots.clear()
  listenersByMode.clear()
}
