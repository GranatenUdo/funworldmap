# Calibrated fittings rollout — design

**Date:** 2026-08-03
**Author:** Tobias Ens (with Claude)
**Status:** Approved (owner: "proceed", 2026-08-03)

## Context

On 2026-08-03 the owner ran a three-direction live exploration of the component
philosophy on the country panel's header (calibrated & unobtrusive vs. tactile &
confident vs. glass & starlight) and accepted **calibrated & unobtrusive**. The
accepted header shipped the *fitting recipe*: in-panel controls as instrument
fittings — 1px hairline border `border-sand-300/65 dark:border-dark-200/70`, 8px
radius (`rounded-lg`), 16px glyphs (`w-4`), quiet tint hovers, ice-family focus
rings — plus a 15% ice hairline rule under the header and the corner-ticked
`.panel-flag-plate`. DESIGN.md's Components section records the decision.

This spec rolls the recipe through the remaining chrome the owner named: the
rest of the single panel, the compare panel, the HUD, and the launcher. It also
fixes the vitest exclude so `npm run check` stops sweeping Playwright specs in
`.claude/worktrees/**`.

## The fitting recipe (normative)

- **Fitted control:** `rounded-lg` + `border border-sand-300/65
  dark:border-dark-200/70`, transparent at rest, tint on hover (sand tint for
  neutral controls, `hover:bg-ice-dim/8 dark:hover:bg-ice/8` for ice-text
  controls), `w-4` glyphs, house focus ring
  (`focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50`).
- **Radius stratification:** in-card fittings are 8px; free-floating chrome
  (header chips, search, primary CTAs) stays 12px; pills remain only where the
  shape is a data encoding (badges) or an ambient message (toast/hint).
- **Rules:** solid hairlines, never dotted.
- **Plates:** country-identifying flags ≥56px wide sit on `.panel-flag-plate`
  corner ticks. Tiny flags (chips, mobile compact header) do not.

## Changes

1. **Single panel (rest):** dotted section dividers → solid (same tokens);
   inline close button → shared `CloseButton` (which becomes the fitting);
   in-game Continue grows to `py-2 text-sm` so its box honestly matches
   `TOUCH_TARGET_FROM_36` (the accepted variant's `py-1.5 text-[13px]` box was
   ~31px — a 44px-floor miss).
2. **`CloseButton` (shared):** default becomes the fitted recipe (`p-2
   rounded-lg` + fitting border + `w-4` glyph = 32px box →
   `TOUCH_TARGET_FROM_32`), gains the house focus ring it previously lacked.
   Consumers: SingleCountryPanel, CompareCountryPanel.
3. **`BorderChip`:** both sizes become fitted ice chips — `rounded-lg`, fitting
   border, transparent rest, `hover:bg-ice-dim/8 dark:hover:bg-ice/8` (scale
   hover dropped — calibrated controls don't pop), house focus ring added
   (previously UA-default outline). Inert spans follow the shape.
4. **Compare panel:** copy-link → fitted (`w-4`, `TOUCH_TARGET_FROM_32`);
   "Exit compare" → `rounded-lg` + fitting border + ice tint hover (`text-sm`
   and `py-1.5` unchanged — the FROM_32 inset math pins them); column-header
   flags (56×38) sit on `.panel-flag-plate`.
5. **HUD:** `ScoreBadge` border sharpens to the fitting alphas
   (`border-sand-300/65 dark:border-dark-200/70`); shape unchanged (E8 owns any
   future tick-frame/radius change). StreakBadge's signal border is a data
   encoding — untouched.
6. **Launcher:** the dismiss control drops its circle for `rounded-lg` +
   `border-white/15` (it floats on the dark backdrop, so the sand fitting
   tokens don't apply). Mode cards untouched — E6 owns launcher card identity.
7. **vitest:** add `.claude/**` to the `test.exclude` list in `vite.config.ts`
   (the existing `.worktrees/**` entry predates the `.claude/worktrees/`
   location).

## Non-goals

- Panel label/value typography migration (`.text-label` 0.12em tracking, mono
  values) — workstream D's D1/D2 own the panel data redesign.
- Launcher mode-card identity (E6), HUD tick frames and readout radii (E8).
- The launcher dismiss button's sub-44px coarse-pointer box (pre-existing; no
  touch-target constant fits an absolutely-positioned 36px consumer — noted,
  not fixed here).
- Header chips, search, primary CTA recipes — they are floating chrome, not
  in-card fittings.

## Test impact

`layoutConstants.test.ts` pins move with the code: CloseButton's constant
(FROM_36 → FROM_32) and base-size pins (`p-2 rounded-lg`, `w-4 h-4`, 32px box
math); CompareCountryPanel's FROM_36 pin (copy-link is now FROM_32; FROM_36
leaves the file). SingleCountryPanel keeps FROM_36 (Continue) and FROM_22
(picking-banner cancel). Behavior tests (BorderChip, chromeAccent, C5 compare
entry) are unaffected or already updated. Verification: `npm run check` green
(with the worktree exclude), plus a live pass on desktop + 390px mobile, both
themes.
