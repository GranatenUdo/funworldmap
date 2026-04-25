# Security hardening + reveal camera + tutorial click fix — design

**Date:** 2026-04-25
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

One PR, four commits, each independently revertable. Two are defense-in-depth security fixes surfaced by the security review on 2026-04-24. Two are gameplay bugs reported the same day:

1. **GDELT URL protocol allowlist** — drop articles whose `url` is not http(s); null thumbnails whose `socialimage` is not http(s). Source-side filter at ingest time.
2. **Strip `__funworldmap_*` test seams from production builds** — gate them behind a Vite build mode (`--mode e2e`) so the shipped bundle has no game-state mutation seams while Playwright keeps its introspection hooks.
3. **Tutorial dismisses on first guess** — the first-session tutorial's `pointer-events-none` made user clicks fall through to the map and silently consume attempts; the wrong-guess pulse was hidden under the box's `z-[45]`. Fix: tutorial vanishes the moment `session.currentAttempts.length > 0`.
4. **Reveal camera follows the line head** — the current `fitBounds([guess, target])` over-zooms on transcontinental wrong guesses. Fix: camera snaps to the wrong-guess centroid at t=0, then `jumpTo`s along the tessellated arc inside the existing rAF loop, holding the user's pre-guess zoom.

Total surface: ≤150 LOC across roughly 10 files, two new test files, and one modified e2e spec.

## Goals & non-goals

**Goals**
- Eliminate the two defense-in-depth gaps without enlarging build complexity beyond a single new Vite mode.
- Restore correct cause-and-effect in the country-pinning tutorial flow on all four entry paths (daily/free × country-pinning/city-guessing).
- Replace the over-zoom reveal experience with a camera trajectory the user can actually follow.

**Non-goals**
- No leaderboard authentication or score validation.
- No telemetry / analytics pipeline changes.
- No MapLibre version bump.
- No broader news-pipeline rework (the GDELT URL filter is the only news change).
- No reduced-motion behavioral changes beyond the one extra `jumpTo` line in the reveal effect.

## Branch & PR

- **Branch:** `hardening-and-reveal-fixes`
- **PR title:** `Security hardening + reveal camera + tutorial click fix`
- **Commits, in load-bearing order:**
  1. `chore(news): drop GDELT articles with non-http(s) URLs`
  2. `chore(build): gate __funworldmap_* test seams behind VITE_TEST_HOOKS`
  3. `fix(game): tutorial dismisses on first guess so attempts aren't silently lost`
  4. `fix(reveal): camera follows the line head from wrong guess to target`

Commit 2 must include the `playwright.config.ts` `webServer` change in the same commit, otherwise that commit's CI run breaks the e2e build.
Commits 3 and 4 depend on commit 2 having shipped the `build:e2e` mode (their new assertions use the seams).

---

## Item 1 — GDELT URL protocol allowlist

### Where
`scripts/news/gdelt-client.ts:79-86` — the `.map(...)` block that turns `GdeltRawArticle` into `GdeltArticle`.

### What
Two guards, applied at ingest time so the static `public/news/*.json` files committed by the daily-refresh workflow can never carry a `javascript:`, `data:`, `file:`, or otherwise malformed URL through to the client.

1. **Article URL gate.** Try `new URL(a.url)`. On throw, drop the article. If the parsed protocol is not `http:` or `https:`, drop the article. Emit `console.warn` with the rejected URL.
2. **Thumbnail URL gate.** Same pattern, but on rejection just leave `thumbnail = null`. Article remains useful with title + domain + date.

### Code shape

```ts
.map((a): GdeltArticle | null => {
  let articleUrl: string
  try {
    const u = new URL(a.url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      console.warn(`[news] dropping article: non-http(s) URL ${a.url}`)
      return null
    }
    articleUrl = a.url
  } catch {
    console.warn(`[news] dropping article: malformed URL ${a.url}`)
    return null
  }

  let thumbnail: string | null = null
  if (a.socialimage && a.socialimage.length > 0) {
    try {
      const u = new URL(a.socialimage)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        thumbnail = a.socialimage
      } else {
        console.warn(`[news] nulling thumbnail: non-http(s) ${a.socialimage}`)
      }
    } catch {
      console.warn(`[news] nulling thumbnail: malformed ${a.socialimage}`)
    }
  }

  return {
    id: articleUrl,
    title: sanitise(a.title),
    url: articleUrl,
    publishedAt: seendateToIso(a.seendate),
    domain: a.domain,
    thumbnail,
  }
})
.filter((x): x is GdeltArticle => x !== null)
```

### Tests
New file `scripts/news/__tests__/gdelt-client.test.ts` (vitest, mirroring the style of `sanitise.test.ts`). Three cases:

1. Drops article whose `url` is `javascript:alert(1)`.
2. Keeps article but nulls thumbnail when `socialimage` is `data:image/png;base64,…`.
3. Pass-through for clean `https://example.com/article` + `https://cdn.example.com/img.jpg`.

Mock `fetch` via `vi.stubGlobal` returning a fixture `GdeltResponse` with the three rows. Add `afterEach(() => vi.unstubAllGlobals())` to restore the global between tests.

### Operational note
- The first daily-refresh run after merge may produce a slightly smaller article delta if GDELT has historically returned non-http(s) entries. Expected, not a regression — call out in PR description.
- The `news:build` script runs via `tsx`, not Vite. The URL filter is effective in that workflow independent of any Vite build mode.

---

## Item 2 — Strip `__funworldmap_*` test seams from production

### Mechanism
Vite `--mode e2e`. Vite inlines `import.meta.env.VITE_TEST_HOOKS` as a string literal at build time; with `--mode e2e` it becomes `"1"` (truthy), without it stays `undefined` (falsy). esbuild/rollup dead-code-eliminate the `if (!import.meta.env.VITE_TEST_HOOKS) return` guard's downstream branch in production.

### Files touched

**1. New `.env.e2e`**
```
VITE_TEST_HOOKS=1
```

**2. `package.json`** — add script:
```json
"build:e2e": "tsc -b && vite build --mode e2e"
```
Mirrors the production `"build": "tsc -b && vite build"` so type-check is preserved.

**3. `playwright.config.ts:96`** — change `webServer.command` to:
```ts
command: 'npm run build:e2e && npm run preview -- --port 5173 --strictPort',
```

Two gating strategies are used, chosen per effect structure: **wrap-line** when the effect does non-seam work and we shouldn't disturb it, **early-return** when the effect exists *only* to manage seams.

**4. `src/hooks/useMapInstance.ts`** — wrap-line gating. Both seam sites (`:97` set, `:159` delete) sit inside a longer `useEffect` that also creates the map and registers event handlers, so the gate wraps only the seam lines:
```ts
if (import.meta.env.VITE_TEST_HOOKS) {
  ;(window as unknown as Record<string, unknown>).__funworldmap_map = map
}
// ...later in cleanup:
if (import.meta.env.VITE_TEST_HOOKS) {
  delete (window as unknown as Record<string, unknown>).__funworldmap_map
}
```

**5. `src/game/GameController.tsx:537-593`** — early-return gating. This effect exists *only* to manage `__funworldmap_game.{submitGuess, submitCountryGuess, setRound}`. Add at the top of the effect body:
```ts
if (!import.meta.env.VITE_TEST_HOOKS) return
```
The cleanup function then never registers, which is correct: nothing was set, nothing to clean up.

**6. `src/game/shared/GameSessionProvider.tsx:69-80`** — early-return gating. Same as #5.

**7. `e2e/test-globals.d.ts`** — unchanged. Type-only file, only loaded by Playwright TS compilation.

### TypeScript types
No `vite-env.d.ts` change needed. The default `vite/client` types make `import.meta.env.VITE_*` resolve as `any`, which is what `analytics.ts:39` and `main.tsx:8` already rely on.

### Developer-environment caveat
Vite loads `.env.local` for *all* modes. A developer who puts `VITE_TEST_HOOKS=1` in their own `.env.local` would leak the seams into their local `npm run build` output. CI is unaffected (`.env.local` is gitignored). Document in the PR body so contributors don't accidentally do this.

### Verification
Manual step recorded in PR description:
```
npm run build              # production mode, no flag
grep -r "__funworldmap_" dist/   # expect: zero hits
```
Then:
```
npm run build:e2e
npm run test:e2e            # full Playwright matrix expected green
```

### Why not a CI gate
A `grep`-based CI gate is awkward (`grep ... && exit 1 || true` is fragile). Defer to a manual PR-checklist verification for now; can promote to CI in a follow-up if false negatives show up.

---

## Item 3 — Tutorial dismisses on first guess

### Where
`src/game/shared/hud/FirstSessionTutorial.tsx` and `src/game/GameController.tsx:629`.

### Root cause (recap)
- `FirstSessionTutorial.tsx:37` has `pointer-events-none`, so user clicks pass through to the map.
- The map's click handler interprets the click as a country-pinning guess.
- The wrong-guess border pulse fires on whichever country sits under the box (Russia, Greenland, Mongolia depending on viewport).
- The pulse is **visually hidden** by the box at `z-[45]`.
- User perceives "click → nothing happened"; mechanically a wrong attempt was consumed. Three accidental wrongs ⇒ game over.

### What
The tutorial dismisses the moment `session.currentAttempts.length > 0`. The first click both counts as a guess (existing pipeline, unchanged) AND closes the tutorial. The wrong-guess pulse becomes visible because the box is gone. The user's "Got it" button stays as a manual escape.

### Code shape

`FirstSessionTutorial.tsx`:
```ts
interface Props {
  modeId: ModeId
  firstAttemptMade?: boolean
}

export function FirstSessionTutorial({ modeId, firstAttemptMade }: Props) {
  const [open, setOpen] = useState(false)
  const key = KEY_PREFIX + modeId

  useEffect(() => {
    if (sessionStorage.getItem(key)) return
    setOpen(true)
    sessionStorage.setItem(key, '1')
  }, [key])

  useEffect(() => {
    if (firstAttemptMade) setOpen(false)
  }, [firstAttemptMade])

  if (!open) return null
  // ...rest unchanged
}
```

`GameController.tsx:629`:
```tsx
<FirstSessionTutorial
  modeId={session.modeId}
  firstAttemptMade={session.currentAttempts.length > 0}
/>
```

`firstAttemptMade` will stay `true` for the rest of the round, so the dismiss effect re-runs on subsequent guesses. Each re-run calls `setOpen(false)` while already false — a React no-op. No behavioral or perf concern.

### Why this signal works for both modes
- **Country-pinning** (3 attempts/round): wrong first guess → `currentAttempts.length` goes `0 → 1`, status stays `'playing'`. Tutorial dismisses; round continues with attempts left.
- **City-guessing** (1 attempt/round): first click → status transitions to `'round-ended'`, `currentAttempts.length === 1`. Tutorial dismisses; round resolves.
- **Correct first guess in country-pinning**: status flips to `'round-ended'` immediately. The existing `if (!open) return null` short-circuit handles either trigger.

### Tests
New `e2e/tutorial-first-click.spec.ts` under the `mobile-chromium` project (where the bug bites worst — small screen, big tutorial overlap). Also enable on `chromium-gpu` for desktop coverage.

```ts
test('tutorial dismisses on first guess and attempt counts', async ({ page }) => {
  await page.context().clearCookies()
  await page.evaluate(() => sessionStorage.clear())
  await page.goto('/#game/country-pinning/play')
  await waitForMap(page)
  await expect(page.getByTestId('game-tutorial')).toBeVisible()

  await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('USA'))

  await expect(page.getByTestId('game-tutorial')).toBeHidden()
  const attempts = await page.evaluate(
    () => window.__funworldmap_game?.getSession?.().currentAttempts.length,
  )
  expect(attempts).toBe(1)
})
```

The `data-testid="game-tutorial"` is already present at `FirstSessionTutorial.tsx:39`.

---

## Item 4 — Reveal camera follows the line head

### Where
`src/game/GameController.tsx:406-447` — the reveal-geometry `useEffect`'s `fitBounds` block and the rAF loop.

### What
Replace the bbox-fit camera with a per-frame camera that tracks the head of the dashed line. Camera holds the user's pre-guess zoom; only `center` changes. Globe projection rotates naturally for transcontinental arcs.

### Code shape

Replace the `fitBounds` block (lines 406-411) with:
```ts
// Snap camera to the wrong-guess centroid; rAF loop will track the line head.
map.jumpTo({ center: plan.from })
```

Inside the rAF `step` (after the `lineSrc.setData(...)` for the growing slice, still gated by `if (idx !== lastIdx)`), add:
```ts
map.jumpTo({ center: arc[idx] })
```

In the `plan.durationMs === 0` reduced-motion branch (after the full-arc `setData`), add:
```ts
map.jumpTo({ center: plan.to })
```

After the change, the `fitPadding()` helper at `GameController.tsx:44-48` becomes dead code (it was only used by the deleted `fitBounds` call). Delete it.

### Why `jumpTo`, not `easeTo`
`easeTo` queues an internal MapLibre animation that fights the rAF loop's per-frame `setData`. `jumpTo` is synchronous, no queueing — the rAF loop is the single source of truth for animation timing.

### Why the t=0 hard snap is acceptable
The user clicked a country, so their viewport already contained that country. `plan.from` (the country centroid) is therefore close to the camera's current position. A snap on the rare zoomed-elsewhere path is a known design choice, documented as such; a smoother pre-roll `easeTo` would require sequencing with the rAF loop and is YAGNI for v1.

### Edge case — user pans/zooms mid-reveal
`jumpTo` will yank the camera back. Acceptable per the user's intent (camera-driven reveal). If complaints surface, add an "user interacted, abort camera follow" guard.

### Cleanup
The existing `cancelAnimationFrame(frameId)` in the cleanup is sufficient — stops both line and camera advancement if the round changes mid-reveal.

### Tests
- **Modify** `e2e/reveal-animation.spec.ts` first test: keep the 65-vertex arc assertion; add an end-of-animation assertion that `await page.evaluate(() => window.__funworldmap_map?.getCenter())` is within ~2° of FRA's centroid `[2, 46]`.
- **Unchanged** `e2e/reveal-animation-reduced-motion.spec.ts` — the camera one-liner doesn't affect the arc-shape assertions the spec makes. (Sanity-check on the first run; if the camera move surfaces as a flake, gate the assertion.)

---

## Testing matrix

| Layer | Commit 1 | Commit 2 | Commit 3 | Commit 4 |
|------|----------|----------|----------|----------|
| `npm run test:unit` | new gdelt-client tests | passes unchanged | passes unchanged | passes unchanged |
| `npm run test:e2e` (full Playwright matrix) | unchanged | full matrix passes under e2e build | new tutorial spec passes; existing specs unchanged | reveal specs updated; matrix passes |
| Manual smoke | n/a | `grep dist/` → no hits | dev-server smoke; real-device QA on Pixel 7 / iPhone 14 is optional | DEU→FRA short arc, MNG→ARG transcontinental, city-guessing wrong click |

CI mobile coverage is via Playwright emulation (`mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`) — no real-device runners.

## Risk register

- **Seam strip breaks an unknown e2e** → caught by full Playwright matrix in CI before merge.
- **Camera follow feels jarring on long arcs** → manual smoke before commit; if so, fall back to two-phase (line-only animation + post-line `flyTo`) without redesign.
- **Tutorial dismiss races correct-first-guess** → existing `if (!open) return null` short-circuit always wins; the new effect only adds dismiss triggers.
- **GDELT filter drops too aggressively** → `console.warn` logs make the daily-refresh CI a feedback loop.
- **Tree-shake fails to remove seams in prod** → manual `grep dist/` step is the gate.

## Out of scope (deferred to follow-ups)

- A real CI gate replacing the manual `grep dist/` verification.
- A "user interacted, abort camera follow" guard on the reveal animation.
- A pre-roll `easeTo` for the t=0 camera snap.
- Server-side score validation for daily puzzles (only relevant if leaderboards become trust-bearing).
