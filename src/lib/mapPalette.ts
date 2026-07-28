/** Observatory two-accent palette (E4 — 2026-07-26 UX/visual program spec).
 *
 *  Two accents, ONE MEANING EACH. This file is the canonical owner of the
 *  accent hexes for MAP PAINT (MapLibre paint properties). src/index.css owns
 *  the CHROME accent tokens (DOM/CSS text, icons, focus rings, CTAs) — the
 *  two files intentionally do NOT share every hex 1:1 (see the ICE_DIM note
 *  below); they share the same two MEANINGS (ice / signal) and, where a
 *  component consumes both (the compare badges), the SAME rendering surface
 *  uses the SAME hex (compare-A: mapPalette.SIGNAL === index.css
 *  --color-signal === #ff8a4c).
 *
 *  ICE (#7DD3FC family, tailwind sky) — interactive & wayfinding.
 *    Map roles: dark-theme country fill / hover border / hover extrusion,
 *    the dark-theme selection highlight stack. Restored on compare-exit.
 *
 *  ICE_DEEP (sky-500) — the light-theme member of the ICE family for map
 *    paint (light basemap needs a more saturated accent than the sky-300
 *    anchor to stay legible). Map roles: light-theme country fill / hover
 *    border / hover extrusion, the light-theme selection highlight stack.
 *
 *  ICE_DIM (sky-600) — a mid-ice shade used ONLY for the compare-B highlight
 *    stack (fill/border/glow/extrusion) and the on-map B marker text, in
 *    BOTH themes (compare intentionally ignores theme once it's pinned, same
 *    as SIGNAL for A). NOT the same value as index.css's --color-ice-dim
 *    (#0369a1, sky-700) — that token is a CHROME accent (icon strokes,
 *    borders, CTA-hover backgrounds needing WCAG text/non-text floors) with
 *    no relationship to the compare-B map paint. The panel's
 *    `.compare-badge-b` (index.css) renders plain --color-ice (#7dd3fc), NOT
 *    ICE_DIM — a pre-existing mismatch from the plan's chrome task (T2) that
 *    this task's preflight found and deliberately did not "fix" into
 *    index.css: forcing the badge to ICE_DIM's hex would revert T2's
 *    accessibility fix (dark badge ink on ICE_DIM is only ~3.1:1, sub-AA,
 *    vs ~11:1 on plain ICE) and would require touching the already-passing,
 *    out-of-scope e2e/a11y-contrast.spec.ts. See task-5-report.md for the
 *    full analysis; flagged for the plan's final atomicity task to
 *    adjudicate at the plan level.
 *
 *  SIGNAL (#FF8A4C family) — live game state & loss.
 *    Map role here: the compare-A pin/marker (A is the active side, matching
 *    the panel's A badge exactly — index.css --color-signal === #ff8a4c).
 *    Chrome roles (score, streak, lost hearts) and the wrong-reveal
 *    absorption of the old amber (REVEAL_WRONG below) are owned by this
 *    plan's game-state task, already landed; SIGNAL is reused, not
 *    redefined, by this task.
 *
 *  Teal and coral are retired (E4). Each teal member moved to the same
 *  tailwind step of sky (teal-500→sky-500, teal-300→sky-300,
 *  teal-600→sky-600); coral's selection role moved to ice (selection is
 *  wayfinding), its compare-A role to signal. */
export const ICE = '#7dd3fc' // sky-300 — dark-theme map accent (ex TEAL_LIGHT role)
export const ICE_DEEP = '#0ea5e9' // sky-500 — light-theme map accent (ex TEAL role)
export const ICE_DIM = '#0284c7' // sky-600 — compare-B stack + B marker (ex TEAL_DIM role; map-paint-only, see doc above)

// SIGNAL defined here (ahead of this task, by the game-surface task) because
// REVEAL_WRONG below needed it already. Reused as-is — this task's compare-A
// pin/marker consumes this exact export.
export const SIGNAL = '#ff8a4c'

/** B4 spotlight scrim — the `country-dim` fill laid over every country
 *  EXCEPT the selection (and both compare countries). Near-black slate
 *  (tailwind slate-950) so "lights down" reads the same over satellite
 *  imagery and the vector map, in both themes. Deliberately NEUTRAL — the
 *  scrim is not an accent and stays outside the two-accent system. */
export const SPOTLIGHT_DIM = '#020617'

/** Reveal-feedback palette — useRevealMapEffects colors the target-country
 *  border by outcome. REVEAL_CORRECT stays green: outcome encoding, not an
 *  accent. REVEAL_WRONG already absorbed the old amber into SIGNAL (E4,
 *  landed by the game-surface task) — live game state, not a distinct hue. */
export const REVEAL_CORRECT = '#22c55e' // green-500 — correct-guess border (unchanged)
export const REVEAL_WRONG = SIGNAL // #ff8a4c — wrong-guess border, reveal arc + target marker
