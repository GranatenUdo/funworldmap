import { useEffect, type RefObject } from 'react'
import { installFocusTrap } from '../lib/focusTrap'

/** Isolate true dialogs from keyboard and assistive background navigation. */
export function useModalLayer(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const root = ref.current
    if (!root || !active) return
    const previous = document.activeElement as HTMLElement | null
    const siblings: Array<[HTMLElement, boolean]> = []
    let branch: HTMLElement = root
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (
          sibling !== branch &&
          sibling instanceof HTMLElement &&
          !['SCRIPT', 'STYLE'].includes(sibling.tagName)
        ) {
          siblings.push([sibling, sibling.inert])
          sibling.inert = true
        }
      }
      branch = branch.parentElement
      if (branch === document.body) break
    }
    const removeTrap = installFocusTrap(root)
    const focusTarget = root.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)') ??
      root.querySelector<HTMLElement>('button:not(:disabled), [tabindex="-1"]')
    focusTarget?.focus()
    return () => {
      removeTrap()
      for (const [element, wasInert] of siblings) element.inert = wasInert
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [ref, active])
}
