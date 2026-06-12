import { useMemo, useState, useEffect, useRef } from 'react'
import Fuse, { type IFuseOptions } from 'fuse.js'
import type { CountryData } from '../lib/types'

const FUSE_OPTIONS: IFuseOptions<CountryData> = {
  keys: [
    { name: 'name.common', weight: 2.0 },
    { name: 'name.official', weight: 1.5 },
    { name: 'capital', weight: 1.0 },
    { name: 'region', weight: 0.5 },
    { name: 'subregion', weight: 0.5 },
    { name: 'cca2', weight: 0.3 },
    { name: 'cca3', weight: 0.3 },
  ],
  threshold: 0.4,
}

const MAX_RESULTS = 8
const DEBOUNCE_MS = 150

export function useCountrySearch(countries: CountryData[], query: string): CountryData[] {
  const fuse = useMemo(() => new Fuse(countries, FUSE_OPTIONS), [countries])
  const [results, setResults] = useState<CountryData[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    timerRef.current = setTimeout(() => {
      setResults(fuse.search(query, { limit: MAX_RESULTS }).map((r) => r.item))
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fuse, query])

  return results
}
