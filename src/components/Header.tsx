import SearchBar from './SearchBar'
import ThemeToggle from './ThemeToggle'
import type { CountryData } from '../lib/types'
import type { Theme } from '../hooks/useTheme'

interface Props {
  countries: CountryData[]
  theme: Theme
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
}

export default function Header({ countries, theme, onSelect, onThemeCycle }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-4 backdrop-blur-lg bg-white/75 dark:bg-[#0d1117]/75 border-b border-ground-200/50 dark:border-void-200/30">
        {/* Wordmark — desktop only */}
        <div className="pointer-events-auto hidden lg:flex items-baseline gap-1.5 mr-4 shrink-0">
          <span className="font-display text-xl text-ground-900 dark:text-void-50 tracking-tight">
            polworldmap
          </span>
        </div>

        <div className="pointer-events-auto flex-1 max-w-md">
          <SearchBar countries={countries} onSelect={onSelect} />
        </div>

        <div className="pointer-events-auto ml-3">
          <ThemeToggle theme={theme} onCycle={onThemeCycle} />
        </div>
      </div>
    </header>
  )
}
