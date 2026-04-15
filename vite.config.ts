/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/polworldmap/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1700, // MapLibre GL is ~1.6MB unminified, not tree-shakeable
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
