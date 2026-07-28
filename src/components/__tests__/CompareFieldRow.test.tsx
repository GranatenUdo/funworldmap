import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompareFieldRow } from '../CompareFieldRow'
import { COMPARE_FIELDS } from '../../lib/compareFields'
import { makeCountryData } from '../../test/countryFixtures'

function field(key: string) {
  const f = COMPARE_FIELDS.find((f) => f.key === key)
  if (!f) throw new Error(`no COMPARE_FIELDS entry '${key}'`)
  return f
}

// Deliberately non-fixture numbers so the ratios are clean: 63/50 = 1.26
// (the spec's own example phrasing), 50/63 → 79.4% bar.
const FRA = makeCountryData({ population: 50_000_000, area: 500_000 })
const DEU = makeCountryData({
  cca3: 'DEU',
  ccn3: '276',
  name: { common: 'Germany', official: 'Federal Republic of Germany' },
  population: 63_000_000,
  area: 250_000,
})

describe('CompareFieldRow — numeric rows (C2)', () => {
  it('renders paired bars width-scaled to max(A, B), values in .text-readout', () => {
    render(<CompareFieldRow field={field('population')} a={FRA} b={DEU} />)
    expect(screen.getByTestId('compare-bar-a-population').style.width).toBe('79.4%')
    expect(screen.getByTestId('compare-bar-b-population').style.width).toBe('100%')
    expect(screen.getByText('50,000,000').className).toContain('text-readout')
    expect(screen.getByText('63,000,000').className).toContain('text-readout')
  })

  it('bars are static — no transition class, so reduced-motion needs no gating', () => {
    render(<CompareFieldRow field={field('population')} a={FRA} b={DEU} />)
    expect(screen.getByTestId('compare-bar-a-population').className).not.toContain('transition')
    expect(screen.getByTestId('compare-bar-b-population').className).not.toContain('transition')
  })

  it('delta chip names the larger country in either column order', () => {
    const { unmount } = render(<CompareFieldRow field={field('population')} a={FRA} b={DEU} />)
    expect(screen.getByTestId('compare-delta-population').textContent).toBe(
      'Germany 1.26× population',
    )
    unmount()
    render(<CompareFieldRow field={field('population')} a={DEU} b={FRA} />)
    expect(screen.getByTestId('compare-delta-population').textContent).toBe(
      'Germany 1.26× population',
    )
  })

  it('equal values read "Same population"', () => {
    render(
      <CompareFieldRow
        field={field('population')}
        a={FRA}
        b={makeCountryData({ cca3: 'BEL', population: 50_000_000 })}
      />,
    )
    expect(screen.getByTestId('compare-delta-population').textContent).toBe('Same population')
  })

  it('missing area: no bar, no delta chip, em-dash readout', () => {
    render(<CompareFieldRow field={field('area')} a={makeCountryData({ area: 0 })} b={DEU} />)
    expect(screen.queryByTestId('compare-bar-a-area')).toBeNull()
    expect(screen.getByTestId('compare-bar-b-area')).toBeTruthy() // B is the max → full bar
    expect(screen.queryByTestId('compare-delta-area')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('missing population: no bar, no delta chip, em-dash readout', () => {
    render(
      <CompareFieldRow
        field={field('population')}
        a={makeCountryData({ population: 0 })}
        b={DEU}
      />,
    )
    expect(screen.queryByTestId('compare-bar-a-population')).toBeNull()
    expect(screen.getByTestId('compare-bar-b-population')).toBeTruthy() // B is the max → full bar
    expect(screen.queryByTestId('compare-delta-population')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
  })
})

describe('CompareFieldRow — derived density row (C3)', () => {
  it('computes population/area per country and phrases the delta', () => {
    render(<CompareFieldRow field={field('density')} a={FRA} b={DEU} />)
    expect(screen.getByText('100 people/km²')).toBeTruthy() // 50M / 500k
    expect(screen.getByText('252 people/km²')).toBeTruthy() // 63M / 250k
    expect(screen.getByTestId('compare-delta-density').textContent).toBe('Germany 2.52× density')
    expect(screen.getByTestId('compare-bar-a-density').style.width).toBe('39.7%') // 100/252
  })
})

describe('CompareFieldRow — categorical rows (C2)', () => {
  it('identical values collapse to one centered "Both:" row', () => {
    render(<CompareFieldRow field={field('currencies')} a={FRA} b={DEU} />)
    const both = screen.getByTestId('compare-both-currencies')
    expect(both.textContent).toBe('Both: Euro (€)')
    expect(both.className).toContain('text-center')
  })

  it('differing values render side by side, never "Both:"', () => {
    const CHE = makeCountryData({
      cca3: 'CHE',
      currencies: { CHF: { name: 'Swiss franc', symbol: 'Fr.' } },
    })
    render(<CompareFieldRow field={field('currencies')} a={FRA} b={CHE} />)
    expect(screen.queryByTestId('compare-both-currencies')).toBeNull()
    expect(screen.getByText('Euro (€)')).toBeTruthy()
    expect(screen.getByText('Swiss franc (Fr.)')).toBeTruthy()
  })
})
