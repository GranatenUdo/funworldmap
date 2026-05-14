import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

interface Budgets {
  version: 1
  budgets: {
    'main-js-gzip': number
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

function classifyAsset(name: string): 'css' | 'async-countries' | 'other' {
  if (name.startsWith('countries-') && name.endsWith('.js')) return 'async-countries'
  if (/^index-.*\.css$/.test(name)) return 'css'
  return 'other'
}

const files = readdirSync(distAssets)
let mainJsBytes = 0
let sentryStubBytes = 0
let cssBytes = 0
let asyncCountriesBytes = 0

// Two passes: first identify the main JS chunk (largest index-*.js), then size others.
const candidates = files
  .filter((f) => f.startsWith('index-') && f.endsWith('.js'))
  .map((f) => ({ f, size: statSync(join(distAssets, f)).size }))
  .sort((a, b) => b.size - a.size)
if (candidates.length === 0) {
  console.error('No main JS chunk found in dist/assets/')
  process.exit(1)
}
mainJsBytes = gzipSize(join(distAssets, candidates[0].f))
if (candidates.length > 1) {
  sentryStubBytes = gzipSize(join(distAssets, candidates[1].f))
}

for (const f of files) {
  const kind = classifyAsset(f)
  if (kind === 'css') cssBytes += gzipSize(join(distAssets, f))
  if (kind === 'async-countries') asyncCountriesBytes += gzipSize(join(distAssets, f))
}

const initialTotal = mainJsBytes + cssBytes + sentryStubBytes
const totalWithAsync = initialTotal + asyncCountriesBytes

interface Check {
  name: string
  measured: number
  budget: number
}

const checks: Check[] = [
  { name: 'main-js-gzip', measured: mainJsBytes, budget: budgets.budgets['main-js-gzip'] },
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

if (failed) {
  console.error('\nBundle exceeded budget. To update intentionally, raise budgets in scripts/bundle-budget/budgets.json with measurement evidence in the commit message.')
  process.exit(1)
}
console.log('\nAll budgets ok.')
