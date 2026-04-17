/** Load the world-atlas 50m countries topology and return a normalized GeoJSON
 *  FeatureCollection with antimeridian wrapping fixed for non-polar polygons.
 *  Each feature has its numeric id promoted to `properties.id` (string). */
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
