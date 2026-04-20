import { useEffect, useRef, useState } from 'react'
import { listModes } from '../game/modes'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'

export function PlayMenu({ open, onClose, triggerRef }: {
  open: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [focusedIdx, setFocusedIdx] = useState(0)
  const modes = listModes()
  const lastMode = readLastMode()
  const ordered = [...modes].sort((a, b) => (a.id === lastMode ? -1 : b.id === lastMode ? 1 : 0))

  useEffect(() => {
    if (!open) return
    setFocusedIdx(0)
    const first = containerRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    first?.focus()

    const onOutside = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); triggerRef.current?.focus() }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx((i) => (i + 1) % ordered.length) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx((i) => (i - 1 + ordered.length) % ordered.length) }
      if (e.key === 'Home') { e.preventDefault(); setFocusedIdx(0) }
      if (e.key === 'End') { e.preventDefault(); setFocusedIdx(ordered.length - 1) }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, ordered.length, triggerRef])

  useEffect(() => {
    if (!open) return
    const items = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    items?.[focusedIdx]?.focus()
  }, [focusedIdx, open])

  if (!open) return null

  const selectMode = (id: ModeId) => {
    writeLastMode(id)
    window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
    onClose()
  }

  return (
    <div
      ref={containerRef}
      id="play-menu"
      role="menu"
      aria-orientation="vertical"
      className="absolute right-0 top-12 w-56 rounded-xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl overflow-hidden z-50"
      data-testid="play-menu"
    >
      {ordered.map((m) => (
        <button
          key={m.id}
          type="button"
          role="menuitem"
          onClick={() => selectMode(m.id)}
          className="w-full text-left px-4 py-3 text-sm hover:bg-sand-200/70 dark:hover:bg-dark-300/70 focus:outline-none focus:bg-sand-200/70 dark:focus:bg-dark-300/70"
          data-testid={`play-menu-${m.id}`}
        >
          <div className="font-semibold text-sand-900 dark:text-dark-50">{m.title}</div>
          <div className="text-xs text-sand-500 dark:text-dark-100 mt-0.5">{m.description}</div>
        </button>
      ))}
    </div>
  )
}
