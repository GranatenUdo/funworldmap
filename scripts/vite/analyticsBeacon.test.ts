import { describe, it, expect } from 'vitest'
import { build } from 'vite'
import { resolve } from 'node:path'
import { analyticsBeacon } from './analyticsBeacon'

async function outputHtml(command: 'build' | 'serve', token?: string) {
  const result = await build({
    configFile: false,
    root: resolve('scripts/vite/fixtures'),
    plugins: [analyticsBeacon(command, token)],
    logLevel: 'silent',
    build: { write: false, minify: false },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  if (!('output' in bundle)) throw new Error('Expected build output')
  const html = bundle.output.find((file) => file.fileName === 'index.html')
  if (!html || html.type !== 'asset') throw new Error('Missing HTML output')
  return new DOMParser().parseFromString(String(html.source), 'text/html')
}

describe('production-only analytics beacon', () => {
  it.each([
    ['serve', 'configured'],
    ['build', undefined],
    ['build', ''],
    ['build', '   '],
  ] as const)('does not emit a beacon for %s with token %s', async (command, token) => {
    const document = await outputHtml(command, token)
    expect(document.querySelectorAll('script')).toHaveLength(0)
  })
  it('round-trips special characters through Vite HTML attribute escaping', async () => {
    const token = `a"'&<script id="injected">bad()</script>`
    const document = await outputHtml('build', token)
    const scripts = document.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://static.cloudflareinsights.com/beacon.min.js')
    expect(scripts[0].hasAttribute('defer')).toBe(true)
    expect(JSON.parse(scripts[0].getAttribute('data-cf-beacon')!)).toEqual({ token })
    expect(document.getElementById('injected')).toBeNull()
  })
})
