/** Warm Explorer palette — teal for exploration, coral for selection. */
export const TEAL = '#14b8a6'
export const TEAL_LIGHT = '#5eead4'
export const TEAL_DIM = '#0d9488'
export const CORAL = '#f43f5e'
export const CORAL_LIGHT = '#fb7185'

/** Reveal-feedback palette — used by useRevealMapEffects for the post-guess reveal layer. */
export const REVEAL_CORRECT = '#22c55e' // green-500 — correct guess border + near-distance band (d < 50km)
export const REVEAL_WRONG = '#f59e0b'   // amber-500 — wrong-guess border + mid-distance band (50km ≤ d < 500km)
export const REVEAL_FAR = '#ef4444'     // red-500 — far-distance band (d ≥ 500km)
