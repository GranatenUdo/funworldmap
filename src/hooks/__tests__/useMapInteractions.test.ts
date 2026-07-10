import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import type { GameSession, GameStatus } from '../../game/shared/types'
import type { CountryData } from '../../lib/types'
import { LAYER } from '../../lib/mapLayers'
import { makeCountryData } from '../../test/countryFixtures'

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
  type Handler = (...args: unknown[]) => void

  function makeInteractionMap() {
    const handlers = new Map<string, Handler>()
    const keyFor = (event: string, layerOrHandler: unknown) =>
      typeof layerOrHandler === 'string' ? `${event}:${layerOrHandler}` : event

    const setFeatureState = vi.fn()
    const setFilter = vi.fn()
    const map = {
      on: vi.fn((event: string, layerOrHandler: unknown, maybeHandler?: unknown) => {
        const handler = (
          typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler
        ) as Handler
        handlers.set(keyFor(event, layerOrHandler), handler)
      }),
      off: vi.fn(),
      setFeatureState,
      setFilter,
      getCanvas: () => ({ style: { cursor: '' } }) as HTMLCanvasElement,
      doubleClickZoom: { disable: vi.fn() },
      queryRenderedFeatures: vi.fn(() => []),
    } as unknown as maplibregl.Map

    const fire = (event: string, layer: string | null, payload?: unknown) => {
      const handler = handlers.get(layer ? `${event}:${layer}` : event)
      if (!handler) throw new Error(`no handler registered for ${event}${layer ? `:${layer}` : ''}`)
      handler(payload)
    }

    return { map, fire, setFeatureState, setFilter }
  }

  const EMPTY_FILTER = ['==', ['get', 'id'], '']

  it('clears hover feature state, filters, and tooltip when the camera starts moving', () => {
    const { map, fire, setFeatureState, setFilter } = makeInteractionMap()
    const tooltip = document.createElement('div')
    h.mapRef.current = map
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
    fire('mousemove', LAYER.fill, { features: [{ id: country.ccn3 }] })
    expect(tooltip.classList.contains('visible')).toBe(true)
    expect(setFeatureState).toHaveBeenCalledWith(
      { source: 'countries', id: country.ccn3 },
      { hover: true },
    )
    setFeatureState.mockClear()
    setFilter.mockClear()

    fire('movestart', null)

    expect(setFeatureState).toHaveBeenCalledWith(
      { source: 'countries', id: country.ccn3 },
      { hover: false },
    )
    expect(setFilter).toHaveBeenCalledWith(LAYER.extrusion, EMPTY_FILTER)
    expect(setFilter).toHaveBeenCalledWith(LAYER.hoverBorder, EMPTY_FILTER)
    expect(tooltip.classList.contains('visible')).toBe(false)
  })

  it('is a safe no-op when nothing is hovered', () => {
    const { map, fire, setFeatureState, setFilter } = makeInteractionMap()
    const tooltip = document.createElement('div')
    h.mapRef.current = map
    h.tooltipRef.current = tooltip
    renderHook(() => useMapInteractions({ ...baseOptions, loaded: true }))

    fire('movestart', null)

    expect(setFeatureState).not.toHaveBeenCalled()
    expect(setFilter).toHaveBeenCalledWith(LAYER.extrusion, EMPTY_FILTER)
    expect(setFilter).toHaveBeenCalledWith(LAYER.hoverBorder, EMPTY_FILTER)
    expect(tooltip.classList.contains('visible')).toBe(false)
  })
})
