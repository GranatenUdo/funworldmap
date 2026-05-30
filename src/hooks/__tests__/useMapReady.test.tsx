import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMapReady } from '../useMapReady'

describe('useMapReady', () => {
  afterEach(() => {
    document.body
      .querySelectorAll('[data-map-loaded], [data-map-error]')
      .forEach((el) => el.remove())
  })

  it('starts false and flips true once a [data-map-loaded] element appears', async () => {
    const { result } = renderHook(() => useMapReady())
    expect(result.current).toBe(false)
    act(() => {
      const el = document.createElement('div')
      el.setAttribute('data-map-loaded', 'true')
      document.body.appendChild(el)
    })
    await vi.waitFor(() => expect(result.current).toBe(true))
  })

  it('is true immediately if the marker already exists at mount', () => {
    const el = document.createElement('div')
    el.setAttribute('data-map-error', 'true')
    document.body.appendChild(el)
    const { result } = renderHook(() => useMapReady())
    expect(result.current).toBe(true)
  })
})
