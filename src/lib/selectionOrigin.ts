/** Transient carrier for HOW the next selection was made. Selection state
 *  flows through the URL hash, which cannot carry this bit.
 *
 *  Contract: markClickOrigin() may ONLY be called when the click is about to
 *  produce a selection hashchange — takeOrigin() runs solely in
 *  useSelectedCountry.resolveHash (mount + hashchange), so a mark with no
 *  following hashchange (game guess click, compare-picking click, re-click of
 *  the already-selected country) would never be consumed and would leak
 *  preserveZoom into the NEXT auto selection. The single marking site in
 *  useMapInteractions.clickCountry enforces this precondition.
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
