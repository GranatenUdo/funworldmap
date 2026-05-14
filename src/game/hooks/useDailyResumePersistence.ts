import { useEffect } from 'react'
import type { GameSession } from '../shared/types'
import { writeResume } from '../daily/resume'

/**
 * Persists in-flight daily best-of-N attempts to localStorage so a refresh
 * resumes mid-round. Inert outside daily best-of-N play.
 */
export function useDailyResumePersistence(session: GameSession): void {
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.attemptsPerRound <= 1) return
    if (session.currentAttempts.length === 0) return
    if (session.dailyDate === null) return
    writeResume({
      version: 1,
      date: session.dailyDate,
      modeId: session.modeId,
      attempts: session.currentAttempts,
    })
  }, [session.status, session.attemptsPerRound, session.currentAttempts, session.dailyDate, session.modeId])
}
