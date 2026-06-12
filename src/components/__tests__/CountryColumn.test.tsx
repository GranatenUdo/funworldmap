import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountryColumn } from '../CountryColumn'
import { makeCountry } from './singleCountryPanelTestUtils'

describe('CountryColumn border chips', () => {
  it('renders unmatched border codes as inert text, not buttons', () => {
    const morocco = makeCountry({
      cca3: 'MAR',
      ccn3: '504',
      name: { common: 'Morocco', official: 'Kingdom of Morocco' },
      borders: ['DZA', 'ESH', 'ESP'],
    })
    const algeria = makeCountry({
      cca3: 'DZA',
      ccn3: '012',
      name: { common: 'Algeria', official: "People's Democratic Republic of Algeria" },
    })
    const spain = makeCountry({
      cca3: 'ESP',
      ccn3: '724',
      name: { common: 'Spain', official: 'Kingdom of Spain' },
    })
    const byCca3 = new Map([
      ['DZA', algeria],
      ['ESP', spain],
    ])
    render(
      <CountryColumn
        country={morocco}
        byCca3={byCca3}
        onSelect={vi.fn()}
        onClose={() => {}}
        badgeLetter="A"
        badgeColor="a"
        showColumnClose={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'Algeria' })).toBeTruthy()
    // ESH (Western Sahara) is not in the canonical 195 — it must not be
    // clickable: selecting it writes an unresolvable hash, which clears the
    // selection and closes the whole compare panel.
    expect(screen.queryByRole('button', { name: 'ESH' })).toBeNull()
    expect(screen.getByText('ESH')).toBeTruthy()
  })
})
