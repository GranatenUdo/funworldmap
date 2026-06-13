import { useEffect } from 'react'
import { LAYER } from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  satellite: boolean
}

/** Satellite layer visibility, terrain, and base-layer hide/show.
 *  Border tint and fill opacity are now owned by useCountryBaselinePaint —
 *  this hook no longer writes those paint properties. */
export function useSatelliteMode({ loaded, satellite }: Options): void {
  const { mapRef } = useMap()

  // Satellite layer + terrain + base-layer hide/show.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    try {
      map.setLayoutProperty(LAYER.satellite, 'visibility', satellite ? 'visible' : 'none')

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
              map.setLayoutProperty(layer.id, 'visibility', satellite ? 'none' : 'visible')
            } catch {
              /* some layers don't support visibility */
            }
          }
        }
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [satellite, loaded, mapRef])
}
