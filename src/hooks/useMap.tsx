import { createContext, useContext, useRef, type ReactNode, type MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

interface MapRefs {
  mapRef: MutableRefObject<maplibregl.Map | null>
  tooltipRef: MutableRefObject<HTMLDivElement | null>
}

const MapContext = createContext<MapRefs | null>(null)

export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  return (
    <MapContext.Provider value={{ mapRef, tooltipRef }}>
      {children}
    </MapContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMap(): MapRefs {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMap must be used inside <MapProvider>')
  return ctx
}
