import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import type { GameSession, GameStatus } from '../../game/shared/types'
import type { CountryData } from '../../lib/types'
import { FINE_POINTER_MEDIA_QUERY } from '../../lib/layoutConstants'
import { EMPTY_FILTER, LAYER } from '../../lib/mapLayers'
import { takeOrigin } from '../../lib/selectionOrigin'
import { makeCountryData } from '../../test/countryFixtures'
import { createFakeMapRef } from '../../test/fakeMapRef'
import { stubMatchMedia } from '../../test/matchMediaStub'

// Stable refs (like MapProvider's useMemo'd refs) + a mutable session, so a
// rerender that only changes session.status does NOT change any effect dep
// except where intended. Lets us test the hook's wiring without a real map.
const h = vi.hoisted(() => {
  const session: Pick<GameSession, 'modeId' | 'status'> = {
    modeId: 'city-guessing',
    status: 'idle',
  }
  return {
    mapRef: { current: null as maplibregl.Map | null },
    tooltipRef: { current: null as HTMLDivElement | null },
    session,
  }
})

vi.mock('../useMap', () => ({
  useMap: () => ({ mapRef: h.mapRef, tooltipRef: h.tooltipRef }),
}))
vi.mock('../../game/shared/GameSessionProvider', () => ({
  useGameSessionContext: () => ({ session: h.session as unknown as GameSession }),
}))

import { mapHoverTooltipEnabled, useMapInteractions } from '../useMapInteractions'

const baseOptions = {
  byNumeric: new Map<string, CountryData>(),
  onSelect: () => {},
  onDeselect: () => {},
  onGameOceanMiss: () => {},
  comparePickingMode: false,
}

beforeEach(() => {
  h.mapRef.current = null
  h.tooltipRef.current = null
  h.session = { modeId: 'city-guessing', status: 'idle' }
})

describe('mapHoverTooltipEnabled', () => {
  // The country name + capital tooltip leaks the answer during active play:
  // in country-pinning the name IS the answer; in city-guessing it narrows the
  // target city's location. So it is suppressed for EVERY mode while guessing —
  // the bug was suppressing it for country-pinning only.
  it('suppresses the tooltip while a round is in play', () => {
    expect(mapHoverTooltipEnabled('playing')).toBe(false)
  })

  it.each<GameStatus>(['idle', 'round-ended', 'game-over'])(
    'shows the tooltip when not actively guessing (%s)',
    (status) => {
      expect(mapHoverTooltipEnabled(status)).toBe(true)
    },
  )
})

describe('useMapInteractions tooltip wiring', () => {
  it('hides a leftover reveal-phase tooltip the moment a new round starts (status → playing)', () => {
    const div = document.createElement('div')
    h.tooltipRef.current = div
    // mapRef null → the map-listener effect early-returns; this exercises the
    // status-driven clear effect in isolation.
    h.session = { modeId: 'city-guessing', status: 'round-ended' }
    const { rerender } = renderHook(() => useMapInteractions({ ...baseOptions, loaded: false }))

    div.classList.add('visible') // tooltip shown while hovering during the reveal
    h.session = { ...h.session, status: 'playing' } // round auto-advances
    rerender()

    expect(div.classList.contains('visible')).toBe(false)
  })

  it('does not strip the tooltip when status changes to a non-playing state', () => {
    const div = document.createElement('div')
    h.tooltipRef.current = div
    h.session = { modeId: 'country-pinning', status: 'playing' }
    const { rerender } = renderHook(() => useMapInteractions({ ...baseOptions, loaded: false }))

    div.classList.add('visible')
    h.session = { ...h.session, status: 'round-ended' } // reveal phase — tooltip allowed
    rerender()

    expect(div.classList.contains('visible')).toBe(true)
  })

  it('attaches map listeners once and does not re-register them on a status-only change', () => {
    h.tooltipRef.current = document.createElement('div')
    const on = vi.fn()
    h.mapRef.current = {
      on,
      off: vi.fn(),
      getCanvas: () => ({ style: {} }) as HTMLCanvasElement,
      doubleClickZoom: { disable: vi.fn() },
    } as unknown as maplibregl.Map
    h.session = { modeId: 'city-guessing', status: 'playing' }

    const { rerender } = renderHook(() => useMapInteractions({ ...baseOptions, loaded: true }))
    const initialOnCalls = on.mock.calls.length
    expect(initialOnCalls).toBeGreaterThan(0)

    h.session = { ...h.session, status: 'round-ended' } // playing → round-ended
    rerender()

    // The listener stack must survive the status change (read status live via a
    // ref instead of re-attaching on every round boundary).
    expect(on.mock.calls.length).toBe(initialOnCalls)
  })
})

describe('useMapInteractions movestart', () => {
  // A camera move without mouse movement (search select, deep link, reveal
  // fly-to) must not leave a hover highlight or tooltip describing the
  // previous view (2026-07-10 review, batch-1 spec item 2).

  it('clears hover feature state, filters, and tooltip on a programmatic camera move', () => {
    const fake = createFakeMapRef()
    const tooltip = document.createElement('div')
    h.mapRef.current = fake.map
    h.tooltipRef.current = tooltip
    const country = makeCountryData()
    renderHook(() =>
      useMapInteractions({
        ...baseOptions,
        byNumeric: new Map([[country.ccn3, country]]),
        loaded: true,
      }),
    )

    // Seed hover state via the layer mousemove handler.
    fake.fire('mousemove', LAYER.fill, { features: [{ id: country.ccn3 }] })
    expect(tooltip.classList.contains('visible')).toBe(true)
    expect(fake.calls.setFeatureState).toHaveBeenCalledWith(
      { source: 'countries', id: country.ccn3 },
      { hover: true },
    )
    fake.calls.setFeatureState.mockClear()
    fake.calls.setFilter.mockClear()

    // Programmatic moves (flyTo/easeTo) carry no originalEvent.
    fake.fire('movestart', null, {})

    expect(fake.calls.setFeatureState).toHaveBeenCalledWith(
      { source: 'countries', id: country.ccn3 },
      { hover: false },
    )
    expect(fake.calls.setFilter).toHaveBeenCalledWith(LAYER.extrusion, EMPTY_FILTER)
    expect(fake.calls.setFilter).toHaveBeenCalledWith(LAYER.hoverBorder, EMPTY_FILTER)
    expect(tooltip.classList.contains('visible')).toBe(false)
  })

  it('preserves a live hover during USER camera gestures (wheel/drag carry originalEvent)', () => {
    const fake = createFakeMapRef()
    const tooltip = document.createElement('div')
    h.mapRef.current = fake.map
    h.tooltipRef.current = tooltip
    const country = makeCountryData()
    renderHook(() =>
      useMapInteractions({
        ...baseOptions,
        byNumeric: new Map([[country.ccn3, country]]),
        loaded: true,
      }),
    )

    fake.fire('mousemove', LAYER.fill, { features: [{ id: country.ccn3 }] })
    fake.calls.setFeatureState.mockClear()
    fake.calls.setFilter.mockClear()

    // A stationary wheel-zoom fires movestart with the DOM event attached —
    // the hover under the cursor must survive it.
    fake.fire('movestart', null, { originalEvent: { type: 'wheel' } })

    expect(fake.calls.setFeatureState).not.toHaveBeenCalled()
    expect(fake.calls.setFilter).not.toHaveBeenCalled()
    expect(tooltip.classList.contains('visible')).toBe(true)
  })

  it('is a safe no-op when nothing is hovered', () => {
    const fake = createFakeMapRef()
    const tooltip = document.createElement('div')
    h.mapRef.current = fake.map
    h.tooltipRef.current = tooltip
    renderHook(() => useMapInteractions({ ...baseOptions, loaded: true }))

    fake.fire('movestart', null, {})

    expect(fake.calls.setFeatureState).not.toHaveBeenCalled()
    expect(fake.calls.setFilter).toHaveBeenCalledWith(LAYER.extrusion, EMPTY_FILTER)
    expect(fake.calls.setFilter).toHaveBeenCalledWith(LAYER.hoverBorder, EMPTY_FILTER)
    expect(tooltip.classList.contains('visible')).toBe(false)
  })
})

describe('useMapInteractions click-origin marking', () => {
  // markClickOrigin may only fire when the click will produce a selection
  // hashchange — takeOrigin() runs solely in resolveHash, so an unconsumed
  // mark leaks preserveZoom into the NEXT auto selection (2026-07-10 review).

  function renderWithCountry(opts: { comparePickingMode?: boolean } = {}) {
    const country = makeCountryData() // FRA / ccn3 250
    const onSelect = vi.fn()
    renderHook(() =>
      useMapInteractions({
        ...baseOptions,
        onSelect,
        byNumeric: new Map([[country.ccn3, country]]),
        comparePickingMode: opts.comparePickingMode ?? false,
        loaded: true,
      }),
    )
    return { country, onSelect }
  }

  beforeEach(() => {
    takeOrigin() // reset any mark left by a previous test
    window.location.hash = ''
  })

  it('marks click origin for a selection-changing click', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    const { country, onSelect } = renderWithCountry()

    fake.fire('click', LAYER.fill, { features: [{ id: country.ccn3 }] })

    expect(onSelect).toHaveBeenCalledWith('FRA')
    expect(takeOrigin()).toBe('click')
  })

  it('does NOT mark when re-clicking the already-selected country (no hashchange would consume it)', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    window.location.hash = '#FRA'
    const { country, onSelect } = renderWithCountry()

    fake.fire('click', LAYER.fill, { features: [{ id: country.ccn3 }] })

    expect(onSelect).toHaveBeenCalledWith('FRA')
    expect(takeOrigin()).toBe('auto')
  })

  it('does NOT mark during an active game (guess clicks never write the hash)', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    h.session = { modeId: 'country-pinning', status: 'playing' }
    const { country } = renderWithCountry()

    fake.fire('click', LAYER.fill, { features: [{ id: country.ccn3 }] })

    expect(takeOrigin()).toBe('auto')
  })

  it('does NOT mark while compare-picking (compareSelect writes a cmp hash, not a selection)', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    const { country } = renderWithCountry({ comparePickingMode: true })

    fake.fire('click', LAYER.fill, { features: [{ id: country.ccn3 }] })

    expect(takeOrigin()).toBe('auto')
  })

  it('does NOT mark when clicking A while a compare pair is active (App no-ops — no hashchange would consume it)', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    window.location.hash = '#FRA,DEU'
    const { country, onSelect } = renderWithCountry() // FRA / ccn3 250

    fake.fire('click', LAYER.fill, { features: [{ id: country.ccn3 }] })

    expect(onSelect).toHaveBeenCalledWith('FRA')
    // An unconsumed mark would leak preserveZoom into the NEXT auto selection.
    expect(takeOrigin()).toBe('auto')
  })

  it('does NOT mark for a replace-B click (compare hashchange, not a selection — flyToComparePair ignores origin)', () => {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    window.location.hash = '#FRA,DEU'
    const spain = makeCountryData({ cca3: 'ESP', ccn3: '724' })
    const onSelect = vi.fn()
    renderHook(() =>
      useMapInteractions({
        ...baseOptions,
        onSelect,
        byNumeric: new Map([[spain.ccn3, spain]]),
        loaded: true,
      }),
    )

    fake.fire('click', LAYER.fill, { features: [{ id: spain.ccn3 }] })

    expect(onSelect).toHaveBeenCalledWith('ESP')
    // #FRA,DEU → #FRA,ESP is a compare hash: selected is unchanged so
    // flyToCountry (the only preserveZoom consumer) never runs, and
    // flyToComparePair always reframes the pair (A8 camera decision).
    expect(takeOrigin()).toBe('auto')
  })
})

describe('useMapInteractions country-game tap assist (B-2) + ocean feedback (C-5)', () => {
  let restoreMatchMedia: () => void

  beforeEach(() => {
    // Coarse pointer by default: FINE_POINTER_MEDIA_QUERY does not match.
    // The assist gates via matchMedia, never e.originalEvent — synthetic seam
    // clicks (map.fire) carry none.
    restoreMatchMedia = stubMatchMedia(() => false)
    takeOrigin() // reset any click-origin mark left by a previous test
    window.location.hash = ''
  })

  afterEach(() => restoreMatchMedia())

  function renderAssist(opts: { modeId?: GameSession['modeId']; status?: GameStatus } = {}) {
    const fake = createFakeMapRef()
    h.mapRef.current = fake.map
    h.tooltipRef.current = document.createElement('div')
    h.session = {
      modeId: opts.modeId ?? 'country-pinning',
      status: opts.status ?? 'playing',
    }
    const country = makeCountryData() // FRA / ccn3 250
    const onSelect = vi.fn()
    const onDeselect = vi.fn()
    const onGameOceanMiss = vi.fn()
    renderHook(() =>
      useMapInteractions({
        ...baseOptions,
        onSelect,
        onDeselect,
        onGameOceanMiss,
        byNumeric: new Map([[country.ccn3, country]]),
        loaded: true,
      }),
    )
    return {
      fake,
      country,
      onSelect,
      onDeselect,
      onGameOceanMiss,
      qrf: fake.calls.queryRenderedFeatures,
    }
  }

  it('does not run the assist when the exact point hits a country (no bbox queries, no second submit)', () => {
    const { fake, onSelect, onGameOceanMiss, qrf } = renderAssist()
    qrf.mockReturnValue([{ id: '250' }])

    fake.fire('click', null, { point: { x: 100, y: 100 } })

    // clickMap early-returns while playing, so the single query is the
    // assist's exact-point probe. A hit means the DELEGATED clickCountry
    // listener owns the submit — the assist must stand down.
    expect(qrf).toHaveBeenCalledTimes(1)
    expect(qrf.mock.calls[0][0]).toEqual({ x: 100, y: 100 })
    expect(onSelect).not.toHaveBeenCalled()
    expect(onGameOceanMiss).not.toHaveBeenCalled()
  })

  it('grows the bbox on a coarse-pointer near miss and submits the found country once', () => {
    const { fake, onSelect, onGameOceanMiss, qrf } = renderAssist()
    qrf.mockImplementation((geometry: unknown) => {
      if (!Array.isArray(geometry)) return [] // the exact-point probe misses
      const [[x1]] = geometry as [number, number][]
      const radius = 100 - x1
      return radius >= 4 ? [{ id: '250' }] : [] // ±2 empty, ±4 hits
    })

    fake.fire('click', null, { point: { x: 100, y: 100 } })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('FRA')
    // exact probe + ±2 + ±4; the ±8 box is never queried after a hit
    expect(qrf).toHaveBeenCalledTimes(3)
    // bbox corners are ARRAYS — a plain {x, y} object would silently query
    // the whole viewport
    expect(qrf.mock.calls[1][0]).toEqual([
      [98, 98],
      [102, 102],
    ])
    expect(qrf.mock.calls[2][0]).toEqual([
      [96, 96],
      [104, 104],
    ])
    // every query stays layer-scoped (repo invariant)
    expect(qrf.mock.calls[2][1]).toEqual({ layers: [LAYER.fill] })
    expect(onGameOceanMiss).not.toHaveBeenCalled()
    // the assist reuses clickCountry's resolution path — and a game guess
    // never marks click origin
    expect(takeOrigin()).toBe('auto')
  })

  it('reports an ocean miss when even the ±8px box is empty on a coarse pointer', () => {
    const { fake, onSelect, onGameOceanMiss, qrf } = renderAssist()
    qrf.mockReturnValue([])

    fake.fire('click', null, { point: { x: 100, y: 100 } })

    expect(qrf).toHaveBeenCalledTimes(4) // exact + ±2 + ±4 + ±8
    expect(onSelect).not.toHaveBeenCalled()
    expect(onGameOceanMiss).toHaveBeenCalledTimes(1)
  })

  it('skips the bbox assist on fine pointers but still reports the exact-point ocean miss', () => {
    restoreMatchMedia()
    restoreMatchMedia = stubMatchMedia((query) => query === FINE_POINTER_MEDIA_QUERY)
    const { fake, onSelect, onGameOceanMiss, qrf } = renderAssist()
    qrf.mockReturnValue([])

    fake.fire('click', null, { point: { x: 100, y: 100 } })

    expect(qrf).toHaveBeenCalledTimes(1) // the exact-point probe only
    expect(onSelect).not.toHaveBeenCalled()
    expect(onGameOceanMiss).toHaveBeenCalledTimes(1)
  })

  it('is inert in idle mode — ocean clicks keep deselecting via clickMap, never the miss callback', () => {
    const { fake, onDeselect, onGameOceanMiss, qrf } = renderAssist({ status: 'idle' })
    qrf.mockReturnValue([])

    fake.fire('click', null, { point: { x: 100, y: 100 } })

    expect(onDeselect).toHaveBeenCalledTimes(1) // clickMap's contract, untouched
    expect(onGameOceanMiss).not.toHaveBeenCalled()
    expect(qrf).toHaveBeenCalledTimes(1) // clickMap's exact-point query only
  })

  it('is inert during city-guessing rounds (city clicks belong to useRevealMapEffects)', () => {
    const { fake, onGameOceanMiss, qrf } = renderAssist({ modeId: 'city-guessing' })
    qrf.mockReturnValue([])

    fake.fire('click', null, { point: { x: 100, y: 100 } })

    expect(qrf).not.toHaveBeenCalled() // clickMap early-returns while playing; assist is country-only
    expect(onGameOceanMiss).not.toHaveBeenCalled()
  })
})

describe('useMapInteractions tooltip clamping (A10)', () => {
  it('flips the tooltip to the other side of the cursor at the container edges', () => {
    const fake = createFakeMapRef()
    // The fake map has no getContainer; give it a fixed 800×600 box.
    Object.assign(fake.map, {
      getContainer: () => ({ clientWidth: 800, clientHeight: 600 }) as unknown as HTMLElement,
    })
    const tooltip = document.createElement('div')
    // jsdom has no layout — pin the measured size the clamp math reads.
    Object.defineProperty(tooltip, 'offsetWidth', { value: 160 })
    Object.defineProperty(tooltip, 'offsetHeight', { value: 44 })
    tooltip.classList.add('visible')
    h.mapRef.current = fake.map
    h.tooltipRef.current = tooltip
    // Run the coalescing rAF synchronously so the position write is observable.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    try {
      renderHook(() => useMapInteractions({ ...baseOptions, loaded: true }))
      // Cursor near the bottom-right corner: +15/+15 would overflow → flip.
      fake.fire('mousemove', null, { point: { x: 780, y: 590 } })
      expect(tooltip.style.left).toBe('605px') // 780 − 15 − 160
      expect(tooltip.style.top).toBe('531px') // 590 − 15 − 44
    } finally {
      rafSpy.mockRestore()
    }
  })
})
