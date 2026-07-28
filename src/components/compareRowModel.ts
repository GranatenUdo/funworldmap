import type { CountryData } from '../lib/types'
import { EM_DASH, type CompareFieldDef } from '../lib/compareFields'

/** C2 bar math — width as percent of the pair max, one-decimal precision.
 *  Pure module (no React) so the desktop grid (this plan) and the mobile
 *  single-scroll (C6) share one source of truth. */
export function barWidthPct(value: number, max: number): number {
  return Math.round((value / max) * 1000) / 10
}

/** C2 delta-chip phrasing. Contract (also pinned by unit tests):
 *  - either raw missing → null (no chip)
 *  - ratio = larger/smaller, rendered '1.26' style (en-US, exactly 2
 *    fraction digits, grouped — extreme pairs read '38,859,640.91')
 *  - rendered '1.00' → `Same <noun>` (equality incl. sub-rounding)
 *  - else `<larger-country> <ratio>× <noun>` — the LARGER country is
 *    always the subject, so both column orders yield the same text. */
export function formatDelta(
  noun: string,
  aName: string,
  bName: string,
  aRaw: number | null,
  bRaw: number | null,
): string | null {
  if (aRaw === null || bRaw === null) return null
  const [larger, smaller, name]: [number, number, string] =
    aRaw >= bRaw ? [aRaw, bRaw, aName] : [bRaw, aRaw, bName]
  const ratio = (larger / smaller).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (ratio === '1.00') return `Same ${noun}`
  return `${name} ${ratio}× ${noun}`
}

export interface NumericRowModel {
  kind: 'numeric'
  aText: string
  bText: string
  /** Percent of max(A, B); null → render no bar (missing value). */
  aPct: number | null
  bPct: number | null
  delta: string | null
}

export interface CategoricalRowModel {
  kind: 'both' | 'split'
  aText: string
  bText: string
}

export type CompareRowModel = NumericRowModel | CategoricalRowModel

export function buildRowModel(
  field: CompareFieldDef,
  a: CountryData,
  b: CountryData,
): CompareRowModel {
  // field.format returns string | null (Task 2's contract) — null means
  // "missing", and EM_DASH is the shared placeholder the columns render.
  const aFmt = field.format(a)
  const bFmt = field.format(b)
  const aText = aFmt ?? EM_DASH
  const bText = bFmt ?? EM_DASH

  if (field.numeric) {
    const aRaw = field.raw?.(a) ?? null
    const bRaw = field.raw?.(b) ?? null
    const max = Math.max(aRaw ?? 0, bRaw ?? 0)
    return {
      kind: 'numeric',
      aText,
      bText,
      aPct: aRaw !== null && max > 0 ? barWidthPct(aRaw, max) : null,
      bPct: bRaw !== null && max > 0 ? barWidthPct(bRaw, max) : null,
      delta: formatDelta(field.label.toLowerCase(), a.name.common, b.name.common, aRaw, bRaw),
    }
  }

  // Categorical (C2): identical NON-missing formatted values collapse to one
  // centered "Both:" row; anything else (including two missing values, so
  // it never renders "Both: —") renders side by side.
  const kind = aFmt !== null && aFmt === bFmt ? 'both' : 'split'
  return { kind, aText, bText }
}
