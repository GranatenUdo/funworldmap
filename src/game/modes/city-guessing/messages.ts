export const MESSAGES = {
  title: 'City Guessing',
  description: 'Click the location of the shown city. 10 rounds per game.',
  prompt: (name: string, country: string) => `Where is ${name}, ${country}?`,
  help: "Click anywhere on the map — ocean counts too.",
  revealCorrect: (name: string) => `Spot on! You found ${name}.`,
  revealNear: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. That was ${name}.`,
  revealFar: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. ${name} was over there.`,
  revealSkipped: (name: string) => `Skipped. ${name} was there.`,
  gameOver: (score: number) => `Game over. ${score} of 1000.`,
  roundStatus: (current: number, total: number, name: string, country: string) =>
    `Round ${current} of ${total}. Where is ${name}, ${country}? Click anywhere on the map.`,
  skipButton: 'Skip round',
}
