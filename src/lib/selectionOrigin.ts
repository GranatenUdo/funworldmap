/** Transient carrier for HOW the next selection was made. Selection state
 *  flows through the URL hash, which cannot carry this bit. The map-click
 *  path marks; useSelectedCountry.resolveHash takes (and thereby resets) on
 *  every hashchange, so a mark can never leak into a later selection — even
 *  a click that re-selects the already-selected country consumes it.
 *  (Implements the 2026-05-17 preserve-zoom spec's documented migration
 *  path: gate the never-zoom-out clamp on origin === 'click'.) */
let pending: 'click' | null = null

export function markClickOrigin(): void {
  pending = 'click'
}

export function takeOrigin(): 'click' | 'auto' {
  const origin = pending ?? 'auto'
  pending = null
  return origin
}
