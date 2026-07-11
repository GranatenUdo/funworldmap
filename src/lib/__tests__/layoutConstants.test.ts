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
import {
  DESKTOP_MEDIA_QUERY,
  SINGLE_PANEL_FOOTPRINT_PX,
  COMPARE_PANEL_FOOTPRINT_PX,
  SHEET_COLLAPSED_FRACTION,
  COMPARE_SHEET_FRACTION,
  panelScreenOffset,
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
