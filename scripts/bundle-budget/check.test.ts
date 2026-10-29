import { it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'

it('charges the separately emitted MapLibre worker to initial JavaScript and total budgets', () => {
  const root = mkdtempSync(join(tmpdir(), 'funworldmap-budget-'))
  try {
    mkdirSync(join(root, 'dist/assets'), { recursive: true })
    mkdirSync(join(root, 'scripts/bundle-budget'), { recursive: true })
    const main = 'console.log("main")'
    const worker = 'console.log("worker")'
    writeFileSync(join(root, 'dist/assets/index-test.js'), main)
    writeFileSync(join(root, 'dist/assets/maplibre-gl-worker-test.js'), worker)
    writeFileSync(
      join(root, 'scripts/bundle-budget/budgets.json'),
      JSON.stringify({
        version: 1,
        budgets: {
          'main-js-gzip': gzipSync(main).length,
          'lazy-js-gzip': 1000,
          'css-gzip': 1000,
          'async-countries-gzip': 1000,
          'initial-total-gzip': 1000,
          'total-with-async-gzip': 1000,
        },
      }),
    )
    const require = createRequire(import.meta.url)
    const result = spawnSync(
      process.execPath,
      [require.resolve('tsx/cli'), resolve('scripts/bundle-budget/check.ts')],
      { cwd: root, encoding: 'utf8' },
    )
    const output = result.stdout + result.stderr
    expect(result.status).toBe(1)
    expect(output).not.toContain('not accounted for')
    const total = gzipSync(main).length + gzipSync(worker).length
    for (const row of ['main-js-gzip', 'initial-total-gzip', 'total-with-async-gzip']) {
      expect(output).toMatch(new RegExp(row + '\\s+' + total + '\\s+/'))
    }
    expect(output).toMatch(/FAIL\s+main-js-gzip/)
  } finally {
    if (root.startsWith(join(tmpdir(), 'funworldmap-budget-'))) {
      rmSync(root, { recursive: true, force: true })
    }
  }
})
