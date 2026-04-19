import { useState, useEffect, useCallback } from 'react'
import type { CountryData } from '../lib/types'
import { parseHash, writeHash } from '../lib/hashState'

export function useSelectedCountry(
  byCca3: Map<string, CountryData>,
): {
  selected: CountryData | null
  compareWith: CountryData | null
  select: (cca3: string) => void
  compareSelect: (cca3: string) => void
  clearCompare: () => void
  deselect: () => void
} {
  const [selected, setSelected] = useState<CountryData | null>(null)
  const [compareWith, setCompareWith] = useState<CountryData | null>(null)

  const resolveHash = useCallback(() => {
    const state = parseHash(window.location.hash)
    if (state.kind !== 'country') {
      setSelected(null)
      setCompareWith(null)
      return
    }
    const selCountry = byCca3.get(state.cca3) ?? null
    const cmpCountry = state.compareWith ? byCca3.get(state.compareWith) ?? null : null
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
      kind: 'country', cca3: cca3.toUpperCase(), compareWith: null,
    })
  }, [])

  const compareSelect = useCallback((cca3: string) => {
    const current = parseHash(window.location.hash)
    if (current.kind !== 'country') return
    window.location.hash = writeHash({
      kind: 'country', cca3: current.cca3, compareWith: cca3.toUpperCase(),
    })
  }, [])

  const clearCompare = useCallback(() => {
    const current = parseHash(window.location.hash)
    if (current.kind !== 'country') return
    window.location.hash = writeHash({
      kind: 'country', cca3: current.cca3, compareWith: null,
    })
  }, [])

  const deselect = useCallback(() => {
    history.replaceState(null, '', window.location.pathname)
    setSelected(null)
    setCompareWith(null)
  }, [])

  return { selected, compareWith, select, compareSelect, clearCompare, deselect }
}
