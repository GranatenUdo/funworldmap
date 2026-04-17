import { useRef, useEffect, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  BASEMAP_STYLE,
  BASEMAP_LOAD_TIMEOUT_MS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_PITCH,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_PITCH,
} from '../lib/mapStyles'
import { flyToCountry } from '../lib/flyToCountry'
import { applyMapTheme } from '../lib/mapColors'
import { MapErrorOverlay } from './MapErrorOverlay'
import { BasemapBanner } from './BasemapBanner'
import { probeBasemap } from '../lib/probeBasemap'
import { TEAL, TEAL_LIGHT, CORAL, CORAL_LIGHT } from '../lib/mapPalette'
import { ResetViewControl, prefersReducedMotion } from '../lib/resetViewControl'
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
import type { CountryData } from '../lib/types'

type MapErrorReason = 'timeout' | 'style' | 'country-data'

const BASEMAP_PROBE_TIMEOUT_MS = 3_000

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

export default function WorldMap({ byNumeric, selected, compareWith, comparePickingMode, resolvedTheme, satellite, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [mapError, setMapError] = useState<MapErrorReason | null>(null)
  const [basemapDegraded, setBasemapDegraded] = useState(false)
  const hoveredRef = useRef<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onDeselectRef = useRef(onDeselect)
  onDeselectRef.current = onDeselect
  const byNumericRef = useRef(byNumeric)
  byNumericRef.current = byNumeric

  const addCountryLayers = useCallback(async (map: maplibregl.Map) => {
    const geojson = await loadCountryGeojson()
    addRasterSources(map)
    addCountrySource(map, geojson)
    addBaseCountryLayers(map)
    addHoverLayers(map)
    addSelectionLayers(map)
    addCompareLayers(map)
    applyWarmLighting(map)

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
        // Keep crosshair during picking mode
        const canvas = map.getCanvas()
        if (canvas.style.cursor !== 'crosshair') {
          canvas.style.cursor = 'pointer'
        }

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
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') {
        canvas.style.cursor = 'grab'
      }

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
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') {
        canvas.style.cursor = hoveredRef.current ? 'pointer' : 'grab'
      }
    })

    // Disable double-click zoom — prevents race condition with country click
    map.doubleClickZoom.disable()

    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false
    probeBasemap(BASEMAP_STYLE, BASEMAP_PROBE_TIMEOUT_MS).then((result) => {
      if (cancelled) return
      if (result === 'fail') setBasemapDegraded(true)
    })

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

    // Test seam — exposed in production too so e2e can introspect MapLibre state.
    ;(window as unknown as Record<string, unknown>).__funworldmap_map = map

    // Watchdog — if 'load' never fires, surface a visible error.
    const watchdog = window.setTimeout(() => {
      setMapError((prev) => prev ?? 'timeout')
    }, BASEMAP_LOAD_TIMEOUT_MS)

    map.on('load', () => {
      window.clearTimeout(watchdog)

      // Enable globe projection
      map.setProjection({ type: 'globe' })

      // Smooth trackpad zoom
      map.scrollZoom.setZoomRate(1 / 150)

      addCountryLayers(map).catch((err) => {
        console.error(err)
        setMapError((prev) => prev ?? 'country-data')
      })
    })

    map.on('error', (e) => {
      console.warn('Map error:', e.error?.message || e)
      // Only surface pre-load errors as style failures; after load, these are
      // transient tile issues that don't warrant a full-screen overlay.
      if (!loaded) {
        setMapError((prev) => prev ?? 'style')
      }
    })

    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      tooltipRef.current?.remove()
      tooltipRef.current = null
      map.remove()
      mapRef.current = null
      delete (window as unknown as Record<string, unknown>).__funworldmap_map
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Compare-with highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (compareWith) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], compareWith.ccn3]
      map.setFilter('country-compare-fill', filter)
      map.setFilter('country-compare-border', filter)
      map.setFilter('country-compare-glow', filter)
      map.setFilter('country-compare-extrusion', filter)
    } else {
      const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
      map.setFilter('country-compare-fill', emptyFilter)
      map.setFilter('country-compare-border', emptyFilter)
      map.setFilter('country-compare-glow', emptyFilter)
      map.setFilter('country-compare-extrusion', emptyFilter)
    }
  }, [compareWith, loaded])

  // Lock hover and dim borders when in compare viewing mode
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
    const inCompareView = compareWith !== null

    try {
      if (inCompareView) {
        map.setPaintProperty('country-fill', 'fill-opacity', 0.05)
        map.setFilter('country-hover-border', emptyFilter)
        map.setFilter('country-extrusion', emptyFilter)
        map.setPaintProperty('country-borders', 'line-opacity', 0.15)
      } else if (!satellite) {
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.28,
          0.05,
        ])
        const isDark = resolvedTheme === 'dark'
        map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)
      }
    } catch {
      // Layers may not exist yet
    }
  }, [compareWith, loaded, satellite, resolvedTheme])

  // Crosshair cursor during compare picking mode
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (comparePickingMode) {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    }
  }, [comparePickingMode, loaded])

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
