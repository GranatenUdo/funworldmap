import { useState, useEffect } from 'react'
import type { ModeId } from '../types'

const KEY_PREFIX = 'funworldmap-game-tutorial-shown-'

const COPY = {
  'country-pinning-free': {
    title: 'How to play',
    body: "Click the country that matches the flag and name above. Three wrong countries end the game. Ocean clicks don't count. Correct answers earn 100 points; misses earn proximity points.",
  },
  'city-guessing-free': {
    title: 'How to play',
    body: "Click anywhere on the map — including ocean — to guess the city's location. Ten rounds per game. Up to 100 points each; closer pins earn more.",
  },
} as const

interface Props {
  modeId: ModeId
  firstAttemptMade: boolean
  /** C-6 controlled reopen: true forces the card open regardless of the
   *  first-session gate (the HUD "?" button). Auto-show is unchanged. */
  open?: boolean
  /** Called when "Got it" is clicked while controlled-open. */
  onRequestClose?: () => void
}

export function FirstSessionTutorial({
  modeId,
  firstAttemptMade,
  open = false,
  onRequestClose,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- WHY: tsc requires this assertion to narrow the template literal to keyof typeof COPY; eslint's type inference disagrees but removing the cast breaks `tsc --strict`.
  const variant = `${modeId}-free` as keyof typeof COPY
  const [autoOpen, setAutoOpen] = useState(false)
  const key = KEY_PREFIX + variant

  useEffect(() => {
    if (sessionStorage.getItem(key)) return
    setAutoOpen(true)
    sessionStorage.setItem(key, '1')
  }, [key])

  useEffect(() => {
    if (firstAttemptMade) setAutoOpen(false)
  }, [firstAttemptMade])

  if (!open && !autoOpen) return null
  const copy = COPY[variant]

  return (
    <div
      role="status"
      className="fixed top-40 sm:top-44 left-1/2 -translate-x-1/2 z-[45] max-w-xs px-4 py-3 rounded-2xl bg-dark-400/95 dark:bg-dark-300/95 backdrop-blur-md border border-ice/30 text-ice text-sm shadow-2xl pointer-events-none"
      style={{ animation: 'fade-up 300ms ease-out' }}
      data-testid="game-tutorial"
    >
      <p className="font-medium mb-1">{copy.title}</p>
      <p className="text-sm">{copy.body}</p><p className="text-sm mt-2">Drag to turn the globe. Scroll or pinch to zoom. Use the globe control to reset your view.</p>
      <button
        type="button"
        onClick={() => {
          setAutoOpen(false)
          onRequestClose?.()
        }}
        className="mt-2 text-xs underline-offset-2 underline hover:no-underline pointer-events-auto"
      >
        Got it
      </button>
    </div>
  )
}
