import SearchBar from './SearchBar'
import type { CountryData } from '../lib/types'

interface Props {
  countries: CountryData[]
  onSelect: (cca3: string) => void
}

export default function Header({ countries, onSelect }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3 backdrop-blur-sm bg-white/80 dark:bg-slate-900/80">
        <div className="pointer-events-auto flex-1 max-w-md">
          <SearchBar countries={countries} onSelect={onSelect} />
        </div>

        {/* Theme toggle placeholder — replaced in Phase 5 */}
        <div className="pointer-events-auto ml-3">
          <div className="w-10 h-10 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700" />
        </div>
      </div>
    </header>
  )
}
