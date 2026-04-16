# Polish, Keyboard, and Compare Design

**Date:** 2026-04-16
**Status:** Approved (revised after critical review)
**Scope:** Polish pack + keyboard pack + comparison feature pack

## Overview

Ten refinements and features that layer onto the Warm Explorer redesign. Grouped into three packs that ship sequentially but live in one spec because they share code paths (keyboard shortcuts reference compare mode, help overlay lists both, compare mode uses polish pack aesthetics).

## Pack 1: Polish

### 1.1 Auto-rotating globe on idle

The globe rotates eastward at 0.3°/second after 5 seconds of no user interaction. Any pointer, wheel, keydown, or touch resets the idle timer and halts rotation.

**Implementation:**
- `requestAnimationFrame` loop updates `map.setCenter({ lng: center.lng + delta, lat: center.lat })` per frame
- Delta calculated as `0.3 * (elapsed_ms / 1000)` for frame-rate independence
- Longitude change (NOT `bearing`) creates natural eastward spin; bearing rotates the camera which looks westward-spinning
- `lastInteractionRef` timestamp, updated on `mousedown`, `wheel`, `keydown`, `touchstart`, `dragstart`
- Loop skips RAF step while `Date.now() - lastInteractionRef < 5000`
- Disabled entirely when `prefers-reduced-motion: reduce` matches
- RAF cancelled on component unmount
- Disabled when compare mode is active (would confuse the A/B viewer)

### 1.2 Stars in dark mode

A static canvas behind the map element renders ~300 stars at varying sizes (1-2px) and opacity (0.2-0.8). Only visible in dark mode.

**Implementation (two parts):**

Part A — Make dark mode map background transparent:
- In `mapColors.ts`, dark mode `background` override changes from `#10141a` to `transparent`
- The surrounding area outside the globe becomes visually empty (canvas transparent)
- Page `<body>` background remains dark (`#10141a`) as a fallback if stars fail

Part B — Render stars:
- New `<StarField />` React component, mounted only when `resolvedTheme === 'dark'`
- Renders a `<canvas>` positioned `fixed inset-0` with `z-index: 0`
- Map container gets `position: relative; z-index: 1`
- Canvas 2D context, 300 stars drawn once at mount using a seeded pseudo-random (so resize keeps same layout)
- Redrawn on window resize via `ResizeObserver`

### 1.3 Reset view icon + nav control restyling

Replace the "home" icon with a globe-with-circular-arrow SVG. Restyle MapLibre controls to match the warm aesthetic.

**Icon (inline SVG):**
- Circle (globe outline) with curved arrow wrapping around it
- `stroke: currentColor`, `stroke-width: 2`

**CSS overrides scoped to bottom-right controls only** (avoids breaking attribution on bottom-left):

```css
.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group {
  background: rgba(18, 21, 24, 0.88);
  border: 1px solid rgba(94, 234, 212, 0.25);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
  color: #5eead4;
  background: transparent;
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:hover {
  background: rgba(94, 234, 212, 0.12);
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button + button {
  border-top: 1px solid rgba(94, 234, 212, 0.15);
}
```

### 1.4 Loading screen spinning globe

Replace the three animated dots with a 48px spinning mini-globe.

**Implementation (CSS-only, no grid lines):**
- 48px circle with `background: radial-gradient(circle at 30% 30%, #5eead4 0%, #0d9488 50%, #042f2e 100%)` — offset highlight creates 3D impression at small size
- `box-shadow: 0 0 16px rgba(94, 234, 212, 0.3)` — subtle glow
- `@keyframes spin { to { transform: rotate(360deg) } }` applied 4s linear infinite
- Positioned centered above the "polworldmap" wordmark with margin-bottom

### 1.5 Tooltip with capital city

Extend the existing country tooltip to show capital on a second line.

**DOM structure:**
```html
<div class="country-tooltip visible">
  <img src="..." alt="" />
  <div class="tooltip-text">
    <div class="tooltip-name">France</div>
    <div class="tooltip-capital">Paris</div>
  </div>
</div>
```

**Styles added to `.country-tooltip`:**
```css
.country-tooltip .tooltip-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.country-tooltip .tooltip-name {
  font-weight: 500;
  font-size: 13px;
  color: #5eead4;
}
.country-tooltip .tooltip-capital {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.7);
}
```

Capital line omitted if `country.capital.length === 0`.

### 1.6 Crosshair cursor in compare picking mode

When user enters compare mode and is picking a second country, canvas cursor becomes `crosshair`. Returns to `grab` when picking ends.

This is the only visual mode indicator needed — no border glow on all countries (expensive and noisy).

## Pack 2: Keyboard

### 2.1 Keyboard shortcuts

Global `keydown` handler registered in `App.tsx`.

| Key | Action |
|---|---|
| `/` | Focus search input |
| `Esc` | Priority: close help → exit compare → close panel → clear search |
| `s` | Toggle satellite view |
| `t` | Cycle theme (light → dark → system → light) |
| `c` | Enter compare mode (no-op if no country selected) |
| `?` | Toggle help overlay |

**Handler logic:**
```typescript
if (e.key === 'Escape') {
  // Always runs, even in inputs
  handleEsc()
  return
}
// For all other shortcuts, skip if typing in input
const target = e.target as HTMLElement
if (target.matches('input, textarea, [contenteditable]')) return
// Dispatch on key...
```

This ensures `Esc` works to clear search, while `c` pressed inside search bar types a letter (doesn't trigger compare).

Arrow keys and `+`/`-` already pan/zoom via MapLibre — documented in help but not overridden.

### 2.2 Help overlay

New component `<HelpOverlay open onClose>`. Triggered by `?` key.

**Structure:**
- Portal to `document.body`
- Backdrop: `fixed inset-0 bg-black/50 backdrop-blur-md`, fades in 150ms
- Card: centered, 480px max-width
- Card styling: `bg-sand-50/95 dark:bg-dark-400/95`, `rounded-2xl`, `shadow-2xl`, `border border-sand-200/50 dark:border-dark-200/30`
- Header: "Keyboard Shortcuts" in Outfit 700 24px
- Close: X button top-right
- Entry animation: `panel-card-in` keyframe (reused from country panel)

**Content grouped by section:**
```
Navigation
  /          Focus search
  Esc        Close / cancel
  ← → ↑ ↓   Pan the map
  + -        Zoom in / out

Views
  s          Toggle satellite
  t          Cycle theme
  c          Compare countries

Help
  ?          Toggle this help
```

**`<kbd>` styling** (added to `index.css`):
```css
kbd {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: inherit;
}
```

**Accessibility:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="help-heading"`
- Save `document.activeElement` at open; restore on close
- Focus moves to close button on open
- `Esc` closes (handled by the priority system)
- Click outside card closes

## Pack 3: Comparison Feature

### 3.1 Side-by-side comparison

Select country A → activate compare → pick country B → see both countries' data side-by-side with matching map highlights.

**State additions (App.tsx):**
- `compareWith: CountryData | null` — country B
- `comparePickingMode: boolean` — user is actively picking B

**User flow:**

1. Country A selected — panel open normally
2. User presses `c` or clicks Compare button in panel header
3. `comparePickingMode = true`:
   - Panel header changes: "Pick a country to compare with..."
   - Canvas cursor becomes `crosshair`
   - Search placeholder changes to "Choose country to compare..."
   - No other visual changes (no border glow — too expensive, cursor is enough)
4. User clicks a country OR selects from search
5. `compareWith = country B`, `comparePickingMode = false`:
   - Panel renders in compare layout (see 3.2 and 3.3)
   - Map highlights both A (coral) and B (teal-dim `#0d9488`)
   - Hover disabled during compare viewing (two committed selections would clash with a third temporary hover)

**Exit triggers:**
- `Esc` key
- Click X on country B's panel column
- Deselect via ocean click (removes both A and B)

**Selection behavior during compare:**
- Picking mode: clicking sets B, exits picking
- Viewing mode: clicking replaces A (primary country), B unchanged

### 3.2 Panel layout — desktop compare mode (≥1024px)

Two columns, each 320px wide, rendered side-by-side. Total `656px` (320 + 16 gap + 320).

Panel container: `right: 16px, top: 64px, bottom: 16px, width: 656px`. Backdrop blur behind both columns. Uses the existing `isDesktop` breakpoint (`useMediaQuery`, 1024px). Below 1024px, falls back to mobile vertical-split layout.

**Column structure:**
```
┌────────────────┐
│ ⦿A 🇫🇷 France  │  <- coral A badge, flag, name
│ Europe          │  <- region badge
├────────────────┤
│ Capital         │
│ Paris           │
│ Population      │
│ 67,390,000      │
│ Area            │
│ 543,940 km²     │
│ ...             │
└────────────────┘
```

**A badge:** 14×14px circle, coral (`#f43f5e`) background, white "A" letter.
**B badge:** 14×14px circle, teal-dim (`#0d9488`) background, white "B" letter.

Column B has an X close button in its header (exits compare).

### 3.3 Panel layout — mobile compare mode (<1024px)

Bottom sheet locked to expanded state (`80vh`). Expand/collapse chevron hidden (forced expanded).

Vertical split:
- Top half: country A with A badge
- Dotted divider (1px, `border-dashed`)
- Bottom half: country B with B badge and X close

Each half scrolls independently via `overflow-y: auto`.

### 3.4 Map layers during compare

**New layers** (always present, filter-controlled):
- `country-compare-glow` (line, 10px width, 5px blur, teal-dim, 0.3 opacity)
- `country-compare-fill` (fill, teal-dim, 0.32 opacity)
- `country-compare-border` (line, teal-dim, 2.5px)
- `country-compare-extrusion` (fill-extrusion, teal-dim, 80km)

Filter pattern matches existing selection layers, targeting `compareWith.ccn3`.

**Dimming during compare:**
- Regular border layer `line-opacity` reduced from 0.4 to 0.15 (less visual noise)
- Restored on exit

**Hover disabling during compare viewing:**
- On entering compare viewing: `setPaintProperty('country-fill', 'fill-opacity', 0.05)` (fixed value, not expression)
- `country-hover-border` filter locked to empty
- `country-extrusion` filter locked to empty
- On exit: restore original fill-opacity expression and clear locks

### 3.5 Deep linking

**URL hash format:**
- Single: `#FRA`
- Compare: `#FRA,DEU`

**Parser (in `useSelectedCountry`):**
- Strip `#`, split on `,`
- First segment = selected country (cca3, validated against `byCca3` map)
- Second segment (if present) = compareWith country (cca3, validated)
- Invalid codes treated as absent

**Writer:**
- If `compareWith`: `#<A>,<B>`
- Else if `selected`: `#<A>`
- Else: empty hash (remove `#`)

**Browser history:**
- Entering/exiting compare pushes new history entries
- Back button navigates naturally

### 3.6 Compare button

Small button in panel header, placed before Close X. Icon: two overlapping circles (Venn diagram). Teal color.

Rendered when:
- A country is selected AND
- Compare mode not active

Tooltip (native `title`): "Compare (c)"

### 3.7 Share link button

Small button in panel header, placed between Compare and Close. Icon: chain-link.

**Behavior:**
- Click → construct URL explicitly from state (avoids hash-sync race):
  ```typescript
  const url = `${window.location.origin}${window.location.pathname}#${selected.cca3}${compareWith ? ',' + compareWith.cca3 : ''}`
  navigator.clipboard.writeText(url)
  ```
- Success: show toast "Link copied" for 2s
- Fallback if `navigator.clipboard` unavailable: `window.prompt('Copy this link:', url)`

### 3.8 Toast component

New `<Toast message onDismiss />`:
- Portal to `document.body`
- Positioned `fixed bottom-8 left-1/2 -translate-x-1/2 z-50`
- Style: dark pill with teal border, teal-light text, `rounded-full px-5 py-2.5`
- Entry: `fade-up` keyframe (200ms)
- Auto-dismiss: 2s setTimeout calls `onDismiss`
- ARIA: `role="status"`, `aria-live="polite"`

Single toast at a time (no queue — replaces if new message while existing is showing).

## File Changes

| File | Change Type | Purpose |
|---|---|---|
| `src/App.tsx` | Modify | Compare state, keyboard handler, help overlay, toast, star field integration |
| `src/components/WorldMap.tsx` | Modify | Compare layers, idle rotation, crosshair cursor, opacity locking on compare |
| `src/components/CountryPanel.tsx` | Modify | Compare/share buttons, A/B badges, dual-column compare layout, capital in subtitle |
| `src/components/SearchBar.tsx` | Modify | Dynamic placeholder based on picking mode |
| `src/components/Header.tsx` | Modify | Pass compare state through |
| `src/hooks/useSelectedCountry.ts` | Modify | Parse/write comma-separated hash format |
| `src/hooks/__tests__/useSelectedCountry.test.ts` | Modify | Extend tests for `#A,B` parsing |
| `src/components/HelpOverlay.tsx` | New | Help modal |
| `src/components/StarField.tsx` | New | Canvas star rendering for dark mode |
| `src/components/Toast.tsx` | New | Toast notification component |
| `src/lib/mapColors.ts` | Modify | Dark mode background → transparent |
| `src/index.css` | Modify | MapLibre control restyling, `<kbd>` styles, spinning globe keyframes, tooltip layout |

## Testing

- Extend existing `useSelectedCountry` unit tests for comma-separated hash: `#FRA,DEU` parses to selected=France, compareWith=Germany; invalid second code handled; writer produces correct format
- Manual verification checklist for each feature (see implementation plan)

## What Stays Untouched

- Globe projection, terrain, atmosphere — all existing behavior preserved
- Theme system (light/dark/system)
- URL hash deep linking (extended for comma, not replaced)
- All accessibility patterns (ARIA, keyboard, reduced-motion)
- All `data-testid` attributes
- Self-hosted fonts approach
- Zero new npm dependencies

## Constraints

- All animations respect `prefers-reduced-motion`
- All new interactive elements keyboard accessible
- All text maintains WCAG AA contrast
- Mobile layouts tested at 390×844 (iPhone 14) and 768×1024 (iPad)
- Bundle size increase: <4KB gzipped

## Not Included (Explicit Scope Boundaries)

| Omitted | Reason |
|---|---|
| Three+ country comparison | Scope creep — side-by-side is A vs B only |
| Saved/pinned countries | Stateful persistence adds complexity; YAGNI |
| Social media share (Twitter/Facebook) | Copy link is sufficient; OG images can come later |
| Rich delta visualizations ("20% more people") | Plain data is clearer; user can compute |
| Per-field animated value reveals in compare | Panel entry animation is enough |
| Globe rotation speed control | 0.3°/s is good; user control adds UI complexity |
| Twinkling stars | Distracting on a reference tool |
