import { describe, expect, it, vi, beforeEach } from 'vitest'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../types'
import { flyToCountry } from '../flyToCountry'
import { prefersReducedMotion } from '../motion'

vi.mock('../motion', () => ({
  prefersReducedMotion: vi.fn(() => false),
}))

function makeCountry(opts: { area: number; latlng?: [number, number] }): CountryData {
  return {
    cca3: 'XYZ',
    ccn3: '999',
    name: { common: 'X', official: 'X' },
    capital: [],
    region: '',
    subregion: '',
    languages: {},
    currencies: {},
    timezones: [],
    borders: [],
    flag: '',
    flagAlt: '',
    population: 0,
    area: opts.area,
    latlng: opts.latlng ?? [0, 0],
    unMember: true,
    independent: true,
    governmentType: '',
    _fieldSources: {},
  } as unknown as CountryData
}

function makeMap(currentZoom: number): {
  map: maplibregl.Map
  flyTo: ReturnType<typeof vi.fn>
} {
  const flyTo = vi.fn()
  const map = {
    getZoom: vi.fn(() => currentZoom),
    flyTo,
  } as unknown as maplibregl.Map
  return { map, flyTo }
}

beforeEach(() => {
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
})

describe('flyToCountry', () => {
  it('zooms in to the computed level for a tiny country when current zoom is lower', () => {
    const { map, flyTo } = makeMap(1.8)
    const vatican = makeCountry({ area: 0.49, latlng: [41.9, 12.45] })
    flyToCountry(map, vatican)
    expect(flyTo).toHaveBeenCalledTimes(1)
    const arg = flyTo.mock.calls[0][0] as { zoom: number; center: [number, number] }
    expect(arg.zoom).toBeGreaterThan(10)
    expect(arg.center).toEqual([12.45, 41.9])
  })

  it('preserves the user-current zoom when it exceeds the area-derived zoom', () => {
    const { map, flyTo } = makeMap(4)
    const russia = makeCountry({ area: 17_098_242, latlng: [60, 100] })
    flyToCountry(map, russia)
    const arg = flyTo.mock.calls[0][0] as { zoom: number }
    expect(arg.zoom).toBe(4)
  })

  it('flies to the area-derived clamp when current zoom is below it', () => {
    const { map, flyTo } = makeMap(1.5)
    const russia = makeCountry({ area: 17_098_242, latlng: [60, 100] })
    flyToCountry(map, russia)
    const arg = flyTo.mock.calls[0][0] as { zoom: number }
    expect(arg.zoom).toBe(2)
  })

  it('composes the clamp with reduced-motion duration: 0', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const { map, flyTo } = makeMap(4)
    const france = makeCountry({ area: 643_801, latlng: [46, 2] })
    flyToCountry(map, france)
    const arg = flyTo.mock.calls[0][0] as { zoom: number; duration: number }
    expect(arg.zoom).toBe(4)
    expect(arg.duration).toBe(0)
  })
})
