import { useEffect, useState, type RefObject } from 'react'
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
import { probeBasemap } from '../lib/probeBasemap'
import { ResetViewControl, flyToHome } from '../lib/resetViewControl'
import { prefersReducedMotion } from '../lib/motion'
import { useMap } from './useMap'

export type MapErrorReason = 'timeout' | 'style' | 'country-data'
const BASEMAP_PROBE_TIMEOUT_MS = 3_000

interface UseMapInstanceOptions {
  containerRef: RefObject<HTMLDivElement | null>
  onLoad: (map: maplibregl.Map) => Promise<void> | void
}

interface UseMapInstanceResult {
  supported: boolean
  loaded: boolean
  mapError: MapErrorReason | null
  basemapDegraded: boolean
}

export function useMapInstance({
  containerRef,
  onLoad,
}: UseMapInstanceOptions): UseMapInstanceResult {
  const { mapRef, tooltipRef } = useMap()
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [mapError, setMapErrorState] = useState<MapErrorReason | null>(null)
  const [basemapDegraded, setBasemapDegraded] = useState(false)

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

    const watchdog = window.setTimeout(() => {
      setMapErrorState((prev) => prev ?? 'timeout')
    }, BASEMAP_LOAD_TIMEOUT_MS)

    // Home key — reset to world view when the map container has focus.
    const homeHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.matches('input, textarea, [contenteditable]')) return
      const mapContainer = containerRef.current
      if (!mapContainer || !mapContainer.contains(document.activeElement)) return

      if (e.key === 'Home') {
        e.preventDefault()
        flyToHome(map)
        window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: 'View reset' }))
      }
    }
    window.addEventListener('keydown', homeHandler)

    map.on('load', () => {
      window.clearTimeout(watchdog)
      map.setProjection({ type: 'globe' })
      map.scrollZoom.setZoomRate(1 / 150)
      Promise.resolve(onLoad(map))
        .then(() => setLoaded(true))
        .catch((err: unknown) => {
          console.error(err)
          setMapErrorState((prev) => prev ?? 'country-data')
        })
    })

    map.on('error', (e) => {
      console.warn('Map error:', e.error?.message || e)
      setMapErrorState((prev) => {
        // Don't overwrite a real failure with a transient post-load tile issue.
        if (prev !== null) return prev
        return loaded ? prev : 'style'
      })
    })

    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      window.removeEventListener('keydown', homeHandler)
      tooltipRef.current?.remove()
      tooltipRef.current = null
      map.remove()
      mapRef.current = null
      delete (window as unknown as Record<string, unknown>).__funworldmap_map
    }
    // onLoad intentionally not in deps — it must be stable from caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  return { supported, loaded, mapError, basemapDegraded }
}
