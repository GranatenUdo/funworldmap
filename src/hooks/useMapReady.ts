import { useEffect, useState } from 'react'

/**
 * True once the map has signalled it finished its first load (or errored), via
 * the `data-map-loaded` / `data-map-error` attribute WorldMap sets. Watches the
 * document for that attribute and disconnects once seen. Extracted from App.tsx.
 */
export function useMapReady(): boolean {
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    const check = () => document.querySelector('[data-map-loaded], [data-map-error]')
    const observer = new MutationObserver(() => {
      if (check()) {
        setMapReady(true)
        observer.disconnect()
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-map-loaded', 'data-map-error'],
    })
    if (check()) {
      setMapReady(true)
      observer.disconnect()
    }
    return () => observer.disconnect()
  }, [])
  return mapReady
}
