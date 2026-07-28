import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { CompareCountryPanel } from '../CompareCountryPanel'
import { makeCountry, sources } from './singleCountryPanelTestUtils'
import { COMPARE_FIELDS } from '../../lib/compareFields'
import type { CountriesFile } from '../../lib/types'

const FRA = makeCountry()
const DEU = makeCountry({
  cca3: 'DEU',
  ccn3: '276',
  name: { common: 'Germany', official: 'Federal Republic of Germany' },
})

function renderPanel() {
  const onClose = vi.fn()
  const onExitCompare = vi.fn()
  render(
    <CompareCountryPanel
      country={FRA}
      compareWith={DEU}
      isDesktop={true}
      onCompareColumnSelect={vi.fn()}
      onClose={onClose}
      onExitCompare={onExitCompare}
      byCca3={new Map()}
      sources={sources}
    />,
  )
  return { onClose, onExitCompare }
}

describe('CompareCountryPanel header controls (A15)', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    // jsdom has no navigator.clipboard; install a resolving stub so the
    // clipboard branch (not the window.prompt fallback) runs.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  })

  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard
  })

  it('copy-link copies the #FRA,DEU deep link and announces via toast', async () => {
    const toasts: string[] = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent<string>).detail)
    window.addEventListener('funworldmap:toast', onToast)
    try {
      renderPanel()
      fireEvent.click(screen.getByRole('button', { name: 'Copy link to this comparison' }))
      await waitFor(() => expect(toasts).toContain('Link copied'))
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}${window.location.pathname}#FRA,DEU`,
      )
    } finally {
      window.removeEventListener('funworldmap:toast', onToast)
    }
  })

  it('the top-right × closes the WHOLE panel (its position convention), not just compare', () => {
    const { onClose, onExitCompare } = renderPanel()
    fireEvent.click(screen.getByTestId('panel-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onExitCompare).not.toHaveBeenCalled()
  })

  it('"Exit compare" is a labeled control returning to the single panel (touch-reachable)', () => {
    const { onClose, onExitCompare } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Exit compare' }))
    expect(onExitCompare).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('C6 — shared field list drives the ONE mobile scroll (supersedes the old per-column test)', () => {
  // Pre-C6, isDesktop:false rendered COMPARE_FIELDS via two independent
  // CountryColumn instances (one full copy of every field per country) — this
  // block asserted the two copies stayed row-for-row identical. C6 replaces
  // that with the SAME shared CompareFieldRow the desktop arm already used
  // (C2/C3), so each field now renders exactly once; the old "duplicate
  // columns render identically" premise no longer applies. Em-dash-placeholder
  // coverage for CompareFieldRow's own rendering lives in
  // CompareFieldRow.test.tsx (C2/C3) — this test only checks the mobile
  // integration: every field is present once, with the sparse side's missing
  // values collapsing to the shared em-dash inside that one row.
  it('renders every COMPARE_FIELDS row exactly once, with the em-dash for the sparse side', () => {
    const sparse = makeCountry({
      cca3: 'DEU',
      ccn3: '276',
      name: { common: 'Germany', official: 'Federal Republic of Germany' },
      governmentType: '',
      currencies: {},
    })
    render(
      <CompareCountryPanel
        country={FRA}
        compareWith={sparse}
        isDesktop={false}
        onCompareColumnSelect={vi.fn()}
        onClose={vi.fn()}
        onExitCompare={vi.fn()}
        byCca3={new Map()}
        sources={sources}
      />,
    )
    for (const f of COMPARE_FIELDS) {
      expect(screen.getAllByTestId(`compare-row-${f.key}`)).toHaveLength(1)
    }
    // Germany's missing Government + Currencies render the categorical
    // em-dash inside their shared row's B-side cell; France has none missing.
    expect(within(screen.getByTestId('compare-row-governmentType')).getByText('—')).toBeTruthy()
    expect(within(screen.getByTestId('compare-row-currencies')).getByText('—')).toBeTruthy()
  })
})

describe('C1 — border chips are column-scoped', () => {
  // Desktop (isDesktop:true, as rendered here): borders stayed column-scoped
  // through the C2/C3 shared-row rewrite, but they're no longer inside a
  // single per-column DOM subtree (CountryColumn) — CompareCountryPanel wraps
  // each side's <CountryBorders> in its own compare-borders-a/b testid now
  // (see CompareCountryPanel.tsx's desktop branch). compare-column-a/b still
  // exists too, scoped to just the header.
  it('reports column "a" for chips in column A and column "b" for chips in column B', () => {
    const fra = makeCountry({ borders: ['ESP'] })
    const deu = makeCountry({
      cca3: 'DEU',
      ccn3: '276',
      name: { common: 'Germany', official: 'Federal Republic of Germany' },
      borders: ['POL'],
    })
    const byCca3 = new Map([
      [
        'ESP',
        makeCountry({
          cca3: 'ESP',
          ccn3: '724',
          name: { common: 'Spain', official: 'Kingdom of Spain' },
        }),
      ],
      [
        'POL',
        makeCountry({
          cca3: 'POL',
          ccn3: '616',
          name: { common: 'Poland', official: 'Republic of Poland' },
        }),
      ],
    ])
    const onCompareColumnSelect = vi.fn()
    render(
      <CompareCountryPanel
        country={fra}
        compareWith={deu}
        isDesktop={true}
        onCompareColumnSelect={onCompareColumnSelect}
        onClose={vi.fn()}
        onExitCompare={vi.fn()}
        byCca3={byCca3}
        sources={sources}
      />,
    )
    fireEvent.click(
      within(screen.getByTestId('compare-borders-a')).getByRole('button', { name: 'Spain' }),
    )
    expect(onCompareColumnSelect).toHaveBeenLastCalledWith('a', 'ESP')
    fireEvent.click(
      within(screen.getByTestId('compare-borders-b')).getByRole('button', { name: 'Poland' }),
    )
    expect(onCompareColumnSelect).toHaveBeenLastCalledWith('b', 'POL')
  })
})

describe('C4 exception source markers', () => {
  // Real-data shape: every field restcountries except governmentType (cia-factbook).
  const FIELD_SOURCES: Record<string, string> = {
    population: 'restcountries',
    area: 'restcountries',
    region: 'restcountries',
    languages: 'restcountries',
    currencies: 'restcountries',
    timezones: 'restcountries',
    governmentType: 'cia-factbook',
  }

  const twoSources: CountriesFile['_sources'] = {
    ...sources,
    'cia-factbook': {
      name: 'CIA World Factbook (archived)',
      url: 'https://github.com/factbook/factbook.json',
      description: 'CC0 JSON archive of the CIA World Factbook',
      lastUpdated: '2026-01-22',
    },
  }

  function renderWithMarkers(
    fieldSourcesA: Record<string, string> = FIELD_SOURCES,
    fieldSourcesB: Record<string, string> = FIELD_SOURCES,
    isDesktop = true,
  ) {
    render(
      <CompareCountryPanel
        country={makeCountry({ _fieldSources: fieldSourcesA })}
        compareWith={makeCountry({
          cca3: 'DEU',
          ccn3: '276',
          name: { common: 'Germany', official: 'Federal Republic of Germany' },
          _fieldSources: fieldSourcesB,
        })}
        isDesktop={isDesktop}
        onCompareColumnSelect={vi.fn()}
        onClose={vi.fn()}
        onExitCompare={vi.fn()}
        byCca3={new Map()}
        sources={twoSources}
      />,
    )
  }

  it('marks only exception rows, Tab-reachable and labelled with the source name', () => {
    renderWithMarkers()
    // governmentType (cia-factbook) is the only non-dominant field.
    const markers = screen.getAllByTestId('source-marker-cia-factbook')
    expect(markers.length).toBeGreaterThanOrEqual(1)
    for (const marker of markers) {
      expect(marker.getAttribute('aria-label')).toBe('Source: CIA World Factbook (archived)')
      expect(marker.tabIndex).toBe(0)
    }
    // Dominant-source rows carry no marker.
    expect(screen.queryAllByTestId('source-marker-restcountries')).toHaveLength(0)
  })

  it('keys the footer: the exception source is listed with its glyph', () => {
    renderWithMarkers()
    const footer = screen.getByTestId('compare-sources')
    expect(within(footer).getByText('†')).toBeTruthy()
    expect(footer.textContent).toContain('CIA World Factbook (archived)')
    expect(footer.textContent).toContain('REST Countries')
  })

  it('renders no markers and no footer glyph when all fields share one source', () => {
    const allRest = { ...FIELD_SOURCES, governmentType: 'restcountries' }
    renderWithMarkers(allRest, allRest)
    expect(screen.queryAllByTestId('source-marker-cia-factbook')).toHaveLength(0)
    expect(within(screen.getByTestId('compare-sources')).queryByText('†')).toBeNull()
  })

  // C6 parity check: the mobile arm reuses the same CompareFieldRow + rowMarker
  // wiring as desktop (this file's fix over the brief's literal step-12 code,
  // which omitted the marker prop on mobile rows) — otherwise the shared
  // footer's "†" footnote would reference a marker that never appears anywhere
  // in the mobile UI.
  it('mobile rows also carry the exception marker, keeping the footer footnote referenced (C6)', () => {
    renderWithMarkers(FIELD_SOURCES, FIELD_SOURCES, false)
    expect(screen.getAllByTestId('source-marker-cia-factbook').length).toBeGreaterThanOrEqual(1)
  })
})

describe('C6 — mobile compare is one scroll', () => {
  // Adaptation from the brief: Task 5 wired border-chip replacement as a
  // single onCompareColumnSelect(column, cca3) callback (see CountryPanel.tsx
  // / App.tsx), not the brief-anticipated separate onSelect/onCompareSelect
  // props — CompareCountryPanel has no onSelect prop at all. The mobile arm
  // below routes A's chips through onCompareColumnSelect('a', cca3) and B's
  // through onCompareColumnSelect('b', cca3), mirroring the desktop arm's
  // existing compare-borders-a/b wiring.
  function renderMobile(over: { country?: typeof FRA; compareWith?: typeof DEU } = {}) {
    const onCompareColumnSelect = vi.fn()
    render(
      <CompareCountryPanel
        country={over.country ?? FRA}
        compareWith={over.compareWith ?? DEU}
        isDesktop={false}
        onCompareColumnSelect={onCompareColumnSelect}
        onClose={vi.fn()}
        onExitCompare={vi.fn()}
        byCca3={new Map()}
        sources={sources}
      />,
    )
    return { onCompareColumnSelect }
  }

  it('renders ONE scroll container — the stacked per-country halves are gone', () => {
    renderMobile()
    expect(screen.getByTestId('compare-mobile-scroll')).toBeTruthy()
    // The pre-C6 layout scrolled each 35vh half independently; CompareFieldRow
    // is container-fluid by contract (no internal scroll), so exactly one
    // overflow-y-auto element may exist in the mobile render.
    expect(document.querySelectorAll('.overflow-y-auto')).toHaveLength(1)
  })

  it('sticky compact header carries both flags, names, and A/B badges', () => {
    renderMobile()
    const header = screen.getByTestId('compare-mobile-header')
    expect(header.className).toContain('sticky')
    expect(within(header).getByText('France')).toBeTruthy()
    expect(within(header).getByText('Germany')).toBeTruthy()
    expect(within(header).getByText('A')).toBeTruthy()
    expect(within(header).getByText('B')).toBeTruthy()
    expect(within(header).getAllByTestId('country-flag')).toHaveLength(2)
  })

  it('shared rows render once with both countries adjacent, not per-column', () => {
    renderMobile()
    // Two per-country columns rendered this field twice; the shared row
    // renders it exactly once (testid contract from CompareFieldRow, Task 3).
    expect(screen.getAllByTestId('compare-row-population')).toHaveLength(1)
  })

  it('border chips replace the country whose group they belong to (A and B both route through onCompareColumnSelect)', () => {
    const fra = makeCountry({ borders: ['BEL'] })
    const deu = makeCountry({
      cca3: 'DEU',
      ccn3: '276',
      name: { common: 'Germany', official: 'Federal Republic of Germany' },
      borders: ['AUT'],
    })
    const byCca3 = new Map([
      [
        'BEL',
        makeCountry({
          cca3: 'BEL',
          name: { common: 'Belgium', official: 'Kingdom of Belgium' },
        }),
      ],
      [
        'AUT',
        makeCountry({
          cca3: 'AUT',
          name: { common: 'Austria', official: 'Republic of Austria' },
        }),
      ],
    ])
    const onCompareColumnSelect = vi.fn()
    render(
      <CompareCountryPanel
        country={fra}
        compareWith={deu}
        isDesktop={false}
        onCompareColumnSelect={onCompareColumnSelect}
        onClose={vi.fn()}
        onExitCompare={vi.fn()}
        byCca3={byCca3}
        sources={sources}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Belgium' }))
    expect(onCompareColumnSelect).toHaveBeenCalledWith('a', 'BEL')
    fireEvent.click(screen.getByRole('button', { name: 'Austria' }))
    expect(onCompareColumnSelect).toHaveBeenCalledWith('b', 'AUT')
  })
})
