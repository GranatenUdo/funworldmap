/** OpenFreeMap positron basemap style URL */
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

/** EOX Sentinel-2 Cloudless satellite tiles (no API key, CC BY-NC-SA 4.0) */
export const SATELLITE_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'

export const SATELLITE_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless</a> by EOX (Copernicus Sentinel data 2024)'

/** Default map view — 20° pitch for visible 3D */
export const DEFAULT_CENTER: [number, number] = [0, 20]
export const DEFAULT_ZOOM = 1.8
export const DEFAULT_PITCH = 20
