import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import type { GameSession, GameStatus } from '../../game/shared/types'
import type { CountryData } from '../../lib/types'
import { EMPTY_FILTER, LAYER } from '../../lib/mapLayers'
import { takeOrigin } from '../../lib/selectionOrigin'
import { makeCountryData } from '../../test/countryFixtures'
import { createFakeMapRef } from '../../test/fakeMapRef'

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
})
