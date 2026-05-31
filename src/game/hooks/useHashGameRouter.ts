import { useEffect, useRef, type RefObject } from 'react'
import type { CityLike, CountryLike, GameSession, ModeId } from '../shared/types'
import type { GameSessionApi } from '../shared/GameSessionProvider'
import { parseHash } from '../../lib/hashState'
import { track } from '../../lib/analytics'
import { getMode } from '../modes'
import { isCountryPinning, isModeId } from '../shared/modePredicates'

/**
 * Public options interface for useHashGameRouter. Exported alongside the hook
 * so call sites get typed completion and so future fields can be added without
 * changing the positional contract.
 */
export interface UseHashGameRouterOptions {
  session: GameSession
  pools: { countries: CountryLike[]; cities: CityLike[] }
  start: GameSessionApi['start']
  restart: GameSessionApi['restart']
  endGame: GameSessionApi['endGame']
}

/**
 * Owns the hash router for the game route:
 * - Bootstrap on mount + listen for hashchange.
 * - Defer the start until pools arrive; drain once they do.
 * - Atomic-restart workaround for bug-#32 (game-over to playable route).
 *
 * Returns `statusRef` (a synchronous mirror of `session.status`) so callers
 * can read the current status from hashchange-event-handler closures without
 * stale-closure bugs.
 */
export function useHashGameRouter(opts: UseHashGameRouterOptions): {
  statusRef: RefObject<GameSession['status']>
} {
  const { session, pools, start, restart, endGame } = opts
  const { countries, cities } = pools

  const pendingStartRef = useRef<ModeId | null>(null)
  // Hash → session bootstrap. Read status via ref (hashchange closure-staleness fix).
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  useEffect(() => {
    const check = () => {
      const state = parseHash(window.location.hash)
      // If a game route arrives while the previous session is still in
      // game-over (e.g. user pasted a different mode URL or used browser
      // back/forward), capture that as a one-shot flag so the start branches
      // below dispatch the atomic `restart` action instead of the two-step
      // `endGame + start` sequence. Bug #32: the intermediate `status='idle'`
      // commit between the two dispatches unmounts the HUD and races on slow
      // CI; `restart` collapses both into a single reducer transition.
      const isPlayableRoute = state.kind === 'game' && state.modeId
      const wasGameOver = statusRef.current === 'game-over' && !!isPlayableRoute
      if (wasGameOver) {
        // Mirror the upcoming reducer transition into the local statusRef so
        // the `=== 'idle'` guards below pass on this same check() invocation.
        // The actual dispatch happens via `restart` in the start branches.
        statusRef.current = 'idle'
      }

      if (state.kind === 'game' && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (!isModeId(id)) {
          if (wasGameOver) endGame()
          return
        }
        const hasPool = isCountryPinning(id) ? countries.length > 0 : cities.length > 0
        if (!hasPool) {
          // Pool not yet loaded; defer and let the drain effect pick up once
          // it arrives. If we were transitioning out of game-over, fall back
          // to the legacy two-step path here (endGame so the drain effect's
          // `status==='idle'` guard passes). The atomic restart only matters
          // when the start dispatches synchronously; the deferred path always
          // runs in a separate render tick anyway.
          if (wasGameOver) endGame()
          pendingStartRef.current = id
          return
        }
        const m = getMode(id, pools)
        const firstRound = m.nextRound(new Set())
        if (wasGameOver) {
          restart(id, firstRound, m.maxRounds)
        } else {
          start(id, firstRound, m.maxRounds)
        }
        track('free_started', { mode: id })
      }
      if (state.kind !== 'game' && statusRef.current !== 'idle') {
        endGame()
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, cities.length])

  // Drain deferred start once the relevant pool arrives.
  useEffect(() => {
    const pending = pendingStartRef.current
    if (!pending || session.status !== 'idle') return
    const hasPool = isCountryPinning(pending) ? countries.length > 0 : cities.length > 0
    if (!hasPool) return
    pendingStartRef.current = null
    const m = getMode(pending, pools)
    const firstRound = m.nextRound(new Set())
    start(pending, firstRound, m.maxRounds)
    track('free_started', { mode: pending })
  }, [countries, cities, session.status, pools, start])

  return { statusRef }
}
