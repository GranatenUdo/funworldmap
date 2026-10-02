---
name: funworldmap
description: Play geography on the real world — a playful geography game around a living globe
colors:
  ice: '#7dd3fc'
  ice-light: '#bae6fd'
  ice-dim: '#0369a1'
  ice-accessible: '#075985'
  ice-mid: '#0284c7'
  ice-deep: '#0ea5e9'
  signal: '#ff8a4c'
  signal-dim: '#f97316'
  signal-accessible: '#9a3412'
  signal-mid: '#ea580c'
  sand-50: '#fefdfb'
  sand-100: '#faf7f2'
  sand-200: '#f0ebe3'
  sand-300: '#e0d8cc'
  sand-400: '#b8b0a4'
  sand-500: '#8c8578'
  sand-600: '#6b6459'
  sand-700: '#4a453d'
  sand-800: '#2c2924'
  sand-900: '#1e1b18'
  dark-50: '#f1f5f9'
  dark-100: '#94a3b8'
  dark-200: '#334155'
  dark-300: '#1e2430'
  dark-400: '#161a22'
  dark-500: '#121518'
  spotlight-dim: '#020617'
  space-core: '#16213b'
  space-mid: '#0a0f1f'
  space-edge: '#04060d'
  reveal-correct: '#22c55e'
typography:
  display:
    fontFamily: 'Outfit, system-ui, sans-serif'
    fontWeight: 700
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'Outfit, system-ui, sans-serif'
    fontWeight: 400
  readout:
    fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontFeature: 'tabular-nums'
  label:
    fontFamily: 'Outfit, system-ui, sans-serif'
    fontSize: '11px'
    fontWeight: 500
    letterSpacing: '0.12em'
rounded:
  sm: '2px'
  base: '4px'
  md: '6px'
  lg: '8px'
  xl: '12px'
  '2xl': '16px'
  full: '9999px'
spacing:
  '2xs': '4px'
  xs: '6px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  '2xl': '24px'
components:
  button-primary:
    backgroundColor: '{colors.ice-accessible}'
    textColor: '#ffffff'
    rounded: '{rounded.xl}'
    padding: '8px 16px'
  button-primary-hover:
    backgroundColor: '{colors.ice-dim}'
  button-secondary:
    backgroundColor: '{colors.sand-200}'
    textColor: '{colors.sand-900}'
    rounded: '{rounded.xl}'
    padding: '8px 16px'
  chip-header:
    backgroundColor: 'rgba(250,247,242,0.9)'
    textColor: '{colors.ice-accessible}'
    rounded: '{rounded.xl}'
    height: '40px'
  card-floating:
    backgroundColor: 'rgba(254,253,251,0.95)'
    rounded: '{rounded.2xl}'
  chip-fitted-ice:
    backgroundColor: 'transparent'
    textColor: '{colors.ice-accessible}'
    rounded: '{rounded.lg}'
    padding: '6px 10px'
  pill-ambient-dark:
    backgroundColor: 'rgba(22,26,34,0.8)'
    textColor: '{colors.ice}'
    rounded: '{rounded.full}'
    padding: '10px 20px'
  badge-compare-a:
    backgroundColor: '{colors.signal}'
    textColor: '{colors.dark-500}'
    rounded: '{rounded.full}'
    size: '18px'
  badge-compare-b:
    backgroundColor: '{colors.ice}'
    textColor: '{colors.dark-500}'
    rounded: '{rounded.full}'
    size: '18px'
---

# Design System: funworldmap

## Overview

**Current direction: Playful geography (owner-approved 2026-10-02).**

The real globe is the game board. A calm navy gradient replaces the hex background. The entry pairs a bold question with two warm rounded game cards, clear rules, and an Explore option. Outfit provides friendly headings and readable prose; tabular numerals make scores and comparisons easy to scan.

Primary game cards and results use 24–28px corners and 20–28px padding. Blue actions and warm orange accents retain the existing accessible token palette. Primary controls are at least 44px, body instructions 16px, supporting explanations 14px, and metadata 12px. Light/dark/system preferences remain supported.

Playing has a compact top HUD. Reveals are manually paced and sit beside the globe on desktop or in a bottom panel bounded to 45dvh on mobile; the camera offsets the target into the visible map. Results are modal, but answer review is nonmodal so the globe remains navigable. Mobile country/comparison browsing explicitly switches Map and Details.

All essential content scrolls on short screens. True dialogs isolate background controls and restore focus; read-only review does not trap focus. Reduced-motion users receive immediate camera placement and no decorative animations.

The token catalogue below retains the compatible palette; historical Observatory-specific component notes are superseded by this overview and the October 2026 plan.

## Colors

A calm sand/charcoal housing around two meaningful accents; every accent step's contrast ratio is documented at the token definition in `src/index.css`.

### Primary

- **Ice** (#7dd3fc): interactive and wayfinding — the only color that ever means "you can act here". Dark-mode interactive text, focus rings, search affordances, selection highlight, compare-B, the launcher wordmark. Family steps: **Ice Light** (#bae6fd) dark-mode link hover; **Ice Dim** (#0369a1) light-mode icons/borders/rings (non-text, ≥3:1); **Ice Accessible** (#075985) light-mode interactive _text_ (7.1–7.6:1 AA) and the primary CTA fill; **Ice Mid** (#0284c7) theme-invariant compare-B bars and map fill; **Ice Deep** (#0ea5e9) the light-theme map accent (fill/hover/selection paint).

### Secondary

- **Signal** (#ff8a4c): live game state and loss — score changes, streaks, remaining hearts (filled signal = lives left; spent lives go hollow neutral — owner-approved inversion of the original "signal marks the lost heart" encoding, 2026-08-04; critique evidence: stakes were illegible), the wrong-guess reveal, compare-A. Never used for anything a visitor merely clicks. Family steps: **Signal Dim** (#f97316) borders where base signal runs hot; **Signal Accessible** (#9a3412) light-mode signal _text_ (7.1:1); **Signal Mid** (#ea580c) theme-invariant compare-A bars (one step deeper than the map fill to clear 3:1 on sand).

### Neutral

- **Sand ramp** (#fefdfb → #1e1b18): the light instrument housing. sand-50/95 panel glass, sand-100 chips and inputs, sand-200 secondary buttons and hovers, sand-300 borders, sand-500/600 secondary text, sand-800/900 primary text.
- **Dark ramp** (#f1f5f9 → #121518): the dark housing, named from the text side down. dark-50 "starlight" primary text, dark-100 secondary text, dark-200 borders, dark-300 raised surfaces, dark-400 panel glass, dark-500 deepest surface and the compare-badge ink.
- **Spotlight Dim** (#020617): the neutral map scrim that dims every country except the selection — emphasis by subtraction.

### Data encodings (outside the accent system)

**Reveal Correct** green (#22c55e), the region-badge tints (amber/emerald/rose/blue/teal/slate per continent), and the amber exception/warning badges are _data encodings_, deliberately exempt from the two-accent rule. The Oceania teal badge is Tailwind's default palette, not the retired teal accent.

### Named Rules

**The Two-Accent Rule.** Ice means interactive/wayfinding; signal means live game state/loss. No third accent exists, and neither accent ever borrows the other's meaning. Anything else with hue is a data encoding and must be justifiable as one.

**The Accessible-Pair Rule.** Light surfaces carry the deep variants for text (`text-ice-accessible dark:text-ice`, `text-signal-accessible dark:text-signal`); dark surfaces carry the bare accents. Never place bare ice or signal text on a sand surface.

**The Retirement Rule.** Teal (#14b8a6 family) and coral (#f43f5e family) are retired and pinned absent by `src/lib/__tests__/designTokens.test.ts`. Do not reintroduce them under any name.

## Typography

**Display Font:** Outfit (self-hosted variable 400–700, latin + latin-ext; with system-ui, sans-serif)
**Body Font:** Outfit (same face — one family, two roles)
**Readout Font:** system mono stack (`ui-monospace, 'Cascadia Mono', Consolas, monospace`) — zero bundle cost, always with `tabular-nums`

**Character:** One warm geometric sans does the talking; a cold system mono does the measuring. The pairing _is_ the instrument metaphor — prose in Outfit, readings in mono.

### Hierarchy

- **Display** (`.text-display`: Outfit 700, −0.025em): overlay titles and country names. Panel country name is 24px/700 tight; "Game over" is 20px.
- **Headline** (18px/700): compare column names, launcher card titles, header wordmark (with +0.025em tracking-wide).
- **Body** (14–15px/400): data values (15px with tabular-nums in the panel), search results, general copy.
- **Small body** (13px/400): the deliberate step between body and caption — the launcher subtitle, panel captions, and the map hover-tooltip CSS. Use it for supporting prose that must stay readable at a glance; it is not a substitute for Caption's metadata role.
- **Readout** (`.text-readout`: mono + tabular-nums, size per context): compare values (14px), HUD score (14px/600), game-over stats (24px/700), delta chips (11px).
- **Label** (`.text-label`: 11px/500 uppercase 0.12em): field captions, always in ice (`text-ice-accessible dark:text-ice`). _Known in-flight state:_ the single panel still uses the legacy 0.05em tracking (`tracking-wider`); new work uses `.text-label`'s 0.12em.
- **Caption** (12px/400, sand-600/dark-100): official names, subtitles, personal-best lines.
- **Micro-glyph floor: 10px.** Reserved for non-prose glyphs — superscript source markers and the compare-badge A/B letters. Nothing that reads as a sentence or value may render below 11px, and nothing at all below 10px.

### Named Rules

**The Colorless-Role Rule.** The three role utilities (`.text-readout`, `.text-display`, `.text-label`) carry no color; color is always applied per-usage via the accessible-pair pattern.

**The Tabular Rule.** Any number a player might watch change (scores, ranks, counts, deltas) renders in tabular numerals — `.text-readout` where the mono voice fits, `tabular-nums` at minimum.

## Layout

Map-first, zero page scroll. The map is a full-viewport canvas (`h-screen w-screen overflow-hidden`); every other surface is fixed-position floating chrome with its own internal scroll. The camera, not the layout, absorbs occlusion: opening the 360px desktop panel offsets the fly-to target by −188px; the compare view reserves its 656px panel as `cameraForBounds` padding; the mobile sheet offsets by half its 40vh collapsed height (constants pinned in `src/lib/layoutConstants.ts` and enforced by `layoutConstants.test.ts`).

- **Desktop (≥1024px):** floating right cards — single panel `right-4 top-16 bottom-4 w-[360px]`, compare `w-[656px]`. Header is a fixed click-through bar (interactive islands re-enable pointer events) so the map stays draggable between controls.
- **Mobile (<1024px):** bottom sheets — single collapses to 40vh / expands to 80vh; compare is one 80dvh scroll under a sticky two-country header. Game-over docks as a sheet, centers at ≥640px.
- **Spacing rhythm:** a 4/6/8/12/16/20px scale. Panels: px-5 with py-4 headers and py-3 sections; cards p-5/p-6; pills px-2.5 py-1; badges px-2 py-0.5.
- **Touch floor:** 44px on coarse pointers, achieved with invisible `::after` hit-area insets (`TOUCH_TARGET_*` constants) — glyph sizes never change.
- **z-order** (ad hoc but consistent): vignette 10 → hint 20 → panels/HUD 40 → header/search 50 → banners/game-over 60 → boot 200 → launcher 210 → toast 300 → grain 9999.

## Elevation & Depth

Depth is atmospheric, not stacked. The system hybridizes three devices: **translucency + backdrop blur** (the primary device — frosted surfaces let the map glow through), **one large soft shadow** per floating card, and **ambient staging** (a fixed 10% edge vignette, a 2.5% film grain, and the space-dark backdrop the transparent globe floats in). Hovers never lift; they tint.

### Shadow Vocabulary

- **Floating panel** (`0 25px 50px rgba(0,0,0,0.3)`, dark: `/0.6`): the desktop panel/compare cards — one big soft plume, no second shadow.
- **Sheet** (`0 -10px 40px rgba(0,0,0,0.2)`): mobile bottom sheets, cast upward.
- **Overlay card** (`shadow-2xl`): HUD, search dropdown, game-over card, tutorial.
- **Chrome** (`0 4px 12px rgba(0,0,0,0.2–0.3)`): map controls, hover tooltip.
- **Map glow** (line-width 4, blur 2, opacity 0.3): the selection outline's halo — the spotlight scrim (#020617 at 0.25 over non-selected countries) carries the emphasis; the glow only crisps the edge.

### Named Rules

**The Frosted Card Rule.** There is exactly one floating-surface recipe: `bg-sand-50/95 dark:bg-dark-400/95 + backdrop-blur-xl + rounded-2xl + border sand-200/50 (dark: dark-200/20–30)`. Panels, HUD, dropdown, launcher cards all use it. Do not invent a second card material. (Mobile sheets and the game-over card go opaque — same hues, no blur.)

**The Space-Dark Rule.** The page backdrop (deep-navy radial gradient — space-core `#16213b` → space-mid `#0a0f1f` → space-edge `#04060d` — under an ice-stroked pattern, currently the E4-interim hex grid at `stroke-opacity 0.22` — E1's starfield will replace the tile, not the rule) stays space-dark in **both** themes. Themes re-skin the instruments, never the sky.

## Shapes

Radius encodes hierarchy, stepping down with intimacy: **16px** floating cards, panels, sheets (top corners) → **12px** free-floating chrome (header chips, search, the dropdown, primary CTAs, the panel hero flag) → **8px** in-card instrument fittings (panel/compare controls, border chips — the calibrated recipe) plus small popovers and banners → **6px** micro chips (kbd, delta) → **full** reserved for data-encoding badges, ambient pills (toast, hint, score/streak), and bars. Flags step 12→8→4→2px with physical size. Borders are 1px hairlines at fractional opacity (sand-300/50 light, dark-200/30 dark); the map's country borders are a cased pair (light 0.9px line over a dark 1.6–2.6px casing) so they read on satellite imagery. No sharp corners, no thick strokes, no decorative outlines — geometry stays calm so the ice tints can mean something.

## Components

The component philosophy is settled (owner decision 2026-08-03, chosen live from a three-direction exploration — calibrated/unobtrusive beat tactile/confident and glass-and-starlight): **calibrated & unobtrusive** — controls read as fittings on an instrument: exact, quiet, hairline-bordered, never competing with the globe. Its first shipped expression is the country-panel header: fitted ghost controls (1px `border-sand-300/65 dark:border-dark-200/70`, 8px radius, 16px glyphs), a 15% ice hairline rule under the header, and the corner-ticked flag plate (`.panel-flag-plate` in `index.css` — the first shipped E8 tick surface). The recipe was rolled through the panel body, compare panel, HUD score badge, and launcher dismiss on 2026-08-03 (spec: `docs/superpowers/specs/2026-08-03-calibrated-fittings-rollout-design.md`); launcher card identity (E6) and HUD tick frames (E8) remain future workstream items.

### Buttons

- **Primary CTA** ("Play", "Continue", "Play again"): bg ice-accessible (#075985), white text 500–600 weight, rounded-xl, px-4 py-2; hover deepens to ice-dim (#0369a1). Identical in both themes.
- **Secondary** ("Back to map"): sand-200 / dark-300 fill, primary text, same geometry.
- **Fitted icon button** (close, copy-link, expand — `CloseButton`'s default recipe): p-2 rounded-lg with the 1px fitting border (`border-sand-300/65 dark:border-dark-200/70`), 16px stroke glyph in sand-600/dark-100, quiet tint hover (`sand-200/60` / `dark-300/60`); 32px box grown to 44px on coarse pointers via `TOUCH_TARGET_FROM_32`.
- **Text button** (End game, Skip): 12px sand-500/dark-100 with underline-offset hover; hit-area grown to 44px tall.
- **Focus (all):** `focus:outline-none` + `focus-visible:ring-2` in the ice family — ice-dim/ice-accessible tints on light, bare ice on dark, 40–60% opacity. Never signal.

### Chips & Pills

- **Frosted header chip** (Play / basemap / theme): 40px, rounded-xl, bg sand-100/90 dark:dark-400/80 + backdrop-blur-sm, hairline border; active state flips to the ice-tint selected look (ice-dim/20 fill, ice-dim/40 border).
- **Fitted ice chip** (BorderChip — the signature interactive chip): rounded-lg with the fitting border, transparent at rest, ice-accessible/ice text, tiny flag; hover tints ice (`ice-dim/8` / `ice/8`) — no scale pop, calibrated controls don't jump.
- **Ambient dark pill** (toast + hint): rounded-full dark-400/80–90 with ice/20–30 border and ice text — dark in both themes, fade-up entrance.
- **Badges:** region tints and amber exceptions, 11px/500 rounded-full — data encodings, never restyled as accents.

### Cards / Containers

The Frosted Card Rule surface (see Elevation). Entrances: `panel-card-in` 250ms ease-out (fade + 12px rise + 0.97 scale); compare desktop alone uses a spring overshoot `cubic-bezier(0.34, 1.3, 0.64, 1)`. Panel fields stagger in at 50/100/150ms. Sticky in-panel headers reuse the surface at backdrop-blur-md.

### Inputs

- **Search combobox:** opaque sand-100 (dark: dark-400/80) rounded-xl, pl-10 for the ice search glyph, 14px (16px under 640px — iOS zoom guard); focus ring ice at 40% plus border tint. The `/` kbd chip (6px radius, sand-200/60) renders only on fine pointers when idle. Dropdown rows mark the active option with an ice tint plus a 3px solid ice left rail.

### Navigation (map chrome)

MapLibre controls re-housed to match: frosted 10px-radius group, ice glyphs (light: #075985; dark: recolored to exactly #7dd3fc via a solver-verified CSS filter), 44px targets on touch. Attribution pill and hover tooltip wear the same light/dark chrome literals.

### Signature: the compare pair encoding

One encoding spans panel and planet: A is signal, B is ice — 18px circle badges (#ff8a4c / #7dd3fc with #121518 ink), 8px rounded-full bars (signal-mid #ea580c / ice-mid #0284c7, theme-invariant, deliberately static), and matching map fills and centroid markers. The badge-B/map-B hex divergence (ice vs ice-mid) is an adjudicated AA-contrast decision — keep it.

### Signature: the data cell voice

An 11px uppercase ice micro-label over a tabular readout — the recurring "instrument dial" unit across panel, compare rows, HUD score, and game-over stats.

## Do's and Don'ts

### Do:

- **Do** write every interactive text color as the pair `text-ice-accessible dark:text-ice` (and signal text as `text-signal-accessible dark:text-signal`).
- **Do** reuse the Frosted Card Rule recipe for any new floating surface, and the ice-family `focus-visible:ring-2` for any new control.
- **Do** keep entrances in the house motion grammar: 100–300ms ease-out fade + 6–12px rise, 50–60ms staggers; expose `data-animation-state` (entering→idle via `Element.getAnimations`) on any component that animates, and respect `prefers-reduced-motion` (the global kill-switch collapses everything to 0.01ms).
- **Do** grow sub-44px controls to the 44px floor with the `TOUCH_TARGET_*` invisible-inset pattern — never by inflating glyphs.
- **Do** update `src/lib/layoutConstants.ts` (and its pin test) when changing panel geometry, and expect `designTokens.test.ts` to fail if a pinned token hex or type-role declaration drifts — those tests are the system's alarm, not an obstacle.

### Don't:

- **Don't** introduce a third accent, use signal for anything interactive, or use ice for game-state feedback. When something needs color, first ask: is it wayfinding (ice), live play (signal), or a data encoding (documented palette)?
- **Don't** reintroduce retired hexes: teal #14b8a6/#5eead4/#0d9488, coral #f43f5e/#fb7185/#e11d48, or the old amber reveal #f59e0b.
- **Don't** place bare ice (#7dd3fc) or signal (#ff8a4c) text on sand surfaces — both fail AA there; the accessible variants exist for exactly this.
- **Don't** create a second card material, a second focus treatment, or a second primary-button recipe; variation belongs in content and layout, not in new chrome vocabulary.
- **Don't** theme the page backdrop — space-dark in both themes is a settled owner decision (2026-07-10, reaffirmed 2026-07-27).
