import { useCallback, useEffect, useRef, useState } from 'react'
import { MODE_IDS } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import { usePersonalBests } from '../game/shared/usePersonalBests'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { track } from '../lib/analytics'
import { useModalLayer } from '../hooks/useModalLayer'
import { LauncherModeCard } from './LauncherModeCard'

interface Props {
  ready?: boolean
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

export function Launcher({ onDismiss, ready = true }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  useModalLayer(rootRef)
  const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')
  // A16: "beat your best" presumes a best exists — gate on either mode having
  // a recorded game. Two static calls because hooks can't run in a loop.
  const { best: countryBest } = usePersonalBests('country-pinning')
  const { best: cityBest } = usePersonalBests('city-guessing')
  const hasPlayedAnyMode = countryBest.gamesPlayed > 0 || cityBest.gamesPlayed > 0

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
      if (!ready) return
      track('launcher_dismissed', { path: 'card' })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id })
    },
    [onDismiss, ready],
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

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose how to play"
      data-testid="launcher"
      data-animation-state={animationState}
      className="launcher-shell fixed inset-0 z-[210] flex overflow-y-auto p-4 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-dark-500/35 backdrop-blur-[2px]"
        style={{ animation: 'launcher-backdrop-in 220ms ease-out' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismissWithBackdrop()
        }}
      />
      <div className="launcher-content relative w-full max-w-3xl mx-auto my-auto">
        <button
          type="button"
          onClick={dismissWithCloseButton}
          data-testid="launcher-close"
          aria-label="Close"
          className="absolute top-0 right-0 w-11 h-11 rounded-lg border border-white/15 text-sand-50 dark:text-dark-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ice/60 flex items-center justify-center"
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
          <div className="text-sm font-bold tracking-wide text-ice uppercase">funworldmap</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mt-5 tracking-tight">
            How well do you
            <br />
            know your world?
          </h1>
          <p className="text-base text-sand-50 mt-4" data-testid="launcher-subtitle">
            {hasPlayedAnyMode
              ? 'Pick a mode and beat your best'
              : 'Take a guess. Discover somewhere new.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {MODE_IDS.map((id, i) => (
            <div
              key={id}
              style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}
            >
              <LauncherModeCard preferred={id === (readLastMode() ?? MODE_IDS[0])} ready={ready} modeId={id} onPlay={() => startFree(id)} />
            </div>
          ))}
        </div>
        <div className="text-center mt-6">
          <button className="explore-button" onClick={dismissWithCloseButton}>
            Explore the map <span aria-hidden="true">→</span>
          </button>
          {!ready && (
            <p role="status" className="text-sm text-sand-50 mt-3">
              Getting the globe ready… You can explore while it loads.
            </p>
          )}
          <p className="text-xs text-sand-50 mt-4">Free to play. No account. Just curiosity.</p>
        </div>
      </div>
    </div>
  )
}
