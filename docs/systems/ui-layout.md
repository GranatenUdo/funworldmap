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
│                Map                       │  - Flag / Name  │
│                (full viewport behind)     │    + Capital(s) │
│                                          │  - Population   │
│                                          │  - ...          │
│                                          │                │
└──────────────────────────────────────────┴────────────────┘
```

**Sidebar** behavior:

- Slides in from the right when a country is selected
- Overlays the map with a drop shadow — map stays full-width underneath
- Fixed width: 360px, full height of viewport
- Close button (×) in top-right corner
- Scrollable content area for countries with extensive metadata

## Component Breakdown

### Header

- Floats on top of the map with `position: fixed`; the container itself is transparent and `pointer-events: none`
- Individual controls are floating "pills" — each its own blurred, semi-transparent element using the sand/dark design tokens (e.g. `bg-sand-100/90 dark:bg-dark-400/80`), with `pointer-events: auto`
- Contains (left → right): the **funworldmap** wordmark (desktop only), the search bar, a **Play** button (opens the launcher), a **satellite / map** toggle (`aria-pressed`), and the theme toggle
- The transparent container plus per-control pointer-events lets map interactions pass through the header's empty areas
- While a game is active the search bar and Play button are hidden; while the launcher is open the header unmounts entirely

### Map Controls

- MapLibre's built-in `NavigationControl` (zoom +/−, compass)
- Custom "Reset view" button — a crosshair-globe (reticle) glyph; flies the camera back to the default world view (longitude 0, latitude 20, zoom 1.8, pitch 20°, bearing 0). It does not touch selection: an open panel and the URL hash are preserved. (The Home key does the same while the map has focus.)
- Positioned bottom-right on desktop
- Repositioned to avoid bottom sheet overlap on mobile
- On coarse pointers every control button grows to the 44px touch-target floor (`TOUCH_TARGET_MIN_PX` in `src/lib/layoutConstants.ts`, applied via `@media (pointer: coarse)` in `src/index.css` — vendor DOM, so real enlargement instead of the A13 `::after` hit extension); fine-pointer desktops keep MapLibre's stock 29px. Styled for both themes (light base + `.dark` overrides, shipped with A3).

### Country Panel

- Same component renders as sidebar (desktop) or bottom sheet (mobile)
- `useMediaQuery` hook determines which layout to use. If the viewport crosses the 1024px breakpoint while a country panel is open, the panel transitions between sidebar and bottom sheet layout. The panel stays open with the same content — only the presentation changes.
- CSS transitions for slide-in/slide-out animation
- Scrollable content area

### Information Displayed

**Primary** (always visible in peek state):

- Flag (bundled SVG)
- Country name (common + official if different)
- Header caption: capital(s), comma-separated if a country has multiple (e.g., South Africa: Pretoria, Cape Town, Bloemfontein), carrying its own source tooltip (the region badge shares the same source)
- Region / Subregion badge
- Exception badges — shown only for the two countries where they're non-default: "UN observer state" (Vatican, Palestine) and "Not independent" (Palestine). Each carries its own source tooltip. Absent for the 193 UN member states, so most panels show no badge at all.
- Prime grid (2 columns, always visible regardless of peek/expanded state): Population (locale-formatted), Area (km²), Government type, Languages

**Secondary** (visible in full/expanded state):

- Currencies
- Timezones
- Neighboring countries (clickable chips). Clicking a border chip selects that country — same as clicking it on the map. The map flies to the new country via `flyToCountry()`, the panel transitions to show its data, and the URL hash updates. Each chip click creates a new history entry, so browser Back returns to the previous country. If a border code has no match in `countries.json`, the chip is displayed but not clickable.

**Source Attribution**: Every data field has a small 'i' icon. On desktop, hover or focus shows a tooltip with the source name and link (e.g., "Source: CIA World Factbook"). On touch devices, tapping the 'i' icon toggles the tooltip open/closed (since hover is not available). The tooltip is dismissed by tapping elsewhere. See [Data System — UI Attribution](data.md).

### Compare

From an open country panel, a **Compare** action puts search into "pick a country to compare" mode (placeholder "Choose country to compare…"; entered via `enterComparePicking` in `App.tsx`, available only while a country is selected). Choosing a second country opens `CompareCountryPanel` — two `CountryColumn`s side by side. Both columns render from the single `COMPARE_FIELDS` definition list (`src/lib/compareFields.ts`) — every row renders for both countries, with an em-dash placeholder when a value is missing, so rows always align. Capital(s) live in each column-header caption (all capitals joined); UN membership / independence render as the shared exception badges (`src/components/exceptionBadge.ts`) in the column headers rather than as near-constant boolean rows. Border chips are column-scoped: a chip in column A replaces A (keeping B, via `compareReplaceA`), a chip in column B replaces B (keeping A, via `compareSelect`), and a chip naming the other column's country is a no-op (`compareChipClick` in `src/lib/compareMapClick.ts`). Unlike the single-country panel, fields here are not individually source-tagged; a shared footer (`data-testid="compare-sources"`) lists the comparison's data sources. On the map, both countries are highlighted (A = signal, B = ice-mid) while every non-compared country is dimmed by the `country-dim` spotlight layer; exiting compare (Escape or the exit control) clears the second country and restores the borders (`useCompareViewHighlight.ts` + `useCountryBaselinePaint.ts`). Covered by `e2e/compare-view-dimming.spec.ts` and `e2e/compare-source-attribution.spec.ts`.

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

- Select France → URL becomes `funworldmap.com/#FRA`
- Open `funworldmap.com/#FRA` → map flies to France, panel opens

This enables:

- Sharing links to specific countries
- Browser back/forward navigation between selections
- Bookmarking favorite countries

Implementation: `hashchange` event listener + initial hash parse on load. The cca3 code from the hash is resolved to a ccn3 numeric code for map feature lookup via the bidirectional lookup table (see [Data System — Bidirectional Lookup](data.md)).

### Game routes

The hash is also the router for game state, parsed by `lib/hashState.ts`:

- `writeHash` produces `#game/<modeId>` (e.g. `#game/country-pinning`); `parseHash` also tolerates a trailing `/play` on inbound links
- Country selection (`#FRA`) and game routes share the same hash channel; the app dispatches on the prefix

So the URL hash is the single source of truth for both country selection and game state.

### Browser History

Each country selection pushes a new hash entry to browser history. This enables natural back/forward navigation:

- **Select → Select** (e.g., `#FRA` → `#DEU`): Back returns to `#FRA`, reopening France's panel
- **Select → Deselect** (click ocean): The deselection replaces the current history entry with no hash (no blank `#` in history). Back navigates to the previous page, not the previous country.
- **Back from no selection**: Normal browser behavior — navigates away from the page entirely
- **Forward**: Works symmetrically — returns to the country that was next in history
