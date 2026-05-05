import { useEffect } from 'react'
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyBorderPaintForMode,
  applySelectionColor,
  LAYER,
} from '../lib/mapLayers'
import { CORAL, CORAL_LIGHT, TEAL_DIM } from '../lib/mapPalette'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  compareWith: { ccn3: string } | null
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}

/** Dim the base fill + borders and clear hover layers while in compare view.
 *  Also pins the A/B highlight colours to match the panel badges: A (the
 *  selected country) = coral (#f43f5e), B (compareWith) = teal-dim (#0d9488).
 *  On exit, restores the selection highlight to the theme-appropriate coral.
 *  Call order: must run AFTER useMapTheme and useSatelliteMode so its paint
 *  writes win when compareWith !== null. */
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

        // Pin A (selected) = coral badge colour, B (compareWith) = teal-dim badge
        // colour, overriding whatever useMapTheme set (it uses CORAL_LIGHT in dark).
        applySelectionColor(map, CORAL)

        map.setPaintProperty(LAYER.compareFill, 'fill-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareBorder, 'line-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareGlow, 'line-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareExtrusion, 'fill-extrusion-color', TEAL_DIM)
      } else {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
        applyBorderPaintForMode(map, { isDark: resolvedTheme === 'dark', satellite })

        // Restore the selection highlight to the theme-appropriate coral so
        // single-country selection outside compare looks right in both themes.
        const coral = resolvedTheme === 'dark' ? CORAL_LIGHT : CORAL
        applySelectionColor(map, coral)
      }
    } catch {
      // Layers may not exist yet (e.g. fast theme toggle before load completes).
    }
  }, [compareWith, loaded, satellite, resolvedTheme, mapRef])
}
