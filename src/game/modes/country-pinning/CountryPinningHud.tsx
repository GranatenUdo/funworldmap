import { useEffect, useMemo, useState } from 'react'
import type { GameSession } from '../../shared/types'
import { MESSAGES } from './messages'
import { OCEAN_MISS_EVENT } from './oceanMiss'

/** C-5: information timing, not animation — the line clears after the same
 *  interval under reduced motion. */
const OCEAN_MISS_CLEAR_MS = 1600

interface Props {
  session: GameSession
}

function CountryPinningHud({ session }: Props) {
  const round = session.currentRound
  const reveal = session.lastOutcome

  // C-5 ocean-miss status line. A count, not a boolean, so a rapid second
  // miss restarts the auto-clear window (the timer effect re-runs per miss).
  const [oceanMissCount, setOceanMissCount] = useState(0)

  useEffect(() => {
    const onMiss = () => setOceanMissCount((n) => n + 1)
    window.addEventListener(OCEAN_MISS_EVENT, onMiss)
    return () => window.removeEventListener(OCEAN_MISS_EVENT, onMiss)
  }, [])

  useEffect(() => {
    if (oceanMissCount === 0) return
    const timer = window.setTimeout(() => setOceanMissCount(0), OCEAN_MISS_CLEAR_MS)
    return () => window.clearTimeout(timer)
  }, [oceanMissCount])

  // Never interfere with the round-ended reveal line: the assist handler only
  // fires while playing, and any residue is dropped the moment the round ends
  // (otherwise a leftover count inside the 1600 ms window could resurface on
  // the next round). The render gate below covers the one commit this effect
  // lags by.
  useEffect(() => {
    if (session.status !== 'playing') setOceanMissCount(0)
  }, [session.status])

  const revealLine = useMemo(() => {
    if (session.status !== 'round-ended' || !reveal) return null
    if (reveal.reveal.kind !== 'country') return null
    const r = reveal.reveal
    const targetName = round && round.kind === 'country-pinning' ? round.targetName : r.targetCca3
    if (r.correct) return MESSAGES.correct(reveal.pointsEarned, targetName)
    return MESSAGES.wrong(reveal.pointsEarned, targetName, r.clickedName, r.distanceKm)
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
      {oceanMissCount > 0 && session.status === 'playing' && (
        <div
          className="text-xs text-sand-600 dark:text-dark-100 text-center"
          data-testid="game-ocean-miss"
          role="status"
        >
          {MESSAGES.oceanMiss}
        </div>
      )}
    </div>
  )
}

export default CountryPinningHud
