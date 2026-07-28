import { useEffect } from 'react'
import { EMPTY_FILTER as EMPTY, applySelectionColor, LAYER } from '../lib/mapLayers'
import { ICE, ICE_DEEP, ICE_MID, SIGNAL } from '../lib/mapPalette'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  compareWith: { ccn3: string } | null
  resolvedTheme: 'light' | 'dark'
}

/** Compare-view highlight management: suppress hover layers while picking is
 *  meaningless, and pin the A/B colours to the panel badges (A = signal,
 *  B = ice-mid; E4). Baseline fill/border dimming lives in
 *  useCountryBaselinePaint, so baseline-paint call order no longer matters
 *  (#111 item 1). Call order: must still run AFTER useMapTheme — both write
 *  the selection colours, and the compare SIGNAL pin must win over the
 *  theme's ice (ICE in dark, ICE_DEEP in light). */
export function useCompareViewHighlight({ loaded, compareWith, resolvedTheme }: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    try {
      if (compareWith !== null) {
        map.setFilter(LAYER.hoverBorder, EMPTY)
        map.setFilter(LAYER.extrusion, EMPTY)
        // Pin A = signal badge colour, B = ice-mid, overriding whatever
        // useMapTheme set (it writes the theme ice in both themes).
        applySelectionColor(map, SIGNAL)
        map.setPaintProperty(LAYER.compareFill, 'fill-color', ICE_MID)
        map.setPaintProperty(LAYER.compareBorder, 'line-color', ICE_MID)
        map.setPaintProperty(LAYER.compareGlow, 'line-color', ICE_MID)
        map.setPaintProperty(LAYER.compareExtrusion, 'fill-extrusion-color', ICE_MID)
      } else {
        // Restore the selection highlight to the theme-appropriate ice.
        applySelectionColor(map, resolvedTheme === 'dark' ? ICE : ICE_DEEP)
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [compareWith, loaded, resolvedTheme, mapRef])
}
