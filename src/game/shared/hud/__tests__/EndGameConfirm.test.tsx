import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EndGameConfirm, isTrivialRun } from '../EndGameConfirm'

function renderDialog(overrides: { onConfirm?: () => void; onKeepPlaying?: () => void } = {}) {
  return render(
    <EndGameConfirm
      onConfirm={overrides.onConfirm ?? (() => {})}
      onKeepPlaying={overrides.onKeepPlaying ?? (() => {})}
    />,
  )
}

afterEach(() => {
  // Tests below append focus-restore targets to document.body.
  document.body.querySelectorAll('button.test-outside').forEach((b) => b.remove())
})

describe('isTrivialRun (C-4 gate)', () => {
  it('is trivial on round 1 with no points', () => {
    expect(isTrivialRun({ roundIndex: 0, score: 0 })).toBe(true)
  })

  it('is not trivial once points exist', () => {
    expect(isTrivialRun({ roundIndex: 0, score: 100 })).toBe(false)
  })

  it('is not trivial past round 1 even at score 0', () => {
    expect(isTrivialRun({ roundIndex: 1, score: 0 })).toBe(false)
  })
})

describe('EndGameConfirm', () => {
  it('is a labelled modal dialog and initially focuses the safe action (Keep playing)', () => {
    renderDialog()
    const dialog = screen.getByTestId('end-game-confirm')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('heading', { name: 'End game?' })).toBeTruthy()
    expect(screen.getByText('Your personal best is saved in this browser when storage is available.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByTestId('end-keep-playing'))
  })

  it('confirming calls onConfirm', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.click(screen.getByTestId('end-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Escape keeps playing AND stops propagation so useEscapeExit never re-fires', () => {
    const onKeepPlaying = vi.fn()
    const windowListener = vi.fn()
    window.addEventListener('keydown', windowListener)
    try {
      renderDialog({ onKeepPlaying })
      fireEvent.keyDown(screen.getByTestId('end-keep-playing'), { key: 'Escape' })
      expect(onKeepPlaying).toHaveBeenCalledTimes(1)
      // The window-level listener (useEscapeExit's registration point) must
      // not see the event — that is the whole point of the in-dialog handler.
      expect(windowListener).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', windowListener)
    }
  })

  it('traps Tab: forward from the last control wraps to the first, shift+Tab from the first wraps to the last', () => {
    renderDialog()
    const keep = screen.getByTestId('end-keep-playing')
    const confirm = screen.getByTestId('end-confirm')

    confirm.focus()
    fireEvent.keyDown(screen.getByTestId('end-game-confirm'), { key: 'Tab' })
    expect(document.activeElement).toBe(keep)

    fireEvent.keyDown(screen.getByTestId('end-game-confirm'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('restores focus to the previously focused element on close (house pattern)', () => {
    const outside = document.createElement('button')
    outside.className = 'test-outside'
    document.body.appendChild(outside)
    outside.focus()

    const { unmount } = renderDialog()
    expect(document.activeElement).toBe(screen.getByTestId('end-keep-playing'))
    unmount()
    expect(document.activeElement).toBe(outside)
  })
})
