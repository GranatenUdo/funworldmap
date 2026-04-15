import type { PartialCountry } from '../types.js'

const CODES_XREF_URL =
  'https://raw.githubusercontent.com/factbook/factbook/master/factbook-codes/data/codesxref.csv'

const CODES_CSV_URL =
  'https://raw.githubusercontent.com/factbook/factbook/master/factbook-codes/data/codes.csv'

const FACTBOOK_BASE =
  'https://raw.githubusercontent.com/factbook/factbook.json/master'

/** Parse codesxref.csv: GEC → ISO alpha-3
 *  Header: Name,GEC,A3,A2,NUM,STANAG,INTERNET
 *  Despite the names, A2 column contains 3-letter ISO codes (e.g., AFG, DZA)
 *  and A3 column contains 2-letter ISO codes. Entries with "-" have no mapping. */
function parseCodesXref(csv: string): Map<string, string> {
  const map = new Map<string, string>()
  const lines = csv.trim().split('\n')
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const gec = cols[1]?.trim().toLowerCase()
    const iso3 = cols[3]?.trim() // A2 column = ISO alpha-3 (counterintuitively)
    if (gec && iso3 && iso3 !== '-' && iso3.length === 3) {
      map.set(gec, iso3)
    }
  }
  return map
}

/** Normalize region name to directory format: "South Asia" → "south-asia" */
function regionToDir(region: string): string {
  return region
    .toLowerCase()
    .replace(/\s+&\s+/g, '-n-')       // "East & Southeast Asia" → "east-n-southeast-asia"
    .replace(/\s+/g, '-')             // spaces → hyphens
    .replace(/[^a-z0-9-]/g, '')       // remove other chars
}

/** Parse codes.csv: GEC → region directory name */
function parseCodesRegion(csv: string): Map<string, string> {
  const map = new Map<string, string>()
  const lines = csv.trim().split('\n')
  // Header: Code,Name,Category,Region
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const gec = cols[0]?.trim().toLowerCase()
    const region = cols[3]?.trim()
    if (gec && region) {
      map.set(gec, regionToDir(region))
    }
  }
  return map
}

interface FactbookCountry {
  Government?: {
    'Government type'?: {
      text?: string
    }
  }
}

export async function fetchCiaFactbook(): Promise<PartialCountry[]> {
  console.log('Fetching CIA Factbook data...')

  // Fetch both mapping CSVs in parallel
  const [xrefResp, codesResp] = await Promise.all([
    fetch(CODES_XREF_URL),
    fetch(CODES_CSV_URL),
  ])
  if (!xrefResp.ok) throw new Error(`Failed to fetch codesxref.csv: ${xrefResp.status}`)
  if (!codesResp.ok) throw new Error(`Failed to fetch codes.csv: ${codesResp.status}`)

  const gecToIso = parseCodesXref(await xrefResp.text())
  const gecToRegion = parseCodesRegion(await codesResp.text())

  console.log(`  Code mappings: ${gecToIso.size} GEC→ISO, ${gecToRegion.size} GEC→region`)

  // Build fetch list: only countries that have both ISO mapping and region
  const fetchList: Array<{ gec: string; iso3: string; region: string }> = []
  for (const [gec, iso3] of gecToIso) {
    const region = gecToRegion.get(gec)
    if (region) {
      fetchList.push({ gec, iso3, region })
    }
  }

  console.log(`  Fetching government types for ${fetchList.length} countries...`)

  // Fetch in batches of 20 to avoid overwhelming the server
  const results: PartialCountry[] = []
  const BATCH_SIZE = 20

  for (let i = 0; i < fetchList.length; i += BATCH_SIZE) {
    const batch = fetchList.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async ({ gec, iso3, region }) => {
        const url = `${FACTBOOK_BASE}/${region}/${gec}.json`
        const resp = await fetch(url)
        if (!resp.ok) return null

        const data: FactbookCountry = await resp.json()
        const govType = data?.Government?.['Government type']?.text
        if (govType) {
          return { cca3: iso3, governmentType: govType } satisfies PartialCountry
        }
        return null
      }),
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }

    if (i + BATCH_SIZE < fetchList.length) {
      process.stdout.write(`\r  Progress: ${Math.min(i + BATCH_SIZE, fetchList.length)}/${fetchList.length}`)
    }
  }

  console.log(`\n  Extracted ${results.length} government types`)
  return results
}
