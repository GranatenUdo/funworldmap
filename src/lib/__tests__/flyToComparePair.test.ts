import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flyToComparePair } from '../flyToComparePair'
import { prefersReducedMotion } from '../motion'
import { makeCountryData } from '../../test/countryFixtures'
import { createFakeMapRef } from '../../test/fakeMapRef'
import {
  COMPARE_FRAME_PADDING_PX,
  COMPARE_PANEL_FOOTPRINT_PX,
  COMPARE_SHEET_FRACTION,
} from '../layoutConstants'

vi.mock('../motion', () => ({ prefersReducedMotion: vi.fn(() => false) }))

const FRANCE = makeCountryData() // latlng [46, 2]
const GERMANY = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
const JAPAN = makeCountryData({ cca3: 'JPN', ccn3: '392', latlng: [36, 138] })
const USA = makeCountryData({ cca3: 'USA', ccn3: '840', latlng: [38, -97] })
// Mid-wide pair: extended-bounds span (~81°) stays under the WIDE_PAIR_SPAN_DEG
// (110°) fallback threshold, so this pair still reaches cameraForBounds — used
// for the globe-scale guard test now that Japan+USA takes the fallback.
const BRAZIL = makeCountryData({ cca3: 'BRA', ccn3: '076', latlng: [-10, -55], area: 8_515_767 })
const NIGERIA = makeCountryData({ cca3: 'NGA', ccn3: '566', latlng: [10, 8], area: 923_768 })

beforeEach(() => {
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  ) // desktop
})
afterEach(() => vi.unstubAllGlobals())

describe('flyToComparePair', () => {
  it('frames both countries with asymmetric padding reserving the panel footprint — no offset', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    const [bounds, opts] = fake.calls.cameraForBounds.mock.calls[0]
    const [[west, south], [east, north]] = bounds as [[number, number], [number, number]]
    // Centroid bounds are extended by area-derived half-extents (both fixtures
    // share the France default area), so the raw centroid box [2,46]-[9,51]
    // must be strictly grown in every direction, not just padded.
    expect(west).toBeLessThan(2)
    expect(south).toBeLessThan(46 - 3)
    expect(east).toBeGreaterThan(9 + 3)
    expect(north).toBeGreaterThan(51 + 2)
    // B6: padding is folded into BOTH zoom and center by cameraForBounds —
    // the batch-2 screen offset only shifted the center, so zoom stayed sized
    // to the full viewport and country B slid under the 672px panel. toEqual
    // (not toMatchObject) also proves the offset option is GONE.
    expect(opts).toEqual({
      padding: {
        top: COMPARE_FRAME_PADDING_PX,
        bottom: COMPARE_FRAME_PADDING_PX,
        left: COMPARE_FRAME_PADDING_PX,
        right: COMPARE_FRAME_PADDING_PX + COMPARE_PANEL_FOOTPRINT_PX,
      },
    })
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
  })

  it('mobile: sheet-aware bottom padding frames the pair in the strip above the sheet (C6)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    vi.stubGlobal('innerHeight', 800)
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    const opts = fake.calls.cameraForBounds.mock.calls[0][1]
    expect(opts).toEqual({
      padding: {
        top: COMPARE_FRAME_PADDING_PX,
        bottom: Math.round(800 * COMPARE_SHEET_FRACTION), // 640
        left: COMPARE_FRAME_PADDING_PX,
        right: COMPARE_FRAME_PADDING_PX,
      },
    })
  })

  it('mobile: the globe-scale symmetric fallback never fires — it would re-center the pair under the sheet (C6)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    vi.stubGlobal('innerHeight', 800)
    const fake = createFakeMapRef()
    ;(fake.map.cameraForBounds as ReturnType<typeof vi.fn>).mockReturnValue({
      center: [-25, 0],
      zoom: 1.6,
    })
    flyToComparePair(fake.map, BRAZIL, NIGERIA)
    // The GLOBE_SCALE_ZOOM guard exists for DESKTOP's horizontal footprint
    // swing. On mobile the padded zoom sits below 2.2 routinely (the fitting
    // strip is ~20% of the viewport), so a firing guard would systematically
    // undo C6's framing. Exactly one cameraForBounds call = no fallback.
    expect(fake.calls.cameraForBounds).toHaveBeenCalledTimes(1)
    expect(fake.calls.flyTo.mock.calls[0][0]).toMatchObject({ zoom: 1.6 })
  })

  it('falls back to the pair midpoint at world zoom when the span exceeds a globe face (Japan+USA)', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, JAPAN, USA)
    // A globe face physically cannot frame a ~169°-plus span — cameraForBounds
    // is skipped entirely in favor of the midpoint fallback (spec §3, kept by B6).
    expect(fake.calls.cameraForBounds).not.toHaveBeenCalled()
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
    const flyToArgs = fake.calls.flyTo.mock.calls[0][0] as {
      center: [number, number]
      zoom: number
    }
    expect(flyToArgs.zoom).toBe(1.8)
    // -97 shifted to +263 (antimeridian normalization); (138 + 263) / 2 = 200.5
    expect(flyToArgs.center[0]).toBeCloseTo(200.5, 0)
    expect(flyToArgs.center[1]).toBe(37)
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

  it('falls back to symmetric padding at globe-scale zooms so wide pairs stay centered', () => {
    const fake = createFakeMapRef()
    ;(fake.map.cameraForBounds as ReturnType<typeof vi.fn>).mockReturnValue({
      center: [-25, 0],
      zoom: 1.6,
    })
    flyToComparePair(fake.map, BRAZIL, NIGERIA)
    expect(fake.calls.cameraForBounds).toHaveBeenCalledTimes(2)
    const secondOpts = fake.calls.cameraForBounds.mock.calls[1][1]
    // A bare number is CameraForBoundsOptions' uniform-padding form.
    expect(secondOpts).toEqual({ padding: COMPARE_FRAME_PADDING_PX })
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
  })
})
