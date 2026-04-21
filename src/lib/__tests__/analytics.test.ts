import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { track } from '../analytics'

declare global {
  interface Window {
    __PLAYWRIGHT__?: boolean
    __testAnalytics?: Array<{ name: string; props?: Record<string, string | number> }>
  }
}

describe('track', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let sendBeaconMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    sendBeaconMock = vi.fn().mockReturnValue(true)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_ANALYTICS_ENDPOINT', 'https://funworldmap.com/api/event')
    // Default: DNT off, sendBeacon available
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '0' })
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconMock,
    })
    delete (window as Window).__PLAYWRIGHT__
    delete (window as Window).__testAnalytics
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('dispatches via sendBeacon when available', () => {
    track('daily_opened', { mode: 'country-pinning', dateAge: 0 })
    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [url, body] = sendBeaconMock.mock.calls[0]
    expect(url).toBe('https://funworldmap.com/api/event')
    expect(typeof body).toBe('string')
    expect(JSON.parse(body as string)).toEqual({
      name: 'daily_opened',
      props: { mode: 'country-pinning', dateAge: 0 },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to fetch with keepalive when sendBeacon is absent', () => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined })
    track('free_started', { mode: 'city-guessing' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://funworldmap.com/api/event')
    expect(init).toMatchObject({ method: 'POST', keepalive: true })
  })

  it('is a no-op when navigator.doNotTrack is "1"', () => {
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' })
    track('daily_opened', { mode: 'country-pinning', dateAge: 0 })
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('captures to window.__testAnalytics when window.__PLAYWRIGHT__ is set', () => {
    ;(window as Window).__PLAYWRIGHT__ = true
    track('launcher_dismissed', { path: 'link' })
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect((window as Window).__testAnalytics).toEqual([
      { name: 'launcher_dismissed', props: { path: 'link' } },
    ])
  })

  it('is a no-op when VITE_ANALYTICS_ENDPOINT is empty', () => {
    vi.stubEnv('VITE_ANALYTICS_ENDPOINT', '')
    track('daily_opened', { mode: 'country-pinning', dateAge: 0 })
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
