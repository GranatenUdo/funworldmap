/**
 * Centralised augmentations for the global Window object used by the test
 * seams: __PLAYWRIGHT__ flag, __testAnalytics capture array, the
 * __funworldmap_game GameController seam, and __funworldmap_map (the raw
 * MapLibre Map instance exposed when VITE_TEST_HOOKS=1).
 *
 * Replaces 3 `declare global` blocks in test files + 3 inline `as unknown as`
 * casts (2 production + 1 test) that re-declared subsets of this shape
 * independently before centralisation (2026-05-16).
 */
export {}

declare global {
  interface Window {
    /** Enabled by Playwright + relevant Vitest tests so analytics.ts captures into __testAnalytics instead of POSTing. */
    __PLAYWRIGHT__?: boolean
    /** Analytics-event capture array used when __PLAYWRIGHT__ is true. */
    __testAnalytics?: Array<{ name: string; props: Record<string, unknown> }>
    /** GameController test seam — registered when VITE_TEST_HOOKS=1. Keys are added by useGameTestSeams. */
    __funworldmap_game?: Record<string, unknown>
    /** Raw MapLibre Map instance, exposed when VITE_TEST_HOOKS=1. */
    __funworldmap_map?: unknown
  }
}
