import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { flyToCountry } from '../lib/flyToCountry'
import { useMap } from './useMap'

const EMPTY: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']

interface Options {
  loaded: boolean
  selected: CountryData | null
  compareWith: CountryData | null
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}

/** Apply selection + compare filters and adjust base-layer dimming when in
 *  compare view. Flies camera to the selected country. */
export function useSelectionHighlight({
  loaded,
  selected,
  compareWith,
  satellite,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (selected) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], selected.ccn3]
      map.setFilter('country-selected', filter)
      map.setFilter('country-selected-border', filter)
      map.setFilter('country-selected-glow', filter)
      map.setFilter('country-selected-extrusion', filter)
      flyToCountry(map, selected)
    } else {
      map.setFilter('country-selected', EMPTY)
      map.setFilter('country-selected-border', EMPTY)
      map.setFilter('country-selected-glow', EMPTY)
      map.setFilter('country-selected-extrusion', EMPTY)
    }
  }, [selected, loaded, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (compareWith) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], compareWith.ccn3]
      map.setFilter('country-compare-fill', filter)
      map.setFilter('country-compare-border', filter)
      map.setFilter('country-compare-glow', filter)
      map.setFilter('country-compare-extrusion', filter)
    } else {
      map.setFilter('country-compare-fill', EMPTY)
      map.setFilter('country-compare-border', EMPTY)
      map.setFilter('country-compare-glow', EMPTY)
      map.setFilter('country-compare-extrusion', EMPTY)
    }
  }, [compareWith, loaded, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const inCompareView = compareWith !== null
    try {
      if (inCompareView) {
        map.setPaintProperty('country-fill', 'fill-opacity', 0.05)
        map.setFilter('country-hover-border', EMPTY)
        map.setFilter('country-extrusion', EMPTY)
        map.setPaintProperty('country-borders', 'line-opacity', 0.15)
      } else if (!satellite) {
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.28,
          0.05,
        ])
        const isDark = resolvedTheme === 'dark'
        map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [compareWith, loaded, satellite, resolvedTheme, mapRef])
}
