import { useMemo, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { calendarGrid } from '../game/daily/calendarGrid'
import { parseLocalDate } from '../game/daily/dates'
import { useDailyHistory } from '../game/daily/useDailyHistory'
import { useDailyPuzzlesContext } from '../game/daily/DailyPuzzlesProvider'
import type { CityLike, CountryLike, ModeId } from '../game/shared/types'
import { LauncherCalendarCell } from './LauncherCalendarCell'

export type HistoryCellKind = 'played' | 'unplayed-in-window' | 'rolled-off'

export interface CellMemory {
  country?: { name: string; score: number }
  city?: { name: string; score: number }
}

interface Props {
  today: string
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
  onCellActivate: (date: string, kind: HistoryCellKind) => void
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DOW_LABELS_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function LauncherHistoryPanel({ today, countries, cities, onClose, onCellActivate }: Props) {
  const { history } = useDailyHistory()
  const cells = useMemo(() => calendarGrid(parseLocalDate(today), 30), [today])
  const rootRef = useRef<HTMLDivElement>(null)

  const playedByDate = useMemo(() => {
    const out = new Map<string, Set<ModeId>>()
    for (const [date, entry] of Object.entries(history.days)) {
      const modes: Set<ModeId> = new Set()
      if (entry?.['country-pinning']) modes.add('country-pinning')
      if (entry?.['city-guessing']) modes.add('city-guessing')
      if (modes.size > 0) out.set(date, modes)
    }
    return out
  }, [history])

  const { byDate: puzzleByDate } = useDailyPuzzlesContext()

  const cellMemories = useMemo(() => {
    const out = new Map<string, CellMemory>()
    for (const [date, entry] of Object.entries(history.days)) {
      const puzzle = puzzleByDate(date)
      if (!puzzle) continue
      const mem: CellMemory = {}
      const cp = entry?.['country-pinning']
      const cg = entry?.['city-guessing']
      if (cp) {
        const c = countries.find((x) => x.cca3 === puzzle.country.cca3)
        if (c) mem.country = { name: c.name.common, score: cp.score }
      }
      if (cg) {
        const ci = cities.find((x) => x.id === puzzle.city.id)
        if (ci) mem.city = { name: ci.name, score: cg.score }
      }
      if (mem.country || mem.city) out.set(date, mem)
    }
    return out
  }, [history.days, puzzleByDate, countries, cities])

  const totalDays = playedByDate.size

  const onActivate = (date: string) => {
    const cell = cells.find((c) => c.date === date)
    if (!cell) return
    if (cell.status === 'rolled-off') return
    const played = playedByDate.has(date)
    const kind: HistoryCellKind = played ? 'played' : 'unplayed-in-window'
    onCellActivate(date, kind)
  }

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const active = document.activeElement as HTMLElement | null
    if (
      !active ||
      !active.hasAttribute('data-testid') ||
      !active.getAttribute('data-testid')?.startsWith('launcher-cal-')
    )
      return
    const currentDate = active.getAttribute('data-testid')?.slice('launcher-cal-'.length)
    if (!currentDate) return
    const idx = cells.findIndex((c) => c.date === currentDate)
    if (idx < 0) return
    let target: number
    switch (e.key) {
      case 'ArrowLeft':
        target = Math.max(0, idx - 1)
        break
      case 'ArrowRight':
        target = Math.min(cells.length - 1, idx + 1)
        break
      case 'ArrowUp':
        target = Math.max(0, idx - 7)
        break
      case 'ArrowDown':
        target = Math.min(cells.length - 1, idx + 7)
        break
      default:
        return
    }
    e.preventDefault()
    const el = rootRef.current?.querySelector<HTMLButtonElement>(
      `[data-testid="launcher-cal-${cells[target].date}"]`,
    )
    el?.focus()
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Past 30 days"
      data-testid="launcher-history"
      className="mt-4 p-4 rounded-xl bg-sand-50/95 dark:bg-dark-400/95 border border-sand-300/50 dark:border-dark-200/30 shadow-xl"
      style={{ animation: 'launcher-history-in 220ms ease-out both' }}
      onKeyDown={onKey}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-teal dark:text-teal-light">
          Past 30 days
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid="launcher-history-close"
          aria-label="Close history"
          className="w-7 h-7 rounded-full text-sand-600 dark:text-dark-100 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          ×
        </button>
      </div>

      {/* Day-of-week header rows — decorative, hidden from assistive technology */}
      <div
        aria-hidden="true"
        data-testid="dow-row-full"
        className="hidden sm:grid grid-cols-7 gap-1 mb-1 text-[10px] text-sand-500 dark:text-dark-100 text-center"
      >
        {DOW_LABELS_FULL.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div
        aria-hidden="true"
        data-testid="dow-row-mobile"
        className="sm:hidden grid grid-cols-7 gap-1 mb-1 text-[10px] text-sand-500 dark:text-dark-100 text-center"
      >
        {DOW_LABELS.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>

      <div role="grid" aria-label="Calendar" className="grid grid-cols-7 gap-1">
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, rowIdx) => (
          <div key={rowIdx} role="row" className="contents">
            {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((c) => (
              <LauncherCalendarCell
                key={c.date}
                date={c.date}
                status={c.status}
                playedModes={playedByDate.get(c.date) ?? new Set<ModeId>()}
                memory={cellMemories.get(c.date)}
                onActivate={onActivate}
              />
            ))}
          </div>
        ))}
      </div>

      <div
        data-testid="launcher-history-captions"
        className="mt-3 text-center text-[12px] text-sand-600 dark:text-dark-100 tabular-nums"
      >
        Current:{' '}
        <span className="text-teal dark:text-teal-light font-semibold">
          {history.streak.current}
        </span>
        {' · '}
        Longest:{' '}
        <span className="text-teal dark:text-teal-light font-semibold">
          {history.streak.longest}
        </span>
        {' · '}
        Days played:{' '}
        <span className="text-teal dark:text-teal-light font-semibold">{totalDays}</span>
      </div>
    </div>
  )
}
