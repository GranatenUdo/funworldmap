import type maplibregl from 'maplibre-gl'

// Warm Explorer basemap overrides.
// Dark: deep warm charcoal ocean/land. Light: warm sand atlas feel.
const DARK_OVERRIDES: Record<string, Record<string, string>> = {
  background: { 'background-color': '#10141a' },
  water: { 'fill-color': '#060a12' },
  waterway: { 'line-color': '#0c1018' },
  park: { 'fill-color': '#0f1a12' },
  building: { 'fill-color': '#161a22' },
}

const LIGHT_OVERRIDES: Record<string, Record<string, string>> = {
  background: { 'background-color': '#e8e3da' },
  water: { 'fill-color': '#d4dde6' },
  waterway: { 'line-color': '#c4d2de' },
  park: { 'fill-color': '#d0dcc4' },
  building: { 'fill-color': '#ddd8d0' },
}

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

  const style = map.getStyle()
  if (!style?.layers) return

  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue
    try {
      map.setPaintProperty(
        layer.id,
        'text-color',
        mode === 'dark' ? '#64748b' : '#78716c',
      )
      map.setPaintProperty(
        layer.id,
        'text-halo-color',
        mode === 'dark' ? '#10141a' : '#e8e3da',
      )
    } catch {
      // Not all symbol layers have text paint — skip
    }
  }
}
