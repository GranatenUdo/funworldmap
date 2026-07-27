import { describe, expect, it } from 'vitest'
import { clampTooltipPosition, TOOLTIP_CURSOR_OFFSET } from '../tooltipPosition'

const box = { containerWidth: 800, containerHeight: 600 }
const size = { tooltipWidth: 160, tooltipHeight: 44 }

describe('clampTooltipPosition', () => {
  it('places the tooltip below-right of the cursor when there is room', () => {
    expect(clampTooltipPosition({ x: 100, y: 100, ...size, ...box })).toEqual({
      left: 100 + TOOLTIP_CURSOR_OFFSET,
      top: 100 + TOOLTIP_CURSOR_OFFSET,
    })
  })

  it('flips to the left of the cursor at the right edge', () => {
    const { left } = clampTooltipPosition({ x: 780, y: 100, ...size, ...box })
    expect(left).toBe(780 - TOOLTIP_CURSOR_OFFSET - size.tooltipWidth) // 605
    expect(left + size.tooltipWidth).toBeLessThanOrEqual(box.containerWidth)
  })

  it('flips above the cursor at the bottom edge', () => {
    const { top } = clampTooltipPosition({ x: 100, y: 590, ...size, ...box })
    expect(top).toBe(590 - TOOLTIP_CURSOR_OFFSET - size.tooltipHeight) // 531
    expect(top + size.tooltipHeight).toBeLessThanOrEqual(box.containerHeight)
  })

  it('clamps to the container origin when even the flipped position would overflow', () => {
    // Tooltip larger than the container: flip goes negative → clamp to 0.
    const out = clampTooltipPosition({ x: 4, y: 4, tooltipWidth: 900, tooltipHeight: 700, ...box })
    expect(out.left).toBe(0)
    expect(out.top).toBe(0)
  })

  it('never returns a position outside the container box', () => {
    for (const x of [0, 400, 800]) {
      for (const y of [0, 300, 600]) {
        const { left, top } = clampTooltipPosition({ x, y, ...size, ...box })
        expect(left).toBeGreaterThanOrEqual(0)
        expect(top).toBeGreaterThanOrEqual(0)
        expect(left + size.tooltipWidth).toBeLessThanOrEqual(box.containerWidth)
        expect(top + size.tooltipHeight).toBeLessThanOrEqual(box.containerHeight)
      }
    }
  })
})
