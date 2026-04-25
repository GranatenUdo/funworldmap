import { describe, it, expect } from 'vitest'
import { haversineKm, centroidFromLatLng, slerpLngLat, tessellateArc } from '../distance'

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm([0, 0], [0, 0])).toBe(0)
  })

  it('Paris → Berlin is about 878 km', () => {
    const paris: [number, number] = [2.3522, 48.8566]
    const berlin: [number, number] = [13.4050, 52.5200]
    const d = haversineKm(paris, berlin)
    expect(d).toBeGreaterThan(870)
    expect(d).toBeLessThan(885)
  })

  it('NYC → LA is about 3944 km', () => {
    const nyc: [number, number] = [-74.006, 40.7128]
    const la: [number, number] = [-118.2437, 34.0522]
    const d = haversineKm(nyc, la)
    expect(d).toBeGreaterThan(3900)
    expect(d).toBeLessThan(3985)
  })

  it('antipodal points are about 20 015 km', () => {
    const d = haversineKm([0, 0], [180, 0])
    expect(d).toBeGreaterThan(20000)
    expect(d).toBeLessThan(20050)
  })

  it('is symmetric', () => {
    const a: [number, number] = [2.3522, 48.8566]
    const b: [number, number] = [-74.006, 40.7128]
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6)
  })
})

describe('centroidFromLatLng', () => {
  it('swaps [lat, lng] to [lng, lat]', () => {
    expect(centroidFromLatLng([48.8566, 2.3522])).toEqual([2.3522, 48.8566])
  })
})

describe('slerpLngLat', () => {
  const paris: [number, number] = [2.3522, 48.8566]
  const berlin: [number, number] = [13.4050, 52.5200]

  it('returns from at t=0', () => {
    expect(slerpLngLat(paris, berlin, 0)).toEqual(paris)
  })

  it('returns to at t=1', () => {
    const result = slerpLngLat(paris, berlin, 1)
    expect(result[0]).toBeCloseTo(berlin[0], 6)
    expect(result[1]).toBeCloseTo(berlin[1], 6)
  })

  it('midpoint at t=0.5 is roughly equidistant from both endpoints', () => {
    const mid = slerpLngLat(paris, berlin, 0.5)
    const dA = haversineKm(paris, mid)
    const dB = haversineKm(mid, berlin)
    expect(Math.abs(dA - dB)).toBeLessThan(1)
  })

  it('returns from when endpoints are identical (zero angular distance)', () => {
    expect(slerpLngLat(paris, paris, 0.7)).toEqual(paris)
  })

  it('handles a long transcontinental arc (NYC → Tokyo) with midpoint in the Arctic-ish range', () => {
    const nyc: [number, number] = [-74.006, 40.7128]
    const tokyo: [number, number] = [139.6917, 35.6895]
    const mid = slerpLngLat(nyc, tokyo, 0.5)
    expect(mid[1]).toBeGreaterThan(55)
  })
})

describe('tessellateArc', () => {
  const paris: [number, number] = [2.3522, 48.8566]
  const berlin: [number, number] = [13.4050, 52.5200]

  it('returns n+1 points for n segments', () => {
    expect(tessellateArc(paris, berlin, 4)).toHaveLength(5)
    expect(tessellateArc(paris, berlin, 64)).toHaveLength(65)
  })

  it('endpoints match from and to exactly', () => {
    const arc = tessellateArc(paris, berlin, 8)
    expect(arc[0]).toEqual(paris)
    expect(arc[arc.length - 1][0]).toBeCloseTo(berlin[0], 6)
    expect(arc[arc.length - 1][1]).toBeCloseTo(berlin[1], 6)
  })

  it('midpoint matches slerp at t=0.5 for an even n', () => {
    const arc = tessellateArc(paris, berlin, 8)
    const mid = slerpLngLat(paris, berlin, 0.5)
    expect(arc[4][0]).toBeCloseTo(mid[0], 6)
    expect(arc[4][1]).toBeCloseTo(mid[1], 6)
  })

  it('defaults to 64 segments when n omitted', () => {
    expect(tessellateArc(paris, berlin)).toHaveLength(65)
  })
})
