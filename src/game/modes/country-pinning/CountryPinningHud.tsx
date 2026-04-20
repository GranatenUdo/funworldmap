import { useMemo } from 'react'
import type { GameSession } from '../../shared/types'
import { MESSAGES } from './messages'
import { registerCountryPinningHud } from './index'

interface Props {
  session: GameSession
}

function CountryPinningHud({ session }: Props) {
  const round = session.currentRound
  const reveal = session.lastOutcome

  const revealLine = useMemo(() => {
    if (session.status !== 'round-ended' || !reveal) return null
    if (reveal.reveal.kind !== 'country') return null
    const r = reveal.reveal
    const targetName = round && round.kind === 'country-pinning' ? round.targetName : r.targetCca3
    if (r.correct) return MESSAGES.correct(reveal.pointsEarned, targetName)
    return MESSAGES.wrong(reveal.pointsEarned, targetName, r.clickedName)
  }, [session.status, reveal, round])

  if (!round || round.kind !== 'country-pinning') return null

  return (
    <div className="flex flex-col items-center gap-2 min-w-[220px]">
      <div className="flex items-center gap-3">
        <img
          src={round.targetFlag}
          alt=""
          className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded shadow-sm shrink-0"
          data-testid="game-prompt-flag"
        />
        <div
          className="text-base sm:text-lg font-semibold text-sand-900 dark:text-dark-50"
          data-testid="game-prompt-name"
        >
          {round.targetName}
        </div>
      </div>
      {revealLine && (
        <div
          className="text-xs sm:text-sm text-sand-700 dark:text-dark-100 text-center"
          data-testid="game-reveal"
          role="status"
        >
          {revealLine}
        </div>
      )}
    </div>
  )
}

registerCountryPinningHud(CountryPinningHud)
export default CountryPinningHud
