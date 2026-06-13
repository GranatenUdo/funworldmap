import { vi } from 'vitest'

/** Install a window.matchMedia stub (jsdom has none). `matches` decides the
 *  result per query — default: always false. Returns a restore function. */
export function stubMatchMedia(matches: (query: string) => boolean = () => false): () => void {
  const original = (window as { matchMedia?: typeof window.matchMedia }).matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
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
