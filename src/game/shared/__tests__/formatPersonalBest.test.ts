import { describe, it, expect } from 'vitest'
import { formatPersonalBest } from '../formatPersonalBest'
import type { PersonalBest } from '../types'

const best = (bestScore: number, bestStreak: number): PersonalBest => ({
  bestScore,
  bestStreak,
  gamesPlayed: 1,
})

describe('formatPersonalBest', () => {
  it('groups the score with locale separators', () => {
    expect(formatPersonalBest(best(1240, 0), 'city-guessing')).toBe('1,240 pts')
  })

  it('appends the streak for country-pinning when > 0', () => {
    expect(formatPersonalBest(best(1240, 31), 'country-pinning')).toBe('1,240 pts · 31 streak')
  })

  it('omits the streak for country-pinning when 0', () => {
    expect(formatPersonalBest(best(500, 0), 'country-pinning')).toBe('500 pts')
  })

  it('never shows a streak for city-guessing', () => {
    expect(formatPersonalBest(best(8500, 4), 'city-guessing')).toBe('8,500 pts')
  })
})
