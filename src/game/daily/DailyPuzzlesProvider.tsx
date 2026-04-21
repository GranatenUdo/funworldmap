import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useDailyPuzzles, type UseDailyPuzzles } from './useDailyPuzzles'

// eslint-disable-next-line react-refresh/only-export-components
export const DailyPuzzlesContext = createContext<UseDailyPuzzles | null>(null)

export function DailyPuzzlesProvider({ children }: { children: ReactNode }) {
  const value = useDailyPuzzles()
  return <DailyPuzzlesContext.Provider value={value}>{children}</DailyPuzzlesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDailyPuzzlesContext(): UseDailyPuzzles {
  const ctx = useContext(DailyPuzzlesContext)
  if (!ctx) throw new Error('useDailyPuzzlesContext must be used within <DailyPuzzlesProvider>')
  return ctx
}
