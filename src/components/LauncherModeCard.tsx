import type { ModeId } from '../game/shared/types'
import { usePersonalBests } from '../game/shared/usePersonalBests'
import { formatPersonalBest } from '../game/shared/formatPersonalBest'

const ICONS: Record<ModeId, React.ReactNode> = {
  'country-pinning': (
    <svg
      className="w-8 h-8 text-ice-dim dark:text-ice"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z"
      />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  'city-guessing': (
    <svg
      className="w-8 h-8 text-ice-dim dark:text-ice"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V10l4-2 4 2 4-3 4 2v12H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6M12 21v-6M16 21v-6" />
    </svg>
  ),
}

const TITLE: Record<ModeId, string> = {
  'country-pinning': 'Find countries',
  'city-guessing': 'Locate cities',
}

const SUBTITLE: Record<ModeId, string> = {
  'country-pinning': 'Three lives. One world. How long can you go?',
  'city-guessing': 'Ten cities. Drop a pin as close as you can.',
}

interface Props {
  modeId: ModeId
  ready?: boolean
  preferred?: boolean
  onPlay: () => void
}

export function LauncherModeCard({ modeId, onPlay, ready = true, preferred = false }: Props) {
  const testIdBase = `launcher-card-${modeId}`
  const { best } = usePersonalBests(modeId)
  const hasPlayed = best.gamesPlayed > 0
  const gamesCount = `${best.gamesPlayed} ${best.gamesPlayed === 1 ? 'game' : 'games'}`
  // "Best 0 pts" carries no information — when no scoring run exists yet, show
  // only how many games were played (A16).
  const bestsLine = !hasPlayed
    ? 'No games yet — play your first'
    : best.bestScore === 0
      ? `${gamesCount} played`
      : `Best ${formatPersonalBest(best, modeId)} · ${gamesCount}`

  return (
    <div
      data-testid={testIdBase}
      className="mode-card p-6 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 border border-sand-300/50 dark:border-dark-200/30 shadow-lg transition-all duration-150"
    >
      <div className="flex items-start gap-3 mb-3">
        {ICONS[modeId]}
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
          <div className="text-base text-sand-600 dark:text-dark-100 mt-2">{SUBTITLE[modeId]}</div>
        </div>
      </div>

      <p className="text-sm text-sand-600 dark:text-dark-100 mb-5">
        {modeId === 'country-pinning'
          ? '100 points for a correct answer. Wrong guesses cost a life but earn proximity points.'
          : 'Up to 100 points per city. The closer your pin, the higher your score.'}
      </p>
      <button
        data-autofocus={preferred || undefined}
        disabled={!ready}
        type="button"
        onClick={onPlay}
        data-testid={`${testIdBase}-play`}
        className="w-full min-h-12 px-4 py-3 disabled:opacity-50 disabled:cursor-wait rounded-xl bg-ice-accessible text-white font-semibold hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60"
      >
        Play
      </button>

      <div
        className="text-xs text-sand-600 dark:text-dark-100 mt-2 text-center tabular-nums"
        data-testid={`${testIdBase}-best`}
      >
        {bestsLine}
      </div>
    </div>
  )
}
