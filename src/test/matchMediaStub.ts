import { vi } from 'vitest'

function install(value: typeof window.matchMedia): () => void {
  const original = (window as { matchMedia?: typeof window.matchMedia }).matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value,
  })
  return () => {
    if (original) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: original,
      })
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia
    }
  }
}

/** Install a window.matchMedia stub (jsdom has none). `matches` decides the
 *  result per query — default: always false. Returns a restore function. */
export function stubMatchMedia(matches: (query: string) => boolean = () => false): () => void {
  return install(
    vi.fn().mockImplementation((query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

/** Like stubMatchMedia, but captures 'change' listeners (across every query)
 *  so tests can drive a live media-query flip — e.g. the B-1 breakpoint
 *  re-center. `fireChange(next)` invokes every captured listener with a
 *  MediaQueryListEvent-shaped `{ matches: next }`. */
export function stubMatchMediaWithChange(matches: (query: string) => boolean = () => false): {
  fireChange: (matches: boolean) => void
  listenerCount: () => number
  restore: () => void
} {
  type ChangeListener = (e: MediaQueryListEvent) => void
  const listeners = new Set<ChangeListener>()
  const restore = install(
    vi.fn().mockImplementation((query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (type: string, cb: ChangeListener) => {
        if (type === 'change') listeners.add(cb)
      },
      removeEventListener: (_type: string, cb: ChangeListener) => {
        listeners.delete(cb)
      },
      dispatchEvent: vi.fn(),
    })),
  )
  return {
    fireChange: (next: boolean) => {
      for (const cb of [...listeners]) cb({ matches: next } as MediaQueryListEvent)
    },
    listenerCount: () => listeners.size,
    restore,
  }
}
