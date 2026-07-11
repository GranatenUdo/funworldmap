import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flyToCountry } from '../flyToCountry'
import { prefersReducedMotion } from '../motion'
import { makeCountryData } from '../../test/countryFixtures'
import { createFakeMapRef } from '../../test/fakeMapRef'

vi.mock('../motion', () => ({
  prefersReducedMotion: vi.fn(() => false),
}))

function makeCountry(opts: { area: number; latlng?: [number, number] }) {
  return makeCountryData({
    cca3: 'XYZ',
    ccn3: '999',
    cca2: 'XY',
    name: { common: 'X', official: 'X' },
    area: opts.area,
    latlng: opts.latlng ?? [0, 0],
  })
}

function lastFlyArg(flyTo: ReturnType<typeof vi.fn>) {
  return flyTo.mock.calls[0][0] as {
    zoom: number
    center: [number, number]
    offset: [number, number]
    duration: number
  }
}

function stubViewport({ desktop, height = 900 }: { desktop: boolean; height?: number }) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: desktop })),
  )
  vi.stubGlobal('innerHeight', height)
}

beforeEach(() => {
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
  stubViewport({ desktop: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('flyToCountry', () => {
  it('zooms in to the computed level for a tiny country when current zoom is lower', () => {
    const { map, calls } = createFakeMapRef({ zoom: 1.8 })
    const vatican = makeCountry({ area: 0.49, latlng: [41.9, 12.45] })
    flyToCountry(map, vatican)
    expect(calls.flyTo).toHaveBeenCalledTimes(1)
    const arg = lastFlyArg(calls.flyTo)
    expect(arg.zoom).toBeGreaterThan(10)
    expect(arg.center).toEqual([12.45, 41.9])
  })

  it('preserveZoom (map click) keeps the user-current zoom when it exceeds the computed zoom', () => {
    const { map, calls } = createFakeMapRef({ zoom: 4 })
    const russia = makeCountry({ area: 17_098_242, latlng: [60, 100] })
    flyToCountry(map, russia, { preserveZoom: true })
    expect(lastFlyArg(calls.flyTo).zoom).toBe(4)
  })

  it('auto selections zoom OUT to frame the country (Vatican → Japan case)', () => {
    const { map, calls } = createFakeMapRef({ zoom: 11.5 })
    const japan = makeCountry({ area: 377_930, latlng: [36, 138] })
    flyToCountry(map, japan)
    const { zoom } = lastFlyArg(calls.flyTo)
    expect(zoom).toBeGreaterThan(3)
    expect(zoom).toBeLessThan(4)
  })

  it('mid-size countries land at a meaningful zoom from the world view', () => {
    const { map, calls } = createFakeMapRef({ zoom: 1.8 })
    const germany = makeCountry({ area: 357_114, latlng: [51, 9] })
    flyToCountry(map, germany)
    const { zoom } = lastFlyArg(calls.flyTo)
    expect(zoom).toBeGreaterThan(3)
    expect(zoom).toBeLessThan(4)
  })

  it('continental giants still resolve to the globe view floor', () => {
    const { map, calls } = createFakeMapRef({ zoom: 1.5 })
    const russia = makeCountry({ area: 17_098_242, latlng: [60, 100] })
    flyToCountry(map, russia, { preserveZoom: true })
    expect(lastFlyArg(calls.flyTo).zoom).toBe(2)
  })

  it('composes with reduced-motion duration: 0', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const { map, calls } = createFakeMapRef({ zoom: 4 })
    const france = makeCountry({ area: 643_801, latlng: [46, 2] })
    flyToCountry(map, france, { preserveZoom: true })
    const arg = lastFlyArg(calls.flyTo)
    expect(arg.zoom).toBe(4)
    expect(arg.duration).toBe(0)
  })

  it('offsets the target left of the desktop panel', () => {
    const { map, calls } = createFakeMapRef({ zoom: 1.8 })
    flyToCountry(map, makeCountry({ area: 100 }))
    expect(lastFlyArg(calls.flyTo).offset).toEqual([-188, 0])
  })

  it('offsets the target above the mobile bottom sheet', () => {
    stubViewport({ desktop: false, height: 800 })
    const { map, calls } = createFakeMapRef({ zoom: 1.8 })
    flyToCountry(map, makeCountry({ area: 100 }))
    expect(lastFlyArg(calls.flyTo).offset).toEqual([0, -160])
  })
})
