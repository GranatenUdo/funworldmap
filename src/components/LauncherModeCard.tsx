import type { ModeId } from '../game/shared/types'
import { isCountryPinning } from '../game/shared/modePredicates'
import { usePersonalBests } from '../game/shared/usePersonalBests'

const ICONS: Record<ModeId, React.ReactNode> = {
  'country-pinning': (
    <svg
      className="w-8 h-8 text-teal dark:text-teal-light"
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
      className="w-8 h-8 text-teal dark:text-teal-light"
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
  'country-pinning': 'Country',
  'city-guessing': 'City',
}

const SUBTITLE: Record<ModeId, string> = {
  'country-pinning': 'Click the right country on the map',
  'city-guessing': 'Pin where the city is',
}

interface Props {
  modeId: ModeId
  onPlay: () => void
}

export function LauncherModeCard({ modeId, onPlay }: Props) {
  const testIdBase = `launcher-card-${modeId}`
  const { best } = usePersonalBests(modeId)
  const hasPlayed = best.gamesPlayed > 0

  return (
    <div
      data-testid={testIdBase}
      className="p-5 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 border border-sand-300/50 dark:border-dark-200/30 shadow-lg transition-all duration-150"
    >
      <div className="flex items-start gap-3 mb-3">
        {ICONS[modeId]}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
          <div className="text-xs text-sand-600 dark:text-dark-100 mt-0.5">{SUBTITLE[modeId]}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onPlay}
        data-testid={`${testIdBase}-play`}
        className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
      >
        Play
      </button>

      <div
        className="text-xs text-sand-600 dark:text-dark-100 mt-2 text-center tabular-nums"
        data-testid={`${testIdBase}-best`}
      >
        {hasPlayed ? (
          <>
            {/* bestScore is the best single-game total (country accrues 100/round over an
                endless run; city sums up to 10 rounds), so show the raw number + "pts" —
                matching GameOverOverlay — NOT formatModeScore, which is a per-round
                "/100"/"/1000" denominator formatter. */}
            Best {best.bestScore.toLocaleString()} pts
            {isCountryPinning(modeId) && <> · {best.bestStreak} streak</>} · {best.gamesPlayed}{' '}
            {best.gamesPlayed === 1 ? 'game' : 'games'}
          </>
        ) : (
          'No games yet — play your first'
        )}
      </div>
    </div>
  )
}
