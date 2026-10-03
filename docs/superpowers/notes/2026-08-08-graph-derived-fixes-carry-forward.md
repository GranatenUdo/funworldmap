# Graph-derived fixes — carry-forward items (2026-08-08)

Two items from the `a5893d2..c5d1c9b` batch that outlive it. The batch's own
execution ledger was git-ignored scratch, so anything worth keeping is recorded
here instead.

Spec: [`2026-08-08-graph-derived-fixes-design.md`](../specs/2026-08-08-graph-derived-fixes-design.md) ·
Plan: [`2026-08-08-graph-derived-fixes.md`](../plans/2026-08-08-graph-derived-fixes.md)

## 1. `search.spec.ts:47` fails on `calibrated-fittings-and-product-record` — owner decision needed

**This is a merge blocker for the branch, not for the batch that recorded it.**

`e2e/search.spec.ts:47` ("fuzzy matching works for typos") fills `Untied` and
expects a result containing `United`. It gets "No countries found". Full chromium
run at `c5d1c9b`: 186 passed, 1 failed.

Not caused by the graph-derived-fixes batch, and this is proven rather than
assumed:

- `src/hooks/useCountrySearch.ts` is untouched by `a5893d2..c5d1c9b` — the diff
  over that path is empty.
- Its last change is `630a18c` ("A11y, run safety, polish: contrast sweep,
  end-game confirm, help, PB badge, search noise"), which lowered the Fuse
  threshold from 0.4 to 0.3.
- That commit's own comment states 0.3 "drops that class" of
  2-errors-in-5-characters typos, which is exactly what `Untied` → `United` is.
  The e2e failure is the *intended* behaviour of the change; the commit re-pinned
  the unit tests (`useCountrySearch.test.ts`) and missed this e2e spec.
- Checked out `dec3e96` — the branch head before any of this batch's work — and
  ran the single test. It fails identically there.

Two ways out, both the owner's call since the threshold decision is theirs:

1. Re-pin the assertion to the intended 0.3 behaviour (pick a typo inside the
   surviving low-error class — `Germani`, `Swtzerland` and `argentnia` are the
   ones the threshold comment names as deliberately kept).
2. Quarantine per CLAUDE.md's rules: `test.fixme(!!process.env.CI, …)` with a
   tracking-issue link.

Editing another session's in-flight test was deliberately not done here.

## 2. `chromeNeutrals.test.ts` — known false-negative routes

`src/lib/__tests__/chromeNeutrals.test.ts` reliably catches the failure mode that
actually occurred (a named raw-neutral class landing in a `.ts`/`.tsx` chrome
component) and fails with an actionable `file:line — fragment` message. It is not
airtight, and these gaps are documented rather than closed because each costs more
than the risk it retires — but if the gate is ever extended, this is the order of
value:

1. **Raw `white`/`black` are not covered at all.** `MapErrorOverlay`'s
   pre-migration surface was `bg-white/90` + `bg-white` + `dark:hover:bg-white` —
   3 of the 13 raw values this batch removed were `white`, not `slate`. A
   regression to `bg-white dark:bg-dark-400` ships green today. This is the most
   realistic gap, being half of what the batch just cleaned up.
2. **A colour class that does not resolve is invisible to every current test.**
   `text-dark-99` (a typo) emits no CSS; `AppCrashFallback.test.tsx`'s
   `toMatch(/\btext-dark-50\b/)` would still pass; the surface renders unstyled
   black again — the exact shape of the bug this batch fixed. It was caught once
   by hand, in a browser, reading computed styles. Nothing mechanises it.
   `designTokens.test.ts` already loads `index.css?raw`, so cross-checking every
   `(text|bg|border)-(sand|dark|ice|signal)-\d+` used in `src` against a matching
   `--color-*` in `@theme` would make the class of bug unrepeatable.
3. **Arbitrary values and inline styles bypass the named-class form.**
   `bg-[#334155]`, `style={{ color: '#cbd5e1' }}`. Not hypothetical:
   `index.css:313,351,441` show the team already reaches for raw slate hexes for
   the tooltip and attribution chrome (sanctioned — see DESIGN.md § Navigation).
4. **Scope is `.ts`/`.tsx` under `src/` only.** `index.css` is out by design and
   its three literals are sanctioned, but that documentation covers only today's
   three. Root `index.html` is app chrome too — it carries the theme-bootstrap
   script and `#root` — and a splash added there with `class="bg-slate-900"` would
   not be seen. Currently clean.
5. **`EXEMPT` skips a whole file.** `lib/regionTints.ts` is exempt for its
   Antarctic tint, and the anti-rot test only asserts *some* raw neutral remains.
   Chrome-purpose slate added to that file is invisible.
6. **The plausibility floor is loose.** `expect(...).toBeGreaterThan(100)` against
   an actual 115 scanned (198 total, 83 under `__tests__/`). Dropping all of
   `src/game` from the glob would leave enough to stay green with a whole subtree
   unscanned.

Also noted, not a false negative: `path.includes('__tests__/')` is a substring
rather than a path-segment match, so a hypothetical `__tests__extra/` directory
would also be excluded. It only ever widens exclusion; the sharper version of the
risk is that a *shipped* helper placed inside a `__tests__/` directory goes
unscanned.
