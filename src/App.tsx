import WorldMap from './components/WorldMap'
import Header from './components/Header'
import CountryPanel from './components/CountryPanel'
import { useCountryData } from './hooks/useCountryData'
import { useSelectedCountry } from './hooks/useSelectedCountry'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { countries, byNumeric, byCca3, sources } = useCountryData()
  const { selected, select, deselect } = useSelectedCountry(byCca3)
  const isDesktop = useMediaQuery()
  const { theme, resolved, cycle } = useTheme()

  return (
    <div data-selected-country={selected?.ccn3 || undefined}>
      <WorldMap
        byNumeric={byNumeric}
        selected={selected}
        resolvedTheme={resolved}
        onSelect={select}
        onDeselect={deselect}
      />
      <Header
        countries={countries}
        theme={theme}
        onSelect={select}
        onThemeCycle={cycle}
      />
      {selected && (
        <CountryPanel
          country={selected}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={select}
          onClose={deselect}
          byCca3={byCca3}
        />
      )}
    </div>
  )
}
