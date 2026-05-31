export type HashState =
  | { kind: 'empty' }
  | { kind: 'country'; cca3: string; compareWith: string | null }
  | { kind: 'game'; modeId: string }

export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { kind: 'empty' }

  // Legacy daily route prefix — treat as empty so #daily/... links land on the
  // launcher rather than the country parser (which would interpret the segments
  // as a malformed CCA3 code).
  if (clean === 'daily' || clean.startsWith('daily/')) return { kind: 'empty' }

  if (clean.startsWith('game/')) {
    const rest = clean.slice('game/'.length)
    if (!rest) return { kind: 'empty' }
    const modeId = rest.endsWith('/play') ? rest.slice(0, -'/play'.length) : rest
    return { kind: 'game', modeId }
  }

  const parts = clean.split(',').map((s) => s.trim().toUpperCase())
  const cca3 = parts[0] || ''
  if (!cca3) return { kind: 'empty' }
  const compareWith = parts[1] || null
  return { kind: 'country', cca3, compareWith }
}

export function writeHash(state: HashState): string {
  switch (state.kind) {
    case 'empty':
      return ''
    case 'country':
      return state.compareWith ? `${state.cca3},${state.compareWith}` : state.cca3
    case 'game':
      return `game/${state.modeId}`
  }
}
