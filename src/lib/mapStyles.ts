/** OpenFreeMap positron basemap style URL */
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

/** EOX Sentinel-2 Cloudless satellite tiles (no API key, CC BY-NC-SA 4.0) */
export const SATELLITE_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'

export const SATELLITE_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless</a> by EOX (Copernicus Sentinel data 2024)'

/** AWS Terrain Tiles — terrarium encoding, no API key (AWS Open Data) */
export const TERRAIN_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

export const TERRAIN_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">AWS Terrain Tiles</a>'

/** Default map view */
export const DEFAULT_CENTER: [number, number] = [0, 20]
export const DEFAULT_ZOOM = 1.8
export const DEFAULT_PITCH = 20

/** Navigation constraints */
export const MIN_ZOOM = 1.5
export const MAX_ZOOM = 12
export const MAX_PITCH = 60

/** Time to wait for MapLibre 'load' event before showing an error overlay. */
export const BASEMAP_LOAD_TIMEOUT_MS = 10_000
