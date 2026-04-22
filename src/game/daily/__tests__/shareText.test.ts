import { describe, it, expect } from 'vitest'
import { buildShareText } from '../shareText'
import type { DailyDayResult, StreakState } from '../types'

const pinningResult: DailyDayResult = {
  score: 87,
  attempts: [
    { pointsEarned: 42, distanceKm: 1200 },
    { pointsEarned: 63, distanceKm: 400 },
    { pointsEarned: 91, distanceKm: 0, guessCca3: 'FRA' },
  ],
  completedAt: 1_700_000_000_000,
}

const cityResult: DailyDayResult = {
  score: 81,
  attempts: [
    { pointsEarned: 34, distanceKm: 1500 },
    { pointsEarned: 78, distanceKm: 200 },
    { pointsEarned: 95, distanceKm: 10 },
  ],
  completedAt: 1_700_000_000_000,
}

const streak7: StreakState = { current: 7, longest: 7, lastActiveDate: '2026-04-21', lastMilestoneShown: 3 }
const streak0: StreakState = { current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0 }
const streak1: StreakState = { current: 1, longest: 1, lastActiveDate: '2026-04-21', lastMilestoneShown: 0 }

const origin = 'https://funworldmap.com'

describe('buildShareText', () => {
  it('both modes played, 7-day streak — full format', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult, 'city-guessing': cityResult },
      streak: streak7,
      originUrl: origin,
    })
    expect(text).toMatchInlineSnapshot(`
      "funworldmap · 04-21
      🌍 Country 🟥🟧🟩  87/100
      🏙️ City    🟥🟨🟩  81/100
      🔥 7-day streak
      https://funworldmap.com/#daily/2026-04-21"
    `)
  })

  it('one mode played (country only) — city shows not-played line', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult },
      streak: streak1,
      originUrl: origin,
    })
    expect(text).toMatchInlineSnapshot(`
      "funworldmap · 04-21
      🌍 Country 🟥🟧🟩  87/100
      🏙️ City    ⬜⬜⬜  not played
      🔥 1-day streak
      https://funworldmap.com/#daily/2026-04-21"
    `)
  })

  it('streak === 0 omits streak line entirely', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult, 'city-guessing': cityResult },
      streak: streak0,
      originUrl: origin,
    })
    expect(text).not.toContain('streak')
    expect(text).toMatchInlineSnapshot(`
      "funworldmap · 04-21
      🌍 Country 🟥🟧🟩  87/100
      🏙️ City    🟥🟨🟩  81/100
      https://funworldmap.com/#daily/2026-04-21"
    `)
  })

  it('all five quintile buckets render the expected emoji', () => {
    const mkAttempt = (pointsEarned: number) => ({ pointsEarned, distanceKm: 0 })
    const result: DailyDayResult = {
      score: 100,
      attempts: [mkAttempt(0), mkAttempt(45), mkAttempt(80)],
      completedAt: 0,
    }
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': result },
      streak: streak0,
      originUrl: origin,
    })
    // 0 -> ⬛ (0-29), 45 -> 🟥 (30-49), 80 -> 🟨 (70-89)
    expect(text).toContain('⬛🟥🟨')
  })

  it('quintile edge values (29, 30, 49)', () => {
    const mk = (p: number) => ({ pointsEarned: p, distanceKm: 0 })
    const edges: DailyDayResult = {
      score: 0,
      attempts: [mk(29), mk(30), mk(49)],
      completedAt: 0,
    }
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': edges },
      streak: streak0,
      originUrl: origin,
    })
    // 29 -> ⬛, 30 -> 🟥, 49 -> 🟥
    expect(text).toContain('⬛🟥🟥')
  })

  it('incomplete attempts (2 of 3) pad with ⬛', () => {
    const partial: DailyDayResult = {
      score: 85,
      attempts: [
        { pointsEarned: 60, distanceKm: 100 },
        { pointsEarned: 85, distanceKm: 10 },
      ],
      completedAt: 0,
    }
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': partial },
      streak: streak0,
      originUrl: origin,
    })
    // 60 -> 🟧 (50-69), 85 -> 🟨 (70-89), missing -> ⬛
    expect(text).toContain('🟧🟨⬛')
  })

  it('date formats MM-DD', () => {
    const text = buildShareText({
      date: '2026-12-03',
      results: { 'country-pinning': pinningResult },
      streak: streak0,
      originUrl: origin,
    })
    expect(text).toContain('funworldmap · 12-03')
  })

  it('origin without trailing slash concatenates correctly', () => {
    const text = buildShareText({
      date: '2026-04-21',
      results: { 'country-pinning': pinningResult },
      streak: streak0,
      originUrl: 'https://example.com',
    })
    expect(text).toContain('https://example.com/#daily/2026-04-21')
  })
})
