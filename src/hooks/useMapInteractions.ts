import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  byNumeric: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onDeselect: () => void
}

/** Attach hover, click, tooltip, and cursor behaviors to the map.
 *  Must run after country layers are added (i.e. `loaded === true`). */
export function useMapInteractions({ loaded, byNumeric, onSelect, onDeselect }: Options): void {
  const { mapRef, hoveredRef, tooltipRef } = useMap()

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
        map.setFilter('country-extrusion', ['==', ['get', 'id'], id])
        map.setFilter('country-hover-border', ['==', ['get', 'id'], id])
        const canvas = map.getCanvas()
        if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'pointer'

        const tooltip = tooltipRef.current
        if (tooltip) {
          const country = byNumeric.get(id)
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
      map.setFilter('country-extrusion', ['==', ['get', 'id'], ''])
      map.setFilter('country-hover-border', ['==', ['get', 'id'], ''])
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'grab'

      const tooltip = tooltipRef.current
      if (tooltip) tooltip.classList.remove('visible')
    }

    const clickCountry = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const featureId = String(e.features[0].id)
        const country = byNumeric.get(featureId)
        if (country) onSelect(country.cca3)
      }
    }

    const clickMap = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['country-fill'] })
      if (features.length === 0) onDeselect()
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

    map.on('mousemove', 'country-fill', mousemoveHover)
    map.on('mousemove', mousemovePosition)
    map.on('mouseleave', 'country-fill', mouseleaveHover)
    map.on('click', 'country-fill', clickCountry)
    map.on('click', clickMap)
    map.on('dragstart', dragStart)
    map.on('dragend', dragEnd)

    map.getCanvas().style.cursor = 'grab'
    map.doubleClickZoom.disable()

    return () => {
      map.off('mousemove', 'country-fill', mousemoveHover)
      map.off('mousemove', mousemovePosition)
      map.off('mouseleave', 'country-fill', mouseleaveHover)
      map.off('click', 'country-fill', clickCountry)
      map.off('click', clickMap)
      map.off('dragstart', dragStart)
      map.off('dragend', dragEnd)
    }
  }, [loaded, byNumeric, onSelect, onDeselect, mapRef, hoveredRef, tooltipRef])
}
