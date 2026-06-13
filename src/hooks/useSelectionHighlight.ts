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

const SELECTION_LAYERS = [
  LAYER.selected,
  LAYER.selectedBorder,
  LAYER.selectedGlow,
  LAYER.selectedExtrusion,
] as const

const COMPARE_LAYERS = [
  LAYER.compareFill,
  LAYER.compareBorder,
  LAYER.compareGlow,
  LAYER.compareExtrusion,
] as const

function applyOrClearFilter(
  map: maplibregl.Map,
  layerIds: readonly string[],
  ccn3: string | null,
): void {
  const filter: maplibregl.FilterSpecification = ccn3 ? ['==', ['get', 'id'], ccn3] : EMPTY
  for (const id of layerIds) map.setFilter(id, filter)
}

/** Apply selection + compare filters. Flies camera to the selected country.
 *  Compare-view highlight management lives in useCompareViewHighlight (separate
 *  hook); baseline paint lives in useCountryBaselinePaint. */
export function useSelectionHighlight({ loaded, selected, compareWith }: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyOrClearFilter(map, SELECTION_LAYERS, selected?.ccn3 ?? null)
    if (selected) flyToCountry(map, selected)
  }, [selected, loaded, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyOrClearFilter(map, COMPARE_LAYERS, compareWith?.ccn3 ?? null)
  }, [compareWith, loaded, mapRef])
}
