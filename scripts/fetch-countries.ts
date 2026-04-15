import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { FeatureCollection, Geometry } from 'geojson'

const require = createRequire(import.meta.url)

import { fetchRestCountries } from './sources/rest-countries.js'
import { fetchCiaFactbook } from './sources/cia-factbook.js'
import { downloadFlags } from './sources/flags.js'
import { mergeCountries, buildCountriesFile, validateJoinIntegrity } from './merge.js'

const OUTPUT_PATH = join(process.cwd(), 'src', 'data', 'countries.json')
const DRY_RUN = process.argv.includes('--dry')

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no files written) ===' : '=== Data Collection Tool ===')
  console.log()

  // Step 1: Fetch REST Countries
  const restCountries = await fetchRestCountries()
  console.log()

  // Step 2: Fetch CIA Factbook government types
  const ciaFactbook = await fetchCiaFactbook()
  console.log()

  // Step 3: Merge sources
  console.log('Merging data sources...')
  const countries = mergeCountries(restCountries, ciaFactbook)
  const withGovType = countries.filter((c) => c.governmentType).length
  console.log(`  ${countries.length} countries merged, ${withGovType} have government type`)
  console.log()

  // Step 4: Validate against world-atlas
  console.log('Validating join integrity against world-atlas...')
  const worldAtlasPath = require.resolve('world-atlas/countries-50m.json')
  const topology: Topology = JSON.parse(readFileSync(worldAtlasPath, 'utf-8'))
  const geojson = feature(topology, topology.objects.countries) as FeatureCollection<Geometry>
  const featureIds = geojson.features
    .map((f) => String(f.id))
    .filter((id) => id && id !== 'undefined')

  const { matched, unmatched } = validateJoinIntegrity(countries, featureIds)
  console.log(`  ${matched} world-atlas features matched to metadata`)
  if (unmatched.length > 0) {
    console.log(`  ${unmatched.length} unmatched feature IDs: ${unmatched.join(', ')}`)
  }
  console.log()

  // Step 5: Build output
  const output = buildCountriesFile(countries)

  if (DRY_RUN) {
    console.log('=== DRY RUN SUMMARY ===')
    console.log(`Would write ${countries.length} countries to ${OUTPUT_PATH}`)
    if (existsSync(OUTPUT_PATH)) {
      const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
      const existingCount = existing.countries?.length ?? 0
      console.log(`Existing file has ${existingCount} countries`)
    }
    return
  }

  // Step 6: Download flags
  const cca2Codes = countries.map((c) => c.cca2)
  await downloadFlags(cca2Codes)
  console.log()

  // Step 7: Write output
  console.log(`Writing ${OUTPUT_PATH}...`)
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`  Written ${countries.length} countries`)

  console.log()
  console.log('=== Done ===')
}

main().catch((err) => {
  console.error('Data collection failed:', err)
  process.exit(1)
})
