import countriesFile from '../data/countries.json'
import { CANONICAL_CCA3 } from './canonicalCountries'
import { byValueDescThenCca3 } from './countryStats'
import type { CountriesFile, CountryData } from './types'

/** Properties carried by each country-label point feature (workstream B1). */
export interface CountryLabelProperties {
  cca3: string
  /** name.common — every canonical name is Latin-1, so one cached glyph PBF
   *  (the 0-255 range) covers the whole layer (B1 glyph spike, 2026-07-28). */
  name: string
  /** 1 = largest area (Russia) … 195 = smallest (Vatican). Drives the label
   *  layer's zoom-stepped admission filter and `symbol-sort-key` so
   *  globe-scale collision drops microstates before giants deterministically. */
  areaRank: number
}

export type CountryLabelCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  CountryLabelProperties
>

/** The minimal country shape this module needs — lets tests feed fixtures
 *  without fabricating full CountryData records. */
export type CountryLabelSource = Pick<CountryData, 'cca3' | 'name' | 'latlng' | 'area'>

/** Build the canonical label points: one Point feature per canonical country
 *  at its bundled `latlng` centroid, ranked by area (1 = largest).
 *
 *  Antimeridian note (decided against the real data, 2026-07-28): no longitude
 *  shift is needed. Every canonical latlng longitude lies in [-175, 178.065],
 *  a Point cannot straddle the antimeridian the way the FJI/RUS polygons do
 *  (fixAntimeridian shifts THOSE into 0..360), and MapLibre wraps point
 *  longitudes — so a label at 178.065 renders on the shifted Fiji polygon
 *  without adjustment. */
export function buildCountryLabelFeatures(
  countries: readonly CountryLabelSource[],
): CountryLabelCollection {
  const canonical = countries.filter((c) => CANONICAL_CCA3.has(c.cca3))
  // Descending area, cca3 tiebreak — the shared dense-ranking rule, owned by
  // countryStats.ts (D1 extracted it; this module adopted the single owner).
  const byAreaDesc = [...canonical].sort(byValueDescThenCca3((c) => c.area))
  return {
    type: 'FeatureCollection',
    features: byAreaDesc.map((c, i) => ({
      type: 'Feature',
      // restcountries latlng is [lat, lng]; GeoJSON wants [lng, lat].
      geometry: { type: 'Point', coordinates: [c.latlng[1], c.latlng[0]] },
      properties: { cca3: c.cca3, name: c.name.common, areaRank: i + 1 },
    })),
  }
}

/** The label collection for the bundled dataset, built once at module load
 *  (the canonicalCountries.ts pattern). WorldMap feeds this to
 *  addCountryLabelLayer (src/lib/mapLayers.ts). */
export const COUNTRY_LABEL_COLLECTION: CountryLabelCollection = buildCountryLabelFeatures(
  (countriesFile as unknown as CountriesFile).countries,
)
