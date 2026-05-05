import { useEffect, useState } from 'react'
import type { GameSession } from '../types'

export function AttemptsIndicator({ session }: { session: GameSession }) {
  const used = session.currentAttempts.length
  const total = session.attemptsPerRound
  const last = session.currentAttempts[used - 1]
  const [toast, setToast] = useState<{ pts: number; key: number } | null>(null)
  useEffect(() => {
    if (!last || session.status !== 'playing' || last.pointsEarned <= 0) {
      setToast(null)
      return
    }
    setToast({ pts: last.pointsEarned, key: used })
    const t = window.setTimeout(() => setToast(null), 1000)
    return () => window.clearTimeout(t)
  }, [used, last, session.status])

  return (
    <div data-testid="attempts-indicator" className="relative flex items-center gap-2">
      <div className="flex gap-1.5" role="group" aria-label={`Attempt ${Math.min(used + (session.status === 'playing' ? 1 : 0), total)} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < used ? 'bg-teal' : 'border border-teal/50'
            }`}
            data-testid={`attempt-pip-${i}`}
          />
        ))}
      </div>
      {toast && (
        <span
          key={toast.key}
          role="status"
          aria-live="polite"
          className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-dark-400/90 text-teal-light text-xs font-semibold whitespace-nowrap"
        >
          +{toast.pts}
        </span>
      )}
    </div>
  )
}
