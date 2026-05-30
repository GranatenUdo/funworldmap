import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listModes } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { track } from '../lib/analytics'
import { installFocusTrap } from '../lib/focusTrap'
import { LauncherModeCard } from './LauncherModeCard'

interface Props {
  onDismiss: () => void
}

function focusSearchInput(): void {
  // Header returns null while the launcher is open, so the search input is not
  // in the DOM until the launcher unmounts. A double-rAF waits for that commit.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById('search-input') as HTMLInputElement | null
      el?.focus()
    })
  })
}

export function Launcher({ onDismiss }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const modes = useMemo(() => listModes(), [])
  const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')

  const dismissWithCloseButton = useCallback(() => {
    track('launcher_dismissed', { path: 'close' })
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const dismissWithBackdrop = useCallback(() => {
    track('launcher_dismissed', { path: 'backdrop' })
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const startFree = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id })
    },
    [onDismiss],
  )

  // Flip data-animation-state to 'idle' once entry animations finish (or after a
  // 1s CI fallback). Lets e2e wait via waitForAnimationIdle instead of timeouts.
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      setAnimationState('idle')
      return
    }
    let cancelled = false
    let resolved = false
    const flipToIdle = () => {
      if (cancelled || resolved) return
      resolved = true
      setAnimationState('idle')
    }
    const rafId = window.requestAnimationFrame(() => {
      if (cancelled) return
      const animations = root.getAnimations({ subtree: true })
      if (animations.length === 0) {
        flipToIdle()
        return
      }
      Promise.all(animations.map((a) => a.finished))
        .then(flipToIdle)
        .catch(flipToIdle)
    })
    const timeoutId = window.setTimeout(flipToIdle, 1000)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }, [])

  // Focus the last-played mode's Play button, else the first Play button.
  // Runs once on mount; lastMode is read here (not as a dep) because it cannot
  // change during the launcher's lifetime — its only writer, startFree, unmounts.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !root.isConnected) return
    const active = document.activeElement
    if (active !== document.body && root.contains(active)) return
    const lastMode = readLastMode()
    const preferred = lastMode
      ? root.querySelector<HTMLButtonElement>(`[data-testid="launcher-card-${lastMode}-play"]`)
      : null
    const firstPlay = root.querySelector<HTMLButtonElement>('[data-testid$="-play"]')
    ;(
      preferred ??
      firstPlay ??
      root.querySelector<HTMLButtonElement>('button:not([disabled])')
    )?.focus()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return installFocusTrap(root)
  }, [])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose how to play"
      data-testid="launcher"
      data-animation-state={animationState}
      className="fixed inset-0 z-[210] flex items-center justify-center p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 dark:bg-[rgba(11,15,26,0.7)] backdrop-blur-[4px]"
        style={{ animation: 'launcher-backdrop-in 220ms ease-out' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismissWithBackdrop()
        }}
      />
      <div className="relative w-full max-w-2xl mx-auto">
        <button
          type="button"
          onClick={dismissWithCloseButton}
          data-testid="launcher-close"
          aria-label="Close"
          className="absolute -top-2 right-0 w-9 h-9 rounded-full text-sand-50 dark:text-dark-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 flex items-center justify-center"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        <div
          role="presentation"
          className="text-center mb-6 pointer-events-none"
          style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}
        >
          <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </div>
          <p
            className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2"
            data-testid="launcher-subtitle"
          >
            Pick a mode and beat your best
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {modes.map((m, i) => (
            <div
              key={m.id}
              style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}
            >
              <LauncherModeCard modeId={m.id} onPlay={() => startFree(m.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
