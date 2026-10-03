import { useEffect, useRef, type RefObject } from 'react'
import type { CityLike, CountryLike, GameSession } from '../shared/types'
import type { GameSessionApi } from '../shared/GameSessionProvider'
import { parseHash } from '../../lib/hashState'
import { track } from '../../lib/analytics'
import { getMode } from '../modes'
import { isCountryPinning, isModeId } from '../shared/modePredicates'

export interface UseHashGameRouterOptions {
  session: GameSession
  pools: { countries: CountryLike[]; cities: CityLike[] }
  ready: boolean
  start: GameSessionApi['start']
  restart: GameSessionApi['restart']
  endGame: GameSessionApi['endGame']
}

export function useHashGameRouter(opts: UseHashGameRouterOptions): {
  statusRef: RefObject<GameSession['status']>
} {
  const latest = useRef(opts)
  latest.current = opts
  const previousHash = useRef(window.location.hash)
  const navigationIntent = useRef<string | null>(null)
  const activeMode = useRef(opts.session.modeId)
  activeMode.current = opts.session.modeId
  const statusRef = useRef(opts.session.status)
  statusRef.current = opts.session.status
  useEffect(() => {
    const check = () => {
      const { pools, ready, start, restart, endGame } = latest.current
      const hash = window.location.hash
      if (hash !== previousHash.current) navigationIntent.current = hash
      previousHash.current = hash
      const route = parseHash(hash)
      if (route.kind !== 'game' || !isModeId(route.modeId)) {
        navigationIntent.current = null
        if (statusRef.current !== 'idle') {
          statusRef.current = 'idle'
          endGame()
        }
        return
      }
      if (!ready) return
      const id = route.modeId
      if (!(isCountryPinning(id) ? pools.countries.length : pools.cities.length)) return
      if (
        statusRef.current !== 'idle' &&
        activeMode.current === id &&
        navigationIntent.current === null
      )
        return
      const mode = getMode(id, pools)
      const firstRound = mode.nextRound(new Set())
      const launch = statusRef.current === 'idle' ? start : restart
      statusRef.current = 'playing'
      activeMode.current = id
      navigationIntent.current = null
      launch(id, firstRound, mode.maxRounds)
      track('free_started', { mode: id })
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [opts.ready, opts.pools.countries.length, opts.pools.cities.length])
  return { statusRef }
}
