import { describe, it, expect } from 'vitest'
import { computeRevealAnimationPlan } from '../revealAnimation'
import type { CountryLike, CountryReveal, PointReveal } from '../types'

const FRA: CountryLike = {
  cca3: 'FRA',
  name: { common: 'France' },
  flag: '',
  latlng: [46, 2],
  independent: true,
}
const DEU: CountryLike = {
  cca3: 'DEU',
  name: { common: 'Germany' },
  flag: '',
  latlng: [51, 10],
  independent: true,
}
const byCca3 = new Map<string, CountryLike>([
  ['FRA', FRA],
  ['DEU', DEU],
])

describe('computeRevealAnimationPlan', () => {
  it('returns null for a correct country guess', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: true,
      targetCca3: 'FRA',
      clickedCca3: 'FRA',
      clickedName: 'France',
      distanceKm: 0,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })

  it('returns null when a wrong country guess has null clickedCca3', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: null,
      clickedName: null,
      distanceKm: null,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })

  it('returns from, to, and durationMs for a wrong country guess', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 775,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan).not.toBeNull()
    expect(plan!.from).toEqual([10, 51])
    expect(plan!.to).toEqual([2, 46])
    expect(plan!.durationMs).toBeGreaterThanOrEqual(400)
    expect(plan!.durationMs).toBeLessThanOrEqual(1200)
  })

  it('short distance clamps to 400 ms minimum', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 100,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan!.durationMs).toBe(400)
  })

  it('long distance clamps to 1200 ms maximum', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 15000,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan!.durationMs).toBe(1200)
  })

  it('reducedMotion=true forces durationMs=0', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 5000,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, true)
    expect(plan!.durationMs).toBe(0)
  })

  it('returns null when target or clicked country is not in byCca3', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'ZZZ',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 500,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })

  it('handles a point reveal with clickedPoint present', () => {
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: [2.3522, 48.8566],
      clickedPoint: [13.405, 52.52],
      distanceKm: 878,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan).not.toBeNull()
    expect(plan!.from).toEqual([13.405, 52.52])
    expect(plan!.to).toEqual([2.3522, 48.8566])
  })

  it('returns null for a point reveal with no clickedPoint (skip)', () => {
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: [2.3522, 48.8566],
      clickedPoint: null,
      distanceKm: 0,
    }
    expect(computeRevealAnimationPlan(reveal, byCca3, false)).toBeNull()
  })
})
