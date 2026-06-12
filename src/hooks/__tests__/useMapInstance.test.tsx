import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'
import { MapProvider } from '../useMap'
import { useMapInstance } from '../useMapInstance'

vi.mock('maplibre-gl', () => {
  const constructorArgs: unknown[] = []
  const instances: FakeMap[] = []
  // Mirrors the WebGL spec behaviour useMapInstance relies on: while a context
  // is lost, getExtension() returns null — only an extension instance captured
  // while the context was healthy can restoreContext().
  const loseContextState = {
    lost: false,
    restoreCalls: 0,
    ext: {
      restoreContext() {
        loseContextState.restoreCalls++
      },
    },
  }
  class FakeMap {
    _handlers: Record<string, ((e: unknown) => void)[]> = {}
    constructor(options: unknown) {
      constructorArgs.push(options)
      instances.push(this)
    }
    addControl() {}
    on(evt: string, h: (e: unknown) => void) {
      ;(this._handlers[evt] ??= []).push(h)
    }
    off() {}
    remove() {}
    setProjection() {}
    fire(evt: string, e?: unknown) {
      this._handlers[evt]?.forEach((h) => h(e ?? {}))
    }
    get scrollZoom() {
      return { setZoomRate: () => {} }
    }
    getCanvas() {
      return {
        style: { cursor: 'grab' },
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: (type: string) =>
          type === 'webgl2'
            ? {
                getExtension: (name: string) =>
                  name === 'WEBGL_lose_context' && !loseContextState.lost
                    ? loseContextState.ext
                    : null,
              }
            : null,
      }
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
    __constructorArgs: constructorArgs,
    __instances: instances,
    __loseContextState: loseContextState,
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
  beforeEach(async () => {
    setupDom()
    const maplibre = (await import('maplibre-gl')) as unknown as {
      __loseContextState: { lost: boolean; restoreCalls: number }
    }
    const state = maplibre.__loseContextState
    state.lost = false
    state.restoreCalls = 0
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

  it('retryWebGL restores via the WEBGL_lose_context extension captured at init', async () => {
    const maplibre = (await import('maplibre-gl')) as unknown as {
      __loseContextState: { lost: boolean; restoreCalls: number }
    }
    const state = maplibre.__loseContextState
    state.lost = false
    state.restoreCalls = 0

    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )

    // Simulate the context being lost: per the WebGL spec, getExtension()
    // now returns null — the extension captured at init is the only handle
    // that can restore. Fetching it inside retryWebGL silently no-ops.
    state.lost = true
    result.current.retryWebGL()
    expect(state.restoreCalls).toBe(1)
  })

  it('retryWebGL dedupes the 1s reload-fallback timer on rapid re-click', () => {
    const setSpy = vi.spyOn(window, 'setTimeout')
    const clearSpy = vi.spyOn(window, 'clearTimeout')

    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )

    // Count only the 1000 ms fallback setTimeout calls (not the watchdog or other
    // internal calls that may fire during render/setup).
    const armsBefore = setSpy.mock.calls.filter((call) => call[1] === 1_000).length

    result.current.retryWebGL()
    result.current.retryWebGL()

    // Two clicks → two 1s timers armed, but the second click clears the first.
    const armsAfter = setSpy.mock.calls.filter((call) => call[1] === 1_000).length
    expect(armsAfter - armsBefore).toBe(2)

    // clearTimeout must have been called (deduping the first timer).
    // Identify the id returned by the first 1s arm and confirm it was cleared.
    const firstArmCall = setSpy.mock.results.filter((_, i) => setSpy.mock.calls[i]?.[1] === 1_000)[
      armsBefore
    ]
    expect(clearSpy).toHaveBeenCalledWith(firstArmCall?.value)

    setSpy.mockRestore()
    clearSpy.mockRestore()
  })

  it('passes clickTolerance: 8 to the MapLibre constructor', async () => {
    const maplibre = (await import('maplibre-gl')) as unknown as {
      __constructorArgs: Array<Record<string, unknown>>
    }
    maplibre.__constructorArgs.length = 0

    renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        useMapInstance({ containerRef: ref, onLoad: () => {} })
      },
      { wrapper: Wrapper },
    )
    const args = maplibre.__constructorArgs
    expect(args.length).toBe(1)
    expect(args[0].clickTolerance).toBe(8)
  })

  it('clears a latched pre-load style error once load fires', async () => {
    const maplibre = (await import('maplibre-gl')) as unknown as {
      __instances: Array<{ fire: (evt: string, e?: unknown) => void }>
    }
    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )
    const map = maplibre.__instances.at(-1)!

    // A transient pre-load error latches 'style'...
    act(() => {
      map.fire('error', { error: { message: 'The source image could not be decoded' } })
    })
    expect(result.current.mapError).toBe('style')

    // ...and a successful load clears it (the style demonstrably loaded).
    act(() => {
      map.fire('load')
    })
    await vi.waitFor(() => expect(result.current.mapError).toBeNull())
    await vi.waitFor(() => expect(result.current.loaded).toBe(true))
  })
})
