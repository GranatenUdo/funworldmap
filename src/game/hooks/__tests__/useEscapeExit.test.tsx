import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useEscapeExit, type UseEscapeExitArgs } from '../useEscapeExit'

afterEach(() => cleanup())

// Dispatch on document.body (bubbles to the window listener) — dispatching on
// window directly would make e.target the window object, which has no
// .matches() and does not model a real browser keydown (target = focused el).
function pressEscape(target: HTMLElement = document.body) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  )
}

function renderEscapeExit(overrides: Partial<UseEscapeExitArgs> = {}) {
  const finishFree = vi.fn()
  const exitToIdle = vi.fn()
  renderHook(() =>
    useEscapeExit({
      status: 'playing',
      modeId: 'country-pinning',
      finishFree,
      exitToIdle,
      ...overrides,
    }),
  )
  return { finishFree, exitToIdle }
}

describe('useEscapeExit', () => {
  it('routes Escape during playing through finishFree so the run is recorded', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({ status: 'playing' })
    pressEscape()
    expect(finishFree).toHaveBeenCalledTimes(1)
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('routes Escape during city-guessing round-ended through finishFree', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({
      status: 'round-ended',
      modeId: 'city-guessing',
    })
    pressEscape()
    expect(finishFree).toHaveBeenCalledTimes(1)
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('does nothing on country-pinning round-ended (Escape advances via the round-end effect)', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({
      status: 'round-ended',
      modeId: 'country-pinning',
    })
    pressEscape()
    expect(finishFree).not.toHaveBeenCalled()
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('routes Escape on game-over through exitToIdle (finishFree is a no-op there; hash must reset)', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({ status: 'game-over' })
    pressEscape()
    expect(exitToIdle).toHaveBeenCalledTimes(1)
    expect(finishFree).not.toHaveBeenCalled()
  })

  it('does nothing while idle', () => {
    const { finishFree, exitToIdle } = renderEscapeExit({ status: 'idle' })
    pressEscape()
    expect(finishFree).not.toHaveBeenCalled()
    expect(exitToIdle).not.toHaveBeenCalled()
  })

  it('ignores Escape originating from a text input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    try {
      const { finishFree, exitToIdle } = renderEscapeExit({ status: 'playing' })
      pressEscape(input)
      expect(finishFree).not.toHaveBeenCalled()
      expect(exitToIdle).not.toHaveBeenCalled()
    } finally {
      input.remove()
    }
  })
})
