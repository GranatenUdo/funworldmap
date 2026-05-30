import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMapReady } from '../useMapReady'

describe('useMapReady', () => {
  afterEach(() => {
    document.body
      .querySelectorAll('[data-map-loaded], [data-map-error]')
      .forEach((el) => el.remove())
  })

  it('starts false and flips true when [data-map-loaded] is set on an in-DOM element', async () => {
    const { result } = renderHook(() => useMapReady())
    expect(result.current).toBe(false)
    // Mirror production: WorldMap renders `data-map-loaded={loaded || undefined}`,
    // so the attribute is toggled on an element already in the DOM — an
    // *attributes* mutation, which the observer watches.
    const el = document.createElement('div')
    document.body.appendChild(el)
    act(() => {
      el.setAttribute('data-map-loaded', 'true')
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
