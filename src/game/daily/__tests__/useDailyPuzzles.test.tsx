import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDailyPuzzles } from '../useDailyPuzzles'
import type { DailyIndex } from '../types'

const TODAY_INDEX: DailyIndex = {
  generatedAt: '2026-04-21T00:15:00Z',
  window: { start: '2026-04-17', end: '2026-04-21' },
  days: {
    '2026-04-21': { country: { cca3: 'PER' }, city: { id: 'PER-lima' } },
    '2026-04-20': { country: { cca3: 'NOR' }, city: { id: 'NOR-oslo' } },
  },
}

describe('useDailyPuzzles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('fetches /daily/index.json on mount and exposes ready status', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(TODAY_INDEX), { status: 200 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.index).toEqual(TODAY_INDEX)
  })

  it('exposes unavailable status when the fetch fails', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('', { status: 500 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.index).toBeNull()
  })

  it('exposes unavailable status when fetch rejects', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })

  it('byDate returns the entry when within window', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(TODAY_INDEX), { status: 200 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.byDate('2026-04-20')).toEqual({
      country: { cca3: 'NOR' }, city: { id: 'NOR-oslo' },
    })
  })

  it('byDate returns null when out of window', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(TODAY_INDEX), { status: 200 }),
    )
    const { result } = renderHook(() => useDailyPuzzles())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.byDate('2025-01-01')).toBeNull()
  })
})
