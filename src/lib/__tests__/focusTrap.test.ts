import { describe, it, expect, afterEach } from 'vitest'
import { installFocusTrap } from '../focusTrap'

afterEach(() => {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
})

function buildRoot(ids: string[]): HTMLDivElement {
  const root = document.createElement('div')
  root.id = 'root'
  for (const id of ids) {
    const btn = document.createElement('button')
    btn.id = id
    btn.textContent = id.toUpperCase()
    root.appendChild(btn)
  }
  document.body.appendChild(root)
  return root
}

function dispatchTab(target: HTMLElement, shift = false) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true }))
}

describe('installFocusTrap', () => {
  it('cycles forward from last to first', () => {
    const root = buildRoot(['a', 'b', 'c'])
    installFocusTrap(root)
    ;(document.getElementById('c') as HTMLButtonElement).focus()
    dispatchTab(root)
    expect(document.activeElement?.id).toBe('a')
  })

  it('cycles backward from first to last on shift+tab', () => {
    const root = buildRoot(['a', 'b'])
    installFocusTrap(root)
    ;(document.getElementById('a') as HTMLButtonElement).focus()
    dispatchTab(root, true)
    expect(document.activeElement?.id).toBe('b')
  })

  it('redirects external focus back into the trap', () => {
    const outside = document.createElement('button')
    outside.id = 'outside'
    outside.textContent = 'Outside'
    document.body.appendChild(outside)
    const root = buildRoot(['a', 'b'])
    installFocusTrap(root)
    outside.focus()
    dispatchTab(root)
    expect(document.activeElement?.id).toBe('a')
  })

  it('cleanup function removes the listener', () => {
    const root = buildRoot(['a', 'b'])
    const cleanup = installFocusTrap(root)
    cleanup()
    ;(document.getElementById('a') as HTMLButtonElement).focus()
    dispatchTab(root)
    // Listener removed; jsdom doesn't fire native Tab default, so focus stays.
    expect(document.activeElement?.id).toBe('a')
  })
})
