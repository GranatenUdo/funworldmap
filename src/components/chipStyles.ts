/** Inert (non-interactive) chip styling — BorderChip's unmatched border
 *  codes, reused by SingleCountryPanel's landlocked/coastal fact chip (D3).
 *  Contrast (both AA): light sand-600 #6b6459 on sand-200 #f0ebe3 = 4.93:1;
 *  dark dark-100 #94a3b8 on dark-300 #1e2430 = 6.07:1.
 *
 *  Lives in its own module rather than BorderChip.tsx: a non-component
 *  export from a component file trips react-refresh/only-export-components
 *  (the exceptionBadge.ts precedent — extracted from SingleCountryPanel for
 *  the same reason). */
export const INERT_CHIP_CLASSES = {
  panel:
    'px-2.5 py-1.5 text-xs rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
  compare:
    'px-2 py-0.5 text-[11px] rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
} as const
