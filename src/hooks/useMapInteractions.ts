import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { LAYER } from '../lib/mapLayers'
import { useMap } from './useMap'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'
import { isCountryPinning } from '../game/shared/modePredicates'

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

  const { session } = useGameSessionContext()
  const sessionRef = useRef(session)
  sessionRef.current = session
  const tooltipsEnabled = !(isCountryPinning(session.modeId) && session.status === 'playing')

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const mousemoveHover = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const id = String(e.features[0].id)
        if (hoveredRef.current !== null && hoveredRef.current !== id) {
          map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        }
        hoveredRef.current = id
        map.setFeatureState({ source: 'countries', id }, { hover: true })
        map.setFilter(LAYER.extrusion, ['==', ['get', 'id'], id])
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], id])
        const canvas = map.getCanvas()
        if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'pointer'

        if (tooltipsEnabled) {
          const tooltip = tooltipRef.current
          if (tooltip) {
            const country = byNumericRef.current.get(id)
            if (country) {
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
          }
        } else {
          tooltipRef.current?.classList.remove('visible')
        }
      }
    }

    const mousemovePosition = (e: maplibregl.MapMouseEvent) => {
      const tooltip = tooltipRef.current
      if (tooltip && tooltip.classList.contains('visible')) {
        tooltip.style.left = `${e.point.x + 15}px`
        tooltip.style.top = `${e.point.y + 15}px`
      }
    }

    const mouseleaveHover = () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        hoveredRef.current = null
      }
      map.setFilter(LAYER.extrusion, ['==', ['get', 'id'], ''])
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'grab'

      const tooltip = tooltipRef.current
      if (tooltip) tooltip.classList.remove('visible')
    }

    const clickCountry = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const featureId = String(e.features[0].id)
        const country = byNumericRef.current.get(featureId)
        if (country) onSelectRef.current(country.cca3)
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
    map.on('click', LAYER.fill, clickCountry)
    map.on('click', clickMap)
    map.on('dragstart', dragStart)
    map.on('dragend', dragEnd)

    map.getCanvas().style.cursor = 'grab'
    map.doubleClickZoom.disable()

    return () => {
      map.off('mousemove', LAYER.fill, mousemoveHover)
      map.off('mousemove', mousemovePosition)
      map.off('mouseleave', LAYER.fill, mouseleaveHover)
      map.off('click', LAYER.fill, clickCountry)
      map.off('click', clickMap)
      map.off('dragstart', dragStart)
      map.off('dragend', dragEnd)
    }
  }, [loaded, mapRef, hoveredRef, tooltipRef, tooltipsEnabled])

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
