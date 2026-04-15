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

export interface CountriesFile {
  _sources: Record<string, { name: string; url: string; description: string; lastUpdated: string }>
  countries: CountryData[]
}
