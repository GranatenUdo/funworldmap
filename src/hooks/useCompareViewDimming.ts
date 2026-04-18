import { useEffect } from 'react'
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyDefaultBorderPaint,
  LAYER,
} from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  compareWith: { ccn3: string } | null
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}

/** Dim the base fill + borders and clear hover layers when the user is in
 *  compare view. When compare ends (and not in satellite mode), restore the
 *  theme-default fill opacity and border paint.
 *
 *  CALL ORDER: must run AFTER useMapTheme. Both hooks write
 *  country-borders line-opacity on resolvedTheme change; this hook needs
 *  to win when compareWith !== null. */
export function useCompareViewDimming({
  loaded,
  compareWith,
  satellite,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const inCompareView = compareWith !== null
    try {
      if (inCompareView) {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', 0.05)
        map.setFilter(LAYER.hoverBorder, EMPTY)
        map.setFilter(LAYER.extrusion, EMPTY)
        map.setPaintProperty(LAYER.borders, 'line-opacity', 0.15)
      } else if (!satellite) {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
        applyDefaultBorderPaint(map, resolvedTheme === 'dark')
      }
    } catch {
      // Layers may not exist yet (e.g. fast theme toggle before load completes).
    }
  }, [compareWith, loaded, satellite, resolvedTheme, mapRef])
}
