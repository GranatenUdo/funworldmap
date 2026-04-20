import { describe, it, expect } from 'vitest'
import { scoreCityGuess, DECAY_KM, MAX_DISTANCE_KM } from '../scoring'
import type { CityRoundSpec } from '../../../shared/types'

const paris: [number, number] = [2.3522, 48.8566]
const round: CityRoundSpec = {
  kind: 'city-guessing',
  targetId: 'FRA-paris',
  targetName: 'Paris',
  targetCountryName: 'France',
  targetCountryFlag: 'flags/FR.svg',
  targetCentroid: paris,
}

describe('scoreCityGuess', () => {
  it('exact click returns full score', () => {
    const out = scoreCityGuess({ kind: 'point', lngLat: paris }, round)
    expect(out.pointsEarned).toBe(100)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.kind).toBe('point')
    if (out.reveal.kind === 'point') {
      expect(out.reveal.distanceKm).toBeLessThan(0.01)
    }
  })

  it('~500 km off scores ~37', () => {
    // A point ~500 km south-east of Paris
    const near: [number, number] = [5.0, 45.0]
    const out = scoreCityGuess({ kind: 'point', lngLat: near }, round)
    expect(out.pointsEarned).toBeGreaterThanOrEqual(32)
    expect(out.pointsEarned).toBeLessThanOrEqual(45)
  })

  it('antipodal click scores ~0', () => {
    const antipode: [number, number] = [-177.6478, -48.8566]
    const out = scoreCityGuess({ kind: 'point', lngLat: antipode }, round)
    expect(out.pointsEarned).toBeLessThanOrEqual(1)
  })

  it('skip input returns zero with max distance', () => {
    const out = scoreCityGuess({ kind: 'skip' }, round)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.kind).toBe('point')
    if (out.reveal.kind === 'point') {
      expect(out.reveal.clickedPoint).toBeNull()
      expect(out.reveal.distanceKm).toBe(MAX_DISTANCE_KM)
    }
  })

  it('country input (defensive leakage) returns zero', () => {
    const out = scoreCityGuess({ kind: 'country', cca3: 'FRA', name: 'France', centroid: paris }, round)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('DECAY_KM constant is 500', () => {
    expect(DECAY_KM).toBe(500)
  })
})
