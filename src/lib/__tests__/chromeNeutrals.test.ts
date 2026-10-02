/**
 * Drift alarm: app chrome uses the project's sand/dark ramps, never Tailwind's
 * raw numbered neutral palettes.
 *
 * This gate exists because MapErrorOverlay.tsx and main.tsx sat on raw `slate`
 * through the entire Observatory migration. The e-foundations task that swept
 * chrome accents cleared MapErrorOverlay as "no edit needed" — true on the
 * teal/coral criterion it was applying, blind to this one — and
 * designTokens.test.ts pins only index.css and mapPalette.ts, never components.
 * Nobody was watching this axis. See
 * docs/superpowers/specs/2026-08-08-graph-derived-fixes-design.md, Phase 4.
 *
 * Unlike designTokens.test.ts and layoutConstants.test.ts, which hand-list their
 * `?raw` imports, this scans via import.meta.glob. That is deliberate: a
 * hand-maintained list is exactly what failed here, since nobody would have
 * added MapErrorOverlay.tsx to it. Covering files that do not exist yet is the
 * point.
 *
 * Scope limit: this checks Tailwind *classes* in .ts/.tsx. It does not cover
 * src/index.css, which carries three raw slate-equivalent literals on the
 * tooltip and attribution chrome — rgba(51, 65, 85, 0.35), rgba(148, 163, 184,
 * 0.7) and #cbd5e1. Those are sanctioned: DESIGN.md's Navigation section states
 * the attribution pill and hover tooltip "wear the same light/dark chrome
 * literals".
 */
import { describe, expect, it } from 'vitest'

/**
 * Requires a leading hyphen so a class fragment (`bg-slate-900`,
 * `dark:bg-slate-950/90`) matches but bare prose does not — mapPalette.ts's
 * "(tailwind slate-950)" comment is not a violation.
 *
 * Residual, accepted: a comment spelling a full class name — `// bg-slate-950 is
 * retired` — would match. The failure is loud and self-explanatory, and the fix
 * is to reword the comment. Stripping comments before scanning is more machinery
 * than the risk earns.
 */
const RAW_NEUTRAL = /-(slate|gray|zinc|neutral|stone)-\d{2,3}/

/**
 * src-relative paths allowed to carry a raw neutral, each with its reason.
 * Keep this list at one entry if at all possible.
 */
const EXEMPT = new Map([
  ['lib/regionTints.ts', 'Antarctic region tint — a data encoding, not chrome'],
])

const modules = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', eager: true })

/**
 * '../../components/Foo.tsx' -> 'components/Foo.tsx'.
 *
 * Resolved against this file's own directory (src/lib/__tests__/) rather than
 * assumed to have a fixed '../../' prefix: import.meta.glob keys are a real
 * relative path from the glob call site, so a file at the same depth as this
 * test's parent dir (e.g. '../regionTints.ts', for src/lib/regionTints.ts) or
 * inside this dir (e.g. './designTokens.test.ts') needs the same '..'/'.'
 * resolution as any other relative path, not a naive fixed-prefix strip.
 */
function toSrcRelative(globKey: string): string {
  const parts = `lib/__tests__/${globKey}`.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') resolved.pop()
    else resolved.push(part)
  }
  return resolved.join('/')
}

describe('chrome uses the sand/dark ramps, not raw Tailwind neutrals', () => {
  it('scans a plausible number of source files', () => {
    // Guards against a glob that silently matches nothing — a green gate that
    // scanned zero files is worse than no gate.
    expect(Object.keys(modules).length).toBeGreaterThan(100)
  })

  it('finds no raw neutral palette class in src/**/*.{ts,tsx}', () => {
    const offenders: string[] = []

    for (const [globKey, mod] of Object.entries(modules)) {
      const path = toSrcRelative(globKey)
      if (path.includes('__tests__/')) continue
      if (EXEMPT.has(path)) continue

      const source = (mod as { default: string }).default
      source.split('\n').forEach((line, i) => {
        const hit = RAW_NEUTRAL.exec(line)
        if (hit) offenders.push(`src/${path}:${i + 1} — ${hit[0]}`)
      })
    }

    expect(
      offenders,
      `Raw Tailwind neutral classes found. Use the sand ramp (light) or dark ramp\n` +
        `(dark) instead — see DESIGN.md § Color. If this is a data encoding rather\n` +
        `than chrome, add the file to EXEMPT with a reason.\n\n` +
        offenders.map((o) => `  ${o}`).join('\n') +
        '\n',
    ).toEqual([])
  })

  it('each exemption is still real (no rotted allowlist)', () => {
    for (const path of EXEMPT.keys()) {
      const entry = Object.entries(modules).find(([k]) => toSrcRelative(k) === path)
      expect(entry, `EXEMPT lists ${path}, which no longer exists`).toBeDefined()
      const source = (entry![1] as { default: string }).default
      expect(RAW_NEUTRAL.test(source), `${path} is exempt but has no raw neutral`).toBe(true)
    }
  })
})
