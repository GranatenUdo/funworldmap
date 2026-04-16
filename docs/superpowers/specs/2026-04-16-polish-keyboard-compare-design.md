# Polish, Keyboard, and Compare Design

**Date:** 2026-04-16
**Status:** Approved
**Scope:** Polish pack + keyboard pack + comparison feature pack

## Overview

Ten refinements and features that layer onto the Warm Explorer redesign. Grouped into three packs that ship sequentially but live in one spec because they share code paths (keyboard shortcuts reference compare mode, help overlay lists both, compare mode uses polish pack aesthetics).

## Pack 1: Polish

### 1.1 Auto-rotating globe on idle

The globe rotates eastward at 0.3°/second after 5 seconds of no user interaction. Any pointer event, wheel, keydown, or touch resets the idle timer and halts rotation.

**Implementation:**
- `requestAnimationFrame` loop increments `map.setBearing(bearing + delta)` per frame
- Delta calculated from elapsed time for frame-rate independence
- `lastInteractionRef` timestamp, updated on `mousedown`, `wheel`, `keydown`, `touchstart`, `dragstart`
- Loop paused while `Date.now() - lastInteractionRef < 5000`
- Disabled entirely when `prefers-reduced-motion: reduce`
- Cleanup: cancel RAF on component unmount

### 1.2 Stars in dark mode

A static canvas behind the map element renders ~300 stars at varying sizes (1-2px) and opacity (0.2-0.8). Only visible in dark mode.

**Implementation:**
- New `<StarField />` component
- Renders `<canvas>` positioned `fixed inset-0 z-0` (behind everything)
- Map container gets `position: relative; z-index: 1`
- Canvas drawn once at mount, redrawn on window resize
- Only mounted when `resolvedTheme === 'dark'`
- Stars positioned via pseudo-random distribution (seeded for consistency across renders)
- No animation — static field

### 1.3 Reset view icon + nav control restyling

Replace the "home" icon (conceptually "go back") with a globe-with-circular-arrow SVG ("reset orientation"). Restyle all MapLibre navigation controls to match the warm aesthetic.

**Icon:**
- Custom inline SVG: a circle (globe outline) with a curved arrow wrapping around it
- `stroke: currentColor`, `stroke-width: 2`

**CSS overrides** (in `index.css`, applied globally to MapLibre controls):
```css
.maplibregl-ctrl-group {
  background: rgba(18, 21, 24, 0.88);
  border: 1px solid rgba(94, 234, 212, 0.25);
  border-radius: 10px;
  backdrop-filter: blur(8px);
}

.maplibregl-ctrl-group button {
  color: #5eead4;
}

.maplibregl-ctrl-group button:hover {
  background: rgba(94, 234, 212, 0.12);
}
```

Applies to zoom +/-, compass, reset view, attribution compact toggle.

### 1.4 Loading screen spinning globe

Replace the three animated dots with a 48px spinning mini-globe.

**Implementation (CSS-only):**
- Circle with `background: radial-gradient(circle at 35% 35%, #5eead4 0%, #0d9488 50%, #042f2e 100%)`
- Pseudo-element overlay with `conic-gradient` for grid-line effect at low opacity
- `@keyframes spin { to { transform: rotate(360deg) } }` applied 4s linear infinite
- Positioned centered above the "polworldmap" wordmark

### 1.5 Tooltip with capital city

Extend the existing country tooltip to show capital on a second line.

**Layout:**
```
[flag]  Country Name
        Capital
```

Country name: `font-weight: 500; font-size: 13px; color: #5eead4`
Capital: `font-size: 11px; color: rgba(148, 163, 184, 0.7)` (below, indented past flag)

Capital line hidden if `country.capital.length === 0`.

### 1.6 Crosshair cursor in compare picking mode

When user enters compare mode and is picking a second country, canvas cursor becomes `crosshair`. Communicates "you're in a targeting mode."

Returns to `grab` when compare picking ends (country selected or compare exited).

## Pack 2: Keyboard

### 2.1 Keyboard shortcuts

Global `keydown` handler registered in `App.tsx` via `useEffect`.

| Key | Action |
|---|---|
| `/` | Focus search input |
| `Esc` | Priority: exit compare → close panel → clear search → close help |
| `s` | Toggle satellite view |
| `t` | Cycle theme (light → dark → system → light) |
| `c` | Enter compare mode (no-op if no country selected) |
| `?` | Toggle help overlay |

Handler skips events when `e.target` matches `input`, `textarea`, or `[contenteditable]`. Special case: `Esc` in search bar first clears the search, second press closes the panel.

Arrow keys and `+`/`-` pan/zoom the map via MapLibre's built-in keyboard handler — documented in help but not overridden.

### 2.2 Help overlay

New component `<HelpOverlay open onClose>`. Triggered by `?` key or help icon button.

**Structure:**
- Portal to `document.body`
- Backdrop: `fixed inset-0 bg-black/50 backdrop-blur-md`, fades in 150ms
- Card: centered, 480px max-width, responsive
- Card styling: `bg-sand-50/95 dark:bg-dark-400/95`, `rounded-2xl`, `shadow-2xl`, `border border-sand-200/50 dark:border-dark-200/30`
- Header: "Keyboard Shortcuts" in Outfit 700 24px, with small `?` badge
- Close: X button top-right
- Entry animation: `panel-card-in` keyframe (reused from country panel)

**Content (grouped sections):**

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

**Key styling:** `<kbd>` elements rendered with monospace font, subtle border, dark background, 2px vertical padding. Visually distinct from description text.

**Accessibility:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="help-heading"`
- Focus moves to close button on open
- Focus returns to trigger on close
- `Esc` closes
- Click outside card closes

## Pack 3: Comparison Feature

### 3.1 Side-by-side comparison

Select country A, activate compare mode, pick country B, see both countries' data side-by-side with matching color highlights on the map.

**State additions (App.tsx):**
- `compareWith: CountryData | null` — the second country (B)
- `comparePickingMode: boolean` — whether user is actively picking B

**User flow:**

1. Country A selected — panel open as normal
2. User presses `c` or clicks Compare button in panel header
3. `comparePickingMode = true`:
   - Panel header changes: "Pick a country to compare with..."
   - Canvas cursor becomes `crosshair`
   - Search placeholder changes to "Choose country to compare..."
   - All non-A country borders get a subtle teal hover glow (inviting selection)
4. User clicks a country or selects from search
5. `compareWith = country B`, `comparePickingMode = false`:
   - Panel splits into two columns (desktop) or stacks (mobile)
   - Map highlights both A (coral) and B (teal-dim `#0d9488`)
   - Hover highlighting disabled (would conflict with two committed selections)

**Exit triggers:**
- `Esc` key
- Click X on country B's panel column header
- Click ocean (deselects everything, including A — matches existing behavior)

**Selection behavior while in compare mode:**
- Picking mode: clicking a country sets B, exits picking mode
- Viewing mode: clicking a country replaces A (stays as primary), B unchanged

### 3.2 Panel layout — desktop compare mode

Two columns, each 320px wide, rendered side-by-side. Total width 640px + gap.

**Column structure:**
```
┌────────────────┐
│ [A] 🇫🇷          │  <- coral A badge + flag + country name + region
│ France          │
│ Europe          │
├────────────────┤
│ Capital         │
│ Paris           │
│                 │
│ Population      │
│ 67,390,000      │
│                 │
│ Area            │
│ 543,940 km²     │
│ ...             │
└────────────────┘
```

A badge: small `14x14px` circle, coral (`#f43f5e`) background, white "A" letter, placed before the flag.
B badge: same size, teal-dim (`#0d9488`) background, white "B" letter.

Column B has an X close button in its header (exits compare, keeps A selected).

Panel container in compare mode: `right: 16px, top: 64px, bottom: 16px, width: 656px` (two 320px columns + 16px gap). Backdrop blur behind both.

### 3.3 Panel layout — mobile compare mode

Bottom sheet forced to expanded state (`80vh`). Vertical split:
- Top half: country A with A badge
- Dotted divider
- Bottom half: country B with B badge and close X

Both columns scroll independently if their content overflows.

### 3.4 Map layers during compare

**New layers added** (not visible unless in compare mode):
- `country-compare-glow` (line, blurred, teal-dim)
- `country-compare-fill` (fill, teal-dim at 0.32 opacity)
- `country-compare-border` (line, teal-dim, 2.5px)
- `country-compare-extrusion` (fill-extrusion, teal-dim, 80km)

Filter pattern identical to existing selection layers, matched against `compareWith.ccn3`.

**Dimming during compare:** Regular border layer opacity reduced to 0.15 (was 0.4) to reduce visual noise.

**Hover disabled** in compare mode:
- `country-fill` opacity stays at 0.05 regardless of feature-state
- `country-hover-border` filter stays empty
- `country-extrusion` filter stays empty

### 3.5 Deep linking

URL hash format: `#FRA` (single) or `#FRA,DEU` (compare).

**Parser (in `useSelectedCountry`):**
- Split hash on `,`
- First segment = selected country (cca3)
- Second segment (if present) = compareWith country (cca3)
- Missing/invalid codes treated as absent

**Writer (in `useSelectedCountry`):**
- If compareWith set: `#<A>,<B>`
- Else if selected set: `#<A>`
- Else: no hash

**Browser history:**
- Entering compare mode pushes a new history entry
- Exiting compare mode pushes a new history entry
- Back button navigates through these naturally

### 3.6 Compare button

Small button in panel header, between the region badge row and the close X. Icon: two overlapping circles (Venn diagram). Teal color.

Only rendered when:
- A country is selected AND
- Compare mode is not already active

Tooltip (native `title` attribute): "Compare (c)"

### 3.7 Share link button

Small button in panel header, placed between Compare and Close. Icon: chain-link.

**Behavior:**
- Click → `navigator.clipboard.writeText(window.location.href)`
- Success: toast "Link copied" appears at bottom-center, fades in 150ms, dismisses after 2s
- Error (insecure context, clipboard unavailable): falls back to a small prompt showing the URL for manual copy (uses `window.prompt()`)

### 3.8 Toast component

New `<Toast message onDismiss />` component.

- Rendered in App.tsx as a portal
- Positioned `fixed bottom-8 left-1/2 -translate-x-1/2 z-50`
- Style: dark pill, teal border, teal-light text, `rounded-full px-5 py-2.5`, matches empty-state hint style
- Entry: `fade-up` keyframe (200ms)
- Auto-dismiss: 2s timer calls `onDismiss`, component unmounts
- ARIA: `role="status"`, `aria-live="polite"`

## File Changes

| File | Change Type | Purpose |
|---|---|---|
| `src/App.tsx` | Modify | Compare state, keyboard handler, help overlay, toast, star field |
| `src/components/WorldMap.tsx` | Modify | Compare layers, idle rotation, crosshair cursor, pick-mode filter |
| `src/components/CountryPanel.tsx` | Modify | Compare/share buttons, A/B badges, dual-column compare layout, capital in subtitle |
| `src/components/SearchBar.tsx` | Modify | Dynamic placeholder based on picking mode |
| `src/components/Header.tsx` | Modify | Pass compare state through |
| `src/hooks/useSelectedCountry.ts` | Modify | Parse/write `?vs=` equivalent (comma-separated hash) |
| `src/components/HelpOverlay.tsx` | New | Help modal with shortcut list |
| `src/components/StarField.tsx` | New | Canvas star rendering for dark mode |
| `src/components/Toast.tsx` | New | Toast notification component |
| `src/index.css` | Modify | MapLibre control restyling, `<kbd>` styles, spinning globe keyframes, help overlay backdrop |

## What Stays Untouched

- Globe projection, terrain, atmosphere — all existing behavior preserved
- Theme system (light/dark/system)
- URL hash deep linking (extended, not replaced)
- All accessibility patterns (ARIA, keyboard, reduced-motion)
- All `data-testid` attributes
- Self-hosted fonts approach
- Zero new npm dependencies

## Constraints

- All animations respect `prefers-reduced-motion`
- All new interactive elements keyboard accessible
- All text maintains WCAG AA contrast
- Mobile layouts tested at 390×844 (iPhone 14)
- Bundle size increase: <3KB gzipped (no new dependencies, just code)

## Not Included (Explicit Scope Boundaries)

| Omitted | Reason |
|---|---|
| Three+ country comparison | Out of scope; side-by-side is only A vs B |
| Saved/pinned countries | Stateful persistence adds complexity; YAGNI |
| Social media share (Twitter/Facebook) | Copy link is sufficient; OG images can come later |
| Rich delta visualizations ("20% more people") | Plain data columns are clearer; user does math |
| Per-field animated value reveals in compare | Panel entry animation is enough |
| Globe rotation speed control | 0.3°/s is good; user control adds UI complexity |
