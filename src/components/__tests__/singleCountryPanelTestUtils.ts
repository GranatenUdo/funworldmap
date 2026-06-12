/**
 * Shared test fixtures and helpers for SingleCountryPanel tests.
 *
 * Extracted from SingleCountryPanel.test.tsx and SingleCountryPanel.focus.test.tsx
 * to avoid duplicating the country factory, sources constant, matchMedia stub,
 * and getAnimations patch across sibling files.
 */
import { vi } from 'vitest'
import type { CountriesFile } from '../../lib/types'
import { makeCountryData } from '../../test/countryFixtures'
import { stubMatchMedia as _stubMatchMedia } from '../../test/matchMediaStub'

// ---------------------------------------------------------------------------
// Country fixture factory
// ---------------------------------------------------------------------------

export { makeCountryData as makeCountry }

// ---------------------------------------------------------------------------
// Sources constant
// ---------------------------------------------------------------------------

export const sources: CountriesFile['_sources'] = {
  restcountries: {
    name: 'REST Countries',
    url: 'https://restcountries.com',
    description: 'Country reference data',
    lastUpdated: '2026-01-01',
  },
}

// ---------------------------------------------------------------------------
// matchMedia stub
// ---------------------------------------------------------------------------

/**
 * jsdom does not implement matchMedia; SourceTooltip touches it at module
 * evaluation time. Stub it before SingleCountryPanel is dynamically imported.
 */
export function stubMatchMedia(): void {
  // Only install if not already present — this is called in beforeAll, which
  // runs once per describe block; subsequent calls are no-ops.
  if ((window as unknown as { matchMedia?: unknown }).matchMedia) return
  _stubMatchMedia()
}

// ---------------------------------------------------------------------------
// Element.prototype.getAnimations stub
// ---------------------------------------------------------------------------

/**
 * jsdom doesn't implement getAnimations. Stub it so the animation-state effect
 * doesn't throw when the rAF fires.
 *
 * vi.spyOn rejects absent properties, so we use direct assignment (matching the
 * manual-assignment pattern in the original tests).
 *
 * Returns a `restore` function — call it in afterEach to undo the patch.
 */
export function stubGetAnimations(): { restore: () => void } {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- WHY: we are intentionally capturing the prototype method to restore it later; we never call it via the captured ref, so `this`-rebinding is irrelevant.
  const original = Element.prototype.getAnimations
  Element.prototype.getAnimations = vi.fn().mockReturnValue([])
  return {
    restore() {
      if (original) {
        Element.prototype.getAnimations = original
      } else {
        delete (Element.prototype as { getAnimations?: unknown }).getAnimations
      }
    },
  }
}
