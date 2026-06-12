import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
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
import { prefersReducedMotion, subscribeReducedMotion } from '../lib/motion'
import { useMap } from './useMap'

export type MapErrorReason = 'timeout' | 'style' | 'country-data' | 'webgl-lost'
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
  retryWebGL: () => void
}

export function useMapInstance({
  containerRef,
  onLoad,
}: UseMapInstanceOptions): UseMapInstanceResult {
  const { mapRef, tooltipRef } = useMap()
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  // loadedRef shadows the `loaded` state so closures captured inside the init
  // effect (e.g. the 'error' handler) can observe the current value.
  const loadedRef = useRef(false)
  const setLoadedBoth = useCallback((v: boolean) => {
    loadedRef.current = v
    setLoaded(v)
  }, [])
  const [mapError, setMapErrorState] = useState<MapErrorReason | null>(null)
  const [basemapDegraded, setBasemapDegraded] = useState(false)
  // WEBGL_lose_context captured at init, while the context is healthy.
  // Per the WebGL spec, getExtension() returns null while the context is
  // lost — so retryWebGL cannot fetch the extension at retry time; it must
  // use this pre-captured instance to call restoreContext().
  const loseContextRef = useRef<WEBGL_lose_context | null>(null)
  // Pending reload-fallback timer from retryWebGL — deduped on re-click and
  // cleared on unmount so a stale timer can't fire into a torn-down map.
  const retryTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false
    void probeBasemap(BASEMAP_STYLE, BASEMAP_PROBE_TIMEOUT_MS).then((result) => {
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
        // Touch-synthesised click events land several px from mousedown on
        // mobile browsers; MapLibre's default clickTolerance=3 drops them.
        // See docs/superpowers/specs/2026-04-24-reveal-animation-and-mobile-tap-design.md.
        clickTolerance: 8,
      })
    } catch {
      setSupported(false)
      return
    }

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new ResetViewControl(), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    const unsubscribeReducedMotion = subscribeReducedMotion((reduced) => {
      // The initial pitch was set from prefersReducedMotion() at construction;
      // re-apply on OS-toggle so the map flattens / restores tilt without a
      // page refresh.
      map.setPitch(reduced ? 0 : DEFAULT_PITCH)
    })

    mapRef.current = map

    // Tooltip DOM element (raw DOM, not React — avoids re-render on mousemove)
    const tooltip = document.createElement('div')
    tooltip.className = 'country-tooltip'
    containerRef.current.parentElement!.appendChild(tooltip)
    tooltipRef.current = tooltip

    // Test seam — only exposed under VITE_TEST_HOOKS so production bundles ship clean.
    if (import.meta.env.VITE_TEST_HOOKS) {
      ;(window as unknown as Record<string, unknown>).__funworldmap_map = map
    }

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
      // Make the basemap's background layer transparent so the body CSS
      // (hex-grid + deep-navy gradient in src/index.css) shows through the
      // non-globe area of the viewport. Oceans keep their own water layer;
      // only the "sky" around the globe becomes see-through.
      try {
        map.setPaintProperty('background', 'background-color', 'rgba(0,0,0,0)')
      } catch {
        /* style without a background layer — silently skip */
      }
      map.scrollZoom.setZoomRate(1 / 150)
      Promise.resolve(onLoad(map))
        .then(() => setLoadedBoth(true))
        .catch((err: unknown) => {
          console.error(err)
          setMapErrorState((prev) => prev ?? 'country-data')
        })
    })

    map.on('error', (e: { error?: { message?: string } }) => {
      console.warn('Map error:', e.error?.message || e)
      setMapErrorState((prev) => {
        // Don't overwrite a real failure with a transient post-load tile issue.
        if (prev !== null) return prev
        return loadedRef.current ? prev : 'style'
      })
    })

    // WebGL context-loss recovery.
    // MapLibre registers its own canvas listener and re-emits the event as
    // map.fire('webglcontextlost', { originalEvent: e }). The `originalEvent`
    // is the actual WebGLContextEvent and must receive preventDefault() — the
    // MapLibre wrapper object does not have a preventDefault of its own.
    // We ALSO register directly on the canvas so we can guarantee
    // preventDefault fires even if MapLibre's internal listener fires first
    // without calling it.
    const onMapContextLost = (e: { originalEvent?: Event }) => {
      // The MapLibre wrapper carries the raw event as `originalEvent`.
      e.originalEvent?.preventDefault()
      setMapErrorState('webgl-lost')
    }
    const onMapContextRestored = () => {
      setMapErrorState((prev) => (prev === 'webgl-lost' ? null : prev))
    }
    const onCanvasContextLost = (e: Event) => {
      // preventDefault on the raw canvas event — belt-and-suspenders to ensure
      // the browser knows we want to attempt context restoration.
      e.preventDefault()
      setMapErrorState('webgl-lost')
    }
    const onCanvasContextRestored = () => {
      setMapErrorState((prev) => (prev === 'webgl-lost' ? null : prev))
    }

    map.on('webglcontextlost', onMapContextLost)
    map.on('webglcontextrestored', onMapContextRestored)

    const canvas = map.getCanvas()
    // Capture WEBGL_lose_context now, while the context is healthy. On a lost
    // context getExtension() returns null, so this is the only reliable time
    // to grab it. MapLibre 5.x tries webgl2 then falls back to webgl1 (_setupPainter), so on a
    // WebGL1-only browser the webgl2 request returns null here (the canvas already
    // holds a 'webgl' context) and the webgl fallback is LOAD-BEARING — without it
    // the extension is never captured and retry degrades to the reload fallback.
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    loseContextRef.current = gl?.getExtension('WEBGL_lose_context') ?? null
    canvas.addEventListener('webglcontextlost', onCanvasContextLost, { passive: false })
    canvas.addEventListener('webglcontextrestored', onCanvasContextRestored)

    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      window.removeEventListener('keydown', homeHandler)
      tooltipRef.current?.remove()
      tooltipRef.current = null
      // Reset loadedRef in cleanup — matters for React StrictMode dev-only
      // double-invocation, where this effect tears down then re-runs.
      setLoadedBoth(false)
      unsubscribeReducedMotion()
      canvas.removeEventListener('webglcontextlost', onCanvasContextLost)
      canvas.removeEventListener('webglcontextrestored', onCanvasContextRestored)
      loseContextRef.current = null
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      map.remove()
      mapRef.current = null
      if (import.meta.env.VITE_TEST_HOOKS) {
        delete (window as unknown as Record<string, unknown>).__funworldmap_map
      }
    }
    // onLoad intentionally not in deps — it must be stable from caller.
    // setLoadedBoth is stable (useCallback with empty deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  // retryWebGL: attempt programmatic context restore. If the canvas hasn't
  // restored within 1 s (e.g. the GPU process crashed), fall back to a full
  // page reload which re-initialises everything cleanly.
  const retryWebGL = useCallback(() => {
    try {
      // Must use the extension captured at init: getExtension() on the now-lost
      // context returns null, so fetching it here can never work.
      loseContextRef.current?.restoreContext()
    } catch {
      // Ignore — restoreContext throws if the context is not currently lost.
    }
    // Fallback: if webglcontextrestored hasn't fired after 1 s, reload.
    // Clear any existing timer first — rapid re-clicks would otherwise arm
    // multiple reloads.
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      setMapErrorState((prev) => {
        if (prev === 'webgl-lost') {
          window.location.reload()
        }
        return prev
      })
    }, 1_000)
  }, [])

  return { supported, loaded, mapError, basemapDegraded, retryWebGL }
}
