import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import countriesFile from '../../src/data/countries.json' with { type: 'json' }
import { cca3ToGuardianTag } from './guardian-tags'
import { regionToGuardianTag } from './regions'
import { guardianSearch, type GuardianArticle } from './guardian-client'

interface Country {
  cca3: string
  name: { common: string }
  region: string
}

interface CountryNewsArticle extends GuardianArticle {
  scope: 'country' | 'region'
}

interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  guardianTag: string | null
  articles: CountryNewsArticle[]
}

const THROTTLE_MS = 1100 // Guardian free tier: 1 call/sec; 1.1s for safety
const WINDOW_DAYS = 7

function daysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function buildCountry(
  country: Country,
  apiKey: string,
  fromDate: string,
): Promise<CountryNewsFile> {
  const tag = cca3ToGuardianTag(country.cca3)
  const regionTag = regionToGuardianTag(country.region)

  let countryArticles: CountryNewsArticle[] = []
  if (tag) {
    try {
      const raw = await guardianSearch({ tag, fromDate, pageSize: 5, apiKey })
      countryArticles = raw.map((a) => ({ ...a, scope: 'country' as const }))
    } catch (err) {
      console.warn(`[news] ${country.cca3} country fetch failed: ${(err as Error).message}`)
    }
    await sleep(THROTTLE_MS)
  }

  let regionArticles: CountryNewsArticle[] = []
  if (countryArticles.length < 5 && regionTag) {
    const remainder = 5 - countryArticles.length
    try {
      const raw = await guardianSearch({
        tag: regionTag,
        fromDate,
        pageSize: remainder * 2,
        apiKey,
      })
      const existingIds = new Set(countryArticles.map((a) => a.id))
      regionArticles = raw
        .filter((a) => !existingIds.has(a.id))
        .slice(0, remainder)
        .map((a) => ({ ...a, scope: 'region' as const }))
    } catch (err) {
      console.warn(`[news] ${country.cca3} region fetch failed: ${(err as Error).message}`)
    }
    await sleep(THROTTLE_MS)
  }

  return {
    updatedAt: new Date().toISOString(),
    country: { cca3: country.cca3, name: country.name.common },
    guardianTag: tag,
    articles: [...countryArticles, ...regionArticles],
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.GUARDIAN_KEY
  if (!apiKey) {
    console.error('[news] GUARDIAN_KEY env var is required')
    process.exit(1)
  }

  const countries = (countriesFile as { countries: Country[] }).countries
  const fromDate = daysAgo(WINDOW_DAYS)
  const outDir = 'public/news'
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`[news] building for ${countries.length} countries; fromDate=${fromDate}`)

  let totalArticles = 0
  for (let i = 0; i < countries.length; i++) {
    const c = countries[i]
    const result = await buildCountry(c, apiKey, fromDate)
    const outPath = join(outDir, `${c.cca3}.json`)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
    totalArticles += result.articles.length
    if ((i + 1) % 25 === 0) {
      console.log(`[news] ${i + 1}/${countries.length} done`)
    }
  }

  console.log(`[news] complete: ${totalArticles} articles across ${countries.length} files`)
}

main().catch((err) => {
  console.error('[news] fatal:', err)
  process.exit(1)
})
