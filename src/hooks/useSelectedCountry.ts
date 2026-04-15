import { useState, useEffect, useCallback } from 'react'
import type { CountryData } from '../lib/types'

/**
 * URL hash is the single source of truth for country selection.
 * All selection actions (map click, search, border chip) update the hash.
 * This hook reads the hash and resolves it to a CountryData object.
 */
export function useSelectedCountry(
  byCca3: Map<string, CountryData>,
): {
  selected: CountryData | null
  select: (cca3: string) => void
  deselect: () => void
} {
  const [selected, setSelected] = useState<CountryData | null>(null)

  // Resolve current hash to a country
  const resolveHash = useCallback(() => {
    const hash = window.location.hash.slice(1) // remove '#'
    if (!hash) {
      setSelected(null)
      return
    }
    const country = byCca3.get(hash.toUpperCase())
    if (country) {
      setSelected(country)
    } else {
      // Invalid hash — clear it silently
      history.replaceState(null, '', window.location.pathname)
      setSelected(null)
    }
  }, [byCca3])

  // Listen for hash changes
  useEffect(() => {
    resolveHash()
    window.addEventListener('hashchange', resolveHash)
    return () => window.removeEventListener('hashchange', resolveHash)
  }, [resolveHash])

  const select = useCallback((cca3: string) => {
    // Push new hash entry for country-to-country navigation
    window.location.hash = cca3
  }, [])

  const deselect = useCallback(() => {
    // Replace current entry (no blank # in history)
    history.replaceState(null, '', window.location.pathname)
    setSelected(null)
  }, [])

  return { selected, select, deselect }
}
