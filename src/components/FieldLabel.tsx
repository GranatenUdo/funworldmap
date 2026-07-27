import type { CountryData, CountriesFile } from '../lib/types'
import SourceTooltip from './SourceTooltip'

interface Props {
  label: string
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
  className?: string
}

const DEFAULT_CLASSNAME =
  'text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-0.5 flex items-center gap-1'

/** Note: `className`, when provided, fully replaces DEFAULT_CLASSNAME (no
 *  merge). Pass the full Tailwind string for the variant you want. */
export function FieldLabel({ label, field, country, sources, className }: Props) {
  return (
    <div className={className ?? DEFAULT_CLASSNAME} data-field={field}>
      {label}
      <SourceTooltip field={field} fieldSources={country._fieldSources} sources={sources} />
    </div>
  )
}
