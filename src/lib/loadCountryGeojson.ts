import { CANONICAL_NUMERIC_IDS } from './canonicalCountries'

/** Load the world-atlas 10m countries topology and return a normalized GeoJSON
 *  FeatureCollection with antimeridian wrapping fixed for non-polar polygons.
 *  Each feature has its numeric id promoted to `properties.id` (string).
 *
 *  The features are filtered through `CANONICAL_NUMERIC_IDS` so only the 195
 *  canonical sovereign states (193 UN members + VAT + PSE) are returned.
 *  Dropped territories (Taiwan, Greenland, Hong Kong, Western Sahara, …)
 *  are not rendered and therefore not clickable on the map.
 *
 *  We use the 10m source (rather than 50m) because 50m omits Tuvalu (id 798)
 *  entirely. 10m has all 195 canonical IDs at the cost of a larger bundle. */
export async function loadCountryGeojson(): Promise<GeoJSON.FeatureCollection> {
  const [topojsonClient, worldAtlas] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/countries-10m.json'),
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
