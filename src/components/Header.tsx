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
      <div className="flex items-center justify-between px-4 py-3">
        {/* Wordmark — desktop only, floating */}
        <div className="pointer-events-auto hidden lg:flex items-baseline mr-4 shrink-0">
          <span className="text-lg font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            polworldmap
          </span>
        </div>

        <div className="pointer-events-auto flex-1 max-w-md mx-auto lg:mx-0">
          <SearchBar countries={countries} onSelect={onSelect} />
        </div>

        <div className="pointer-events-auto ml-3">
          <ThemeToggle theme={theme} onCycle={onThemeCycle} />
        </div>
      </div>
    </header>
  )
}
