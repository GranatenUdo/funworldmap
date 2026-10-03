import type { CountryData } from '../lib/types'
import { nonSelectableNeighborName } from '../lib/neighborNames'
import { INERT_CHIP_CLASSES } from './chipStyles'

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

// Calibrated fittings (2026-08-03): hairline sand border, 8px radius,
// transparent at rest with an ice tint on hover — no scale pop.
const BUTTON_CLASSES = {
  panel:
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-sand-300/65 dark:border-dark-200/70 text-ice-accessible dark:text-ice hover:bg-ice-dim/8 dark:hover:bg-ice/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50',
  compare:
    'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-lg border border-sand-300/65 dark:border-dark-200/70 text-ice-accessible dark:text-ice hover:bg-ice-dim/8 dark:hover:bg-ice/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50',
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
