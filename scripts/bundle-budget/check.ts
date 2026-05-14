import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

interface Budgets {
  version: 1
  budgets: {
    'main-js-gzip': number
    'lazy-js-gzip': number
    'css-gzip': number
    'async-countries-gzip': number
    'initial-total-gzip': number
    'total-with-async-gzip': number
  }
}

const root = process.cwd()
const distAssets = join(root, 'dist', 'assets')
const budgetsPath = join(root, 'scripts', 'bundle-budget', 'budgets.json')

const budgets = JSON.parse(readFileSync(budgetsPath, 'utf-8')) as Budgets

function gzipSize(path: string): number {
  return gzipSync(readFileSync(path)).length
}

const files = readdirSync(distAssets)

// Classify each file into a bucket. Track which files are accounted for so we
// can fail closed on unrecognised additions (e.g. Vite emits a new chunk type).
const accounted = new Set<string>()

let mainJsBytes = 0
let lazyJsBytes = 0
let cssBytes = 0
let asyncCountriesBytes = 0

// Identify the main JS chunk: the largest `index-*.js`. The rest of the
// `index-*.js` files are lazy-loaded chunks (today topojson-client, tomorrow
// possibly React.lazy boundaries). They don't block first paint but they DO
// count toward total bandwidth.
const indexJs = files
  .filter((f) => f.startsWith('index-') && f.endsWith('.js'))
  .map((f) => ({ f, size: statSync(join(distAssets, f)).size }))
  .sort((a, b) => b.size - a.size)
if (indexJs.length === 0) {
  console.error('No main JS chunk found in dist/assets/')
  process.exit(1)
}
mainJsBytes = gzipSize(join(distAssets, indexJs[0].f))
accounted.add(indexJs[0].f)
for (let i = 1; i < indexJs.length; i++) {
  lazyJsBytes += gzipSize(join(distAssets, indexJs[i].f))
  accounted.add(indexJs[i].f)
}

for (const f of files) {
  if (accounted.has(f)) continue
  const full = join(distAssets, f)
  if (/^index-.*\.css$/.test(f)) {
    cssBytes += gzipSize(full)
    accounted.add(f)
  } else if (f.startsWith('countries-') && f.endsWith('.js')) {
    asyncCountriesBytes += gzipSize(full)
    accounted.add(f)
  }
}

const unaccounted = files.filter((f) => !accounted.has(f))

const initialTotal = mainJsBytes + cssBytes
const totalWithAsync = initialTotal + asyncCountriesBytes + lazyJsBytes

interface Check {
  name: string
  measured: number
  budget: number
}

const checks: Check[] = [
  { name: 'main-js-gzip', measured: mainJsBytes, budget: budgets.budgets['main-js-gzip'] },
  { name: 'lazy-js-gzip', measured: lazyJsBytes, budget: budgets.budgets['lazy-js-gzip'] },
  { name: 'css-gzip', measured: cssBytes, budget: budgets.budgets['css-gzip'] },
  { name: 'async-countries-gzip', measured: asyncCountriesBytes, budget: budgets.budgets['async-countries-gzip'] },
  { name: 'initial-total-gzip', measured: initialTotal, budget: budgets.budgets['initial-total-gzip'] },
  { name: 'total-with-async-gzip', measured: totalWithAsync, budget: budgets.budgets['total-with-async-gzip'] },
]

let failed = false
for (const c of checks) {
  const pct = ((c.measured / c.budget) * 100).toFixed(1)
  const status = c.measured > c.budget ? 'FAIL' : 'ok'
  if (c.measured > c.budget) failed = true
  console.log(`${status.padEnd(4)}  ${c.name.padEnd(28)}  ${c.measured.toString().padStart(7)}  /  ${c.budget.toString().padStart(7)} bytes  (${pct}%)`)
}

// Fail closed on unaccounted assets so a future Vite chunk-split can't
// silently bypass the budget.
if (unaccounted.length > 0) {
  console.error(`\nFAIL: ${unaccounted.length} asset(s) in dist/assets/ not accounted for in any budget category:`)
  for (const f of unaccounted) {
    const bytes = gzipSize(join(distAssets, f))
    console.error(`  ${f}  (${bytes} bytes gzip)`)
  }
  console.error('\nAdd a new budget category (and classifier rule) in scripts/bundle-budget/check.ts and scripts/bundle-budget/budgets.json, or rename/remove the unexpected asset.')
  failed = true
}

if (failed) {
  console.error('\nBundle exceeded budget. To update intentionally, raise budgets in scripts/bundle-budget/budgets.json with measurement evidence in the commit message.')
  process.exit(1)
}
console.log('\nAll budgets ok.')
