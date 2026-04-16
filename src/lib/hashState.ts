export interface HashState {
  selected: string | null
  compareWith: string | null
}

/** Parse URL hash (with or without leading #) into selected/compareWith country codes. */
export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { selected: null, compareWith: null }

  const parts = clean.split(',').map((s) => s.trim().toUpperCase())
  const selected = parts[0] || null
  const compareWith = parts[1] || null

  return { selected, compareWith }
}

/** Serialize state to hash string (without leading #). */
export function writeHash(selected: string | null, compareWith: string | null): string {
  if (!selected) return ''
  if (!compareWith) return selected
  return `${selected},${compareWith}`
}
