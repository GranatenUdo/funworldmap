# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: players — people who enjoy geography games, on any device, with zero friction (no account, no install, no paywall). They arrive to play Country Pinning or City Guessing and measure themselves against their own personal bests.

Secondary: students, educators, journalists, researchers, and curious people using the map as a fast spatial reference for basic geopolitical facts. These audiences shaped the original reference tool and remain served, but they are no longer the design center.

(Identity confirmed 2026-08-03: **game first** — the geography games are the draw; the reference map is the world the games live in. `docs/purpose.md` was rewritten 2026-08-03 to match.)

## Product Purpose

funworldmap is a free, browser-based world map whose draw is playable geography: identify countries by clicking their polygons, locate cities by clicking anywhere on Earth — on a real, production-quality 3D satellite map, not a quiz-card UI. Around the play sits a genuine geopolitical reference: click any country and get its facts, each with source attribution.

Success (confirmed 2026-08-03): **craft and portfolio** — a polished public artifact demonstrating engineering and design craft. Visitor counts, retention curves, and growth are secondary to the quality of the thing itself.

## Positioning

The games are played _on the real world_: a navigable 3D satellite/terrain globe with actual country polygons and a real reference dataset underneath — where competing geography quizzes use abstract cards, static images, or toy maps. A neighboring product could not truthfully claim this combination: real map as game board, per-field source attribution on every fact, fully static delivery with no accounts and no barriers.

## Operating Context

- Runs in any modern browser, phone to desktop; WebGL required (graceful unsupported message otherwise).
- Root visits open a globe-backed game chooser with rules and an Explore action. Country, comparison and game deep links bypass it. Satellite/terrain remains the default, with a vector map toggle. New games reset the camera.
- Personal bests (best score, best streak, games played) persist in localStorage and surface in the launcher as the replay motivation. No server-side state of any kind.
- URL hash is the single source of truth for country selection and deep links (`#FRA`).
- Light and dark themes (light/dark/system toggle).
- Deployed as static files to GitHub Pages at https://funworldmap.com. Runtime network use is limited to tile CDNs (EOX Sentinel-2 satellite, AWS terrain, OpenFreeMap vector) plus optional cookieless telemetry (analytics Worker, Sentry, Cloudflare Web Analytics).

## Capabilities and Constraints

Confirmed functionality:

- **Games:** Country Pinning (three lives, unlimited rounds, distance-weighted score, running streak) and City Guessing (10 rounds, scored by distance from true centroid, ocean clicks valid). A Daily mode shipped and was deliberately removed (2026-05-30); only legacy-storage cleanup remains. **Guessing is spatial by definition (owner rulings 2026-08-04): the game tests whether you can find the place on the globe — typing a country/city name is never a guess input. The games are deliberately pointer-only for now: keyboard playability was considered and cut as a scope decision, not an oversight. If it is ever added, it must be spatial navigation (e.g. an arrow-key map cursor + Enter), never search.**
- **Reference:** 195 UN-recognized sovereign states (193 members + Vatican + Palestine). Per country: name, flag, capital, region, population, area, government type, languages, currencies, timezones, UN membership, neighbors. Country-to-country compare view.
- **Navigation/search:** fly-to camera, fuzzy search (name/capital/region) with keyboard-driven selection.

Constraints:

- Fully static site; no application backend. The only server-side piece is an optional free-tier analytics Worker. No API keys or accounts required to use.
- Data is bundled at build time: multi-source (REST Countries + CIA World Factbook GitHub archive, CC0, frozen Jan 2026) with a per-field `_fieldSources` map; every displayed fact shows its source. This transparency is non-negotiable.
- English-only interface; data model is i18n-ready.

Explicitly open product decisions (confirmed 2026-08-03): the v1 scope lines — 195 states only, current boundaries only, no news/editorial — were pragmatism, not doctrine, and are **open to revisit**. Contested territories (Kosovo, Taiwan, Western Sahara, …) and the Future Vision items (multi-language, regional groupings, sub-national divisions, economic comparisons, historical timelines) may be taken up; no specific next step is committed as of 2026-08-03.

## Brand Commitments

- Name **funworldmap**, domain **funworldmap.com** (repo folder `polworldmap` is historical). MIT license, author Tobias Ens.
- Visual direction chosen by the owner 2026-10-02: **Playful geography**. Welcoming rounded panels, readable Outfit typography, blue actions and warm orange accents around a quiet navy globe. This supersedes the Observatory direction; older specs remain historical.

## Evidence on Hand

- Real bundled data: `countries.json` with field-level source attribution; SVG flags bundled at build; world-atlas TopoJSON; cities dataset for City Guessing. Sources: REST Countries API + factbook/factbook.json archive (CC0, frozen Jan 2026).
- No testimonials, case studies, press, or usage benchmarks exist. Future work must not fabricate any.

## Product Principles

1. **Play is the front door.** The games are the draw; reference depth serves the play and the curious moment after a round — not the other way around.
2. **The real map is the game board.** Invest in map fidelity, camera feel, and navigation; never retreat to abstract quiz UI.
3. **Craft is the success metric.** Polish, accessibility, and performance outrank growth mechanics; visitor counts are secondary.
4. **No barriers, ever.** Static delivery, no accounts, no paywalls, cookieless telemetry only.
5. **Every fact carries its source.** Field-level attribution is a product identity trait, not a feature.

## Accessibility & Inclusion

WCAG AA is a standing commitment for the reference flows: keyboard navigable end to end (map, search, panels, compare), screen reader compatible, `prefers-reduced-motion` respected (down to map camera pitch), high contrast in both themes, responsive from phones to desktop monitors. Enforced in CI via axe-core Playwright checks. **Scoped exception (owner decision 2026-08-04): the games are pointer-only — the guess action is not keyboard-operable, deliberately (see Capabilities). Game chrome (HUD buttons, overlays, launcher) remains keyboard- and screen-reader-accessible.**

## October 2026 redesign decisions

All answer reveals wait for Next round or See results. Facts never advance the game. Results summarize actual accepted attempts; skipped cities do not contribute to average distance. Current-run review is nonmodal and does not change scores or record another game. Round history exists only in memory. Personal bests remain local to the browser, with explicit persistence-failure feedback. On phones, View map / View details switches reference browsing without clearing selection.
