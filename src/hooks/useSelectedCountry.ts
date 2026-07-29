import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import type { CountryData } from '../lib/types'
import { parseHash, writeHash } from '../lib/hashState'
import { takeOrigin } from '../lib/selectionOrigin'

export type SelectionOrigin = 'click' | 'auto'

export function useSelectedCountry(byCca3: Map<string, CountryData>): {
  selected: CountryData | null
  compareWith: CountryData | null
  /** How the current selection was made — read at fly time (a ref, not
   *  state, so reading it never re-triggers the camera effect). */
  selectionOriginRef: MutableRefObject<SelectionOrigin>
  select: (cca3: string) => void
  compareSelect: (cca3: string) => void
  compareReplaceA: (cca3: string) => void
  clearCompare: () => void
  deselect: () => void
} {
  const [selected, setSelected] = useState<CountryData | null>(null)
  const [compareWith, setCompareWith] = useState<CountryData | null>(null)
  const selectionOriginRef = useRef<SelectionOrigin>('auto')

  const resolveHash = useCallback(() => {
    // Consume on EVERY hashchange so a click mark can never go stale (e.g. a
    // click re-selecting the already-selected country changes nothing else).
    selectionOriginRef.current = takeOrigin()
    const state = parseHash(window.location.hash)
    if (state.kind !== 'country') {
      setSelected(null)
      setCompareWith(null)
      return
    }
    const selCountry = byCca3.get(state.cca3) ?? null
    const cmpCountry = state.compareWith ? (byCca3.get(state.compareWith) ?? null) : null
    if (!selCountry) {
      history.replaceState(null, '', window.location.pathname)
      setSelected(null)
      setCompareWith(null)
      return
    }
    setSelected(selCountry)
    setCompareWith(cmpCountry)
  }, [byCca3])

  useEffect(() => {
    resolveHash()
    window.addEventListener('hashchange', resolveHash)
    return () => window.removeEventListener('hashchange', resolveHash)
  }, [resolveHash])

  const select = useCallback((cca3: string) => {
    window.location.hash = writeHash({
      kind: 'country',
      cca3: cca3.toUpperCase(),
      compareWith: null,
    })
  }, [])

  const compareSelect = useCallback((cca3: string) => {
    const current = parseHash(window.location.hash)
    if (current.kind !== 'country') return
    window.location.hash = writeHash({
      kind: 'country',
      cca3: current.cca3,
      compareWith: cca3.toUpperCase(),
    })
  }, [])

  /** C1 border-chip semantics: replace the SELECTED country (column A)
   *  while keeping the compare partner — the counterpart of compareSelect,
   *  which replaces B while keeping A. No-op unless a pair is active. */
  const compareReplaceA = useCallback((cca3: string) => {
    const current = parseHash(window.location.hash)
    if (current.kind !== 'country' || !current.compareWith) return
    window.location.hash = writeHash({
      kind: 'country',
      cca3: cca3.toUpperCase(),
      compareWith: current.compareWith,
    })
  }, [])

  const clearCompare = useCallback(() => {
    const current = parseHash(window.location.hash)
    if (current.kind !== 'country') return
    window.location.hash = writeHash({
      kind: 'country',
      cca3: current.cca3,
      compareWith: null,
    })
  }, [])

  const deselect = useCallback(() => {
    history.replaceState(null, '', window.location.pathname)
    setSelected(null)
    setCompareWith(null)
  }, [])

  return {
    selected,
    compareWith,
    selectionOriginRef,
    select,
    compareSelect,
    compareReplaceA,
    clearCompare,
    deselect,
  }
}
