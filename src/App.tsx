import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import CountryPanel from './components/CountryPanel'
import { Launcher } from './components/Launcher'
import Toast from './components/Toast'
import { useCountryData } from './hooks/useCountryData'
import { useCityData } from './hooks/useCityData'
import { useSelectedCountry } from './hooks/useSelectedCountry'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useTheme } from './hooks/useTheme'
import { useLauncherVisibility } from './hooks/useLauncherVisibility'
import { useMapReady } from './hooks/useMapReady'
import { hintCopy, useFirstVisitHint } from './hooks/useFirstVisitHint'
import { useLiveAnnouncements } from './hooks/useLiveAnnouncements'
import { MapProvider } from './hooks/useMap'
import { GameSessionProvider, useGameSessionContext } from './game/shared/GameSessionProvider'
import { isCountryPinning } from './game/shared/modePredicates'
import { GameController } from './game/GameController'
import type { CityLike, CountryLike } from './game/shared/types'
import { centroidFromLatLng } from './game/shared/distance'
import type { CountryData, CountriesFile } from './lib/types'
import { FINE_POINTER_MEDIA_QUERY } from './lib/layoutConstants'
import { track } from './lib/analytics'
import { compareMapClick, compareChipClick, type CompareColumn } from './lib/compareMapClick'
import { dispatchToast } from './lib/toast'

export default function App() {
  const { countries, byNumeric, byCca3, sources } = useCountryData()
  const { cities } = useCityData()

  // useCountryData already filters to the canonical 195 (193 UN members + Vatican + Palestine)
  // via CANONICAL_CCA3, so no further independence filter is needed here. Palestine has
  // independent === false in the source data; passing the field through keeps the panel badge
  // honest while still including PSE in the playable pool.
  const pool = useMemo<CountryLike[]>(
    () =>
      countries.map((c: CountryData) => ({
        cca3: c.cca3,
        name: { common: c.name.common },
        flag: c.flag,
        latlng: c.latlng,
        independent: c.independent,
      })),
    [countries],
  )
  const poolByCca3 = useMemo(() => new Map(pool.map((c) => [c.cca3, c])), [pool])
  const pools = useMemo(() => ({ countries: pool, cities }), [pool, cities])

  return (
    <MapProvider>
      <GameSessionProvider pools={pools}>
        <AppInner
          countries={countries}
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
  pool: CountryLike[]
  byNumeric: Map<string, CountryData>
  byCca3: Map<string, CountryData>
  poolByCca3: Map<string, CountryLike>
  sources: CountriesFile['_sources']
  cities: CityLike[]
}

function AppInner({
  countries,
  pool,
  byNumeric,
  byCca3,
  poolByCca3,
  sources,
  cities,
}: AppInnerProps) {
  const appReady = countries.length > 0 && cities.length > 0
  const {
    selected,
    compareWith,
    selectionOriginRef,
    select,
    compareSelect,
    compareReplaceA,
    clearCompare,
    deselect,
  } = useSelectedCountry(byCca3)
  const isDesktop = useMediaQuery()
  const { theme, resolved, cycle } = useTheme()
  const { session, submitGuessInput, advance, mode, finalize } = useGameSessionContext()
  const {
    visible: launcherVisible,
    dismiss: dismissLauncher,
    show: showLauncher,
  } = useLauncherVisibility()
  const mapReady = useMapReady()
  const finePointer = useMediaQuery(FINE_POINTER_MEDIA_QUERY)
  const liveRegionRef = useLiveAnnouncements(selected?.name.common ?? null)
  const [satellite, setSatellite] = useState(true)
  const toggleSatellite = useCallback(() => setSatellite((s) => !s), [])
  const onLauncherDismissFromSearch = useCallback(() => {
    track('launcher_dismissed', { path: 'search' })
    dismissLauncher()
  }, [dismissLauncher])
  const [comparePickingMode, setComparePickingMode] = useState(false)

  // Below comparePickingMode's declaration because the hint machine consumes
  // it (compareActive marks the compare tip moot — C5). Hook order is still
  // stable across renders; only the source position moved.
  const { hint } = useFirstVisitHint({
    mapReady,
    selectedCca3: selected?.cca3 ?? null,
    gameActive: session.status !== 'idle',
    compareActive: !!compareWith || comparePickingMode,
  })

  const enterComparePicking = useCallback(() => {
    if (selected) setComparePickingMode(true)
  }, [selected])
  const exitCompare = useCallback(() => {
    setComparePickingMode(false)
    clearCompare()
  }, [clearCompare])

  const gameActive = session.status !== 'idle'

  const roundEndTarget = useMemo(() => {
    if (session.status !== 'round-ended') return null
    if (!isCountryPinning(session.modeId)) return null
    const reveal = session.lastOutcome?.reveal
    if (!reveal || reveal.kind !== 'country') return null
    return byCca3.get(reveal.targetCca3) ?? null
  }, [session.status, session.modeId, session.lastOutcome, byCca3])

  const advanceRoundEndPanel = useCallback(() => {
    if (session.status !== 'round-ended' || !mode) return
    if (session.lastOutcome?.endsGame) {
      finalize()
      return
    }
    const next = mode.nextRound(session.used)
    advance(next)
  }, [session.status, session.lastOutcome, session.used, advance, finalize, mode])

  const onMapSelect = useCallback(
    (cca3: string) => {
      if (gameActive) {
        if (isCountryPinning(session.modeId)) {
          const country = poolByCca3.get(cca3.toUpperCase())
          if (!country) {
            dispatchToast("That territory isn't in the country pool.")
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
    [
      gameActive,
      session.modeId,
      poolByCca3,
      submitGuessInput,
      comparePickingMode,
      selected,
      select,
      compareSelect,
    ],
  )

  // A8 — map-click semantics while a compare pair is active. Scoped to MAP
  // clicks only: search still routes through onMapSelect and keeps select().
  // Border chips inside the compare panel are column-scoped (C1) — see
  // onCompareColumnSelect below.
  const onMapCountryClick = useCallback(
    (cca3: string) => {
      if (!gameActive && !comparePickingMode && selected && compareWith) {
        const action = compareMapClick(cca3, selected.cca3, compareWith.cca3)
        if (action.kind === 'replace-b') compareSelect(action.cca3)
        return
      }
      onMapSelect(cca3)
    },
    [gameActive, comparePickingMode, selected, compareWith, compareSelect, onMapSelect],
  )

  // C1 (A8's descoped border-chip clause) — chips inside the compare panel
  // replace their OWN column's country: column A via compareReplaceA (keeps
  // B), column B via compareSelect (keeps A). compareChipClick guards the
  // X-vs-X case (a chip naming the other column's country is a no-op).
  const onCompareColumnSelect = useCallback(
    (column: CompareColumn, cca3: string) => {
      if (!selected || !compareWith) return
      const action = compareChipClick(column, cca3, selected.cca3, compareWith.cca3)
      if (action.kind === 'replace-a') compareReplaceA(action.cca3)
      else if (action.kind === 'replace-b') compareSelect(action.cca3)
    },
    [selected, compareWith, compareReplaceA, compareSelect],
  )

  // A8 — an ocean click must not tear down an active comparison; Escape and
  // the compare header's Exit compare / × are the only exits.
  //
  // comparePickingMode is only ever true while compareWith is null (picking
  // starts from a single-country panel — see enterComparePicking), so the
  // compareWith guard above never protects picking mode. Without clearing it
  // here, an ocean click during picking deselects (closing the panel, per
  // Task 13) but leaves comparePickingMode stuck true — the picking branch of
  // onMapSelect then requires a `selected` country that no longer exists, so
  // every later map click or search selection silently no-ops until Escape
  // (keyboard-only) or a game start resets it. Touch users had no recovery.
  const onMapDeselect = useCallback(() => {
    if (compareWith) return
    setComparePickingMode(false)
    deselect()
  }, [compareWith, deselect])

  useEffect(() => {
    if (session.status !== 'playing' || session.roundIndex !== 0) return
    if (selected) deselect()
    setComparePickingMode(false)
    // No camera reset — user's view is preserved at game start.
    // Fires on the very first round of each new game — covers idle→playing
    // and game-over→Play-again transitions without needing a prev-status ref.
  }, [session.status, session.roundIndex, selected, deselect])

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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameActive) return
        if (launcherVisible) {
          track('launcher_dismissed', { path: 'escape' })
          dismissLauncher()
          // Defer focus: Header returns null while launcher is open, so the
          // search input doesn't exist until React re-renders post-dismiss.
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              const searchInput = document.getElementById('search-input') as HTMLInputElement | null
              searchInput?.focus()
            })
          })
          return
        }
        if (compareWith || comparePickingMode) {
          exitCompare()
          return
        }
        if (selected) {
          deselect()
          return
        }
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
  }, [
    selected,
    compareWith,
    comparePickingMode,
    exitCompare,
    deselect,
    gameActive,
    launcherVisible,
    dismissLauncher,
  ])

  return (
    <div
      data-selected-country={selected?.ccn3 || undefined}
      data-game-mode={gameActive ? session.modeId : undefined}
      className="grain"
    >
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ice-accessible focus:text-white focus:rounded-lg"
        onClick={() => document.getElementById('search-input')?.focus()}
      >
        Skip to search
      </button>
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-40 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ice-accessible focus:text-white focus:rounded-lg"
        onClick={() => document.querySelector<HTMLDivElement>('[role="application"]')?.focus()}
      >
        Skip to map
      </button>

      <div
        ref={liveRegionRef}
        data-testid="announce-region"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {!mapReady && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-sand-100 dark:bg-dark-500 transition-opacity duration-300 pointer-events-none"
        >
          <span className="text-2xl font-bold tracking-wide text-ice-accessible dark:text-ice mb-6">
            funworldmap
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-ice-accessible dark:bg-ice"
                style={{ animation: `loading-dots 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
        </div>
      )}

      <Toast />

      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.10) 100%)',
        }}
      />

      <main data-app-ready={appReady ? 'true' : 'false'}>
        <WorldMap
          byNumeric={byNumeric}
          selected={selected}
          selectionOriginRef={selectionOriginRef}
          compareWith={compareWith}
          comparePickingMode={comparePickingMode}
          resolvedTheme={resolved}
          satellite={satellite}
          onSelect={onMapCountryClick}
          onDeselect={onMapDeselect}
        />
      </main>
      <Header
        countries={countries}
        theme={theme}
        satellite={satellite}
        comparePickingMode={comparePickingMode}
        gameActive={gameActive}
        launcherVisible={launcherVisible}
        onSelect={onMapSelect}
        onThemeCycle={cycle}
        onSatelliteToggle={toggleSatellite}
        onOpenLauncher={showLauncher}
        onLauncherDismiss={onLauncherDismissFromSearch}
      />

      {launcherVisible && <Launcher onDismiss={dismissLauncher} />}

      <GameController countries={pool} cities={cities} byCca3={poolByCca3} />

      {/* explore/game hints render on the empty map; the compare tip (C5,
          mobile-enabled by D4/Task 6) renders while a panel is open. Same
          pill, pointer-events-none, non-focusable — it can never intercept
          clicks or shift Tab order.
          z-[100]: above the mobile panel's z-40 sheet (the desktop panel is
          a right-side rail so z-20 never collided with it, but the mobile
          panel is a full-width `bottom-0` sheet at z-40 that spatially
          overlaps this pill's position — at z-20 the compare tip rendered
          fully behind, and invisible under, the sheet the instant D4/Task 6
          let it fire on mobile; found via the Task 7 live-pass visual
          review, elementFromPoint at the pill's own coordinates resolved to
          the panel, not the pill), but BELOW the z-[200] loading overlay and
          the z-[210] launcher dialog — 8cf6ad2's fix over-corrected to
          z-[300] (matching Toast.tsx, which never has to yield to a modal),
          which left the pill floating over the launcher indefinitely for a
          first-timer who closes their first panel (fires the 'game' hint)
          and then opens the launcher. */}
      {hint && !gameActive && (hint === 'compare' ? !!selected : !selected) && (
        <div
          role="status"
          data-testid="onboarding-hint"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+2rem)] left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-ice/20 text-ice text-sm shadow-lg pointer-events-none"
          style={{ animation: 'fade-up 300ms ease-out' }}
        >
          {hintCopy(hint, finePointer)}
        </div>
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
          onCancelCompare={exitCompare}
          onExitCompare={exitCompare}
          onCompareColumnSelect={onCompareColumnSelect}
          byCca3={byCca3}
        />
      )}

      {roundEndTarget && (
        <CountryPanel
          country={roundEndTarget}
          compareWith={null}
          comparePickingMode={false}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={() => {
            /* no-op during round-end */
          }}
          onClose={advanceRoundEndPanel}
          onEnterCompare={() => {
            /* no-op — hidden by inGameRound */
          }}
          onCancelCompare={() => {
            /* no-op — picking mode is never active during a round */
          }}
          onExitCompare={() => {
            /* no-op — hidden by inGameRound */
          }}
          onCompareColumnSelect={() => {
            /* no-op — compare never renders during a round */
          }}
          byCca3={byCca3}
          inGameRound={true}
        />
      )}
    </div>
  )
}
