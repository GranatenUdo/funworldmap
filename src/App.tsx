import { useRef, useEffect, useState } from 'react'
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
  const [mapReady, setMapReady] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)

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

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const mapEl = document.querySelector('[data-map-loaded]')
      if (mapEl) {
        setMapReady(true)
        observer.disconnect()
      }
    })
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-map-loaded'] })
    if (document.querySelector('[data-map-loaded]')) {
      setMapReady(true)
      observer.disconnect()
    }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!mapReady || selected || hintDismissed) return
    if (sessionStorage.getItem('polworldmap-hint-shown')) return

    const timer = setTimeout(() => {
      setShowHint(true)
      sessionStorage.setItem('polworldmap-hint-shown', '1')
    }, 1500)
    return () => clearTimeout(timer)
  }, [mapReady, selected, hintDismissed])

  useEffect(() => {
    if (selected && showHint) {
      setShowHint(false)
      setHintDismissed(true)
    }
  }, [selected, showHint])

  return (
    <div data-selected-country={selected?.ccn3 || undefined} className="grain">
      {/* Skip links */}
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal focus:text-white focus:rounded-lg"
        onClick={() => document.getElementById('search-input')?.focus()}
      >
        Skip to search
      </button>
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-40 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal focus:text-white focus:rounded-lg"
        onClick={() => document.querySelector<HTMLDivElement>('[role="application"]')?.focus()}
      >
        Skip to map
      </button>

      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* Loading screen */}
      {!mapReady && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-sand-100 dark:bg-dark-500 transition-opacity duration-300">
          <span className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light mb-6">
            polworldmap
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-teal dark:bg-teal-light"
                style={{
                  animation: `loading-dots 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Vignette — gentle focus */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.10) 100%)',
        }}
      />

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

      {/* Empty state hint */}
      {showHint && !selected && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-teal/20 dark:border-teal-light/20 text-teal-light text-sm shadow-lg"
          style={{ animation: 'fade-up 300ms ease-out' }}
        >
          Explore the world
        </div>
      )}

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
