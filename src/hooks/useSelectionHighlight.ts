import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { flyToCountry } from '../lib/flyToCountry'
import { EMPTY_FILTER as EMPTY, LAYER } from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  selected: CountryData | null
  compareWith: CountryData | null
}

/** Apply selection + compare filters. Flies camera to the selected country.
 *  Compare-view dimming lives in useCompareViewDimming (separate hook
 *  because it has different deps and must run after useMapTheme). */
export function useSelectionHighlight({
  loaded,
  selected,
  compareWith,
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
}
