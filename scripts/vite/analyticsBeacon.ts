import type { Plugin } from 'vite'

/** Build-only telemetry, serialized by Vite rather than HTML string substitution. */
export function analyticsBeacon(command: 'build' | 'serve', token?: string): Plugin {
  return {
    name: 'production-analytics-beacon',
    transformIndexHtml() {
      if (command !== 'build' || !token?.trim()) return []
      return [
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': JSON.stringify({ token }),
          },
          injectTo: 'head',
        },
      ]
    },
  }
}
