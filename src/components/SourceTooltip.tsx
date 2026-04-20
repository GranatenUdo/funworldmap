import { useState, useRef, useEffect } from 'react'
import type { CountriesFile } from '../lib/types'

const SUPPORTS_HOVER =
  typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

interface Props {
  field: string
  fieldSources: Record<string, string>
  sources: CountriesFile['_sources']
}

export default function SourceTooltip({ field, fieldSources, sources }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const sourceKey = fieldSources[field]
  const source = sourceKey ? sources[sourceKey] : null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [open])

  if (!source) return null

  return (
    <div ref={ref} className="relative inline-block ml-1">
      <button
        className="text-sand-400 dark:text-dark-100 hover:text-teal dark:hover:text-teal-light text-xs w-4 h-4 rounded-full border border-sand-300 dark:border-dark-200 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={SUPPORTS_HOVER ? () => setOpen(true) : undefined}
        onMouseLeave={SUPPORTS_HOVER ? () => setOpen(false) : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Source: ${source.name}`}
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-dark-400 dark:bg-dark-300 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50"
          style={{ animation: 'fade-up 100ms ease-out' }}
        >
          <div className="font-medium">{source.name}</div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-light hover:text-teal underline"
          >
            {source.url}
          </a>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark-400 dark:border-t-dark-300" />
        </div>
      )}
    </div>
  )
}
