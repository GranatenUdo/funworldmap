# funworldmap

## What It Is

funworldmap is a free, interactive political world map website. It presents geopolitical information through a map interface that anyone can use — no accounts, no paywalls, no barriers.

## Purpose

The world's geopolitical landscape is complex. Country boundaries, governance structures, demographics, and regional relationships are hard to grasp from text alone. funworldmap makes this information spatial and explorable.

A student researching South American governments can click through the continent. A journalist checking border relationships can see neighboring countries at a glance. A curious person can search for any country and immediately understand its political context.

The goal is not to be an exhaustive database or an analytical platform. It is to be the fastest, most intuitive way to look up and explore basic geopolitical facts about any country in the world.

## Core Principles

### Navigation First

The map is the interface. Pan, zoom, click — every interaction should feel instant and natural. Smooth fly-to animations maintain spatial context when jumping between countries. The user should never feel lost.

### Search First

Typing a country name, capital, or region immediately narrows results. Fuzzy matching forgives typos. Selecting a result flies the map to that country and opens its information. Search is the keyboard-driven complement to the map's visual navigation.

### No Barriers

- No application backend required to run it — the site is static files; the only server-side piece is an optional, free-tier analytics Worker (see [Analytics](systems/analytics.md))
- No API keys or accounts required to use
- Runtime network use is limited to map tiles (basemap, satellite, terrain), plus optional cookieless analytics and error reporting
- Everything delivered as static files — deployable to any CDN
- Works on any modern browser, any device

### Accessible to Everyone

- Keyboard navigable end to end
- Screen reader compatible
- Respects reduced motion preferences
- High contrast, WCAG AA compliant
- Responsive from mobile phones to desktop monitors

## Audience

funworldmap is for everyone, but these users inform design decisions:

- **Students** exploring geography and political science
- **Educators** demonstrating geopolitical concepts
- **Journalists** looking up country facts quickly
- **Researchers** needing a spatial reference
- **Curious people** who want to explore the world from their browser

## What It Is Not

- Not a GIS tool — no custom layers, projections, or spatial analysis
- Not a news platform — no real-time data, events, or editorial content
- Not a historical atlas — shows current political boundaries only
- Not a complete territorial gazetteer — the selectable set is the 195 UN-recognized sovereign states (193 members + the Vatican and Palestine, both observer states); partially-recognized or contested territories (Kosovo, Taiwan, Western Sahara, …) are out of scope for v1

## Scope (Initial Release)

The first version focuses on countries:

- 195 sovereign states (193 UN members + the Vatican and Palestine, both UN observer states)
- Per country: name, flag, capital, region, population, area, government type, languages, currencies, timezones, UN membership, neighboring countries
- Data sourced from multiple authorities (REST Countries, CIA World Factbook archive). Every data point shows its source via tooltip — transparency about where information comes from
- English-only interface (data supports future internationalization)
- Light and dark themes

### Future Vision

- Multi-language support, regional groupings (EU, NATO, ASEAN), sub-national divisions, economic comparisons, historical boundary timelines.

## Game modes

Two playable modes are available via the launcher (opened from the header Play button):

- **Country Pinning** — identify a country by clicking its polygon on the map. Three lives, unlimited rounds. Score is distance-weighted; each correct guess contributes to a running streak.
- **City Guessing** — locate a named city by clicking anywhere on the map. 10 rounds per game, scored by distance from the true centroid. Ocean clicks are valid.

Personal bests (best score, best streak, games played) are stored locally and surfaced in the launcher as motivation to replay.
