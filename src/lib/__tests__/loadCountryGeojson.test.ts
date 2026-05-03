import { describe, expect, it } from 'vitest'
import { fixAntimeridian, loadCountryGeojson } from '../loadCountryGeojson'
import { CANONICAL_NUMERIC_IDS } from '../canonicalCountries'

describe('loadCountryGeojson', () => {
  it('returns only features whose numeric id is in CANONICAL_NUMERIC_IDS', async () => {
    const fc = await loadCountryGeojson()
    for (const feature of fc.features) {
      expect(CANONICAL_NUMERIC_IDS.has(Number(feature.id))).toBe(true)
    }
  })

  it('returns at least 195 features (canonical 193 UN + VAT + PSE)', async () => {
    // Not pinning an exact count — world-atlas occasionally splits a country
    // into multiple features at id-level (e.g. AUS appears as mainland +
    // Ashmore & Cartier Is. sharing id=36 in countries-10m). The semantic
    // invariants are locked in by the per-country includes/excludes tests
    // below. Here we just guarantee the canonical 195 is reachable.
    const fc = await loadCountryGeojson()
    expect(fc.features.length).toBeGreaterThanOrEqual(195)
    expect(fc.features.length).toBeLessThanOrEqual(210)
  })

  it('includes Palestine (id 275)', async () => {
    const fc = await loadCountryGeojson()
    expect(fc.features.some((f) => Number(f.id) === 275)).toBe(true)
  })

  it('includes Tuvalu (id 798) — 10m has it; 50m did not', async () => {
    const fc = await loadCountryGeojson()
    expect(fc.features.some((f) => Number(f.id) === 798)).toBe(true)
  })

  it('excludes Taiwan (id 158)', async () => {
    const fc = await loadCountryGeojson()
    expect(fc.features.some((f) => Number(f.id) === 158)).toBe(false)
  })

  it('excludes Greenland (id 304) and Hong Kong (id 344)', async () => {
    const fc = await loadCountryGeojson()
    expect(fc.features.some((f) => Number(f.id) === 304)).toBe(false)
    expect(fc.features.some((f) => Number(f.id) === 344)).toBe(false)
  })
})

function makePolygonFeature(coords: [number, number][][]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: coords },
  }
}

describe('fixAntimeridian', () => {
  it('shifts negative longitudes into 0..360 for non-polar spanning polygons', () => {
    const f = makePolygonFeature([
      [
        [179, 0],
        [-179, 0],
        [-179, 1],
        [179, 1],
        [179, 0],
      ],
    ])
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [f] }
    fixAntimeridian(collection)
    const ring = (f.geometry as GeoJSON.Polygon).coordinates[0]
    const longitudes = ring.map((c: GeoJSON.Position) => c[0])
    expect(longitudes).toEqual([179, 181, 181, 179, 179])
  })

  it('does NOT shift polar polygons that touch -85 or +85', () => {
    const f = makePolygonFeature([
      [
        [179, 89],
        [-179, 89],
        [-179, 90],
        [179, 90],
        [179, 89],
      ],
    ])
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [f] }
    fixAntimeridian(collection)
    const ring = (f.geometry as GeoJSON.Polygon).coordinates[0]
    const longitudes = ring.map((c: GeoJSON.Position) => c[0])
    expect(longitudes).toEqual([179, -179, -179, 179, 179])
  })

  it('is a no-op for polygons that do not span the antimeridian', () => {
    const f = makePolygonFeature([
      [
        [-10, 40],
        [10, 40],
        [10, 50],
        [-10, 50],
        [-10, 40],
      ],
    ])
    const before = JSON.stringify(f.geometry)
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [f] }
    fixAntimeridian(collection)
    expect(JSON.stringify(f.geometry)).toBe(before)
  })
})
