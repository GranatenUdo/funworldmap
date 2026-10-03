import { useEffect, useState } from 'react'

/** Reactive map readiness: errors settle loading but never permit gameplay. */
export function useGameplayReady() {
  const [state, setState] = useState({ ready: false, failed: false })
  useEffect(() => {
    const check = () => {
      const failed = !!document.querySelector('[data-map-error]')
      const ready = !failed && !!document.querySelector('[data-map-loaded="true"]')
      setState((previous) =>
        previous.ready === ready && previous.failed === failed ? previous : { ready, failed },
      )
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-map-loaded', 'data-map-error'],
    })
    check()
    return () => observer.disconnect()
  }, [])
  return state
}
