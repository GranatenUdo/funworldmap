/**
 * Characterization tests for useRevealMapEffects. Drives the hook in isolation
 * via @testing-library/react's renderHook (matching the Phase 1/3 hook tests)
 * and asserts observable side-effects on a fake mapRef stub.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useRevealMapEffects } from '../useRevealMapEffects'
import {
  makeCityRound,
  makeCountryRound,
  makeSession,
} from '../../shared/__tests__/factories'
import { byCca3Fixture, citiesFixture, countriesFixture } from './fixtures'
import { createFakeMapRef } from './fakeMapRef'
import { getMode } from '../../modes'
import type { CountryReveal, GuessOutcome } from '../../shared/types'

const POOLS = { countries: countriesFixture, cities: citiesFixture }

type RevealArgs = Parameters<typeof useRevealMapEffects>[0]

interface BuildRevealArgsOverrides {
  session?: RevealArgs['session']
  mode?: RevealArgs['mode']
  mapRef?: RevealArgs['mapRef']
  byCca3?: RevealArgs['byCca3']
  submitGuessInput?: RevealArgs['submitGuessInput']
}

function buildRevealArgs(overrides: BuildRevealArgsOverrides = {}): RevealArgs {
  return {
    session: overrides.session ?? makeSession(),
    mode: overrides.mode ?? getMode('country-pinning', POOLS),
    mapRef: overrides.mapRef ?? createFakeMapRef().ref,
    byCca3: overrides.byCca3 ?? byCca3Fixture,
    submitGuessInput: overrides.submitGuessInput ?? vi.fn(),
  }
}

function renderRevealHook(args: RevealArgs) {
  return renderHook(() => useRevealMapEffects(args))
}

function makeCountryReveal(overrides: Partial<CountryReveal> = {}): CountryReveal {
  return {
    kind: 'country',
    correct: false,
    targetCca3: 'FRA',
    clickedCca3: 'USA',
    clickedName: 'United States',
    distanceKm: 7000,
    ...overrides,
  }
}

function makeOutcome(reveal: CountryReveal, endsGame = false): GuessOutcome {
  return { pointsEarned: 0, livesDelta: 0, reveal, endsGame }
}

describe('useRevealMapEffects', () => {
  beforeEach(() => {
    // prefersReducedMotion() reads window.matchMedia, which JSDOM doesn't
    // implement by default.
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
    // The reveal-arc rAF loop calls window.requestAnimationFrame; JSDOM's
    // stub is fine but we wrap it so we can keep tests deterministic without
    // pumping frames.
    if (!window.requestAnimationFrame) {
      Object.defineProperty(window, 'requestAnimationFrame', {
        writable: true,
        configurable: true,
        value: vi.fn(() => 0),
      })
      Object.defineProperty(window, 'cancelAnimationFrame', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('paints green correct-country border on round-ended (correct country reveal)', () => {
    const fake = createFakeMapRef()
    // Correct reveal with clickedCca3=null avoids triggering the arc-animation
    // path (computeRevealAnimationPlan returns null), so the only setFilter /
    // setPaintProperty calls are the border-paint we want to assert.
    const reveal = makeCountryReveal({ correct: true, clickedCca3: null, distanceKm: null })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))
    expect(fake.calls.setFilter).toHaveBeenCalledWith(
      'country-hover-border',
      ['==', ['get', 'id'], 'FRA'],
    )
    expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
      'country-hover-border',
      'line-color',
      '#22c55e',
    )
  })

  it('paints orange wrong-country border on round-ended (wrong country reveal)', () => {
    const fake = createFakeMapRef()
    const reveal = makeCountryReveal({ correct: false, clickedCca3: null, distanceKm: null })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))
    expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
      'country-hover-border',
      'line-color',
      '#f59e0b',
    )
  })

  it('clears hoverBorder filter on cleanup (round-ended → playing)', () => {
    const fake = createFakeMapRef()
    const reveal = makeCountryReveal({ correct: true, clickedCca3: null, distanceKm: null })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: makeOutcome(reveal),
    })
    const args = buildRevealArgs({ session, mapRef: fake.ref })
    const { rerender } = renderHook(
      ({ s }) => useRevealMapEffects({ ...args, session: s }),
      { initialProps: { s: session } },
    )
    fake.calls.setFilter.mockClear()
    // Transition to 'playing' invalidates the effect → cleanup runs → filter
    // is reset to the empty id.
    rerender({ s: makeSession({ ...session, status: 'playing', lastOutcome: null }) })
    expect(fake.calls.setFilter).toHaveBeenCalledWith(
      'country-hover-border',
      ['==', ['get', 'id'], ''],
    )
  })

  it('flashes clicked country with correctness colour on intermediate attempt (best-of-N)', () => {
    const fake = createFakeMapRef()
    // Daily best-of-3: attemptsPerRound>1, status='playing', currentAttempts
    // grows from 0 → 1 across rerenders. Initial render captures the
    // attempt-count anchor (0); the rerender to count=1 paints the flash.
    const baseSession = makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      attemptsPerRound: 3,
      attemptsRemaining: 2,
      currentAttempts: [],
    })
    const args = buildRevealArgs({ session: baseSession, mapRef: fake.ref })
    const { rerender } = renderHook(
      ({ s }) => useRevealMapEffects({ ...args, session: s }),
      { initialProps: { s: baseSession } },
    )
    fake.calls.setFilter.mockClear()
    fake.calls.setPaintProperty.mockClear()
    const wrongAttempt = {
      pointsEarned: 0,
      input: { kind: 'country' as const, cca3: 'USA', name: 'United States', centroid: [-97, 38] as [number, number] },
      reveal: makeCountryReveal({ correct: false, clickedCca3: 'USA' }),
    }
    rerender({
      s: makeSession({
        ...baseSession,
        currentAttempts: [wrongAttempt],
        attemptsRemaining: 1,
      }),
    })
    expect(fake.calls.setFilter).toHaveBeenCalledWith(
      'country-hover-border',
      ['==', ['get', 'id'], 'USA'],
    )
    expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
      'country-hover-border',
      'line-color',
      '#f59e0b',
    )
  })

  it("flyTo on round-start when mode.initialCameraView === 'world'", () => {
    const fake = createFakeMapRef()
    // city-guessing is the only mode with initialCameraView='world'.
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      currentRound: makeCityRound(),
    })
    renderRevealHook(buildRevealArgs({
      session,
      mode: getMode('city-guessing', POOLS),
      mapRef: fake.ref,
    }))
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
    const firstCall = fake.calls.flyTo.mock.calls[0][0]
    expect(firstCall).toMatchObject({ zoom: expect.any(Number), center: expect.any(Array) })
  })

  it('attaches click handler in city-guessing playing state, detaches on unmount', () => {
    const fake = createFakeMapRef()
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      currentRound: makeCityRound(),
    })
    const { unmount } = renderRevealHook(buildRevealArgs({
      session,
      mode: getMode('city-guessing', POOLS),
      mapRef: fake.ref,
    }))
    expect(fake.calls.on).toHaveBeenCalledWith('click', expect.any(Function))
    unmount()
    expect(fake.calls.off).toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('does NOT attach click handler in country-pinning mode', () => {
    const fake = createFakeMapRef()
    const session = makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      currentRound: makeCountryRound(),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))
    expect(fake.calls.on).not.toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('clears reveal sources on transition to idle', () => {
    const fake = createFakeMapRef()
    const session = makeSession({ status: 'idle' })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))
    // clearRevealSources calls getSource() then setData({}) on both reveal sources.
    expect(fake.calls.getSource).toHaveBeenCalledWith('game-reveal-marker')
    expect(fake.calls.getSource).toHaveBeenCalledWith('game-reveal-line')
    expect(fake.calls.setData).toHaveBeenCalled()
  })
})
