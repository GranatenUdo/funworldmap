import countriesFile from '../../src/data/countries.json' with { type: 'json' }
import { cca3ToFips } from './fips-codes'
import { gdeltSearch } from './gdelt-client'

interface Country {
  cca2: string
  cca3: string
  name: { common: string }
}

async function main(): Promise<void> {
  const countries = (countriesFile as { countries: Country[] }).countries
  const noResults: string[] = []
  const nullFips: string[] = []
  const errors: string[] = []

  for (const c of countries) {
    const fips = cca3ToFips(c.cca3, c.cca2)
    if (fips === null) {
      nullFips.push(`${c.cca3} (${c.name.common})`)
      continue
    }
    try {
      const articles = await gdeltSearch({ fips, sourceLang: 'english', timespan: '30d', maxRecords: 1 })
      if (articles.length === 0) {
        noResults.push(`${c.cca3} (${c.name.common}) FIPS=${fips}`)
      }
      await new Promise((r) => setTimeout(r, 500))
    } catch (e) {
      errors.push(`${c.cca3} (${c.name.common}) FIPS=${fips} → ${(e as Error).message}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log('--- null FIPS (skipped) ---')
  console.log(nullFips.join('\n'))
  console.log('\n--- no GDELT results in 30d ---')
  console.log(noResults.join('\n'))
  console.log('\n--- errors ---')
  console.log(errors.join('\n'))
  console.log(`\nSummary: ${countries.length} total; ${nullFips.length} null; ${noResults.length} no-results; ${errors.length} errors`)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
