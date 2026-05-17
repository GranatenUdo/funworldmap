# Preserve user zoom on country selection — design

**Date:** 2026-05-17
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

`flyToCountry` always flies to `zoomFromArea(country.area)`, which for any country ≥ ~100,000 km² clamps to zoom ≈ 2 — just above `DEFAULT_ZOOM = 1.8`. Selecting such a country from a closer view (e.g. zoomed in to Europe at zoom 4 and clicking France) causes the camera to recede to the world view. Reported in-session 2026-05-17 after the post-hover-perf-fix verification: _"there should not be a zoom out to a default zoom level when I click on a country."_

Fix: clamp the target zoom against the current camera zoom so the fly is monotonic — small countries still zoom in to their computed level, large/medium countries just re-center without receding.

Total surface: one line of logic in `src/lib/flyToCountry.ts` plus a new unit-test file.

## Goals & non-goals

**Goals**

- Selecting a country never _decreases_ the camera zoom. Re-centering on the country's centroid is preserved.
- Behavior is consistent across all selection entry points (map click, search-bar select, URL hash, compare-pick), so the rule is "selection follows the country, never away from it" everywhere.
- Behavior is preserved for tiny countries — Vatican, Liechtenstein, Andorra still auto-zoom in.

**Non-goals**

- No change to game-mode camera transitions. `useRevealMapEffects.ts:338` (`flyTo DEFAULT_CENTER/ZOOM` at round-start) and the reveal-arc `jumpTo` loop stay as-is — those intentionally reset / track based on game state, not selection.
- No change to the Home key / `ResetViewControl` (`lib/resetViewControl.ts:flyToHome`) — that's an explicit "reset view" action, not selection.
- No change to `zoomFromArea(area)` formula. The clamping happens at the call site.
- No new flag or user preference. The rule is unconditional.

## Branch & PR

- **Branch:** branch from current `feat/ux-phase2-pr1a` (the two perf-fix commits `f7df829` and `178cf85` stay in this branch)
- **Commit:** single commit, no PR split needed
  - `fix(map): never zoom out on country selection`

## Item 1 — clamp target zoom against current zoom

### Where

`src/lib/flyToCountry.ts:12-24` — the only function in the file.

### What

Read `map.getZoom()` and take the max of it and the area-derived computed zoom. Keep everything else (center, pitch, duration, curve) identical.

### Code shape

```ts
export function flyToCountry(map: maplibregl.Map, country: CountryData): void {
  const [lat, lng] = country.latlng
  const computed = zoomFromArea(country.area)
  const zoom = Math.max(map.getZoom(), computed)
  const reducedMotion = prefersReducedMotion()

  map.flyTo({
    center: [lng, lat],
    zoom,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
```

### Why `Math.max` and not "skip flyTo if computed ≤ current"

A no-op when computed ≤ current would skip the re-center too, which is the wrong tradeoff — clicking a country in the corner of the viewport should still bring it to centre, just without backing the camera out. `flyTo` with the same zoom as the current camera still re-centers and respects the existing `curve` / `duration` motion design.

### Edge cases handled by the existing code

- `area <= 0` → `zoomFromArea` returns 6. `max(current, 6)` is safe: if current is higher, no zoom; otherwise we zoom in to a sensible default. Same as today for area-zero rows.
- `currentZoom` is bounded by `[MIN_ZOOM, MAX_ZOOM]` = `[1.5, 12]` via the MapLibre constructor (`useMapInstance.ts`), so no out-of-range concerns.
- Reduced-motion path is unaffected — `duration: 0` still applies, just with the clamped target.

## Testing

### New: `src/lib/__tests__/flyToCountry.test.ts`

Four cases, each renders a fake map with controllable `getZoom()`:

1. **Tiny country, current zoom below computed** — Vatican (`area: 0.49`), `getZoom: () => 1.8` → `flyTo` called with `zoom ≈ 11.5` (computed from area, current is lower so the max is the computed value). Existing zoom-in behavior preserved. Use a tolerance assertion (e.g. `zoom > 10`) rather than pinning the exact float so the test isn't brittle to `zoomFromArea` constant tweaks.
2. **Large country, current > computed** — Russia (`area: 17_098_242`), `getZoom: () => 4` → `flyTo` called with `zoom: 4`. The fix: current zoom retained.
3. **Large country, current < computed** — Russia, `getZoom: () => 1.5` → `flyTo` called with `zoom: 2` (the clamped lower bound from `zoomFromArea`). Default-view → re-centered-on-Russia path still zooms in slightly.
4. **Reduced-motion** — `prefersReducedMotion()` mock returns `true`, `getZoom: () => 4`, France → `flyTo` called with `duration: 0` and `zoom: 4`. Confirms the clamp composes with the reduced-motion duration path.

### Existing tests stay green

- `src/hooks/__tests__/useSelectionHighlight.test.tsx` — mocks `flyToCountry`, so insulated.
- `e2e/map-and-countries.spec.ts:204` — `#FRA` deep link with `DEFAULT_ZOOM = 1.8` → max(1.8, 2) = 2 → unchanged behavior visible to test (it asserts panel + selection filter, not exact zoom).
- `e2e/map-and-countries.spec.ts:85` — click opens panel — asserts panel/hash, not zoom.

No e2e changes required.

## Risks

- **Search-from-zoomed-in UX shift.** A user zoomed in to Paris at zoom 6 searching for "Brazil" today zooms out to 2 and sees Brazil whole. After the change they fly to Brazil at zoom 6 — São Paulo area, not the whole country. Mitigation: this matches the click rule; if it proves wrong we can scope the clamp to click-only by threading an `origin: 'click' | 'search' | 'hash'` arg, but that's extra surface to add only on real feedback.
- **Deep-link-from-cold-load.** First-visit cold load with `#FRA` hash: today flies to zoom 2 (the clamp). After the change, max(1.8, 2) = 2 — unchanged. No risk.
- **Game-start `flyTo DEFAULT_CENTER/ZOOM` in `App.tsx:237`.** That call sets `zoom: DEFAULT_ZOOM` (1.8) directly — not via `flyToCountry`. Untouched by this change. Confirmed visually: the only callers of `flyToCountry` are `useSelectionHighlight`.

## Rollback

`git revert <commit>` restores the prior behavior. No data, storage, or config impact.
