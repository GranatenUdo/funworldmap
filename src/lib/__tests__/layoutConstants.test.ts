/**
 * @vitest-environment jsdom
 *
 * Drift alarm: Tailwind class literals cannot consume TS constants, so this
 * test pins the panel components' class strings to the layout constants the
 * camera code uses. If a panel is restyled, this fails and names the constant
 * to update — instead of the camera silently mis-framing (batch-2 spec §4.1).
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join } from 'path'
import {
  DESKTOP_MEDIA_QUERY,
  SINGLE_PANEL_FOOTPRINT_PX,
  COMPARE_PANEL_FOOTPRINT_PX,
  SHEET_COLLAPSED_FRACTION,
  COMPARE_SHEET_FRACTION,
  panelScreenOffset,
} from '../layoutConstants'

function componentSource(rel: string): string {
  // Use import.meta.dirname which is available in Node 20.12+ and works across environments
  const meta = import.meta as unknown as { dirname?: string; url: string }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const testDir: string = meta.dirname || fileURLToPath(new URL('.', meta.url))
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const path: string = join(testDir, '../../components', rel)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
  return readFileSync(path, 'utf8')
}

function sourceFrom(rel: string): string {
  // Read any file relative to the test directory
  const meta = import.meta as unknown as { dirname?: string; url: string }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const testDir: string = meta.dirname || fileURLToPath(new URL('.', meta.url))
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const path: string = join(testDir, rel)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
  return readFileSync(path, 'utf8')
}

afterEach(() => vi.unstubAllGlobals())

describe('layout constants ↔ panel classes drift alarm', () => {
  it('SingleCountryPanel width/inset/sheet classes match the constants', () => {
    const src = componentSource('SingleCountryPanel.tsx')
    expect(src).toContain(`w-[${SINGLE_PANEL_FOOTPRINT_PX - 16}px]`) // 376 - right-4 inset
    expect(src).toContain('right-4')
    expect(src).toContain(`h-[${SHEET_COLLAPSED_FRACTION * 100}vh]`) // collapsed sheet
  })

  it('CompareCountryPanel width/sheet classes match the constants', () => {
    const src = componentSource('CompareCountryPanel.tsx')
    expect(src).toContain(`w-[${COMPARE_PANEL_FOOTPRINT_PX - 16}px]`)
    expect(src).toContain(`h-[${COMPARE_SHEET_FRACTION * 100}vh]`)
  })

  it('useMediaQuery default equals DESKTOP_MEDIA_QUERY', () => {
    const src = sourceFrom('../../hooks/useMediaQuery.ts')
    expect(src).toContain(DESKTOP_MEDIA_QUERY)
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
