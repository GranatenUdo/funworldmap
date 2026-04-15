import type { CountryData, CountriesFile, PartialCountry, SourceMeta } from './types.js'

const REST_COUNTRIES_FIELDS = [
  'name',
  'capital',
  'region',
  'subregion',
  'population',
  'area',
  'languages',
  'currencies',
  'latlng',
  'borders',
  'independent',
  'unMember',
  'landlocked',
  'timezones',
  'continents',
] as const

const CIA_FACTBOOK_FIELDS = ['governmentType'] as const

/** Merge REST Countries base data with CIA Factbook government types */
export function mergeCountries(
  restCountries: PartialCountry[],
  ciaFactbook: PartialCountry[],
): CountryData[] {
  // Index factbook data by cca3
  const factbookByCode = new Map<string, PartialCountry>()
  for (const entry of ciaFactbook) {
    factbookByCode.set(entry.cca3, entry)
  }

  return restCountries.map((rc) => {
    const fb = factbookByCode.get(rc.cca3!)

    // Build _fieldSources
    const fieldSources: Record<string, string> = {}
    for (const field of REST_COUNTRIES_FIELDS) {
      fieldSources[field] = 'restcountries'
    }
    if (fb?.governmentType) {
      for (const field of CIA_FACTBOOK_FIELDS) {
        fieldSources[field] = 'cia-factbook'
      }
    }

    return {
      ccn3: rc.ccn3!,
      cca2: rc.cca2!,
      cca3: rc.cca3,
      name: rc.name!,
      capital: rc.capital!,
      region: rc.region!,
      subregion: rc.subregion!,
      population: rc.population!,
      area: rc.area!,
      governmentType: fb?.governmentType ?? '',
      languages: rc.languages!,
      currencies: rc.currencies!,
      flag: rc.flag!,
      flagAlt: rc.flagAlt!,
      latlng: rc.latlng!,
      borders: rc.borders!,
      independent: rc.independent!,
      unMember: rc.unMember!,
      landlocked: rc.landlocked!,
      timezones: rc.timezones!,
      continents: rc.continents!,
      _fieldSources: fieldSources,
    } satisfies CountryData
  })
}

/** Build the _sources registry metadata */
export function buildSourcesRegistry(): Record<string, SourceMeta> {
  const today = new Date().toISOString().split('T')[0]
  return {
    restcountries: {
      name: 'REST Countries',
      url: 'https://restcountries.com/',
      description: 'Open-source API for country data',
      lastUpdated: today,
    },
    'cia-factbook': {
      name: 'CIA World Factbook (archived)',
      url: 'https://github.com/factbook/factbook.json',
      description: 'CC0 JSON archive of the CIA World Factbook (shut down February 2026)',
      lastUpdated: '2026-01-22',
    },
  }
}

/** Build the final countries.json structure */
export function buildCountriesFile(countries: CountryData[]): CountriesFile {
  // Sort by country name for stable output
  const sorted = [...countries].sort((a, b) => a.name.common.localeCompare(b.name.common))
  return {
    _sources: buildSourcesRegistry(),
    countries: sorted,
  }
}

/** Validate merged data against world-atlas feature IDs */
export function validateJoinIntegrity(
  countries: CountryData[],
  worldAtlasIds: string[],
): { matched: number; unmatched: string[] } {
  const countryByNumeric = new Map<string, CountryData>()
  for (const c of countries) {
    countryByNumeric.set(c.ccn3, c)
  }

  const unmatched: string[] = []
  let matched = 0

  for (const id of worldAtlasIds) {
    if (countryByNumeric.has(id)) {
      matched++
    } else {
      unmatched.push(id)
    }
  }

  return { matched, unmatched }
}
