# funworldmap

## What It Is

funworldmap is a free website where you play geography on the real world: identify countries by clicking their polygons, locate cities by clicking anywhere on Earth — on an interactive political world map, not a quiz-card UI. Around the play sits a genuine geopolitical reference: click any country and get its political facts, each showing its source. No accounts, no paywalls, no barriers.

The games are the draw; the reference map is the world they live in. (Identity confirmed 2026-08-03 — `PRODUCT.md` is the authoritative product record. Earlier versions of this document framed funworldmap reference-first; the games shipped and became the product's center.)

## Game Modes

Two playable modes are available via the launcher (opened from the header Play button):

- **Country Pinning** — identify a country by clicking its polygon on the map. Three lives, unlimited rounds. Score is distance-weighted; each correct guess contributes to a running streak.
- **City Guessing** — locate a named city by clicking anywhere on the map. 10 rounds per game, scored by distance from the true centroid. Ocean clicks are valid.

Personal bests (best score, best streak, games played) are stored locally and surfaced in the launcher as motivation to replay. (A Daily mode shipped and was deliberately removed — see `docs/superpowers/specs/2026-05-30-remove-daily-design.md`.)

## Purpose

Geography games usually happen on abstract cards, static images, or toy maps. funworldmap puts the play on a real, navigable world map — actual country polygons, satellite imagery and terrain, and a real, attributed dataset underneath. The core loop runs game → curiosity → lookup: a missed country is one click from its facts.

The reference side is genuinely useful in its own right, and its goal is unchanged: not an exhaustive database or an analytical platform, but the fastest, most intuitive way to look up basic geopolitical facts about any country. A student researching South American governments can click through the continent. A journalist checking border relationships can see neighboring countries at a glance. A curious person can search for any country and immediately understand its political context.

Success is measured in craft: funworldmap is a polished public artifact demonstrating engineering and design quality. Visitor counts are secondary (confirmed 2026-08-03).

## Core Principles

### Play Is the Front Door

The games are the primary reason to visit. Reference depth serves the play and the curious moment after a round — not the other way around. The product's playful register lives in copy and game feedback.

### The Real Map Is the Game Board

The map is the interface — for playing and for looking up. Pan, zoom, click — every interaction should feel instant and natural. Smooth fly-to animations maintain spatial context when jumping between countries. The user should never feel lost, and the play never retreats to abstract quiz UI.

### Search First

Typing a country name, capital, or region immediately narrows results. Fuzzy matching forgives typos. Selecting a result flies the map to that country and opens its information. Search is the keyboard-driven complement to the map's visual navigation.

### No Barriers

- No application backend required to run it — the site is static files; the only server-side piece is an optional, free-tier analytics Worker (see [Analytics](systems/analytics.md))
- No API keys or accounts required to use
- Runtime network use is limited to map tiles (basemap, satellite, terrain), plus optional cookieless analytics and error reporting
- Everything delivered as static files — deployable to any CDN
- Works on any modern browser, any device

### Accessible to Everyone

- Keyboard navigable end to end in the reference flows (map, search, panels, compare)
- The games are deliberately pointer-only (owner scope decision, 2026-08-04): guessing means physically finding the place on the globe. A spatial keyboard cursor may come later; typed guessing never will
- Screen reader compatible
- Respects reduced motion preferences
- High contrast, WCAG AA compliant
- Responsive from mobile phones to desktop monitors

## Audience

funworldmap is for everyone, but these users inform design decisions:

- **Players** who enjoy geography games — the primary audience; they arrive to play and measure themselves against their own personal bests
- **Students** exploring geography and political science
- **Educators** demonstrating geopolitical concepts
- **Journalists** looking up country facts quickly
- **Researchers** needing a spatial reference
- **Curious people** who want to explore the world from their browser

## What It Is Not

- Not a GIS tool — no custom layers, projections, or spatial analysis
- Not a news platform — no real-time data, events, or editorial content
- Not a historical atlas — shows current political boundaries only
- Not a complete territorial gazetteer — the selectable set is the 195 UN-recognized sovereign states (193 members + the Vatican and Palestine, both observer states); partially-recognized or contested territories (Kosovo, Taiwan, Western Sahara, …) are currently out of scope

The last three lines — 195 states only, current boundaries only, no news — are pragmatism, not doctrine: as of 2026-08-03 they are open to revisit (see `PRODUCT.md`), but any change starts with an explicit product decision and its own spec. The GIS exclusion stands.

## Scope (Current)

The reference layer covers countries:

- 195 sovereign states (193 UN members + the Vatican and Palestine, both UN observer states)
- Per country: name, flag, capital, region, population, area, government type, languages, currencies, timezones, UN membership, neighboring countries
- Data sourced from multiple authorities (REST Countries, CIA World Factbook archive). Every displayed fact is attributed to its source — transparency about where information comes from

The interface is English-only (the data model supports future internationalization) and ships light and dark themes.

### Future Vision

- Multi-language support, regional groupings (EU, NATO, ASEAN), sub-national divisions, economic comparisons, historical boundary timelines.
