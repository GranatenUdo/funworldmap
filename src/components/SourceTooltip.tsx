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
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50"
        >
          <div className="font-medium">{source.name}</div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-300 hover:text-indigo-200 underline"
          >
            {source.url}
          </a>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
        </div>
      )}
    </div>
  )
}
