import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDailyPuzzles } from '../useDailyPuzzles'

describe('useDailyPuzzles refetch', () => {
  beforeEach(() => {
    const fetchMock = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          version: 1,
          window: { start: '2026-05-17', end: '2026-05-17' },
          days: { '2026-05-17': { country: { cca3: 'FRA' }, city: { id: 'paris' } } },
        }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reverts to ready after refetch succeeds following a failure', async () => {
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })
})
