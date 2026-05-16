/**
 * Tests cover the announcement, auto-advance, and game-over recording branches
 * of the effect formerly inlined in GameController. Renders the hook in
 * isolation via @testing-library/react's renderHook — same approach as
 * useGameTestSeams.test.tsx — to avoid pulling in MapProvider, the daily
 * puzzles provider, etc.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import { useGameAnnouncements } from '../useGameAnnouncements'
import {
  makeAttempt,
  makeCityRound,
  makeCountryReveal,
  makeCountryRound,
  makeOutcome,
  makePointReveal,
  makeSession,
} from '../../shared/__tests__/factories'
import { byCca3Fixture, citiesFixture, countriesFixture } from './fixtures'
import { getMode } from '../../modes'
import { RESUME_KEY } from '../../daily/resume'

const POOLS = { countries: countriesFixture, cities: citiesFixture }

type AnnouncementsArgs = Parameters<typeof useGameAnnouncements>[0]

interface BuildAnnouncementsArgsOverrides {
  session?: AnnouncementsArgs['session']
  mode?: AnnouncementsArgs['mode']
  byCca3?: AnnouncementsArgs['byCca3']
  advance?: AnnouncementsArgs['advance']
  finalize?: AnnouncementsArgs['finalize']
  record?: AnnouncementsArgs['record']
  recordDailyResult?: AnnouncementsArgs['recordDailyResult']
}

function buildAnnouncementsArgs(
  overrides: BuildAnnouncementsArgsOverrides = {},
): AnnouncementsArgs {
  return {
    session: overrides.session ?? makeSession(),
    mode: overrides.mode ?? getMode('country-pinning', POOLS),
    byCca3: overrides.byCca3 ?? byCca3Fixture,
    advance: overrides.advance ?? vi.fn(),
    finalize: overrides.finalize ?? vi.fn(),
    record: overrides.record ?? vi.fn(),
    recordDailyResult: overrides.recordDailyResult ?? vi.fn(),
  }
}

function renderAnnouncementsHook(args: AnnouncementsArgs) {
  return renderHook(() => useGameAnnouncements(args))
}

interface Captured {
  events: string[]
  detach: () => void
}

function captureAnnouncements(): Captured {
  const events: string[] = []
  const handler = (e: Event) => {
    events.push((e as CustomEvent<string>).detail)
  }
  window.addEventListener('funworldmap:announce', handler)
  return {
    events,
    detach: () => window.removeEventListener('funworldmap:announce', handler),
  }
}

describe('useGameAnnouncements', () => {
  let captured: Captured | null = null

  beforeEach(() => {
    captured = null
    // prefersReducedMotion() (called from the auto-advance branches) reads
    // window.matchMedia, which JSDOM doesn't implement by default.
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        })),
      })
    }
  })

  afterEach(() => {
    cleanup()
    captured?.detach()
    captured = null
    localStorage.clear()
  })

  it('announces target name on entering playing with a country-pinning round', () => {
    captured = captureAnnouncements()
    const session = makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      currentRound: makeCountryRound({ targetCca3: 'FRA', targetName: 'France' }),
      roundIndex: 0,
    })
    renderAnnouncementsHook(buildAnnouncementsArgs({ session }))
    expect(captured.events).toContain('Pin: France')
  })

  it('announces "Where is …" on entering playing with a city-guessing round', () => {
    captured = captureAnnouncements()
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      currentRound: makeCityRound({ targetName: 'Paris', targetCountryName: 'France' }),
      roundIndex: 0,
    })
    renderAnnouncementsHook(
      buildAnnouncementsArgs({
        session,
        mode: getMode('city-guessing', POOLS),
      }),
    )
    expect(captured.events.some((s) => /Where is Paris, France/.test(s))).toBe(true)
  })

  it('does not re-announce when round key is unchanged across rerenders', () => {
    captured = captureAnnouncements()
    const session = makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      currentRound: makeCountryRound({ targetCca3: 'FRA', targetName: 'France' }),
      roundIndex: 0,
    })
    const args = buildAnnouncementsArgs({ session })
    const { rerender } = renderHook(({ s }) => useGameAnnouncements({ ...args, session: s }), {
      initialProps: { s: session },
    })
    rerender({ s: { ...session, score: session.score + 10 } })
    expect(captured.events.filter((s) => s.includes('France')).length).toBe(1)
  })

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('auto-advances country-pinning non-final round-end after REVEAL_MS_COUNTRY (1200ms) when no animation plan', () => {
      const advance = vi.fn()
      // Reveal with clickedCca3=null yields no animation plan (skip / no-guess).
      const reveal = makeCountryReveal({ correct: false, clickedCca3: null, distanceKm: null })
      // attemptsPerRound>1 + attemptsRemaining>0 → isFinalOutcome=false, so the
      // country-pinning non-final branch fires (the one that hits REVEAL_MS_COUNTRY).
      const session = makeSession({
        status: 'round-ended',
        modeId: 'country-pinning',
        attemptsPerRound: 3,
        attemptsRemaining: 2,
        lastOutcome: makeOutcome(reveal, false),
        roundIndex: 0,
        maxRounds: 5,
      })
      renderAnnouncementsHook(buildAnnouncementsArgs({ session, advance }))
      act(() => {
        vi.advanceTimersByTime(1199)
      })
      expect(advance).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(advance).toHaveBeenCalledTimes(1)
    })

    it('calls finalize() instead of advance() when lastOutcome.endsGame is true and not country-pinning', () => {
      const advance = vi.fn()
      const finalize = vi.fn()
      // PointReveal with clickedPoint=null yields no animation plan, so the
      // city-mode branch uses REVEAL_MS_CITY (2000ms).
      const reveal = makePointReveal({ clickedPoint: null })
      const session = makeSession({
        status: 'round-ended',
        modeId: 'city-guessing',
        lastOutcome: makeOutcome(reveal, true),
      })
      renderAnnouncementsHook(
        buildAnnouncementsArgs({
          session,
          mode: getMode('city-guessing', POOLS),
          advance,
          finalize,
        }),
      )
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(finalize).toHaveBeenCalledTimes(1)
      expect(advance).not.toHaveBeenCalled()
    })
  })

  it('records personal best on game-over for free play (dailyDate=null)', () => {
    const record = vi.fn()
    const recordDailyResult = vi.fn()
    const session = makeSession({
      status: 'game-over',
      modeId: 'country-pinning',
      score: 250,
      bestStreak: 4,
      dailyDate: null,
    })
    renderAnnouncementsHook(buildAnnouncementsArgs({ session, record, recordDailyResult }))
    expect(record).toHaveBeenCalledWith(250, 4)
    expect(recordDailyResult).not.toHaveBeenCalled()
  })

  it('records daily-history on game-over when dailyDate is set, and clears resume', () => {
    localStorage.setItem(
      RESUME_KEY,
      '{"version":1,"date":"2026-05-14","modeId":"country-pinning","attempts":[]}',
    )
    const record = vi.fn()
    const recordDailyResult = vi.fn()
    const session = makeSession({
      status: 'game-over',
      modeId: 'country-pinning',
      score: 80,
      dailyDate: '2026-05-14',
      currentAttempts: [makeAttempt({ pointsEarned: 80 })],
    })
    renderAnnouncementsHook(buildAnnouncementsArgs({ session, record, recordDailyResult }))
    expect(recordDailyResult).toHaveBeenCalledWith(
      '2026-05-14',
      'country-pinning',
      expect.objectContaining({ score: 80, attempts: expect.any(Array) as unknown[] }),
    )
    expect(record).not.toHaveBeenCalled()
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('dedups record() across rerenders when status stays game-over', () => {
    const record = vi.fn()
    const session = makeSession({
      status: 'game-over',
      modeId: 'country-pinning',
      score: 100,
      dailyDate: null,
    })
    const args = buildAnnouncementsArgs({ session, record })
    const { rerender } = renderHook(({ s }) => useGameAnnouncements({ ...args, session: s }), {
      initialProps: { s: session },
    })
    rerender({ s: { ...session, score: 100 } })
    expect(record).toHaveBeenCalledTimes(1)
  })
})
