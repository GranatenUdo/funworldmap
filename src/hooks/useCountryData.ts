import { useMemo } from 'react'
import countriesFile from '../data/countries.json'
import type { CountryData, CountriesFile } from '../lib/types'

const data = countriesFile as unknown as CountriesFile

export interface CountryLookups {
  /** All countries as an array (for search index) */
  countries: CountryData[]
  /** ccn3 (numeric ID) → CountryData. Used for map click (feature ID → metadata). */
  byNumeric: Map<string, CountryData>
  /** cca3 (3-letter code) → CountryData. Used for URL hash and border chips. */
  byCca3: Map<string, CountryData>
  /** Source registry metadata */
  sources: CountriesFile['_sources']
}

export function useCountryData(): CountryLookups {
  return useMemo(() => {
    const byNumeric = new Map<string, CountryData>()
    const byCca3 = new Map<string, CountryData>()

    for (const country of data.countries) {
      byNumeric.set(country.ccn3, country)
      byCca3.set(country.cca3, country)
    }

    return { countries: data.countries, byNumeric, byCca3, sources: data._sources }
  }, [])
}
