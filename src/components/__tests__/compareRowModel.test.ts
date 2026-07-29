import { describe, it, expect } from 'vitest'
import { barWidthPct, formatDelta, buildRowModel } from '../compareRowModel'
import { COMPARE_FIELDS, densityOf, formatDensity } from '../../lib/compareFields'
import { makeCountryData } from '../../test/countryFixtures'

function field(key: string) {
  const f = COMPARE_FIELDS.find((f) => f.key === key)
  if (!f) throw new Error(`no COMPARE_FIELDS entry '${key}'`)
  return f
}

describe('barWidthPct (C2)', () => {
  it('scales to percent of max(A, B) with one-decimal precision', () => {
    expect(barWidthPct(63_000_000, 63_000_000)).toBe(100)
    expect(barWidthPct(50_000_000, 63_000_000)).toBe(79.4)
    expect(barWidthPct(1, 3)).toBe(33.3)
  })
})

describe('formatDelta (C2) — exact phrasing contract', () => {
  it('names the LARGER country in both column orders', () => {
    expect(formatDelta('population', 'France', 'Germany', 50e6, 63e6)).toBe(
      'Germany 1.26× population',
    )
    expect(formatDelta('population', 'Germany', 'France', 63e6, 50e6)).toBe(
      'Germany 1.26× population',
    )
  })

  it('equal and sub-rounding-equal values read "Same <noun>"', () => {
    expect(formatDelta('area', 'France', 'Belgium', 1000, 1000)).toBe('Same area')
    expect(formatDelta('area', 'France', 'Belgium', 1002, 1000)).toBe('Same area') // 1.002 → '1.00'
  })

  it('a missing value produces no chip', () => {
    expect(formatDelta('area', 'France', 'Germany', null, 357_000)).toBeNull()
    expect(formatDelta('area', 'France', 'Germany', 551_695, null)).toBeNull()
  })

  it('extreme ratios stay readable via en-US grouping', () => {
    expect(formatDelta('area', 'Russia', 'Vatican City', 17_098_242, 0.44)).toBe(
      'Russia 38,859,640.91× area',
    )
  })
})

describe('densityOf / formatDensity (C3)', () => {
  it('derives population/area', () => {
    expect(densityOf(makeCountryData())).toBeCloseTo(121.44, 2) // 67M / 551,695
  })

  it('is null when population or area is non-positive', () => {
    expect(densityOf(makeCountryData({ area: 0 }))).toBeNull()
    expect(densityOf(makeCountryData({ population: 0 }))).toBeNull()
  })

  it('formats people/km² — integers at ≥10, one decimal under 10, em-dash when missing', () => {
    expect(formatDensity(makeCountryData())).toBe('121 people/km²')
    expect(formatDensity(makeCountryData({ population: 3_300_000, area: 1_564_110 }))).toBe(
      '2.1 people/km²',
    )
    expect(formatDensity(makeCountryData({ area: 0 }))).toBe('—')
  })
})

describe('buildRowModel (C2)', () => {
  it('numeric: pcts scale to max, missing value → null pct and null delta', () => {
    const m = buildRowModel(
      field('area'),
      makeCountryData({ area: 0 }),
      makeCountryData({ cca3: 'DEU', area: 357_114 }),
    )
    expect(m.kind).toBe('numeric')
    if (m.kind !== 'numeric') throw new Error('unreachable')
    expect(m.aPct).toBeNull()
    expect(m.bPct).toBe(100)
    expect(m.delta).toBeNull()
    expect(m.aText).toBe('—')
  })

  it('numeric: population=0 (missing) → null pct and null delta', () => {
    const m = buildRowModel(
      field('population'),
      makeCountryData({ population: 0 }),
      makeCountryData({ cca3: 'DEU', population: 63_000_000 }),
    )
    expect(m.kind).toBe('numeric')
    if (m.kind !== 'numeric') throw new Error('unreachable')
    expect(m.aPct).toBeNull()
    expect(m.bPct).toBe(100)
    expect(m.delta).toBeNull()
    expect(m.aText).toBe('—')
  })

  it('categorical: identical formatted values collapse to kind "both"', () => {
    const m = buildRowModel(
      field('currencies'),
      makeCountryData(),
      makeCountryData({ cca3: 'DEU' }),
    )
    expect(m.kind).toBe('both')
  })

  it('categorical: two MISSING values stay split — never "Both: —"', () => {
    const m = buildRowModel(
      field('currencies'),
      makeCountryData({ currencies: {} }),
      makeCountryData({ cca3: 'DEU', currencies: {} }),
    )
    expect(m.kind).toBe('split')
  })
})
