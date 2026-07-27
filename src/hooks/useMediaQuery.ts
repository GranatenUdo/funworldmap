import { useState, useEffect } from 'react'

/** Hover-capable fine pointer (mouse/trackpad) — false on touch-first devices (A14). */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

/** Returns true when viewport is >= 1024px (desktop). Handles live resize. */
export function useMediaQuery(query = '(min-width: 1024px)'): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
