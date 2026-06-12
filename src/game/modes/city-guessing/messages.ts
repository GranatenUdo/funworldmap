export const MESSAGES = {
  revealCorrect: (name: string) => `Spot on! You found ${name}.`,
  revealNear: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. That was ${name}.`,
  revealFar: (distanceKm: number, points: number, name: string) =>
    `${Math.round(distanceKm)} km off. +${points} points. ${name} was over there.`,
  revealSkipped: (name: string) => `Skipped. ${name} was there.`,
  skipButton: 'Skip round',
}
