import { useEffect, useRef, type RefObject } from 'react'

/**
 * Owns the visually-hidden aria-live region. Announces country selection
 * changes (driven by `selectedName`) and ad-hoc messages dispatched as
 * `funworldmap:announce` CustomEvents (auto-cleared after 8s). Returns the ref
 * to attach to the live-region element. Extracted from App.tsx.
 */
export function useLiveAnnouncements(
  selectedName: string | null,
): RefObject<HTMLDivElement | null> {
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const clearTimerRef = useRef<number | null>(null)
  const prevSelectedRef = useRef<string | null>(null)

  useEffect(() => {
    const name = selectedName
    const prevName = prevSelectedRef.current
    if (liveRegionRef.current) {
      if (name && name !== prevName) liveRegionRef.current.textContent = `${name} selected`
      else if (!name && prevName) liveRegionRef.current.textContent = 'Country panel closed'
    }
    prevSelectedRef.current = name
  }, [selectedName])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (!liveRegionRef.current || !detail) return
      liveRegionRef.current.textContent = detail
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = window.setTimeout(() => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = ''
      }, 8000)
    }
    window.addEventListener('funworldmap:announce', handler)
    return () => {
      window.removeEventListener('funworldmap:announce', handler)
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
    }
  }, [])

  return liveRegionRef
}
