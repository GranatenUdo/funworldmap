import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonalBest } from './types'

const ZERO: PersonalBest = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

function keyFor(modeId: string): string {
  return `funworldmap-game-${modeId}-bests-v2`
}

function legacyKeyFor(modeId: string): string {
  return `funworldmap-game-${modeId}-bests`
}

function readSafely(modeId: string): PersonalBest {
  // One-time cleanup of v1 (polluted by daily plays). Idempotent.
  try { localStorage.removeItem(legacyKeyFor(modeId)) } catch { /* no-op */ }
  try {
    const raw = localStorage.getItem(keyFor(modeId))
    if (!raw) return ZERO
    const parsed = JSON.parse(raw)
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
    localStorage.setItem(keyFor(modeId), JSON.stringify(value))
  } catch {
    /* quota or private-mode; in-memory only */
  }
}

export function usePersonalBests(modeId: string): {
  best: PersonalBest
  record: (score: number, streak: number) => PersonalBest
} {
  const [best, setBest] = useState<PersonalBest>(() => readSafely(modeId))
  const bestRef = useRef(best)
  bestRef.current = best

  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === keyFor(modeId)) setBest(readSafely(modeId))
    }
    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [modeId])

  const record = useCallback(
    (score: number, streak: number): PersonalBest => {
      const prev = bestRef.current
      const next: PersonalBest = {
        bestScore: Math.max(prev.bestScore, score),
        bestStreak: Math.max(prev.bestStreak, streak),
        gamesPlayed: prev.gamesPlayed + 1,
      }
      setBest(next)
      writeSafely(modeId, next)
      return next
    },
    [modeId],
  )

  return { best, record }
}
