import { CANONICAL_NUMERIC_IDS } from './canonicalCountries'
import { buildMissingFeatures } from './missingCountriesPatch'

/** Load the world-atlas 50m countries topology + a synthetic patch for the
 *  small island states 50m omits, and return a normalized GeoJSON FeatureCollection
 *  with antimeridian wrapping fixed for non-polar polygons.
 *
 *  The features are filtered through `CANONICAL_NUMERIC_IDS` so only the 195
 *  canonical sovereign states (193 UN members + VAT + PSE) are returned.
 *
 *  We use 50m + patch (rather than 10m) because 10m's bundle is ~3.5 MB raw /
 *  ~954 KB gzip; 50m is ~756 KB raw / much smaller gzip, and the patch adds
 *  a handful of tiny synthetic polygons for the small island states 50m omits
 *  (see src/data/missing-from-50m.json). */
export async function loadCountryGeojson(): Promise<GeoJSON.FeatureCollection> {
  const [topojsonClient, worldAtlas] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/countries-50m.json'),
  ])

  const topology = worldAtlas.default as unknown as TopoJSON.Topology
  const geojson = topojsonClient.feature(
    topology,
    topology.objects.countries,
  ) as GeoJSON.FeatureCollection

  geojson.features = geojson.features.filter((f) =>
    CANONICAL_NUMERIC_IDS.has(Number(f.id)),
  )

  for (const feature of geojson.features) {
    if (feature.id != null && feature.properties) {
      feature.properties.id = String(feature.id)
    }
  }

  // Append synthetic features for the canonical IDs missing in 50m.
  geojson.features.push(...buildMissingFeatures())

  fixAntimeridian(geojson)
  return geojson
}

/** Shift any non-polar polygon that straddles the antimeridian into a
 *  continuous 0..360 longitude range so MapLibre renders it without
 *  drawing horizontal slivers across the map. */
export function fixAntimeridian(collection: GeoJSON.FeatureCollection): void {
  for (const feature of collection.features) {
    const polygons =
      feature.geometry.type === 'MultiPolygon'
        ? (feature.geometry as GeoJSON.MultiPolygon).coordinates
        : feature.geometry.type === 'Polygon'
          ? [(feature.geometry as GeoJSON.Polygon).coordinates]
          : []

    for (const polygon of polygons) {
      let hasHighPositive = false
      let hasHighNegative = false
      let touchesPole = false
      for (const ring of polygon) {
        for (const coord of ring) {
          if (coord[0] > 170) hasHighPositive = true
          if (coord[0] < -170) hasHighNegative = true
          if (coord[1] <= -85 || coord[1] >= 85) touchesPole = true
        }
      }
      if (hasHighPositive && hasHighNegative && !touchesPole) {
        for (const ring of polygon) {
          for (const coord of ring) {
            if (coord[0] < 0) coord[0] += 360
          }
        }
      }
    }
  }
}
