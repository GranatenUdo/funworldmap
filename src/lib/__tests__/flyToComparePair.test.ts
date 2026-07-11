import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flyToComparePair } from '../flyToComparePair'
import { prefersReducedMotion } from '../motion'
import { makeCountryData } from '../../test/countryFixtures'
import { createFakeMapRef } from '../../test/fakeMapRef'

vi.mock('../motion', () => ({ prefersReducedMotion: vi.fn(() => false) }))

const FRANCE = makeCountryData() // latlng [46, 2]
const GERMANY = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
const JAPAN = makeCountryData({ cca3: 'JPN', ccn3: '392', latlng: [36, 138] })
const USA = makeCountryData({ cca3: 'USA', ccn3: '840', latlng: [38, -97] })

beforeEach(() => {
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  ) // desktop
})
afterEach(() => vi.unstubAllGlobals())

describe('flyToComparePair', () => {
  it('frames both countries with padding and the compare-panel offset', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    const [bounds, opts] = fake.calls.cameraForBounds.mock.calls[0]
    expect(bounds).toEqual([
      [2, 46],
      [9, 51],
    ])
    expect(opts).toMatchObject({ padding: 80, offset: [-336, 0] })
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
  })

  it('normalizes antimeridian pairs so the bounds cross the Pacific, not the planet', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, JAPAN, USA)
    const [bounds] = fake.calls.cameraForBounds.mock.calls[0]
    const [[west], [east]] = bounds as [[number, number], [number, number]]
    expect(east - west).toBeLessThan(180) // -97 shifted to +263
    expect(east).toBeGreaterThan(180)
  })

  it('is a no-op when cameraForBounds returns undefined', () => {
    const fake = createFakeMapRef()
    ;(fake.map.cameraForBounds as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    flyToComparePair(fake.map, FRANCE, GERMANY)
    expect(fake.calls.flyTo).not.toHaveBeenCalled()
  })

  it('reduced motion flies with duration 0', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    expect(fake.calls.flyTo.mock.calls[0][0]).toMatchObject({ duration: 0, pitch: 0 })
  })
})
