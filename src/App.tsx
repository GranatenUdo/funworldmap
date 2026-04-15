import WorldMap from './components/WorldMap'
import { useCountryData } from './hooks/useCountryData'
import { useSelectedCountry } from './hooks/useSelectedCountry'

export default function App() {
  const { byNumeric, byCca3 } = useCountryData()
  const { selected, select, deselect } = useSelectedCountry(byCca3)

  return (
    <div data-selected-country={selected?.ccn3 || undefined}>
      <WorldMap
        byNumeric={byNumeric}
        selected={selected}
        onSelect={select}
        onDeselect={deselect}
      />
    </div>
  )
}
