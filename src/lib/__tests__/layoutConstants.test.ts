/**
 * Drift alarm: Tailwind class literals cannot consume TS constants, so this
 * test pins the panel components' class strings to the layout constants the
 * camera code uses. If a panel is restyled, this fails and names the constant
 * to update — instead of the camera silently mis-framing (batch-2 spec §4.1).
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import singleCountryPanelSource from '../../components/SingleCountryPanel.tsx?raw'
import compareCountryPanelSource from '../../components/CompareCountryPanel.tsx?raw'
import useMediaQuerySource from '../../hooks/useMediaQuery.ts?raw'
import searchBarSource from '../../components/SearchBar.tsx?raw'
import closeButtonSource from '../../components/CloseButton.tsx?raw'
import hudShellSource from '../../game/shared/hud/HudShell.tsx?raw'
import cityGuessingHudSource from '../../game/modes/city-guessing/CityGuessingHud.tsx?raw'
import indexCssSource from '../../index.css?raw'
import indexHtmlSource from '../../../index.html?raw'
import {
  DESKTOP_MEDIA_QUERY,
  SINGLE_PANEL_FOOTPRINT_PX,
  COMPARE_PANEL_FOOTPRINT_PX,
  SHEET_COLLAPSED_FRACTION,
  COMPARE_SHEET_FRACTION,
  panelScreenOffset,
  COMPARE_FRAME_PADDING_PX,
  comparePanelPadding,
  TOUCH_TARGET_BASE,
  TOUCH_TARGET_FROM_36,
  TOUCH_TARGET_FROM_24,
  TOUCH_TARGET_TEXT_XS,
  TOUCH_TARGET_FROM_22,
  TOUCH_TARGET_FROM_32,
  TOUCH_TARGET_FROM_20,
  TOUCH_TARGET_MIN_PX,
} from '../layoutConstants'

afterEach(() => vi.unstubAllGlobals())

describe('layout constants ↔ panel classes drift alarm', () => {
  it('SingleCountryPanel width/inset/sheet classes match the constants', () => {
    expect(singleCountryPanelSource).toContain(`w-[${SINGLE_PANEL_FOOTPRINT_PX - 16}px]`) // 376 - right-4 inset
    expect(singleCountryPanelSource).toContain('right-4')
    // G1: dvh, not vh — the sheet and panelScreenOffset's innerHeight-based
    // camera math must agree as mobile browser toolbars collapse (the same
    // rule the compare sheet adopted in C6).
    expect(singleCountryPanelSource).toContain(`h-[${SHEET_COLLAPSED_FRACTION * 100}dvh]`) // collapsed sheet
    expect(singleCountryPanelSource).toContain('h-[80dvh]') // expanded sheet
  })

  it('CompareCountryPanel width/sheet classes match the constants', () => {
    expect(compareCountryPanelSource).toContain(`w-[${COMPARE_PANEL_FOOTPRINT_PX - 16}px]`)
    // C6: the compare sheet is dvh so the sheet and the camera's
    // innerHeight-based bottom padding agree under dynamic mobile toolbars.
    expect(compareCountryPanelSource).toContain(`h-[${COMPARE_SHEET_FRACTION * 100}dvh]`)
  })

  it('useMediaQuery default equals DESKTOP_MEDIA_QUERY', () => {
    expect(useMediaQuerySource).toContain(DESKTOP_MEDIA_QUERY)
  })

  it('panelScreenOffset centers the single-country fly-to in the un-occluded area', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    expect(panelScreenOffset()).toEqual([-SINGLE_PANEL_FOOTPRINT_PX / 2, 0])
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    vi.stubGlobal('innerHeight', 800)
    expect(panelScreenOffset()).toEqual([0, -160]) // 800 * 0.4 / 2
  })

  it('comparePanelPadding reserves the panel footprint on desktop, the compare sheet on mobile (B6/C6)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    expect(comparePanelPadding()).toEqual({
      top: COMPARE_FRAME_PADDING_PX,
      bottom: COMPARE_FRAME_PADDING_PX,
      left: COMPARE_FRAME_PADDING_PX,
      right: COMPARE_FRAME_PADDING_PX + COMPARE_PANEL_FOOTPRINT_PX,
    })
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    vi.stubGlobal('innerHeight', 800)
    // C6: the compare sheet covers the bottom COMPARE_SHEET_FRACTION of the
    // viewport — reserve it as bottom padding so cameraForBounds frames the
    // pair in the visible strip (replaces B6's deliberate flat 80px).
    expect(comparePanelPadding()).toEqual({
      top: COMPARE_FRAME_PADDING_PX,
      bottom: Math.round(800 * COMPARE_SHEET_FRACTION), // 640
      left: COMPARE_FRAME_PADDING_PX,
      right: COMPARE_FRAME_PADDING_PX,
    })
  })
})

describe('A13 touch-target convention drift alarm', () => {
  it('constants pin the coarse-pointer ::after mechanism and the inset math', () => {
    expect(TOUCH_TARGET_BASE).toBe("after:absolute after:content-['']")
    // 36px sources (p-2 + w-5/h-5 icon buttons, 36px-tall Continue): 36 + 2*4 = 44
    expect(TOUCH_TARGET_FROM_36).toBe(`relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-1`)
    // 24px search-clear (p-1 + w-4/h-4): 24 + 2*10 = 44. No `relative`: the
    // consumer is itself `absolute`, which already positions the ::after —
    // adding `relative` would conflict with stylesheet-order-dependent results.
    expect(TOUCH_TARGET_FROM_24).toBe(`${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-2.5`)
    // 16px-tall text-xs buttons: 16 + 2*14 = 44 tall; +-8px x for short labels
    expect(TOUCH_TARGET_TEXT_XS).toBe(
      `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3.5`,
    )
  })

  it('every touch surface references its convention constant', () => {
    expect(closeButtonSource).toContain('TOUCH_TARGET_FROM_36')
    expect(singleCountryPanelSource).toContain('TOUCH_TARGET_FROM_36')
    expect(searchBarSource).toContain('TOUCH_TARGET_FROM_24')
    expect(hudShellSource).toContain('TOUCH_TARGET_TEXT_XS')
    expect(cityGuessingHudSource).toContain('TOUCH_TARGET_TEXT_XS')
  })

  it('pins the base sizes the inset math assumes', () => {
    // CloseButton visual box: p-2 (2*8px) + w-5 h-5 (20px) = 36px
    expect(closeButtonSource).toContain('p-2 rounded-xl')
    expect(closeButtonSource).toContain('w-5 h-5')
    // HUD text buttons are text-xs (16px line box, no vertical padding)
    expect(hudShellSource).toContain('text-xs')
    expect(cityGuessingHudSource).toContain('text-xs')
  })

  it('SearchBar clear button pins load-bearing absolute class and base size', () => {
    // Clear button (p-1 + w-4 h-4 = 24px visual box) is `absolute` positioned,
    // which establishes the containing block for TOUCH_TARGET_FROM_24's ::after
    // overlay. Removing `absolute` would cause the ::after to re-anchor to a higher
    // positioned ancestor, silently mis-positioning the hit area. This test pins the
    // load-bearing class alongside the base size classes and constant.
    expect(searchBarSource).toContain('p-1')
    expect(searchBarSource).toContain('w-4 h-4')
    expect(searchBarSource).toContain('absolute')
    expect(searchBarSource).toContain('TOUCH_TARGET_FROM_24')
  })
})

describe('A13 supplemental touch targets (Task 6 ledger + Task 12 compare header)', () => {
  it('constants pin the inset math for the two out-of-brief-shape sources', () => {
    // 22px compare-picking-cancel (p-1 -m-1 + w-3.5/h-3.5): 22 + 2*11 = 44.
    // No standard Tailwind spacing step lands on 11px (2.5 -> 42, 3 -> 46),
    // so this uses an arbitrary inset to hit the floor exactly.
    expect(TOUCH_TARGET_FROM_22).toBe(
      `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-[11px]`,
    )
    // 32px "Exit compare" (px-3 py-1.5 + text-sm line box; width already
    // >44 from the label): 32 + 2*6 = 44 tall.
    expect(TOUCH_TARGET_FROM_32).toBe(
      `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-1.5`,
    )
  })

  it('the picking-banner Cancel and compare-header controls reference a convention constant', () => {
    expect(singleCountryPanelSource).toContain('TOUCH_TARGET_FROM_22')
    expect(compareCountryPanelSource).toContain('TOUCH_TARGET_FROM_36')
    expect(compareCountryPanelSource).toContain('TOUCH_TARGET_FROM_32')
  })

  it('pins the base sizes the supplemental inset math assumes', () => {
    // compare-picking-cancel visual box: p-1 (2*4px) + w-3.5 h-3.5 (14px) = 22px
    expect(singleCountryPanelSource).toContain('compare-picking-cancel')
    expect(singleCountryPanelSource).toContain('w-3.5 h-3.5')
    // Exit compare visual box: py-1.5 (2*6px) + text-sm line-height (20px) = 32px
    expect(compareCountryPanelSource).toContain('exit-compare')
    expect(compareCountryPanelSource).toContain('py-1.5')
    expect(compareCountryPanelSource).toContain('text-sm')
  })
})

describe('B7 map-control touch-target drift alarm', () => {
  it('index.css grows vendor ctrl buttons to the convention floor under pointer: coarse', () => {
    // MapLibre's ctrl buttons are vendor-built DOM — the Tailwind
    // TOUCH_TARGET_* class strings can't reach them, so index.css sizes
    // them directly. This pin ties the raw CSS to the named constant:
    // change either side and this test names the other.
    expect(TOUCH_TARGET_MIN_PX).toBe(44)
    // Normalize CRLF -> LF: Windows checkouts with core.autocrlf=true convert
    // the committed LF blob to CRLF on disk; the git blob (and CI's Linux
    // checkout) stay LF. Normalizing keeps this pin platform-agnostic.
    expect(indexCssSource.replace(/\r\n/g, '\n')).toContain(
      `@media (pointer: coarse) {
  .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
    min-width: ${TOUCH_TARGET_MIN_PX}px;
    min-height: ${TOUCH_TARGET_MIN_PX}px;
  }
}`,
    )
  })
})

describe('G1 sheet fundamentals drift alarm', () => {
  it('the sheet scroll container reserves the home-indicator inset and index.html opts into it', () => {
    // env(safe-area-inset-bottom) resolves to 0 unless the viewport meta
    // declares viewport-fit=cover — pin both halves so neither silently
    // breaks the other.
    expect(singleCountryPanelSource).toContain('pb-[env(safe-area-inset-bottom)]')
    expect(indexHtmlSource).toContain('viewport-fit=cover')
  })

  it('sheet grabber: TOUCH_TARGET_FROM_20 pins the A13 inset math and its consumer', () => {
    // 20px grabber visual box (py-2 = 2·8px + h-1 bar = 4px): 20 + 2·12 = 44.
    expect(TOUCH_TARGET_FROM_20).toBe(`relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-3`)
    expect(singleCountryPanelSource).toContain('TOUCH_TARGET_FROM_20')
    expect(singleCountryPanelSource).toContain('sheet-grabber')
    // Base sizes the inset math assumes.
    expect(singleCountryPanelSource).toContain('h-1 w-9')
  })
})
