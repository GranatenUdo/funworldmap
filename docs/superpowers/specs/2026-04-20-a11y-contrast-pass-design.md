# A11y + Contrast Pass

**Date:** 2026-04-20
**Status:** Draft — pending user review
**Depends on:** none
**History:** This file was originally drafted on the same date as `2026-04-20-foundation-typography-design.md` ("Foundation — Typography Pairing, Paper Panel, Micro-Type Floor"). During brainstorming the scope was pared back to a narrow a11y/contrast pass after the user clarified that the product is game-first, not reference-first, making the paper-and-serif direction premature. The filename was changed accordingly; the Foundation draft does not exist as a separate file. Serif and paper-tone moves are deferred pending a separate game-first brainstorm.

## Overview

A narrow accessibility and contrast improvement. Three small fixes that stand on their own merit regardless of the product's overall visual direction:

1. **Micro-typography floor.** Raise every `text-[10px]` region badge to `text-[11px]`. Three locations.
2. **Meta-color contrast bump.** Replace `text-sand-500` (#8c8578) with `text-sand-600` (#6b6459) on panel-surface meta copy so WCAG AA (4.5:1) is met against the light-mode panel background. Five edits in two files.
3. **Tabular figures on data values.** Add `font-variant-numeric: tabular-nums` to the shared `DataCell` value `<div>` so populations, areas, and other numeric fields align vertically when stacked in compare view.

No behavior changes. No new features. No typography or color direction shifts. No map or game-HUD changes. This is a focused a11y/craft pass.

---

## Why this is narrow

The brainstorming session that produced this spec initially aimed at a broader "Foundation" redesign: a system-serif display face on the wordmark and country-name `h2`, a paper-toned light-mode panel surface, and micro-typography fixes, under a "Cartographer's Table" direction. During second-pass review, the user clarified that the product is **game-first**, not reference-first. Editorial atlas dressing on non-game surfaces is the wrong investment of a first redesign phase when the game HUD and landing-state experience haven't been designed for.

This spec salvages only the moves that are product-direction-neutral: accessibility and consistency fixes that any version of the product benefits from. The serif and paper-tone moves are deferred to a future spec that follows a proper game-first brainstorm.

---

## Confirmed scope

### Micro-typography floor

Raise minimum font-size from 10px to 11px. Three locations, verified via grep of `text-\[10px\]`:

- `src/components/SingleCountryPanel.tsx:130` — country-panel region badge
- `src/components/CountryColumn.tsx:58` — compare-column region badge
- `src/components/SearchBar.tsx:173` — search-result region badge

All three become `text-[11px]`. No layout impact expected: each sits inside an already-padded rounded-full container that accommodates the 1px size change.

### Meta-color contrast bump

Replace `text-sand-500` with `text-sand-600` on panel-surface meta copy. Contrast math: sand-500 (#8c8578) on sand-50 (#fefdfb) ≈ 4.0:1 (fails WCAG AA for body text at 11–12px); sand-600 (#6b6459) on sand-50 ≈ 6.0:1 (passes AA).

Affected lines (grep-verified):

- `src/components/SingleCountryPanel.tsx:120` — official-name text
- `src/components/SingleCountryPanel.tsx:158` — share-link button icon
- `src/components/SingleCountryPanel.tsx:170` — mobile expand button icon
- `src/components/SingleCountryPanel.tsx:299` — unknown-border code chip text
- `src/components/CloseButton.tsx:9` — close-button icon (shared component, consumed only by `SingleCountryPanel` and `CountryColumn`; grep confirms no other consumers)

Every affected line is paired with `dark:text-dark-100`. The bump only swaps the `text-sand-500` half; the `dark:` half is preserved verbatim. Dark mode is unchanged — `dark-100` already hits adequate contrast on dark surfaces.

**Out-of-scope `text-sand-500` usages (intentionally not bumped):**

- `src/components/Header.tsx:69` (satellite toggle button on body canvas)
- `src/components/PlayMenu.tsx:87` (popover surface)
- `src/components/SearchBar.tsx:168, 184` (dropdown surface)
- `src/components/ThemeToggle.tsx:33` (header icon)
- `src/components/CountryColumn.tsx` (no `text-sand-500` usages; region-badge color is already `sand-600`)

These surfaces may warrant their own contrast review later but are outside the panel-meta scope of this spec.

### Tabular figures on data values

Add `font-variant-numeric: tabular-nums` to the shared `DataCell` value `<div>` at `src/components/SingleCountryPanel.tsx:33`. One line changes. Applies to every field value rendered through `DataCell`: Population, Area, Government, UN Member, Independent, Languages, Currencies, Timezones. Non-numeric text in Outfit is visually unaffected by tabular-nums; numeric text gains vertical column alignment in compare view.

Implementation: either the Tailwind utility class `tabular-nums` (supported natively) on the value `<div>`, or a `style={{ fontVariantNumeric: 'tabular-nums' }}` prop — whichever matches the surrounding codebase's convention better. Prefer the utility class for consistency with existing Tailwind usage.

---

## Architecture & files touched

### Added

- `e2e/a11y-contrast.spec.ts` — new Playwright spec (see Testing).

### Modified

- `src/components/SingleCountryPanel.tsx` — six edits: one region-badge size bump (line 130), four `text-sand-500` → `text-sand-600` swaps (lines 120, 158, 170, 299), one `tabular-nums` addition on `DataCell` value `<div>` (line 33).
- `src/components/CountryColumn.tsx` — one edit: region-badge size bump at line 58.
- `src/components/SearchBar.tsx` — one edit: region-badge size bump at line 173.
- `src/components/CloseButton.tsx` — one edit: `text-sand-500` → `text-sand-600` at line 9.

### Explicitly not touched

- `src/index.css` — no CSS-variable or `@font-face` changes.
- `index.html` — no preload changes.
- `src/components/Header.tsx`, `PlayMenu.tsx`, `Toast.tsx`, `ThemeToggle.tsx`, `BasemapBanner.tsx`, `MapErrorOverlay.tsx`, `SourceTooltip.tsx`, `FieldLabel.tsx`, `CompareCountryPanel.tsx`.
- `src/lib/**`, `src/game/**`, `src/hooks/**`.
- All map-related files.
- All game-HUD files.

---

## Testing

### Automated

New Playwright spec `e2e/a11y-contrast.spec.ts`:

- Select a country. Assert `getComputedStyle(regionBadge).fontSize` is `>= 11px`.
- Enter compare mode. Assert both column region-badges are also `>= 11px`.
- Type a query in the search bar. Assert the result region-badge is `>= 11px`.
- Assert `getComputedStyle(dataCellValue).fontVariantNumeric` contains `"tabular-nums"`.
- Assert `getComputedStyle(officialName).color` equals the sand-600 RGB in light mode.
- Assert `getComputedStyle(officialName).color` in dark mode unchanged (matches `dark-100` RGB).

All existing functional e2e tests must continue to pass unchanged.

### Manual smoke

Run once on desktop light, desktop dark, mobile light, mobile dark.

- Select a country. Region badge reads crisp at 11px; not cramped.
- Official-name line and share/close/expand icons appear slightly darker in light mode; dark-mode unchanged.
- Enter compare mode. Both column region badges at 11px. Numeric fields (Population, Area) align vertically when the two columns stack.
- Type a country name. Search-result region badge at 11px.
- `prefers-reduced-motion` on: animations still clipped per `src/index.css:243`.

---

## Success criteria

1. No `text-[10px]` classes remain in `src/components/**` (grep-verifiable).
2. Meta-copy lines listed in the "Meta-color contrast bump" section render at sand-600 (#6b6459) in light mode.
3. Dark-mode meta-copy colors are unchanged (`dark-100`).
4. `DataCell` value container has `font-variant-numeric: tabular-nums` applied.
5. All new and existing e2e tests pass.
6. No visual regressions in the country panel, compare panel, or search dropdown.

---

## Rollout

Single PR titled `fix(a11y): region-badge size floor + meta-contrast + tabular figures`. No feature flag. Rollback is a revert of one commit.

---

## Deferred — awaiting game-first brainstorm

The following moves were proposed in the earlier Foundation draft and are **explicitly deferred** until a separate brainstorm establishes the game-first visual direction:

- System-serif display face on wordmark and country-name `h2`. Deferred because an atlas-flavored typographic move should not precede the game-first identity work.
- Paper-toned panel surface (`--color-paper: #f6f1e6`). Same reason.
- Phase 2 (Cartographic Identity), Phase 3 (Data Expression), Phase 4 (Map Surface) as previously conceived. The four-phase "Cartographer's Table" framing was built on reference-first assumptions. A new phase plan will be drafted after the game-first brainstorm lands.

---

## Open questions

None. All clarifications closed during brainstorming.

---

## Non-goals

- Introducing visual-regression tests.
- Changing any typography family, size above 12px, or weight.
- Changing any surface background color.
- Changing any map rendering, game HUD, or game behavior.
- Touching dark-mode color values.
- Establishing an overall visual direction — that's deferred to a separate game-first brainstorm.
