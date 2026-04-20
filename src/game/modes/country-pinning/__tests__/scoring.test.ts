import { describe, it, expect } from 'vitest'
import { scoreGuess, EXACT_POINTS, DECAY_KM } from '../scoring'
import type { CountryRoundSpec } from '../../../shared/types'

const paris: [number, number] = [2.3522, 48.8566]
const round: CountryRoundSpec = {
  kind: 'country-pinning',
  targetCca3: 'FRA',
  targetName: 'France',
  targetFlag: 'flags/FR.svg',
  targetCentroid: paris,
}

describe('scoreGuess', () => {
  it('exact country click awards EXACT_POINTS and no life lost', () => {
    const out = scoreGuess(round, { kind: 'country', cca3: 'FRA', name: 'France', centroid: paris }, paris)
    expect(out.pointsEarned).toBe(EXACT_POINTS)
    expect(out.livesDelta).toBe(0)
    expect(out.reveal.kind).toBe('country')
    if (out.reveal.kind === 'country') {
      expect(out.reveal.correct).toBe(true)
      expect(out.reveal.distanceKm).toBe(0)
    }
  })

  it('wrong country ~500 km away scores ~85 and costs a life', () => {
    const brussels: [number, number] = [4.3517, 50.8503]
    const out = scoreGuess(round, { kind: 'country', cca3: 'BEL', name: 'Belgium', centroid: brussels }, brussels)
    expect(out.pointsEarned).toBeGreaterThan(80)
    expect(out.pointsEarned).toBeLessThan(100)
    expect(out.livesDelta).toBe(-1)
  })

  it('wrong country at decay distance scores ~37', () => {
    const farEast: [number, number] = [41, 48.8566]
    const out = scoreGuess(round, { kind: 'country', cca3: 'KAZ', name: 'Kazakhstan', centroid: farEast }, farEast)
    expect(out.pointsEarned).toBeGreaterThanOrEqual(30)
    expect(out.pointsEarned).toBeLessThanOrEqual(45)
  })

  it('antipodal wrong click scores 0', () => {
    const antipode: [number, number] = [-177.6478, -48.8566]
    const out = scoreGuess(round, { kind: 'country', cca3: 'NZL', name: 'New Zealand', centroid: antipode }, antipode)
    expect(out.pointsEarned).toBeLessThanOrEqual(1)
  })

  it('point input (from city mode leakage) is a defensive no-op', () => {
    const out = scoreGuess(round, { kind: 'point', lngLat: paris }, null)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('skip input is a defensive no-op (country mode has no skip)', () => {
    const out = scoreGuess(round, { kind: 'skip' }, null)
    expect(out.pointsEarned).toBe(0)
    expect(out.livesDelta).toBe(0)
  })

  it('DECAY_KM constant is 3000', () => {
    expect(DECAY_KM).toBe(3000)
  })

  it('populates reveal.clickedName from GuessInput', () => {
    const brussels: [number, number] = [4.3517, 50.8503]
    const out = scoreGuess(
      round,
      { kind: 'country', cca3: 'BEL', name: 'Belgium', centroid: brussels },
      brussels,
    )
    expect(out.reveal.kind).toBe('country')
    if (out.reveal.kind === 'country') {
      expect(out.reveal.clickedName).toBe('Belgium')
      expect(out.reveal.clickedCca3).toBe('BEL')
    }
  })

  it('clickedName is null when input is skip or point', () => {
    const p: [number, number] = [0, 0]
    const skip = scoreGuess(round, { kind: 'skip' }, null)
    const point = scoreGuess(round, { kind: 'point', lngLat: p }, null)
    if (skip.reveal.kind === 'country') expect(skip.reveal.clickedName).toBeNull()
    if (point.reveal.kind === 'country') expect(point.reveal.clickedName).toBeNull()
  })

  it('clickedName is populated even for the correct (exact) case', () => {
    const out = scoreGuess(
      round,
      { kind: 'country', cca3: 'FRA', name: 'France', centroid: paris },
      paris,
    )
    if (out.reveal.kind === 'country') {
      expect(out.reveal.correct).toBe(true)
      expect(out.reveal.clickedName).toBe('France')
    }
  })
})
