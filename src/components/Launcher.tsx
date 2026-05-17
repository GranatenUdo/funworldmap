import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listModes } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import type { CityLike, CountryLike, ModeId } from '../game/shared/types'
import { isCountryPinning } from '../game/shared/modePredicates'
import { writeHash } from '../lib/hashState'
import { track } from '../lib/analytics'
import { installFocusTrap } from '../lib/focusTrap'
import { useDailyPuzzlesContext } from '../game/daily/DailyPuzzlesProvider'
import { useDailyHistory } from '../game/daily/useDailyHistory'
import { getToday, getYesterday } from '../game/daily/dates'
import { deriveStreakMode } from '../game/daily/storage'
import { LauncherModeCard, type LauncherCardState } from './LauncherModeCard'
import { LauncherStreakPill } from './LauncherStreakPill'
import { LauncherMilestoneOverlay } from './LauncherMilestoneOverlay'
import { LauncherCountdown } from './LauncherCountdown'
import { LauncherHistoryPanel, type HistoryCellKind } from './LauncherHistoryPanel'

interface Props {
  onDismiss: () => void
  anchorDate: string | null
  countries: CountryLike[]
  cities: CityLike[]
  initialHistoryOpen?: boolean
}

function focusSearchInput(): void {
  // Defer until after React has committed the post-dismiss render.
  // Header returns null while the launcher is open, so the search input
  // doesn't exist in the DOM until the launcher unmounts and React
  // re-renders the header. A double-rAF (two animation frames) ensures
  // the commit + paint cycle has completed before we attempt to focus.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById('search-input') as HTMLInputElement | null
      el?.focus()
    })
  })
}

export function Launcher({
  onDismiss,
  anchorDate,
  countries,
  cities,
  initialHistoryOpen = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const modes = useMemo(() => listModes(), [])
  const lastMode = readLastMode()
  const { status: puzzlesStatus, byDate, index, refetch } = useDailyPuzzlesContext()
  const { history, get: getDay, streak, pendingMilestone, markMilestoneShown } = useDailyHistory()
  const [historyOpen, setHistoryOpen] = useState(initialHistoryOpen)
  const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')

  const totalDays = useMemo(() => Object.keys(history.days).length, [history])

  const { today, yesterday, todayFormatted } = useMemo(() => {
    const now = new Date()
    return {
      today: getToday(now),
      yesterday: getYesterday(now),
      todayFormatted: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  }, [])
  const streakMode = deriveStreakMode(streak.lastActiveDate, yesterday)

  const date = anchorDate ?? today

  const latestAvailableDate: string | null = useMemo(() => {
    if (!index) return null
    return (
      Object.keys(index.days)
        .filter((d) => d <= today)
        .sort()
        .pop() ?? null
    )
  }, [index, today])

  function cardState(modeId: ModeId): LauncherCardState {
    if (puzzlesStatus === 'loading') return 'loading'
    if (puzzlesStatus === 'unavailable') return 'unavailable-error'
    const puzzle = byDate(date)
    if (!puzzle) return 'no-puzzle-today'
    const prior = getDay(date, modeId)
    if (prior) return 'played'
    if (date < today) return 'past-unplayed'
    return 'unplayed'
  }

  const bothPlayed = modes.every((m) => cardState(m.id) === 'played')

  const playedFor = useCallback(
    (id: ModeId) => {
      const prior = getDay(date, id)
      if (!prior) return undefined
      const puzzle = byDate(date)
      if (!puzzle) return { score: prior.score }
      if (isCountryPinning(id)) {
        const c = countries.find((cc) => cc.cca3 === puzzle.country.cca3)
        return { score: prior.score, targetName: c?.name.common }
      }
      const city = cities.find((cc) => cc.id === puzzle.city.id)
      return { score: prior.score, targetName: city?.name }
    },
    [getDay, date, byDate, countries, cities],
  )

  const openedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (puzzlesStatus !== 'ready' || !index) return
    for (const m of modes) {
      const key = `${m.id}:${date}`
      if (openedRef.current.has(key)) continue
      if (!byDate(date)) continue
      openedRef.current.add(key)
      const dateAge = Math.max(
        0,
        Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86_400_000),
      )
      track('daily_opened', { mode: m.id, dateAge })
    }
  }, [puzzlesStatus, index, byDate, date, today, modes])

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
    // Primary: wait for animations to finish (precise on local).
    // Fallback: 1s cap (covers CI cases where getAnimations doesn't observe
    // CSS transitions, or .finished promises don't resolve).
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

  const startDaily = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'daily', date, modeId: id, reveal: false })
    },
    [onDismiss, date],
  )

  const startFree = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id })
    },
    [onDismiss],
  )

  const seeReveal = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      onDismiss()
      window.location.hash = `daily/${date}/${id}/reveal`
    },
    [onDismiss, date],
  )

  const openHistory = useCallback(() => {
    setHistoryOpen(true)
    track('history_opened', {})
  }, [])

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
  }, [])

  const onCellActivate = useCallback(
    (d: string, kind: HistoryCellKind) => {
      track('history_cell_clicked', { cellKind: kind })
      if (kind === 'rolled-off') return
      onDismiss()
      window.location.hash = `daily/${d}/reveal`
    },
    [onDismiss],
  )

  const onMilestoneDismiss = useCallback(() => {
    markMilestoneShown()
  }, [markMilestoneShown])

  useEffect(() => {
    const root = rootRef.current
    if (!root || !root.isConnected) return
    if (puzzlesStatus !== 'ready' && puzzlesStatus !== 'unavailable') return

    const active = document.activeElement
    const isFirstFocus = active === document.body || !root.contains(active)

    if (!isFirstFocus) return

    // Priority: lastMode daily-cta → lastMode see-reveal → any daily-cta →
    // any see-reveal → first focusable button
    const lastModeDailyCta = lastMode
      ? root.querySelector<HTMLButtonElement>(
          `[data-testid="launcher-card-${lastMode}-daily-cta"]:not([disabled])`,
        )
      : null
    const lastModeSeeReveal = lastMode
      ? root.querySelector<HTMLButtonElement>(
          `[data-testid="launcher-card-${lastMode}-see-reveal"]:not([disabled])`,
        )
      : null
    const firstDailyCta = root.querySelector<HTMLButtonElement>(
      '[data-testid$="-daily-cta"]:not([disabled])',
    )
    const firstSeeReveal = root.querySelector<HTMLButtonElement>(
      '[data-testid$="-see-reveal"]:not([disabled])',
    )
    const firstFocusable = root.querySelector<HTMLButtonElement>('button:not([disabled])')

    const target =
      lastModeDailyCta ?? lastModeSeeReveal ?? firstDailyCta ?? firstSeeReveal ?? firstFocusable
    target?.focus()
  }, [puzzlesStatus, lastMode])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cleanup = installFocusTrap(root)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && historyOpen) {
        e.preventDefault()
        e.stopPropagation()
        setHistoryOpen(false)
      }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      cleanup()
      root.removeEventListener('keydown', onKey)
    }
  }, [historyOpen])

  return (
    <>
      {pendingMilestone && (
        <LauncherMilestoneOverlay days={pendingMilestone} onDismiss={onMilestoneDismiss} />
      )}
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
            if (e.target === e.currentTarget) {
              dismissWithBackdrop()
            }
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
              {anchorDate ? `Daily · ${anchorDate}` : `Today’s puzzle · ${todayFormatted}`}
            </p>
          </div>

          <div className="mb-4">
            <LauncherStreakPill
              current={streak.current}
              longest={streak.longest}
              totalDays={totalDays}
              streakMode={streakMode}
              onOpenHistory={openHistory}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {modes.map((m, i) => (
              <div
                key={m.id}
                style={{ animation: `launcher-card-in 220ms ease-out ${120 + i * 60}ms both` }}
              >
                <LauncherModeCard
                  modeId={m.id}
                  anchorDate={anchorDate ?? undefined}
                  todayDate={today}
                  state={cardState(m.id)}
                  played={playedFor(m.id)}
                  latestAvailableDate={latestAvailableDate}
                  onStartDaily={() => startDaily(m.id)}
                  onSeeReveal={() => seeReveal(m.id)}
                  onRetry={() => void refetch()}
                />
              </div>
            ))}
          </div>

          {bothPlayed && <LauncherCountdown />}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => startFree(lastMode ?? 'country-pinning')}
              data-testid="launcher-unlimited-link"
              className="text-[13px] text-white underline decoration-white/50 hover:decoration-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-2 py-1 bg-black/40"
            >
              Play unlimited rounds →
            </button>
          </div>

          {historyOpen && (
            <LauncherHistoryPanel
              today={today}
              onClose={closeHistory}
              onCellActivate={onCellActivate}
            />
          )}
        </div>
      </div>
    </>
  )
}
