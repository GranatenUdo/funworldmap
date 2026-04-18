import { useState, useEffect } from 'react'

const KEY = 'funworldmap-game-tutorial-shown'

export function FirstSessionTutorial() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return
    setOpen(true)
    sessionStorage.setItem(KEY, '1')
  }, [])

  if (!open) return null

  return (
    <div
      role="status"
      className="fixed top-40 sm:top-44 left-1/2 -translate-x-1/2 z-[45] max-w-xs px-4 py-3 rounded-2xl bg-dark-400/95 dark:bg-dark-300/95 backdrop-blur-md border border-teal/30 dark:border-teal-light/30 text-teal-light text-sm shadow-2xl pointer-events-auto"
      style={{ animation: 'fade-up 300ms ease-out' }}
      data-testid="game-tutorial"
    >
      <p className="font-medium mb-1">How to play</p>
      <p className="text-xs opacity-90">
        Click the country that matches the flag and name above. Three wrong countries end the game.
        Ocean clicks don't count.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs underline-offset-2 underline hover:no-underline"
      >
        Got it
      </button>
    </div>
  )
}
