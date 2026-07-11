import type { CountryData } from '../lib/types'
import { nonSelectableNeighborName } from '../lib/neighborNames'

interface Props {
  code: string
  neighbor: CountryData | undefined
  onSelect: (cca3: string) => void
  /** 'panel' = SingleCountryPanel sizing (with flag); 'compare' = CountryColumn sizing (no flag). */
  size: 'panel' | 'compare'
}

const BUTTON_CLASSES = {
  panel:
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 hover:scale-[1.03] active:scale-100 transition-all duration-150',
  compare:
    'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 transition-colors',
} as const

const SPAN_CLASSES = {
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
export function BorderChip({ code, neighbor, onSelect, size }: Props) {
  if (!neighbor) {
    return <span className={SPAN_CLASSES[size]}>{nonSelectableNeighborName(code) ?? code}</span>
  }
  return (
    <button onClick={() => onSelect(code)} className={BUTTON_CLASSES[size]}>
      {size === 'panel' && (
        <img src={neighbor.flag} alt="" className="w-4 h-3 object-cover rounded-sm shrink-0" />
      )}
      {neighbor.name.common}
    </button>
  )
}
