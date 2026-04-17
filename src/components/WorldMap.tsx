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
  applyWarmLighting,
} from '../lib/mapLayers'
import { useMapInstance } from '../hooks/useMapInstance'
import { useMapInteractions } from '../hooks/useMapInteractions'
import { useSelectionHighlight } from '../hooks/useSelectionHighlight'
import { useMapTheme } from '../hooks/useMapTheme'
import { useSatelliteMode } from '../hooks/useSatelliteMode'
import type { CountryData } from '../lib/types'

interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
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
    applyWarmLighting(map)
  }, [])

  const { supported, loaded, mapError, basemapDegraded } = useMapInstance({
    containerRef,
    onLoad,
  })

  useMapInteractions({ loaded, byNumeric, onSelect, onDeselect })
  useSelectionHighlight({ loaded, selected, compareWith, satellite, resolvedTheme })
  useMapTheme({ loaded, resolvedTheme })
  useSatelliteMode({ loaded, satellite, resolvedTheme, comparePickingMode })

  if (!supported) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-sand-100 dark:bg-dark-500 text-sand-700 dark:text-dark-50 p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-4">WebGL2 Not Supported</h1>
          <p>
            funworldmap requires WebGL2 to render the map. Please update your browser or enable
            hardware acceleration in your browser settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen">
      <div
        ref={containerRef}
        className="h-full w-full"
        data-map-loaded={loaded || undefined}
        data-map-error={mapError ?? undefined}
        tabIndex={0}
        role="application"
        aria-label="Interactive world map"
        aria-description="Use search to select countries by keyboard"
      />
      {basemapDegraded && mapError === null && <BasemapBanner />}
      {mapError !== null && (
        <MapErrorOverlay reason={mapError} onRetry={() => window.location.reload()} />
      )}
    </div>
  )
}
