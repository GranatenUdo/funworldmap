export const MESSAGES = {
  correct: (points: number, name: string) => `Correct! +${points} points. That was ${name}.`,
  // Distance-led: distanceKm is the number the proximity formula decays on, so
  // it leads. The HUD prompt above the reveal line already names the target —
  // no redundant "The answer was X" sentence (2026-07 UX audit item A6).
  wrong: (points: number, target: string, clicked: string | null, distanceKm: number | null) => {
    const tail = `+${points} proximity pts · −1 life.`
    if (!clicked) return `Wrong. ${tail}`
    if (distanceKm === null) return `That was ${clicked}. ${tail}`
    return `That was ${clicked} — ${Math.round(distanceKm).toLocaleString()} km from ${target}. ${tail}`
  },
}
