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
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, within } from '@testing-library/react'
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
  beforeAll(async () => {
    stubMatchMedia()
    const mod = await import('../SingleCountryPanel')
    SingleCountryPanel = mod.SingleCountryPanel as typeof SingleCountryPanel
  })

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

  it('prime grid shows Population, Area, Government, Languages; Capital/Region/UN Member/Independent cells are gone', () => {
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

  it('header caption joins all capitals and carries the interim capital SourceTooltip', () => {
    const { getByTestId, getByRole } = renderWith(
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
    // Interim attribution: the caption keeps a Source affordance for capital
    // (region shares the same source) until D2's consolidated footer.
    expect(getByRole('button', { name: 'Source: REST Countries' })).toBeTruthy()
  })

  it('Vatican (unMember false, independent true) renders only the UN observer badge, with source attribution', () => {
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
        _fieldSources: { unMember: 'restcountries' },
      }),
    )
    expect(getByText('UN observer state')).toBeTruthy()
    expect(queryByText('Not independent')).toBeNull()
    // Field-level attribution is a constitution item — the badge must carry
    // the same SourceTooltip affordance as every other data field (A5/A4).
    within(getByTestId('exception-badge-un-member')).getByRole('button', {
      name: 'Source: REST Countries',
    })
  })

  it('Palestine (unMember false, independent false) renders both exception badges, each with source attribution', () => {
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
    within(getByTestId('exception-badge-un-member')).getByRole('button', {
      name: 'Source: REST Countries',
    })
    within(getByTestId('exception-badge-independent')).getByRole('button', {
      name: 'Source: REST Countries',
    })
  })

  it('exception badges render no source affordance when _fieldSources omits the field', () => {
    const { getByTestId } = renderWith(
      makeCountry({
        cca3: 'PSE',
        cca2: 'PS',
        ccn3: '275',
        name: { common: 'Palestine', official: 'State of Palestine' },
        unMember: false,
        independent: false,
        _fieldSources: {},
      }),
    )
    expect(within(getByTestId('exception-badge-un-member')).queryByRole('button')).toBeNull()
    expect(within(getByTestId('exception-badge-independent')).queryByRole('button')).toBeNull()
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
