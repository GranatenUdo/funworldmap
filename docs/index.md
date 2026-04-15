# polworldmap Documentation

**Audience**: Developers implementing and maintaining the polworldmap application.

## Reading Order

Start with the purpose, then read the system overview for architecture context, then dive into individual systems as needed.

### Project
- [Purpose](purpose.md) — what polworldmap is, who it's for, core principles, scope

### Systems
- [System Overview](systems/overview.md) — architecture, external dependencies, data flows, error handling
- [Data System](systems/data.md) — data sources, join strategy, enriched data model with source attribution
- [Data Collection](systems/data-collection.md) — multi-source data collection tool, aggregation pipeline, flag bundling
- [Map Rendering](systems/map-rendering.md) — MapLibre GL, basemap, country layers, camera, dark mode
- [Search](systems/search.md) — Fuse.js fuzzy search, autocomplete, keyboard navigation
- [UI Layout](systems/ui-layout.md) — responsive layouts, panel, header, theme system, deep linking
- [Accessibility](systems/accessibility.md) — WCAG AA, keyboard navigation, screen readers, reduced motion
- [Testing](systems/testing.md) — Playwright two-tier strategy, WebGL2 headless, fixtures
- [Build & Deploy](systems/build.md) — Vite, Tailwind 4, build output, deployment
