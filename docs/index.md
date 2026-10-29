# Documentation

## Start here

| You want to…                       | Start with                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Play or understand the project     | [README](../README.md), [purpose](purpose.md)                              |
| Run the project and contribute     | [Contributing](../CONTRIBUTING.md)                                         |
| Ask a question or report a problem | [Support](../SUPPORT.md), [security policy](../SECURITY.md)                |
| Understand the architecture        | [System overview](systems/overview.md)                                     |
| Maintain or release the site       | [Build and deploy](systems/build.md), [operations runbook](ops/runbook.md) |

## System guides

- [Data](systems/data.md) and [data collection](systems/data-collection.md): bundled sources, join strategy, licensing, field attribution, and refresh pipeline.
- [Map rendering](systems/map-rendering.md): WebGL2 globe, basemaps, terrain, layers, and camera.
- [Search](systems/search.md) and [UI layout](systems/ui-layout.md): lookup, panels, themes, and URL navigation.
- [Accessibility](systems/accessibility.md): supported interactions, test coverage, and pointer-only gameplay limitations.
- [Testing](systems/testing.md): unit/DOM/map testing, readiness helpers, and CI limits.
- [Analytics](systems/analytics.md): optional browser telemetry and the separate Worker.

## Test references

- [Playwright project matrix](testing/playwright-matrix.md)
- [Game happy paths](testing/game-happy-paths.md) and [unhappy paths](testing/game-unhappy-paths.md)

## Product, decisions, and history

- [Product record](../PRODUCT.md) and [design system](../DESIGN.md)
- [Architecture decision records](adr/README.md)
- [Roadmap](roadmap.md): deferred ideas, not a release schedule
- [Planning workspace](superpowers/README.md): dated specs, plans, and historical evidence
- [Agent conventions](../AGENTS.md): load-bearing engineering and review rules

Current system guides describe supported behavior. Dated plans and notes explain decisions at the time they were written; they are not current setup instructions. Documentation checks validate Markdown links throughout the repository while preserving historical formatting.
