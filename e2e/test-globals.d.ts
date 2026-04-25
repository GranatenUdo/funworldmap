// Augment window with the test seams the app exposes for Playwright. Avoids
// repeating `(window as unknown as { __funworldmap_game?: ... }).__funworldmap_game`
// in every spec.

import type maplibregl from 'maplibre-gl'
import type { GuessInput } from '../src/game/shared/types'

declare global {
  interface Window {
    __funworldmap_map?: maplibregl.Map
    __funworldmap_game?: {
      submitGuess?: (input: GuessInput) => void
      submitCountryGuess?: (cca3: string) => boolean
      setRound?: (id: string) => boolean
      getSession?: () => { currentAttempts: unknown[] }
    }
    /** Test-only counter used by e2e/mobile-tap.spec.ts. */
    __mapClickCount?: number
  }
}

export {}
