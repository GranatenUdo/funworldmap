import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CountryData, CountriesFile } from '../../lib/types'
import type { ComponentType } from 'react'
import {
  makeCountry,
  sources,
  stubMatchMedia,
  stubGetAnimations,
} from './singleCountryPanelTestUtils'

// Dynamically loaded after matchMedia is stubbed.
let SingleCountryPanel: ComponentType<{
  country: CountryData
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  onCancelCompare: () => void
  byCca3: Map<string, CountryData>
  inGameRound?: boolean
}>

describe('SingleCountryPanel — focus management on mount', () => {
  beforeAll(async () => {
    stubMatchMedia()
    const mod = await import('../SingleCountryPanel')
    SingleCountryPanel = mod.SingleCountryPanel as typeof SingleCountryPanel
  })

  let restore: () => void

  beforeEach(() => {
    // Same pattern as SingleCountryPanel.test.tsx:117-118
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
    // jsdom doesn't implement getAnimations; stub it so the animation-state
    // effect doesn't throw when the rAF fires. Mirror the manual-assignment
    // pattern used in SingleCountryPanel.test.tsx (vi.spyOn rejects absent props).
    ;({ restore } = stubGetAnimations())
  })

  afterEach(() => {
    restore()
    vi.useRealTimers()
  })

  const baseProps = {
    country: makeCountry({
      flag: 'flags/FR.svg',
      flagAlt: 'Flag of France',
      borders: ['ESP', 'ITA'],
      population: 67391582,
      area: 551695,
      governmentType: 'semi-presidential republic',
    }),
    comparePickingMode: false,
    sources,
    isDesktop: true,
    onSelect: () => {},
    onClose: () => {},
    onEnterCompare: () => {},
    onCancelCompare: () => {},
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
