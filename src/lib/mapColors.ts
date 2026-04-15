import type maplibregl from 'maplibre-gl'

// Exact Positron style layer IDs to modify for dark mode.
// Using exact IDs (not substring matching) to avoid modifying
// landcover/landuse layers whose large geometries create artifacts.
const DARK_OVERRIDES: Record<string, Record<string, string>> = {
  background: { 'background-color': '#0f1219' },
  water: { 'fill-color': '#0a0e1a' },
  waterway: { 'line-color': '#111827' },
  park: { 'fill-color': '#0f1a10' },
  building: { 'fill-color': '#161b22' },
}

const LIGHT_OVERRIDES: Record<string, Record<string, string>> = {
  background: { 'background-color': '#f0ede6' },
  water: { 'fill-color': '#c4dae4' },
  waterway: { 'line-color': '#b8d0dc' },
  park: { 'fill-color': '#d4e4c8' },
  building: { 'fill-color': '#e4e0da' },
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
        mode === 'dark' ? '#8b949e' : '#374151',
      )
      map.setPaintProperty(
        layer.id,
        'text-halo-color',
        mode === 'dark' ? '#0f1219' : '#f0ede6',
      )
    } catch {
      // Not all symbol layers have text paint — skip
    }
  }
}
