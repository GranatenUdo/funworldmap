import type { PartialCountry } from '../types.js'

const FIELDS = [
  'ccn3',
  'cca2',
  'cca3',
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
  'flags',
].join(',')

const API_URL = `https://restcountries.com/v3.1/all?fields=${FIELDS}`

interface RestCountryRaw {
  ccn3: string
  cca2: string
  cca3: string
  name: { common: string; official: string }
  capital: string[]
  region: string
  subregion: string
  population: number
  area: number
  languages: Record<string, string>
  currencies: Record<string, { name: string; symbol: string }>
  latlng: [number, number]
  borders: string[]
  independent: boolean
  unMember: boolean
  landlocked: boolean
  timezones: string[]
  continents: string[]
  flags: { svg: string; alt: string }
}

export async function fetchRestCountries(): Promise<PartialCountry[]> {
  console.log('Fetching REST Countries API...')
  const response = await fetch(API_URL)
  if (!response.ok) {
    throw new Error(`REST Countries API returned ${response.status}: ${response.statusText}`)
  }

  const raw: RestCountryRaw[] = await response.json()
  console.log(`  Received ${raw.length} countries`)

  return raw
    .filter((c) => c.ccn3) // skip entries without numeric code
    .map((c) => ({
      ccn3: c.ccn3,
      cca2: c.cca2,
      cca3: c.cca3,
      name: c.name,
      capital: c.capital ?? [],
      region: c.region ?? '',
      subregion: c.subregion ?? '',
      population: c.population ?? 0,
      area: c.area ?? 0,
      languages: c.languages ?? {},
      currencies: c.currencies ?? {},
      flag: `flags/${c.cca2}.svg`,
      flagAlt: c.flags?.alt ?? '',
      latlng: c.latlng ?? [0, 0],
      borders: c.borders ?? [],
      independent: c.independent ?? false,
      unMember: c.unMember ?? false,
      landlocked: c.landlocked ?? false,
      timezones: c.timezones ?? [],
      continents: c.continents ?? [],
    }))
}
