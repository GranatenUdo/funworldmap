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
import {
  DESKTOP_MEDIA_QUERY,
  SINGLE_PANEL_FOOTPRINT_PX,
  COMPARE_PANEL_FOOTPRINT_PX,
  SHEET_COLLAPSED_FRACTION,
  COMPARE_SHEET_FRACTION,
  panelScreenOffset,
  TOUCH_TARGET_BASE,
  TOUCH_TARGET_FROM_36,
  TOUCH_TARGET_FROM_24,
  TOUCH_TARGET_TEXT_XS,
  TOUCH_TARGET_FROM_22,
  TOUCH_TARGET_FROM_32,
} from '../layoutConstants'

afterEach(() => vi.unstubAllGlobals())

describe('layout constants ↔ panel classes drift alarm', () => {
  it('SingleCountryPanel width/inset/sheet classes match the constants', () => {
    expect(singleCountryPanelSource).toContain(`w-[${SINGLE_PANEL_FOOTPRINT_PX - 16}px]`) // 376 - right-4 inset
    expect(singleCountryPanelSource).toContain('right-4')
    expect(singleCountryPanelSource).toContain(`h-[${SHEET_COLLAPSED_FRACTION * 100}vh]`) // collapsed sheet
  })

  it('CompareCountryPanel width/sheet classes match the constants', () => {
    expect(compareCountryPanelSource).toContain(`w-[${COMPARE_PANEL_FOOTPRINT_PX - 16}px]`)
    expect(compareCountryPanelSource).toContain(`h-[${COMPARE_SHEET_FRACTION * 100}vh]`)
  })

  it('useMediaQuery default equals DESKTOP_MEDIA_QUERY', () => {
    expect(useMediaQuerySource).toContain(DESKTOP_MEDIA_QUERY)
  })

  it('panelScreenOffset centers in the un-occluded area', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    expect(panelScreenOffset('single')).toEqual([-SINGLE_PANEL_FOOTPRINT_PX / 2, 0])
    expect(panelScreenOffset('compare')).toEqual([-COMPARE_PANEL_FOOTPRINT_PX / 2, 0])
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    vi.stubGlobal('innerHeight', 800)
    expect(panelScreenOffset('single')).toEqual([0, -160]) // 800 * 0.4 / 2
    expect(panelScreenOffset('compare')).toEqual([0, -320]) // 800 * 0.8 / 2
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
