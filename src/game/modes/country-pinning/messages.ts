export const MESSAGES = {
  title: 'Country Pinning',
  description: 'Click the country shown at the top. Three wrong countries end the game.',
  prompt: (name: string) => `Pin: ${name}`,
  correct: (points: number, name: string) =>
    `Correct! +${points} points. That was ${name}.`,
  wrong: (points: number, target: string, clicked: string | null) =>
    clicked
      ? `Wrong — that was ${clicked}. +${points} points. The answer was ${target}. −1 life.`
      : `Wrong. +${points} points. The answer was ${target}. −1 life.`,
  gameOver: (score: number, bestStreak: number) =>
    `Game over. Final score ${score}. Longest streak ${bestStreak}.`,
  livesRemaining: (n: number) =>
    n === 1 ? 'One life remaining.' : `${n} lives remaining.`,
}
