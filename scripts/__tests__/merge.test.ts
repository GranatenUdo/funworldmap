import { describe, it, expect } from 'vitest'
import {
  mergeCountries,
  buildCountriesFile,
  buildSourcesRegistry,
  validateJoinIntegrity,
} from '../merge.js'
import type { PartialCountry, CountryData } from '../types.js'

function makeRestCountry(overrides: Partial<PartialCountry> = {}): PartialCountry {
  return {
    ccn3: '250',
    cca2: 'FR',
    cca3: 'FRA',
    name: { common: 'France', official: 'French Republic' },
    capital: ['Paris'],
    region: 'Europe',
    subregion: 'Western Europe',
    population: 67390000,
    area: 551695,
    languages: { fra: 'French' },
    currencies: { EUR: { name: 'Euro', symbol: '€' } },
    flag: 'flags/FR.svg',
    flagAlt: 'Blue, white, red vertical bands',
    latlng: [46.0, 2.0] as [number, number],
    borders: ['DEU', 'ESP'],
    independent: true,
    unMember: true,
    landlocked: false,
    timezones: ['UTC+01:00'],
    continents: ['Europe'],
    ...overrides,
  }
}

describe('mergeCountries', () => {
  it('merges REST Countries data with empty factbook', () => {
    const rc = [makeRestCountry()]
    const result = mergeCountries(rc, [])

    expect(result).toHaveLength(1)
    expect(result[0].cca3).toBe('FRA')
    expect(result[0].name.common).toBe('France')
    expect(result[0].governmentType).toBe('')
  })

  it('applies CIA Factbook government type with priority', () => {
    const rc = [makeRestCountry()]
    const fb: PartialCountry[] = [{ cca3: 'FRA', governmentType: 'semi-presidential republic' }]

    const result = mergeCountries(rc, fb)

    expect(result[0].governmentType).toBe('semi-presidential republic')
    expect(result[0]._fieldSources.governmentType).toBe('cia-factbook')
  })

  it('marks REST Countries fields in _fieldSources', () => {
    const result = mergeCountries([makeRestCountry()], [])

    expect(result[0]._fieldSources.name).toBe('restcountries')
    expect(result[0]._fieldSources.population).toBe('restcountries')
    expect(result[0]._fieldSources.capital).toBe('restcountries')
    expect(result[0]._fieldSources.region).toBe('restcountries')
  })

  it('does not add cia-factbook to _fieldSources when no gov type', () => {
    const result = mergeCountries([makeRestCountry()], [])

    expect(result[0]._fieldSources.governmentType).toBeUndefined()
    expect(result[0].governmentType).toBe('')
  })

  it('handles multiple countries', () => {
    const rc = [
      makeRestCountry({ cca3: 'FRA', ccn3: '250', cca2: 'FR' }),
      makeRestCountry({
        cca3: 'DEU',
        ccn3: '276',
        cca2: 'DE',
        name: { common: 'Germany', official: 'Federal Republic of Germany' },
      }),
    ]
    const fb: PartialCountry[] = [
      { cca3: 'DEU', governmentType: 'federal parliamentary republic' },
    ]

    const result = mergeCountries(rc, fb)

    expect(result).toHaveLength(2)
    expect(result[0].governmentType).toBe('')
    expect(result[1].governmentType).toBe('federal parliamentary republic')
  })

  it('ignores factbook entries that do not match any REST country', () => {
    const rc = [makeRestCountry()]
    const fb: PartialCountry[] = [{ cca3: 'XYZ', governmentType: 'unknown' }]

    const result = mergeCountries(rc, fb)
    expect(result).toHaveLength(1)
    expect(result[0].governmentType).toBe('')
  })
})

describe('buildCountriesFile', () => {
  it('sorts countries by common name', () => {
    const countries: CountryData[] = [
      { ...mergeCountries([makeRestCountry({ cca3: 'FRA', name: { common: 'France', official: 'French Republic' } })], [])[0] },
      { ...mergeCountries([makeRestCountry({ cca3: 'DEU', name: { common: 'Germany', official: 'Federal Republic of Germany' } })], [])[0] },
      { ...mergeCountries([makeRestCountry({ cca3: 'AND', name: { common: 'Andorra', official: 'Principality of Andorra' } })], [])[0] },
    ]

    const file = buildCountriesFile(countries)

    expect(file.countries[0].name.common).toBe('Andorra')
    expect(file.countries[1].name.common).toBe('France')
    expect(file.countries[2].name.common).toBe('Germany')
  })

  it('includes _sources registry', () => {
    const file = buildCountriesFile([])

    expect(file._sources.restcountries).toBeDefined()
    expect(file._sources.restcountries.name).toBe('REST Countries')
    expect(file._sources['cia-factbook']).toBeDefined()
    expect(file._sources['cia-factbook'].lastUpdated).toBe('2026-01-22')
  })
})

describe('buildSourcesRegistry', () => {
  it('includes REST Countries with today date', () => {
    const sources = buildSourcesRegistry()
    const today = new Date().toISOString().split('T')[0]
    expect(sources.restcountries.lastUpdated).toBe(today)
  })

  it('includes CIA Factbook with archived date', () => {
    const sources = buildSourcesRegistry()
    expect(sources['cia-factbook'].lastUpdated).toBe('2026-01-22')
    expect(sources['cia-factbook'].url).toContain('github.com')
  })
})

describe('validateJoinIntegrity', () => {
  it('reports matched and unmatched feature IDs', () => {
    const countries = mergeCountries(
      [makeRestCountry({ ccn3: '250' }), makeRestCountry({ ccn3: '276' })],
      [],
    )
    const featureIds = ['250', '276', '999']

    const { matched, unmatched } = validateJoinIntegrity(countries, featureIds)

    expect(matched).toBe(2)
    expect(unmatched).toEqual(['999'])
  })

  it('handles empty feature IDs', () => {
    const countries = mergeCountries([makeRestCountry()], [])
    const { matched, unmatched } = validateJoinIntegrity(countries, [])

    expect(matched).toBe(0)
    expect(unmatched).toEqual([])
  })
})

describe('GeoJSON ↔ countries.json join integrity', () => {
  it('most world-atlas features have a string id (some disputed territories may not)', async () => {
    const topojsonClient = await import('topojson-client')
    const worldAtlas = await import('world-atlas/countries-50m.json')
    const topology = worldAtlas.default as unknown as TopoJSON.Topology
    const geojson = topojsonClient.feature(
      topology,
      topology.objects.countries,
    ) as GeoJSON.FeatureCollection

    const withId = geojson.features.filter((f) => f.id != null)
    const withoutId = geojson.features.filter((f) => f.id == null)

    // Vast majority should have IDs
    expect(withId.length).toBeGreaterThan(230)
    // A few disputed territories may lack IDs
    expect(withoutId.length).toBeLessThan(20)

    // All features with IDs should have string IDs
    for (const feature of withId) {
      expect(typeof feature.id).toBe('string')
    }
  })

  it('world-atlas features do NOT have properties.id (id is top-level only)', async () => {
    const topojsonClient = await import('topojson-client')
    const worldAtlas = await import('world-atlas/countries-50m.json')
    const topology = worldAtlas.default as unknown as TopoJSON.Topology
    const geojson = topojsonClient.feature(
      topology,
      topology.objects.countries,
    ) as GeoJSON.FeatureCollection

    // Documents the gotcha: id is top-level, NOT in properties
    const firstFeature = geojson.features[0]
    expect(firstFeature.properties).toBeDefined()
    expect('id' in (firstFeature.properties ?? {})).toBe(false)
    expect(firstFeature.id).toBeDefined()
  })

  it('majority of world-atlas feature IDs match a countries.json ccn3', async () => {
    const topojsonClient = await import('topojson-client')
    const worldAtlas = await import('world-atlas/countries-50m.json')
    const countriesFile = await import('../../src/data/countries.json')

    const topology = worldAtlas.default as unknown as TopoJSON.Topology
    const geojson = topojsonClient.feature(
      topology,
      topology.objects.countries,
    ) as GeoJSON.FeatureCollection

    const ccn3Set = new Set(
      (countriesFile as unknown as { countries: Array<{ ccn3: string }> }).countries.map(
        (c) => c.ccn3,
      ),
    )

    const featureIds = geojson.features.map((f) => String(f.id))
    const matched = featureIds.filter((id) => ccn3Set.has(id))

    // At least 90% of features should match (some disputed territories won't)
    expect(matched.length / featureIds.length).toBeGreaterThan(0.9)
    expect(matched.length).toBeGreaterThan(200)
  })
})
