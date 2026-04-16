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
  TERRAIN_TILES,
  TERRAIN_ATTRIBUTION,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_PITCH,
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

/** Custom MapLibre control — reset to world view */
class ResetViewControl implements maplibregl.IControl {
  _container?: HTMLDivElement

  onAdd(map: maplibregl.Map): HTMLElement {
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const button = document.createElement('button')
    button.type = 'button'
    button.title = 'Reset to world view'
    button.setAttribute('aria-label', 'Reset to world view')
    button.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;'

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '22')
    svg.setAttribute('height', '22')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')

    // Globe with reset-arrow icon
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '12')
    circle.setAttribute('cy', '12')
    circle.setAttribute('r', '7')

    const meridian = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    meridian.setAttribute('cx', '12')
    meridian.setAttribute('cy', '12')
    meridian.setAttribute('rx', '3')
    meridian.setAttribute('ry', '7')

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrow.setAttribute('d', 'M20 4 L20 9 L15 9')

    svg.appendChild(circle)
    svg.appendChild(meridian)
    svg.appendChild(arrow)
    button.appendChild(svg)

    button.addEventListener('click', () => {
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: prefersReducedMotion() ? 0 : DEFAULT_PITCH,
        bearing: 0,
        duration: prefersReducedMotion() ? 0 : 1400,
      })
    })

    this._container.appendChild(button)
    return this._container
  }

  onRemove(): void {
    this._container?.remove()
  }
}

export default function WorldMap({ byNumeric, selected, resolvedTheme, satellite, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const hoveredRef = useRef<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

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

    // Terrain DEM source — loaded but inactive until satellite toggle enables it
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: [TERRAIN_TILES],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
      attribution: TERRAIN_ATTRIBUTION,
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

        // Update tooltip content (flag + name + capital)
        const tooltip = tooltipRef.current
        if (tooltip) {
          const country = byNumericRef.current.get(id)
          if (country) {
            tooltip.textContent = ''
            const img = document.createElement('img')
            img.src = country.flag
            img.alt = ''
            tooltip.appendChild(img)

            const textWrap = document.createElement('div')
            textWrap.className = 'tooltip-text'

            const nameEl = document.createElement('div')
            nameEl.className = 'tooltip-name'
            nameEl.textContent = country.name.common
            textWrap.appendChild(nameEl)

            if (country.capital.length > 0) {
              const capitalEl = document.createElement('div')
              capitalEl.className = 'tooltip-capital'
              capitalEl.textContent = country.capital[0]
              textWrap.appendChild(capitalEl)
            }

            tooltip.appendChild(textWrap)
            tooltip.classList.add('visible')
          }
        }
      }
    })

    // Position tooltip at cursor
    map.on('mousemove', (e) => {
      const tooltip = tooltipRef.current
      if (tooltip && tooltip.classList.contains('visible')) {
        tooltip.style.left = `${e.point.x + 15}px`
        tooltip.style.top = `${e.point.y + 15}px`
      }
    })

    map.on('mouseleave', 'country-fill', () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        hoveredRef.current = null
      }
      map.setFilter('country-extrusion', ['==', ['get', 'id'], ''])
      map.setFilter('country-hover-border', ['==', ['get', 'id'], ''])
      map.getCanvas().style.cursor = 'grab'

      const tooltip = tooltipRef.current
      if (tooltip) {
        tooltip.classList.remove('visible')
      }
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

    // Grab cursor for map dragging
    map.getCanvas().style.cursor = 'grab'
    map.on('dragstart', () => {
      map.getCanvas().style.cursor = 'grabbing'
    })
    map.on('dragend', () => {
      map.getCanvas().style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    })

    // Disable double-click zoom — prevents race condition with country click
    map.doubleClickZoom.disable()

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
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxPitch: MAX_PITCH,
        attributionControl: false,
      })
    } catch {
      setSupported(false)
      return
    }

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new ResetViewControl(), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    mapRef.current = map

    // Tooltip DOM element (raw DOM, not React — avoids re-render on mousemove)
    const tooltip = document.createElement('div')
    tooltip.className = 'country-tooltip'
    containerRef.current!.parentElement!.appendChild(tooltip)
    tooltipRef.current = tooltip

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__polworldmap_map = map
    }

    map.on('load', () => {
      // Enable globe projection
      map.setProjection({ type: 'globe' })

      // Smooth trackpad zoom
      map.scrollZoom.setZoomRate(1 / 150)

      addCountryLayers(map).catch(console.error)
    })

    map.on('error', (e) => {
      console.warn('Map error:', e.error?.message || e)
    })

    return () => {
      tooltipRef.current?.remove()
      tooltipRef.current = null
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

      // Atmosphere — visible on globe at low zoom, fades as you zoom in
      ;(map as never as { setSky: (sky: Record<string, unknown>) => void }).setSky({
        'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
        'horizon-color': isDark ? '#1a2030' : '#f0ede6',
        'fog-color': isDark ? '#10141a' : '#e8e3da',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.8,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': [
          'interpolate', ['linear'], ['zoom'],
          0, 1,
          5, 1,
          7, 0,
        ],
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

      // Enable/disable 3D terrain with satellite
      if (satellite) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
      } else {
        map.setTerrain(null)
      }

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
