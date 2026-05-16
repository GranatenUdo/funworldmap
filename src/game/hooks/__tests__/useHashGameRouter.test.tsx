/**
 * Characterization tests for useHashGameRouter — covers the major branches of
 * the hash bootstrap, deferred-pool drain, deep-link analytics, intermediate-
 * attempt telemetry, and the wasGameOver/atomicRestart bug-#32 workaround.
 *
 * Tests observable behaviour only: mock dispatcher calls (start/resume/
 * restart/endGame), captured analytics events on window.__testAnalytics, and
 * window.location.hash side-effects. No assertions on internal hook state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useHashGameRouter, type UseHashGameRouterOptions } from '../useHashGameRouter'
import { makeSession } from '../../shared/__tests__/factories'
import { citiesFixture, countriesFixture } from './fixtures'
import { RESUME_KEY } from '../../daily/resume'
import { toLocalDateString } from '../../daily/dates'
import type { DailyPuzzleRef } from '../../daily/types'
import { installAnalyticsCapture, type AnalyticsCapture } from '../../../test/analyticsCapture'

type RouterArgs = UseHashGameRouterOptions

interface BuildRouterArgsOverrides {
  session?: RouterArgs['session']
  pools?: RouterArgs['pools']
  dailyPuzzles?: RouterArgs['dailyPuzzles']
  dailyHistoryGet?: RouterArgs['dailyHistoryGet']
  start?: RouterArgs['start']
  resume?: RouterArgs['resume']
  restart?: RouterArgs['restart']
  endGame?: RouterArgs['endGame']
}

const noopDailyPuzzles = {
  status: 'ready' as const,
  index: null,
  byDate: (): DailyPuzzleRef | null => null,
}

function buildRouterArgs(overrides: BuildRouterArgsOverrides = {}): RouterArgs {
  return {
    session: overrides.session ?? makeSession(),
    pools: overrides.pools ?? { countries: countriesFixture, cities: citiesFixture },
    dailyPuzzles: overrides.dailyPuzzles ?? noopDailyPuzzles,
    dailyHistoryGet: overrides.dailyHistoryGet ?? (() => null),
    start: overrides.start ?? vi.fn(),
    resume: overrides.resume ?? vi.fn(),
    restart: overrides.restart ?? vi.fn(),
    endGame: overrides.endGame ?? vi.fn(),
  }
}

function renderRouterHook(args: RouterArgs) {
  return renderHook((p: RouterArgs) => useHashGameRouter(p), { initialProps: args })
}

describe('useHashGameRouter', () => {
  let captured: AnalyticsCapture

  beforeEach(() => {
    captured = installAnalyticsCapture()
    window.location.hash = ''
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    captured.uninstall()
    window.location.hash = ''
    localStorage.clear()
  })

  it('starts a free game on hash bootstrap when status=idle, pools loaded, valid game route', () => {
    window.location.hash = '#game/country-pinning'
    const start = vi.fn()
    renderRouterHook(buildRouterArgs({ start }))
    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(
      'country-pinning',
      expect.objectContaining({ kind: 'country-pinning' }),
      // maxRounds — country-pinning is endless (null) per modes registry
      null,
    )
    expect(captured.events.find((e) => e.name === 'free_started')).toBeDefined()
  })

  it('defers start when pools are empty, then drains once pools arrive', () => {
    window.location.hash = '#game/country-pinning'
    const start = vi.fn()
    const initialArgs = buildRouterArgs({
      start,
      pools: { countries: [], cities: [] },
    })
    const { rerender } = renderRouterHook(initialArgs)
    // Pools empty → bootstrap defers; no start yet.
    expect(start).not.toHaveBeenCalled()
    const nextArgs = buildRouterArgs({
      start,
      pools: { countries: countriesFixture, cities: citiesFixture },
    })
    rerender(nextArgs)
    // Pools arrived → start fires. (In real production flow the reducer
    // updates session.status to 'playing' before the drain effect runs, so
    // only one dispatch lands; with mocks, both bootstrap-rerun and drain
    // can fire — we assert at-least-once rather than exactly-once to keep
    // the test resilient to the harmless duplicate.)
    expect(start).toHaveBeenCalled()
    expect(start).toHaveBeenCalledWith(
      'country-pinning',
      expect.objectContaining({ kind: 'country-pinning' }),
      null,
    )
  })

  it('emits deep_link_opened with outcome=reveal exactly once for a reveal-route hash (dedup)', () => {
    window.location.hash = '#daily/2026-05-13/country-pinning/reveal'
    const session = makeSession({ status: 'idle' })
    const args = buildRouterArgs({ session })
    const { rerender } = renderRouterHook(args)
    const initialCount = captured.events.filter(
      (e) => e.name === 'deep_link_opened' && e.props.outcome === 'reveal',
    ).length
    expect(initialCount).toBe(1)
    // Unrelated rerender — same hash, deps unchanged — should not re-emit.
    rerender(buildRouterArgs({ session: makeSession({ status: 'idle', score: 42 }) }))
    const afterCount = captured.events.filter(
      (e) => e.name === 'deep_link_opened' && e.props.outcome === 'reveal',
    ).length
    expect(afterCount).toBe(1)
  })

  it('dispatches restart (not start+endGame) when arriving in game-over with a playable route', () => {
    window.location.hash = '#game/country-pinning'
    const start = vi.fn()
    const restart = vi.fn()
    const endGame = vi.fn()
    const session = makeSession({ status: 'game-over' })
    renderRouterHook(buildRouterArgs({ session, start, restart, endGame }))
    expect(restart).toHaveBeenCalledTimes(1)
    expect(restart).toHaveBeenCalledWith(
      'country-pinning',
      expect.objectContaining({ kind: 'country-pinning' }),
      null,
    )
    expect(start).not.toHaveBeenCalled()
    expect(endGame).not.toHaveBeenCalled()
  })

  it('redirects future-dated daily to root', () => {
    window.location.hash = '#daily/2099-12-31/country-pinning'
    const start = vi.fn()
    const endGame = vi.fn()
    renderRouterHook(buildRouterArgs({ start, endGame }))
    expect(window.location.hash).toBe('')
    expect(
      captured.events.find(
        (e) =>
          e.name === 'deep_link_opened' &&
          e.props.outcome === 'redirect' &&
          e.props.dateKind === 'future',
      ),
    ).toBeDefined()
    expect(start).not.toHaveBeenCalled()
  })

  it('redirects past-dated daily to /reveal', () => {
    window.location.hash = '#daily/2020-01-01/country-pinning'
    const start = vi.fn()
    renderRouterHook(buildRouterArgs({ start }))
    expect(window.location.hash).toMatch(/\/reveal$/)
    expect(window.location.hash).toContain('daily/2020-01-01/country-pinning/reveal')
    expect(
      captured.events.find(
        (e) =>
          e.name === 'deep_link_opened' &&
          e.props.outcome === 'redirect' &&
          e.props.dateKind === 'past',
      ),
    ).toBeDefined()
    expect(start).not.toHaveBeenCalled()
  })

  it('resumes from localStorage when a daily resume blob matches today + mode', () => {
    const today = toLocalDateString(new Date())
    localStorage.setItem(
      RESUME_KEY,
      JSON.stringify({
        version: 1,
        date: today,
        modeId: 'country-pinning',
        attempts: [
          {
            input: { kind: 'country', cca3: 'USA', name: 'United States', centroid: [-97, 38] },
            reveal: {
              kind: 'country',
              correct: false,
              targetCca3: 'FRA',
              clickedCca3: 'USA',
              clickedName: 'United States',
              distanceKm: 7000,
            },
            pointsEarned: 40,
          },
        ],
      }),
    )
    window.location.hash = `#daily/${today}/country-pinning`
    const resume = vi.fn()
    const start = vi.fn()
    const puzzle = {
      country: { cca3: 'USA' },
      city: { id: 'USA-new-york' },
    } as unknown as DailyPuzzleRef
    renderRouterHook(
      buildRouterArgs({
        resume,
        start,
        dailyPuzzles: {
          status: 'ready',
          index: null,
          byDate: () => puzzle,
        },
      }),
    )
    expect(resume).toHaveBeenCalledTimes(1)
    expect(resume).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'country-pinning',
        dailyDate: today,
        attemptsPerRound: 3,
        attempts: expect.any(Array),
      }),
    )
    expect(start).not.toHaveBeenCalled()
    expect(
      captured.events.find(
        (e) =>
          e.name === 'deep_link_opened' &&
          e.props.outcome === 'resume' &&
          e.props.dateKind === 'today',
      ),
    ).toBeDefined()
  })

  it('fires daily_attempted on intermediate attempt when attemptsPerRound > 1', () => {
    // No hash so the bootstrap effect is inert; we only exercise the
    // telemetry effect via session prop change. The "anchor on enter playing"
    // path: render first with playing + zero attempts (sets the anchor), then
    // re-render with one attempt — the count growth fires the event.
    const playingZero = makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      attemptsPerRound: 3,
      currentAttempts: [],
    })
    const playingOne = makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      attemptsPerRound: 3,
      currentAttempts: [
        {
          input: { kind: 'country', cca3: 'USA', name: 'United States', centroid: [-97, 38] },
          reveal: {
            kind: 'country',
            correct: false,
            targetCca3: 'FRA',
            clickedCca3: 'USA',
            clickedName: 'United States',
            distanceKm: 7000,
          },
          pointsEarned: 40,
        },
      ],
    })
    const { rerender } = renderRouterHook(buildRouterArgs({ session: playingZero }))
    captured.reset()
    rerender(buildRouterArgs({ session: playingOne }))
    const event = captured.events.find((e) => e.name === 'daily_attempted')
    expect(event).toBeDefined()
    expect(event!.props).toMatchObject({
      mode: 'country-pinning',
      attemptIndex: 1,
    })
  })

  it('calls endGame when leaving a game route while non-idle', () => {
    window.location.hash = '#game/country-pinning'
    const endGame = vi.fn()
    const start = vi.fn()
    const playingSession = makeSession({ status: 'playing', modeId: 'country-pinning' })
    renderRouterHook(buildRouterArgs({ session: playingSession, start, endGame }))
    // The hash listener triggers re-evaluation on hashchange — clear hash + dispatch.
    expect(endGame).not.toHaveBeenCalled()
    window.location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(endGame).toHaveBeenCalledTimes(1)
  })

  it('hashchange listener triggers re-evaluation for runtime navigation', () => {
    // Bootstrap with empty hash — no start called.
    const start = vi.fn()
    renderRouterHook(buildRouterArgs({ start }))
    expect(start).not.toHaveBeenCalled()
    // Navigate at runtime via hashchange.
    window.location.hash = '#game/country-pinning'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(
      'country-pinning',
      expect.objectContaining({ kind: 'country-pinning' }),
      null,
    )
  })
})
