import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { CompareCountryPanel } from '../CompareCountryPanel'
import { makeCountry, sources } from './singleCountryPanelTestUtils'
import { COMPARE_FIELDS } from '../../lib/compareFields'

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

describe('C1 — one shared field list drives both columns (mobile)', () => {
  // isDesktop:false — desktop moved to CompareFieldRow's shared-row table in
  // C2/C3 (one row per field, both values side by side), so this per-column
  // "every COMPARE_FIELDS row renders in each column" assertion now exercises
  // the still-unchanged mobile CountryColumn path (see task-3-report.md for
  // the desktop-side coverage: CompareFieldRow.test.tsx + the e2e additions).
  it('renders identical, ordered rows in both columns with em-dash placeholders', () => {
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
    const expected = COMPARE_FIELDS.map((f) => f.label)
    // Field labels are the .uppercase divs inside the fields wrapper
    // (borders are empty on these fixtures, so no Borders label competes).
    const rowLabels = (col: HTMLElement) =>
      Array.from(col.querySelectorAll('.px-5.py-3 .uppercase')).map((el) => el.textContent)
    expect(rowLabels(screen.getByTestId('compare-column-a'))).toEqual(expected)
    expect(rowLabels(screen.getByTestId('compare-column-b'))).toEqual(expected)
    // Germany's missing Government + Currencies render the placeholder; France has none.
    expect(within(screen.getByTestId('compare-column-b')).getAllByText('—')).toHaveLength(2)
    expect(within(screen.getByTestId('compare-column-a')).queryByText('—')).toBeNull()
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
