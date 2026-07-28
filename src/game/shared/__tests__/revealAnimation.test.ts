import { describe, it, expect } from 'vitest'
import {
  computeRevealAnimationPlan,
  revealFillOpacityAt,
  REVEAL_FILL_PEAK,
  REVEAL_FILL_TROUGH,
  REVEAL_FILL_SETTLED,
  REVEAL_FILL_PULSE_MS,
} from '../revealAnimation'
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
    expect(plan!.durationMs).toBeGreaterThanOrEqual(1500)
    expect(plan!.durationMs).toBeLessThanOrEqual(3000)
  })

  it('short distance clamps to 1500 ms minimum', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 100,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan!.durationMs).toBe(1500)
  })

  it('long distance clamps to 3000 ms maximum', () => {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 15000,
    }
    const plan = computeRevealAnimationPlan(reveal, byCca3, false)
    expect(plan!.durationMs).toBe(3000)
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

describe('revealFillOpacityAt', () => {
  // Waveform: two cosine beats (peak at 0 and PULSE/2, troughs at PULSE/4 and
  // 3·PULSE/4) blended linearly toward the settled value so the pulse decays
  // and lands exactly on REVEAL_FILL_SETTLED with no snap.
  it('starts at the 0.35 peak', () => {
    expect(revealFillOpacityAt(0)).toBeCloseTo(REVEAL_FILL_PEAK, 10)
  })

  it('dips to the first-beat trough at a quarter of the pulse', () => {
    // wave = 0.12, blend t = 0.25 → 0.12 + (0.15 − 0.12) · 0.25 = 0.1275
    expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 0.25)).toBeCloseTo(0.1275, 4)
  })

  it('rebounds into a decayed second beat at the halfway point', () => {
    // wave = 0.35, blend t = 0.5 → 0.35 + (0.15 − 0.35) · 0.5 = 0.25
    const secondPeak = revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 0.5)
    expect(secondPeak).toBeCloseTo(0.25, 4)
    expect(secondPeak).toBeLessThan(REVEAL_FILL_PEAK)
    expect(secondPeak).toBeGreaterThan(REVEAL_FILL_SETTLED)
  })

  it('dips to the second-beat trough at three quarters', () => {
    // wave = 0.12, blend t = 0.75 → 0.12 + (0.15 − 0.12) · 0.75 = 0.1425
    expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 0.75)).toBeCloseTo(0.1425, 4)
  })

  it('settles at exactly 0.15 from the pulse end onward', () => {
    expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS)).toBe(REVEAL_FILL_SETTLED)
    expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 5)).toBe(REVEAL_FILL_SETTLED)
  })

  it('stays within [trough, peak] for the whole pulse', () => {
    for (let ms = 0; ms <= REVEAL_FILL_PULSE_MS; ms += 10) {
      const v = revealFillOpacityAt(ms)
      expect(v).toBeLessThanOrEqual(REVEAL_FILL_PEAK)
      expect(v).toBeGreaterThanOrEqual(REVEAL_FILL_TROUGH)
    }
  })

  it('clamps negative elapsed to the starting peak', () => {
    expect(revealFillOpacityAt(-50)).toBeCloseTo(REVEAL_FILL_PEAK, 10)
  })
})
