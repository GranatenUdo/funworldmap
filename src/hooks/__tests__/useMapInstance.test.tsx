import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'
import { MapProvider } from '../useMap'
import { useMapInstance } from '../useMapInstance'

vi.mock('maplibre-gl', () => {
  class FakeMap {
    _handlers: Record<string, ((e: unknown) => void)[]> = {}
    constructor() {}
    addControl() {}
    on(evt: string, h: (e: unknown) => void) {
      ;(this._handlers[evt] ??= []).push(h)
    }
    off() {}
    remove() {}
    setProjection() {}
    get scrollZoom() {
      return { setZoomRate: () => {} }
    }
    getCanvas() {
      return { style: { cursor: 'grab' } }
    }
  }
  class FakeControl {}
  return {
    default: {
      Map: FakeMap,
      NavigationControl: FakeControl,
      AttributionControl: FakeControl,
    },
    Map: FakeMap,
    NavigationControl: FakeControl,
    AttributionControl: FakeControl,
  }
})

vi.mock('../../lib/probeBasemap', () => ({
  probeBasemap: vi.fn().mockResolvedValue('ok'),
}))

function setupDom() {
  document.body.replaceChildren()
  const host = document.createElement('div')
  host.id = 'host'
  const c = document.createElement('div')
  c.id = 'c'
  host.appendChild(c)
  document.body.appendChild(host)
  // jsdom does not implement matchMedia
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  return <MapProvider>{children}</MapProvider>
}

describe('useMapInstance', () => {
  beforeEach(() => {
    setupDom()
  })

  it('starts with supported=true, loaded=false, mapError=null', () => {
    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )
    expect(result.current.supported).toBe(true)
    expect(result.current.loaded).toBe(false)
    expect(result.current.mapError).toBeNull()
  })

  it('surfaces basemapDegraded when probe fails', async () => {
    const { probeBasemap } = await import('../../lib/probeBasemap')
    vi.mocked(probeBasemap).mockResolvedValueOnce('fail')
    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )
    await vi.waitFor(() => expect(result.current.basemapDegraded).toBe(true))
  })
})
