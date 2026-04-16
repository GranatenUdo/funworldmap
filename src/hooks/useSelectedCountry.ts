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
    const { selected: selCode, compareWith: cmpCode } = parseHash(window.location.hash)

    const selCountry = selCode ? byCca3.get(selCode) ?? null : null
    const cmpCountry = cmpCode ? byCca3.get(cmpCode) ?? null : null

    // Invalid selected silently cleared
    if (selCode && !selCountry) {
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
    // New selection clears any existing compareWith
    window.location.hash = writeHash(cca3.toUpperCase(), null)
  }, [])

  const compareSelect = useCallback((cca3: string) => {
    // Pair compareWith with the existing selected (from hash at call time)
    const currentHash = parseHash(window.location.hash)
    if (!currentHash.selected) return
    window.location.hash = writeHash(currentHash.selected, cca3.toUpperCase())
  }, [])

  const clearCompare = useCallback(() => {
    const currentHash = parseHash(window.location.hash)
    if (!currentHash.selected) return
    window.location.hash = writeHash(currentHash.selected, null)
  }, [])

  const deselect = useCallback(() => {
    history.replaceState(null, '', window.location.pathname)
    setSelected(null)
    setCompareWith(null)
  }, [])

  return { selected, compareWith, select, compareSelect, clearCompare, deselect }
}
