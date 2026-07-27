# B1 glyph spike — Noto Sans Bold via the positron glyphs endpoint

**Date:** 2026-07-28
**Branch:** spike/b1-glyphs (discarded; no production code)
**Time spent:** ~25 minutes

One-hour throwaway spike ahead of workstream B1
(`docs/superpowers/specs/2026-07-26-ux-visual-program-design.md`): a temporary
`country-labels-spike` symbol layer with `text-font: ['Noto Sans Bold']` and a
hardcoded 3-point GeoJSON (France [2,46], Brazil [-55,-10], Japan [138,36]),
plus a prototype of B1's explicit visibility rule
(`visible iff satellite && !hideLabels`) in `applyBasemapLayerVisibility`.

## Findings

- **Endpoint worked:** yes — glyph request
  `https://tiles.openfreemap.org/fonts/Noto%20Sans%20Bold/0-255.pbf` returned
  200; one PBF (the 0-255 Latin-1 range) covered all three names (France,
  Brazil, Japan are all ASCII). Note: the base positron style itself pulls in
  many more Noto Sans Bold/Italic ranges (768-1023, 1024-1279, 2304-2559,
  8192-8447, 11520-11775, etc.) for its own world labels in other scripts —
  none of those 404'd either, but they're irrelevant to the spike layer,
  which only ever needed 0-255.
- **Collision behavior at z1.8:** all three labels rendered — confirmed both
  visually (screenshots) and programmatically via
  `map.queryRenderedFeatures({ layers: ['country-labels-spike'] })`, which
  returned `["France", "Brazil"]` (count 2) at the default z1.8 view, i.e.
  both survived the collision pass while sharing the frame. Japan is on the
  opposite hemisphere of the globe at the default bearing, so it was only
  ever checked in isolation (after rotating) — it also rendered cleanly
  there. Caveat: at z1.8 the three hardcoded points are far enough apart
  (Europe/S. America/E. Asia) that a genuine 3-way simultaneous-viewport
  collision case was never exercised; only the France+Brazil pair was. No
  drops were observed in either grouping, so nothing here forces
  `symbol-sort-key` for B1, but B1's real country set (~190 labels) will have
  much denser simultaneous on-screen candidates than this 2-3 point spike,
  so collision at scale is still untested.
- **Halo legibility:** readable — 14px white text, 1.5px `#0f172a` halo,
  checked at ~z5 zoomed into the France centroid (central France
  farmland/countryside, medium-brightness green/tan terrain, with the
  snow-capped Alps visible elsewhere in the same frame). The label itself
  never sat directly over the brightest snow pixels (it's pinned to the
  hardcoded France centroid, not draggable), but over the mixed green/tan/
  light-soil terrain it sat on, contrast was clearly good in both the wide
  z1.8 satellite view and the z5 zoomed view. No legibility concerns at
  either zoom tested.
- **Game gating:** labels hid when a country-pinning session entered
  `playing` (verified via the `__funworldmap_game` test seam under
  `VITE_TEST_HOOKS=1`: `getLayoutProperty('country-labels-spike',
  'visibility')` read `'none'` immediately after the session transitioned to
  `playing`, matching the screenshot with borders visible but no
  France/Brazil text); returned on exit (`window.__funworldmap_game.endGame()`
  flipped it back to `'visible'`, confirmed both by the property read and a
  follow-up screenshot); hid in vector mode (toggling the header
  satellite/map-view button while idle set visibility to `'none'`, toggling
  back to satellite set it back to `'visible'`) — all three observations
  match the `satellite && !hideLabels` rule exactly as specced. One UI-level
  wrinkle unrelated to the spike's own logic: driving the exit via the
  Escape key + "Back to map" dialog button (rather than the
  `__funworldmap_game.endGame()` test seam) was flaky to reproduce cleanly in
  a second manual pass — a second `header Play → launcher Play` click
  sometimes left `session.status` at `idle` rather than transitioning to
  `playing`, which looks like app-level session/route state timing unrelated
  to `applyBasemapLayerVisibility` (the rule itself responded correctly every
  time `hideLabels` actually changed value). Not investigated further — out
  of scope for this spike, but worth a note for whoever writes game-flow e2e
  tests: prefer the `__funworldmap_game` test seams over UI-driving for
  starting a second game in the same page session, per CLAUDE.md.

## Consequences for B1

- No changes to the glyph/font decision: `text-font: ['Noto Sans Bold']`
  against the positron style's existing glyphs endpoint is confirmed
  end-to-end (network 200, visual render, correct halo contrast). Proceed as
  specced — no self-hosted PBFs needed.
- The explicit `visible iff satellite && !hideLabels` rule prototype in
  `applyBasemapLayerVisibility`, inserted before the `customPrefixes` skip,
  works exactly as designed for a `country-`-prefixed owned layer. B1 can
  copy this shape directly.
- Collision behavior is unproven at B1's real scale (~190 country labels
  vs. this spike's 3). The spike's z1.8 collision pass only exercised 2
  simultaneously-visible labels; B1 should not assume the absence of drops
  here generalizes, and should plan to visually audit dense regions (Europe,
  Caribbean, Pacific micro-states) once the real label set lands, with
  `symbol-sort-key` (e.g. by population or area) as the likely lever if
  collisions drop the wrong countries.
- Halo width/text-size floor (1.5px / 14px) held up fine at both z1.8 and
  z5 in this spike; no evidence to change either default, but the spike
  didn't test a label sitting directly over bright/white terrain (snow,
  desert glare, cloud) since the fixed centroids didn't land there — B1
  should keep an eye on halo legibility over Sahara-desert-bright and
  polar/snow imagery specifically, since satellite basemaps vary brightness
  far more than a flat vector basemap would.
