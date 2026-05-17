import { useEffect, useState } from 'react'

export interface NextDailyCountdown {
  hours: number
  minutes: number
}

function compute(now: Date): NextDailyCountdown {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
  const diffMs = next.getTime() - now.getTime()
  const totalMinutes = Math.floor(diffMs / 60_000)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

export function useNextDailyCountdown(): NextDailyCountdown {
  const [value, setValue] = useState<NextDailyCountdown>(() => compute(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setValue(compute(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return value
}
