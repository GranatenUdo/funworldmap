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

  it('returns exactly 196 features (canonical 193 UN + VAT + PSE)', async () => {
    // 196 = 195 canonical countries (193 UN + VAT + PSE), with AUS (id=36)
    // appearing as 2 features (mainland + Ashmore & Cartier Islands), so the
    // total feature count is one greater than the distinct-country count.
    // All 195 canonical IDs are present in countries-10m (50m omits Tuvalu).
    const fc = await loadCountryGeojson()
    expect(fc.features).toHaveLength(196)
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
