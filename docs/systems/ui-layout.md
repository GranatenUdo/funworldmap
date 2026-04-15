# UI Layout System

## Design Philosophy

The map is the primary interface. All other UI elements float on top of it — the search bar, country information panel, and controls. Nothing competes with the map for space; everything yields to it.

## Responsive Strategy

Mobile-first. Layouts are built for small screens and progressively enhanced for larger ones. The breakpoint is **1024px** (`lg:` in Tailwind).

## Layout Modes

### Mobile (< 1024px)

```
┌─────────────────────────┐
│  Header (search + theme) │  ← floating, semi-transparent
├─────────────────────────┤
│                         │
│                         │
│         Map             │  ← full viewport
│                         │
│                         │
├─────────────────────────┤
│  [▲ expand] Country name │  ← bottom sheet (when country selected)
│  Country Panel           │
│  (peek: 40vh / full: 80vh)
└─────────────────────────┘
```

**Bottom sheet** behavior:
- Appears when a country is selected
- Two interactive states: **peek** (40% viewport height) and **full** (80% viewport height). These are starting values — adjust during implementation based on content fit and device testing.
- Expand/collapse button (chevron) at the top toggles between states — accessible via keyboard and pointer
- Overlays the map — map remains visible above the sheet. Tapping the visible map above the bottom sheet selects or deselects a country normally. The sheet transitions to show the new country's data, or collapses if the tap hit empty space.
- Close button to dismiss entirely

### Desktop (>= 1024px)

```
┌──────────────────────────────────────────┬────────────────┐
│  Header (search + theme)                  │                │
├──────────────────────────────────────────┤  Country Panel  │
│                                          │  (380px width)  │
│                                          │                │
│                Map                       │  - Flag         │
│                (full viewport behind)     │  - Name         │
│                                          │  - Capital      │
│                                          │  - Population   │
│                                          │  - ...          │
│                                          │                │
└──────────────────────────────────────────┴────────────────┘
```

**Sidebar** behavior:
- Slides in from the right when a country is selected
- Overlays the map with a drop shadow — map stays full-width underneath
- Fixed width: 380px, full height of viewport (starting value — adjust based on content fit)
- Close button (×) in top-right corner
- Scrollable content area for countries with extensive metadata

## Component Breakdown

### Header
- Floats on top of the map with `position: fixed`
- Semi-transparent background with blur: `backdrop-blur-sm bg-white/80 dark:bg-slate-900/80`
- Contains: search bar (left/center) + theme toggle (right)
- `pointer-events: none` on container, `pointer-events: auto` on interactive children
- This prevents the header background from blocking map interactions in empty areas

### Map Controls
- MapLibre's built-in `NavigationControl` (zoom +/−, compass)
- Custom "Reset view" button — resets zoom and center to defaults (longitude 0, latitude 20, zoom 2). If a country is selected, deselects it, closes the panel, and clears the URL hash.
- Positioned bottom-right on desktop
- Repositioned to avoid bottom sheet overlap on mobile

### Country Panel
- Same component renders as sidebar (desktop) or bottom sheet (mobile)
- `useMediaQuery` hook determines which layout to use. If the viewport crosses the 1024px breakpoint while a country panel is open, the panel transitions between sidebar and bottom sheet layout. The panel stays open with the same content — only the presentation changes.
- CSS transitions for slide-in/slide-out animation
- Scrollable content area

### Information Displayed

**Primary** (always visible in peek state):
- Flag (bundled SVG)
- Country name (common + official if different)
- Capital(s) — if a country has multiple capitals (e.g., South Africa: Pretoria, Cape Town, Bloemfontein), display them comma-separated
- Region / Subregion

**Secondary** (visible in full/expanded state):
- Population (locale-formatted)
- Area (km²)
- Government type
- Languages
- Currencies
- Timezones
- UN Member status
- Independence status
- Neighboring countries (clickable chips). Clicking a border chip selects that country — same as clicking it on the map. The map flies to the new country via `flyToCountry()`, the panel transitions to show its data, and the URL hash updates. Each chip click creates a new history entry, so browser Back returns to the previous country. If a border code has no match in `countries.json`, the chip is displayed but not clickable.

**Source Attribution**: Every data field has a small 'i' icon. On desktop, hover or focus shows a tooltip with the source name and link (e.g., "Source: CIA World Factbook"). On touch devices, tapping the 'i' icon toggles the tooltip open/closed (since hover is not available). The tooltip is dismissed by tapping elsewhere. See [Data System — UI Attribution](data.md).

## Theme System

Three-state theme: **light**, **dark**, and **system** (follow OS preference).

### Detection Priority
1. User's manual choice (stored in `localStorage`)
2. System preference (`prefers-color-scheme`)
3. Default: system

### Implementation
- `<html>` gets class `dark` when dark mode resolves to active
- Tailwind's `dark:` variant applies dark styles throughout
- Basemap layer colors darkened via MapLibre `setPaintProperty` (see [Map Rendering — Dark Mode](map-rendering.md))
- Country layer paint colors adapt to maintain contrast in both themes
- `transition-colors duration-200` prevents jarring switches

### Toggle
- Three-state button in the header: sun (light) → moon (dark) → monitor (system) → sun ...
- `aria-label` updates to reflect current state ("Switch to dark mode", "Switch to system theme", etc.)

## Deep Linking

The URL hash reflects the selected country using cca3 codes:
- Select France → URL becomes `polworldmap.com/#FRA`
- Open `polworldmap.com/#FRA` → map flies to France, panel opens

This enables:
- Sharing links to specific countries
- Browser back/forward navigation between selections
- Bookmarking favorite countries

Implementation: `hashchange` event listener + initial hash parse on load. The cca3 code from the hash is resolved to a ccn3 numeric code for map feature lookup via the bidirectional lookup table (see [Data System — Bidirectional Lookup](data.md)).

### Browser History

Each country selection pushes a new hash entry to browser history. This enables natural back/forward navigation:

- **Select → Select** (e.g., `#FRA` → `#DEU`): Back returns to `#FRA`, reopening France's panel
- **Select → Deselect** (click ocean): The deselection replaces the current history entry with no hash (no blank `#` in history). Back navigates to the previous page, not the previous country.
- **Back from no selection**: Normal browser behavior — navigates away from the page entirely
- **Forward**: Works symmetrically — returns to the country that was next in history
