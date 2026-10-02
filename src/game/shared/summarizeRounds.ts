import type { CompletedRound } from './types'

export function summarizeRounds(rounds: CompletedRound[]) {
  const guesses = rounds.filter((r) => r.input.kind !== 'skip')
  const correct = rounds.filter(
    (r) => r.outcome.reveal.kind === 'country' && r.outcome.reveal.correct,
  ).length
  const distances = guesses.flatMap((r) =>
    r.outcome.reveal.distanceKm === null ? [] : [r.outcome.reveal.distanceKm],
  )
  return {
    answered: guesses.length,
    skipped: rounds.length - guesses.length,
    correct,
    accuracy: guesses.length ? Math.round((100 * correct) / guesses.length) : null,
    averageDistance: distances.length
      ? distances.reduce((a, b) => a + b, 0) / distances.length
      : null,
  }
}
