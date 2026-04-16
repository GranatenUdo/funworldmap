import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeBasemap } from '../probeBasemap'

describe('probeBasemap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns ok when fetch resolves with 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    expect(await probeBasemap('https://example.test/style.json', 1000)).toBe('ok')
  })

  it('returns fail when fetch resolves non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    expect(await probeBasemap('https://example.test/style.json', 1000)).toBe('fail')
  })

  it('returns fail when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')))
    expect(await probeBasemap('https://example.test/style.json', 1000)).toBe('fail')
  })

  it('returns fail when fetch exceeds timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
      }),
    )
    const result = probeBasemap('https://example.test/style.json', 500)
    await vi.advanceTimersByTimeAsync(600)
    expect(await result).toBe('fail')
  })
})
