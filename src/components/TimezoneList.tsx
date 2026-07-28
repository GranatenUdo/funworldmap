import { useState } from 'react'

const COLLAPSED_COUNT = 3

/** Timezones value with overflow folding: France's 14 UTC offsets dominated
 *  the panel as a 4-line dump (2026-07-10 review; batch-2 spec §2.4). */
export function TimezoneList({ timezones }: { timezones: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (timezones.length <= COLLAPSED_COUNT) return <>{timezones.join(', ')}</>
  const shown = expanded ? timezones : timezones.slice(0, COLLAPSED_COUNT)
  return (
    <>
      {shown.join(', ')}{' '}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="text-ice-accessible dark:text-ice text-xs underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/40 dark:focus-visible:ring-ice/40 rounded"
      >
        {expanded ? 'Show less' : `+${timezones.length - COLLAPSED_COUNT} more`}
      </button>
    </>
  )
}
