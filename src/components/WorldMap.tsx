import { useRef, useEffect, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BASEMAP_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM } from '../lib/mapStyles'

export default function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)

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

    map.addSource('countries', { type: 'geojson', data: geojson })

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
      filter: ['==', ['id'], ''],
    })

    map.addLayer({
      id: 'country-selected-border',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': '#4f46e5', 'line-width': 2 },
      filter: ['==', ['id'], ''],
    })

    setLoaded(true)
  }, [])

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

    // Expose map instance in dev mode immediately for Playwright tests
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
      role="application"
      aria-label="Interactive world map"
      aria-description="Use search to select countries by keyboard"
    />
  )
}
