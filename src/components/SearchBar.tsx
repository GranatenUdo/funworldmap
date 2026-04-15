import { useState, useRef, useCallback, useEffect } from 'react'
import { useCountrySearch } from '../hooks/useCountrySearch'
import type { CountryData } from '../lib/types'

interface Props {
  countries: CountryData[]
  onSelect: (cca3: string) => void
}

const LISTBOX_ID = 'search-results'

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
        className="w-full px-4 py-2 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden z-50 max-h-[400px] overflow-y-auto"
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
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm ${
                    index === activeIndex
                      ? 'bg-indigo-50 dark:bg-indigo-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <img
                    src={result.country.flag}
                    alt=""
                    className="w-8 h-5 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 dark:text-white truncate">
                      {result.country.name.common}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {result.country.capital.length > 0 && `${result.country.capital[0]} · `}
                      {result.country.region}
                    </div>
                  </div>
                </li>
              ))
            : query.trim().length > 0 && (
                <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400" data-testid="search-no-results">
                  No countries found for &ldquo;{query}&rdquo;
                </li>
              )}
        </ul>
      )}
    </div>
  )
}
