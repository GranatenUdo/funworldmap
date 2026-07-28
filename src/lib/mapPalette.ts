/** Observatory two-accent palette (E4) — each accent has exactly ONE meaning:
 *
 *  ICE (#7dd3fc family) — interactive & wayfinding: links, focus rings,
 *  search, basemap toggle, map selection border/glow, compare-B.
 *
 *  SIGNAL (#ff8a4c family) — live game state & loss: score/streak feedback,
 *  lost hearts, the wrong-guess reveal (absorbing the retired amber role),
 *  compare-A.
 *
 *  Region badges and A5's exception badges are data encodings, not accents —
 *  they deliberately live outside this two-accent system. */

/* RETIRING (E4): TEAL/TEAL_LIGHT/TEAL_DIM/CORAL/CORAL_LIGHT survive only
   until this tranche's map-paint task migrates their remaining consumers
   (mapLayers.ts, useMapTheme.ts, useCompareViewHighlight.ts,
   useRevealMapEffects.ts's guess-marker color) and adds the full
   ICE_DEEP/ICE_DIM family. Do not add new consumers. */
export const TEAL = '#14b8a6'
export const TEAL_LIGHT = '#5eead4'
export const TEAL_DIM = '#0d9488'
export const CORAL = '#f43f5e'
export const CORAL_LIGHT = '#fb7185'

// SIGNAL defined here (ahead of the map-paint task) because REVEAL_WRONG
// below needs it now. The map-paint task's own canonical-owner preflight
// reuses this exact export rather than redefining it.
export const SIGNAL = '#ff8a4c'

/** B4 spotlight scrim — the `country-dim` fill laid over every country
 *  EXCEPT the selection (and both compare countries). Near-black slate
 *  (tailwind slate-950) so "lights down" reads the same over satellite
 *  imagery and the vector map, in both themes. */
export const SPOTLIGHT_DIM = '#020617'

/** Reveal-feedback palette — useRevealMapEffects colors the target-country
 *  border by outcome. REVEAL_CORRECT stays green: outcome encoding, not an
 *  accent. The wrong-guess reveal is SIGNAL — live game state (E4). */
export const REVEAL_CORRECT = '#22c55e' // green-500 — correct-guess border (unchanged)
export const REVEAL_WRONG = SIGNAL // #ff8a4c — wrong-guess border, reveal arc + target marker
