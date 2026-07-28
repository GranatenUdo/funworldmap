import type { CountryData } from '../lib/types'
import type { CompareFieldDef } from '../lib/compareFields'
import { buildRowModel } from './compareRowModel'

/** Plain-div bar (C2). STATIC by design: no width transition, so it renders
 *  identically under prefers-reduced-motion and needs no data-animation-state
 *  contract (CLAUDE.md — only animating components need one). aria-hidden:
 *  the adjacent .text-readout value carries the data for assistive tech.
 *  Colors are the theme-invariant bar tiers from index.css — bg-ice-mid is
 *  the exact compare-B map-fill hex (mapPalette.ICE_MID); bg-signal-mid is
 *  the signal-family tier that clears 3:1 on both panel surfaces (see the
 *  contrast math on the tokens in index.css). */
function Bar({ pct, side, fieldKey }: { pct: number | null; side: 'a' | 'b'; fieldKey: string }) {
  return (
    <div aria-hidden="true" className="h-2 self-center">
      {pct !== null && (
        <div
          data-testid={`compare-bar-${side}-${fieldKey}`}
          className={`h-full rounded-full ${side === 'a' ? 'bg-signal-mid' : 'bg-ice-mid'}`}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  )
}

interface Props {
  field: CompareFieldDef
  a: CountryData
  b: CountryData
  /** C4 seam: exception source marker, rendered inside the label element
      immediately after the label text. */
  marker?: React.ReactNode
}

/** One shared compare row (C2/C3). Pure — no hooks, no context, no layout
 *  assumptions beyond its own width — so the mobile single-scroll task (C6)
 *  reuses it verbatim. */
export function CompareFieldRow({ field, a, b, marker }: Props) {
  const model = buildRowModel(field, a, b)
  const label = (
    <span className="text-label text-ice-accessible dark:text-ice">
      {field.label}
      {marker}
    </span>
  )

  // Numeric checked first: 'numeric' is disjoint from CategoricalRowModel's
  // whole 'both' | 'split' discriminant, so this early return narrows the
  // remainder to CategoricalRowModel cleanly. (Checking 'both' then 'split'
  // as two separate early returns does NOT narrow NumericRowModel back in —
  // TS can't drop a union member via two checks against literals drawn from
  // one sibling member's own multi-literal discriminant; verified against
  // this repo's TypeScript version. Numeric-first avoids relying on that.)
  if (model.kind === 'numeric') {
    return (
      <div data-testid={`compare-row-${field.key}`}>
        <div className="flex items-baseline justify-between gap-2">
          {label}
          {model.delta !== null && (
            <span
              data-testid={`compare-delta-${field.key}`}
              className="text-readout text-[11px] px-1.5 py-0.5 rounded-md bg-sand-200 text-sand-800 dark:bg-dark-300 dark:text-dark-50"
            >
              {model.delta}
            </span>
          )}
        </div>
        {/* One grid so the A and B value cells share the max-content track —
            right-aligned tabular numerals line up digit-for-digit. */}
        <div className="grid grid-cols-[1fr_max-content] items-center gap-x-3 gap-y-1 mt-1">
          <Bar pct={model.aPct} side="a" fieldKey={field.key} />
          <span className="text-readout text-sm text-right text-sand-800 dark:text-dark-50 whitespace-nowrap">
            {model.aText}
          </span>
          <Bar pct={model.bPct} side="b" fieldKey={field.key} />
          <span className="text-readout text-sm text-right text-sand-800 dark:text-dark-50 whitespace-nowrap">
            {model.bText}
          </span>
        </div>
      </div>
    )
  }

  if (model.kind === 'both') {
    return (
      <div data-testid={`compare-row-${field.key}`}>
        {label}
        <div
          data-testid={`compare-both-${field.key}`}
          className="text-readout text-sm text-center text-sand-800 dark:text-dark-50 mt-0.5"
        >
          Both: {model.aText}
        </div>
      </div>
    )
  }

  return (
    <div data-testid={`compare-row-${field.key}`}>
      {label}
      <div className="grid grid-cols-2 gap-x-4 mt-0.5">
        <div className="text-readout text-sm text-sand-800 dark:text-dark-50">{model.aText}</div>
        <div className="text-readout text-sm text-sand-800 dark:text-dark-50">{model.bText}</div>
      </div>
    </div>
  )
}
