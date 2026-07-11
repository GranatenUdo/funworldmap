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
import { act, render } from '@testing-library/react'
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
