import { useState, useRef, useCallback, useEffect } from 'react'
import { useCountrySearch } from '../hooks/useCountrySearch'
import type { CountryData } from '../lib/types'

interface Props {
  countries: CountryData[]
  onSelect: (cca3: string) => void
}

const LISTBOX_ID = 'search-results'

const REGION_COLORS: Record<string, string> = {
  Africa: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Americas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Asia: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Europe: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Oceania: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  Antarctic: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
}

export default function SearchBar({ countries, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useCountrySearch(countries, query)

  // Open dropdown when results appear
  useEffect(() => {
    setIsOpen(results.length > 0 || (query.trim().length > 0 && results.length === 0))
    setActiveIndex(-1)
  }, [results, query])

  const selectResult = useCallback(
    (country: CountryData) => {
      onSelect(country.cca3)
      setQuery('')
      setIsOpen(false)
      inputRef.current?.blur()
    },
    [onSelect],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && results[activeIndex]) {
            selectResult(results[activeIndex].country)
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          setQuery('')
          break
      }
    },
    [isOpen, activeIndex, results, selectResult],
  )

  const activeId = activeIndex >= 0 ? `search-result-${activeIndex}` : undefined

  // ARIA live announcement
  const announcement =
    query.trim().length > 0
      ? results.length > 0
        ? `${results.length} result${results.length === 1 ? '' : 's'} for ${query}`
        : `No results for ${query}`
      : ''

  return (
    <div className="relative flex-1 max-w-md">
      {/* ARIA live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Search icon */}
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ground-400 dark:text-void-100 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        placeholder="Search countries, capitals, regions..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (query.trim()) setIsOpen(true)
        }}
        className="w-full pl-10 pr-9 py-3 rounded-xl backdrop-blur-xl bg-white/60 dark:bg-void-400/60 border border-ground-200/80 dark:border-void-200/50 text-ground-900 dark:text-void-50 text-sm placeholder-ground-400 dark:placeholder-void-100 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light/50 focus:border-accent/30 dark:focus:border-accent-light/30 focus:shadow-md transition-all duration-150"
        id="search-input"
        data-testid="search-input"
      />

      {/* Clear button */}
      {query && (
        <button
          onClick={() => {
            setQuery('')
            setIsOpen(false)
            inputRef.current?.focus()
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ground-400 hover:text-ground-600 dark:text-void-100 dark:hover:text-void-50"
          aria-label="Clear search"
          data-testid="search-clear"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Results dropdown */}
      {isOpen && (
        <ul
          id={LISTBOX_ID}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 dark:bg-void-400/95 backdrop-blur-xl border border-ground-200/80 dark:border-void-200/50 rounded-xl shadow-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto"
          style={{ animation: 'dropdown-in 120ms ease-out', transformOrigin: 'top' }}
          data-testid="search-results"
        >
          {results.length > 0
            ? results.map((result, index) => (
                <li
                  key={result.country.cca3}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => selectResult(result.country)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors duration-75 ${
                    index === activeIndex
                      ? 'bg-accent/8 dark:bg-accent-light/10 border-l-3 border-l-accent dark:border-l-accent-light'
                      : 'border-l-3 border-l-transparent hover:bg-ground-50 dark:hover:bg-void-300/50'
                  }`}
                >
                  <img
                    src={result.country.flag}
                    alt=""
                    className="w-10 h-7 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ground-900 dark:text-void-50 truncate">
                      {result.country.name.common}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {result.country.capital.length > 0 && (
                        <span className="text-xs text-ground-500 dark:text-void-100 truncate">
                          {result.country.capital[0]}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          REGION_COLORS[result.country.region] || 'bg-ground-100 text-ground-600 dark:bg-void-200 dark:text-void-100'
                        }`}
                      >
                        {result.country.region}
                      </span>
                    </div>
                  </div>
                </li>
              ))
            : query.trim().length > 0 && (
                <li className="px-4 py-3 text-sm text-ground-500 dark:text-void-100" data-testid="search-no-results">
                  No countries found for &ldquo;{query}&rdquo;
                </li>
              )}
        </ul>
      )}
    </div>
  )
}
