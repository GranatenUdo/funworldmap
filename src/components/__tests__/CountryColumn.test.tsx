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
    // selection and closes the whole compare panel. It shows the resolved
    // name, not the raw code.
    expect(screen.queryByRole('button', { name: 'ESH' })).toBeNull()
    expect(screen.getByText('Western Sahara')).toBeTruthy()
  })
})

describe('CountryColumn borders show every neighbour (A9)', () => {
  it('renders a chip for every border with no inert "+N" overflow suffix', () => {
    const neighbours = [
      ['AUT', '040', 'Austria'],
      ['BEL', '056', 'Belgium'],
      ['CZE', '203', 'Czechia'],
      ['DNK', '208', 'Denmark'],
      ['FRA', '250', 'France'],
      ['LUX', '442', 'Luxembourg'],
      ['NLD', '528', 'Netherlands'],
      ['POL', '616', 'Poland'],
    ] as const
    const byCca3 = new Map(
      neighbours.map(([cca3, ccn3, common]) => [
        cca3,
        makeCountry({ cca3, ccn3, name: { common, official: common } }),
      ]),
    )
    const germany = makeCountry({
      cca3: 'DEU',
      ccn3: '276',
      name: { common: 'Germany', official: 'Federal Republic of Germany' },
      borders: neighbours.map(([cca3]) => cca3),
    })
    render(
      <CountryColumn
        country={germany}
        byCca3={byCca3}
        onSelect={vi.fn()}
        onClose={() => {}}
        badgeLetter="A"
        badgeColor="a"
        showColumnClose={false}
      />,
    )
    // 8 borders — the old code sliced to 6 chips and rendered an inert "+2".
    for (const [, , common] of neighbours) {
      expect(screen.getByRole('button', { name: common })).toBeTruthy()
    }
    expect(screen.queryByText('+2')).toBeNull()
  })
})
