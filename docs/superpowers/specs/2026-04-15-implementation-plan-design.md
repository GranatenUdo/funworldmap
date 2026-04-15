# polworldmap Implementation Design

## Context

polworldmap has 11 system design documents covering architecture, data model, map rendering, search, UI layout, accessibility, testing, and build/deploy. The documentation is comprehensive and internally consistent. No implementation code exists yet. This spec defines how to move from documentation to a working, deployed application.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Builder | Claude Code autonomous sessions, user reviews | Optimizes for self-contained, reviewable work units |
| Approach | Vertical slices | Each phase produces a deployable artifact; problems caught early |
| Hosting | GitHub Pages | Free, git-integrated, deploy via GitHub Actions |
| Data strategy | Build data collection tool first | Validates data model with real data before any UI work |
| Testing | Test-after per phase | Implement feature, verify in browser, then lock down with Playwright |
| Unit tests | Vitest for data tool merge/validation logic | Catches data processing bugs independently of UI |

## Phases

### Phase 0: Repository Foundation

**Produces**: Initialized git repo with project scaffold, CI pipeline, and GitHub Pages deployment.

**Work**:
- `git init`, `.gitignore` (node_modules, dist, .env, OS files)
- Root `README.md` — project name, one-line description, link to `docs/index.md`
- Scaffold via `npm create vite@latest . -- --template react-ts` (preserves existing `docs/` directory)
- Install production dependencies: `maplibre-gl`, `@vis.gl/react-maplibre`, `fuse.js`, `topojson-client`, `world-atlas`
- Install dev dependencies: `@tailwindcss/vite`, `playwright`, `@axe-core/playwright`, `tsx`, `vitest`, `eslint`, `prettier`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Tailwind CSS 4 in `src/index.css`: `@import "tailwindcss"`, `@custom-variant dark (&:where(.dark, .dark *))`
- `tsconfig.json` strict mode, `eslint.config.js`, `.prettierrc`
- `playwright.config.ts` with `--use-gl=swiftshader`
- GitHub Actions workflow (Node 22): lint + type-check + build on push
- GitHub Pages deployment: build → deploy `dist/` on push to main
- npm scripts per `docs/systems/build.md`

**Exit criteria**: `npm run dev` serves starter page. `npm run build` produces `dist/`. CI passes. GitHub Pages deploys.

**Key files**: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/index.css`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `README.md`

---

### Phase 1: Data Collection Tool

**Produces**: Working `npm run update-data` that generates real `countries.json` + SVG flags from REST Countries API and CIA Factbook archive.

**Work**:
- `scripts/sources/rest-countries.ts` — fetch `restcountries.com/v3.1/all?fields=...`, normalize to documented per-country structure
- `scripts/sources/cia-factbook.ts` — download `codesxref.csv` for GEC→ISO mapping, fetch JSON per country from `factbook/factbook.json` archive, extract `Government["Government type"].text`, match by ISO code
- `scripts/sources/flags.ts` — download SVG flags to `public/flags/{cca2}.svg`
- `scripts/merge.ts` — join by country code, priority rules (CIA > REST Countries for governmentType), generate `_fieldSources`, add `_sources` registry, validate join integrity by importing `world-atlas/countries-50m` and checking that every feature ID has a metadata match (log unmatched territories)
- `scripts/fetch-countries.ts` — orchestrator, `--dry` flag
- Unit tests (vitest): merge priority, `_fieldSources` generation, GEC→ISO mapping, join validation, missing/malformed data handling
- Run tool, review output, commit `src/data/countries.json` + `public/flags/`

**Exit criteria**: `npm run update-data` produces valid `countries.json` with ~195 countries. Each country has `_fieldSources`. SVG flags committed. Unit tests pass. `--dry` previews changes.

**Key files**: `scripts/fetch-countries.ts`, `scripts/sources/*.ts`, `scripts/merge.ts`, `src/data/countries.json`, `public/flags/`, `scripts/__tests__/merge.test.ts`

**Docs reference**: `docs/systems/data-collection.md`, `docs/systems/data.md`

---

### Phase 2: Map + Basemap

**Produces**: Full-viewport map with OpenFreeMap basemap and country boundary polygons. No interactivity — just a rendered map.

**Work**:
- `src/App.tsx` — minimal app shell, full-viewport
- `src/components/WorldMap.tsx` — MapLibre GL canvas via `@vis.gl/react-maplibre`
- `src/lib/mapStyles.ts` — basemap URL constant (OpenFreeMap positron)
- Async load world-atlas TopoJSON, convert via `topojson-client.feature()`
- Three layers: `country-fill` (semi-transparent), `country-borders` (thin lines), `country-selected` (empty filter)
- Default view: longitude 0, latitude 20, zoom 2
- `maplibregl.supported()` check with error fallback
- Dev-only: expose map on `window.__polworldmap_map`
- `data-map-loaded="true"` attribute on app root

**Tests**:
- `e2e/scaffold.spec.ts` — app renders, no console errors
- `e2e/map-and-countries.spec.ts` (partial) — `data-map-loaded` set, country features exist at known coordinates

**Exit criteria**: Browser shows pannable, zoomable world map with country boundaries. Basemap renders. CI passes. Deployed.

**Key files**: `src/App.tsx`, `src/components/WorldMap.tsx`, `src/lib/mapStyles.ts`

**Docs reference**: `docs/systems/map-rendering.md`, `docs/systems/overview.md`

---

### Phase 3a: Country Selection + Map Interaction

**Produces**: Click a country → highlight + camera fly-to. Hover feedback. Deselect on ocean. URL hash updates. Touch interaction.

**Work**:
- `src/hooks/useCountryData.ts` — parse `countries.json`, build `byNumeric` + `byCca3` lookups
- `src/hooks/useSelectedCountry.ts` — URL hash source of truth, `hashchange` listener, resolves via `byCca3`
- `src/lib/flyToCountry.ts` — coordinate swap `[lat,lng]→[lng,lat]`, logarithmic zoom from area, `prefers-reduced-motion` check
- Hover: `feature-state` API on `country-fill`, opacity increase, pointer cursor
- Click: `queryRenderedFeatures` → feature ID → `byNumeric` lookup → set hash
- Touch: tap = click, no hover state (documented in map-rendering.md)
- Deselect: click/tap ocean → clear hash
- `country-selected` layer: filter to show only selected country ID
- `data-selected-country` attribute on app root
- Hash resolution deferred until GeoJSON source loaded

**Tests**:
- `e2e/map-and-countries.spec.ts` (complete) — click at France coordinates → `data-selected-country="250"`, zoom changes. Click ocean → deselected. Hover cursor changes (desktop).

**Exit criteria**: Click→highlight→flyTo→hash loop works. Touch works. Deselect works. Hash reflects selection.

**Key files**: `src/hooks/useCountryData.ts`, `src/hooks/useSelectedCountry.ts`, `src/lib/flyToCountry.ts` (includes coordinate swap + zoom calculation)

**Docs reference**: `docs/systems/overview.md` (State Management, Data Flow), `docs/systems/map-rendering.md` (Interaction Model, Touch, Camera), `docs/systems/data.md` (Coordinate System, Bidirectional Lookup)

---

### Phase 3b: Country Panel + Layout

**Produces**: Information panel (sidebar on desktop, bottom sheet on mobile) with all country data fields. Header bar. Border chips. Source tooltips.

**Work**:
- `src/hooks/useMediaQuery.ts` — desktop/mobile detection, handles resize across breakpoint
- `src/components/CountryPanel.tsx` — sidebar (desktop, 380px) or bottom sheet (mobile, 40vh/80vh)
- Primary fields (always visible): flag, name, capital(s) comma-separated, region/subregion
- Secondary fields (expanded): population, area, government type, languages, currencies, timezones, UN status, independence, border chips
- Bottom sheet: peek/full toggle button, close button. Map taps above sheet work.
- Border chips: clickable → set hash (same as map click). Non-matching codes displayed but not clickable.
- Source 'i' tooltips: resolve `_fieldSources` → `_sources` registry → tooltip with name + URL. Hover/focus on desktop, tap-toggle on mobile.
- `src/components/Header.tsx` — floating, `position: fixed`, backdrop blur, pointer-events passthrough. Search placeholder input. Theme toggle placeholder button.
- CSS transitions for panel slide-in/slide-out
- Panel close: clear hash → deselect

**Tests**:
- `e2e/panel-and-deeplink.spec.ts` (partial) — panel opens with correct data (flag, name, capital, population). Close button works. Border chip navigates. Bottom sheet expand/collapse (mobile viewport).

**Exit criteria**: Full click→panel→data→close loop on desktop and mobile. Border chips navigate. Source tooltips work. Header floats without blocking map.

**Key files**: `src/components/CountryPanel.tsx`, `src/components/Header.tsx`, `src/hooks/useMediaQuery.ts`

**Docs reference**: `docs/systems/ui-layout.md`

---

### Phase 4: Search

**Produces**: Fuzzy search with autocomplete dropdown. Type → results → select → country selected.

**Work**:
- `src/hooks/useCountrySearch.ts` — Fuse.js index at startup, weighted fields (name.common 2.0, name.official 1.5, capital 1.0, region/subregion 0.5, cca2/cca3 0.3), threshold 0.4, 150ms debounce
- `src/components/SearchBar.tsx` — WAI-ARIA combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`). `role="listbox"` dropdown with `role="option"` items.
- Max 8 results, each shows: flag, name, capital, region
- Match highlighting via Fuse.js `includeMatches`
- Keyboard: Arrow Down/Up navigate, Enter selects, Escape closes
- Selection: set hash → triggers `useSelectedCountry` → flyTo + panel
- Clear button, no-results message with ARIA live region ("N results for {query}", "No results for {query}")
- Replace Header placeholder with real SearchBar

**Tests**:
- `e2e/search.spec.ts` — type "France" → results → Enter → panel opens. Fuzzy: "Untied" → "United States". Keyboard nav. Escape closes. No results message.

**Exit criteria**: Search works end-to-end. Fuzzy matching. Keyboard accessible. Screen reader announces results.

**Key files**: `src/hooks/useCountrySearch.ts`, `src/components/SearchBar.tsx`

**Docs reference**: `docs/systems/search.md`

---

### Phase 5: Theme System

**Produces**: Three-state theme toggle. Basemap darkens. All UI adapts.

**Work**:
- `src/hooks/useTheme.ts` — three states (light/dark/system), localStorage persistence, `prefers-color-scheme` media query
- `src/components/ThemeToggle.tsx` — sun→moon→monitor cycle, `aria-label` updates per state
- `<html>` class `dark` toggled, Tailwind `dark:` variants on all existing components
- `src/lib/mapColors.ts` — dark mode paint property overrides for basemap layers (background, water, land, roads, labels). Overlay layers independently adjusted (lighter fills, brighter borders).
- `transition-colors duration-200` (disabled when `prefers-reduced-motion`)
- Fallback: if basemap layer IDs unrecognized, UI darkens but basemap stays light
- Replace Header placeholder with real ThemeToggle

**Tests**:
- `e2e/theme-and-responsive.spec.ts` — toggle cycles states. `dark` class applied. localStorage persists across reload. System preference followed. Visual regression screenshots (light vs dark).

**Exit criteria**: Theme persists, basemap darkens, no flash on load, respects system preference.

**Key files**: `src/hooks/useTheme.ts`, `src/components/ThemeToggle.tsx`, `src/lib/mapColors.ts`

**Docs reference**: `docs/systems/ui-layout.md` (Theme System), `docs/systems/map-rendering.md` (Dark Mode)

---

### Phase 6: Deep Linking + History + Accessibility

**Produces**: URL hash sharing, browser history navigation, reset view, skip links, focus management, WCAG AA audit.

**Work**:
- Verify hash sharing: open `#FRA` in new tab → France selected
- Invalid hash: `byCca3` returns undefined → silently clear, default view
- Browser history: select→select pushes entry (Back works), select→deselect replaces (no blank `#`)
- Reset view button: defaults (lon 0, lat 20, zoom 2), deselect, close panel, clear hash
- Map controls repositioned on mobile to avoid bottom sheet overlap
- Skip links: "Skip to search" + "Skip to map", visible on focus
- Focus management: panel open → focus heading, panel close → return focus to search (if via search) or map (if via click)
- ARIA live region announcements for country selection ("{Country} selected") and panel state ("Country panel opened/closed"). Search result announcements are already in Phase 4.
- Tab order verification: skip links → search → theme toggle → map → panel
- `role="application"` on map container with `aria-label` and `aria-description`

**Tests**:
- `e2e/panel-and-deeplink.spec.ts` (complete) — `#FRA` direct load, invalid hash cleared, back/forward
- `e2e/accessibility.spec.ts` — tab order, skip links, keyboard navigation end-to-end, ARIA live regions, axe-core audit (zero violations)

**Exit criteria**: Deep links work. History works. Keyboard navigation complete. axe-core zero violations.

**Key files**: Updates across all components for ARIA attributes, focus management, skip links

**Docs reference**: `docs/systems/accessibility.md`, `docs/systems/ui-layout.md` (Deep Linking, Browser History)

---

### Phase 7: Final Polish + Performance

**Produces**: Production-ready, deployed application.

**Work**:
- Bundle size audit: verify <700KB gzipped (MapLibre ~275, React ~45, app code + data ~360)
- Lighthouse audit: target 90+ performance, 100 accessibility
- Cross-browser: Chrome, Firefox, Safari (WebGL2 support)
- Responsive: mobile portrait, mobile landscape, tablet, desktop
- Visual regression baseline screenshots committed
- `README.md` update: project description, live GitHub Pages URL, development setup, npm scripts, architecture pointing to docs, contributing section
- CI pipeline finalized: lint → type-check → vitest → build → playwright → deploy

**Exit criteria**: Live on GitHub Pages. All tests green in CI. Lighthouse 90+/100. Bundle <700KB. README complete. Repository grade: 9+/10.

---

## Phase Dependency Graph

```
Phase 0 (Scaffold)
    │
    ▼
Phase 1 (Data Tool)
    │
    ▼
Phase 2 (Map + Basemap)
    │
    ▼
Phase 3a (Selection + Interaction)
    │
    ▼
Phase 3b (Panel + Layout)
    │
    ├──────────────────┐
    ▼                  ▼
Phase 4 (Search)    Phase 5 (Theme)
    │                  │
    └────────┬─────────┘
             ▼
Phase 6 (Deep Linking + A11y)
             │
             ▼
Phase 7 (Polish + Deploy)
```

Phases 4 and 5 can run in either order (independent after 3b). All other phases are sequential.

## Session Structure

Each phase is one Claude Code session:
1. Claude reads the phase spec and relevant system docs
2. Claude implements the phase
3. Claude verifies in the browser (where applicable)
4. Claude writes/runs tests
5. Claude commits with a descriptive message
6. User reviews the diff and deployed result
7. User approves or requests changes before next phase

## Documentation References

Every phase references the specific system docs it implements from. The documentation at `docs/systems/` is the source of truth for requirements. If implementation reveals a doc gap, update the doc before proceeding.
