import { useState, useRef, useEffect } from 'react'
import type { CountryLike } from '../types'
import { useCountrySearch } from '../../../hooks/useCountrySearch'
import type { CountryData } from '../../../lib/types'

interface Props {
  pool: CountryLike[]
  used: Set<string>
  onGuess: (cca3: string) => void
}

export function GuessByNameButton({ pool, used, onGuess }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const available = pool.filter((c) => !used.has(c.cca3)) as unknown as CountryData[]
  const results = useCountrySearch(available, query)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
        data-testid="game-guess-by-name"
      >
        Guess by name
      </button>
    )
  }

  const submit = (cca3: string) => {
    onGuess(cca3)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="w-full mt-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) {
            e.preventDefault()
            submit(results[0].country.cca3)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
            setQuery('')
          }
        }}
        placeholder="Type a country…"
        className="w-full px-3 py-2 text-sm rounded-lg bg-sand-100 dark:bg-dark-500 border border-sand-300/50 dark:border-dark-200/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
        data-testid="game-guess-input"
      />
      {results.length > 0 && (
        <ul
          className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-sand-300/50 dark:border-dark-200/30 bg-sand-50 dark:bg-dark-400"
          data-testid="game-guess-results"
        >
          {results.map((r) => (
            <li key={r.country.cca3}>
              <button
                type="button"
                onClick={() => submit(r.country.cca3)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-sand-200 dark:hover:bg-dark-300"
              >
                {r.country.name.common}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
