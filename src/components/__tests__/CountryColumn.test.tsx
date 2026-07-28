import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountryColumn } from '../CountryColumn'
import { makeCountry } from './singleCountryPanelTestUtils'
import { COMPARE_FIELDS } from '../../lib/compareFields'

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
        badgeLetter="A"
        badgeColor="a"
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
        badgeLetter="A"
        badgeColor="a"
      />,
    )
    // 8 borders — the old code sliced to 6 chips and rendered an inert "+2".
    for (const [, , common] of neighbours) {
      expect(screen.getByRole('button', { name: common })).toBeTruthy()
    }
    expect(screen.queryByText('+2')).toBeNull()
  })
})

function renderColumn(country: ReturnType<typeof makeCountry>) {
  render(
    <CountryColumn
      country={country}
      byCca3={new Map()}
      onSelect={vi.fn()}
      badgeLetter="A"
      badgeColor="a"
    />,
  )
}

describe('CountryColumn — C1 shared field list', () => {
  it('renders every COMPARE_FIELDS row, with em-dash placeholders for missing values', () => {
    renderColumn(makeCountry({ governmentType: '', languages: {}, currencies: {}, timezones: [] }))
    for (const f of COMPARE_FIELDS) expect(screen.getByText(f.label)).toBeTruthy()
    // Government, Languages, Currencies, Timezones are missing on this fixture.
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('restores Timezones as a real row and drops the UN Member row', () => {
    renderColumn(makeCountry())
    expect(screen.getByText('Timezones')).toBeTruthy()
    expect(screen.getByText('UTC+01:00')).toBeTruthy()
    expect(screen.queryByText('UN Member')).toBeNull()
  })

  it('joins ALL capitals in the header caption', () => {
    renderColumn(makeCountry({ capital: ['Pretoria', 'Bloemfontein', 'Cape Town'] }))
    expect(screen.getByText('Pretoria, Bloemfontein, Cape Town')).toBeTruthy()
  })

  it('renders A5 exception badges in the header only when the flags are false', () => {
    renderColumn(makeCountry({ unMember: false, independent: false }))
    expect(screen.getByTestId('exception-badge-un-member').textContent).toBe('UN observer state')
    expect(screen.getByTestId('exception-badge-independent').textContent).toBe('Not independent')
  })

  it('renders no exception badges for a default (UN member, independent) country', () => {
    renderColumn(makeCountry())
    expect(screen.queryByTestId('exception-badge-un-member')).toBeNull()
    expect(screen.queryByTestId('exception-badge-independent')).toBeNull()
  })
})
