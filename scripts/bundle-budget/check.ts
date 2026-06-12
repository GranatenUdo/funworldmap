import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_KEYS = [
  'main-js-gzip',
  'lazy-js-gzip',
  'css-gzip',
  'async-countries-gzip',
  'initial-total-gzip',
  'total-with-async-gzip',
] as const

type BudgetKey = (typeof BUDGET_KEYS)[number]

interface Budgets {
  version: 1
  budgets: Record<BudgetKey, number>
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
const mainJsBytes = gzipSize(join(distAssets, indexJs[0].f))
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
  } else if (f.startsWith('src-') && f.endsWith('.js')) {
    // Rolldown (Vite 8) names a dynamically-imported split chunk after its
    // source path, e.g. `src-*.js` for the lazy topojson-client chunk that
    // Rollup emitted as a second `index-*.js`. It's pulled in via dynamic
    // import (not referenced by index.html), so it counts as lazy-js, not
    // first-paint — same role the topojson chunk always had.
    lazyJsBytes += gzipSize(full)
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

const measurements: Record<BudgetKey, number> = {
  'main-js-gzip': mainJsBytes,
  'lazy-js-gzip': lazyJsBytes,
  'css-gzip': cssBytes,
  'async-countries-gzip': asyncCountriesBytes,
  'initial-total-gzip': initialTotal,
  'total-with-async-gzip': totalWithAsync,
}

const checks: Check[] = BUDGET_KEYS.map((name) => ({
  name,
  measured: measurements[name],
  budget: budgets.budgets[name],
}))

let failed = false
for (const c of checks) {
  const pct = ((c.measured / c.budget) * 100).toFixed(1)
  const status = c.measured > c.budget ? 'FAIL' : 'ok'
  if (c.measured > c.budget) failed = true
  console.log(
    `${status.padEnd(4)}  ${c.name.padEnd(28)}  ${c.measured.toString().padStart(7)}  /  ${c.budget.toString().padStart(7)} bytes  (${pct}%)`,
  )
}

// Fail closed on unaccounted assets so a future Vite chunk-split can't
// silently bypass the budget.
if (unaccounted.length > 0) {
  console.error(
    `\nFAIL: ${unaccounted.length} asset(s) in dist/assets/ not accounted for in any budget category:`,
  )
  for (const f of unaccounted) {
    const bytes = gzipSize(join(distAssets, f))
    console.error(`  ${f}  (${bytes} bytes gzip)`)
  }
  console.error(
    '\nAdd a new budget category (and classifier rule) in scripts/bundle-budget/check.ts and scripts/bundle-budget/budgets.json, or rename/remove the unexpected asset.',
  )
  failed = true
}

if (failed) {
  console.error(
    '\nBundle exceeded budget. To update intentionally, raise budgets in scripts/bundle-budget/budgets.json with measurement evidence in the commit message.',
  )
  process.exit(1)
}
console.log('\nAll budgets ok.')
