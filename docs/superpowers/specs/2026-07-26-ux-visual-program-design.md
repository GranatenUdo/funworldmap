# UX & visual program — 2026-07 audit follow-up — design

**Date:** 2026-07-26
**Author:** Tobias Ens (with Claude)
**Status:** Draft — pending user review

## Context

A full UX/visual audit of the live site ran on 2026-07-26: 12 screenshots across every core flow
(landing, search, panel, compare, launcher, both game states, both basemaps, both themes, 390px
mobile), seven dimension reviews against the code, and three adversarial critique passes (product
scope per `docs/purpose.md`, design taste, technical feasibility). 51 findings were raised; 3 were
killed as duplicates, ~12 were revised, and 3 claims were disproven against the code. This spec
captures what survived, organized into seven workstreams.

Each workstream is independently shippable and gets its own implementation plan
(`docs/superpowers/plans/`). Workstream A is a batch of small unanimous fixes; B–G are feature
work in recommended order. Four audit items conflict with previously settled decisions; they are
**not** in scope and are listed under Open questions for an explicit owner call.

## Relationship to prior specs

- **Honors `2026-07-10-review-fixes-batch-1-design.md` settled decisions:** satellite-by-default
  stays; the space-dark backdrop in both themes stays (E1 evolves the backdrop *within* dark);
  game-round camera carry-over stays (see Open question 1); search-Enter-commits-top-result is
  shipped and untouched.
- **Honors `2026-07-10-review-fixes-batch-2-design.md`:** the timezone "+N more" toggle, border
  legibility during play, compare camera offset, and layout constants shipped there are the
  baseline this spec builds on. B6 replaces the compare camera *mechanism* (offset → asymmetric
  padding) while keeping its behavior contract. Batch 2 deferred "per-country political tinting
  (batch 3, design-first)"; workstream B **supersedes** that deferred item — it pursues political
  legibility through labels, cased borders, and a selection spotlight instead of per-country fill
  tinting (disposed of under Non-goals).
- **Honors `2026-05-30-remove-daily-design.md`:** the daily stays removed. A different,
  client-seeded daily mechanic is possible but requires a product decision first (Open
  question 4).
- **Amends** the camera rules from `2026-05-17-camera-coherence-design.md` in exactly three
  places: B6 (compare framing mechanism), G3 (sheet-state compensation), and E5 — which changes
  the *initial* camera (before any user view exists to preserve) and adds pre-first-interaction
  idle rotation. The amended coherence rule: the reveal animation and pre-first-interaction idle
  rotation are the only autonomous camera moves; rotation stops permanently on first
  pointer/keyboard interaction and never runs during games.

## Goals

1. The default map reads as a *political* map: country names and boundaries are legible in both
   basemap styles without leaking answers during play.
2. Compare answers "which is bigger, by how much?" at a glance, on desktop and mobile.
3. The country panel answers scale questions ("is France big?"), reaches WCAG AA for source
   attribution, and invites a next step instead of dead-ending.
4. The visual identity commits to a direction ("observatory", chosen by the owner on
   2026-07-27) instead of the generic dark-plus-teal template, without touching settled
   constraints.
5. The games celebrate what the player does and teach what they missed.
6. The first three minutes on a phone are free of platform-level friction (auto-zoom, sub-44px
   targets, content under the home indicator).

## Non-goals

- Backend, accounts, server persistence of any kind (constitutional, `docs/purpose.md`).
- Reintroducing a daily mode (Open question 4; own spec if approved).
- "france vs germany" search grammar and border-chip compare entry — noted as future compare
  entry points, not built here.
- Log-scale position bars under panel stats — rank text answers the scale question; revisit only
  if hero stats prove insufficient.
- Per-country political tinting of the base fill (batch 2's "batch 3" deferral) — superseded by
  workstream B: labels (B1), cased borders (B2), and the selection spotlight (B4) deliver
  political legibility without hand-managing 195 fill colors. Revisit only if B lands and the map
  still reads apolitical.
- Bottom-sheet pointer-drag with snap points — deferred to a follow-up spec if G1 proves
  insufficient (grabber + safe-area first; gestures are the riskiest e2e surface in this
  program).
- Renaming the game modes (purpose.md's "Country Pinning" / "City Guessing" stay canonical).
- Duotone illustration strips on launcher cards (killed in critique: decoration without
  information).
- A first-visit tagline under the wordmark (killed: second transient message competing with the
  existing hint).

---

## Workstream A — quick wins batch

Small, unanimously endorsed fixes. Each item is one commit-sized change; the batch is one plan.

- **A1. Escape mid-round records the run.** `GameController.tsx`'s Escape exit handler fires
  during `playing` (both modes), during city-guessing `round-ended` (only country-pinning
  `round-ended` is excluded, where Escape advances), and on `game-over`. In the first two cases
  it calls `endGame()` + `writeIdleHash` — the score is never shown and the personal best never
  recorded, while the HUD's End-game button correctly routes `finishFree()` → game-over → record.
  Route `playing` and city-guessing `round-ended` Escapes through `finishFree()`; keep game-over
  Escape on `endGame()` + `writeIdleHash` (`finishFree` is a no-op there and the hash must
  reset). Escape-as-advance on country-pinning `round-ended` is unchanged. Update the affected
  unit/e2e assertions.
- **A2. No iOS auto-zoom on search focus.** The search input is `text-sm` (14px); mobile Safari
  force-zooms focused inputs under 16px. Use 16px on small viewports (`max-sm:text-base`). Do not
  touch the viewport meta (`user-scalable=no` violates WCAG 1.4.4).
- **A3. Light-theme chrome parity + AA.** In light mode the header wordmark and Play button
  render `--color-teal` on the pale basemap (~2.5:1; AA requires 4.5:1). The fix token
  `--color-teal-accessible` is already used for light-mode CTAs and links in the panels and
  game-over overlay — the header never adopted it. Switch the header brand/interactive text (and
  the new light chrome below) to it. Scope the
  hardcoded dark MapLibre chrome (attribution pill, nav-control group, country tooltip in
  `index.css`) under `.dark` and add light counterparts (sand surfaces, sand-300 borders,
  teal-accessible links; drop the `!important`s by raising specificity). Give the light search
  field a visible border (`border-sand-300`) and `sand-100` fill. The *backdrop* stays space-dark
  in both themes (settled).
- **A4. Panel prime grid deduplication.** Capital and Region DataCells repeat the header (capital
  caption + region badge, which shows region *and* subregion). Delete both cells; promote
  Government and Languages into the prime grid. The header caption takes over multi-capital
  display (all capitals joined, as the deleted cell did). The collapsed mobile sheet then shows
  four non-redundant facts.
- **A5. Boolean cells become exception badges.** "UN Member: Yes / Independent: Yes" carry ~0
  bits for 193 of 195 countries. Remove both DataCells; render a small amber badge next to the
  region badge per flag, only when that flag is false: `unMember === false` → "UN observer
  state"; `independent === false` → "Not independent". The flags diverge in the source data
  (Vatican is `independent: true`), so each drives its own badge; both false renders both.
- **A6. Wrong-guess copy leads with distance.** `MESSAGES.wrong` currently reads "Wrong — that
  was {clicked}. +{points} points. The answer was {target}. −1 life." — it never shows
  `distanceKm`, which `scoring.ts` computes and which the whole formula decays on. The change:
  lead with distance and drop the redundant "The answer was {target}" (the HUD prompt already
  names the target). New shape: "That was Germany — 7,050 km from Bangladesh. +9 proximity pts ·
  −1 life." Thread `reveal.distanceKm` into the HUD reveal line and the screen-reader
  announcement.
- **A7. Compare picking mode gets a visible Cancel.** The "Pick a country to compare with..."
  banner is passive and Escape is the only exit — nonexistent on touch. Add an inline Cancel (×)
  calling the existing exit path, and `role="status"` on the banner.
- **A8. Stray clicks stop destroying comparisons.** With `compareWith` set, a map click on a third
  country currently falls through to `select()` and tears down the pair. Reinterpret: click on a
  third country replaces B; click on A or on ocean is a no-op; border-chip clicks inside a column
  replace that column's country. Escape and A15's "Exit compare" control remain the only exits.
- **A9. Compare borders "+N" becomes real.** The compare column slices borders to 6 and renders
  an inert "+2" span (the single panel shows all chips). Drop the slice — chips wrap and the
  column scrolls.
- **A10. Hover tooltip clamps at viewport edges.** Tooltip position is cursor +15/+15 with no
  clamping; it clips at the right/bottom edges and under the open panel. Clamp-and-flip inside
  the existing rAF positioning callback using the tooltip's measured size.
- **A11. Permanent `/` shortcut affordance.** Render a small `kbd`-styled `/` chip inside the
  search input's right edge, hidden on coarse pointers and while focused.
- **A12. Second onboarding hint + gate fix.** After the user closes their first country panel,
  show the existing hint pill once with "Try a game — guess countries and cities". Gate it and
  the existing click-hint with `localStorage` (the current `sessionStorage` gate re-nags regulars
  every tab).
- **A13. 44px touch-target convention.** Sheet header buttons (~36px), search-clear (~24px — the
  WCAG 2.5.8 floor exactly), and the HUD End game / Skip text buttons (~16px — below even the
  24px 2.5.8 floor) get padded hit
  areas to ≥44px on touch surfaces without changing glyph sizes. Pin the convention with a unit
  test in the `layoutConstants` style.
- **A14. Capability-gated hint copy.** On coarse pointers ("(hover: hover) and (pointer: fine)"
  via `useMediaQuery`): hint says "Tap a country to explore" (no `/`), and the search dropdown's
  kbd footer row is dropped.
- **A15. Compare share + honest close.** Add copy-link to the compare header (the `#FRA,DEU` hash
  already round-trips; reuse the single panel's copy-link + toast). The top-right × closes the
  whole panel (matching its position's convention). Because that × is today the *only*
  touch-reachable way back from compare to single, add a labeled "Exit compare" control in the
  compare header alongside it — the compare→single step must stay reachable without a keyboard.
  Escape keeps the staged exit (compare → single → closed).
- **A16. Launcher first-run copy.** The subtitle "Pick a mode and beat your best" addresses a
  player with no bests. Until either mode has `gamesPlayed > 0`, use "Two quick geography games".
  Suppress "Best 0 pts" whenever `bestScore === 0` (show games count only). The
  rules-at-a-glance line lands with E6, not here.

**A-batch commit structure** (from the 2026-07-27 interaction audit — the 16 items are not 16
independent commits; the A plan follows this shape, ~10 commits):

1. Parallel singles, any order: A1, A6, A10, A16 (all verified free of hidden test breakage).
2. Panel commit: **A4+A5 merged** (they rewrite the same SingleCountryPanel blocks; separate
   commits guarantee conflicts). Ships with two e2e updates in the same commit:
   `panel-and-deeplink.spec.ts` (CI-covered) re-anchors its mobile peek-state sentinel from the
   deleted "UN Member" cell to a surviving field, and `source-tooltip-edge.spec.ts` repoints its
   "first Source button" anchor at the new first DataCell. Interim attribution: the header
   caption and region badge absorb fields that carried source rings — the caption keeps a
   `SourceTooltip` affordance for capital/region until D2's consolidated footer lands (no silent
   attribution regression). Then A7, noting it threads a new cancel callback App →
   CountryPanel → SingleCountryPanel.
3. Search sequence: A2 → A11 → A14's search half (one input `className` line; the kbd chip and
   clear button must have an explicit coexistence rule), with A3's search-field line rebased
   knowingly.
4. Hint commit: **A12 + A14's hint half merged**, including the `useFirstVisitHint` unit-test
   rewrite (it pins the sessionStorage gate) and `pointer-events-none` on the pill — A12 makes
   the pill appear in a state many specs click through.
5. Compare sequence: **A9 → A15 → A8** (A8's contract names A15's Exit-compare control; A9
   edits the chip block A8 rewires). A8 is descoped to the map-click semantics (third country
   replaces B; A/ocean no-op) with its 4-case e2e matrix; the border-chip-per-column clause
   moves to workstream C, whose C1/C2/C6 rebuild those columns. A8's plan must resolve the
   interaction with the click-origin mark in `useMapInteractions` (a replace-B click now changes
   the hash and feeds `preserveZoom` into the compare camera path).
6. A13 last, after the panel and search restructures, so hit-area padding applies once to the
   final button set.
7. One-hour **B1 glyph spike** rides along: a throwaway symbol layer confirming
   `Noto Sans Bold` renders from the existing endpoint (expected to pass; live-verified at the
   HTTP level 2026-07-27).

## Workstream B — a political map that shows its politics

The default satellite view hides every basemap label (`applyBasemapLayerVisibility` hides all
non-custom layers when satellite is on), so a political world map shows no country names at any
zoom; the vector view at mid-zoom is dominated by roads and admin-1 labels flattened to one
AA-failing gray. This workstream is the "batch 3" political-legibility design cycle batch 2
anticipated.

- **B1. App-owned country labels on satellite.** A `country-labels` symbol layer (the
  `country-` prefix is required for the visibility owner's custom-layer skip; register it in the
  `LAYER` registry, added last in the onLoad sequence) over a small app-built point-geometry
  GeoJSON source from bundled data (`country.latlng` centroids + `name.common` + an `areaRank`
  property): area-ranked `minzoom` and `text-size` (giants from z1.5, microstates from ~z5) and
  `symbol-sort-key` by area rank so globe-scale label collision drops microstates before giants
  deterministically; white text with a dark halo (~1.5px). Glyphs — **decided, live-verified
  2026-07-27**: `text-font: ['Noto Sans Bold']` via the positron style's existing glyphs
  endpoint, which is live in every mode (satellite is a raster layer inside the always-loaded
  positron style, not a style swap) and serves Noto Sans (one cached ~77 KB PBF covers all 249
  names — every `name.common` is Latin-1). The default MapLibre font stack would 404 on this
  endpoint, so `text-font` must be explicit. Self-hosting brand-font PBFs is **rejected**: the
  glyphs URL is style-global in MapLibre 5, so overriding it breaks every vector-mode basemap
  label. No font assets ship; no bundle-budget change needed. Game gating requires new work, not
  the existing rule: `applyBasemapLayerVisibility` deliberately never touches custom `country-*`
  layers, and its generic symbol rule would wrongly hide the new layer in satellite mode — so
  the owner gains an explicit rule for the label layer, **visible iff `satellite && !hideLabels`**,
  applied from the same `{ satellite, playing }` change site. Extend the batch-2 truth-table unit
  test with the new rows (including toggle-satellite-mid-game ordering), and add an e2e assertion
  via the map test seam that the layer's visibility is `none` while a session is `playing` —
  seam assertions only, never rendered-text pixels, because the e2e tile stub serves empty glyph
  PBFs. The B1 task budgets a half-day tuning pass (minzoom/text-size curve, halo over bright
  imagery, pitch-60 terrain-occlusion check over mountainous countries).
- **B2. Cased country borders on satellite.** Replace the single 0.5px hairline with a cased pair
  (≈1.6px dark casing under a ≈0.9px light line), zoom-interpolated, via
  `applyCountryBaselinePaint` — the single paint owner, which batch 2 already taught to write
  border width per mode. The owner grows a second (casing) line layer. The cased baseline
  supersedes batch 2's satellite-play emphasis (1.6px/0.9 via the `gameActive` branch): those
  values are near-identical to the new resting state, so the branch is removed and its truth-table
  rows retired — play and rest render the same legible cased borders.
- **B3. Vector "political mode" pass.** A layer-id/source-layer matcher next to `applyMapTheme`
  in `mapColors.ts`: hide minor-road classes below ~z8 and fade trunk roads near-background;
  drop admin-1 boundaries to a faint dash; hide sub-city place labels at low-mid zoom; restyle
  symbol layers by tier (country large/near-white AA-checked, capitals medium, rest dim) instead
  of today's single flat gray. Testing is two-part, explicitly: (1) a deterministic unit test of
  the matcher against a **committed style-JSON snapshot fixture** — no network in `npm run
  check`; (2) live drift is handled by the matcher failing open at runtime (unmatched layers stay
  positron-default, never broken) plus a documented manual fixture refresh when the vector view
  visibly regresses. No scheduled fetch job.
- **B4. Selection as spotlight, not sticker.** Selecting France covers it with coral fill at 0.32
  opacity — the requested country becomes the least legible thing on screen. Invert: add a
  `country-dim` fill layer filtered to everything *except* the selection (and compare partner) at
  ~0.25 dark opacity; drop selection fill to ≤0.10; keep the selection border with a tighter
  glow (4px, blur 2, from 10px/blur 5). Border color: today's coral until E4 lands, then E4's
  ice (B ships first under the recommended order — the spotlight mechanism is color-agnostic).
  Compare mode excludes both A and B from the dim filter. Invariant to preserve: every
  `queryRenderedFeatures` call in app and e2e code is layer-scoped today, which is why a new
  fill layer cannot pollute click handling or ocean-click preconditions — future callers must
  stay layer-scoped.
- **B5. Reveal fill pulse.** At reveal, the answer country gets only a recolored hover-border and
  doesn't pop. Add a dedicated `country-reveal-fill` layer (not a borrowed selection layer — the
  single-owner lesson) pulsing fill-opacity 0.35 → 0.12 over two beats, settling at 0.15 for the
  reveal phase; reduced motion gets the static 0.2 fill. Test contract: this is a map paint
  animation, invisible to `Element.getAnimations` — the pulse waveform/duration is unit-tested in
  the `revealAnimation.ts` style, and e2e polls the settled `fill-opacity` value through the map
  test seam (the `reveal-animation.spec.ts` pattern), not `data-animation-state`.
- **B6. Compare camera via asymmetric padding.** `flyToComparePair`'s screen offset can't fix
  zoom sized to the full viewport, so country B still slides under the panel. Replace offset +
  symmetric padding with `cameraForBounds(bounds, { padding: { right: <panel footprint from
  layoutConstants> + margin, ... } })`. Keep the >110° wide-pair midpoint fallback; re-verify the
  `GLOBE_SCALE_ZOOM` guard with the Japan+USA and France+Germany live cases before removing it.
  A/B centroid markers ride on B1's label-layer pattern (defer if B1 hasn't landed).
- **B7. Map control polish.** The controls are already app-styled (not stock); the real gaps are
  ~29px targets, the ambiguous hand-built reset glyph, and dark-only styling. Enlarge to 44px,
  redraw the reset glyph (crosshair-globe or home), add the light-theme variant with A3.

## Workstream C — a compare view that actually compares

- **C1. One shared field list drives both columns.** Today each column conditionally renders
  fields, so rows misalign when one country lacks a value (Languages of B lines up with
  Government of A), and compare silently drops Timezones and Independent (Capital appears as the
  column-header caption, first capital only). Define one field-definition array; render every
  row for both countries with an em-dash placeholder. Consistent with A4/A5: capital stays in
  the column-header caption (extended to join all capitals); Timezones returns as a real row;
  UN-membership/independence render via A5's exception badges in the column headers — no
  near-constant boolean rows, and no Capital row duplicating the caption.
- **C2. Shared-row comparison table.** For numeric fields (population, area, density): one row
  per field with paired horizontal bars (plain divs) scaled to max(A, B), signal-A / ice-B
  (E4 tokens)
  matching the map fills, and a delta chip ("Germany 1.26× population"). For categorical fields:
  collapse identical values into one centered "Both: euro (€)" row; highlight differences.
- **C3. Derived density row.** population / area, computed in-place for both countries.
- **C4. Attribution stays consolidated.** Compare keeps its linked sources footer. Exception
  markers (per-field marker only where a field's source differs from the dominant one) follow
  D2's scheme; the marker definition ships with whichever of C4/D2 lands first, and the other
  adopts it. No return of per-field "i" rings.
- **C5. Labeled Compare entry.** Replace the 20px hover-title-only Venn icon with an icon + text
  "Compare" pill in the panel header (desktop). After the user's second distinct country
  selection in a session, show a one-time "Tip: compare two countries side by side" using the
  existing hint pill styling. Scope split: C5 ships the desktop pill + tip; the mobile sheet's
  labeled compare chip ships in D4 (which owns the sheet-header restructure).
- **C6. Mobile compare is one scroll.** Replace the two stacked independently-scrolling ~35vh
  halves (A's population is never on screen with B's) with a single scroll of the C2 shared rows
  under a compact sticky header carrying both flags/names. Camera: pass a bottom padding of
  `window.innerHeight × COMPARE_SHEET_FRACTION` into `cameraForBounds` instead of the flat 80px.

Desktop grid and mobile list consume the same field-definition array from C1.

## Workstream D — a panel that answers "so what?"

- **D1. Hero stats row.** Population and area render as compact primary numerals ("66.4M",
  "544K km²"; exact figures in `title`), each with a "#20 of 195" world-rank sub-line, plus
  derived density as a third stat. Ranks and density are computed from the in-memory 195-country
  dataset (already passed to the panel) — zero data cost. Uses E2's `.text-readout` role (see
  sequencing).
- **D2. Attribution: one footer, exceptions inline.** Delete the 11 per-field "i" rings
  (hover-only, `tabIndex={-1}`, keyboard-unreachable — a documented trade-off this design
  retires). Adopt the compare panel's consolidated linked footer in the single panel,
  Tab-reachable. Preserve field-level granularity two ways: a superscript exception marker on any
  field whose source differs from the panel's dominant source (computed from `_fieldSources`),
  and the footer expands on activation into the full field → source table, so complete
  granularity stays one interaction away for every country.
- **D3. "Explore next" block.** Fill the dead space below Borders with: a landlocked/coastal fact
  chip (the bundled `landlocked` field renders nowhere today); 3–4 same-subregion countries not
  already in Borders; one "similar population: Italy (58.9M)" chip. All reuse `BorderChip` and the
  existing `onSelect`.
- **D4. Mobile sheet header restructure.** The collapsed 40vh sheet spends a full row on four
  stacked icon buttons. Inline the actions (flag + name left; share + close right), move compare
  to a labeled chip below the grid (C5), and give the reclaimed row to D1's hero stats so the
  collapsed sheet answers population/area without expanding. The expand affordance becomes G1's
  grabber (single implementation); the chevron stays as the labeled a11y control.

## Workstream E — "observatory" visual identity

Direction chosen by the owner on 2026-07-27 from a three-option design review (Night Atlas /
Observatory / Expedition Ledger — see the review artifact): **Observatory**. Commit fully to the
instrument idea the current console look only gestures at — the globe is the observed object and
the chrome is a calibrated instrument. Cool deep space, a sparse starfield instead of the hex
tile, corner-tick frames on data surfaces, readouts in the system mono face, and one signal hue
that only ever means "live". The backdrop stays dark in both themes (settled). The "fun" in
funworldmap lives in copy and game feedback (F1/F2), not in the hue system — a deliberate
trade-off from the review.

- **E1. Backdrop + staging (within space-dark).** Replace the uniform hex tile with a sparse
  starfield — a handful of 1px radial-gradient points baked into the body background (no image
  asset) — over a cool radial gradient (`#0E1622` center → `#060A12` edges; final values
  AA-validated). Keep the grain. Stage the globe with one thin orbit ring (ice at low opacity
  with a single bright node) as a chrome-side element behind the canvas edge, plus a soft
  atmospheric rim halo behind the globe (ice ~8% fading over ~60px past the globe edge). Deepen
  the existing vignette overlay (`App.tsx` already has one — deepen, don't stack a second
  layer). Decision point: the E1 plan presents a screenshot pair (two starfield densities) at
  the plan checkpoint before the item merges. Validate every text token against the new
  surfaces for AA.
- **E2. Typographic roles.** Outfit stays for display and body — the existing `400 700` range
  is sufficient, so the font-axis verification gate from the earlier draft is gone and no
  re-subset happens. Data readouts move to the system mono stack (`ui-monospace, 'Cascadia
  Mono', Consolas, monospace` — zero bundle cost). Utilities: `.text-readout` (mono,
  `font-variant-numeric: tabular-nums`, used for panel stats and ranks, compare values, game
  scores, coordinates), `.text-display` (Outfit 700, tight tracking — panel country names,
  "Game over"), `.text-label` (the existing 11px uppercase, tracking widened to ~0.12em).
  Note: single-panel DataCells, the HUD ScoreBadge, and the game-over stats already set
  tabular-nums — the only tabular-nums gap is CompareField; for those surfaces `.text-readout`
  is a face change, not an alignment fix.
- **E3. Wordmark.** One device, committed: "funworldmap" in the starlight foreground with a
  reticle mark (crosshair-in-circle, one small inline SVG in ice) as the brand glyph after the
  name, extracted as a `<Wordmark size>` component absorbing the three call sites (Header,
  Launcher, App loading screen). No color-split, no second device. The launcher variant scales
  the same device up with tighter tracking.
- **E4. Semantic color tokens.** Two accents, one meaning each, documented in `mapPalette.ts`:
  **ice** (`#7DD3FC` family) = interactive and wayfinding — links, focus, search, basemap
  toggle, map selection border/glow, compare-B; **signal** (`#FF8A4C` family) = live game state
  and loss — score changes, streaks, lost hearts, the wrong-guess reveal (absorbing the current
  amber role into the signal family), compare-A. Coral retires entirely; existing teal chrome
  migrates to ice. A dark ice-accessible variant is defined for light-mode text, following the
  `--color-teal-accessible` pattern (A3 ships first with the current teal tokens and is
  re-skinned by this migration). Hearts render neutral starlight and turn signal when lost.
  Region badges stay as they are (they are region-keyed, verified correct), and A5's exception
  badges keep their muted amber — like region badges, they are data encodings outside the
  two-accent chrome system, not accents.
- **E5. Landing behavior.** (a) Initial globe longitude derived from
  `Intl.DateTimeFormat().resolvedOptions().timeZone` via a static timezone → longitude table (no
  geolocation, no network) so visitors land on their own region. Determinism: like the rotation,
  the derived center is disabled whenever `VITE_TEST_HOOKS` is set — e2e builds always start at
  `DEFAULT_CENTER` (the host timezone otherwise varies between dev machines and CI, and
  camera-dependent specs scan around viewport center). The E-workstream plan audits specs that
  assume the initial camera. (b) Idle auto-rotation ~1°/s that stops permanently on first
  pointer/keyboard interaction; disabled under `prefers-reduced-motion` **and** whenever
  `VITE_TEST_HOOKS` is set; **paused while `document.visibilityState` is hidden and self-stopped
  after ~120 s even without interaction** — the recurring cost of rotation is the WebGL render
  loop, not tile fetches (at the default z1.8 the whole-world raster pyramid is a few dozen
  tiles, fetched once and cached — analysis recorded here so the CDN-churn question stays
  answered); rotating/idle state exposed as a data attribute so camera-dependent
  e2e specs can assert it is off. (c) Bias the default view slightly (zoom/center) so the hint
  pill isn't orphaned at the bottom edge. (d, optional flourish) A small mono coordinate
  readout of the viewport center (lat/lng) bottom-left on fine-pointer viewports, hidden during
  play and behind the same attribution-corner spacing rules.
- **E6. Launcher card identity.** Tick-framed instrument cards: per-mode accents from E4
  (Country signal, City ice), distinct icons, a rules line in the readout face — no emoji
  ("3 LIVES · ENDLESS" / "10 ROUNDS · ~2 MIN"), and personal bests as two small stat tiles using
  `.text-readout` instead of the dot-separated sentence. Existing mode names, stagger animation,
  and testids stay. A16's zero-state behavior carries over: the subtitle gate is unchanged, and
  when `bestScore === 0` the score tile is omitted — only the games-count tile renders.
- **E7. About surface + mobile brand.** A small "i" button (header, next to the theme toggle)
  opens a lightweight About modal reusing the launcher's focus-trap plumbing: one-sentence value
  prop, keyboard shortcuts, data-source credits, and the two game modes. Restore a compact
  wordmark on mobile when no panel is open (today mobile shows no product name anywhere).
- **E8. Instrument chrome grammar.** Corner-tick frames (1.5px ticks, ~7px legs) and tight ~4px
  radii are reserved for **data surfaces** — stat readouts, launcher cards, HUD badges. Overlay
  shells (panel, launcher backdrop, modals) keep the existing soft-radius + backdrop-blur
  grammar. One boldness locus: the readouts; everything around them stays quiet.

## Workstream F — game feel

- **F1. HUD feedback.** Three reduced-motion-gated, CSS-only beats, each exposing
  `data-animation-state` per CLAUDE.md: a floating "+N pts" chip that drifts up from the
  ScoreBadge (which scale-pulses on change); a brief scale-down + shake on a lost heart before it
  recolors to E4's lost (signal) state; streak milestones at 3/5/10 swapping the pill copy with a
  one-shot flare — expressed typographically in the app's voice, no emoji. Implementation: CSS
  keyframes + a `usePrevious` hook, no libraries.
- **F2. Game-over recap.** Add `history: RoundOutcome[]` to the session reducer (appended in the
  `attempt` case; target name/flag, points, distanceKm, correct). The game-over overlay renders a
  compact per-round list — outcome mark, flag, name, points — where missed entries are clickable
  and open that country's panel after "Back to map" (game → lookup, the product's core loop). Add
  "Copy result": a Wordle-style clipboard string (outcome marks per round + score +
  funworldmap.com) via `navigator.clipboard.writeText` with the existing toast
  (`writeText` is safe; only `readText` is banned — project memory). Hide the "Longest streak"
  stat when it is 0.
- **F3. Region filter.** A chip row on the launcher cards (World · Africa · Americas · Asia ·
  Europe · Oceania) filtering the round-generator pool. `CountryLike` (the pool shape built in
  `App.tsx`) gains `region` — it doesn't carry it today. Personal bests key per (mode, region)
  extending the v2 key scheme (the v1 daily-pollution lesson). Last selection persists next to
  `lastMode`. No separate difficulty system — region is the difficulty lever, and "Africa only"
  is the stated educator use case.

## Workstream G — mobile platform feel

- **G1. Sheet fundamentals.** Switch sheet heights from `vh` to `dvh`; add
  `pb-[env(safe-area-inset-bottom)]` to the sheet scroll container (content currently sits under
  the iPhone home indicator); add a visible grabber bar at the sheet top wired to the existing
  expand toggle, with the chevron kept as the labeled control (`aria-expanded`). This is the
  single grabber implementation D4 consumes.
- **G2. Sheet gestures — deferred.** Pointer-drag with snap points and dismiss-below-threshold is
  a follow-up spec after G1 proves insufficient (riskiest e2e surface; needs its own
  `data-animation-state` design).
- **G3. Camera compensates for sheet state.** On sheet snap-state change, `easeTo` with the
  offset recomputed from the actual snap fraction (`panelScreenOffset` currently bakes in the
  collapsed 40vh only, so expanding slides the country behind the sheet). Mobile compare framing
  is C6's padding change. Test contract: camera moves are invisible to `Element.getAnimations` —
  e2e waits on `!map.isMoving()` via the map test seam, then asserts the recomputed offset (the
  `reveal-animation.spec.ts` pattern).
- **G4. Mobile header consolidation.** On `<sm`, fold the basemap and theme toggles into one
  overflow button opening a small popover (reuse the focus-trap util); Play and search stay
  inline; search gets `min-w-[60%]` (the compare placeholder "Choose country to compare..." is
  the longest string that must fit). Sequence with E7, which also wants header space.

---

## Sequencing and dependencies

Tranche order (final, from the 2026-07-27 de-risk review):

1. **A** — quick wins per the A-batch commit structure above, including the one-hour B1 glyph
   spike.
2. **B-core** — B1, B2, B4 (interim coral border), B5, B6, B7: all pure paint-owner work with
   verified owners and no unknowns. B1 precedes B6's markers. **B3 is severed** from this
   tranche (see 6).
3. **E-foundations as its own atomic tranche** — E2 type utilities + E4 token definitions + the
   complete teal→ice / coral-retirement migration across chrome AND map paint in one change:
   `mapPalette.ts`, the highlight stacks, `useCompareViewHighlight`, B4's border re-skin, the
   light-theme accessible variant, and an interim ice recolor of the hex-tile stroke (the
   backdrop data URI hardcodes `#5eead4`, which otherwise survives until E1). By diff surface
   this is the largest single visual change in the program (~92 teal occurrences across 29
   files) — it gets its own plan, review, and both-theme live pass so users never see a
   mixed-accent state (e.g. ice/signal compare bars inside teal chrome over coral fills).
4. **C** — compare redesign; C2's bars now truthfully match the already-migrated map fills
   (signal-A / ice-B). C1 before C2/C6 (field list); the exception-marker definition ships with
   whichever of C4/D2 lands first (item C4).
5. **D** — panel redesign, with G1 (sheet fundamentals/grabber) inside D's plan; workstream G
   shrinks to G3/G4.
6. **B3** — vector political pass: the program's one real drift-risk item (upstream style ids),
   severable because it only affects the non-default view and nothing downstream depends on it.
   Safe to slide later or cut.
7. **E-remainder** — E1, E3, E5, E6, E7, E8. B7's light variant ships with A3 (workstream A).
8. **F** — game feel.
9. **G-remainder** — G3, G4 (G4 sequenced with E7, which also wants header space).

**Pre-agreed cut line** (if the program stops early, cut in this order): B3 → G4/E7 → E5 → F3 →
D3 → E-remainder. The floor that still honors the audit: A + B-core + E-foundations + C +
D1/D2/D4(+G1). Every tranche is independently shippable; no tranche starts before its
predecessor's review closes.

## Open questions (owner decisions — not in scope until answered)

1. **Round-start camera.** Settled 2026-07-10: "game-round camera carry-over is intended game
   difficulty — no change." The audit's live run hit the friction case: target Bangladesh with
   the camera parked over Europe — 2–4 seconds of pan/zoom chores per round that compound over a
   run. If the settled call stands, nothing changes. The alternative preserving the no-hint
   property: on advance, ease to a fixed world-view zoom (~1.8–2.2) keeping the current center
   (reduced motion: `jumpTo`), and update the round-start camera test to assert "no move toward
   the target" instead of "no move at all".
2. **Light-theme top strip.** Settled 2026-07-10: space-dark backdrop in both themes. On light
   mobile the dark band above the map reads as an unrendered strip (audit shot 12). E1 keeps the
   backdrop dark regardless; if the strip is judged acceptable as intended design, no action —
   otherwise the constraint itself needs revisiting (not proposed here).
3. **Timezone fold shape.** Batch 2 just shipped "first 3 + N more" (#130). The audit notes the
   collapsed state surfaces France's least representative offsets (three overseas territories;
   Paris hidden behind the toggle). Optional refinement: multi-zone countries collapse to a range
   summary "UTC−10:00 to UTC+12:00 (14 zones)" with the same expand toggle. Default if no call:
   keep the shipped toggle.
4. **Daily challenge.** Removed 2026-05-30 by owner call (the best-of-3 single-pair format did
   not fit city guessing's 10-round game, the daily UI read as ceremony, and the owner chose to
   drop it for both modes). The audit proposes a *different* mechanic: a date-seeded
   PRNG through the existing injected `Picker` seam gives every visitor the same full-length
   session per UTC day — no content pipeline, no best-of-N, no backend; pairs with F2's share
   string. Reintroduction is a product decision that must explain why the 2026-05-30 rationale
   doesn't apply to the new shape; if approved it gets its own spec.

## Testing & verification commitments

- Every new **DOM** animation exposes `data-animation-state` and respects
  `prefers-reduced-motion`; no `waitForTimeout`, no `force: true` (CLAUDE.md). Map paint and
  camera animations are invisible to `Element.getAnimations` — they use seam-based contracts
  instead (unit-tested waveform/duration plus e2e polling through the map test seam; see B5, G3),
  never hand-timed attributes.
- Map paint/visibility changes route through the existing single owners
  (`applyCountryBaselinePaint`, `applyBasemapLayerVisibility`, or a documented new owner) with
  fake-map unit tests capturing `setPaintProperty`/`setLayoutProperty`.
- B3's matcher is unit-tested against a committed style-snapshot fixture (no network in
  `npm run check`) and fails open at runtime; fixture refresh is a documented manual step.
- Asset budget: **no longer applicable to B1** — the glyph decision (existing endpoint, no
  self-hosted PBFs) means no `public/` font assets ship and no bundle-budget extension is
  needed. Should any future item add `public/` assets, the CI budget scans only `dist/assets/`
  and would need a new category first.
- Analytics: every workstream plan either declares its new `track()` events — name, props,
  assigned column slot (never a reserved daily slot), `KNOWN_EVENTS` in the Worker,
  `docs/systems/analytics.md` table update, and the manual wrangler deploy step — or states "no
  new telemetry" explicitly. At minimum F3 records the selected region as a new prop on
  `free_started`, or the educator use case it exists for is unmeasurable. Candidates: A8/A15
  (compare interactions), C5 (compare entry), E7 (About opened), F2 (result copied), F3
  (region).
- Brand assets: workstream E's exit criteria include regenerating `public/og-image.png` and
  `docs/assets/hero.png` from the Observatory look and updating the `theme-color` metas in
  `index.html` — otherwise every shared link unfurls with the retired teal/coral look. A15/F2
  accept that deep links unfurl as the generic homepage card (static host, no per-route OG) —
  decided, not forgotten.
- Roadmap bookkeeping: `docs/roadmap.md`'s own rules require striking out items picked up with
  a spec link. F3 promotes the twice-deferred region-filter entries (strike both when F3's plan
  opens); F2 partially supersedes the share-score entries (text share string ships; the OG-card
  image stays deferred — annotate, don't strike).
- New/changed chrome passes axe (`@axe-core/playwright` is already a dev dependency) and manual
  AA contrast checks on both themes.
- Per workstream: `npm run check` green, affected e2e specs green locally with `--workers=2`,
  plus a live pass of the touched flows on desktop and 390px mobile, both themes.
- CI-coverage honesty: 13 of 38 e2e specs are local-only (`docs/systems/testing.md` § "What Runs
  in CI"), including the axe specs, `theme-and-responsive`, `reveal-animation`, and all mobile
  projects — so axe and animated-path coverage for this program holds only at the local
  merge-time run, and CI will not guard it afterwards. Each workstream's plan lists the
  local-only specs it must run before merge. New animated-path specs must opt out of the
  project-wide `reducedMotion: 'reduce'` baseline via `page.emulateMedia` (the
  `reveal-animation.spec.ts` pattern).

## Risks

- **B3 upstream drift** — the positron layer matcher depends on third-party style layer ids; the
  pinning test turns silent drift into a loud failure, and the matcher must fail open (unstyled,
  not broken).
- **E2 mono stack variance** — `ui-monospace` resolves to different faces per OS (SF Mono,
  Cascadia, Consolas), so readout metrics differ across platforms; `.text-readout` surfaces are
  checked on Windows and macOS at minimum, and layouts must not depend on exact glyph widths
  (tabular alignment within one platform is the guarantee, not cross-platform pixel parity).
- **Observatory tone** — the instrument direction reads technical; the "fun" register is
  carried by copy and game feedback (F1/F2), which stay playful. If the live pass reads cold,
  the correction is copy and motion, not new hues.
- **B6 globe-projection regressions** — the existing wide-pair and globe-scale guards encode live
  findings; they are kept until the padding approach passes the same live cases.
- **A8 semantics** — replace-B redefines an existing interaction; the e2e compare spec must cover
  third-country click, A click, ocean click, and border-chip clicks in both columns.
- **Scope creep** — this program is seven plans, not one; each workstream ships and is reviewed
  independently, and B–G do not start before their predecessors' reviews close.
