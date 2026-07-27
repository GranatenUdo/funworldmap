/** Cursor→tooltip gap, in px. Was the hardcoded `+15` in useMapInteractions. */
export const TOOLTIP_CURSOR_OFFSET = 15

export interface TooltipPositionInput {
  /** Cursor position in map-container coordinates (maplibre `e.point`). */
  x: number
  y: number
  tooltipWidth: number
  tooltipHeight: number
  containerWidth: number
  containerHeight: number
}

/**
 * Clamp-and-flip tooltip placement (2026-07 UX audit item A10). Preferred
 * position is below-right of the cursor; when that would overflow the map
 * container's right/bottom edge the tooltip flips to the opposite side of the
 * cursor, and the result is finally clamped into the container box so the
 * tooltip can never be clipped.
 */
export function clampTooltipPosition({
  x,
  y,
  tooltipWidth,
  tooltipHeight,
  containerWidth,
  containerHeight,
}: TooltipPositionInput): { left: number; top: number } {
  let left = x + TOOLTIP_CURSOR_OFFSET
  if (left + tooltipWidth > containerWidth) left = x - TOOLTIP_CURSOR_OFFSET - tooltipWidth
  left = Math.min(Math.max(left, 0), Math.max(containerWidth - tooltipWidth, 0))

  let top = y + TOOLTIP_CURSOR_OFFSET
  if (top + tooltipHeight > containerHeight) top = y - TOOLTIP_CURSOR_OFFSET - tooltipHeight
  top = Math.min(Math.max(top, 0), Math.max(containerHeight - tooltipHeight, 0))

  return { left, top }
}
