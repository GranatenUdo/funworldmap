export type HashState =
  | { kind: 'empty' }
  | { kind: 'country'; cca3: string; compareWith: string | null }
  | { kind: 'game'; modeId: string }
  | { kind: 'daily'; date: string; modeId: string | null; reveal: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_MODE_IDS = new Set(['country-pinning', 'city-guessing'])

export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { kind: 'empty' }

  if (clean === 'daily' || clean === 'daily/') return { kind: 'empty' }
  if (clean.startsWith('daily/')) {
    const parts = clean.slice('daily/'.length).split('/').filter(Boolean)
    const [date, second, third] = parts
    if (!date || !DATE_RE.test(date)) return { kind: 'empty' }
    if (parts.length === 1) return { kind: 'daily', date, modeId: null, reveal: false }
    if (parts.length === 2) {
      if (second === 'reveal') return { kind: 'daily', date, modeId: null, reveal: true }
      if (KNOWN_MODE_IDS.has(second)) return { kind: 'daily', date, modeId: second, reveal: false }
      return { kind: 'empty' }
    }
    if (parts.length === 3) {
      if (KNOWN_MODE_IDS.has(second) && third === 'reveal') {
        return { kind: 'daily', date, modeId: second, reveal: true }
      }
      return { kind: 'empty' }
    }
    return { kind: 'empty' }
  }

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
    case 'daily': {
      let out = `daily/${state.date}`
      if (state.modeId) out += `/${state.modeId}`
      if (state.reveal) out += '/reveal'
      return out
    }
  }
}
