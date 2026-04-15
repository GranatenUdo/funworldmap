export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3 backdrop-blur-sm bg-white/80 dark:bg-slate-900/80">
        {/* Search placeholder — replaced in Phase 4 */}
        <div className="pointer-events-auto flex-1 max-w-md">
          <div className="px-4 py-2 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm">
            Search countries, capitals, regions...
          </div>
        </div>

        {/* Theme toggle placeholder — replaced in Phase 5 */}
        <div className="pointer-events-auto ml-3">
          <div className="w-10 h-10 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700" />
        </div>
      </div>
    </header>
  )
}
