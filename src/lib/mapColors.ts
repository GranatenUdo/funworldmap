import type maplibregl from 'maplibre-gl'

// Exact Positron style layer IDs to modify for dark mode.
// Using exact IDs (not substring matching) to avoid modifying
// landcover/landuse layers whose large geometries create artifacts.
const DARK_OVERRIDES: Record<string, Record<string, string>> = {
  background: { 'background-color': '#1a1b26' },
  water: { 'fill-color': '#151927' },
  waterway: { 'line-color': '#1a1d30' },
  park: { 'fill-color': '#1a2010' },
  building: { 'fill-color': '#1e1f2e' },
}

const LIGHT_OVERRIDES: Record<string, Record<string, string>> = {
  background: { 'background-color': '#f2efe9' },
  water: { 'fill-color': '#aad3df' },
  waterway: { 'line-color': '#aad3df' },
  park: { 'fill-color': '#d8e8c8' },
  building: { 'fill-color': '#dfdbd7' },
}

/** Apply dark or light mode paint properties to the basemap layers.
 *  Uses exact Positron layer IDs. If IDs are unrecognized (style changed),
 *  fails silently — basemap stays as-is. */
export function applyMapTheme(map: maplibregl.Map, mode: 'light' | 'dark'): void {
  const overrides = mode === 'dark' ? DARK_OVERRIDES : LIGHT_OVERRIDES

  for (const [layerId, props] of Object.entries(overrides)) {
    if (!map.getLayer(layerId)) continue
    for (const [prop, value] of Object.entries(props)) {
      try {
        map.setPaintProperty(layerId, prop, value)
      } catch {
        // Skip silently
      }
    }
  }

  // Darken text labels
  const style = map.getStyle()
  if (!style?.layers) return

  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue
    try {
      map.setPaintProperty(
        layer.id,
        'text-color',
        mode === 'dark' ? '#9ca3af' : '#333',
      )
      map.setPaintProperty(
        layer.id,
        'text-halo-color',
        mode === 'dark' ? '#1a1b26' : '#ffffff',
      )
    } catch {
      // Not all symbol layers have text paint — skip
    }
  }
}
