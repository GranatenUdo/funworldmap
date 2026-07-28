/**
 * Drift alarm: the E4 two-accent tokens (ice / signal), the E2 type-role
 * utilities, and the backdrop hex-tile stroke live in raw CSS that no
 * TypeScript import can see, so this test pins them by source text (the
 * layoutConstants.test.ts pattern). If a token value or utility block is
 * edited, this fails and names the spec item to reconcile
 * (docs/superpowers/specs/2026-07-26-ux-visual-program-design.md, E2/E4).
 */
import { describe, expect, it } from 'vitest'
import indexCssSource from '../../index.css?raw'
import mapPaletteSource from '../mapPalette.ts?raw'

// Normalize CRLF -> LF: Windows checkouts with core.autocrlf=true convert
// the committed LF blob to CRLF on disk; the git blob (and CI's Linux
// checkout) stay LF. Normalizing keeps these pins platform-agnostic.
const css = indexCssSource.replace(/\r\n/g, '\n')

describe('E4 accent tokens (index.css @theme)', () => {
  it('defines the ice ramp (sky-200/300/700)', () => {
    expect(css).toContain('--color-ice: #7dd3fc;')
    expect(css).toContain('--color-ice-light: #bae6fd;')
    expect(css).toContain('--color-ice-dim: #0369a1;')
  })

  it('defines the AA light-mode ice text variant (sky-800)', () => {
    // 7.4:1 on sand-50, 7.1:1 on sand-100, 7.6:1 on white — see the
    // contrast math in the token's own comment in index.css.
    expect(css).toContain('--color-ice-accessible: #075985;')
  })

  it('defines the signal ramp', () => {
    expect(css).toContain('--color-signal: #ff8a4c;')
    expect(css).toContain('--color-signal-dim: #f97316;')
    expect(css).toContain('--color-signal-accessible: #9a3412;')
  })

  it('teal/coral tokens are retired — the tranche-3 sweep task deleted them', () => {
    // The tranche-3 final sweep task deleted the teal and coral token
    // blocks once its grep gate proved zero usages remained. This pin is
    // inverted from the original "survive until" assertion (see git
    // history) — their reintroduction must fail loudly.
    expect(css).not.toContain('--color-teal: #14b8a6;')
    expect(css).not.toContain('--color-coral: #f43f5e;')
  })
})

describe('E4 retirement drift alarm — the teal/coral system must stay gone', () => {
  // Retired brand hexes: teal #14b8a6, teal-light #5eead4, teal-dim #0d9488,
  // teal-accessible #065f56, the dark attribution-link teal #7dd3c0,
  // coral #f43f5e, coral-light #fb7185, coral-dim #e11d48, and the amber
  // reveal #f59e0b (absorbed into the signal family by E4). The Oceania
  // region badge's teal-100/-300/-800/-900 classes are Tailwind's default
  // numbered palette (a region-keyed data encoding), NOT these tokens.
  const RETIRED_HEXES = [
    '14b8a6',
    '5eead4',
    '0d9488',
    '065f56',
    '7dd3c0',
    'f43f5e',
    'fb7185',
    'e11d48',
    'f59e0b',
  ]

  it('@theme defines no --color-teal* or --color-coral* tokens (and nothing references them)', () => {
    expect(css).not.toMatch(/--color-teal/)
    expect(css).not.toMatch(/--color-coral/)
  })

  it('index.css carries no retired hex literal (includes the hex-tile backdrop data URI)', () => {
    for (const hex of RETIRED_HEXES) {
      expect(css.toLowerCase(), `retired hex #${hex} still in index.css`).not.toContain(hex)
    }
  })

  it('mapPalette exports no TEAL/CORAL constants and no retired hex', () => {
    // Matches `export const TEAL...`/`export const CORAL...` specifically —
    // not a bare /TEAL|CORAL/ scan, which would false-positive on the
    // file's own legitimate retirement-prose comments (e.g. "ex TEAL_LIGHT
    // role", "Teal and coral are retired (E4)").
    expect(mapPaletteSource).not.toMatch(/export const \w*(TEAL|CORAL)/)
    for (const hex of RETIRED_HEXES) {
      expect(
        mapPaletteSource.toLowerCase(),
        `retired hex #${hex} still in mapPalette.ts`,
      ).not.toContain(hex)
    }
  })

  it('compare badges consume the E4 tokens — badge ↔ map-fill match is by token, not copied hex', () => {
    // .compare-badge-b consumes plain --color-ice, not --color-ice-dim —
    // see mapPalette.ts's ICE_MID doc for why that divergence is
    // intentional and stays (T2's accessibility fix; adjudicated by this
    // task).
    expect(css).toContain('background: var(--color-signal)')
    expect(css).toContain('background: var(--color-ice)')
  })

  it('dark attribution hover consumes the ice-light token, not a raw hex', () => {
    expect(css).toContain(`.dark .maplibregl-map .maplibregl-ctrl-attrib a:hover {
  color: var(--color-ice-light);
}`)
  })
})

describe('E2 type-role utilities (index.css)', () => {
  it('.text-readout is the system mono stack with tabular figures', () => {
    expect(css).toContain(`.text-readout {
    font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }`)
  })

  it('.text-display is Outfit 700 with tight tracking', () => {
    expect(css).toContain(`.text-display {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.025em;
  }`)
  })

  it('.text-label is 11px uppercase with 0.12em tracking', () => {
    expect(css).toContain(`.text-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }`)
  })
})

describe('backdrop hex-tile stroke (E4 interim recolor, replaced by E1)', () => {
  it('strokes the hex grid in ice, not retired teal-light', () => {
    expect(css).toContain("stroke='%237dd3fc'")
    expect(css).not.toContain("stroke='%235eead4'")
  })
})
