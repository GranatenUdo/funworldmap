const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[\da-fA-F]+|[a-zA-Z]+);/g, (match, inner) => {
    if (inner.startsWith('#x') || inner.startsWith('#X')) {
      const code = parseInt(inner.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (inner.startsWith('#')) {
      const code = parseInt(inner.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[inner] ?? match
  })
}

export function sanitise(html: string): string {
  if (!html) return ''
  const stripped = html.replace(/<[^>]+>/g, '')
  const decoded = decodeEntities(stripped)
  const collapsed = decoded.replace(/\s+/g, ' ')
  return collapsed.trim() || collapsed
}
