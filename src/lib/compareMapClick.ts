/** A8 (2026-07-26 UX spec): MAP-click semantics while a compare pair is
 *  active. A third country replaces B; clicking A or the current B is a
 *  no-op — Escape and the compare header's Exit compare / × are the only
 *  exits. Scoped to map clicks: search and border chips keep select().
 *  Pure so the decision table is unit-testable without a map. */
export type CompareMapClickAction = { kind: 'replace-b'; cca3: string } | { kind: 'noop' }

export function compareMapClick(
  clickedCca3: string,
  selectedCca3: string,
  compareWithCca3: string,
): CompareMapClickAction {
  const code = clickedCca3.toUpperCase()
  if (code === selectedCca3 || code === compareWithCca3) return { kind: 'noop' }
  return { kind: 'replace-b', cca3: code }
}
