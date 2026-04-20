import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import CountryPanel from './components/CountryPanel'
import Toast from './components/Toast'
import { useCountryData } from './hooks/useCountryData'
import { useCityData } from './hooks/useCityData'
import { useSelectedCountry } from './hooks/useSelectedCountry'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import { MapProvider, useMap } from './hooks/useMap'
import { GameSessionProvider, useGameSessionContext } from './game/shared/GameSessionProvider'
import { GameController } from './game/GameController'
import type { CityLike, CountryLike } from './game/shared/types'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from './lib/mapStyles'
import { centroidFromLatLng } from './game/shared/distance'
import type { CountryData, CountriesFile } from './lib/types'

export default function App() {
  const { countries, byNumeric, byCca3, sources } = useCountryData()
  const { cities } = useCityData()

  const pool = useMemo<CountryLike[]>(
    () =>
      countries
        .filter((c: CountryData) => c.independent === true)
        .map((c: CountryData) => ({
          cca3: c.cca3,
          name: { common: c.name.common },
          flag: c.flag,
          latlng: c.latlng,
          independent: true,
        })),
    [countries],
  )
  const poolFull = useMemo<CountryData[]>(
    () => countries.filter((c: CountryData) => c.independent === true),
    [countries],
  )
  const poolByCca3 = useMemo(() => new Map(pool.map((c) => [c.cca3, c])), [pool])
  const pools = useMemo(() => ({ countries: pool, cities }), [pool, cities])

  return (
    <MapProvider>
      <GameSessionProvider pools={pools}>
        <AppInner
          countries={countries}
          countriesFull={poolFull}
          pool={pool}
          byNumeric={byNumeric}
          byCca3={byCca3}
          poolByCca3={poolByCca3}
          sources={sources}
          cities={cities}
        />
      </GameSessionProvider>
    </MapProvider>
  )
}

interface AppInnerProps {
  countries: CountryData[]
  countriesFull: CountryData[]
  pool: CountryLike[]
  byNumeric: Map<string, CountryData>
  byCca3: Map<string, CountryData>
  poolByCca3: Map<string, CountryLike>
  sources: CountriesFile['_sources']
  cities: CityLike[]
}

function AppInner({
  countries,
  countriesFull,
  pool,
  byNumeric,
  byCca3,
  poolByCca3,
  sources,
  cities,
}: AppInnerProps) {
  const { selected, compareWith, select, compareSelect, clearCompare, deselect } = useSelectedCountry(byCca3)
  const isDesktop = useMediaQuery()
  const { theme, resolved, cycle } = useTheme()
  const { mapRef } = useMap()
  const { session, submitGuessInput } = useGameSessionContext()
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const prevSelectedRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)
  const [satellite, setSatellite] = useState(true)
  const toggleSatellite = useCallback(() => setSatellite((s) => !s), [])
  const [comparePickingMode, setComparePickingMode] = useState(false)

  const enterComparePicking = useCallback(() => {
    if (selected) setComparePickingMode(true)
  }, [selected])
  const exitCompare = useCallback(() => {
    setComparePickingMode(false)
    clearCompare()
  }, [clearCompare])

  const gameActive = session.status !== 'idle'

  const onMapSelect = useCallback(
    (cca3: string) => {
      if (gameActive) {
        if (session.modeId === 'country-pinning') {
          const country = poolByCca3.get(cca3.toUpperCase())
          if (!country) {
            window.dispatchEvent(new CustomEvent('funworldmap:toast', {
              detail: "That territory isn't in the country pool.",
            }))
            return
          }
          submitGuessInput({
            kind: 'country',
            cca3: cca3.toUpperCase(),
            name: country.name.common,
            centroid: centroidFromLatLng(country.latlng),
          })
        }
        // City mode: GameController handles clicks via its own map.on('click'); no-op here.
        return
      }
      if (comparePickingMode) {
        if (selected && cca3.toUpperCase() !== selected.cca3) {
          compareSelect(cca3)
          setComparePickingMode(false)
        }
      } else {
        select(cca3)
      }
    },
    [gameActive, session.modeId, poolByCca3, submitGuessInput, comparePickingMode, selected, select, compareSelect],
  )

  useEffect(() => {
    if (session.status !== 'playing' || session.roundIndex !== 0) return
    if (selected) deselect()
    setComparePickingMode(false)
    mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 700 })
    // Fires on the very first round of each new game — covers idle→playing
    // and game-over→Play-again transitions without needing a prev-status ref.
  }, [session.status, session.roundIndex, selected, deselect, mapRef])

  useEffect(() => {
    const name = selected?.name.common ?? null
    const prevName = prevSelectedRef.current
    if (liveRegionRef.current) {
      if (name && name !== prevName) liveRegionRef.current.textContent = `${name} selected`
      else if (!name && prevName) liveRegionRef.current.textContent = 'Country panel closed'
    }
    prevSelectedRef.current = name
  }, [selected])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (liveRegionRef.current && detail) liveRegionRef.current.textContent = detail
    }
    window.addEventListener('funworldmap:announce', handler)
    return () => window.removeEventListener('funworldmap:announce', handler)
  }, [])

  const focusReturnRef = useRef<HTMLElement | null>(null)
  const panelWasOpenRef = useRef(false)
  useEffect(() => {
    if (selected && !panelWasOpenRef.current) {
      panelWasOpenRef.current = true
      const active = document.activeElement as HTMLElement | null
      focusReturnRef.current = active && active !== document.body ? active : null
      const timer = window.setTimeout(() => {
        const close = document.querySelector<HTMLButtonElement>('[data-testid="panel-close"]')
        close?.focus({ preventScroll: true })
      }, 300)
      return () => window.clearTimeout(timer)
    } else if (!selected && panelWasOpenRef.current) {
      panelWasOpenRef.current = false
      const target = focusReturnRef.current
      focusReturnRef.current = null
      if (target && document.body.contains(target) && typeof target.focus === 'function') {
        target.focus({ preventScroll: true })
      } else {
        document.getElementById('search-input')?.focus({ preventScroll: true })
      }
    }
  }, [selected])

  useEffect(() => {
    const check = () => document.querySelector('[data-map-loaded], [data-map-error]')
    const observer = new MutationObserver(() => {
      if (check()) { setMapReady(true); observer.disconnect() }
    })
    observer.observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['data-map-loaded', 'data-map-error'],
    })
    if (check()) { setMapReady(true); observer.disconnect() }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!mapReady || selected || hintDismissed || gameActive) return
    if (sessionStorage.getItem('funworldmap-hint-shown')) return
    const timer = setTimeout(() => {
      setShowHint(true)
      sessionStorage.setItem('funworldmap-hint-shown', '1')
    }, 1500)
    return () => clearTimeout(timer)
  }, [mapReady, selected, hintDismissed, gameActive])

  useEffect(() => {
    if ((selected || gameActive) && showHint) {
      setShowHint(false)
      setHintDismissed(true)
    }
  }, [selected, gameActive, showHint])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameActive) return
        if (compareWith || comparePickingMode) { exitCompare(); return }
        if (selected) { deselect(); return }
        const searchInput = document.getElementById('search-input') as HTMLInputElement | null
        if (searchInput && searchInput.value) {
          searchInput.value = ''
          searchInput.dispatchEvent(new Event('input', { bubbles: true }))
          return
        }
        return
      }
      const target = e.target as HTMLElement | null
      if (target && target.matches('input, textarea, [contenteditable]')) return
      if (e.key === '/') {
        e.preventDefault()
        if (!gameActive) document.getElementById('search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, compareWith, comparePickingMode, exitCompare, deselect, gameActive])

  return (
    <div
      data-selected-country={selected?.ccn3 || undefined}
      data-game-mode={gameActive ? session.modeId : undefined}
      className="grain"
    >
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal focus:text-white focus:rounded-lg"
        onClick={() => document.getElementById('search-input')?.focus()}
      >Skip to search</button>
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-40 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal focus:text-white focus:rounded-lg"
        onClick={() => document.querySelector<HTMLDivElement>('[role="application"]')?.focus()}
      >Skip to map</button>

      <div ref={liveRegionRef} data-testid="announce-region" aria-live="polite" aria-atomic="true" className="sr-only" />

      {!mapReady && (
        <div aria-hidden="true" className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-sand-100 dark:bg-dark-500 transition-opacity duration-300 pointer-events-none">
          <span className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light mb-6">funworldmap</span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-teal dark:bg-teal-light"
                style={{ animation: `loading-dots 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
        </div>
      )}

      <Toast />

      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.10) 100%)' }} />

      <main>
        <WorldMap
          byNumeric={byNumeric}
          selected={selected}
          compareWith={compareWith}
          comparePickingMode={comparePickingMode}
          resolvedTheme={resolved}
          satellite={satellite}
          onSelect={onMapSelect}
          onDeselect={deselect}
        />
      </main>
      <Header
        countries={countries}
        theme={theme}
        satellite={satellite}
        comparePickingMode={comparePickingMode}
        gameActive={gameActive}
        onSelect={onMapSelect}
        onThemeCycle={cycle}
        onSatelliteToggle={toggleSatellite}
      />

      <GameController countries={pool} countriesFull={countriesFull} cities={cities} byCca3={poolByCca3} />

      {showHint && !selected && !gameActive && (
        <div role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-teal/20 dark:border-teal-light/20 text-teal-light text-sm shadow-lg"
          style={{ animation: 'fade-up 300ms ease-out' }}
        >Explore the world</div>
      )}

      {selected && !gameActive && (
        <CountryPanel
          country={selected}
          compareWith={compareWith}
          comparePickingMode={comparePickingMode}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={onMapSelect}
          onClose={deselect}
          onEnterCompare={enterComparePicking}
          onExitCompare={exitCompare}
          byCca3={byCca3}
        />
      )}
    </div>
  )
}
