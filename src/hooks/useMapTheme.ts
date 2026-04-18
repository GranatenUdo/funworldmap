import { useEffect } from 'react'
import { applyMapTheme } from '../lib/mapColors'
import { TEAL, TEAL_LIGHT, CORAL, CORAL_LIGHT } from '../lib/mapPalette'
import { applyDefaultBorderPaint, LAYER } from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  resolvedTheme: 'light' | 'dark'
}

export function useMapTheme({ loaded, resolvedTheme }: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyMapTheme(map, resolvedTheme)

    const isDark = resolvedTheme === 'dark'
    const teal = isDark ? TEAL_LIGHT : TEAL
    const coral = isDark ? CORAL_LIGHT : CORAL

    try {
      map.setPaintProperty(LAYER.fill, 'fill-color', teal)
      map.setPaintProperty(LAYER.extrusion, 'fill-extrusion-color', teal)
      map.setPaintProperty(LAYER.hoverBorder, 'line-color', teal)

      map.setPaintProperty(LAYER.selected, 'fill-color', coral)
      map.setPaintProperty(LAYER.selectedBorder, 'line-color', coral)
      map.setPaintProperty(LAYER.selectedGlow, 'line-color', coral)
      map.setPaintProperty(LAYER.selectedExtrusion, 'fill-extrusion-color', coral)

      applyDefaultBorderPaint(map, isDark)

      ;(map as never as { setFog: (fog: Record<string, unknown>) => void }).setFog({
        range: [1.5, 10],
        color: isDark ? 'rgba(16, 20, 26, 0.7)' : 'rgba(232, 227, 218, 0.5)',
        'high-color': isDark ? '#10141a' : '#c4d8e6',
        'horizon-blend': 0.1,
      })

      ;(map as never as { setSky: (sky: Record<string, unknown>) => void }).setSky({
        'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
        'horizon-color': isDark ? '#1a2030' : '#f0ede6',
        'fog-color': isDark ? '#10141a' : '#e8e3da',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.8,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
      })
    } catch {
      // Layers may not exist yet.
    }
  }, [resolvedTheme, loaded, mapRef])
}
