import { useState, useMemo } from 'react'
import {
  useFloating,
  useHover,
  useFocus,
  useDismiss,
  useInteractions,
  autoUpdate,
  flip,
  shift,
  offset,
} from '@floating-ui/react'
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

  const middleware = useMemo(() => [offset(8), flip(), shift({ padding: 8 })], [])

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    middleware,
    whileElementsMounted: autoUpdate,
  })

  const hover = useHover(context, { enabled: SUPPORTS_HOVER })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss])

  const sourceKey = fieldSources[field]
  const source = sourceKey ? sources[sourceKey] : null

  if (!source) return null

  return (
    <>
      {/* tabIndex={-1}: removed from sequential Tab order so blur-out closes the
          tooltip cleanly. Keyboard users can still reach it via focus (useFocus
          hook); sighted-keyboard reach via Tab is a known a11y trade-off (Phase 4.3). */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        tabIndex={-1}
        className="text-sand-400 dark:text-dark-100 hover:text-teal dark:hover:text-teal-light text-xs w-4 h-4 rounded-full border border-sand-300 dark:border-dark-200 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 transition-colors ml-1"
        aria-label={`Source: ${source.name}`}
      >
        i
      </button>
      {open && (
        <div
          ref={refs.setFloating}
          style={{ ...floatingStyles, animation: 'fade-up 100ms ease-out' }}
          {...getFloatingProps()}
          role="tooltip"
          className="px-3 py-2 bg-dark-400 dark:bg-dark-300 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50"
        >
          <div className="font-medium">{source.name}</div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            className="text-teal-light hover:text-teal underline"
          >
            {source.url}
          </a>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark-400 dark:border-t-dark-300" />
        </div>
      )}
    </>
  )
}
