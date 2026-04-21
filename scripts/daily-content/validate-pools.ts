import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCliEntryPoint } from './_cli.js'

export interface CountryLike { cca3: string }
export interface CityLike { id: string }
export interface CountryPool { version: number; cca3: string[] }
export interface CityPool { version: number; ids: string[] }

export type ValidationError =
  | { kind: 'missing-country'; id: string }
  | { kind: 'missing-city'; id: string }
  | { kind: 'duplicate-country'; id: string }
  | { kind: 'duplicate-city'; id: string }
  | { kind: 'bad-version'; file: 'country-pool' | 'city-pool' }

export interface ValidationInput {
  countries: CountryLike[]
  cities: CityLike[]
  countryPool: CountryPool
  cityPool: CityPool
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
}

export function validatePools(input: ValidationInput): ValidationResult {
  const errors: ValidationError[] = []
  const { countries, cities, countryPool, cityPool } = input

  if (countryPool.version !== 1) errors.push({ kind: 'bad-version', file: 'country-pool' })
  if (cityPool.version !== 1) errors.push({ kind: 'bad-version', file: 'city-pool' })

  const knownCca3 = new Set(countries.map((c) => c.cca3))
  const knownCityIds = new Set(cities.map((c) => c.id))

  const cca3Seen = new Set<string>()
  for (const id of countryPool.cca3) {
    if (!knownCca3.has(id)) errors.push({ kind: 'missing-country', id })
    if (cca3Seen.has(id)) errors.push({ kind: 'duplicate-country', id })
    cca3Seen.add(id)
  }

  const cityIdSeen = new Set<string>()
  for (const id of cityPool.ids) {
    if (!knownCityIds.has(id)) errors.push({ kind: 'missing-city', id })
    if (cityIdSeen.has(id)) errors.push({ kind: 'duplicate-city', id })
    cityIdSeen.add(id)
  }

  return { ok: errors.length === 0, errors }
}

// CLI entry point
if (isCliEntryPoint(import.meta.url)) {
  const root = process.cwd()
  const countries = JSON.parse(readFileSync(join(root, 'src/data/countries.json'), 'utf-8'))
  const cities = JSON.parse(readFileSync(join(root, 'src/data/cities.json'), 'utf-8'))
  const countryPool = JSON.parse(
    readFileSync(join(root, 'scripts/daily-content/country-pool.json'), 'utf-8'),
  )
  const cityPool = JSON.parse(
    readFileSync(join(root, 'scripts/daily-content/city-pool.json'), 'utf-8'),
  )
  const result = validatePools({
    countries: Array.isArray(countries) ? countries : (countries.countries ?? []),
    cities: Array.isArray(cities) ? cities : (cities.cities ?? []),
    countryPool,
    cityPool,
  })
  if (!result.ok) {
    console.error('Pool validation failed:')
    for (const e of result.errors) console.error('  -', e)
    process.exit(1)
  }
  console.log('Pool validation ok.')
}
