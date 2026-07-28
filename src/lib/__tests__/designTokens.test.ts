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

// Normalize CRLF -> LF: Windows checkouts with core.autocrlf=true convert
// the committed LF blob to CRLF on disk; the git blob (and CI's Linux
// checkout) stay LF. Normalizing keeps these pins platform-agnostic.
const css = indexCssSource.replace(/\r\n/g, '\n')

describe('E4 accent tokens (index.css @theme)', () => {
  it('defines the ice ramp (sky-200/300/400)', () => {
    expect(css).toContain('--color-ice: #7dd3fc;')
    expect(css).toContain('--color-ice-light: #bae6fd;')
    expect(css).toContain('--color-ice-dim: #38bdf8;')
  })

  it('defines the AA light-mode ice text variant (sky-800)', () => {
    // 7.4:1 on sand-50, 7.1:1 on sand-100, 7.6:1 on white — see the
    // contrast math in the token's own comment in index.css.
    expect(css).toContain('--color-ice-accessible: #075985;')
  })

  it('defines the signal ramp', () => {
    expect(css).toContain('--color-signal: #ff8a4c;')
    expect(css).toContain('--color-signal-dim: #f97316;')
  })

  it('teal/coral tokens survive until the final sweep task of this plan', () => {
    // HANDOFF: the tranche-3 final sweep task deletes the teal and coral
    // token blocks once its grep gate proves zero usages remain, and
    // INVERTS these two pins to not.toContain in the same commit. Until
    // then their premature removal must fail loudly — components still
    // reference them.
    expect(css).toContain('--color-teal: #14b8a6;')
    expect(css).toContain('--color-coral: #f43f5e;')
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
