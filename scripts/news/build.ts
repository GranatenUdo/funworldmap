import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import countriesFile from '../../src/data/countries.json' with { type: 'json' }
import { cca3ToFips } from './fips-codes'
import { gdeltSearch, type GdeltArticle } from './gdelt-client'

interface Country {
  cca2: string
  cca3: string
  name: { common: string }
}

interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  articles: GdeltArticle[]
}

const THROTTLE_MS = 500 // GDELT community-polite pacing
const WINDOW = '7d'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function buildCountry(country: Country): Promise<CountryNewsFile> {
  const fips = cca3ToFips(country.cca3, country.cca2)
  let articles: GdeltArticle[] = []
  if (fips !== null) {
    try {
      articles = await gdeltSearch({
        fips,
        sourceLang: 'english',
        timespan: WINDOW,
        maxRecords: 5,
      })
    } catch (err) {
      console.warn(`[news] ${country.cca3} fetch failed: ${(err as Error).message}`)
    }
  }
  return {
    updatedAt: new Date().toISOString(),
    country: { cca3: country.cca3, name: country.name.common },
    articles,
  }
}

async function main(): Promise<void> {
  const countries = (countriesFile as { countries: Country[] }).countries
  const outDir = 'public/news'
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`[news] building for ${countries.length} countries`)

  let totalArticles = 0
  for (let i = 0; i < countries.length; i++) {
    const c = countries[i]
    const result = await buildCountry(c)
    const outPath = join(outDir, `${c.cca3}.json`)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
    totalArticles += result.articles.length
    if ((i + 1) % 25 === 0) {
      console.log(`[news] ${i + 1}/${countries.length} done`)
    }
    await sleep(THROTTLE_MS)
  }

  console.log(`[news] complete: ${totalArticles} articles across ${countries.length} files`)
}

main().catch((err) => {
  console.error('[news] fatal:', err)
  process.exit(1)
})
