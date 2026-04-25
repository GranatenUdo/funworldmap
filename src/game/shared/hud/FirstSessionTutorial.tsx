import { useState, useEffect } from 'react'
import type { ModeId } from '../types'

const KEY_PREFIX = 'funworldmap-game-tutorial-shown-'

const COPY: Record<ModeId, { title: string; body: string }> = {
  'country-pinning': {
    title: 'How to play',
    body: 'Click the country that matches the flag and name above. Three wrong countries end the game. Ocean clicks don\u2019t count.',
  },
  'city-guessing': {
    title: 'How to play',
    body: 'Click anywhere on the map \u2014 including ocean \u2014 to guess the city\u2019s location. Ten rounds per game.',
  },
}

interface Props {
  modeId: ModeId
  firstAttemptMade?: boolean
}

export function FirstSessionTutorial({ modeId, firstAttemptMade }: Props) {
  const [open, setOpen] = useState(false)
  const key = KEY_PREFIX + modeId

  useEffect(() => {
    if (sessionStorage.getItem(key)) return
    setOpen(true)
    sessionStorage.setItem(key, '1')
  }, [key])

  useEffect(() => {
    if (firstAttemptMade) setOpen(false)
  }, [firstAttemptMade])

  if (!open) return null
  const copy = COPY[modeId]

  return (
    <div
      role="status"
      className="fixed top-40 sm:top-44 left-1/2 -translate-x-1/2 z-[45] max-w-xs px-4 py-3 rounded-2xl bg-dark-400/95 dark:bg-dark-300/95 backdrop-blur-md border border-teal/30 dark:border-teal-light/30 text-teal-light text-sm shadow-2xl pointer-events-none"
      style={{ animation: 'fade-up 300ms ease-out' }}
      data-testid="game-tutorial"
    >
      <p className="font-medium mb-1">{copy.title}</p>
      <p className="text-xs opacity-90">{copy.body}</p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs underline-offset-2 underline hover:no-underline pointer-events-auto"
      >
        Got it
      </button>
    </div>
  )
}
