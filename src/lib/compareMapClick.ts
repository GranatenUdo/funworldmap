/** Compare-pair click semantics — pure so the decision tables are
 *  unit-testable without a map.
 *
 *  compareMapClick — A8 (2026-07-26 UX spec): MAP clicks while a compare
 *  pair is active. A third country replaces B; clicking A or the current B
 *  is a no-op — Escape and the compare header's Exit compare / × are the
 *  only exits. Search keeps select().
 *
 *  compareChipClick — C1 (A8's descoped border-chip clause): border chips
 *  INSIDE the compare panel are column-scoped. A chip in column A replaces
 *  A (keeping B, via useSelectedCountry.compareReplaceA); a chip in column
 *  B replaces B (keeping A, via compareSelect); a chip naming the OTHER
 *  column's country is a no-op (an X-vs-X pair is meaningless). */
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

export type CompareColumn = 'a' | 'b'

export type CompareChipClickAction =
  | { kind: 'replace-a'; cca3: string }
  | { kind: 'replace-b'; cca3: string }
  | { kind: 'noop' }

export function compareChipClick(
  column: CompareColumn,
  clickedCca3: string,
  selectedCca3: string,
  compareWithCca3: string,
): CompareChipClickAction {
  const code = clickedCca3.toUpperCase()
  if (code === selectedCca3 || code === compareWithCca3) return { kind: 'noop' }
  return column === 'a' ? { kind: 'replace-a', cca3: code } : { kind: 'replace-b', cca3: code }
}
