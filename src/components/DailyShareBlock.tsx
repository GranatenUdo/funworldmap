import { useCallback } from 'react'
import { buildShareText, modesPlayed as countModesPlayed, type ShareResults } from '../game/daily/shareText'
import type { StreakState } from '../game/daily/types'
import { track } from '../lib/analytics'

interface Props {
  date: string
  results: ShareResults
  streak: StreakState
  originUrl: string
}

function dispatchToast(message: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:toast', { detail: message }))
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
      } catch (err) {
        const name = (err as { name?: string }).name
        if (name !== 'AbortError') {
          try {
            await navigator.clipboard.writeText(`${text}\n${url}`)
            dispatchToast('Copied!')
            track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-text' })
          } catch {
            /* silent */
          }
        }
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      dispatchToast('Copied!')
      track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-text' })
    } catch {
      /* silent */
    }
  }, [date, text, url, modesPlayed])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      dispatchToast('Link copied')
      track('daily_shared', { date, modesPlayed: modesPlayed as 1 | 2, method: 'clipboard-link' })
    } catch {
      /* silent */
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
          className="flex-1 px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Share
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          data-testid="daily-share-copy-link"
          className="px-4 py-2 rounded-xl text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Copy link only
        </button>
      </div>
    </div>
  )
}
