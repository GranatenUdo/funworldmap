/**
 * Region tints — a data encoding, not an accent.
 *
 * DESIGN.md's Two-Accent Rule reserves ice and signal for interaction and game
 * state; these six hues encode which continent a country belongs to, which is
 * exactly the "justifiable as a data encoding" carve-out. They are deliberately
 * NOT migrated onto the ice/signal ramps
 * (docs/superpowers/plans/2026-07-28-e-foundations.md:547).
 *
 * Two alpha variants exist because the surfaces differ: search-result rows sit
 * on the opaque dropdown (`solid`), the country panel's badge sits on the
 * frosted card and wants the softer 80% fill (`soft`). Both are written as
 * complete literal class strings — Tailwind 4 scans source text, so composing
 * `bg-amber-100` + `/80` at runtime would yield a class it purges.
 *
 * `Antarctic` is the one sanctioned raw-neutral usage in the TS/TSX sources;
 * `chromeNeutrals.test.ts` exempts this file for it.
 */
export interface RegionTint {
  /** Opaque light-mode fill — search-result rows. */
  solid: string
  /** 80% light-mode fill — the country-panel badge on the frosted card. */
  soft: string
}

export const REGION_TINTS: Record<string, RegionTint> = {
  Africa: {
    solid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    soft: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  Americas: {
    solid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    soft: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  Asia: {
    solid: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    soft: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  },
  Europe: {
    solid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    soft: 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  Oceania: {
    solid: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    soft: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  },
  Antarctic: {
    solid: 'bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
    soft: 'bg-slate-100/80 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
  },
}

/** Unknown / missing region. Sand-neutral, no continent claim. */
export const REGION_TINT_FALLBACK = 'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
