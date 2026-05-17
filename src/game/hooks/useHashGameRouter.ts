import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { CityLike, CountryLike, GameSession, ModeId, RoundSpec } from '../shared/types'
import type { GameSessionApi } from '../shared/GameSessionProvider'
import type { UseDailyPuzzles } from '../daily/useDailyPuzzles'
import type { UseDailyHistory } from '../daily/useDailyHistory'
import { parseHash } from '../../lib/hashState'
import { track } from '../../lib/analytics'
import { dispatchToast } from '../../lib/toast'
import { readResume, clearResume } from '../daily/resume'
import { toLocalDateString, classifyDate } from '../daily/dates'
import { buildCountryDailyRound, buildCityDailyRound } from '../daily/dailyRound'
import { getMode } from '../modes'
import { isCountryPinning, isModeId } from '../shared/modePredicates'

const DAILY_ATTEMPTS_PER_ROUND = 3

/**
 * Public options interface for useHashGameRouter. Exported alongside the hook
 * so call sites get typed completion and so future fields can be added without
 * changing the positional contract.
 */
export interface UseHashGameRouterOptions {
  session: GameSession
  pools: { countries: CountryLike[]; cities: CityLike[] }
  dailyPuzzles: UseDailyPuzzles
  dailyHistoryGet: UseDailyHistory['get']
  start: GameSessionApi['start']
  resume: GameSessionApi['resume']
  restart: GameSessionApi['restart']
  endGame: GameSessionApi['endGame']
}

/**
 * Owns the hash router for the game/daily routes:
 * - Bootstrap on mount + listen for hashchange.
 * - Defer the start until pools arrive; drain once they do.
 * - Emit deep_link_opened analytics (deduped per hash).
 * - Atomic-restart workaround for bug-#32 (game-over to playable route).
 * - Daily resume from localStorage.
 * - Intermediate-attempt telemetry (daily_attempted).
 *
 * Returns `statusRef` (a synchronous mirror of `session.status`) so callers
 * can read the current status from hashchange-event-handler closures without
 * stale-closure bugs.
 */
export function useHashGameRouter(opts: UseHashGameRouterOptions): {
  statusRef: RefObject<GameSession['status']>
} {
  const { session, pools, dailyPuzzles, dailyHistoryGet, start, resume, restart, endGame } = opts
  const { countries, cities } = pools

  const pendingStartRef = useRef<ModeId | null>(null)
  // Guard the reveal-route deep_link_opened emit against re-fires when deps
  // change (e.g. byDate reference update after index load). Set once per unique
  // hash for the lifetime of this hook's mount. Re-visiting the same /reveal
  // hash within one mount won't re-emit; this matches funnel-counting
  // semantics (deep-link arrival, not view-count).
  const lastRevealEmitHashRef = useRef<string | null>(null)
  // Hash → session bootstrap. Read status via ref (hashchange closure-staleness fix).
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  // Start a daily round, resuming from a saved blob if the date+mode match.
  // Used by both the immediate hash-bootstrap and the deferred-pool drain path.
  // When `atomicRestart` is true, the fresh-start branch dispatches the atomic
  // `restart` reducer action instead of `start`, collapsing what would
  // otherwise be a two-render endGame+start sequence into a single render.
  // (See bug #32: the intermediate `status='idle'` render between dispatches
  // unmounts the HUD and triggers a remount race on slow CI.)
  const startOrResumeDaily = useCallback(
    (id: ModeId, date: string, firstRound: RoundSpec, atomicRestart = false): void => {
      const resumed = readResume()
      if (
        resumed &&
        resumed.date === date &&
        resumed.modeId === id &&
        resumed.attempts.length > 0
      ) {
        // `resume` already replaces state atomically regardless of prior status,
        // so it is safe from any state including game-over.
        resume({
          modeId: id,
          round: firstRound,
          attemptsPerRound: DAILY_ATTEMPTS_PER_ROUND,
          attempts: resumed.attempts,
          dailyDate: date,
        })
        track('deep_link_opened', { dateKind: 'today', outcome: 'resume' })
        return
      }
      if (atomicRestart) {
        restart(id, firstRound, 1, DAILY_ATTEMPTS_PER_ROUND, date)
      } else {
        start(id, firstRound, 1, DAILY_ATTEMPTS_PER_ROUND, date)
      }
      track('deep_link_opened', { dateKind: 'today', outcome: 'start' })
      track('daily_started', { mode: id })
    },
    [start, resume, restart],
  )

  useEffect(() => {
    const check = () => {
      const state = parseHash(window.location.hash)
      // Early reveal-route emit: fires before modeId check since reveal-only routes
      // may have modeId null (e.g. /#daily/<date>/reveal).
      // Deduped by hash string so re-runs triggered by deps changes (e.g. byDate
      // reference update when the daily index loads) don't double-count.
      if (state.kind === 'daily' && state.reveal) {
        const currentHash = window.location.hash
        if (lastRevealEmitHashRef.current !== currentHash) {
          lastRevealEmitHashRef.current = currentHash
          track('deep_link_opened', {
            dateKind: classifyDate(state.date, toLocalDateString(new Date())),
            outcome: 'reveal',
          })
        }
        return
      }
      // If a game/daily route arrives while the previous session is still in
      // game-over (e.g. user pasted a different mode URL or used browser
      // back/forward), capture that as a one-shot flag so the start branches
      // below dispatch the atomic `restart` action instead of the two-step
      // `endGame + start` sequence. Bug #32: the intermediate `status='idle'`
      // commit between the two dispatches unmounts the HUD and races on slow
      // CI; `restart` collapses both into a single reducer transition.
      const isPlayableRoute =
        (state.kind === 'game' && state.modeId) ||
        (state.kind === 'daily' && state.modeId && !state.reveal)
      const wasGameOver = statusRef.current === 'game-over' && !!isPlayableRoute
      if (wasGameOver) {
        clearResume()
        // Mirror the upcoming reducer transition into the local statusRef so
        // the `=== 'idle'` guards below pass on this same check() invocation.
        // The actual dispatch happens via `restart` in the start branches.
        statusRef.current = 'idle'
      }

      // Today-only playable routes: past/future redirect to /reveal or root.
      if (state.kind === 'daily' && state.modeId && !state.reveal && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (!isModeId(id)) {
          if (wasGameOver) endGame()
          return
        }

        const todayStr = toLocalDateString(new Date())

        if (state.date > todayStr) {
          // Future: send to root (handled by launcher when hash clears).
          track('deep_link_opened', { dateKind: 'future', outcome: 'redirect' })
          history.replaceState(null, '', window.location.pathname)
          window.dispatchEvent(new HashChangeEvent('hashchange'))
          return
        }

        const alreadyPlayed = dailyHistoryGet(state.date, id) !== null
        if (state.date < todayStr || alreadyPlayed) {
          // alreadyPlayed implies state.date <= todayStr; classifyDate yields today or past, never future.
          track('deep_link_opened', {
            dateKind: classifyDate(state.date, todayStr),
            outcome: 'redirect',
          })
          window.location.hash = `daily/${state.date}/${id}/reveal`
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
        const puzzle = dailyPuzzles.byDate(state.date)
        if (!puzzle) {
          if (wasGameOver) endGame()
          return
        }
        const firstRound = isCountryPinning(id)
          ? buildCountryDailyRound(puzzle.country.cca3, countries)
          : buildCityDailyRound(puzzle.city.id, cities)
        if (!firstRound) {
          if (wasGameOver) endGame()
          dispatchToast('Daily content unavailable — try again shortly.')
          return
        }
        startOrResumeDaily(id, state.date, firstRound, wasGameOver)
        return
      }
      if (state.kind === 'game' && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (!isModeId(id)) {
          if (wasGameOver) endGame()
          return
        }
        const hasPool = isCountryPinning(id) ? countries.length > 0 : cities.length > 0
        if (!hasPool) {
          // See daily-branch comment above: defer + endGame fallback.
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
      if (state.kind !== 'game' && state.kind !== 'daily' && statusRef.current !== 'idle') {
        endGame()
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, cities.length, dailyPuzzles.byDate, dailyHistoryGet])

  // Drain deferred start once the relevant pool arrives.
  useEffect(() => {
    const pending = pendingStartRef.current
    if (!pending || session.status !== 'idle') return
    const hasPool = isCountryPinning(pending) ? countries.length > 0 : cities.length > 0
    if (!hasPool) return
    // Check what kind of start we need based on current hash:
    const state = parseHash(window.location.hash)
    if (state.kind === 'daily' && state.modeId && state.date === toLocalDateString(new Date())) {
      const puzzle = dailyPuzzles.byDate(state.date)
      if (!puzzle) return
      pendingStartRef.current = null
      const firstRound = isCountryPinning(pending)
        ? buildCountryDailyRound(puzzle.country.cca3, countries)
        : buildCityDailyRound(puzzle.city.id, cities)
      if (!firstRound) {
        dispatchToast('Daily content unavailable — try again shortly.')
        return
      }
      startOrResumeDaily(pending, state.date, firstRound)
      return
    }
    pendingStartRef.current = null
    const m = getMode(pending, pools)
    const firstRound = m.nextRound(new Set())
    start(pending, firstRound, m.maxRounds)
    track('free_started', { mode: pending })
  }, [countries, cities, session.status, pools, start, startOrResumeDaily, dailyPuzzles])

  // Fire daily_attempted per intermediate attempt (only when attemptsPerRound > 1).
  // Tracks per-effect "previous status" so a transition into 'playing' anchors
  // the count to currentAttempts.length — fresh starts begin at 0; resumes
  // begin at the resumed attempts count, so replayed attempts don't fire.
  const lastAttemptCountRef = useRef(0)
  const prevStatusForTelemetryRef = useRef<GameSession['status']>('idle')
  useEffect(() => {
    const enteringPlaying =
      prevStatusForTelemetryRef.current !== 'playing' && session.status === 'playing'
    prevStatusForTelemetryRef.current = session.status
    if (enteringPlaying) {
      lastAttemptCountRef.current = session.currentAttempts.length
    }
    if (
      session.status !== 'playing' &&
      session.status !== 'round-ended' &&
      session.status !== 'game-over'
    ) {
      return
    }
    const prev = lastAttemptCountRef.current
    const cur = session.currentAttempts.length
    if (cur > prev) {
      const a = session.currentAttempts[cur - 1]
      if (session.attemptsPerRound > 1) {
        track('daily_attempted', {
          mode: session.modeId,
          attemptIndex: prev + 1,
          scoreBucket: Math.min(4, Math.floor(a.pointsEarned / 20)),
        })
      }
    }
    lastAttemptCountRef.current = cur
  }, [session.status, session.currentAttempts, session.attemptsPerRound, session.modeId])

  return { statusRef }
}
