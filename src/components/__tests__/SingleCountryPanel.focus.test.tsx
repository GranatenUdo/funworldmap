import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { makeCountry, sources, stubGetAnimations } from './singleCountryPanelTestUtils'
import { SingleCountryPanel } from '../SingleCountryPanel'

describe('SingleCountryPanel — focus management on mount', () => {
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
