import type { CountryData, CountriesFile } from '../lib/types'
import { SingleCountryPanel } from './SingleCountryPanel'
import { CompareCountryPanel } from './CompareCountryPanel'
import type { CompareColumn } from '../lib/compareMapClick'

interface Props {
  country: CountryData
  compareWith: CountryData | null
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  onCancelCompare: () => void
  onExitCompare: () => void
  onCompareColumnSelect: (column: CompareColumn, cca3: string) => void
  byCca3: Map<string, CountryData>
  inGameRound?: boolean
}

export default function CountryPanel({
  country,
  compareWith,
  comparePickingMode,
  sources,
  isDesktop,
  onSelect,
  onClose,
  onEnterCompare,
  onCancelCompare,
  onExitCompare,
  onCompareColumnSelect,
  byCca3,
  inGameRound,
}: Props) {
  if (compareWith) {
    return (
      <CompareCountryPanel
        country={country}
        compareWith={compareWith}
        isDesktop={isDesktop}
        onCompareColumnSelect={onCompareColumnSelect}
        onClose={onClose}
        onExitCompare={onExitCompare}
        byCca3={byCca3}
        sources={sources}
      />
    )
  }

  return (
    <SingleCountryPanel
      country={country}
      comparePickingMode={comparePickingMode}
      sources={sources}
      isDesktop={isDesktop}
      onSelect={onSelect}
      onClose={onClose}
      onEnterCompare={onEnterCompare}
      onCancelCompare={onCancelCompare}
      byCca3={byCca3}
      inGameRound={inGameRound}
    />
  )
}
