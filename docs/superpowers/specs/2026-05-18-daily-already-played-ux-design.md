> **Tombstone (2026-06-12):** the daily-puzzle/retention feature this spec designed was removed in PR #97 (2026-05-30, "Remove the daily puzzle"). Kept unmodified for history — do not implement from it.

# Daily-already-played UX — design

**Date:** 2026-05-18
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

After today's daily for a mode is complete, the launcher mode card's only call to action is an emerald button labeled `✓ {score} · See reveal →`. Tapping it routes to the daily reveal overlay. Reported in-session 2026-05-17: _"after I start a city guessing game the game instantly ends with [Daily reveal screen] ... that is very ambiguous and not understandable for any user. we should always play unlimited rounds."_

The complaint is that the played-state card looks like the entry point for "play this mode" but it's actually a reveal entry, so the user feels the game instantly ended. There's no per-card affordance to keep playing — only the standalone "Play unlimited rounds →" link at the launcher bottom.

This spec replaces the played-card's single button with a stacked primary + secondary layout, and adds a matching "Play unlimited rounds" CTA to the daily reveal overlay so anyone who does land there has a clear next-action.

Total surface: one new prop on `LauncherModeCard` (`onPlayUnlimited`), one new prop on `DailyRevealOverlay` (`onPlayUnlimited`), wiring in `Launcher.tsx` and `App.tsx`, plus tests. No new state, no new routes, no new analytics events. The played-card Play button reuses the existing `launcher_dismissed { path: 'card' }` event (via the existing `startFree` helper); the reveal-overlay CTA fires no new event — the hash-router's existing `free_started` event already captures the start signal.

## Goals & non-goals

**Goals**

- A user who's done with today's daily mode can start unlimited play in **one tap from the played card** — no need to scan past the cards and find the bottom link.
- A user who lands on the daily reveal overlay (via the card's secondary row, via deep link, via browser back) has a clear "play more" exit without closing the overlay and re-engaging the launcher.
- The played-card's "this is done" signal (emerald border + ✓) is preserved and the score is still visible at a glance.
- The change is scoped tight: only the played state and the reveal overlay. No reshuffling of the unplayed-card daily Play button or the past-unplayed See-reveal button.

**Non-goals**

- No change to the unplayed-state daily Play button (still primary action: start the daily).
- No change to the past-unplayed card (still single "See reveal" button — daily can't be replayed retrospectively).
- No change to the bottom "Play unlimited rounds →" link at the launcher footer — still serves the "skip daily entirely" use case.
- No change to URL hash shape — still `#game/<modeId>` for unlimited entries.
- No new analytics events and no extension of the existing `launcher_dismissed.path` union — the reveal-overlay CTA is intentionally not tracked at the click site (the hash router's `free_started` event covers it on game boot).
- No daily-mode replay (daily stays one-shot per day per mode).

## Branch & PR

- **Branch:** `feat/daily-already-played-ux` (already created off `main` after PR #89 merged).
- **Commits, in load-bearing order:**
  1. `feat(launcher): per-card "Play unlimited" on played daily cards`
  2. `feat(reveal): add "Play unlimited" CTA to daily reveal overlay`

Two commits, independently revertable. Commit 1 lands the launcher-card change in isolation; commit 2 adds the reveal-overlay CTA on top.

---

## Item 1 — Played-card primary + secondary affordances

### Where

- `src/components/LauncherModeCard.tsx` — the `state === 'played'` branch (lines 148-161 today).
- `src/components/Launcher.tsx` — the `LauncherModeCard` instantiation inside the modes-loop (lines 361-371) — pass the new `onPlayUnlimited` prop.

### What today

```tsx
{
  state === 'played' && (
    <div data-testid={`${testIdBase}-played-result`}>
      {onSeeReveal && (
        <button
          type="button"
          onClick={onSeeReveal}
          data-testid={`${testIdBase}-see-reveal`}
          className="w-full px-4 py-2 rounded-xl bg-emerald-500/90 text-white font-semibold hover:bg-emerald-500 ..."
        >
          ✓ {formatModeScore(played?.score ?? 0, modeId)} · See reveal →
        </button>
      )}
    </div>
  )
}
```

One emerald button doing both "I'm done" and "tap to see reveal". Mixes the affordance for two distinct actions.

### What changes

```tsx
{
  state === 'played' && (
    <div data-testid={`${testIdBase}-played-result`}>
      <button
        type="button"
        onClick={onPlayUnlimited}
        data-testid={`${testIdBase}-play-unlimited`}
        className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
      >
        Play {TITLE[modeId]}
      </button>
      {onSeeReveal && (
        <button
          type="button"
          onClick={onSeeReveal}
          data-testid={`${testIdBase}-see-reveal`}
          className="w-full mt-2 text-sm text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded text-center"
        >
          ✓ {formatModeScore(played?.score ?? 0, modeId)} · See reveal →
        </button>
      )}
    </div>
  )
}
```

- **Primary button** uses the same teal styling as the unplayed-state Play button. Label is `Play {TITLE[modeId]}` → `"Play City"` or `"Play Country"`, reusing the existing `TITLE` lookup at the top of the file.
- **Secondary row** is a button (keeps it keyboard-accessible) but visually a small inline link — no background fill, emerald text matches the played indicator color. **Visibility fallback:** if browser smoke shows the row reads as decorative caption rather than a tap target, add a subtle tinted background (`bg-emerald-50/50 dark:bg-emerald-900/20`) and re-verify. Don't pre-emptively add the background — text-only is cleaner if it works, and the ✓ prefix + "→" arrow + center-aligned full-width footprint should signal tappability.

### New `LauncherModeCard` prop

```ts
interface Props {
  // ...existing props unchanged...
  onPlayUnlimited?: () => void // required when state === 'played'
}
```

Declared optional because the unplayed / past-unplayed / loading / error / no-puzzle states don't use it. Render-time invariant: when `state === 'played'`, the played branch needs `onPlayUnlimited`. The component's behavior if missing: the played-state primary button is not rendered. This is permissive enough to keep TypeScript happy and is symmetric with how `onSeeReveal` is treated today.

### Wiring in `Launcher.tsx`

The card already gets `onStartDaily` and `onSeeReveal`. Add `onPlayUnlimited`:

```tsx
<LauncherModeCard
  // ...existing props...
  onStartDaily={() => startDaily(m.id)}
  onSeeReveal={() => seeReveal(m.id)}
  onPlayUnlimited={() => startFree(m.id)}
/>
```

`startFree` is already defined (lines 191-199 of `Launcher.tsx`) and does exactly what the new button needs: writes `lastMode`, dismisses launcher, sets hash to `#game/<modeId>`. No new helper needed.

### Played-card visual signals

- Emerald border on the card (`border-emerald-400/60 dark:border-emerald-500/40` at line 102) — **kept**. Useful at-a-glance signal that "this mode is done for today."
- ✓ prefix on the secondary row — kept. Visual reinforcement.
- Score still visible. Format unchanged: `formatModeScore` produces `87/100` for country, `760/1000` for city.

### Click → behavior

- Primary "Play City" / "Play Country" → `startFree(modeId)` → hash becomes `#game/<modeId>`, `useHashGameRouter` boots an unlimited game in that mode.
- Secondary "✓ {score} · See reveal →" → `seeReveal(modeId)` → hash becomes `daily/<date>/<modeId>/reveal`, `DailyRevealOverlay` mounts. **Identical to today's See-reveal behavior.**

---

## Item 2 — "Play unlimited rounds" CTA in the daily reveal overlay

### Where

- `src/components/DailyRevealOverlay.tsx` — add a primary CTA in the overlay's action area.
- `src/App.tsx` — the `DailyRevealOverlay` render site (around lines 533-546) — pass the new `onPlayUnlimited` callback.

### What today

`DailyRevealOverlay` accepts `onClose` and renders close-only action UI. No play-affordance — the user closes back to the launcher and either taps the bottom unlimited link or, post-Item-1, the played card's new primary button.

### What changes

Add `onPlayUnlimited: () => void` to the overlay props. **Add** a new bottom action area containing only the Play unlimited rounds button. The existing header X close (at lines 91-99 of `DailyRevealOverlay.tsx`) is **unchanged** — it stays as the sole close affordance, and adding a duplicate bottom close link would violate "one obvious way to close."

```tsx
// New bottom action area, added after the existing content (after the share block).
// Does not modify the header X close button.
<div className="mt-6">
  <button
    type="button"
    onClick={onPlayUnlimited}
    data-testid="daily-reveal-play-unlimited"
    className="w-full px-4 py-2.5 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
  >
    Play unlimited rounds
  </button>
</div>
```

The existing initial-focus target moves from the header X close to the new Play button (line 38 today: `const close = root.querySelector<HTMLButtonElement>('[data-testid="daily-reveal-close"]')` → query `daily-reveal-play-unlimited` instead, with the header X as fallback).

### Mode selection for the CTA

`DailyRevealOverlay` receives `modeId: ModeId | null` (line 12). The CTA needs to know which mode to start.

- If `modeId !== null` (the overlay was opened for a specific mode, e.g. via the launcher's See-reveal row): start that mode.
- If `modeId === null` (the overlay was opened in full-day mode showing both results — happens on bare `#daily/<date>` deep links): use `readLastMode()` to start the user's preferred mode. Same affordance the launcher's bottom unlimited link uses today.

The mode-selection logic lives in `App.tsx`'s `onPlayUnlimited` wiring, not in the overlay — keeps the overlay declarative.

### Wiring in `App.tsx`

The overlay is rendered at `src/App.tsx:533-546`. Add the new prop:

```tsx
{
  revealState && (
    <DailyRevealOverlay
      date={revealState.date}
      modeId={revealState.modeId}
      puzzle={byDate(revealState.date) ?? null}
      today={toLocalDateString(new Date())}
      countries={pool}
      cities={cities}
      onClose={() => {
        history.replaceState(null, '', window.location.pathname)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }}
      onPlayUnlimited={() => {
        const id = revealState.modeId ?? readLastMode()
        // No track() here — the hash router's free_started event fires when
        // the game boots, which is the durable signal. Adding launcher_dismissed
        // here would be a category error (the reveal overlay is not the launcher).
        window.location.hash = writeHash({ kind: 'game', modeId: id })
      }}
    />
  )
}
```

**Required imports** in `App.tsx` (verified by `grep` on the current tree — neither is imported yet):

- `readLastMode` from `./game/shared/lastMode` — add a new import line near the other game-shared imports (around the `ModeId` import).
- `writeHash` from `./lib/hashState` — the file currently imports only `parseHash` from this module on line 25; extend that import.

### Focus / keyboard contract

- Initial focus → new bottom Play unlimited button (was: header X close).
- Escape → `onClose` (unchanged from today).
- Tab cycles through the header X close, the share-block links, the new Play unlimited button (DOM order).
- The existing focus trap (`installFocusTrap(root)` at line 40 of `DailyRevealOverlay.tsx`) continues to wrap the entire overlay, including the new button. The trap only handles `Tab` keys; it does not proactively move focus on install, so setting initial focus to the Play button before `installFocusTrap(root)` returns is safe (verified by reading `src/lib/focusTrap.ts`).

---

## Data flow summary

```
LauncherModeCard (played state)
  ├─ Primary "Play Country" / "Play City"
  │   └─ onPlayUnlimited()  ─→  Launcher.startFree(modeId)
  │                              ─→  hash = '#game/<modeId>'
  │                              ─→  useHashGameRouter starts unlimited game
  │
  └─ Secondary "✓ {score} · See reveal →"
      └─ onSeeReveal()  ─→  Launcher.seeReveal(modeId)  (unchanged)
                            ─→  hash = 'daily/<date>/<modeId>/reveal'
                            ─→  DailyRevealOverlay mounts

DailyRevealOverlay
  ├─ Primary "Play unlimited rounds"
  │   └─ onPlayUnlimited()  ─→  App.tsx callback
  │                              ─→  modeId ?? readLastMode()
  │                              ─→  hash = '#game/<modeId>'
  │
  └─ Close (secondary)
      └─ onClose()  (unchanged)
```

No new state, no new providers, no new effects.

## Analytics

| CTA                        | Event fired                                                        | Why                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Played-card Play button    | `launcher_dismissed { path: 'card' }` then `free_started { mode }` | The Play button calls the existing `startFree(modeId)` helper, which already fires `launcher_dismissed { path: 'card' }`. The hash router then fires `free_started` on boot. Both events already exist; no schema change.                                                                                                                                                                                                       |
| Played-card See reveal row | `launcher_dismissed { path: 'card' }`                              | Unchanged from today — calls the existing `seeReveal(modeId)` helper.                                                                                                                                                                                                                                                                                                                                                           |
| Reveal-overlay Play button | `free_started { mode }` only                                       | No `launcher_dismissed` fired — the reveal overlay is not the launcher, so firing that event here would be a category error. The hash-router's `free_started` event on game boot is the durable signal; downstream queries can attribute the source by checking the absence of `launcher_dismissed` immediately prior, or by adding a `source` discriminator to `free_started` in a future PR if attribution becomes important. |

Notes:

- The existing `launcher_dismissed.path` union (`'search' | 'escape' | 'card' | 'backdrop' | 'close'`) in `src/lib/analytics.ts:20` is intentionally **not** extended in this PR. The `'card'` value continues to overload "any card-initiated dismissal" (daily Play, See-reveal, and now played-card Play-unlimited) — already true today, no regression.
- A future analytics pass could add a `source` field to `free_started` to attribute the start path (launcher card vs launcher footer vs reveal overlay). Out of scope here.

## Testing

### Unit (vitest + `@testing-library/react`)

- **`src/components/__tests__/LauncherModeCard.test.tsx`** — extend the existing file:
  - Played state: renders the mode-specific Play button (`"Play City"` / `"Play Country"`).
  - Played state: renders the secondary `"✓ {score} · See reveal →"` row.
  - Played state: clicking Play button calls `onPlayUnlimited` (the new prop).
  - Played state: clicking the See reveal row calls `onSeeReveal` (existing prop).
  - Verify the `unplayed`, `past-unplayed`, `loading`, `unavailable-error`, `no-puzzle-today` branches are byte-for-byte unchanged. Snapshot tests if present, otherwise behavior tests for each branch's primary button.
- **`src/components/__tests__/DailyRevealOverlay.test.tsx`** (existing or new):
  - Renders the Play unlimited button.
  - Initial focus lands on the Play unlimited button (not the close button).
  - Clicking Play unlimited calls `onPlayUnlimited`.
  - Clicking Close calls `onClose`.
  - Escape calls `onClose` (existing behavior preserved).
  - Both `modeId !== null` and `modeId === null` cases render the same CTA (the mode resolution lives outside the overlay).

### E2E (Playwright)

- **Extend `e2e/launcher-history.spec.ts` or `e2e/daily-puzzle.spec.ts`** (whichever exists and exercises the played-card path):
  - Seed today's daily-history with a completed city game at a known score.
  - Open the launcher.
  - Assert the played card shows the new Play button + See reveal row.
  - Click "Play City" → poll for `session.status === 'playing'` and `session.modeId === 'city-guessing'`, verify HUD visible.
- **Extend (or add) a reveal-overlay e2e**:
  - Navigate to `#daily/<today>` deep link.
  - Assert "Play unlimited rounds" CTA is visible and has focus.
  - Click → poll for `session.status === 'playing'`, verify HUD visible.

### Browser smoke (in the implementation plan, not the spec)

1. Play today's daily city game to completion.
2. Open launcher → confirm played card layout matches the mockup (teal Play City button + small "✓ 760/1000 · See reveal →" row).
3. Click "Play City" → unlimited game starts.
4. Re-open launcher → click the See reveal row → reveal overlay opens.
5. Confirm "Play unlimited rounds" CTA has focus.
6. Click it → unlimited city game starts.
7. Reopen the reveal via deep link (`#daily/<today>`) → click "Play unlimited rounds" → unlimited game starts using `lastMode`.
8. Hit Escape on the reveal overlay → it closes, no game starts.

## Risks

- **Mobile vertical growth.** Today's played card has one button (~40 px tall). The new layout has a teal Play button (~40 px) + 8 px gap + small See-reveal text row (~32 px) ≈ **80 px** — roughly double. On mobile (`grid-cols-1 sm:grid-cols-2` at `Launcher.tsx:355`, so 1-column on phone), two stacked played cards add ~80 px total versus today. Combined with the streak pill, the history-panel link, and the launcher footer link, this **could push the launcher into a vertical-scroll state on shorter viewports** (e.g. 667 px-tall mobile). **Mitigation:** browser smoke check on a 667-px-tall viewport with both modes played is a required step in the implementation plan. If it overflows, options in priority order: (a) shrink the secondary-row vertical padding/font, (b) drop the secondary-row mt-2 gap to mt-1, (c) compress the launcher header — only as last resort.
- **Reveal-overlay focus shift.** Moving initial focus from the close button to the new Play-unlimited button is the right call for the new affordance. Any test or accessibility hook that reads "first focusable in the dialog" needs to expect the new behavior. The existing focus-trap utility is content-agnostic, so the change is local to the overlay's mount effect at line 38 of `DailyRevealOverlay.tsx`.
- **Secondary-row tap-target ambiguity.** The text-only treatment (no background fill, just emerald color + ✓ prefix + "→" arrow + full-width center-aligned button) might read as decorative caption rather than tap target on dense mobile screens. The implementation plan's browser smoke check explicitly verifies the row is recognizable as tappable. If not, the documented fallback is to add a subtle tinted background (`bg-emerald-50/50 dark:bg-emerald-900/20`) without touching the rest of the layout.

## Open questions (not in scope)

- **Past-unplayed card.** Today: single "See reveal" button. Could symmetrically get a "Play unlimited" affordance per the new pattern. Deferred — not part of the reported pain, and past-unplayed is a less-trafficked state.
- **Launcher footer link.** With per-card "Play unlimited" buttons appearing in the played state, the bottom "Play unlimited rounds →" link becomes somewhat redundant when both modes are played. Decision: keep unchanged — it still serves the "skip daily entirely" path for users in mixed or all-unplayed states.

## Rollback

`git revert <commit>` on either of the two commits independently. No data, storage, route, or config impact.
