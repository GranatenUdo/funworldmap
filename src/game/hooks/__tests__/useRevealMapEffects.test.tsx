/**
 * Characterization tests for useRevealMapEffects. Drives the hook in isolation
 * via @testing-library/react's renderHook (matching the Phase 1/3 hook tests)
 * and asserts observable side-effects on a fake mapRef stub.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useRevealMapEffects } from '../useRevealMapEffects'
import { REVEAL_CORRECT, REVEAL_WRONG } from '../../../lib/mapPalette'
import {
  makeCityRound,
  makeCountryReveal,
  makeCountryRound,
  makeOutcome,
  makePointReveal,
  makeSession,
} from '../../shared/__tests__/factories'
import { byCca3Fixture } from './fixtures'
import { createFakeMapRef } from '../../../test/fakeMapRef'

type RevealArgs = Parameters<typeof useRevealMapEffects>[0]

interface BuildRevealArgsOverrides {
  session?: RevealArgs['session']
  mapRef?: RevealArgs['mapRef']
  byCca3?: RevealArgs['byCca3']
  submitGuessInput?: RevealArgs['submitGuessInput']
}

function buildRevealArgs(overrides: BuildRevealArgsOverrides = {}): RevealArgs {
  return {
    session: overrides.session ?? makeSession(),
    mapRef: overrides.mapRef ?? createFakeMapRef().ref,
    byCca3: overrides.byCca3 ?? byCca3Fixture,
    submitGuessInput: overrides.submitGuessInput ?? vi.fn(),
  }
}

function renderRevealHook(args: RevealArgs) {
  return renderHook(() => useRevealMapEffects(args))
}

/**
 * The marker source and the line source share the same `setData` spy (the fake
 * `getSource` returns one stub). Filter to the calls that carry Point features
 * so marker assertions ignore the LineString arc and the empty-clear calls.
 */
function pointMarkerSetDataCalls(fake: ReturnType<typeof createFakeMapRef>) {
  return fake.calls.setData.mock.calls
    .map(
      (c) =>
        c[0] as {
          features?: Array<{
            geometry?: { type?: string; coordinates?: [number, number] }
            properties?: { role?: string }
          }>
        },
    )
    .filter((d) => d.features?.some((f) => f.geometry?.type === 'Point'))
}

describe('useRevealMapEffects', () => {
  beforeEach(() => {
    // Always reset matchMedia to non-reducing — individual tests can override
    // for reduced-motion paths, and beforeEach restores the default afterward.
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
    expect(fake.calls.setFilter).toHaveBeenCalledWith('country-hover-border', [
      '==',
      ['get', 'id'],
      'FRA',
    ])
    expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
      'country-hover-border',
      'line-color',
      REVEAL_CORRECT,
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
      REVEAL_WRONG,
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
    const { rerender } = renderHook(({ s }) => useRevealMapEffects({ ...args, session: s }), {
      initialProps: { s: session },
    })
    fake.calls.setFilter.mockClear()
    // Transition to 'playing' invalidates the effect → cleanup runs → filter
    // is reset to the empty id.
    rerender({ s: makeSession({ ...session, status: 'playing', lastOutcome: null }) })
    expect(fake.calls.setFilter).toHaveBeenCalledWith('country-hover-border', [
      '==',
      ['get', 'id'],
      '',
    ])
  })

  it('does NOT flyTo at round-start (camera is preserved across game lifecycle)', () => {
    const fake = createFakeMapRef()
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      currentRound: makeCityRound(),
    })
    renderRevealHook(
      buildRevealArgs({
        session,
        mapRef: fake.ref,
      }),
    )
    expect(fake.calls.flyTo).not.toHaveBeenCalled()
  })

  it('attaches click handler in city-guessing playing state, detaches on unmount', () => {
    const fake = createFakeMapRef()
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      currentRound: makeCityRound(),
    })
    const { unmount } = renderRevealHook(
      buildRevealArgs({
        session,
        mapRef: fake.ref,
      }),
    )
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

  it('calls easeTo once on city wrong-guess reveal (not jumpTo per frame)', () => {
    const fake = createFakeMapRef()
    // Wrong guess with a known clicked point (not at the target). Triggers
    // the arc-animation branch of the round-ended geometry effect.
    const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    // easeTo should be called exactly once with center = target.
    expect(fake.calls.easeTo).toHaveBeenCalledTimes(1)
    const arg = fake.calls.easeTo.mock.calls[0][0] as { center: [number, number]; duration: number }
    expect(arg.center).toEqual([2.3522, 48.8566])
    expect(arg.duration).toBeGreaterThan(0)

    // jumpTo should still be called once (to snap to the guess start), but
    // NOT per frame.
    expect(fake.calls.jumpTo.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('city wrong-guess reveal renders a guess marker at the clicked point alongside the target', () => {
    const fake = createFakeMapRef()
    // Wrong guess with a known clicked point. The reveal must mark BOTH the
    // actual city and where the user clicked — otherwise a near-perfect guess
    // (tiny arc) leaves the guess invisible.
    const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    const markerCalls = pointMarkerSetDataCalls(fake)
    expect(markerCalls.length).toBeGreaterThanOrEqual(1)
    const features = markerCalls.at(-1)!.features!
    const target = features.find((f) => f.properties?.role === 'target')
    const guess = features.find((f) => f.properties?.role === 'guess')
    expect(target?.geometry?.coordinates).toEqual([2.3522, 48.8566]) // actual city (Paris)
    expect(guess?.geometry?.coordinates).toEqual([-10, 40]) // where the user clicked
  })

  it('country wrong-guess reveal renders only the target marker (no guess marker)', () => {
    const fake = createFakeMapRef()
    // A known clicked country yields an animation plan, but the clicked location
    // is conveyed by the border highlight + arc — only city (point) reveals add
    // a second guess dot. This pins the reveal.kind === 'point' guard.
    const reveal = makeCountryReveal({
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'USA',
      clickedName: 'United States',
      distanceKm: 7000,
    })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    const markerCalls = pointMarkerSetDataCalls(fake)
    expect(markerCalls.length).toBeGreaterThanOrEqual(1)
    const features = markerCalls.at(-1)!.features!
    expect(features).toHaveLength(1)
    expect(features[0].properties?.role).toBe('target')
  })

  it('calls setData on the line source exactly once with the full tessellated arc', () => {
    const fake = createFakeMapRef()
    const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    // The line source's setData should be called for the LineString — once
    // with the full arc (65 vertices = 64 tessellated segments).
    const lineSetDataCalls = fake.calls.setData.mock.calls.filter(
      (c) =>
        (c[0] as { features?: Array<{ geometry?: { type: string } }> }).features?.[0]?.geometry
          ?.type === 'LineString',
    )
    expect(lineSetDataCalls).toHaveLength(1)
    const data = lineSetDataCalls[0][0] as {
      features: Array<{ geometry: { coordinates: number[][] } }>
    }
    expect(data.features[0].geometry.coordinates).toHaveLength(65)
  })

  it('drives line growth via line-gradient paint property (animated path)', () => {
    const fake = createFakeMapRef()
    const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    // The gradient must be set at least once — on entry, with progress 0
    // (the start of the animation). Test environments may or may not pump
    // rAF; the entry call is the deterministic checkpoint.
    const gradientCalls = fake.calls.setPaintProperty.mock.calls.filter(
      (c) => c[1] === 'line-gradient',
    )
    expect(gradientCalls.length).toBeGreaterThanOrEqual(1)
    // First gradient call sets boundary=0 (the line starts fully hidden).
    // rAF isn't pumped in this test env, so only the synchronous entry call
    // is observable here; the boundary value confirms the entry path is
    // correct without depending on animation progress.
    const firstExpr = gradientCalls[0][2] as Array<unknown>
    expect(firstExpr[0]).toBe('step')
    expect(firstExpr[3]).toBe(0)
  })

  it('clears city reveal artifacts when round transitions from round-ended to playing', () => {
    const fake = createFakeMapRef()
    const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 })
    const roundEndedSession = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    const { rerender } = renderHook((args: RevealArgs) => useRevealMapEffects(args), {
      initialProps: buildRevealArgs({ session: roundEndedSession, mapRef: fake.ref }),
    })

    // Reset the setData spy so we only observe what happens on cleanup.
    fake.calls.setData.mockClear()

    // Rerender with the next round playing — this triggers the round-ended
    // effect cleanup.
    const playingSession = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      roundIndex: 1,
      currentRound: makeCityRound({ targetId: 'GBR-london' }),
    })
    rerender(buildRevealArgs({ session: playingSession, mapRef: fake.ref }))

    // After the transition, the marker AND line sources should have been
    // setData()'d to empty FeatureCollections (clearRevealSources behavior).
    const emptySetDataCalls = fake.calls.setData.mock.calls.filter((c) => {
      const arg = c[0] as { features?: unknown[] }
      return Array.isArray(arg.features) && arg.features.length === 0
    })
    expect(emptySetDataCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('clears country reveal artifacts when round transitions from round-ended to playing', () => {
    const fake = createFakeMapRef()
    // Country wrong-guess with a known clickedCca3 triggers computeRevealAnimationPlan,
    // which uses the same marker + line sources as city reveals.
    const reveal = makeCountryReveal({
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'USA',
      clickedName: 'United States',
      distanceKm: 1500,
    })
    const roundEndedSession = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: makeOutcome(reveal),
    })
    const { rerender } = renderHook((args: RevealArgs) => useRevealMapEffects(args), {
      initialProps: buildRevealArgs({ session: roundEndedSession, mapRef: fake.ref }),
    })

    fake.calls.setData.mockClear()

    const playingSession = makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      roundIndex: 1,
      currentRound: makeCountryRound({ targetCca3: 'JPN' }),
    })
    rerender(buildRevealArgs({ session: playingSession, mapRef: fake.ref }))

    const emptySetDataCalls = fake.calls.setData.mock.calls.filter((c) => {
      const arg = c[0] as { features?: unknown[] }
      return Array.isArray(arg.features) && arg.features.length === 0
    })
    expect(emptySetDataCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('reduced-motion: no easeTo, jumpTo target, gradient fully revealed', () => {
    // Override the matchMedia mock to report reduced-motion preference.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })),
    })
    const fake = createFakeMapRef()
    const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    expect(fake.calls.easeTo).not.toHaveBeenCalled()
    expect(fake.calls.jumpTo).toHaveBeenCalled()
    const lastJumpTo = fake.calls.jumpTo.mock.calls.at(-1)?.[0] as
      | { center: [number, number] }
      | undefined
    expect(lastJumpTo?.center).toEqual([2.3522, 48.8566])

    // Gradient set to progress=1 (full line) at least once.
    const fullGradient = fake.calls.setPaintProperty.mock.calls.find((c) => {
      if (c[1] !== 'line-gradient') return false
      const expr = c[2] as Array<unknown>
      // ['step', ['line-progress'], color, boundary, transparent]
      return Array.isArray(expr) && expr[0] === 'step' && expr[3] === 1
    })
    expect(fullGradient).toBeDefined()
  })
})

describe('useRevealMapEffects — city reveal', () => {
  it('city skip reveal renders a single target marker (no guess)', () => {
    const fake = createFakeMapRef()
    // City skip-only path: clickedPoint=null, distanceKm=MAX. plan returns null,
    // round-end effect renders the target marker only (no arc, no guess).
    const reveal = makePointReveal({ clickedPoint: null, distanceKm: 20015 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: makeOutcome(reveal),
    })
    renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))

    const markerCalls = pointMarkerSetDataCalls(fake)
    expect(markerCalls.length).toBeGreaterThanOrEqual(1)
    const features = markerCalls.at(-1)!.features!
    expect(features).toHaveLength(1)
    expect(features[0].properties?.role).toBe('target')
  })
})
