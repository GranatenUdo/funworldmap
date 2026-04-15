import type maplibregl from 'maplibre-gl'

/** Apply dark or light mode paint properties to the basemap layers.
 *  Modifies OpenFreeMap Positron style layers via setPaintProperty.
 *  If layer IDs are unrecognized (style spec changed), fails silently — basemap stays light. */
export function applyMapTheme(map: maplibregl.Map, mode: 'light' | 'dark'): void {
  const style = map.getStyle()
  if (!style?.layers) return

  for (const layer of style.layers) {
    const id = layer.id
    const type = layer.type

    try {
      if (type === 'background') {
        map.setPaintProperty(id, 'background-color', mode === 'dark' ? '#1a1b26' : '#f2efe9')
      } else if (type === 'fill') {
        // Land and landuse fills
        if (id.includes('land') || id.includes('earth')) {
          map.setPaintProperty(id, 'fill-color', mode === 'dark' ? '#1e1f2e' : '#f2efe9')
        } else if (id.includes('water')) {
          map.setPaintProperty(id, 'fill-color', mode === 'dark' ? '#151927' : '#aad3df')
        }
      } else if (type === 'line') {
        if (id.includes('water')) {
          map.setPaintProperty(id, 'line-color', mode === 'dark' ? '#1a1d30' : '#aad3df')
        }
      } else if (type === 'symbol') {
        // Text labels
        if ('text-color' in (layer.paint ?? {})) {
          map.setPaintProperty(id, 'text-color', mode === 'dark' ? '#9ca3af' : '#333')
        }
        if ('text-halo-color' in (layer.paint ?? {})) {
          map.setPaintProperty(id, 'text-halo-color', mode === 'dark' ? '#1a1b26' : '#ffffff')
        }
      }
    } catch {
      // Layer might not support the property — skip silently
    }
  }
}
