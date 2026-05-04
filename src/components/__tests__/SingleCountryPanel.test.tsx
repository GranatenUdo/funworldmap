/**
 * Animation-state lifecycle tests for SingleCountryPanel.
 *
 * Pins the contract documented in docs/superpowers/notes/2026-05-04-bug-31-diagnosis.md:
 * `data-animation-state` MUST flip from 'entering' → 'idle' once entrance
 * animations finish, with a 1s setTimeout fallback covering CI cases where
 * Element.getAnimations() doesn't observe className animations or the
 * `.finished` promises don't resolve.
 *
 * All timers are faked (toFake: setTimeout, requestAnimationFrame, etc.) so
 * the test cannot depend on wallclock pacing — required by the standing
 * "no flaky tests" rule.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import type { CountryData, CountriesFile } from '../../lib/types'
import type { ComponentType } from 'react'

// jsdom does not implement matchMedia; SourceTooltip touches it at module
// evaluation time. Stub it before SingleCountryPanel is dynamically imported.
function stubMatchMedia(): void {
  // jsdom currently has no matchMedia; the property is undefined. Cast through
  // unknown to dodge TS 2774 ("function always defined") for the standard lib
  // declaration which marks matchMedia as required.
  if ((window as unknown as { matchMedia?: unknown }).matchMedia) return
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

const sources: CountriesFile['_sources'] = {
  restcountries: {
    name: 'REST Countries',
    url: 'https://restcountries.com',
    description: 'Country reference data',
    lastUpdated: '2026-01-01',
  },
}

function makeCountry(overrides: Partial<CountryData> = {}): CountryData {
  return {
    cca3: 'FRA',
    ccn3: '250',
    cca2: 'FR',
    name: { common: 'France', official: 'French Republic' },
    capital: ['Paris'],
    region: 'Europe',
    subregion: 'Western Europe',
    population: 67_000_000,
    area: 551_695,
    governmentType: 'Republic',
    languages: { fra: 'French' },
    currencies: { EUR: { name: 'Euro', symbol: '€' } },
    flag: '',
    flagAlt: '',
    latlng: [46, 2],
    borders: [],
    independent: true,
    unMember: true,
    landlocked: false,
    timezones: ['UTC+01:00'],
    continents: ['Europe'],
    _fieldSources: {},
    ...overrides,
  } as CountryData
}

// Dynamically loaded after matchMedia is stubbed.
let SingleCountryPanel: ComponentType<{
  country: CountryData
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  byCca3: Map<string, CountryData>
  inGameRound?: boolean
}>

function renderPanel() {
  return render(
    <SingleCountryPanel
      country={makeCountry()}
      comparePickingMode={false}
      sources={sources}
      isDesktop={true}
      onSelect={() => {}}
      onClose={() => {}}
      onEnterCompare={() => {}}
      byCca3={new Map()}
    />,
  )
}

describe('SingleCountryPanel — data-animation-state lifecycle', () => {
  beforeAll(async () => {
    stubMatchMedia()
    const mod = await import('../SingleCountryPanel')
    SingleCountryPanel = mod.SingleCountryPanel as typeof SingleCountryPanel
  })

  // Note: not faking microtasks (queueMicrotask, Promise) — Promise.then() is
  // not a timer and is driven by act() naturally.
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
    // Mock fetch for CountryNewsSection so the panel renders cleanly.
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts as "entering" before any timer fires', () => {
    const original = Element.prototype.getAnimations
    Element.prototype.getAnimations = vi.fn().mockReturnValue([])
    try {
      const { getByTestId } = renderPanel()
      expect(getByTestId('country-panel').getAttribute('data-animation-state')).toBe('entering')
    } finally {
      if (original) Element.prototype.getAnimations = original
      else delete (Element.prototype as { getAnimations?: unknown }).getAnimations
    }
  })

  it('flips entering → idle on the rAF tick when getAnimations() returns []', async () => {
    const original = Element.prototype.getAnimations
    Element.prototype.getAnimations = vi.fn().mockReturnValue([])
    try {
      const { getByTestId } = renderPanel()
      const root = getByTestId('country-panel')
      expect(root.getAttribute('data-animation-state')).toBe('entering')

      await act(async () => {
        vi.runAllTimers()
      })

      expect(root.getAttribute('data-animation-state')).toBe('idle')
    } finally {
      if (original) Element.prototype.getAnimations = original
      else delete (Element.prototype as { getAnimations?: unknown }).getAnimations
    }
  })

  it('flips entering → idle once all .finished promises resolve', async () => {
    const original = Element.prototype.getAnimations
    let resolveFinished!: () => void
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve
    })
    const fakeAnim = { finished } as unknown as Animation
    Element.prototype.getAnimations = vi.fn().mockReturnValue([fakeAnim])
    try {
      const { getByTestId } = renderPanel()
      const root = getByTestId('country-panel')

      // rAF callback runs and reads getAnimations(); .finished is still pending.
      await act(async () => {
        vi.advanceTimersByTime(16)
      })
      expect(root.getAttribute('data-animation-state')).toBe('entering')

      // Resolve .finished → Promise.all().then() flips to idle.
      await act(async () => {
        resolveFinished()
      })
      expect(root.getAttribute('data-animation-state')).toBe('idle')
    } finally {
      if (original) Element.prototype.getAnimations = original
      else delete (Element.prototype as { getAnimations?: unknown }).getAnimations
    }
  })

  it('flips entering → idle via the 1s fallback timer when .finished never resolves', async () => {
    const original = Element.prototype.getAnimations
    // Animation whose .finished promise never resolves — exactly the CI
    // event-loop-starvation pathology described in the bug-#31 diagnosis.
    const stuckAnim = { finished: new Promise<void>(() => {}) } as unknown as Animation
    Element.prototype.getAnimations = vi.fn().mockReturnValue([stuckAnim])
    try {
      const { getByTestId } = renderPanel()
      const root = getByTestId('country-panel')

      // rAF runs; .finished hangs.
      await act(async () => {
        vi.advanceTimersByTime(999)
      })
      expect(root.getAttribute('data-animation-state')).toBe('entering')

      // 1s fallback fires.
      await act(async () => {
        vi.advanceTimersByTime(2)
      })
      expect(root.getAttribute('data-animation-state')).toBe('idle')
    } finally {
      if (original) Element.prototype.getAnimations = original
      else delete (Element.prototype as { getAnimations?: unknown }).getAnimations
    }
  })
})
