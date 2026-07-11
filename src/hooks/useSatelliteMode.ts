import { useEffect } from 'react'
import { LAYER, applyBasemapLayerVisibility } from '../lib/mapLayers'
import { useMap } from './useMap'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

interface Options {
  loaded: boolean
  satellite: boolean
}

/** Satellite layer visibility, terrain, and basemap-layer hide/show —
 *  including hiding all basemap text during active play, because labels
 *  print the answers (country names for pinning, city names for
 *  city-guessing). Layer visibility itself is owned by
 *  applyBasemapLayerVisibility so the satellite toggle and the game gate
 *  cannot clobber each other (batch-2 spec §1). */
export function useSatelliteMode({ loaded, satellite }: Options): void {
  const { mapRef } = useMap()
  const { session } = useGameSessionContext()
  const playing = session.status === 'playing'

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
      applyBasemapLayerVisibility(map, { satellite, hideLabels: playing })
    } catch {
      // Layers may not exist yet.
    }
  }, [satellite, loaded, playing, mapRef])
}
