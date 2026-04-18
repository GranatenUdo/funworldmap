export type HashState =
  | { kind: 'empty' }
  | { kind: 'country'; cca3: string; compareWith: string | null }
  | { kind: 'game'; modeId: string; playing: boolean }

export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { kind: 'empty' }

  if (clean.startsWith('game/')) {
    const rest = clean.slice('game/'.length)
    if (!rest) return { kind: 'empty' }
    if (rest.endsWith('/play')) {
      const modeId = rest.slice(0, -'/play'.length)
      return { kind: 'game', modeId, playing: true }
    }
    return { kind: 'game', modeId: rest, playing: false }
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
      return state.playing ? `game/${state.modeId}/play` : `game/${state.modeId}`
  }
}
