import { useEffect } from 'react'
import { EMPTY_FILTER as EMPTY, applySelectionColor, LAYER } from '../lib/mapLayers'
import { CORAL, CORAL_LIGHT, TEAL_DIM } from '../lib/mapPalette'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  compareWith: { ccn3: string } | null
  resolvedTheme: 'light' | 'dark'
}

/** Compare-view highlight management: suppress hover layers while picking is
 *  meaningless, and pin the A/B colours to the panel badges (A = coral,
 *  B = teal-dim). Baseline fill/border dimming lives in
 *  useCountryBaselinePaint, so baseline-paint call order no longer matters
 *  (#111 item 1). Call order: must still run AFTER useMapTheme — both write
 *  the selection colours, and the compare CORAL pin must win over the
 *  theme's dark-mode CORAL_LIGHT. */
export function useCompareViewHighlight({ loaded, compareWith, resolvedTheme }: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    try {
      if (compareWith !== null) {
        map.setFilter(LAYER.hoverBorder, EMPTY)
        map.setFilter(LAYER.extrusion, EMPTY)
        // Pin A = coral badge colour, B = teal-dim badge colour, overriding
        // whatever useMapTheme set (it uses CORAL_LIGHT in dark).
        applySelectionColor(map, CORAL)
        map.setPaintProperty(LAYER.compareFill, 'fill-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareBorder, 'line-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareGlow, 'line-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareExtrusion, 'fill-extrusion-color', TEAL_DIM)
      } else {
        // Restore the selection highlight to the theme-appropriate coral.
        applySelectionColor(map, resolvedTheme === 'dark' ? CORAL_LIGHT : CORAL)
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [compareWith, loaded, resolvedTheme, mapRef])
}
