/** Shared layout geometry. Tailwind class literals in the panel components
 *  cannot consume these constants, so layoutConstants.test.ts pins the class
 *  strings to these values — restyling a panel fails that test and names the
 *  constant to update (batch-2 spec §4.1). */
import type { PaddingOptions } from 'maplibre-gl'

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

/** Screen-space camera offset so the SINGLE-country fly-to centers in the
 *  area the open panel does not cover. Compare framing stopped consuming
 *  this in B6 (2026-07-28): an offset only shifts the center while
 *  cameraForBounds sizes zoom to the FULL viewport, so country B slid under
 *  the compare panel — comparePanelPadding() replaced it. */
export function panelScreenOffset(): [number, number] {
  if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return [-SINGLE_PANEL_FOOTPRINT_PX / 2, 0]
  return [0, -Math.round((window.innerHeight * SHEET_COLLAPSED_FRACTION) / 2)]
}

/** Breathing room around the framed compare pair on every un-occluded side. */
export const COMPARE_FRAME_PADDING_PX = 80

/** cameraForBounds padding that frames the compare pair in the area the
 *  compare panel does not cover (B6, 2026-07-28). Desktop reserves the panel
 *  footprint as extra `right` padding — cameraForBounds folds padding into
 *  BOTH zoom and center, which the replaced screen offset could not do.
 *  Mobile deliberately stays flat: the sheet-aware bottom padding
 *  (innerHeight × COMPARE_SHEET_FRACTION) ships with C6's compare-sheet
 *  redesign, which owns mobile compare framing (spec C6/G3). */
export function comparePanelPadding(): PaddingOptions {
  const panel = window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? COMPARE_PANEL_FOOTPRINT_PX : 0
  return {
    top: COMPARE_FRAME_PADDING_PX,
    bottom: COMPARE_FRAME_PADDING_PX,
    left: COMPARE_FRAME_PADDING_PX,
    right: COMPARE_FRAME_PADDING_PX + panel,
  }
}

/** ── A13 touch-target convention ────────────────────────────────────────
 * Coarse-pointer hit areas grow to >=44px (WCAG 2.5.5 / platform HIGs)
 * without changing glyphs or visible chrome: an invisible ::after overlay
 * extends the button's hit-test box (pseudo-elements hit-test as part of
 * their originating element). Gated to `pointer-coarse:` (tailwindcss >=4.1)
 * so desktop behavior is untouched — on fine pointers the ::after is a
 * zero-size box. Chosen over padding+negative-margin because padding also
 * grows the visible rounded hover pill, and negative margins fight the
 * gap-1 header rows and the absolutely-positioned search-clear button.
 * Interpolating these into className is scanner-safe: the whole class
 * tokens appear literally in this file. layoutConstants.test.ts pins the
 * strings and every consumer — restyling a target fails that test. */
export const TOUCH_TARGET_BASE = "after:absolute after:content-['']"

/** 36px sources — p-2 + w-5/h-5 icon buttons, the 36px-tall Continue CTA: 36 + 2·4 = 44. */
export const TOUCH_TARGET_FROM_36 = `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-1`

/** 24px search-clear (p-1 + w-4/h-4): 24 + 2·10 = 44. No `relative` — the
 *  consumer is itself `absolute`, which already positions the ::after. */
export const TOUCH_TARGET_FROM_24 = `${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-2.5`

/** 16px-tall text-xs buttons (HUD End game / Skip): 16 + 2·14 = 44 tall, ±8px wide. */
export const TOUCH_TARGET_TEXT_XS = `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3.5`

/** 22px compare-picking-cancel (SingleCountryPanel's picking-banner Cancel:
 *  p-1 -m-1 + w-3.5/h-3.5 icon): 22 + 2·11 = 44. Task 6 ledger finding — a
 *  review measured this button at ~22px, below the WCAG 2.5.8 floor and its
 *  44px siblings; A13 was scheduled last specifically to catch it. Uses an
 *  arbitrary inset because no default Tailwind spacing step lands on 11px
 *  (2.5 → 42px, short of the floor; 3 → 46px, more overlap with the banner
 *  text than needed). */
export const TOUCH_TARGET_FROM_22 = `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-[11px]`

/** 32px CompareCountryPanel header "Exit compare" button (Task 12/A15:
 *  px-3 py-1.5 + text-sm line box — width is already >44 from the label,
 *  only height is short): 32 + 2·6 = 44 tall. Uniform inset, same as the
 *  Continue CTA precedent of applying the constrained dimension's math to
 *  all four sides even though the other dimension is already oversized. */
export const TOUCH_TARGET_FROM_32 = `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-1.5`
