import { useEffect, useRef } from 'react'
import { useDailyHistory } from '../game/daily/useDailyHistory'
import type { CityLike, CountryLike, ModeId } from '../game/shared/types'
import { isCountryPinning, isCityGuessing } from '../game/shared/modePredicates'
import { DailyShareBlock } from './DailyShareBlock'
import type { ShareResults } from '../game/daily/shareText'
import { installFocusTrap } from '../lib/focusTrap'
import type { DailyPuzzleRef } from '../game/daily/types'

interface Props {
  date: string
  modeId: ModeId | null
  puzzle: DailyPuzzleRef | null
  today: string
  countries: CountryLike[]
  cities: CityLike[]
  onClose: () => void
}

function scoreDot(score: number): { emoji: string; label: string } {
  if (score >= 90) return { emoji: '🟩', label: `${score}/100` }
  if (score >= 70) return { emoji: '🟨', label: `${score}/100` }
  if (score >= 50) return { emoji: '🟧', label: `${score}/100` }
  if (score >= 30) return { emoji: '🟥', label: `${score}/100` }
  return { emoji: '⬛', label: `${score}/100` }
}

export function DailyRevealOverlay({ date, modeId, puzzle, today, countries, cities, onClose }: Props) {
  const { get, streak } = useDailyHistory()

  const rootRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const root = rootRef.current
    if (!root) return
    const close = root.querySelector<HTMLButtonElement>('[data-testid="daily-reveal-close"]')
    close?.focus()
    const cleanup = installFocusTrap(root)
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => {
      cleanup()
      window.removeEventListener('keydown', onEsc)
      const prev = previousFocusRef.current
      if (prev && document.body.contains(prev) && typeof prev.focus === 'function') {
        prev.focus()
      }
    }
  }, [onClose])

  const showCountry = modeId === null || isCountryPinning(modeId)
  const showCity = modeId === null || isCityGuessing(modeId)

  const country = puzzle ? countries.find((c) => c.cca3 === puzzle.country.cca3) ?? null : null
  const city = puzzle ? cities.find((c) => c.id === puzzle.city.id) ?? null : null

  const cpRecord = get(date, 'country-pinning')
  const cgRecord = get(date, 'city-guessing')

  const isToday = date === today
  const hideCountryHeadline = isToday && !cpRecord
  const hideCityHeadline = isToday && !cgRecord

  const shareResults: ShareResults = {
    'country-pinning': get(date, 'country-pinning'),
    'city-guessing': get(date, 'city-guessing'),
  }
  const anyPlayed = !!shareResults['country-pinning'] || !!shareResults['city-guessing']

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Daily reveal for ${date}`}
      data-testid="daily-reveal"
      className="fixed inset-0 z-[220] flex items-center justify-center p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/65 dark:bg-[rgba(11,15,26,0.78)] backdrop-blur-[4px]"
      />
      <div className="relative w-full max-w-xl mx-auto bg-sand-50 dark:bg-dark-400 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-teal-accessible dark:text-teal-light">Daily reveal</div>
            <div className="text-lg font-bold text-sand-900 dark:text-dark-50 tabular-nums">{date}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="daily-reveal-close"
            aria-label="Close reveal"
            className="w-8 h-8 rounded-full text-sand-600 dark:text-dark-100 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
          >
            ×
          </button>
        </div>

        {!puzzle && (
          <p data-testid="daily-reveal-unavailable" className="text-sand-600 dark:text-dark-100">
            That daily is no longer available.
          </p>
        )}

        {puzzle && showCountry && country && (
          <div data-testid="daily-reveal-country" className="mb-4 pb-4 border-b border-sand-200 dark:border-dark-300">
            <div className="text-[11px] uppercase tracking-widest text-teal-accessible dark:text-teal-light mb-1">Country</div>
            {hideCountryHeadline ? (
              <div className="text-sand-700 dark:text-dark-100">Finish today's daily first.</div>
            ) : (
              <>
                <div className="text-xl font-bold text-sand-900 dark:text-dark-50">{country.name.common}</div>
                {cpRecord ? (
                  <div className="mt-2 text-sm text-sand-700 dark:text-dark-100">
                    Your attempts:{' '}
                    <span className="tabular-nums">
                      {cpRecord.attempts.map((a, i) => (
                        <span key={i} aria-label={scoreDot(a.pointsEarned).label}>{scoreDot(a.pointsEarned).emoji}</span>
                      ))}
                    </span>{' '}
                    <span className="font-semibold">{cpRecord.score}/100</span>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-sand-600 dark:text-dark-100">Not played.</div>
                )}
              </>
            )}
          </div>
        )}

        {puzzle && showCity && city && (
          <div data-testid="daily-reveal-city">
            <div className="text-[11px] uppercase tracking-widest text-teal-accessible dark:text-teal-light mb-1">City</div>
            {hideCityHeadline ? (
              <div className="text-sand-700 dark:text-dark-100">Finish today's daily first.</div>
            ) : (
              <>
                <div className="text-xl font-bold text-sand-900 dark:text-dark-50">{city.name}, {city.countryName}</div>
                {cgRecord ? (
                  <div className="mt-2 text-sm text-sand-700 dark:text-dark-100">
                    Your attempts:{' '}
                    <span className="tabular-nums">
                      {cgRecord.attempts.map((a, i) => (
                        <span key={i} aria-label={scoreDot(a.pointsEarned).label}>{scoreDot(a.pointsEarned).emoji}</span>
                      ))}
                    </span>{' '}
                    <span className="font-semibold">{cgRecord.score}/100</span>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-sand-600 dark:text-dark-100">Not played.</div>
                )}
              </>
            )}
          </div>
        )}
        {anyPlayed && (
          <DailyShareBlock
            date={date}
            results={shareResults}
            streak={streak}
            originUrl={window.location.origin}
          />
        )}
      </div>
    </div>
  )
}
