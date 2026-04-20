import { useCallback, useEffect, useRef } from 'react'
import { listModes } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import type { ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { usePersonalBests } from '../game/shared/usePersonalBests'
import { LauncherModeCard } from './LauncherModeCard'

interface Props {
  onDismiss: () => void
}

const TAGLINES: Record<ModeId, string> = {
  'country-pinning': 'Click where the country is. 10 rounds.',
  'city-guessing': 'Drop a pin near the city. 10 rounds.',
}

function focusSearchInput(): void {
  const el = document.getElementById('search-input') as HTMLInputElement | null
  el?.focus()
}

export function Launcher({ onDismiss }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { best: countryPinningBest } = usePersonalBests('country-pinning')
  const { best: cityGuessingBest } = usePersonalBests('city-guessing')
  const modes = listModes()
  const lastMode = readLastMode()

  const bestFor = (id: ModeId) =>
    id === 'country-pinning' ? countryPinningBest : cityGuessingBest

  const dismissWithFocus = useCallback(() => {
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const startMode = useCallback(
    (id: ModeId) => {
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
    },
    [onDismiss],
  )

  // Initial focus on last-played mode's card; fall back to country-pinning.
  useEffect(() => {
    const selector = `[data-testid="launcher-mode-${lastMode}"]`
    const target = rootRef.current?.querySelector<HTMLButtonElement>(selector)
    target?.focus()
  }, [lastMode])

  // Focus trap across the three focusable elements: mode card 1, mode card 2, dismiss link.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = Array.from(
        root.querySelectorAll<HTMLButtonElement>('button[data-testid^="launcher-"]'),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose how to play"
      data-testid="launcher"
      className="fixed inset-0 z-[210] flex items-center justify-center p-6"
    >
      {/* Backdrop — dimmed + blurred map */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 dark:bg-[rgba(11,15,26,0.7)] backdrop-blur-[4px]"
        style={{ animation: 'launcher-backdrop-in 220ms ease-out' }}
      />

      {/* Card cluster */}
      <div className="relative w-full max-w-2xl mx-auto">
        <header
          className="text-center mb-6"
          style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}
        >
          <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </div>
          <p className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2">
            194 countries. Explore or guess.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {modes.map((m, i) => (
            <div
              key={m.id}
              style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}
            >
              <LauncherModeCard
                modeId={m.id}
                title={m.title}
                tagline={TAGLINES[m.id]}
                best={bestFor(m.id)}
                onStart={() => startMode(m.id)}
              />
            </div>
          ))}
        </div>

        <div
          className="mt-6 text-center"
          style={{ animation: 'launcher-text-in 180ms ease-out 260ms both' }}
        >
          <button
            type="button"
            onClick={dismissWithFocus}
            data-testid="launcher-dismiss"
            className="text-[13px] text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60 rounded px-2 py-1"
          >
            Just explore the map
          </button>
        </div>
      </div>
    </div>
  )
}
