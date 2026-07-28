import { useState, useRef, useCallback, useEffect } from 'react'
import { useCountrySearch } from '../hooks/useCountrySearch'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { FINE_POINTER_MEDIA_QUERY, TOUCH_TARGET_FROM_24 } from '../lib/layoutConstants'
import type { CountryData } from '../lib/types'

interface Props {
  countries: CountryData[]
  comparePickingMode?: boolean
  onSelect: (cca3: string) => void
  onNonEmptyChange?: () => void
}

const LISTBOX_ID = 'search-results'

const REGION_COLORS: Record<string, string> = {
  Africa: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Americas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Asia: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Europe: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Oceania: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Antarctic: 'bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
}

export default function SearchBar({
  countries,
  comparePickingMode,
  onSelect,
  onNonEmptyChange,
}: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { results, isStale } = useCountrySearch(countries, query)
  const finePointer = useMediaQuery(FINE_POINTER_MEDIA_QUERY)

  useEffect(() => {
    // Gate entirely on query being non-empty so that stale results left over
    // from the previous debounce cycle do NOT momentarily re-open the dropdown
    // after selectResult clears the query. Without this guard, the sequence
    // setQuery('')+setIsOpen(false) can race with the results-from-previous-
    // query still being present, causing the useEffect to call setIsOpen(true)
    // for one extra render frame — enough to block a click on panel-close in CI.
    setIsOpen(query.trim().length > 0)
    // Auto-activate the top result so Enter commits it immediately
    // ("Search First" — approved 2026-07-10). Arrow keys move from here.
    // FRESH results only: during the 150ms debounce the list still shows the
    // previous query's matches, and Enter must stay a no-op rather than
    // commit them (2026-07-10 review finding).
    setActiveIndex(!isStale && results.length > 0 ? 0 : -1)
  }, [results, query, isStale])

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
            selectResult(results[activeIndex])
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

  const announcement =
    query.trim().length > 0
      ? results.length > 0
        ? `${results.length} result${results.length === 1 ? '' : 's'} for ${query}`
        : `No results for ${query}`
      : ''

  return (
    <div className="relative flex-1 max-w-md">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Search icon — ice colored */}
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ice-dim dark:text-ice pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={LISTBOX_ID}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        spellCheck={false}
        placeholder={comparePickingMode ? 'Choose country to compare...' : 'Search countries...'}
        value={query}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          if (next.length > 0) onNonEmptyChange?.()
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setIsFocused(true)
          if (query.trim()) setIsOpen(true)
        }}
        onBlur={() => setIsFocused(false)}
        className="w-full pl-10 pr-9 py-3 rounded-xl bg-sand-100 dark:bg-dark-400/80 backdrop-blur-md border border-sand-300 dark:border-dark-200/30 text-sand-900 dark:text-dark-50 text-sm max-sm:text-base placeholder-sand-400 dark:placeholder-dark-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/40 dark:focus-visible:ring-ice/40 focus:border-ice-dim/40 dark:focus:border-ice/30 transition-all duration-150"
        id="search-input"
        data-testid="search-input"
      />

      {query && (
        <button
          onClick={() => {
            setQuery('')
            setIsOpen(false)
            inputRef.current?.focus()
          }}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-sand-400 hover:text-sand-600 dark:text-dark-100 dark:hover:text-dark-50 ${TOUCH_TARGET_FROM_24}`}
          aria-label="Clear search"
          data-testid="search-clear"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* "/" shortcut affordance (A11) — advertises the App.tsx global "/"
          focus shortcut. Coexistence with the clear button: clear renders iff
          query !== '', this chip iff query === '' — disjoint on query, so the
          two can never occupy right-2.5 at the same time. */}
      {finePointer && !isFocused && query === '' && (
        <kbd
          aria-hidden="true"
          data-testid="search-shortcut-hint"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none px-1.5 py-0.5 rounded-md border border-sand-300/60 dark:border-dark-200/40 bg-sand-200/60 dark:bg-dark-300/60 text-[11px] font-medium text-sand-500 dark:text-dark-100"
        >
          /
        </kbd>
      )}

      {isOpen && (
        <ul
          id={LISTBOX_ID}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[432px] overflow-y-auto"
          style={{ animation: 'dropdown-in 120ms ease-out', transformOrigin: 'top' }}
          data-testid="search-results"
        >
          {results.length > 0
            ? results.map((country, index) => (
                <li
                  key={country.cca3}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => selectResult(country)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors duration-75 ${
                    index === activeIndex
                      ? 'bg-ice-dim/8 dark:bg-ice/10 border-l-3 border-l-ice-dim dark:border-l-ice'
                      : 'border-l-3 border-l-transparent hover:bg-sand-200/50 dark:hover:bg-dark-300/50'
                  }`}
                >
                  <img
                    src={country.flag}
                    alt=""
                    className="w-10 h-7 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-medium text-sand-900 dark:text-dark-50 truncate"
                      data-testid="search-option-name"
                    >
                      {country.name.common}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {country.capital.length > 0 && (
                        <span className="text-xs text-sand-500 dark:text-dark-100 truncate">
                          {country.capital[0]}
                        </span>
                      )}
                      <span
                        data-testid="region-badge"
                        className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                          REGION_COLORS[country.region] ||
                          'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
                        }`}
                      >
                        {country.region}
                      </span>
                    </div>
                  </div>
                </li>
              ))
            : query.trim().length > 0 && (
                <li
                  className="px-4 py-3 text-sm text-sand-500 dark:text-dark-100"
                  data-testid="search-no-results"
                >
                  No countries found for &ldquo;{query}&rdquo;
                </li>
              )}
          {results.length > 0 && finePointer && (
            <li role="presentation" aria-hidden="true">
              <div
                className="px-3 py-2 border-t border-sand-200/60 dark:border-dark-200/30 text-[11px] text-sand-500 dark:text-dark-100 flex gap-3 justify-end sticky bottom-0 bg-sand-50/95 dark:bg-dark-400/95"
                data-testid="search-keyboard-hint"
                aria-hidden="true"
              >
                <span>
                  <kbd>↓↑</kbd> Select
                </span>
                <span>
                  <kbd>↵</kbd> Confirm
                </span>
                <span>
                  <kbd>Esc</kbd> Close
                </span>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
