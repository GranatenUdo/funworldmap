import { describe, it, expect } from 'vitest'
import { haversineKm, centroidFromLatLng } from '../distance'

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
