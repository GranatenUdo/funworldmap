import type { PartialCountry } from '../types.js'

// REST Countries API limits to 10 fields per request, so we split into two
const FIELDS_1 = 'ccn3,cca2,cca3,name,capital,region,subregion,population,area,languages'
const FIELDS_2 = 'cca3,currencies,latlng,borders,independent,unMember,landlocked,timezones,continents,flags'

const API_BASE = 'https://restcountries.com/v3.1/all?fields='

interface RestCountryPart1 {
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
}

interface RestCountryPart2 {
  cca3: string
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
  console.log('Fetching REST Countries API (2 requests)...')

  const [resp1, resp2] = await Promise.all([
    fetch(`${API_BASE}${FIELDS_1}`),
    fetch(`${API_BASE}${FIELDS_2}`),
  ])

  if (!resp1.ok) throw new Error(`REST Countries request 1 failed: ${resp1.status}`)
  if (!resp2.ok) throw new Error(`REST Countries request 2 failed: ${resp2.status}`)

  const part1: RestCountryPart1[] = await resp1.json()
  const part2: RestCountryPart2[] = await resp2.json()

  console.log(`  Received ${part1.length} countries (part 1) and ${part2.length} (part 2)`)

  // Index part 2 by cca3
  const part2Map = new Map<string, RestCountryPart2>()
  for (const c of part2) {
    part2Map.set(c.cca3, c)
  }

  return part1
    .filter((c) => c.ccn3) // skip entries without numeric code
    .map((c) => {
      const p2 = part2Map.get(c.cca3)
      return {
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
        currencies: p2?.currencies ?? {},
        flag: `flags/${c.cca2}.svg`,
        flagAlt: p2?.flags?.alt ?? '',
        latlng: p2?.latlng ?? [0, 0],
        borders: p2?.borders ?? [],
        independent: p2?.independent ?? false,
        unMember: p2?.unMember ?? false,
        landlocked: p2?.landlocked ?? false,
        timezones: p2?.timezones ?? [],
        continents: p2?.continents ?? [],
      }
    })
}
