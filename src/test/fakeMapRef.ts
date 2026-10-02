import { vi } from 'vitest'
import type { MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

type Handler = (...args: unknown[]) => void

export function createFakeMapRef(opts: { zoom?: number; pitch?: number } = {}) {
  const setData = vi.fn()
  const setFilter = vi.fn()
  const setPaintProperty = vi.fn()
  const setLayoutProperty = vi.fn()
  const setFeatureState = vi.fn()
  const getSource = vi.fn(() => ({ setData }))
  const getLayer = vi.fn((): unknown => undefined)
  const addSource = vi.fn()
  const addedLayers: maplibregl.LayerSpecification[] = []
  const addLayer = vi.fn((spec: maplibregl.LayerSpecification) => {
    addedLayers.push(spec)
  })
  // Arrays per key: real MapLibre fires every listener registered for an
  // event in registration order (e.g. useMapInteractions registers BOTH
  // clickMap and clickGameAssist on plain 'click').
  const handlers = new Map<string, Handler[]>()
  const keyFor = (event: string, layerOrHandler: unknown) =>
    typeof layerOrHandler === 'string' ? `${event}:${layerOrHandler}` : event
  const on = vi.fn((event: string, layerOrHandler: unknown, maybeHandler?: unknown) => {
    const handler = (
      typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler
    ) as Handler
    const key = keyFor(event, layerOrHandler)
    handlers.set(key, [...(handlers.get(key) ?? []), handler])
  })
  const off = vi.fn()
  const easeTo = vi.fn()
  const flyTo = vi.fn()
  const jumpTo = vi.fn()
  const stop = vi.fn()
  const getZoom = vi.fn(() => opts.zoom ?? 1.8)
  const getPitch = vi.fn(() => opts.pitch ?? 0)
  const canvas = { style: { cursor: '' } }
  const getCanvas = vi.fn(() => canvas as unknown as HTMLCanvasElement)
  const cameraForBounds = vi.fn<
    (
      bounds: maplibregl.LngLatBoundsLike,
      options?: maplibregl.CameraForBoundsOptions,
    ) => maplibregl.CenterZoomBearing | undefined
  >(() => ({ center: [0, 0], zoom: 3 }))
  // Loose feature shape so tests can stub hits per geometry (B-2 tap assist).
  const queryRenderedFeatures = vi.fn<
    (geometry?: unknown, options?: unknown) => { id?: string | number }[]
  >(() => [])
  const getStyle = vi.fn(() => ({ layers: [] as maplibregl.LayerSpecification[] }))
  const doubleClickZoom = { disable: vi.fn() }

  const map = {
    setFilter,
    setPaintProperty,
    setLayoutProperty,
    setFeatureState,
    getSource,
    getLayer,
    addSource,
    addLayer,
    on,
    off,
    easeTo,
    flyTo,
    jumpTo,
    stop,
    getZoom,
    getPitch,
    getCanvas,
    cameraForBounds,
    queryRenderedFeatures,
    getStyle,
    doubleClickZoom,
  } as unknown as maplibregl.Map

  /** Invoke the captured `map.on` handlers for an event, in registration
   *  order. Throws when nothing registered. */
  const fire = (event: string, layer: string | null, payload?: unknown) => {
    const registered = handlers.get(layer ? `${event}:${layer}` : event)
    if (!registered || registered.length === 0)
      throw new Error(`no handler registered for ${event}${layer ? `:${layer}` : ''}`)
    for (const handler of registered) handler(payload)
  }

  const ref: MutableRefObject<maplibregl.Map | null> = { current: map }
  return {
    ref,
    map,
    fire,
    addedLayers,
    canvas,
    calls: {
      setFilter,
      setPaintProperty,
      setLayoutProperty,
      setFeatureState,
      getSource,
      getLayer,
      addSource,
      addLayer,
      on,
      off,
      easeTo,
      flyTo,
      jumpTo,
    stop,
      setData,
      getZoom,
      getPitch,
      cameraForBounds,
      queryRenderedFeatures,
      getStyle,
    },
  }
}
