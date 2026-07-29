import { describe, expect, it } from 'vitest'
import {
  AREA_RANKS,
  POPULATION_RANKS,
  RANK_TOTAL,
  denseRanksDesc,
  formatCompact,
  formatCompactArea,
  formatCompactDensity,
  formatRank,
} from '../countryStats'
import { makeCountryData } from '../../test/countryFixtures'

describe('world ranks — dense 1..195 over the canonical set', () => {
  it('covers exactly the 195 canonical countries (non-canonical entries filtered out)', () => {
    expect(RANK_TOTAL).toBe(195)
    expect(POPULATION_RANKS.size).toBe(195)
    expect(AREA_RANKS.size).toBe(195)
    expect(AREA_RANKS.has('TWN')).toBe(false)
  })

  it('area ranks match the countryLabelFeatures anchors: RUS 1, VAT 195, FRA mid-table', () => {
    expect(AREA_RANKS.get('RUS')).toBe(1)
    expect(AREA_RANKS.get('VAT')).toBe(195)
    // 543,908 km² ranks France 48th in the current data. Range-asserted
    // (the countryLabelFeatures.test.ts precedent) so an upstream area
    // revision doesn't churn this test.
    expect(AREA_RANKS.get('FRA')).toBeGreaterThanOrEqual(40)
    expect(AREA_RANKS.get('FRA')).toBeLessThanOrEqual(60)
    const ranks = [...AREA_RANKS.values()]
    expect(new Set(ranks).size).toBe(195)
    expect(Math.min(...ranks)).toBe(1)
    expect(Math.max(...ranks)).toBe(195)
  })

  it('population ranks: rank 1 is India or China (data-vintage dependent), VAT 195, FRA mid-20s', () => {
    const rank1 = [...POPULATION_RANKS.entries()].find(([, r]) => r === 1)![0]
    expect(['IND', 'CHN']).toContain(rank1)
    expect(POPULATION_RANKS.get('VAT')).toBe(195)
    // France is 22nd in the current data — range-asserted.
    expect(POPULATION_RANKS.get('FRA')).toBeGreaterThanOrEqual(15)
    expect(POPULATION_RANKS.get('FRA')).toBeLessThanOrEqual(30)
  })

  it('rank ties break deterministically by cca3 (the countryLabelFeatures rule, now shared)', () => {
    const ranks = denseRanksDesc(
      [
        { cca3: 'DEU', v: 100 },
        { cca3: 'AUT', v: 100 },
      ],
      (c) => c.v,
    )
    expect(ranks.get('AUT')).toBe(1)
    expect(ranks.get('DEU')).toBe(2)
  })
})

describe('compact numerals — en-US compact notation, 3 significant digits', () => {
  it('applies K/M/B suffixes with 3 significant digits', () => {
    expect(formatCompact(1_402_112_000)).toBe('1.4B')
    expect(formatCompact(66_351_959)).toBe('66.4M') // France population, real data
    expect(formatCompact(543_908)).toBe('544K') // France area, real data
    expect(formatCompact(999_999)).toBe('1M') // rounds up across the suffix boundary
    expect(formatCompact(451)).toBe('451') // sub-1000 stays plain
    expect(formatCompact(0.44)).toBe('0.44') // Vatican area
  })

  it('formatCompactArea appends the km² unit', () => {
    expect(formatCompactArea(543_908)).toBe('544K km²')
    expect(formatCompactArea(17_098_242)).toBe('17.1M km²') // Russia
  })

  it('formatCompactDensity derives via compareFields.densityOf (imported, not duplicated)', () => {
    expect(formatCompactDensity(makeCountryData({ population: 66_351_959, area: 543_908 }))).toBe(
      '122/km²',
    )
    expect(formatCompactDensity(makeCountryData({ population: 39_244, area: 2.02 }))).toBe(
      '19.4K/km²',
    )
    expect(formatCompactDensity(makeCountryData({ population: 0 }))).toBeNull()
  })

  it('formatRank renders "#N of 195" with the derived denominator', () => {
    expect(formatRank(48)).toBe('#48 of 195')
    expect(formatRank(1)).toBe('#1 of 195')
  })
})
