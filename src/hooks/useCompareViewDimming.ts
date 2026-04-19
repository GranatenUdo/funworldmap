import { useEffect } from 'react'
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyBorderPaintForMode,
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
 *  CALL ORDER: must run AFTER useMapTheme and useSatelliteMode. All three
 *  hooks write country-borders line-opacity on resolvedTheme or satellite
 *  change; this hook needs to win when compareWith !== null.
 *
 *  Logic is unit-tested in __tests__/useCompareViewDimming.test.tsx. The
 *  call-order coupling is enforced by WorldMap.tsx's hook call sequence
 *  and by code review — the regression would be immediately visible to
 *  users toggling dark mode while comparing two countries. */
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
      } else {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
        applyBorderPaintForMode(map, { isDark: resolvedTheme === 'dark', satellite })
      }
    } catch {
      // Layers may not exist yet (e.g. fast theme toggle before load completes).
    }
  }, [compareWith, loaded, satellite, resolvedTheme, mapRef])
}
