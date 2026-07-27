import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { EMPTY_FILTER, LAYER } from '../lib/mapLayers'
import { markClickOrigin } from '../lib/selectionOrigin'
import { clampTooltipPosition } from '../lib/tooltipPosition'
import { useMap } from './useMap'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'
import type { GameStatus } from '../game/shared/types'

/**
 * Whether the country name/capital hover tooltip should be shown.
 *
 * It is suppressed for EVERY game mode while a round is in play, because the
 * country identity leaks the answer: in Country Pinning the name IS the answer,
 * and in City Guessing it narrows down where the target city is. Outside active
 * play (idle map, post-round reveal, game over) the tooltip is the normal
 * map-exploration affordance and stays on.
 */
export function mapHoverTooltipEnabled(status: GameStatus): boolean {
  return status !== 'playing'
}

interface Options {
  loaded: boolean
  byNumeric: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onDeselect: () => void
  comparePickingMode: boolean
}

/** Attach hover, click, tooltip, and cursor behaviors to the map.
 *  Must run after country layers are added (i.e. `loaded === true`).
 *  Callbacks are read via refs so the listener stack attaches once and survives
 *  caller-side re-creations (e.g. when `comparePickingMode` toggles). */
export function useMapInteractions({
  loaded,
  byNumeric,
  onSelect,
  onDeselect,
  comparePickingMode,
}: Options): void {
  const { mapRef, tooltipRef } = useMap()
  const hoveredRef = useRef<string | null>(null)

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onDeselectRef = useRef(onDeselect)
  onDeselectRef.current = onDeselect
  const byNumericRef = useRef(byNumeric)
  byNumericRef.current = byNumeric
  const comparePickingRef = useRef(comparePickingMode)
  comparePickingRef.current = comparePickingMode

  const { session } = useGameSessionContext()
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const mousemoveHover = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return
      const id = String(e.features[0].id)
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'pointer'

      // Read the gate live (like clickMap reads sessionRef) so the listener
      // stack attaches once and survives game-status changes instead of being
      // re-registered on every round boundary. The per-event hide also clears a
      // lingering tooltip when a round starts mid-hover.
      const tooltipsEnabled = mapHoverTooltipEnabled(sessionRef.current.status)
      if (!tooltipsEnabled) tooltipRef.current?.classList.remove('visible')

      // Same country as last event — setFilter × 2, setFeatureState, and the
      // tooltip DOM rebuild below would be no-ops on the rendered output but
      // cost real main-thread time at 60+ Hz. mousemovePosition still tracks
      // the tooltip's screen position.
      if (id === hoveredRef.current) return

      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
      }
      hoveredRef.current = id
      map.setFeatureState({ source: 'countries', id }, { hover: true })
      map.setFilter(LAYER.extrusion, ['==', ['get', 'id'], id])
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], id])

      if (!tooltipsEnabled) return
      const tooltip = tooltipRef.current
      if (!tooltip) return
      const country = byNumericRef.current.get(id)
      if (!country) return
      tooltip.replaceChildren()
      const img = document.createElement('img')
      img.src = country.flag
      img.alt = ''
      tooltip.appendChild(img)

      const textWrap = document.createElement('div')
      textWrap.className = 'tooltip-text'

      const nameEl = document.createElement('div')
      nameEl.className = 'tooltip-name'
      nameEl.textContent = country.name.common
      textWrap.appendChild(nameEl)

      if (country.capital.length > 0) {
        const capitalEl = document.createElement('div')
        capitalEl.className = 'tooltip-capital'
        capitalEl.textContent = country.capital[0]
        textWrap.appendChild(capitalEl)
      }

      tooltip.appendChild(textWrap)
      tooltip.classList.add('visible')
    }

    // Coalesce tooltip position updates to one write per animation frame.
    // mousemove fires faster than the display refresh rate; writing
    // style.left/top twice per event triggered redundant layout work.
    let pendingFrame: number | null = null
    let pendingX = 0
    let pendingY = 0
    const mousemovePosition = (e: maplibregl.MapMouseEvent) => {
      pendingX = e.point.x
      pendingY = e.point.y
      if (pendingFrame !== null) return
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = null
        const tooltip = tooltipRef.current
        if (!tooltip || !tooltip.classList.contains('visible')) return
        // Clamp-and-flip against the map container box so the tooltip never
        // clips at the right/bottom edges or under the open panel (A10).
        const container = map.getContainer()
        const { left, top } = clampTooltipPosition({
          x: pendingX,
          y: pendingY,
          tooltipWidth: tooltip.offsetWidth,
          tooltipHeight: tooltip.offsetHeight,
          containerWidth: container.clientWidth,
          containerHeight: container.clientHeight,
        })
        tooltip.style.left = `${left}px`
        tooltip.style.top = `${top}px`
      })
    }

    // Shared by mouseleave and programmatic movestart: a camera move without
    // mouse movement (search select, deep link, reveal fly-to) must not leave
    // a hover highlight or tooltip describing the previous view. No cursor
    // write here — movestart fires mid-drag after dragstart set 'grabbing',
    // and resetting to 'grab' would glitch the drag cursor.
    const clearHoverArtifacts = () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        hoveredRef.current = null
      }
      map.setFilter(LAYER.extrusion, EMPTY_FILTER)
      map.setFilter(LAYER.hoverBorder, EMPTY_FILTER)
      const tooltip = tooltipRef.current
      if (tooltip) tooltip.classList.remove('visible')
    }

    // User gestures (drag/wheel) carry originalEvent; programmatic camera
    // moves (easeTo/flyTo from search select, deep link, reveal) do not. Only
    // programmatic moves can leave the pointer's hover state stale — clearing
    // on a user wheel-zoom would wipe a live hover under a stationary cursor
    // (2026-07-10 review finding).
    const movestartClear = (
      e: maplibregl.MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>,
    ) => {
      if (e.originalEvent) return
      clearHoverArtifacts()
    }

    const mouseleaveHover = () => {
      clearHoverArtifacts()
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'grab'
    }

    const clickCountry = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const featureId = String(e.features[0].id)
        const country = byNumericRef.current.get(featureId)
        if (country) {
          // This is the ONLY click-origin site — onSelect in App is shared
          // with search and border chips, so the mark must live here. Mark
          // only when this click will produce a selection hashchange: takeOrigin()
          // runs solely in resolveHash, so a mark set by a game guess click, a
          // compare-picking click, or a re-click of the already-selected
          // country (identical hash → no hashchange) would never be consumed
          // and would leak preserveZoom into the NEXT auto selection
          // (2026-07-10 review finding).
          const willChangeSelectionHash =
            sessionRef.current.status === 'idle' &&
            !comparePickingRef.current &&
            window.location.hash !== `#${country.cca3}`
          if (willChangeSelectionHash) markClickOrigin()
          onSelectRef.current(country.cca3)
        }
      }
    }

    const clickMap = (e: maplibregl.MapMouseEvent) => {
      // Don't deselect during active gameplay — clearing the URL hash mid-game
      // strips routing state and was the root of the 2026-04-27 cascade.
      if (sessionRef.current.status !== 'idle') return
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYER.fill] })
      if (features.length === 0) onDeselectRef.current()
    }

    const dragStart = () => {
      map.getCanvas().style.cursor = 'grabbing'
    }
    const dragEnd = () => {
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') {
        canvas.style.cursor = hoveredRef.current ? 'pointer' : 'grab'
      }
    }

    map.on('mousemove', LAYER.fill, mousemoveHover)
    map.on('mousemove', mousemovePosition)
    map.on('mouseleave', LAYER.fill, mouseleaveHover)
    map.on('movestart', movestartClear)
    map.on('click', LAYER.fill, clickCountry)
    map.on('click', clickMap)
    map.on('dragstart', dragStart)
    map.on('dragend', dragEnd)

    map.getCanvas().style.cursor = 'grab'
    map.doubleClickZoom.disable()

    return () => {
      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame)
      map.off('mousemove', LAYER.fill, mousemoveHover)
      map.off('mousemove', mousemovePosition)
      map.off('mouseleave', LAYER.fill, mouseleaveHover)
      map.off('movestart', movestartClear)
      map.off('click', LAYER.fill, clickCountry)
      map.off('click', clickMap)
      map.off('dragstart', dragStart)
      map.off('dragend', dragEnd)
    }
  }, [loaded, mapRef, hoveredRef, tooltipRef])

  // When a round starts (tooltips become suppressed), proactively hide any
  // tooltip left visible from the reveal phase rather than waiting for the next
  // mouse move.
  useEffect(() => {
    if (!mapHoverTooltipEnabled(session.status)) tooltipRef.current?.classList.remove('visible')
  }, [session.status, tooltipRef])

  // Crosshair cursor while picking a compare target. When picking ends, restore
  // either pointer (if hovering a country) or grab (if not).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const canvas = map.getCanvas()
    if (comparePickingMode) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    }
  }, [comparePickingMode, loaded, mapRef, hoveredRef])
}
