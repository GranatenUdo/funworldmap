import { useRef, useEffect, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  BASEMAP_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_PITCH,
  SATELLITE_TILES,
  SATELLITE_ATTRIBUTION,
} from '../lib/mapStyles'
import { flyToCountry } from '../lib/flyToCountry'
import { applyMapTheme } from '../lib/mapColors'
import type { CountryData } from '../lib/types'

/** Warm Explorer palette — teal for exploration, coral for selection */
const TEAL = '#14b8a6'
const TEAL_LIGHT = '#5eead4'
const CORAL = '#f43f5e'
const CORAL_LIGHT = '#fb7185'

interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
  resolvedTheme: 'light' | 'dark'
  satellite: boolean
  onSelect: (cca3: string) => void
  onDeselect: () => void
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function WorldMap({ byNumeric, selected, resolvedTheme, satellite, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const hoveredRef = useRef<string | null>(null)

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

    for (const feature of geojson.features) {
      if (feature.id != null && feature.properties) {
        feature.properties.id = String(feature.id)
      }
    }

    // Antimeridian fix — skip polar-wrapping polygons
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
        let touchesPole = false
        for (const ring of polygon) {
          for (const coord of ring) {
            if (coord[0] > 170) hasHighPositive = true
            if (coord[0] < -170) hasHighNegative = true
            if (coord[1] <= -85 || coord[1] >= 85) touchesPole = true
          }
        }
        if (hasHighPositive && hasHighNegative && !touchesPole) {
          for (const ring of polygon) {
            for (const coord of ring) {
              if (coord[0] < 0) coord[0] += 360
            }
          }
        }
      }
    }

    // Satellite raster source — hidden by default, toggled by satellite prop
    map.addSource('satellite', {
      type: 'raster',
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      attribution: SATELLITE_ATTRIBUTION,
    })

    map.addLayer({
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      layout: { visibility: 'none' },
    })

    map.addSource('countries', {
      type: 'geojson',
      data: geojson,
      promoteId: 'id',
    })

    // Base fill — dramatic 5% → 28% opacity jump on hover ("ignite" effect)
    map.addLayer({
      id: 'country-fill',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': TEAL,
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.28,
          0.05,
        ],
      },
    })

    // Country borders — subtle in dark, warmer in light
    map.addLayer({
      id: 'country-borders',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': '#334155', 'line-width': 0.5, 'line-opacity': 0.4 },
    })

    // Hover glow — soft teal border that appears on hover
    map.addLayer({
      id: 'country-hover-border',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': TEAL,
        'line-width': 2,
        'line-opacity': 0.6,
      },
      filter: ['==', ['get', 'id'], ''],
    })

    // 3D extrusion — filter-based, only hovered country
    map.addLayer({
      id: 'country-extrusion',
      type: 'fill-extrusion',
      source: 'countries',
      paint: {
        'fill-extrusion-color': TEAL,
        'fill-extrusion-height': 60000,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.65,
      },
      filter: ['==', ['get', 'id'], ''],
    })

    // --- Selection layers ---
    map.addLayer({
      id: 'country-selected-glow',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': CORAL,
        'line-width': 10,
        'line-blur': 5,
        'line-opacity': 0.3,
      },
      filter: ['==', ['get', 'id'], ''],
    })

    map.addLayer({
      id: 'country-selected',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': CORAL, 'fill-opacity': 0.32 },
      filter: ['==', ['get', 'id'], ''],
    })

    map.addLayer({
      id: 'country-selected-border',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': CORAL, 'line-width': 2.5 },
      filter: ['==', ['get', 'id'], ''],
    })

    map.addLayer({
      id: 'country-selected-extrusion',
      type: 'fill-extrusion',
      source: 'countries',
      paint: {
        'fill-extrusion-color': CORAL,
        'fill-extrusion-height': 80000,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.55,
      },
      filter: ['==', ['get', 'id'], ''],
    })

    // Lighting — warm directional
    map.setLight({
      anchor: 'viewport',
      position: [1.5, 210, 30],
      intensity: 0.3,
    })

    // --- Hover ---
    map.on('mousemove', 'country-fill', (e) => {
      if (e.features && e.features.length > 0) {
        const id = String(e.features[0].id)
        if (hoveredRef.current !== null && hoveredRef.current !== id) {
          map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        }
        hoveredRef.current = id
        map.setFeatureState({ source: 'countries', id }, { hover: true })
        map.setFilter('country-extrusion', ['==', ['get', 'id'], id])
        map.setFilter('country-hover-border', ['==', ['get', 'id'], id])
        map.getCanvas().style.cursor = 'pointer'
      }
    })

    map.on('mouseleave', 'country-fill', () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        hoveredRef.current = null
      }
      map.setFilter('country-extrusion', ['==', ['get', 'id'], ''])
      map.setFilter('country-hover-border', ['==', ['get', 'id'], ''])
      map.getCanvas().style.cursor = ''
    })

    // --- Click ---
    map.on('click', 'country-fill', (e) => {
      if (e.features && e.features.length > 0) {
        const featureId = String(e.features[0].id)
        const country = byNumericRef.current.get(featureId)
        if (country) {
          onSelectRef.current(country.cca3)
        }
      }
    })

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['country-fill'] })
      if (features.length === 0) {
        onDeselectRef.current()
      }
    })

    setLoaded(true)
  }, [])

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

  // Selection highlight + camera
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (selected) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], selected.ccn3]
      map.setFilter('country-selected', filter)
      map.setFilter('country-selected-border', filter)
      map.setFilter('country-selected-glow', filter)
      map.setFilter('country-selected-extrusion', filter)
      flyToCountry(map, selected)
    } else {
      const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
      map.setFilter('country-selected', emptyFilter)
      map.setFilter('country-selected-border', emptyFilter)
      map.setFilter('country-selected-glow', emptyFilter)
      map.setFilter('country-selected-extrusion', emptyFilter)
    }
  }, [selected, loaded])

  // Theme-aware colors
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyMapTheme(map, resolvedTheme)

    const isDark = resolvedTheme === 'dark'
    const teal = isDark ? TEAL_LIGHT : TEAL
    const coral = isDark ? CORAL_LIGHT : CORAL

    try {
      map.setPaintProperty('country-fill', 'fill-color', teal)
      map.setPaintProperty('country-extrusion', 'fill-extrusion-color', teal)
      map.setPaintProperty('country-hover-border', 'line-color', teal)

      map.setPaintProperty('country-selected', 'fill-color', coral)
      map.setPaintProperty('country-selected-border', 'line-color', coral)
      map.setPaintProperty('country-selected-glow', 'line-color', coral)
      map.setPaintProperty('country-selected-extrusion', 'fill-extrusion-color', coral)

      map.setPaintProperty('country-borders', 'line-color', isDark ? '#1e293b' : '#94a3b8')
      map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)

      ;(map as never as { setFog: (fog: Record<string, unknown>) => void }).setFog({
        range: [1.5, 10],
        color: isDark ? 'rgba(16, 20, 26, 0.7)' : 'rgba(232, 227, 218, 0.5)',
        'high-color': isDark ? '#10141a' : '#c4d8e6',
        'horizon-blend': 0.1,
      })
    } catch {
      // Layers may not exist yet
    }
  }, [resolvedTheme, loaded])

  // Toggle satellite view — show/hide satellite layer and basemap layers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    try {
      // Toggle satellite raster layer
      map.setLayoutProperty(
        'satellite-layer',
        'visibility',
        satellite ? 'visible' : 'none',
      )

      // Toggle basemap layers visibility (everything that's not our custom layers)
      const style = map.getStyle()
      if (style?.layers) {
        const customPrefixes = ['country-', 'satellite-']
        for (const layer of style.layers) {
          const isCustom = customPrefixes.some((p) => layer.id.startsWith(p))
          if (!isCustom) {
            try {
              map.setLayoutProperty(
                layer.id,
                'visibility',
                satellite ? 'none' : 'visible',
              )
            } catch {
              // Some layers may not support visibility — skip
            }
          }
        }
      }

      // Adjust country overlays for satellite: lighter borders, slightly less fill
      if (satellite) {
        map.setPaintProperty('country-borders', 'line-color', 'rgba(255,255,255,0.35)')
        map.setPaintProperty('country-borders', 'line-opacity', 0.6)
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.32,
          0.03,
        ])
      } else {
        // Restore normal theme-based values
        const isDark = resolvedTheme === 'dark'
        map.setPaintProperty('country-borders', 'line-color', isDark ? '#1e293b' : '#94a3b8')
        map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.28,
          0.05,
        ])
      }
    } catch {
      // Layers may not exist yet
    }
  }, [satellite, loaded, resolvedTheme])

  if (!supported) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-sand-100 dark:bg-dark-500 text-sand-700 dark:text-dark-50 p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-4">WebGL2 Not Supported</h1>
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
