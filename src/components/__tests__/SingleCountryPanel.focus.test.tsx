import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { CountryData, CountriesFile } from '../../lib/types'
import type { ComponentType } from 'react'

// jsdom does not implement matchMedia; SourceTooltip touches it at module
// evaluation time. Stub it before SingleCountryPanel is dynamically imported.
function stubMatchMedia(): void {
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

const country = {
  ccn3: '250',
  cca3: 'FRA',
  cca2: 'FR',
  name: { common: 'France', official: 'French Republic' },
  flag: 'flags/FR.svg',
  flagAlt: 'Flag of France',
  capital: ['Paris'],
  region: 'Europe',
  subregion: 'Western Europe',
  latlng: [46, 2],
  area: 551695,
  population: 67391582,
  borders: ['ESP', 'ITA'],
  independent: true,
  unMember: true,
  landlocked: false,
  languages: { fra: 'French' },
  currencies: { EUR: { name: 'Euro', symbol: '€' } },
  timezones: ['UTC+01:00'],
  continents: ['Europe'],
  governmentType: 'semi-presidential republic',
  _fieldSources: {},
} as CountryData

const sources: CountriesFile['_sources'] = {
  restcountries: {
    name: 'REST Countries',
    url: 'https://restcountries.com',
    description: 'Country reference data',
    lastUpdated: '2026-01-01',
  },
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

describe('SingleCountryPanel — focus management on mount', () => {
  beforeAll(async () => {
    stubMatchMedia()
    const mod = await import('../SingleCountryPanel')
    SingleCountryPanel = mod.SingleCountryPanel as typeof SingleCountryPanel
  })

  let originalGetAnimations: typeof Element.prototype.getAnimations | undefined

  beforeEach(() => {
    // Same pattern as SingleCountryPanel.test.tsx:117-118
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
    // jsdom doesn't implement getAnimations; stub it so the animation-state
    // effect doesn't throw when the rAF fires. Mirror the manual-assignment
    // pattern used in SingleCountryPanel.test.tsx (vi.spyOn rejects absent props).
    originalGetAnimations = Element.prototype.getAnimations
    Element.prototype.getAnimations = vi.fn().mockReturnValue([])
  })

  afterEach(() => {
    if (originalGetAnimations) {
      Element.prototype.getAnimations = originalGetAnimations
    } else {
      delete (Element.prototype as { getAnimations?: unknown }).getAnimations
    }
    vi.useRealTimers()
    cleanup()
  })

  const baseProps = {
    country,
    comparePickingMode: false,
    sources,
    isDesktop: true,
    onSelect: () => {},
    onClose: () => {},
    onEnterCompare: () => {},
    byCca3: new Map(),
  } as const

  it('moves focus to the country-name heading on mount', () => {
    render(<SingleCountryPanel {...baseProps} />)
    // Flush the rAF that defers the focus call.
    vi.advanceTimersByTime(50)
    const heading = screen.getByRole('heading', { name: 'France', level: 2 })
    expect(document.activeElement).toBe(heading)
  })

  it('heading has tabIndex=-1 so it can be programmatically focused without joining the tab order', () => {
    render(<SingleCountryPanel {...baseProps} />)
    const heading = screen.getByRole('heading', { name: 'France', level: 2 })
    expect(heading.getAttribute('tabIndex')).toBe('-1')
  })
})
