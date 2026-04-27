export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function subscribeReducedMotion(cb: (reduced: boolean) => void): () => void {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handler = (e: MediaQueryListEvent) => cb(e.matches)
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}
