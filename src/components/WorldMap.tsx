import { useRef, useEffect, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BASEMAP_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM } from '../lib/mapStyles'
import { flyToCountry } from '../lib/flyToCountry'
import { applyMapTheme } from '../lib/mapColors'
import type { CountryData } from '../lib/types'

interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
  resolvedTheme: 'light' | 'dark'
  onSelect: (cca3: string) => void
  onDeselect: () => void
}

export default function WorldMap({ byNumeric, selected, resolvedTheme, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const hoveredRef = useRef<string | null>(null)

  // Store callbacks in refs to avoid re-creating map on prop changes
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onDeselectRef = useRef(onDeselect)
  onDeselectRef.current = onDeselect
  const byNumericRef = useRef(byNumeric)
  byNumericRef.current = byNumeric

  const addCountryLayers = useCallback(async (map: maplibregl.Map) => {
    const [topojsonClient, worldAtlas] = await Promise.all([
      import('topojson-client'),
      import('world-atlas/countries-50m.json'),
    ])

    const topology = worldAtlas.default as unknown as TopoJSON.Topology
    const geojson = topojsonClient.feature(
      topology,
      topology.objects.countries,
    ) as GeoJSON.FeatureCollection

    // Copy top-level feature.id into properties so that:
    // - promoteId: 'id' can find it (reads from properties, not top-level)
    // - ['get', 'id'] filter expressions can match it (reads from properties)
    for (const feature of geojson.features) {
      if (feature.id != null && feature.properties) {
        feature.properties.id = String(feature.id)
      }
    }

    map.addSource('countries', {
      type: 'geojson',
      data: geojson,
      promoteId: 'id', // needed for feature-state with string IDs
    })

    map.addLayer({
      id: 'country-fill',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': '#6366f1',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.2,
          0.08,
        ],
      },
    })

    map.addLayer({
      id: 'country-borders',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': '#94a3b8', 'line-width': 0.5 },
    })

    map.addLayer({
      id: 'country-selected',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.35 },
      filter: ['==', ['get', 'id'], ''],
    })

    map.addLayer({
      id: 'country-selected-border',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': '#4f46e5', 'line-width': 2 },
      filter: ['==', ['get', 'id'], ''],
    })

    // --- Hover interaction ---
    map.on('mousemove', 'country-fill', (e) => {
      if (e.features && e.features.length > 0) {
        const id = String(e.features[0].id)
        if (hoveredRef.current !== null && hoveredRef.current !== id) {
          map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        }
        hoveredRef.current = id
        map.setFeatureState({ source: 'countries', id }, { hover: true })
        map.getCanvas().style.cursor = 'pointer'
      }
    })

    map.on('mouseleave', 'country-fill', () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        hoveredRef.current = null
      }
      map.getCanvas().style.cursor = ''
    })

    // --- Click interaction ---
    map.on('click', 'country-fill', (e) => {
      if (e.features && e.features.length > 0) {
        const featureId = String(e.features[0].id)
        const country = byNumericRef.current.get(featureId)
        if (country) {
          onSelectRef.current(country.cca3)
        }
      }
    })

    // Deselect on click on empty space (ocean)
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['country-fill'] })
      if (features.length === 0) {
        onDeselectRef.current()
      }
    })

    setLoaded(true)
  }, [])

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      })
    } catch {
      setSupported(false)
      return
    }

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    mapRef.current = map

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__polworldmap_map = map
    }

    map.on('load', () => {
      addCountryLayers(map).catch(console.error)
    })

    map.on('error', (e) => {
      console.warn('Map error:', e.error?.message || e)
    })

    return () => {
      map.remove()
      mapRef.current = null
      if (import.meta.env.DEV) {
        delete (window as unknown as Record<string, unknown>).__polworldmap_map
      }
    }
  }, [addCountryLayers])

  // Update highlight + camera when selection changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (selected) {
      // Update selected layer filter
      map.setFilter('country-selected', ['==', ['get', 'id'], selected.ccn3])
      map.setFilter('country-selected-border', ['==', ['get', 'id'], selected.ccn3])
      flyToCountry(map, selected)
    } else {
      // Clear selection
      map.setFilter('country-selected', ['==', ['get', 'id'], ''])
      map.setFilter('country-selected-border', ['==', ['get', 'id'], ''])
    }
  }, [selected, loaded])

  // Apply basemap dark/light mode
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyMapTheme(map, resolvedTheme)
  }, [resolvedTheme, loaded])

  if (!supported) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold mb-4">WebGL2 Not Supported</h1>
          <p>
            polworldmap requires WebGL2 to render the map. Please update your browser or enable
            hardware acceleration in your browser settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen"
      data-map-loaded={loaded || undefined}
      tabIndex={0}
      role="application"
      aria-label="Interactive world map"
      aria-description="Use search to select countries by keyboard"
    />
  )
}
