/**
 * Build-time script — downloads Natural Earth Populated Places,
 * takes top 500 by (scalerank ASC, pop_max DESC), joins country
 * name + flag from src/data/countries.json, writes src/data/cities.json.
 *
 * Run:  npm run fetch-cities
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson'

type NeFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }   // [lng, lat]
  properties: {
    name: string
    adm0_a3: string
    scalerank: number
    pop_max: number
    [k: string]: unknown
  }
}

type CountriesEntry = {
  cca3: string
  name: { common: string }
  flag: string
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  console.log('Fetching Natural Earth Populated Places…')
  const resp = await fetch(NE_URL)
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`)
  const fc = (await resp.json()) as { features: NeFeature[] }
  console.log(`Got ${fc.features.length} features`)

  const countriesRaw = await readFile(resolve(ROOT, 'src/data/countries.json'), 'utf-8')
  const countriesJson = JSON.parse(countriesRaw) as { countries: CountriesEntry[] } | CountriesEntry[]
  const countries = Array.isArray(countriesJson) ? countriesJson : countriesJson.countries
  const byCca3 = new Map(countries.map((c) => [c.cca3, c]))

  // Sort ascending by (scalerank, -pop_max)
  const sorted = [...fc.features].sort((a, b) => {
    if (a.properties.scalerank !== b.properties.scalerank) {
      return a.properties.scalerank - b.properties.scalerank
    }
    return b.properties.pop_max - a.properties.pop_max
  })

  const top500 = sorted.slice(0, 500)
  const records: {
    id: string
    name: string
    countryCca3: string
    countryName: string
    countryFlag: string
    latlng: [number, number]
    scalerank: number
  }[] = []
  const skipped: string[] = []
  const ids = new Set<string>()
  const collisions: string[] = []

  for (const f of top500) {
    const p = f.properties
    const country = byCca3.get(p.adm0_a3)
    if (!country) {
      skipped.push(`${p.name} (${p.adm0_a3} not in countries.json)`)
      continue
    }
    const id = `${country.cca3}-${slug(p.name)}`
    if (ids.has(id)) {
      collisions.push(`${p.name} → ${id}`)
      continue
    }
    ids.add(id)
    const [lng, lat] = f.geometry.coordinates
    records.push({
      id,
      name: p.name,
      countryCca3: country.cca3,
      countryName: country.name.common,
      countryFlag: country.flag,
      latlng: [lat, lng],
      scalerank: p.scalerank,
    })
  }

  if (collisions.length > 0) {
    console.error(`\nERROR: ${collisions.length} id collisions:`)
    collisions.forEach((c) => console.error(`  ${c}`))
    console.error('Disambiguate via ADM1 or manual override before committing.')
    process.exit(1)
  }
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} cities (missing country mapping):`)
    skipped.slice(0, 5).forEach((s) => console.warn(`  ${s}`))
    if (skipped.length > 5) console.warn(`  …and ${skipped.length - 5} more`)
  }

  console.log(`Writing ${records.length} cities to src/data/cities.json`)
  await writeFile(
    resolve(ROOT, 'src/data/cities.json'),
    JSON.stringify(records, null, 2),
    'utf-8',
  )
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
