/** Shared layout geometry. Tailwind class literals in the panel components
 *  cannot consume these constants, so layoutConstants.test.ts pins the class
 *  strings to these values — restyling a panel fails that test and names the
 *  constant to update (batch-2 spec §4.1). */

/** Must match useMediaQuery's default query. */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'

/** Fine-pointer capability gate (spec A11/A14): keyboard-shortcut affordances
 *  render only where a hover-capable fine pointer (mouse/trackpad) exists. */
export const FINE_POINTER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)'

/** SingleCountryPanel: right-4 (16px) + w-[360px]. */
export const SINGLE_PANEL_FOOTPRINT_PX = 376

/** CompareCountryPanel: right-4 (16px) + w-[656px]. */
export const COMPARE_PANEL_FOOTPRINT_PX = 672

/** Mobile bottom sheet, collapsed single-country state: h-[40vh]. */
export const SHEET_COLLAPSED_FRACTION = 0.4

/** Mobile compare / expanded sheet: h-[80vh]. */
export const COMPARE_SHEET_FRACTION = 0.8

/** Screen-space camera offset so a fly-to target centers in the area the
 *  open panel does not cover. */
export function panelScreenOffset(kind: 'single' | 'compare'): [number, number] {
  const footprint = kind === 'compare' ? COMPARE_PANEL_FOOTPRINT_PX : SINGLE_PANEL_FOOTPRINT_PX
  if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return [-footprint / 2, 0]
  const fraction = kind === 'compare' ? COMPARE_SHEET_FRACTION : SHEET_COLLAPSED_FRACTION
  return [0, -Math.round((window.innerHeight * fraction) / 2)]
}
