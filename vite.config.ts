/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Strips the Cloudflare RUM beacon script from index.html in dev mode.
 * The beacon's POSTs to cloudflareinsights.com fail CORS on localhost and
 * provide no value in dev — only load it on production builds.
 */
const cfBeaconProdOnly = {
  name: 'cf-beacon-prod-only',
  transformIndexHtml(html: string, ctx: { server?: unknown }) {
    // ctx.server is defined during `vite dev`; absent during `vite build`
    if (ctx.server === undefined) return html
    return html.replace(
      /\n?\s*<script\b[^>]*cloudflareinsights\.com\/beacon\.min\.js[^>]*>[\s\S]*?<\/script>/,
      '',
    )
  },
}

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    cfBeaconProdOnly,
  ],
  build: {
    chunkSizeWarningLimit: 1700, // MapLibre GL is ~1.6MB unminified, not tree-shakeable
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['e2e/**', '**/node_modules/**', 'dist/**', '.worktrees/**'],
  },
})
