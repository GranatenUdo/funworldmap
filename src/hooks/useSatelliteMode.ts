import { useEffect } from 'react'
import { DEFAULT_FILL_OPACITY, applyDefaultBorderPaint, LAYER } from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}

export function useSatelliteMode({
  loaded,
  satellite,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()

  // Satellite layer + terrain + base-layer hide/show + border tint.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    try {
      map.setLayoutProperty(
        LAYER.satellite,
        'visibility',
        satellite ? 'visible' : 'none',
      )

      if (satellite) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
      } else {
        map.setTerrain(null)
      }

      const style = map.getStyle()
      if (style?.layers) {
        const customPrefixes = ['country-', 'satellite-']
        for (const layer of style.layers) {
          const isCustom = customPrefixes.some((p) => layer.id.startsWith(p))
          if (!isCustom) {
            try {
              map.setLayoutProperty(
                layer.id,
                'visibility',
                satellite ? 'none' : 'visible',
              )
            } catch {
              /* some layers don't support visibility */
            }
          }
        }
      }

      if (satellite) {
        map.setPaintProperty(LAYER.borders, 'line-color', 'rgba(255,255,255,0.35)')
        map.setPaintProperty(LAYER.borders, 'line-opacity', 0.6)
        map.setPaintProperty(LAYER.fill, 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.32,
          0.03,
        ])
      } else {
        applyDefaultBorderPaint(map, resolvedTheme === 'dark')
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [satellite, loaded, resolvedTheme, mapRef])
}
