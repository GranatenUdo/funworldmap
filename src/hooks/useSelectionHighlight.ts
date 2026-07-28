import { useEffect, type MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { flyToCountry } from '../lib/flyToCountry'
import { flyToComparePair } from '../lib/flyToComparePair'
import {
  EMPTY_FILTER as EMPTY,
  LAYER,
  spotlightDimFilter,
  applyCompareMarkers,
} from '../lib/mapLayers'
import { useMap } from './useMap'
import type { SelectionOrigin } from './useSelectedCountry'

interface Options {
  loaded: boolean
  selected: CountryData | null
  /** How the selection was made — map clicks keep the user's zoom, auto
   *  selections (search, chips, deep link) may zoom out. Ref, not value:
   *  reading it must not re-trigger the fly effect. */
  selectionOriginRef: MutableRefObject<SelectionOrigin>
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
export function useSelectionHighlight({
  loaded,
  selected,
  selectionOriginRef,
  compareWith,
}: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyOrClearFilter(map, SELECTION_LAYERS, selected?.ccn3 ?? null)
    if (selected)
      flyToCountry(map, selected, { preserveZoom: selectionOriginRef.current === 'click' })
  }, [selected, loaded, mapRef, selectionOriginRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyOrClearFilter(map, COMPARE_LAYERS, compareWith?.ccn3 ?? null)
    applyCompareMarkers(map, compareWith && selected ? { a: selected, b: compareWith } : null)
    // Fly to frame BOTH countries; clearing compare never moves the camera
    // (preserve-the-user's-view philosophy, batch-2 spec §3).
    if (compareWith && selected) flyToComparePair(map, selected, compareWith)
  }, [compareWith, selected, loaded, mapRef])

  // B4 spotlight: dim every country EXCEPT the selection (and the compare
  // partner). Single owner of the country-dim filter — derived solely from
  // selection state, so games never show the scrim (game start deselects,
  // App.tsx round-0 effect; the reveal path never touches selection).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    map.setFilter(LAYER.dim, spotlightDimFilter(selected?.ccn3 ?? null, compareWith?.ccn3 ?? null))
  }, [selected, compareWith, loaded, mapRef])
}
