import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prefersReducedMotion, subscribeReducedMotion } from '../motion'

let listeners: Array<(e: MediaQueryListEvent) => void>
let matchesValue: boolean

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() { return matchesValue },
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: (e: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.push(listener)
      },
      removeEventListener: (type: string, listener: (e: MediaQueryListEvent) => void) => {
        if (type === 'change') {
          const idx = listeners.indexOf(listener)
          if (idx >= 0) listeners.splice(idx, 1)
        }
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    })),
  })
}

describe('motion', () => {
  beforeEach(() => {
    listeners = []
    matchesValue = false
    mockMatchMedia()
  })

  describe('prefersReducedMotion', () => {
    it('reflects matchMedia.matches', () => {
      matchesValue = false
      expect(prefersReducedMotion()).toBe(false)
      matchesValue = true
      expect(prefersReducedMotion()).toBe(true)
    })
  })

  describe('subscribeReducedMotion', () => {
    it('invokes the callback with the new value when the media query changes', () => {
      const cb = vi.fn()
      const unsubscribe = subscribeReducedMotion(cb)
      expect(listeners).toHaveLength(1)
      listeners[0]!({ matches: true } as MediaQueryListEvent)
      expect(cb).toHaveBeenCalledWith(true)
      listeners[0]!({ matches: false } as MediaQueryListEvent)
      expect(cb).toHaveBeenCalledWith(false)
      unsubscribe()
      expect(listeners).toHaveLength(0)
    })
  })
})
