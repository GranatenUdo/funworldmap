import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pickDaily } from './picker.js'
import { toLocalDateString } from '../../src/game/daily/dates.js'

interface CountryPool { version: number; cca3: string[] }
interface CityPool { version: number; ids: string[] }
interface Pools { country: CountryPool; city: CityPool }

interface DayEntry {
  country: { cca3: string }
  city: { id: string }
}

export interface DailyIndex {
  generatedAt: string
  window: { start: string; end: string }
  days: Record<string, DayEntry>
}

export interface BuildInput {
  today: Date
  pool: Pools
  retentionDays: number
  existing: DailyIndex | null
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function buildIndex(input: BuildInput): DailyIndex {
  const { today, pool, retentionDays, existing } = input
  const start = addDays(today, -(retentionDays - 1))
  const startStr = toLocalDateString(start)
  const endStr = toLocalDateString(today)

  const days: Record<string, DayEntry> = {}
  // Carry forward existing entries that still fall in the window.
  if (existing) {
    for (const [date, entry] of Object.entries(existing.days)) {
      if (date >= startStr && date <= endStr) {
        days[date] = entry
      }
    }
  }

  // Fill any missing dates in the window.
  for (let i = 0; i < retentionDays; i++) {
    const d = addDays(start, i)
    const dateStr = toLocalDateString(d)
    if (days[dateStr]) continue
    const recentCountries = Object.values(days).map((e) => e.country.cca3)
    const recentCities = Object.values(days).map((e) => e.city.id)
    const cca3 = pickDaily(dateStr, pool.country.cca3, recentCountries)
    const cityId = pickDaily(dateStr + ':city', pool.city.ids, recentCities)
    days[dateStr] = { country: { cca3 }, city: { id: cityId } }
  }

  return {
    generatedAt: new Date().toISOString(),
    window: { start: startStr, end: endStr },
    days,
  }
}

// CLI entry
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd()
  const countryPool = JSON.parse(
    readFileSync(join(root, 'scripts/daily-content/country-pool.json'), 'utf-8'),
  ) as CountryPool
  const cityPool = JSON.parse(
    readFileSync(join(root, 'scripts/daily-content/city-pool.json'), 'utf-8'),
  ) as CityPool

  const outPath = join(root, 'public/daily/index.json')
  let existing: DailyIndex | null = null
  try {
    existing = JSON.parse(readFileSync(outPath, 'utf-8')) as DailyIndex
  } catch {
    existing = null
  }

  const result = buildIndex({
    today: new Date(),
    pool: { country: countryPool, city: cityPool },
    retentionDays: 30,
    existing,
  })

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(
    `Wrote ${outPath}: window ${result.window.start}..${result.window.end} (${Object.keys(result.days).length} days)`,
  )
}
