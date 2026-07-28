import { useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapErrorOverlay } from './MapErrorOverlay'
import { BasemapBanner } from './BasemapBanner'
import { loadCountryGeojson } from '../lib/loadCountryGeojson'
import {
  addRasterSources,
  addCountrySource,
  addBaseCountryLayers,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  addCountryLabelLayer,
  applyWarmLighting,
} from '../lib/mapLayers'
import { COUNTRY_LABEL_COLLECTION } from '../lib/countryLabelFeatures'
import { useMapInstance } from '../hooks/useMapInstance'
import { useMapInteractions } from '../hooks/useMapInteractions'
import { useSelectionHighlight } from '../hooks/useSelectionHighlight'
import { useMapTheme } from '../hooks/useMapTheme'
import { useSatelliteMode } from '../hooks/useSatelliteMode'
import { useCountryBaselinePaint } from '../hooks/useCountryBaselinePaint'
import { useCompareViewHighlight } from '../hooks/useCompareViewHighlight'
import type { CountryData } from '../lib/types'
import type { MutableRefObject } from 'react'
import type { SelectionOrigin } from '../hooks/useSelectedCountry'

interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
  selectionOriginRef: MutableRefObject<SelectionOrigin>
  compareWith: CountryData | null
  comparePickingMode: boolean
  resolvedTheme: 'light' | 'dark'
  satellite: boolean
  onSelect: (cca3: string) => void
  onDeselect: () => void
}

export default function WorldMap({
  byNumeric,
  selected,
  selectionOriginRef,
  compareWith,
  comparePickingMode,
  resolvedTheme,
  satellite,
  onSelect,
  onDeselect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const onLoad = useCallback(async (map: maplibregl.Map) => {
    const geojson = await loadCountryGeojson()
    addRasterSources(map)
    addCountrySource(map, geojson)
    addBaseCountryLayers(map)
    addHoverLayers(map)
    addSelectionLayers(map)
    addCompareLayers(map)
    // Added LAST so labels render above every other app layer. Starts hidden;
    // useSatelliteMode's applyBasemapLayerVisibility pass owns its visibility.
    addCountryLabelLayer(map, COUNTRY_LABEL_COLLECTION)
    applyWarmLighting(map)
  }, [])

  const { supported, loaded, mapError, basemapDegraded, retryWebGL } = useMapInstance({
    containerRef,
    onLoad,
  })

  useMapInteractions({ loaded, byNumeric, onSelect, onDeselect, comparePickingMode })
  useSelectionHighlight({ loaded, selected, selectionOriginRef, compareWith })
  useMapTheme({ loaded, resolvedTheme })
  useSatelliteMode({ loaded, satellite })
  useCountryBaselinePaint({ loaded, satellite, inCompareView: compareWith !== null, resolvedTheme })
  useCompareViewHighlight({ loaded, compareWith, resolvedTheme })

  if (!supported) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-sand-100 dark:bg-dark-500 text-sand-700 dark:text-dark-50 p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-4">WebGL Not Available</h1>
          <p>
            funworldmap needs WebGL to render the map (WebGL2 preferred, WebGL1 supported). Please
            update your browser or enable hardware acceleration in your browser settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    // overflow-hidden: the hover tooltip is absolutely positioned inside this
    // wrapper by raw-DOM writes; a stale position near an edge (or after a
    // viewport shrink) must clip at the map bounds instead of stretching the
    // document into page scrollbars (2026-07-10 review).
    <div className="relative h-screen w-screen overflow-hidden">
      <div
        ref={containerRef}
        className="h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-teal dark:focus-visible:outline-teal-light"
        data-map-loaded={loaded || undefined}
        data-map-error={mapError ?? undefined}
        tabIndex={0}
        role="application"
        aria-label="Interactive world map"
        aria-description="Pan with arrow keys, zoom with plus/minus, reset view with Home, deselect with Escape"
      />
      {basemapDegraded && mapError === null && <BasemapBanner />}
      {mapError !== null && (
        <MapErrorOverlay
          reason={mapError}
          onRetry={mapError === 'webgl-lost' ? retryWebGL : () => window.location.reload()}
        />
      )}
    </div>
  )
}
