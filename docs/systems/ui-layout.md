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
│  (peek: 40dvh / full: 80dvh)
└─────────────────────────┘
```

**Bottom sheet** behavior:

- Appears when a country is selected
- Two interactive states: **peek** (`40dvh`) and **full** (`80dvh`) — `dvh` so the sheet tracks the visual viewport as mobile browser toolbars collapse (G1)
- Expand/collapse: a visible grabber bar at the sheet top (pointer-only, `aria-hidden` + `tabIndex={-1}`, 44px coarse-pointer hit area via `TOUCH_TARGET_FROM_20`) and the labeled chevron button (`aria-expanded`) drive the same toggle (G1)
- The sheet's scroll container reserves `env(safe-area-inset-bottom)` so content clears the iOS home indicator (`viewport-fit=cover` in `index.html`)
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
- Header caption: capital(s), comma-separated if a country has multiple (e.g., South Africa: Pretoria, Cape Town, Bloemfontein); a superscript exception marker follows when capital's source differs from the panel's dominant source (D2)
- Region / Subregion badge
- Exception badges — shown only for the two countries where they're non-default: "UN observer state" (Vatican, Palestine) and "Not independent" (Palestine). A badge whose field's source differs from the panel's dominant source carries a superscript exception marker (`SourceMarker`). Absent for the 193 UN member states, so most panels show no badge at all.
- Prime grid (2 columns, always visible regardless of peek/expanded state): Population (locale-formatted), Area (km²), Government type, Languages

**Secondary** (visible in full/expanded state):

- Currencies
- Timezones
- Neighboring countries (clickable chips). Clicking a border chip selects that country — same as clicking it on the map. The map flies to the new country via `flyToCountry()`, the panel transitions to show its data, and the URL hash updates. Each chip click creates a new history entry, so browser Back returns to the previous country. If a border code has no match in `countries.json`, the chip is displayed but not clickable.
- "Explore next" suggestions (`src/lib/exploreNext.ts`, D3): an inert landlocked/coastal fact chip (same styling as non-clickable border chips), up to four same-subregion countries not already in Borders (population-descending, ties by cca3 ascending), and one closest-population country (excluding self, borders, and the subregion picks; ties by cca3 ascending) with a "· similar population · 66.4M"-style suffix. The country chips are `BorderChip`s wired to the same `onSelect` as border chips — identical fly-to/hash/history semantics. Renders for every country (unlike Borders, which needs `borders.length > 0`); computed client-side from the canonical 195 set; no telemetry.

**Source Attribution** (D2): One consolidated footer (`data-testid="panel-sources"`) lists the panel's linked data sources — the same scheme as compare's footer (shared `SourceLinkList` markup). Field-level granularity is preserved two ways: a superscript exception marker (`SourceMarker`, a real link in the Tab order) on any rendered field whose source differs from the panel's dominant source (single owner of the math: `src/lib/fieldSourceMarkers.ts`), and a "Source by field" disclosure button (`aria-expanded`) that expands the footer into the complete field → source table — full granularity one interaction away for every country. The per-field 'i' tooltip rings are retired. Covered by `e2e/single-source-attribution.spec.ts` (desktop-`chromium`, runs on CI). See [Data System — UI Attribution](data.md).

### Compare

From an open country panel, the labeled **Compare** pill (desktop panel header; the mobile sheet's labeled chip ships with D4) puts search into "pick a country to compare" mode (placeholder "Choose country to compare…"; entered via `enterComparePicking` in `App.tsx`, available only while a country is selected). A one-time "Tip: compare two countries side by side" hint shows after the session's second distinct country selection. Choosing a second country opens `CompareCountryPanel`.

One shared field-definition array (`COMPARE_FIELDS`, `src/lib/compareFields.ts`) drives the whole view, so rows always align and no field is silently dropped. Each field renders once via `CompareFieldRow`: numeric fields (population, area, derived density) as paired horizontal bars scaled to max(A, B) — bar A in `--color-signal-mid`, bar B in `--color-ice-mid` (the exact compare-B map-fill hex, matching the map highlights) — with a delta chip ("Germany 1.24× population", larger country always the subject); categorical fields collapse identical values into one centered "Both: …" row and show an em dash where a country lacks a value (bars are static — no transition — so reduced-motion needs no gating). Capitals live in the header captions (all capitals, joined); UN-membership/independence render as exception badges in the column headers, never as rows.

- **Desktop (≥ 1024px):** two column headers (`CountryColumnHeader` — A/B badge, flag, name, capitals, region badge, exception badges) above the shared rows; border chips (`CountryBorders`) are per column, routed through one `onCompareColumnSelect(column, cca3)` callback — a chip in column A replaces A (`compareReplaceA`, keeps B) and a chip in column B replaces B (`compareSelect`, keeps A); a chip naming the other column's country is a no-op (`compareChipClick` in `src/lib/compareMapClick.ts`).
- **Mobile (< 1024px):** an `h-[80dvh]` sheet with ONE scroll container (`data-testid="compare-mobile-scroll"`): a compact sticky header (`compare-mobile-header`) keeps both flags/names/A-B badges visible while the shared rows scroll, followed by per-country "Borders — X" chip groups with the same replace-that-country semantics. (The compact header omits the exception badges; the desktop column headers carry them.)

Camera: `flyToComparePair` frames both countries in the un-occluded area via `cameraForBounds` + `comparePanelPadding()` — desktop reserves the panel footprint as extra `right` padding (B6); mobile reserves the sheet as `bottom` padding (`innerHeight × COMPARE_SHEET_FRACTION`, C6 — which is why the sheet is `dvh`, not `vh`). The globe-scale symmetric-padding fallback is desktop-only (mobile's occlusion is vertical, not horizontal, so the guard's failure mode doesn't apply the same way). Mobile renders its compare camera at pitch 0, not `DEFAULT_PITCH`: `cameraForBounds`' globe-projection fit doesn't account for pitch, and desktop's tilt is harmless only because its occlusion is horizontal — on mobile a tilted render of a pitch-0 fit shifted the pair far enough down-screen to hide under the sheet (fixed 2026-07-29; see `flyToComparePair.ts`). **Known gap (unfixed):** wider pairs under the 110° wide-pair threshold — e.g. Brazil+Nigeria — still render below the sheet at 390px even at pitch 0; `cameraForBounds` itself produces a degenerate fit (a wildly wrong center latitude) for wide spans under this aggressive bottom-padding ratio, and it does not respond linearly to padding adjustments. Needs a dedicated fix, not a numeric tweak.

Fields are not individually source-tagged; a shared footer (`data-testid="compare-sources"`) lists the comparison's data sources, and any field whose source differs from the panel's dominant source carries a superscript exception marker (single owner `src/lib/fieldSourceMarkers.ts`; the single panel uses the same scheme plus a field → source disclosure table — D2). On the map, both countries are highlighted (A = signal, B = ice-mid) while every non-compared country is dimmed by the `country-dim` spotlight layer; exiting compare (Escape or the exit control) clears the second country and restores the borders (`useCompareViewHighlight.ts` + `useCountryBaselinePaint.ts`). Covered by `e2e/compare-view-dimming.spec.ts`, `e2e/compare-map-clicks.spec.ts`, and `e2e/compare-source-attribution.spec.ts` — all desktop-`chromium` only; the mobile Playwright projects contain no compare flow.

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
