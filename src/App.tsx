import { useRef, useEffect } from 'react'
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
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const prevSelectedRef = useRef<string | null>(null)

  // ARIA live announcements for selection changes
  useEffect(() => {
    const name = selected?.name.common ?? null
    const prevName = prevSelectedRef.current

    if (liveRegionRef.current) {
      if (name && name !== prevName) {
        liveRegionRef.current.textContent = `${name} selected`
      } else if (!name && prevName) {
        liveRegionRef.current.textContent = 'Country panel closed'
      }
    }

    prevSelectedRef.current = name
  }, [selected])

  return (
    <div data-selected-country={selected?.ccn3 || undefined}>
      {/* Skip links */}
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg"
        onClick={() => document.getElementById('search-input')?.focus()}
      >
        Skip to search
      </button>
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-40 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg"
        onClick={() => document.querySelector<HTMLDivElement>('[role="application"]')?.focus()}
      >
        Skip to map
      </button>

      {/* ARIA live region for selection announcements */}
      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />

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
