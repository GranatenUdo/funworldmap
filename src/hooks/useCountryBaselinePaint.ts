import { useEffect } from 'react'
import { applyCountryBaselinePaint } from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  satellite: boolean
  inCompareView: boolean
  resolvedTheme: 'light' | 'dark'
}

/** Single owner of the country-fill opacity + country-borders baseline paint.
 *  Replaces the pre-2026-06 pattern where useSatelliteMode and the compare
 *  hook each wrote these with call-order deciding the winner (#111 item 1). */
export function useCountryBaselinePaint({
  loaded,
  satellite,
  inCompareView,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    try {
      applyCountryBaselinePaint(map, { satellite, inCompareView, isDark: resolvedTheme === 'dark' })
    } catch {
      // Layers may not exist yet (e.g. fast toggle before load completes).
    }
  }, [loaded, satellite, inCompareView, resolvedTheme, mapRef])
}
