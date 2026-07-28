import { describe, expect, it } from 'vitest'
import { COUNTRY_LABEL_COLLECTION, buildCountryLabelFeatures } from '../countryLabelFeatures'
import countriesFile from '../../data/countries.json'
import type { CountriesFile } from '../types'

const { features } = COUNTRY_LABEL_COLLECTION
const byCca3 = new Map(features.map((f) => [f.properties.cca3, f]))

describe('buildCountryLabelFeatures', () => {
  it('emits exactly the 195 canonical countries from the full 249-entry file', () => {
    expect((countriesFile as unknown as CountriesFile).countries.length).toBe(249)
    expect(features).toHaveLength(195)
    expect(byCca3.has('TWN')).toBe(false) // non-canonical entries filtered out
  })

  it('France is present with swapped [lng, lat] coordinates and a mid-table rank', () => {
    const fra = byCca3.get('FRA')
    expect(fra).toBeDefined()
    // countries.json latlng for FRA is [46, 2] ([lat, lng]); GeoJSON order is [lng, lat].
    expect(fra!.geometry.coordinates).toEqual([2, 46])
    expect(fra!.properties.name).toBe('France')
    // 543,908 km² ranks France 48th of 195 in the current data. Range-asserted
    // so an upstream area revision doesn't churn this test.
    expect(fra!.properties.areaRank).toBeGreaterThanOrEqual(40)
    expect(fra!.properties.areaRank).toBeLessThanOrEqual(60)
  })

  it('areaRank is a dense 1..195 ranking: 1 = Russia (largest), 195 = Vatican (smallest)', () => {
    expect(byCca3.get('RUS')!.properties.areaRank).toBe(1)
    expect(byCca3.get('VAT')!.properties.areaRank).toBe(195)
    const ranks = features.map((f) => f.properties.areaRank)
    expect(new Set(ranks).size).toBe(195)
    expect(Math.min(...ranks)).toBe(1)
    expect(Math.max(...ranks)).toBe(195)
  })

  it('every label name is Latin-1 — one glyph PBF range (0-255) covers the layer', () => {
    const offenders = features
      .filter((f) => [...f.properties.name].some((ch) => ch.codePointAt(0)! > 0xff))
      .map((f) => `${f.properties.cca3}:${f.properties.name}`)
    expect(offenders).toEqual([])
  })

  it('no point needs an antimeridian shift: all coordinates in [-180,180]×[-90,90]', () => {
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates
      expect(lng).toBeGreaterThanOrEqual(-180)
      expect(lng).toBeLessThanOrEqual(180)
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(lat).toBeLessThanOrEqual(90)
    }
  })

  it('rank ties break deterministically by cca3 (guards future data refreshes)', () => {
    const tied = buildCountryLabelFeatures([
      { cca3: 'DEU', name: { common: 'Germany', official: 'x' }, latlng: [51, 9], area: 100 },
      {
        cca3: 'AUT',
        name: { common: 'Austria', official: 'x' },
        latlng: [47.3333, 13.3333],
        area: 100,
      },
    ])
    expect(tied.features.map((f) => f.properties.cca3)).toEqual(['AUT', 'DEU'])
  })
})
