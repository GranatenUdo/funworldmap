import { useState, useRef, useEffect } from 'react'
import type { CountriesFile } from '../lib/types'

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

  // Close on click outside
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
        className="text-ground-400 dark:text-void-100 hover:text-ground-600 dark:hover:text-void-50 text-xs w-4 h-4 rounded-full border border-ground-300 dark:border-void-200 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light/50"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Source: ${source.name}`}
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-ground-900 dark:bg-void-300 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50"
          style={{ animation: 'fade-up 120ms ease-out' }}
        >
          <div className="font-medium">{source.name}</div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-light hover:text-[#c4b5fd] underline"
          >
            {source.url}
          </a>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ground-900 dark:border-t-void-300" />
        </div>
      )}
    </div>
  )
}
