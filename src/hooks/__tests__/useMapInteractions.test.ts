import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import type { GameSession, GameStatus } from '../../game/shared/types'
import type { CountryData } from '../../lib/types'

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
