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

export interface CountrySearchState {
  results: CountryData[]
  /** True while `results` still belong to a previous query (the debounce
   *  hasn't fired for the current one). Consumers must not auto-commit stale
   *  results — Enter during the debounce window would select the previous
   *  query's top match (2026-07-10 review finding). */
  isStale: boolean
}

export function useCountrySearch(countries: CountryData[], query: string): CountrySearchState {
  const fuse = useMemo(() => new Fuse(countries, FUSE_OPTIONS), [countries])
  // results and the query they were computed for update together, so
  // freshness is derivable at render time without extra effects.
  const [state, setState] = useState<{ results: CountryData[]; forQuery: string }>({
    results: [],
    forQuery: '',
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {
      setState({ results: [], forQuery: query })
      return
    }

    timerRef.current = setTimeout(() => {
      setState({
        results: fuse.search(query, { limit: MAX_RESULTS }).map((r) => r.item),
        forQuery: query,
      })
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fuse, query])

  return { results: state.results, isStale: state.forQuery !== query }
}
