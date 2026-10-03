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
import { DESKTOP_MEDIA_QUERY } from '../lib/layoutConstants'
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

  // B-1 (2026-08-04): a fly's screen offset is computed for the layout at fly
  // time, so crossing the desktop/mobile breakpoint afterwards (rotation,
  // resize, DevTools emulation) strands the selection under the panel/sheet.
  // Re-center instantly with the fresh offset via flyToCountry's recenter jump
  // (single camera owner — no second fly site). The subscription's lifetime IS
  // the gate: it exists only while a single country is selected outside
  // compare — compare framing is flyToComparePair's job, and during games the
  // selection is null (game hashes never resolve to a country; a non-game hash
  // mid-game ends the game via useHashGameRouter). Plain resizes inside one
  // breakpoint (mobile URL-bar drift) are accepted and left alone.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded || !selected || compareWith) return
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const recenter = () => flyToCountry(map, selected, { recenter: true })
    mql.addEventListener('change', recenter)
    return () => mql.removeEventListener('change', recenter)
  }, [selected, compareWith, loaded, mapRef])

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
