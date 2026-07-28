import { vi } from 'vitest'
import type { MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

type Handler = (...args: unknown[]) => void

export function createFakeMapRef(opts: { zoom?: number } = {}) {
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
  const handlers = new Map<string, Handler>()
  const keyFor = (event: string, layerOrHandler: unknown) =>
    typeof layerOrHandler === 'string' ? `${event}:${layerOrHandler}` : event
  const on = vi.fn((event: string, layerOrHandler: unknown, maybeHandler?: unknown) => {
    const handler = (
      typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler
    ) as Handler
    handlers.set(keyFor(event, layerOrHandler), handler)
  })
  const off = vi.fn()
  const easeTo = vi.fn()
  const flyTo = vi.fn()
  const jumpTo = vi.fn()
  const getZoom = vi.fn(() => opts.zoom ?? 1.8)
  const canvas = { style: { cursor: '' } }
  const getCanvas = vi.fn(() => canvas as unknown as HTMLCanvasElement)
  const cameraForBounds = vi.fn<
    (
      bounds: maplibregl.LngLatBoundsLike,
      options?: maplibregl.CameraForBoundsOptions,
    ) => maplibregl.CenterZoomBearing | undefined
  >(() => ({ center: [0, 0], zoom: 3 }))
  const queryRenderedFeatures = vi.fn(() => [])
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
    getZoom,
    getCanvas,
    cameraForBounds,
    queryRenderedFeatures,
    getStyle,
    doubleClickZoom,
  } as unknown as maplibregl.Map

  /** Invoke a captured `map.on` handler. Throws when nothing registered. */
  const fire = (event: string, layer: string | null, payload?: unknown) => {
    const handler = handlers.get(layer ? `${event}:${layer}` : event)
    if (!handler) throw new Error(`no handler registered for ${event}${layer ? `:${layer}` : ''}`)
    handler(payload)
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
      setData,
      getZoom,
      cameraForBounds,
      getStyle,
    },
  }
}
