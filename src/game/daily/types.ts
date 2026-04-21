import type { ModeId } from '../shared/types'

export interface DailyPuzzleRef {
  country: { cca3: string }
  city: { id: string }
}

export interface DailyIndex {
  generatedAt: string
  window: { start: string; end: string }
  days: Record<string, DailyPuzzleRef>
}

export interface AttemptRecord {
  pointsEarned: number
  guessCca3?: string
  guessLngLat?: [number, number]
  distanceKm: number | null
}

export interface DailyDayResult {
  score: number
  attempts: AttemptRecord[]
  completedAt: number
}

export interface StreakState {
  current: number
  longest: number
  lastActiveDate: string | null
  lastMilestoneShown: 0 | 3 | 7 | 14 | 30 | 100
}

export interface DailyHistoryV1 {
  version: 1
  streak: StreakState
  days: Record<string, Partial<Record<ModeId, DailyDayResult | null>>>
}

export const MILESTONES = [3, 7, 14, 30, 100] as const
export type Milestone = (typeof MILESTONES)[number]

export const STORAGE_KEY = 'funworldmap-daily-history'
