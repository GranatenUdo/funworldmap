import { useCallback } from 'react'
import { buildShareText, modesPlayed as countModesPlayed, type ShareResults } from '../game/daily/shareText'
import type { StreakState } from '../game/daily/types'
import { track } from '../lib/analytics'
import { dispatchToast } from '../lib/toast'

interface Props {
  date: string
  results: ShareResults
  streak: StreakState
  originUrl: string
}

export function DailyShareBlock({ date, results, streak, originUrl }: Props) {
  const text = buildShareText({ date, results, streak, originUrl })
  const url = `${originUrl}/#daily/${date}`
  const modesPlayed = countModesPlayed(results)

  const handlePrimary = useCallback(async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'funworldmap daily', text, url })
        track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'share-api' })
        return
      } catch (err) {
        const name = (err as { name?: string }).name
        if (name === 'AbortError') return
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      dispatchToast('Copied!')
      track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-text' })
    } catch {
      dispatchToast("Couldn't copy — select and copy manually.")
    }
  }, [date, text, url, modesPlayed])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      dispatchToast('Link copied')
      track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-link' })
    } catch {
      dispatchToast("Couldn't copy — select and copy manually.")
    }
  }, [date, url, modesPlayed])

  return (
    <div data-testid="daily-share-block" className="mt-4 p-4 rounded-xl bg-sand-50/80 dark:bg-dark-400/60 border border-sand-300/40 dark:border-dark-200/30">
      <pre
        data-testid="daily-share-preview"
        className="whitespace-pre-wrap text-xs text-sand-900 dark:text-dark-50 font-mono mb-3 tabular-nums select-all"
      >
        {text}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePrimary}
          data-testid="daily-share-primary"
          className="flex-1 px-4 py-2 rounded-xl bg-teal-accessible text-white font-semibold hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/60"
        >
          Share
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          data-testid="daily-share-copy-link"
          className="px-4 py-2 rounded-xl text-teal-accessible dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/60"
        >
          Copy link only
        </button>
      </div>
    </div>
  )
}
