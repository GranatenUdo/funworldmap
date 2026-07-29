import type { CountryData } from '../lib/types'
import { nonSelectableNeighborName } from '../lib/neighborNames'

interface Props {
  code: string
  neighbor: CountryData | undefined
  onSelect: (cca3: string) => void
  /** 'panel' = SingleCountryPanel sizing (with flag); 'compare' = CountryColumn sizing (no flag). */
  size: 'panel' | 'compare'
  /** Optional suffix rendered after the name as " · {detail}" — used by the
   *  panel's similar-population suggestion (D3). Inherits the chip's text
   *  color unchanged (no muting/opacity), so no new contrast pair. */
  detail?: string
}

const BUTTON_CLASSES = {
  panel:
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border border-ice-dim/20 dark:border-ice/15 bg-ice-dim/5 dark:bg-ice/5 text-ice-accessible dark:text-ice hover:bg-ice-dim/12 dark:hover:bg-ice/12 hover:scale-[1.03] active:scale-100 transition-all duration-150',
  compare:
    'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-ice-dim/20 dark:border-ice/15 bg-ice-dim/5 dark:bg-ice/5 text-ice-accessible dark:text-ice hover:bg-ice-dim/12 dark:hover:bg-ice/12 transition-colors',
} as const

/** Inert (non-interactive) chip styling — unmatched border codes here, and
 *  reused by SingleCountryPanel's landlocked/coastal fact chip (D3).
 *  Contrast (both AA): light sand-600 #6b6459 on sand-200 #f0ebe3 = 4.93:1;
 *  dark dark-100 #94a3b8 on dark-300 #1e2430 = 6.07:1. */
export const INERT_CHIP_CLASSES = {
  panel:
    'px-2.5 py-1.5 text-xs rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
  compare:
    'px-2 py-0.5 text-[11px] rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
} as const

/** A neighbouring-country chip. Codes with no canonical match (e.g. ESH, HKG,
 *  UNK, GUF, MAC, GIB) render INERT, showing the resolved name via
 *  nonSelectableNeighborName (falling back to the raw code) — selecting them
 *  would write an unresolvable hash, which clears the selection and closes
 *  the panel. */
export function BorderChip({ code, neighbor, onSelect, size, detail }: Props) {
  if (!neighbor) {
    return (
      <span className={INERT_CHIP_CLASSES[size]}>{nonSelectableNeighborName(code) ?? code}</span>
    )
  }
  return (
    <button onClick={() => onSelect(code)} className={BUTTON_CLASSES[size]}>
      {size === 'panel' && (
        <img src={neighbor.flag} alt="" className="w-4 h-3 object-cover rounded-sm shrink-0" />
      )}
      {neighbor.name.common}
      {/* Plain text, not a nested <span>: the accessible-name-from-content
          algorithm trims each child node's contribution before
          concatenating, so a <span>'s own leading space gets stripped and
          the name loses the "Name · detail" separator entirely. */}
      {detail !== undefined && ` · ${detail}`}
    </button>
  )
}
