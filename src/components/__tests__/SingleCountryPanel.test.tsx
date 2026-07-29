/**
 * Animation-state lifecycle tests for SingleCountryPanel.
 *
 * Pins the contract documented in docs/superpowers/notes/2026-05-04-bug-31-diagnosis.md:
 * `data-animation-state` MUST flip from 'entering' → 'idle' once entrance
 * animations finish, with a 1s setTimeout fallback covering CI cases where
 * Element.getAnimations() doesn't observe className animations or the
 * `.finished` promises don't resolve.
 *
 * All timers are faked (toFake: setTimeout, requestAnimationFrame, etc.) so
 * the test cannot depend on wallclock pacing — required by the standing
 * "no flaky tests" rule.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, within } from '@testing-library/react'
import type { CountryData } from '../../lib/types'
import { makeCountry, sources, stubGetAnimations } from './singleCountryPanelTestUtils'
import { TOUCH_TARGET_FROM_36, TOUCH_TARGET_FROM_20 } from '../../lib/layoutConstants'
import { SingleCountryPanel } from '../SingleCountryPanel'
import { INERT_CHIP_CLASSES } from '../BorderChip'

function renderPanel() {
  return render(
    <SingleCountryPanel
      country={makeCountry()}
      comparePickingMode={false}
      sources={sources}
      isDesktop={true}
      onSelect={() => {}}
      onClose={() => {}}
      onEnterCompare={() => {}}
      onCancelCompare={() => {}}
      byCca3={new Map()}
    />,
  )
}

describe('SingleCountryPanel — data-animation-state lifecycle', () => {
  // Note: not faking microtasks (queueMicrotask, Promise) — Promise.then() is
  // not a timer and is driven by act() naturally.
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts as "entering" before any timer fires', () => {
    const { restore } = stubGetAnimations()
    try {
      const { getByTestId } = renderPanel()
      expect(getByTestId('country-panel').getAttribute('data-animation-state')).toBe('entering')
    } finally {
      restore()
    }
  })

  it('flips entering → idle on the rAF tick when getAnimations() returns []', async () => {
    const { restore } = stubGetAnimations()
    try {
      const { getByTestId } = renderPanel()
      const root = getByTestId('country-panel')
      expect(root.getAttribute('data-animation-state')).toBe('entering')

      // eslint-disable-next-line @typescript-eslint/require-await -- WHY: act() wants an async callback to schedule a microtask flush after the body runs; the body itself is sync (vitest timer manipulation).
      await act(async () => {
        vi.runAllTimers()
      })

      expect(root.getAttribute('data-animation-state')).toBe('idle')
    } finally {
      restore()
    }
  })

  it('flips entering → idle once all .finished promises resolve', async () => {
    const { restore } = stubGetAnimations()
    let resolveFinished!: () => void
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve
    })
    const fakeAnim = { finished } as unknown as Animation
    // Override the default stub with a custom animation whose .finished is pending.
    Element.prototype.getAnimations = vi.fn().mockReturnValue([fakeAnim])
    try {
      const { getByTestId } = renderPanel()
      const root = getByTestId('country-panel')

      // rAF callback runs and reads getAnimations(); .finished is still pending.
      // eslint-disable-next-line @typescript-eslint/require-await -- WHY: act() wants an async callback to schedule a microtask flush after the body runs; the body itself is sync (vitest timer manipulation).
      await act(async () => {
        vi.advanceTimersByTime(16)
      })
      expect(root.getAttribute('data-animation-state')).toBe('entering')

      // Resolve .finished → Promise.all().then() flips to idle.
      // eslint-disable-next-line @typescript-eslint/require-await -- WHY: act() wants an async callback to schedule a microtask flush after the body runs; the body itself is sync.
      await act(async () => {
        resolveFinished()
      })
      expect(root.getAttribute('data-animation-state')).toBe('idle')
    } finally {
      restore()
    }
  })

  it('flips entering → idle via the 1s fallback timer when .finished never resolves', async () => {
    const { restore } = stubGetAnimations()
    // Animation whose .finished promise never resolves — exactly the CI
    // event-loop-starvation pathology described in the bug-#31 diagnosis.
    const stuckAnim = { finished: new Promise<void>(() => {}) } as unknown as Animation
    // Override the default stub with an animation whose .finished never resolves.
    Element.prototype.getAnimations = vi.fn().mockReturnValue([stuckAnim])
    try {
      const { getByTestId } = renderPanel()
      const root = getByTestId('country-panel')

      // rAF runs; .finished hangs.
      // eslint-disable-next-line @typescript-eslint/require-await -- WHY: act() wants an async callback to schedule a microtask flush after the body runs; the body itself is sync.
      await act(async () => {
        vi.advanceTimersByTime(999)
      })
      expect(root.getAttribute('data-animation-state')).toBe('entering')

      // 1s fallback fires.
      // eslint-disable-next-line @typescript-eslint/require-await -- WHY: act() wants an async callback to schedule a microtask flush after the body runs; the body itself is sync.
      await act(async () => {
        vi.advanceTimersByTime(2)
      })
      expect(root.getAttribute('data-animation-state')).toBe('idle')
    } finally {
      restore()
    }
  })
})

describe('SingleCountryPanel — heading, subtitle, and region-badge layout (2026-07-10 review)', () => {
  it('heading wraps instead of truncating and carries no phantom focus-visible ring', () => {
    const { getByRole } = renderPanel()
    const heading = getByRole('heading', { name: 'France', level: 2 })
    expect(heading.className).toContain('line-clamp-2')
    expect(heading.className).not.toContain('truncate')
    expect(heading.className).not.toContain('focus-visible:ring')
  })

  it('region badge is a full-width row, not nested inside the name column', () => {
    const { getByRole, getByTestId } = renderPanel()
    const heading = getByRole('heading', { name: 'France', level: 2 })
    const badge = getByTestId('region-badge')
    expect(badge.parentElement).not.toBe(heading.parentElement)
    expect(badge.className).toContain('whitespace-nowrap')
  })
})

describe('SingleCountryPanel — prime grid dedupe + exception badges (A4+A5)', () => {
  function renderWith(country: CountryData) {
    return render(
      <SingleCountryPanel
        country={country}
        comparePickingMode={false}
        sources={sources}
        isDesktop={true}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={new Map()}
      />,
    )
  }

  it('field labels survive D1: Population/Area (hero row) + Government/Languages (prime grid); Capital/Region/UN Member/Independent cells stay gone', () => {
    const { getByText, queryByText } = renderWith(makeCountry())
    expect(getByText('Population')).toBeTruthy()
    expect(getByText('Area')).toBeTruthy()
    expect(getByText('Government')).toBeTruthy()
    expect(getByText('Languages')).toBeTruthy()
    expect(queryByText('Capital')).toBeNull()
    expect(queryByText('Region')).toBeNull()
    expect(queryByText('UN Member')).toBeNull()
    expect(queryByText('Independent')).toBeNull()
  })

  it('header caption joins all capitals; the A4 interim tooltip is retired (D2)', () => {
    const { getByTestId, queryByRole } = renderWith(
      makeCountry({
        cca3: 'ZAF',
        cca2: 'ZA',
        ccn3: '710',
        name: { common: 'South Africa', official: 'Republic of South Africa' },
        capital: ['Pretoria', 'Bloemfontein', 'Cape Town'],
        region: 'Africa',
        subregion: 'Southern Africa',
        _fieldSources: { capital: 'restcountries' },
      }),
    )
    expect(getByTestId('capital-caption').textContent).toContain(
      'Pretoria, Bloemfontein, Cape Town',
    )
    // capital sits on the dominant source, so no inline marker renders —
    // its attribution lives in the footer's field → source table.
    expect(queryByRole('button', { name: /^Source:/ })).toBeNull()
  })

  it('Vatican renders only the UN observer badge; a non-dominant badge field carries a marker link', () => {
    const { getByText, queryByText, getByTestId } = renderWith(
      makeCountry({
        cca3: 'VAT',
        cca2: 'VA',
        ccn3: '336',
        name: { common: 'Vatican City', official: 'Vatican City State' },
        capital: ['Vatican City'],
        region: 'Europe',
        subregion: 'Southern Europe',
        population: 764,
        area: 0.44,
        governmentType: 'ecclesiastical elective monarchy',
        unMember: false,
        independent: true,
        _fieldSources: {
          population: 'restcountries',
          area: 'restcountries',
          capital: 'restcountries',
          unMember: 'cia-factbook',
        },
      }),
    )
    expect(getByText('UN observer state')).toBeTruthy()
    expect(queryByText('Not independent')).toBeNull()
    // Field-level attribution is a constitution item (never silently
    // regress) — a badge whose source differs from the panel's dominant
    // source carries the C4/D2 marker, a real LINK in the Tab order
    // (the hover-only rings are retired).
    const marker = within(getByTestId('exception-badge-un-member')).getByRole('link', {
      name: 'Source: CIA World Factbook (archived)',
    })
    expect(marker.getAttribute('data-testid')).toBe('source-marker-cia-factbook')
  })

  it('Palestine renders both exception badges bare when their fields sit on the dominant source', () => {
    const { getByText, getByTestId } = renderWith(
      makeCountry({
        cca3: 'PSE',
        cca2: 'PS',
        ccn3: '275',
        name: { common: 'Palestine', official: 'State of Palestine' },
        capital: ['Ramallah'],
        region: 'Asia',
        subregion: 'Western Asia',
        population: 4_803_269,
        area: 6_220,
        unMember: false,
        independent: false,
        _fieldSources: { unMember: 'restcountries', independent: 'restcountries' },
      }),
    )
    expect(getByText('UN observer state')).toBeTruthy()
    expect(getByText('Not independent')).toBeTruthy()
    // Dominant-source badge fields carry no inline marker — the footer's
    // field table answers them one interaction away.
    expect(within(getByTestId('exception-badge-un-member')).queryByRole('link')).toBeNull()
    expect(within(getByTestId('exception-badge-independent')).queryByRole('link')).toBeNull()
  })

  it('a badge marker for a source key absent from _sources renders nothing (GNB manual-override)', () => {
    const { getByTestId } = renderWith(
      makeCountry({
        cca3: 'GNB',
        cca2: 'GW',
        ccn3: '624',
        name: { common: 'Guinea-Bissau', official: 'Republic of Guinea-Bissau' },
        unMember: false,
        _fieldSources: {
          population: 'restcountries',
          area: 'restcountries',
          capital: 'restcountries',
          unMember: 'manual-override',
        },
      }),
    )
    expect(within(getByTestId('exception-badge-un-member')).queryByRole('link')).toBeNull()
  })

  it('a UN member (France) renders no exception badges', () => {
    const { queryByText } = renderWith(makeCountry())
    expect(queryByText('UN observer state')).toBeNull()
    expect(queryByText('Not independent')).toBeNull()
  })
})

describe('SingleCountryPanel — compare-picking banner (A7)', () => {
  it('banner has role="status" and its inline Cancel calls onCancelCompare', () => {
    const onCancelCompare = vi.fn()
    const { getByRole, getByTestId } = render(
      <SingleCountryPanel
        country={makeCountry()}
        comparePickingMode={true}
        sources={sources}
        isDesktop={true}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={onCancelCompare}
        byCca3={new Map()}
      />,
    )
    const banner = getByRole('status')
    expect(banner.textContent).toContain('Pick a country to compare with')
    fireEvent.click(getByTestId('compare-picking-cancel'))
    expect(onCancelCompare).toHaveBeenCalledTimes(1)
  })

  it('renders no banner or Cancel button outside picking mode', () => {
    const { queryByRole, queryByTestId } = renderPanel()
    expect(queryByRole('status')).toBeNull()
    expect(queryByTestId('compare-picking-cancel')).toBeNull()
  })
})

describe('SingleCountryPanel — labeled compare entry (C5)', () => {
  function renderAt(isDesktop: boolean) {
    return render(
      <SingleCountryPanel
        country={makeCountry()}
        comparePickingMode={false}
        sources={sources}
        isDesktop={isDesktop}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={new Map()}
      />,
    )
  }

  it('desktop: icon + "Compare" text pill, aria-label preserved, A13 constant consumed', () => {
    const { getByRole } = renderAt(true)
    // aria-label overrides content — every e2e locator keyed on this name
    // keeps working (WCAG 2.5.3 holds: the name contains the visible text).
    const btn = getByRole('button', { name: 'Compare with another country' })
    expect(btn.textContent).toBe('Compare')
    expect(btn.className).toContain('rounded-full')
    expect(btn.className).toContain(TOUCH_TARGET_FROM_36)
    expect(btn.getAttribute('data-testid')).toBe('compare-entry')
  })

  it('mobile: labeled chip below the grid, not in the sticky header (D4)', () => {
    const { getByRole } = renderAt(false)
    const btn = getByRole('button', { name: 'Compare with another country' })
    expect(btn.textContent).toBe('Compare')
    expect(btn.getAttribute('data-testid')).toBe('compare-entry')
    expect(btn.className).toContain(TOUCH_TARGET_FROM_36)
    // Below the grid: the chip lives in the scroll body — the sticky header
    // carries only flag/name (left) and share/expand/close (right).
    expect(btn.closest('.sticky')).toBeNull()
  })

  it('desktop: the pill still lives in the sticky header', () => {
    const { getByRole } = renderAt(true)
    expect(
      getByRole('button', { name: 'Compare with another country' }).closest('.sticky'),
    ).not.toBeNull()
  })
})

describe('SingleCountryPanel — mobile inline header (D4)', () => {
  function renderMobile(props: { comparePickingMode?: boolean; inGameRound?: boolean } = {}) {
    return render(
      <SingleCountryPanel
        country={makeCountry()}
        comparePickingMode={props.comparePickingMode ?? false}
        sources={sources}
        isDesktop={false}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={new Map()}
        inGameRound={props.inGameRound ?? false}
      />,
    )
  }

  it('flag/name and the action cluster share one row — no stacked flex-col header', () => {
    const { getByTestId } = renderMobile()
    // country-flag's parent is the flag+name block; ITS parent is the header row.
    const row = getByTestId('country-flag').parentElement!.parentElement!
    expect(row.className).toContain('justify-between')
    expect(row.className).not.toContain('flex-col')
  })

  it('the header action cluster is share + expand + close — compare moved out', () => {
    const { getByTestId } = renderMobile()
    const cluster = getByTestId('panel-close').parentElement!
    const labels = Array.from(cluster.children)
      .filter((el) => el.tagName === 'BUTTON')
      .map((el) => el.getAttribute('aria-label'))
    expect(labels).toEqual(['Copy link to this country', 'Expand panel', 'Close panel'])
  })

  it('no compare chip while picking or during a game round', () => {
    const picking = renderMobile({ comparePickingMode: true })
    expect(picking.queryByTestId('compare-entry')).toBeNull()
    picking.unmount()
    const inRound = renderMobile({ inGameRound: true })
    expect(inRound.queryByTestId('compare-entry')).toBeNull()
  })
})

describe('SingleCountryPanel — hero stats row (D1)', () => {
  function renderWith(country = makeCountry()) {
    return render(
      <SingleCountryPanel
        country={country}
        comparePickingMode={false}
        sources={sources}
        isDesktop={true}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={new Map()}
      />,
    )
  }

  it('renders compact Population/Area/Density numerals in .text-readout with exact values in title and sr-only span', () => {
    // Real France figures so the compact strings match the shipped data.
    const { getByTestId } = renderWith(makeCountry({ population: 66_351_959, area: 543_908 }))
    const pop = getByTestId('hero-stat-population')
    // Compact text is aria-hidden; sr-only span carries exact for AT.
    const popVisible = pop.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(popVisible.textContent).toBe('66.4M')
    const popSrOnly = pop.querySelector('span.sr-only') as HTMLElement
    expect(popSrOnly.textContent).toBe('66,351,959')
    expect(pop.getAttribute('title')).toBe('66,351,959')
    expect(pop.className).toContain('text-readout')

    const area = getByTestId('hero-stat-area')
    const areaVisible = area.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(areaVisible.textContent).toBe('544K km²')
    const areaSrOnly = area.querySelector('span.sr-only') as HTMLElement
    expect(areaSrOnly.textContent).toBe('543,908 km²')
    expect(area.getAttribute('title')).toBe('543,908 km²')

    const density = getByTestId('hero-stat-density')
    const densityVisible = density.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(densityVisible.textContent).toBe('122/km²')
    const densitySrOnly = density.querySelector('span.sr-only') as HTMLElement
    expect(densitySrOnly.textContent).toBe('122 people/km²')
    expect(density.getAttribute('title')).toBe('122 people/km²')
  })

  it('rank sub-lines show "#N of 195" for population and area; density has none', () => {
    // Ranks key off cca3 against the bundled dataset (world facts), NOT the
    // fixture's population/area values — the default FRA fixture resolves to
    // France's real ranks (#22 / #48 today, format-asserted not pinned).
    const { getByTestId, queryByTestId } = renderWith()
    expect(getByTestId('hero-rank-population').textContent).toMatch(/^#\d+ of 195$/)
    expect(getByTestId('hero-rank-area').textContent).toMatch(/^#\d+ of 195$/)
    expect(queryByTestId('hero-rank-density')).toBeNull()
  })

  it('non-canonical cca3 renders no rank sub-lines (rank maps cover only the 195)', () => {
    const { queryByTestId, getByTestId } = renderWith(makeCountry({ cca3: 'XXX' }))
    expect(queryByTestId('hero-rank-population')).toBeNull()
    expect(queryByTestId('hero-rank-area')).toBeNull()
    expect(getByTestId('hero-stat-population')).toBeTruthy() // values still render
  })

  it('zero density renders the em-dash with no title and no sr-only span', () => {
    const { getByTestId } = renderWith(makeCountry({ population: 0 }))
    const density = getByTestId('hero-stat-density')
    const densityVisible = density.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(densityVisible.textContent).toBe('—')
    const densitySrOnly = density.querySelector('span.sr-only')
    expect(densitySrOnly).toBeNull() // no sr-only when exact is undefined
    expect(density.getAttribute('title')).toBeNull()
  })

  it('Population/Area hero fields keep the data-field anchor; dominant-source fields carry no marker (D2)', () => {
    const { container, getByTestId, getAllByTestId } = renderWith(
      makeCountry({ _fieldSources: { population: 'restcountries', area: 'restcountries' } }),
    )
    // data-field anchors preserved — e2e/single-source-attribution.spec.ts and
    // the disclosure table both key off these (constitution: attribution
    // never silently regresses; D2 retired the per-field rings in favor of
    // the C4/D2 marker scheme).
    const hero = getByTestId('hero-stats')
    // Both fields sit on the panel's sole (dominant) source, so neither
    // carries an inline exception marker — the footer's field table has
    // the answer either way.
    expect(
      within(hero.querySelector('[data-field="population"]') as HTMLElement).queryByRole('link'),
    ).toBeNull()
    expect(
      within(hero.querySelector('[data-field="area"]') as HTMLElement).queryByRole('link'),
    ).toBeNull()
    expect(container.querySelector('[data-field="density"]')).toBeTruthy()
    // Prime grid DataCells are now Government + Languages (+ Currencies,
    // Timezones in the desktop secondary section) — Population/Area moved out.
    const cellLabels = getAllByTestId('data-cell-value').map(
      (el) => el.previousElementSibling?.textContent,
    )
    expect(cellLabels).not.toContain('Population')
    expect(cellLabels).not.toContain('Area')
  })

  it('a hero field on a non-dominant source carries the C4/D2 marker link', () => {
    const { getByTestId } = renderWith(
      makeCountry({
        _fieldSources: {
          population: 'cia-factbook',
          area: 'restcountries',
          governmentType: 'restcountries',
        },
      }),
    )
    const hero = getByTestId('hero-stats')
    const marker = within(hero.querySelector('[data-field="population"]') as HTMLElement).getByRole(
      'link',
      { name: 'Source: CIA World Factbook (archived)' },
    )
    expect(marker.getAttribute('data-testid')).toBe('source-marker-cia-factbook')
  })
})

describe('SingleCountryPanel — consolidated sources footer (D2)', () => {
  function renderWith(country: CountryData) {
    return render(
      <SingleCountryPanel
        country={country}
        comparePickingMode={false}
        sources={sources}
        isDesktop={true}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={new Map()}
      />,
    )
  }

  // Mirrors the bundled data's shape: every field restcountries except
  // governmentType (cia-factbook) — the one exception, glyph †.
  const franceLike = () =>
    makeCountry({
      _fieldSources: {
        capital: 'restcountries',
        population: 'restcountries',
        area: 'restcountries',
        languages: 'restcountries',
        currencies: 'restcountries',
        timezones: 'restcountries',
        governmentType: 'cia-factbook',
      },
    })

  it('renders one linked footer; the exception source carries the † glyph key', () => {
    const { getByTestId } = renderWith(franceLike())
    const footer = getByTestId('panel-sources')
    expect(footer.textContent).toContain('Sources:')
    const rest = within(footer).getByRole('link', { name: /REST Countries/ })
    expect(rest.getAttribute('href')).toBe('https://restcountries.com')
    expect(rest.getAttribute('target')).toBe('_blank')
    expect(rest.getAttribute('rel')).toBe('noopener noreferrer')
    expect(rest.textContent).not.toContain('†')
    const cia = within(footer).getByRole('link', { name: /CIA World Factbook/ })
    expect(cia.textContent).toContain('†')
  })

  it('the Government field carries the † marker; dominant-source fields carry none', () => {
    const { getByTestId, queryByTestId } = renderWith(franceLike())
    const marker = getByTestId('source-marker-cia-factbook')
    expect(marker.textContent).toBe('†')
    expect(marker.closest('[data-field="governmentType"]')).not.toBeNull()
    expect(queryByTestId('source-marker-restcountries')).toBeNull()
  })

  it('the per-field "i" rings are gone', () => {
    const { queryAllByRole } = renderWith(franceLike())
    expect(queryAllByRole('button', { name: /^Source:/ })).toHaveLength(0)
  })

  it('disclosure expands into the full field → source table and collapses back', () => {
    const { getByTestId, queryByTestId } = renderWith(franceLike())
    const toggle = getByTestId('panel-sources-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(queryByTestId('panel-sources-detail')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-controls')).toBe('panel-sources-detail')
    const table = getByTestId('panel-sources-detail')
    expect(within(table).getAllByRole('row')).toHaveLength(7)
    within(table).getByRole('rowheader', { name: 'Government' })
    within(table).getByRole('cell', { name: 'CIA World Factbook (archived)' })
    within(table).getByRole('rowheader', { name: 'Capital' })

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(queryByTestId('panel-sources-detail')).toBeNull()
  })

  it('the table falls back to the raw source key when _sources lacks it (manual-override)', () => {
    const { getByTestId } = renderWith(
      makeCountry({
        _fieldSources: { population: 'restcountries', unMember: 'manual-override' },
      }),
    )
    fireEvent.click(getByTestId('panel-sources-toggle'))
    const table = getByTestId('panel-sources-detail')
    within(table).getByRole('rowheader', { name: 'UN member' })
    within(table).getByRole('cell', { name: 'manual-override' })
  })
})

describe('SingleCountryPanel — Explore next (D3)', () => {
  // France-shaped fixture: DEU is a border (must appear ONLY in Borders),
  // NLD/LIE are same-subregion non-borders (peers, population-descending),
  // THA (66M vs France's fixture 67M) is the closest-population pick.
  const france = makeCountry({ borders: ['DEU'] })
  const neighbors = [
    makeCountry({
      cca3: 'DEU',
      ccn3: '276',
      cca2: 'DE',
      name: { common: 'Germany', official: 'Federal Republic of Germany' },
      population: 83_000_000,
    }),
    makeCountry({
      cca3: 'NLD',
      ccn3: '528',
      cca2: 'NL',
      name: { common: 'Netherlands', official: 'Kingdom of the Netherlands' },
      population: 18_000_000,
    }),
    makeCountry({
      cca3: 'LIE',
      ccn3: '438',
      cca2: 'LI',
      name: { common: 'Liechtenstein', official: 'Principality of Liechtenstein' },
      population: 40_000,
      landlocked: true,
    }),
    makeCountry({
      cca3: 'THA',
      ccn3: '764',
      cca2: 'TH',
      name: { common: 'Thailand', official: 'Kingdom of Thailand' },
      subregion: 'South-Eastern Asia',
      population: 66_000_000,
    }),
  ]
  const byCca3 = new Map([france, ...neighbors].map((c) => [c.cca3, c] as const))

  function renderExplore({
    country = france,
    isDesktop = true,
    onSelect = () => {},
  }: {
    country?: CountryData
    isDesktop?: boolean
    onSelect?: (cca3: string) => void
  } = {}) {
    return render(
      <SingleCountryPanel
        country={country}
        comparePickingMode={false}
        sources={sources}
        isDesktop={isDesktop}
        onSelect={onSelect}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={byCca3}
      />,
    )
  }

  it('renders inert fact chip + subregion peers (no self/borders) + similar-population chip, in order', () => {
    const { getByTestId } = renderExplore()
    const fact = getByTestId('explore-fact-chip')
    expect(fact.textContent).toBe('Coastal')
    // Inert — the unmatched-border-chip precedent: a span, not a button,
    // in the exported inert styling (visually distinct from clickable chips).
    expect(fact.tagName).toBe('SPAN')
    expect(fact.className).toBe(INERT_CHIP_CLASSES.panel)
    const buttons = within(getByTestId('explore-next')).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Netherlands', // 18M — population-descending
      'Liechtenstein', // 40K
      'Thailand · similar population · 66M',
    ])
  })

  it('clicking a suggestion routes through the existing onSelect (same semantics as border chips)', () => {
    const onSelect = vi.fn()
    const { getByTestId } = renderExplore({ onSelect })
    fireEvent.click(
      within(getByTestId('explore-next')).getByRole('button', { name: 'Netherlands' }),
    )
    expect(onSelect).toHaveBeenCalledWith('NLD')
  })

  it('landlocked countries get the Landlocked fact chip', () => {
    const lie = byCca3.get('LIE')
    if (!lie) throw new Error('fixture missing LIE')
    const { getByTestId } = renderExplore({ country: lie })
    expect(getByTestId('explore-fact-chip').textContent).toBe('Landlocked')
  })

  it('is secondary content: hidden in the collapsed mobile sheet, shown after Expand', () => {
    const { queryByTestId, getByTestId, getByLabelText } = renderExplore({ isDesktop: false })
    expect(queryByTestId('explore-next')).toBeNull()
    fireEvent.click(getByLabelText('Expand panel'))
    expect(getByTestId('explore-next')).toBeTruthy()
  })
})

describe('SingleCountryPanel — mobile sheet grabber (G1)', () => {
  function renderAt(isDesktop: boolean) {
    return render(
      <SingleCountryPanel
        country={makeCountry()}
        comparePickingMode={false}
        sources={sources}
        isDesktop={isDesktop}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={new Map()}
      />,
    )
  }

  it('mobile: grabber is a pointer-only affordance wired to the same expand toggle as the chevron', () => {
    const { getByTestId, getByLabelText, getByText, queryByText } = renderAt(false)
    const grabber = getByTestId('sheet-grabber')
    // Pointer-only: the chevron is the labeled control. aria-hidden on a
    // focusable element is an axe violation (aria-hidden-focus), hence
    // tabIndex=-1 removing it from the tab order.
    expect(grabber.getAttribute('aria-hidden')).toBe('true')
    expect(grabber.getAttribute('tabindex')).toBe('-1')
    expect(grabber.className).toContain(TOUCH_TARGET_FROM_20)
    // Collapsed peek state: secondary fields hidden (Timezones renders
    // unconditionally once showSecondary is true — stable sentinel).
    expect(queryByText('Timezones')).toBeNull()
    fireEvent.click(grabber)
    expect(getByText('Timezones')).toBeTruthy()
    // The chevron reflects the state the grabber set — one shared toggle.
    expect(getByLabelText('Collapse panel').getAttribute('aria-expanded')).toBe('true')
  })

  it('mobile: chevron exposes aria-expanded and still toggles', () => {
    const { getByLabelText } = renderAt(false)
    const chevron = getByLabelText('Expand panel')
    expect(chevron.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(chevron)
    expect(getByLabelText('Collapse panel').getAttribute('aria-expanded')).toBe('true')
  })

  it('desktop: no grabber renders', () => {
    const { queryByTestId } = renderAt(true)
    expect(queryByTestId('sheet-grabber')).toBeNull()
  })
})
