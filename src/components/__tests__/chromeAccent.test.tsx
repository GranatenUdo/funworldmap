import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BorderChip } from '../BorderChip'
import { CountryColumn } from '../CountryColumn'
import { makeCountry } from './singleCountryPanelTestUtils'

import SearchBar from '../SearchBar'
import { makeCountryData } from '../../test/countryFixtures'
import { stubMatchMedia } from '../../test/matchMediaStub'

/** E4 two-accent migration drift alarm: chrome accents are the ice family;
 *  teal is retired from chrome (it survives ONLY in the Oceania region-badge
 *  data encodings, which render via REGION_BADGE/REGION_COLORS maps, not
 *  these components' accent classes). E2: CompareField values render in the
 *  .text-readout face. */
describe('E4 ice chrome + E2 readout drift alarm', () => {
  let restoreMatchMedia: () => void

  afterEach(() => {
    restoreMatchMedia?.()
  })

  it('BorderChip buttons use ice-family classes, no teal', () => {
    render(
      <BorderChip
        code="DZA"
        neighbor={makeCountry({ cca3: 'DZA', name: { common: 'Algeria', official: 'Algeria' } })}
        onSelect={vi.fn()}
        size="panel"
      />,
    )
    const cls = screen.getByRole('button', { name: 'Algeria' }).className
    expect(cls).toContain('text-ice-accessible')
    expect(cls).toContain('dark:text-ice')
    expect(cls).not.toMatch(/teal/)
  })

  it('CompareField labels are ice and values use .text-readout (E2)', () => {
    render(
      <CountryColumn
        country={makeCountry()}
        byCca3={new Map()}
        onSelect={vi.fn()}
        badgeLetter="A"
        badgeColor="a"
      />,
    )
    const label = screen.getByText('Population')
    expect(label.className).toContain('text-ice-accessible')
    expect(label.className).toContain('dark:text-ice')
    expect(label.className).not.toMatch(/teal/)
    // makeCountry defaults population to 67_000_000 (France fixture)
    const value = screen.getByText('67,000,000')
    expect(value.className).toContain('text-readout')
  })

  it('SearchBar input has focus ring width + ice color (WCAG 2.4.7)', () => {
    restoreMatchMedia = stubMatchMedia(() => false)
    render(<SearchBar countries={[makeCountryData()]} onSelect={vi.fn()} />)
    const input = screen.getByRole('combobox')
    expect(input.className).toContain('focus-visible:ring-2')
    expect(input.className).toContain('focus-visible:ring-ice-dim/40')
  })
})
