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
    <header className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3 backdrop-blur-sm bg-white/80 dark:bg-slate-900/80">
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
