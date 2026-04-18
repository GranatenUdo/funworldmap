import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { flyToCountry } from '../lib/flyToCountry'
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyDefaultBorderPaint,
  LAYER,
} from '../lib/mapLayers'
import { useMap } from './useMap'

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
      map.setFilter(LAYER.selected, filter)
      map.setFilter(LAYER.selectedBorder, filter)
      map.setFilter(LAYER.selectedGlow, filter)
      map.setFilter(LAYER.selectedExtrusion, filter)
      flyToCountry(map, selected)
    } else {
      map.setFilter(LAYER.selected, EMPTY)
      map.setFilter(LAYER.selectedBorder, EMPTY)
      map.setFilter(LAYER.selectedGlow, EMPTY)
      map.setFilter(LAYER.selectedExtrusion, EMPTY)
    }
  }, [selected, loaded, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (compareWith) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], compareWith.ccn3]
      map.setFilter(LAYER.compareFill, filter)
      map.setFilter(LAYER.compareBorder, filter)
      map.setFilter(LAYER.compareGlow, filter)
      map.setFilter(LAYER.compareExtrusion, filter)
    } else {
      map.setFilter(LAYER.compareFill, EMPTY)
      map.setFilter(LAYER.compareBorder, EMPTY)
      map.setFilter(LAYER.compareGlow, EMPTY)
      map.setFilter(LAYER.compareExtrusion, EMPTY)
    }
  }, [compareWith, loaded, mapRef])

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
      // Layers may not exist yet.
    }
  }, [compareWith, loaded, satellite, resolvedTheme, mapRef])
}
