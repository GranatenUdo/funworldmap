# Polish, Keyboard, and Compare Design

**Date:** 2026-04-16
**Status:** Approved (Option 2 scope)
**Scope:** Essential polish + basic shortcuts + comparison feature

## Overview

A focused set of refinements that layer onto the Warm Explorer redesign. Scope reduced from original 10-item proposal to the items with the clearest value-per-effort ratio: navigation restyling, tooltip improvement, comparison feature, share link, and expected keyboard shortcuts.

**Deferred to a future pack** (low risk, standalone): auto-rotating globe, star field in dark mode, loading globe replacement, full keyboard shortcut set with help overlay.

## Pack 1: Polish

### 1.1 Navigation control restyling

MapLibre's default zoom/compass/reset buttons are gray HTML buttons that don't match the warm aesthetic. Replace with warm-explorer styling.

**CSS scoped to bottom-right controls** (avoids breaking attribution on bottom-left):

```css
.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group {
  background: rgba(18, 21, 24, 0.88);
  border: 1px solid rgba(94, 234, 212, 0.25);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: hidden;
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

**Also:** Replace the ResetViewControl "home" icon (conceptually wrong — it means "go back", not "reset orientation") with a globe-with-circular-arrow SVG. Icon uses `currentColor` so it inherits the teal color.

### 1.2 Tooltip with capital city

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

**Styles added:**
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

### 1.3 Crosshair cursor in compare picking mode

When user is picking a second country for comparison, canvas cursor becomes `crosshair`. Returns to `grab` when picking ends.

This is the only visual mode indicator — no glow on all countries (would be expensive and noisy).

## Pack 2: Basic Keyboard Shortcuts

Only two shortcuts — expected by users and self-discoverable. No help overlay needed.

### 2.1 Keyboard shortcuts

Global `keydown` handler registered in `App.tsx`.

| Key | Action |
|---|---|
| `/` | Focus search input |
| `Esc` | Priority: exit compare → close panel → clear search |

**Handler logic:**
```typescript
if (e.key === 'Escape') {
  // Always runs, even in inputs (to clear search)
  handleEsc()
  return
}
// For `/`, skip if target is already an input
const target = e.target as HTMLElement
if (target.matches('input, textarea, [contenteditable]')) return
if (e.key === '/') {
  e.preventDefault()
  document.getElementById('search-input')?.focus()
}
```

Arrow keys and `+`/`-` keep their MapLibre-native pan/zoom behavior.

**Future expansion hook:** The handler is structured so additional shortcuts (`s`, `t`, `c`, `?`) can be added later without restructuring.

## Pack 3: Comparison Feature

### 3.1 Side-by-side comparison

Select country A → activate compare → pick country B → see both countries' data side-by-side with matching map highlights.

**State additions (App.tsx):**
- `compareWith: CountryData | null` — country B
- `comparePickingMode: boolean` — user is actively picking B

**User flow:**

1. Country A selected — panel open normally
2. User clicks Compare button in panel header
3. `comparePickingMode = true`:
   - Panel header changes: "Pick a country to compare with..."
   - Canvas cursor becomes `crosshair`
   - Search placeholder changes to "Choose country to compare..."
4. User clicks a country OR selects from search
5. `compareWith = country B`, `comparePickingMode = false`:
   - Panel renders in compare layout (see 3.2 and 3.3)
   - Map highlights both A (coral) and B (teal-dim `#0d9488`)
   - Hover disabled during compare viewing

**Exit triggers:**
- `Esc` key (via Pack 2 handler)
- Click X on country B's panel column
- Deselect via ocean click (removes both A and B)

**Selection behavior during compare:**
- Picking mode: clicking sets B, exits picking
- Viewing mode: clicking replaces A (primary country), B unchanged

### 3.2 Panel layout — desktop compare mode (≥1024px)

Two columns, each 320px wide, rendered side-by-side. Total `656px` (320 + 16 gap + 320).

Panel container: `right: 16px, top: 64px, bottom: 16px, width: 656px`. Uses the existing `isDesktop` breakpoint (`useMediaQuery`, 1024px). Below 1024px, falls back to mobile vertical-split layout.

**Column structure:**
```
┌────────────────┐
│ ⦿A 🇫🇷 France  │  <- coral A badge, flag, name
│ Europe          │
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

Bottom sheet locked to expanded state (`80vh`). Expand/collapse chevron hidden in compare mode.

Vertical split:
- Top half: country A with A badge
- Dotted divider (1px, `border-dashed`)
- Bottom half: country B with B badge and X close

Each half scrolls independently.

### 3.4 Map layers during compare

**New layers** (always present in style, filter-controlled):
- `country-compare-glow` (line, 10px width, 5px blur, teal-dim, 0.3 opacity)
- `country-compare-fill` (fill, teal-dim, 0.32 opacity)
- `country-compare-border` (line, teal-dim, 2.5px)
- `country-compare-extrusion` (fill-extrusion, teal-dim, 80km)

Filter pattern matches existing selection layers, targeting `compareWith.ccn3`.

**Dimming during compare:**
- Regular border layer `line-opacity` reduced from 0.4 to 0.15
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
- First segment = selected country (cca3, validated)
- Second segment (if present) = compareWith country (cca3, validated)
- Invalid codes treated as absent

**Writer:**
- If `compareWith`: `#<A>,<B>`
- Else if `selected`: `#<A>`
- Else: empty hash

### 3.6 Compare button

Small button in panel header, placed before the Share button. Icon: two overlapping circles (Venn diagram). Teal color.

Rendered when a country is selected AND compare mode not active.

Tooltip (native `title`): "Compare"

### 3.7 Share link button

Small button in panel header, placed between Compare and Close X. Icon: chain-link.

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
| `src/App.tsx` | Modify | Compare state, keyboard handler, toast integration |
| `src/components/WorldMap.tsx` | Modify | Compare layers, crosshair cursor in picking mode, opacity locking, reset icon SVG |
| `src/components/CountryPanel.tsx` | Modify | Compare/share buttons, A/B badges, dual-column compare layout, capital in subtitle |
| `src/components/SearchBar.tsx` | Modify | Dynamic placeholder based on picking mode |
| `src/components/Header.tsx` | Modify | Pass compare state through |
| `src/hooks/useSelectedCountry.ts` | Modify | Parse/write comma-separated hash format |
| `src/hooks/__tests__/useSelectedCountry.test.ts` | Modify | Extend tests for `#A,B` parsing |
| `src/components/Toast.tsx` | New | Toast notification component |
| `src/index.css` | Modify | MapLibre control restyling, tooltip two-line layout |

## Testing

- Extend existing `useSelectedCountry` unit tests for comma-separated hash: `#FRA,DEU` parses to `selected=France, compareWith=Germany`; invalid second code handled gracefully; writer produces correct format for all state combinations
- Manual verification checklist for each feature (in the implementation plan)

## What Stays Untouched

- Globe projection, terrain, atmosphere
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
- Mobile layouts tested at 390×844
- Bundle size increase: <3KB gzipped

## Not Included (Explicit Scope Boundaries)

| Omitted | Reason |
|---|---|
| Auto-rotating globe | Deferred — debatable value, low risk to add later |
| StarField in dark mode | Deferred — requires transparent background (risky change) |
| Loading screen spinning globe | Deferred — current dots work fine |
| Full keyboard shortcut set (`s`, `t`, `c`, `?`) | Deferred — `/` and `Esc` cover the expected cases |
| Help overlay | Deferred with shortcuts it would document |
| Three+ country comparison | Side-by-side is A vs B only |
| Saved/pinned countries | YAGNI |
| Rich delta visualizations | Plain data is clearer |
