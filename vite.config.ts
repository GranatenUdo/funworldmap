/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1700, // MapLibre GL is ~1.6MB unminified, not tree-shakeable
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['e2e/**', '**/node_modules/**', 'dist/**'],
  },
})
