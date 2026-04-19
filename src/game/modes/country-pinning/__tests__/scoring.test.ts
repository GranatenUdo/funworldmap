import { describe, it, expect } from 'vitest'
import { scoreGuess, EXACT_POINTS, DECAY_KM } from '../scoring'
import type { RoundSpec } from '../../../shared/types'

const paris: [number, number] = [2.3522, 48.8566]
const round: RoundSpec = {
  targetCca3: 'FRA',
  targetName: 'France',
  targetFlag: 'flags/FR.svg',
  targetCentroid: paris,
}

describe('scoreGuess', () => {
  it('exact click awards EXACT_POINTS and no life lost', () => {
    const out = scoreGuess(round, 'FRA', paris)
    expect(out.correct).toBe(true)
    expect(out.pointsEarned).toBe(EXACT_POINTS)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.distanceKm).toBe(0)
  })

  it('wrong country ~500 km away scores ~85 and costs a life', () => {
    const brussels: [number, number] = [4.3517, 50.8503]
    const out = scoreGuess(round, 'BEL', brussels)
    expect(out.correct).toBe(false)
    expect(out.pointsEarned).toBeGreaterThan(80)
    expect(out.pointsEarned).toBeLessThan(100)
    expect(out.livesDelta).toBe(-1)
  })

  it('wrong country at decay distance scores ~37', () => {
    const farEast: [number, number] = [41, 48.8566]
    const out = scoreGuess(round, 'KAZ', farEast)
    expect(out.pointsEarned).toBeGreaterThanOrEqual(30)
    expect(out.pointsEarned).toBeLessThanOrEqual(45)
  })

  it('antipodal wrong click scores 0', () => {
    const antipode: [number, number] = [-177.6478, -48.8566]
    const out = scoreGuess(round, 'NZL', antipode)
    expect(out.pointsEarned).toBeLessThanOrEqual(1)
  })

  it('null click is a no-op', () => {
    const out = scoreGuess(round, null, null)
    expect(out.correct).toBe(false)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('DECAY_KM constant is 3000', () => {
    expect(DECAY_KM).toBe(3000)
  })
})
