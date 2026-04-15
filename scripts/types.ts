/** Per-country data as defined in docs/systems/data.md */
export interface CountryData {
  ccn3: string
  cca2: string
  cca3: string
  name: { common: string; official: string }
  capital: string[]
  region: string
  subregion: string
  population: number
  area: number
  governmentType: string
  languages: Record<string, string>
  currencies: Record<string, { name: string; symbol: string }>
  flag: string
  flagAlt: string
  latlng: [number, number]
  borders: string[]
  independent: boolean
  unMember: boolean
  landlocked: boolean
  timezones: string[]
  continents: string[]
  _fieldSources: Record<string, string>
}

/** Source registry entry for _sources metadata */
export interface SourceMeta {
  name: string
  url: string
  description: string
  lastUpdated: string
}

/** Output structure of countries.json */
export interface CountriesFile {
  _sources: Record<string, SourceMeta>
  countries: CountryData[]
}

/** Partial country data from a single source (before merge) */
export type PartialCountry = Partial<CountryData> & {
  cca3: string
  ccn3?: string
  cca2?: string
}
