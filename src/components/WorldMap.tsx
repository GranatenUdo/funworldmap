import { useRef, useEffect, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  BASEMAP_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_PITCH,
} from '../lib/mapStyles'
import { flyToCountry } from '../lib/flyToCountry'
import { applyMapTheme } from '../lib/mapColors'
import type { CountryData } from '../lib/types'

/** Accent colors — violet for exploration, orange for commitment */
const ACCENT_VIOLET = '#7c3aed'
const ACCENT_VIOLET_DARK = '#a78bfa'
const WARM_ORANGE = '#ea580c'
const WARM_ORANGE_DARK = '#fb923c'

interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
  resolvedTheme: 'light' | 'dark'
  onSelect: (cca3: string) => void
  onDeselect: () => void
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

    // Fix antimeridian artifacts: normalize polygons that cross 180° longitude.
    // Shift negative longitudes to positive (e.g., -170° → 190°) so the polygon
    // doesn't wrap around the globe. MapLibre handles coordinates > 180° correctly.
    for (const feature of geojson.features) {
      const polygons =
        feature.geometry.type === 'MultiPolygon'
          ? (feature.geometry as GeoJSON.MultiPolygon).coordinates
          : feature.geometry.type === 'Polygon'
            ? [(feature.geometry as GeoJSON.Polygon).coordinates]
            : []

      for (const polygon of polygons) {
        let hasHighPositive = false
        let hasHighNegative = false
        for (const ring of polygon) {
          for (const coord of ring) {
            if (coord[0] > 170) hasHighPositive = true
            if (coord[0] < -170) hasHighNegative = true
          }
        }
        if (hasHighPositive && hasHighNegative) {
          for (const ring of polygon) {
            for (const coord of ring) {
              if (coord[0] < 0) coord[0] += 360
            }
          }
        }
      }
    }

    map.addSource('countries', {
      type: 'geojson',
      data: geojson,
      promoteId: 'id', // needed for feature-state with string IDs
    })

    // Base fill layer — for click targeting and subtle hover tint
    map.addLayer({
      id: 'country-fill',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': ACCENT_VIOLET,
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.22,
          0.06,
        ],
      },
    })

    // Country borders
    map.addLayer({
      id: 'country-borders',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': '#94a3b8', 'line-width': 0.5, 'line-opacity': 0.5 },
    })

    // 3D extrusion layer — countries rise on hover
    map.addLayer({
      id: 'country-extrusion',
      type: 'fill-extrusion',
      source: 'countries',
      paint: {
        'fill-extrusion-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          ACCENT_VIOLET,
          'transparent',
        ],
        'fill-extrusion-height': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          40000,
          0,
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.6,
      },
    })

    // Apply extrusion transition for smooth hover animation
    try {
      map.setPaintProperty(
        'country-extrusion',
        'fill-extrusion-height-transition' as never,
        { duration: 300, delay: 0 } as never,
      )
    } catch {
      // Transition properties may not be supported in all versions
    }

    // Selected country glow (wide blurred line beneath selection border)
    map.addLayer({
      id: 'country-selected-glow',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': WARM_ORANGE,
        'line-width': 8,
        'line-blur': 4,
        'line-opacity': 0.25,
      },
      filter: ['==', ['get', 'id'], ''],
    })

    // Selected country fill
    map.addLayer({
      id: 'country-selected',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': WARM_ORANGE, 'fill-opacity': 0.30 },
      filter: ['==', ['get', 'id'], ''],
    })

    // Selected country border
    map.addLayer({
      id: 'country-selected-border',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': WARM_ORANGE, 'line-width': 2 },
      filter: ['==', ['get', 'id'], ''],
    })

    // Selected country extrusion (taller than hover)
    map.addLayer({
      id: 'country-selected-extrusion',
      type: 'fill-extrusion',
      source: 'countries',
      paint: {
        'fill-extrusion-color': WARM_ORANGE,
        'fill-extrusion-height': 60000,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.5,
      },
      filter: ['==', ['get', 'id'], ''],
    })

    // Apply selected extrusion transition
    try {
      map.setPaintProperty(
        'country-selected-extrusion',
        'fill-extrusion-height-transition' as never,
        { duration: 400, delay: 0 } as never,
      )
    } catch {
      // Transition properties may not be supported in all versions
    }

    // Lighting for 3D depth
    map.setLight({
      anchor: 'viewport',
      position: [1.5, 210, 30],
      intensity: 0.25,
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

    const reducedMotion = prefersReducedMotion()

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: reducedMotion ? 0 : DEFAULT_PITCH,
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
      // Update selected layer filters
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], selected.ccn3]
      map.setFilter('country-selected', filter)
      map.setFilter('country-selected-border', filter)
      map.setFilter('country-selected-glow', filter)
      map.setFilter('country-selected-extrusion', filter)
      flyToCountry(map, selected)
    } else {
      // Clear selection
      const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
      map.setFilter('country-selected', emptyFilter)
      map.setFilter('country-selected-border', emptyFilter)
      map.setFilter('country-selected-glow', emptyFilter)
      map.setFilter('country-selected-extrusion', emptyFilter)
    }
  }, [selected, loaded])

  // Apply basemap dark/light mode + theme-aware accent colors
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyMapTheme(map, resolvedTheme)

    // Update accent colors for theme
    const isDark = resolvedTheme === 'dark'
    const violet = isDark ? ACCENT_VIOLET_DARK : ACCENT_VIOLET
    const orange = isDark ? WARM_ORANGE_DARK : WARM_ORANGE

    try {
      // Fill layer accent
      map.setPaintProperty('country-fill', 'fill-color', violet)

      // Extrusion accent
      map.setPaintProperty('country-extrusion', 'fill-extrusion-color', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        violet,
        'transparent',
      ])

      // Selection layers
      map.setPaintProperty('country-selected', 'fill-color', orange)
      map.setPaintProperty('country-selected-border', 'line-color', orange)
      map.setPaintProperty('country-selected-glow', 'line-color', orange)
      map.setPaintProperty('country-selected-extrusion', 'fill-extrusion-color', orange)

      // Border color adjusts for dark mode
      map.setPaintProperty('country-borders', 'line-color', isDark ? '#30363d' : '#94a3b8')

      // Atmospheric fog
      ;(map as never as { setFog: (fog: Record<string, unknown>) => void }).setFog({
        range: [2, 12],
        color: isDark ? 'rgba(13, 17, 23, 0.6)' : 'rgba(240, 237, 230, 0.5)',
        'high-color': isDark ? '#0d1117' : '#afd2e6',
        'horizon-blend': 0.08,
      })
    } catch {
      // Layers may not exist yet during initial render
    }
  }, [resolvedTheme, loaded])

  if (!supported) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-ground-100 dark:bg-void-500 text-ground-700 dark:text-void-50 p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold mb-4 font-display">WebGL2 Not Supported</h1>
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
