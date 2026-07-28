import { useEffect } from 'react'
import { applyMapTheme } from '../lib/mapColors'
import { ICE, ICE_DEEP } from '../lib/mapPalette'
import { LAYER, applySelectionColor } from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  resolvedTheme: 'light' | 'dark'
}

// Baseline border/fill paint lives in useCountryBaselinePaint so that the
// two concerns — overlay colors+sky and baseline country paint — each have
// one owner.
export function useMapTheme({ loaded, resolvedTheme }: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyMapTheme(map, resolvedTheme)

    const isDark = resolvedTheme === 'dark'
    const ice = isDark ? ICE : ICE_DEEP

    try {
      map.setPaintProperty(LAYER.fill, 'fill-color', ice)
      map.setPaintProperty(LAYER.extrusion, 'fill-extrusion-color', ice)
      map.setPaintProperty(LAYER.hoverBorder, 'line-color', ice)

      // E4: the selection highlight is ice (wayfinding), the same family as
      // the hover accents — coral is retired. useCompareViewHighlight pins
      // SIGNAL over this while comparing.
      applySelectionColor(map, ice)

      map.setSky({
        'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
        'horizon-color': isDark ? '#1a2030' : '#f0ede6',
        'fog-color': isDark ? '#10141a' : '#e8e3da',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.8,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
      })
    } catch {
      // setPaintProperty / setSky throw if the basemap style hasn't
      // committed its layers yet (e.g. fast theme toggle on a slow load).
    }
  }, [resolvedTheme, loaded, mapRef])
}
