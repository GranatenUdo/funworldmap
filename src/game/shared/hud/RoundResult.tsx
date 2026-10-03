import { useEffect, useRef } from 'react'
import type { CompletedRound } from '../types'
import type { CountriesFile, CountryData } from '../../../lib/types'

interface Props {
  entry: CompletedRound
  country?: CountryData
  sources: CountriesFile['_sources']
  onContinue?: () => void
  historical?: boolean
}

export function RoundResult({ entry, country, sources, onContinue, historical = false }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { round, input, outcome } = entry
  const correct = outcome.reveal.kind === 'country' && outcome.reveal.correct
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [entry])
  return (
    <section className="round-result" aria-label="Answer reveal" data-testid="round-result">
      <p className="eyebrow">
        {historical
          ? 'Your round in review'
          : correct
            ? 'Nicely spotted!'
            : input.kind === 'skip'
              ? 'A place to discover'
              : 'Now you know'}
      </p>
      <h2 data-testid="game-prompt-name" ref={heading} tabIndex={-1} className="text-2xl font-bold mt-1">
        {round.targetName}
      </h2>
      {round.kind === 'city-guessing' && <p>{round.targetCountryName}</p>}
      <p className="mt-2 text-sm">
        {input.kind === 'skip'
          ? 'You skipped this round.'
          : input.kind === 'country'
            ? `Your guess: ${input.name}`
            : 'Your pin is blue. The answer is orange.'}
      </p>
      <div className="result-metrics">
        <span>
          <strong>+{outcome.pointsEarned}</strong> points
        </span>
        {input.kind !== 'skip' && outcome.reveal.distanceKm !== null && (
          <span>
            <strong>{Math.round(outcome.reveal.distanceKm).toLocaleString()}</strong> km{' '}
            {outcome.reveal.kind === 'country' ? 'between country centers' : 'away'}
          </span>
        )}
        {outcome.livesDelta < 0 && <span>−1 life</span>}
      </div>
      {country && (
        <details
          className="learn-details"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && e.currentTarget.open) {
              e.preventDefault()
              e.stopPropagation()
              e.currentTarget.open = false
              e.currentTarget.querySelector('summary')?.focus()
            }
          }}
        >
          <summary>Learn about {country.name.common}</summary>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt>Capital</dt>
              <dd>{country.capital.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Population</dt>
              <dd>{country.population.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="text-xs mt-3">Country facts; dataset updates are not measurement dates.</p>
          {['capital', 'population'].map((field) => {
            const source = sources[country._fieldSources?.[field] ?? '']
            return source ? (
              <p key={field} className="text-xs mt-2">
                {field}:{' '}
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.name}
                </a>{' '}
                · Dataset updated {source.lastUpdated}
              </p>
            ) : (
              <p key={field} className="text-xs">
                {field}: source unavailable
              </p>
            )
          })}
        </details>
      )}
      {onContinue && (
        <button className="game-primary w-full mt-4" data-testid="round-next" onClick={onContinue}>
          {outcome.endsGame ? 'See results' : 'Next round'} <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  )
}
