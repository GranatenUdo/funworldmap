/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import { analyticsBeacon } from './scripts/vite/analyticsBeacon'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => ({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    analyticsBeacon(command, loadEnv(mode, '.', 'VITE_').VITE_CF_WA_TOKEN),
  ],
  build: {
    chunkSizeWarningLimit: 1700, // MapLibre GL is ~1.6MB unminified, not tree-shakeable
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // .claude/** covers agent worktrees (.claude/worktrees/<name>/e2e/*.spec.ts
    // would otherwise be swept in as vitest files and fail on Playwright APIs).
    exclude: [
      '.superpowers/**',
      'e2e/**',
      '**/node_modules/**',
      'dist/**',
      '.worktrees/**',
      '.claude/**',
    ],
    css: { include: [/index\.css/] },
  },
}))
