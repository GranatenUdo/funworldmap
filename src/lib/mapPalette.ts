/** Warm Explorer palette — teal for exploration, coral for selection. */
export const TEAL = '#14b8a6'
export const TEAL_LIGHT = '#5eead4'
export const TEAL_DIM = '#0d9488'
export const CORAL = '#f43f5e'
export const CORAL_LIGHT = '#fb7185'

/** B4 spotlight scrim — the `country-dim` fill laid over every country
 *  EXCEPT the selection (and both compare countries). Near-black slate
 *  (tailwind slate-950) so "lights down" reads the same over satellite
 *  imagery and the vector map, in both themes. */
export const SPOTLIGHT_DIM = '#020617'

/** Reveal-feedback palette — useRevealMapEffects colors the target-country
 *  border by outcome; the reveal arc and target marker are amber. */
export const REVEAL_CORRECT = '#22c55e' // green-500 — correct-guess border
export const REVEAL_WRONG = '#f59e0b' // amber-500 — wrong-guess border, reveal arc + target marker
