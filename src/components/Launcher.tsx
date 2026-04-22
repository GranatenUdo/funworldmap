import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listModes } from '../game/modes'
import { readLastMode, writeLastMode } from '../game/shared/lastMode'
import type { CityLike, CountryLike, ModeId } from '../game/shared/types'
import { writeHash } from '../lib/hashState'
import { track } from '../lib/analytics'
import { usePersonalBests } from '../game/shared/usePersonalBests'
import { useDailyPuzzlesContext } from '../game/daily/DailyPuzzlesProvider'
import { useDailyHistory } from '../game/daily/useDailyHistory'
import { toLocalDateString } from '../game/daily/dates'
import { LauncherModeCard, type LauncherCardState } from './LauncherModeCard'
import { LauncherStreakPill } from './LauncherStreakPill'
import { LauncherMilestoneOverlay } from './LauncherMilestoneOverlay'
import { LauncherHistoryPanel, type HistoryCellKind } from './LauncherHistoryPanel'

interface Props {
  onDismiss: () => void
  anchorDate: string | null
  countries: CountryLike[]
  cities: CityLike[]
}

function focusSearchInput(): void {
  const el = document.getElementById('search-input') as HTMLInputElement | null
  el?.focus()
}

export function Launcher({ onDismiss, anchorDate, countries, cities }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const modes = useMemo(() => listModes(), [])
  const lastMode = readLastMode()
  const { best: cpBest } = usePersonalBests('country-pinning')
  const { best: cgBest } = usePersonalBests('city-guessing')
  const { status: puzzlesStatus, byDate, index } = useDailyPuzzlesContext()
  const { history, get: getDay, streak, pendingMilestone, markMilestoneShown } = useDailyHistory()
  const [historyOpen, setHistoryOpen] = useState(false)

  const totalDays = useMemo(() => Object.keys(history.days).length, [history])

  const todayDate = new Date()
  const today = toLocalDateString(todayDate)
  const yesterday = toLocalDateString(
    new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1),
  )
  const streakMode: 'active' | 'broken' | 'first' =
    streak.lastActiveDate === null
      ? 'first'
      : streak.lastActiveDate >= yesterday
        ? 'active'
        : 'broken'

  const date = anchorDate ?? today

  function cardState(modeId: ModeId): LauncherCardState {
    if (puzzlesStatus === 'unavailable') return 'unavailable'
    if (puzzlesStatus === 'loading') return 'unavailable'
    const puzzle = byDate(date)
    if (!puzzle) return 'unavailable'
    const prior = getDay(date, modeId)
    return prior ? 'played' : 'unplayed'
  }

  const bestFor = (id: ModeId) => (id === 'country-pinning' ? cpBest : cgBest)
  const playedFor = useCallback((id: ModeId) => {
    const prior = getDay(date, id)
    if (!prior) return undefined
    const puzzle = byDate(date)
    if (!puzzle) return { score: prior.score }
    if (id === 'country-pinning') {
      const c = countries.find((cc) => cc.cca3 === puzzle.country.cca3)
      return { score: prior.score, targetName: c?.name.common }
    }
    const city = cities.find((cc) => cc.id === puzzle.city.id)
    return { score: prior.score, targetName: city?.name }
  }, [getDay, date, byDate, countries, cities])

  const openedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (puzzlesStatus !== 'ready' || !index) return
    for (const m of modes) {
      const key = `${m.id}:${date}`
      if (openedRef.current.has(key)) continue
      if (!byDate(date)) continue
      openedRef.current.add(key)
      const dateAge = Math.max(0, Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86_400_000))
      track('daily_opened', { mode: m.id, dateAge })
    }
  }, [puzzlesStatus, index, byDate, date, today, modes])

  const dismissWithFocus = useCallback(() => {
    track('launcher_dismissed', { path: 'link' })
    onDismiss()
    focusSearchInput()
  }, [onDismiss])

  const startDaily = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      track('daily_started', { mode: id })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'daily', date, modeId: id, reveal: false })
    },
    [onDismiss, date],
  )

  const startFree = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      track('free_started', { mode: id })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
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
    const selector = `[data-testid="launcher-card-${lastMode}-daily-cta"], [data-testid="launcher-card-${lastMode}-free-link"]`
    const target = rootRef.current?.querySelector<HTMLButtonElement>(selector)
    target?.focus()
  }, [lastMode])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && historyOpen) {
        e.preventDefault()
        e.stopPropagation()
        setHistoryOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('button[data-testid^="launcher-"]'),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
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
        className="fixed inset-0 z-[210] flex items-center justify-center p-6"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/55 dark:bg-[rgba(11,15,26,0.7)] backdrop-blur-[4px]"
          style={{ animation: 'launcher-backdrop-in 220ms ease-out' }}
        />
        <div className="relative w-full max-w-2xl mx-auto">
          <header
            className="text-center mb-6"
            style={{ animation: 'launcher-text-in 240ms ease-out 60ms both' }}
          >
            <div className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
              funworldmap
            </div>
            <p className="text-[13px] text-sand-50/90 dark:text-dark-100 mt-2">
              {anchorDate ? `Daily · ${anchorDate}` : '194 countries. Explore or guess.'}
            </p>
          </header>

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
                  state={cardState(m.id)}
                  played={playedFor(m.id)}
                  freeBest={bestFor(m.id)}
                  onStartDaily={() => startDaily(m.id)}
                  onStartFree={() => startFree(m.id)}
                  onSeeReveal={() => seeReveal(m.id)}
                />
              </div>
            ))}
          </div>

          {historyOpen && (
            <LauncherHistoryPanel
              today={today}
              onClose={closeHistory}
              onCellActivate={onCellActivate}
            />
          )}

          <div
            className="mt-6 text-center"
            style={{ animation: 'launcher-text-in 180ms ease-out 260ms both' }}
          >
            <button
              type="button"
              onClick={dismissWithFocus}
              data-testid="launcher-dismiss"
              className="text-[13px] text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-2 py-1"
            >
              Just explore the map
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
