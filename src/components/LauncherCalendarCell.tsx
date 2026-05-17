import type { CalendarCellStatus } from '../game/daily/calendarGrid'
import { parseLocalDate } from '../game/daily/dates'
import { formatModeScore } from '../game/shared/formatScore'
import type { ModeId } from '../game/shared/types'
import type { CellMemory } from './LauncherHistoryPanel'

interface Props {
  date: string // YYYY-MM-DD
  status: CalendarCellStatus
  playedModes: ReadonlySet<ModeId>
  memory?: CellMemory
  onActivate: (date: string) => void
}

function dayNumber(date: string): string {
  return String(Number(date.slice(-2))) // strip leading zero for visual tightness
}

function memoryTooltip(memory: CellMemory | undefined): string | undefined {
  if (!memory) return undefined
  const parts: string[] = []
  if (memory.country)
    parts.push(`${memory.country.name} ${formatModeScore(memory.country.score, 'country-pinning')}`)
  if (memory.city)
    parts.push(`${memory.city.name} ${formatModeScore(memory.city.score, 'city-guessing')}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function ariaLabel(date: string, status: CalendarCellStatus, played: ReadonlySet<ModeId>): string {
  const local = parseLocalDate(date)
  const parts: string[] = [
    local.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  ]
  if (status === 'today') parts.push('today')
  if (played.has('country-pinning')) parts.push('played country pinning')
  if (played.has('city-guessing')) parts.push('played city guessing')
  if (status === 'rolled-off') parts.push('not available')
  return parts.join(', ')
}

export function LauncherCalendarCell({ date, status, playedModes, memory, onActivate }: Props) {
  const isInteractive = status === 'in-window' || status === 'today'
  const testId = `launcher-cal-${date}`
  const cpDot = playedModes.has('country-pinning')
  const cgDot = playedModes.has('city-guessing')

  const className = [
    'relative h-10 flex flex-col items-center justify-center rounded-md text-[11px] tabular-nums',
    status === 'rolled-off' && 'text-sand-400 dark:text-dark-200 cursor-default',
    status === 'in-window' &&
      'text-sand-800 dark:text-dark-50 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 cursor-pointer',
    status === 'today' &&
      'text-sand-900 dark:text-dark-50 ring-2 ring-teal dark:ring-teal-light cursor-pointer',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      data-testid={testId}
      data-status={status}
      role="gridcell"
      aria-label={ariaLabel(date, status, playedModes)}
      title={memoryTooltip(memory)}
      tabIndex={isInteractive ? 0 : -1}
      disabled={!isInteractive}
      onClick={isInteractive ? () => onActivate(date) : undefined}
      className={className}
    >
      <span>{status === 'rolled-off' ? '—' : dayNumber(date)}</span>
      {(cpDot || cgDot) && (
        <span className="flex gap-0.5 mt-0.5">
          {cpDot && (
            <span aria-hidden="true" className="w-1 h-1 rounded-full bg-teal dark:bg-teal-light" />
          )}
          {cgDot && <span aria-hidden="true" className="w-1 h-1 rounded-full bg-orange-400" />}
        </span>
      )}
    </button>
  )
}
