# Rename to funworldmap + Publish to Private GitHub Repo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project end-to-end from `polworldmap` to `funworldmap`, then publish it as a private repository at `github.com/GranatenUdo/funworldmap` deployed via GitHub Pages to `https://granatenudo.github.io/funworldmap/`.

**Architecture:** Pure rename — no behavior change, no new features. Every occurrence of `polworldmap` across config, runtime identifiers, UI strings, HTML metadata, public assets, tests, and docs is replaced with `funworldmap`. Historical records under `docs/superpowers/plans/` and `docs/superpowers/specs/` are left untouched (rewriting past plans would be dishonest). The placeholder host `https://polworldmap.example/` is replaced with the real GH Pages URL. Local default branch is renamed from `master` to `main` so the existing workflow triggers (`on: push: branches: [main]`) fire. Then a fresh private repo is created and pushed.

**Tech Stack:** React 19, Vite 6, TypeScript, MapLibre GL, Vitest, Playwright, GitHub Pages, `gh` CLI (required for remote/repo creation).

**Scope out of this plan:** Sentry DSN re-binding (the env-var-gated init already tolerates absent DSN — user can add the secret to the new repo later), local directory rename (`E:\polworldmap` → `E:\funworldmap`), any code-level refactor beyond name substitution, custom domain setup.

---

## File Structure

**Files to modify (identity/config):**
- `package.json` — `name` field
- `vite.config.ts` — `base` path
- `index.html` — title, OG/Twitter tags, canonical URL, all embedded URLs
- `public/robots.txt` — sitemap URL
- `public/sitemap.xml` — `<loc>` URL

**Files to modify (runtime identifiers — code + matching tests together):**
- `src/components/WorldMap.tsx` — `window.__polworldmap_map` debug global (L509, L549)
- `src/components/Toast.tsx` — `polworldmap:toast` custom event name (L11, L12)
- `src/components/CountryPanel.tsx` — `polworldmap:toast` dispatch (L204)
- `src/App.tsx` — `polworldmap-hint-shown` sessionStorage key (L84, L88)
- `src/hooks/useTheme.ts` — `polworldmap-theme` localStorage key (L5)
- `e2e/map-and-countries.spec.ts` — 7 uses of `__polworldmap_map`
- `e2e/theme-and-responsive.spec.ts` — 2 uses of `polworldmap-theme`
- `e2e/meta-and-static.spec.ts` — 2 regex matches on `polworldmap`

**Files to modify (UI strings shown to users):**
- `src/components/Header.tsx` — brand text (L23)
- `src/App.tsx` — loading splash brand text (L156)
- `src/components/WorldMap.tsx` — WebGL2-not-supported copy (L760)

**Files to modify (docs):**
- `README.md`
- `docs/index.md`, `docs/purpose.md`
- `docs/systems/accessibility.md`, `docs/systems/data-collection.md`, `docs/systems/data.md`, `docs/systems/overview.md`, `docs/systems/testing.md`, `docs/systems/ui-layout.md`
- (Any other `docs/systems/*.md` found by grep)

**Files to modify (hygiene):**
- `.gitignore` — add `.playwright-mcp/`, `/screenshot-*.png`, `/screenshots/`

**Files explicitly NOT modified:**
- `docs/superpowers/plans/*.md` — historical plan records
- `docs/superpowers/specs/*.md` — historical spec records
- `package-lock.json` — regenerated automatically by `npm install` after `package.json` change
- `.worktrees/`, `node_modules/`, `dist/` — generated/ignored

---

## Pre-flight

- [ ] **Step 0.1: Confirm `gh` CLI is installed and authenticated**

Run:
```bash
gh auth status
```

Expected output contains `Logged in to github.com as GranatenUdo` (or whichever account owns the `GranatenUdo` handle). If not authenticated, run `gh auth login` first and complete the browser flow.

- [ ] **Step 0.2: Confirm working tree is clean**

Run:
```bash
git status --short
git branch --show-current
```

Expected: working tree clean (no modified tracked files); current branch is `master`. Untracked items (`.playwright-mcp/`, root `screenshot-*.png`, `screenshots/`, any in-progress plan files) are fine — Task 6 handles them.

- [ ] **Step 0.3: Confirm the target repo does not already exist**

Run:
```bash
gh repo view GranatenUdo/funworldmap 2>&1 | head -3
```

Expected: an error like `GraphQL: Could not resolve to a Repository with the name 'GranatenUdo/funworldmap'`. If the repo already exists, STOP and ask the user whether to delete it or use a different name — do not attempt to push into an existing repo with unknown state.

---

## Task 1: Rename build identity (package.json + vite.config.ts)

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

**Rationale:** These two files anchor the build output. `package.json.name` shows up in npm logs and error stacks. `vite.config.ts.base` determines the URL path prefix used by every built asset reference — this MUST match the GitHub Pages project-site path (`/funworldmap/`).

- [ ] **Step 1.1: Edit package.json**

Replace the `"name"` line. The exact current line is:

```json
  "name": "polworldmap",
```

Change to:

```json
  "name": "funworldmap",
```

- [ ] **Step 1.2: Edit vite.config.ts**

Replace the `base` line. The current line at `vite.config.ts:7` is:

```ts
  base: process.env.GITHUB_ACTIONS ? '/polworldmap/' : '/',
```

Change to:

```ts
  base: process.env.GITHUB_ACTIONS ? '/funworldmap/' : '/',
```

- [ ] **Step 1.3: Regenerate package-lock.json**

Run:
```bash
npm install --package-lock-only
```

Expected: `package-lock.json` updates in place — the two `"name": "polworldmap"` lines at the top become `"funworldmap"`. No node_modules changes.

- [ ] **Step 1.4: Sanity check**

Run:
```bash
npm run lint
npm run test:unit
```

Expected: lint clean, 32/32 unit tests pass. These are unaffected by build-identity changes — this step just confirms nothing was typo'd.

- [ ] **Step 1.5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: rename build identity to funworldmap"
```

---

## Task 2: Rename HTML + public assets (and update to real GH Pages URL)

**Files:**
- Modify: `index.html`
- Modify: `public/robots.txt`
- Modify: `public/sitemap.xml`
- Modify: `e2e/meta-and-static.spec.ts`

**Rationale:** Replace both the brand (`polworldmap` → `funworldmap`) and the placeholder host (`https://polworldmap.example/` → `https://granatenudo.github.io/funworldmap/`) so the deployed site advertises real shareable URLs. The e2e test already asserts `/polworldmap/i` in meta content; that regex must update in the same commit or the test flips from passing to failing mid-rename.

- [ ] **Step 2.1: Rewrite index.html**

Replace the full content of `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0b0f1a" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />

    <title>funworldmap — Interactive political world map</title>
    <meta name="description" content="Explore 195 countries on a fast, free, interactive world map. Borders, capitals, populations, and more — with per-field source attribution." />

    <link rel="canonical" href="https://granatenudo.github.io/funworldmap/" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="funworldmap" />
    <meta property="og:title" content="funworldmap — Interactive political world map" />
    <meta property="og:description" content="Explore 195 countries on a fast, free, interactive world map. Borders, capitals, populations, and more — with per-field source attribution." />
    <meta property="og:url" content="https://granatenudo.github.io/funworldmap/" />
    <meta property="og:image" content="https://granatenudo.github.io/funworldmap/og-image.png" />
    <meta property="og:image:alt" content="Screenshot of funworldmap showing the globe with country borders." />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="funworldmap — Interactive political world map" />
    <meta name="twitter:description" content="Explore 195 countries on a fast, free, interactive world map." />
    <meta name="twitter:image" content="https://granatenudo.github.io/funworldmap/og-image.png" />

    <link rel="preload" as="font" type="font/woff2" href="/fonts/outfit-latin.woff2" crossorigin />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2.2: Rewrite public/robots.txt**

Replace the full content of `public/robots.txt` with:

```
User-agent: *
Allow: /

Sitemap: https://granatenudo.github.io/funworldmap/sitemap.xml
```

Note: GitHub Pages project sites live under a subpath, so `robots.txt` at `https://granatenudo.github.io/funworldmap/robots.txt` won't be discovered by crawlers that only check origin root (`https://granatenudo.github.io/robots.txt`). The sitemap line is still useful for crawlers that check subpath `robots.txt`, and the sitemap itself can be submitted directly to Google Search Console regardless.

- [ ] **Step 2.3: Rewrite public/sitemap.xml**

Replace the full content of `public/sitemap.xml` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://granatenudo.github.io/funworldmap/</loc>
    <lastmod>2026-04-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 2.4: Update the e2e meta regex**

Modify `e2e/meta-and-static.spec.ts`. Two lines need updating. Current content:

```ts
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /polworldmap/i)
```

Change to:

```ts
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /funworldmap/i)
```

And:

```ts
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /polworldmap/i)
```

Change to:

```ts
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /funworldmap/i)
```

- [ ] **Step 2.5: Run meta-and-static e2e**

Run:
```bash
npx playwright test meta-and-static --project=chromium
```

Expected: 6/6 pass.

If a test fails, re-read the failure and the relevant content block — probably a stray `polworldmap` not caught in the rewrite. Fix the content, not the test expectation.

- [ ] **Step 2.6: Commit**

```bash
git add index.html public/robots.txt public/sitemap.xml e2e/meta-and-static.spec.ts
git commit -m "chore: rename HTML/public assets to funworldmap and wire real GH Pages URL"
```

---

## Task 3: Rename runtime identifiers (code + matching tests together)

**Files:**
- Modify: `src/components/WorldMap.tsx`
- Modify: `src/components/Toast.tsx`
- Modify: `src/components/CountryPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useTheme.ts`
- Modify: `e2e/map-and-countries.spec.ts`
- Modify: `e2e/theme-and-responsive.spec.ts`

**Rationale:** Four runtime identifiers reference `polworldmap` and must rename in lockstep with their test counterparts, otherwise the intermediate commit has broken tests. Doing them all in one commit keeps every commit green.

| Identifier | Defined in | Used in (tests) |
|---|---|---|
| `window.__polworldmap_map` (debug global) | `WorldMap.tsx:509, 549` | `map-and-countries.spec.ts` (7×) |
| `polworldmap:toast` (custom event) | `Toast.tsx:11, 12`, `CountryPanel.tsx:204` | — |
| `polworldmap-hint-shown` (sessionStorage key) | `App.tsx:84, 88` | — |
| `polworldmap-theme` (localStorage key) | `useTheme.ts:5` | `theme-and-responsive.spec.ts:9, 76` |

- [ ] **Step 3.1: Rename the debug map global**

In `src/components/WorldMap.tsx`, replace the two occurrences of `__polworldmap_map` with `__funworldmap_map`. Current lines (line numbers approximate):

```tsx
      ;(window as unknown as Record<string, unknown>).__polworldmap_map = map
```
```tsx
        delete (window as unknown as Record<string, unknown>).__polworldmap_map
```

Change both to `__funworldmap_map`.

In `e2e/map-and-countries.spec.ts`, replace all 7 occurrences of `__polworldmap_map` with `__funworldmap_map`. Each is inside a `page.evaluate(() => { const map = (window as unknown as Record<string, unknown>).__polworldmap_map as { ... } })` block — update the string literal in each.

A reliable way to do the e2e substitution on Windows bash:
```bash
sed -i 's/__polworldmap_map/__funworldmap_map/g' e2e/map-and-countries.spec.ts
```

Verify:
```bash
grep -n "__polworldmap_map" src/ e2e/ -r
```
Expected: no output.

- [ ] **Step 3.2: Rename the toast custom event**

In `src/components/Toast.tsx`, lines 11–12:
```tsx
    window.addEventListener('polworldmap:toast', handler as EventListener)
    return () => window.removeEventListener('polworldmap:toast', handler as EventListener)
```

Change both occurrences of `'polworldmap:toast'` to `'funworldmap:toast'`.

In `src/components/CountryPanel.tsx`, line 204:
```tsx
    window.dispatchEvent(new CustomEvent('polworldmap:toast', { detail: 'Link copied' }))
```

Change `'polworldmap:toast'` to `'funworldmap:toast'`.

Verify:
```bash
grep -n "polworldmap:toast" src/ -r
```
Expected: no output.

- [ ] **Step 3.3: Rename the hint-shown sessionStorage key**

In `src/App.tsx`, lines 84 and 88:
```tsx
    if (sessionStorage.getItem('polworldmap-hint-shown')) return
```
```tsx
      sessionStorage.setItem('polworldmap-hint-shown', '1')
```

Change both occurrences of `'polworldmap-hint-shown'` to `'funworldmap-hint-shown'`.

- [ ] **Step 3.4: Rename the theme localStorage key**

In `src/hooks/useTheme.ts`, line 5:
```ts
const STORAGE_KEY = 'polworldmap-theme'
```

Change to:
```ts
const STORAGE_KEY = 'funworldmap-theme'
```

In `e2e/theme-and-responsive.spec.ts`, lines 9 and 76:
```ts
    await page.evaluate(() => localStorage.removeItem('polworldmap-theme'))
```
```ts
    const stored = await page.evaluate(() => localStorage.getItem('polworldmap-theme'))
```

Change both occurrences of `'polworldmap-theme'` to `'funworldmap-theme'`.

Verify:
```bash
grep -rn "polworldmap-theme\|polworldmap-hint-shown" src/ e2e/
```
Expected: no output.

- [ ] **Step 3.5: Run targeted tests**

Run:
```bash
npm run test:unit
npx playwright test map-and-countries theme-and-responsive
```

Expected: unit 32/32 pass; `map-and-countries` and `theme-and-responsive` pass. Pre-existing failures in theme/panel/axe (documented in the previous plan's regression notes) are unrelated — don't chase them here.

- [ ] **Step 3.6: Commit**

```bash
git add src/components/WorldMap.tsx src/components/Toast.tsx src/components/CountryPanel.tsx src/App.tsx src/hooks/useTheme.ts e2e/map-and-countries.spec.ts e2e/theme-and-responsive.spec.ts
git commit -m "chore: rename runtime identifiers to funworldmap"
```

---

## Task 4: Rename UI strings

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/WorldMap.tsx`

**Rationale:** Three places show the brand to users. None are asserted by e2e tests, so a visual check is the right verification.

- [ ] **Step 4.1: Rename in Header.tsx**

In `src/components/Header.tsx` around line 23, find the line containing the brand text:

```tsx
            polworldmap
```

Change to:

```tsx
            funworldmap
```

(The surrounding JSX is the brand element; only the text node changes.)

- [ ] **Step 4.2: Rename in App.tsx loading splash**

In `src/App.tsx` around line 156, find:

```tsx
            polworldmap
```

(This sits inside the `{!mapReady && (...)}` loading splash span.) Change to:

```tsx
            funworldmap
```

- [ ] **Step 4.3: Rename in WorldMap WebGL2-not-supported copy**

In `src/components/WorldMap.tsx` around line 760, find:

```tsx
            polworldmap requires WebGL2 to render the map. Please update your browser or enable
```

Change to:

```tsx
            funworldmap requires WebGL2 to render the map. Please update your browser or enable
```

- [ ] **Step 4.4: Visual check**

Run:
```bash
npm run dev
```

In a browser, open `http://localhost:5173/`. Verify:
- Header top-left reads `funworldmap` (not `polworldmap`)
- Loading splash (brief, on first load) shows `funworldmap`
- Browser tab title is `funworldmap — Interactive political world map`

Then stop the dev server (Ctrl+C).

- [ ] **Step 4.5: Grep for any missed code occurrences**

Run:
```bash
grep -rn "polworldmap" src/ e2e/
```

Expected: no output. If anything is found, fix it in this commit before proceeding.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/Header.tsx src/App.tsx src/components/WorldMap.tsx
git commit -m "chore: rename user-visible brand text to funworldmap"
```

---

## Task 5: Rename in docs

**Files:**
- Modify: `README.md`
- Modify: `docs/index.md`
- Modify: `docs/purpose.md`
- Modify: `docs/systems/*.md` (all files under `docs/systems/`)

**Rationale:** Documentation should match the shipped name. Historical records under `docs/superpowers/plans/` and `docs/superpowers/specs/` are deliberately **not** renamed — those are the record of work done under the `polworldmap` name and rewriting them would be misleading.

- [ ] **Step 5.1: List the doc files to rename**

Run:
```bash
grep -rln "polworldmap" docs/ README.md | grep -v "docs/superpowers/"
```

Expected output contains `README.md`, `docs/index.md`, `docs/purpose.md`, and the files under `docs/systems/`. Use this list to confirm scope before doing the substitution.

- [ ] **Step 5.2: Substitute across doc files**

Run (on Windows bash / Git Bash):
```bash
for f in README.md docs/index.md docs/purpose.md docs/systems/*.md; do
  sed -i 's/polworldmap/funworldmap/g' "$f"
done
```

- [ ] **Step 5.3: Verify docs/superpowers/ was NOT touched**

Run:
```bash
grep -c "polworldmap" docs/superpowers/plans/*.md docs/superpowers/specs/*.md 2>/dev/null
```

Expected: each file reports ≥1 occurrence (their original content is preserved). If any file under `docs/superpowers/` reports `0`, the wrong sed pattern was used — inspect and restore.

- [ ] **Step 5.4: Grep the rest of the repo**

Run:
```bash
grep -rn "polworldmap" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.worktrees --exclude-dir=dist --exclude-dir=docs/superpowers --exclude-dir=.playwright-mcp --exclude="package-lock.json" --exclude="screenshot-*.png"
```

Expected: no output. Anything that appears is a missed rename — fix it now before committing.

- [ ] **Step 5.5: Commit**

```bash
git add README.md docs/
git commit -m "docs: rename brand to funworldmap across docs (superpowers history preserved)"
```

---

## Task 6: Gitignore cleanup + rename local branch to main

**Files:**
- Modify: `.gitignore`
- Branch: `master` → `main`

**Rationale:** Before pushing to a fresh public-facing (though private-access) repo, scrub local debug artifacts that have been accumulating: `.playwright-mcp/` session dumps, root-level `screenshot-*.png` experiments, and the `screenshots/` folder. Then rename the local branch to `main` so the existing workflows — which trigger on `branches: [main]` — actually fire when we push.

- [ ] **Step 6.1: Update .gitignore**

Append to `.gitignore`:

```
# Playwright MCP session artifacts
.playwright-mcp/

# Ad-hoc debugging screenshots
/screenshot-*.png
/screenshots/
```

The full file after this change should be:

```
# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
Desktop.ini

# Playwright
test-results/
playwright-report/

# Vitest
coverage/

# Worktrees
.worktrees/

# Playwright MCP session artifacts
.playwright-mcp/

# Ad-hoc debugging screenshots
/screenshot-*.png
/screenshots/
```

- [ ] **Step 6.2: Verify nothing tracked needs removing**

Run:
```bash
git ls-files | grep -E "^(\.playwright-mcp/|screenshot-.*\.png|screenshots/)"
```

Expected: no output. If anything shows, run `git rm --cached <path>` on each match before the commit.

Note: `public/og-image.png` was copied from a root-level screenshot in the previous branch and is already committed under `public/` — it is NOT matched by `/screenshot-*.png` (the leading slash anchors to root) and stays tracked. Good.

- [ ] **Step 6.3: Confirm working tree is clean aside from .gitignore**

Run:
```bash
git status --short
```

Expected: only `M .gitignore` (and possibly untracked items that are now ignored — those should disappear).

- [ ] **Step 6.4: Commit .gitignore**

```bash
git add .gitignore
git commit -m "chore: ignore playwright-mcp sessions and ad-hoc screenshots"
```

- [ ] **Step 6.5: Rename local branch**

Run:
```bash
git branch -m master main
git branch --show-current
```

Expected: output is `main`.

---

## Task 7: Full local test sweep before push

**Files:** none modified.

**Rationale:** Final green-check before the work becomes a public-facing commit history on the new repo. Unit + e2e must pass on the renamed tree.

- [ ] **Step 7.1: Run lint + typecheck + unit**

```bash
npm run lint
npx tsc -b
npm run test:unit
```

Expected: lint clean, typecheck clean, 32/32 unit pass.

- [ ] **Step 7.2: Run the new-in-this-branch e2e**

```bash
npx playwright test map-reliability meta-and-static --project=chromium --project=chromium-gpu
```

Expected: 9/9 pass.

- [ ] **Step 7.3: Run the runtime-identifier e2e**

```bash
npx playwright test map-and-countries theme-and-responsive --project=chromium --project=chromium-gpu
```

Expected: `map-and-countries` passes. `theme-and-responsive` has 4 pre-existing failures unrelated to this rename (theme toggle ARIA mismatch on master — see the previous plan's audit notes). Don't block on those; note them in the PR/memory for a later session.

- [ ] **Step 7.4: Build once to catch any missed references**

```bash
npm run build
```

Expected: successful build. The compiled HTML in `dist/index.html` contains `funworldmap` and no `polworldmap`.

Verify:
```bash
grep -c "polworldmap" dist/index.html
```
Expected: `0`.

---

## Task 8: Create private GitHub repo and push

**Files:** none modified in this repo.

**Rationale:** Fresh private repo at `github.com/GranatenUdo/funworldmap`. Push `main` with full history. The existing `.github/workflows/deploy.yml` is configured to deploy `dist/` via `actions/deploy-pages@v4` on every push to `main`, so the push alone will trigger a deploy attempt.

- [ ] **Step 8.1: Create the private repo (empty, no initialization)**

Run:
```bash
gh repo create GranatenUdo/funworldmap --private --description "Interactive political world map"
```

Expected: output says `Created repository GranatenUdo/funworldmap on GitHub` and prints the URL `https://github.com/GranatenUdo/funworldmap`. The repo is empty — no README, no license, no initial commit. That's intentional: we push ours.

- [ ] **Step 8.2: Add remote and push**

Run:
```bash
git remote add origin https://github.com/GranatenUdo/funworldmap.git
git push -u origin main
```

Expected: all ~30 commits push (the history includes the entire prior `polworldmap` development). `origin/main` is set as upstream.

- [ ] **Step 8.3: Confirm the CI workflow starts**

Run:
```bash
gh run list --repo GranatenUdo/funworldmap --limit 5
```

Expected: two runs appear — one for `CI` (ci.yml) and one for `Deploy to GitHub Pages` (deploy.yml), both triggered by `push`. They may still be `in_progress` or `queued`. The CI workflow includes a lint/typecheck/unit/build/e2e pipeline and will take ~3–5 minutes.

- [ ] **Step 8.4: Wait for workflow runs to finish and inspect**

Run:
```bash
gh run list --repo GranatenUdo/funworldmap --limit 2 --json conclusion,name,url,status
```

Two outcomes are expected on the first push:

1. **CI workflow (`CI`):** should complete. Pass is ideal; the 4 known theme-and-responsive pre-existing failures (inherited from `polworldmap` master) may re-appear and are acceptable for now — file a follow-up issue (see Step W.4). If anything else fails (lint, typecheck, unit, build, map-and-countries, meta-and-static, map-reliability), stop and debug — those are caused by this rename and must be fixed before proceeding.
2. **Deploy workflow (`Deploy to GitHub Pages`):** will most likely **fail** with a `Pages site not yet created` error. This is expected — Pages is enabled in Task 9.1 and the deploy is retried in Task 9.2. Do not investigate this failure yet.

Proceed to Task 9 once CI has finished (regardless of Deploy's outcome).

---

## Task 9: Enable GitHub Pages with Actions source, then verify deployment

**Files:** none modified.

**Rationale:** The `deploy.yml` workflow uses `actions/deploy-pages@v4`, which requires Pages to be enabled with **GitHub Actions** as the source (not a branch). This is a one-time setting per repo. Until it's set, the deploy job fails with a `Pages site not yet created` error even though CI otherwise passes.

- [ ] **Step 9.1: Enable Pages with Actions as the source**

Via `gh` CLI:
```bash
gh api --method POST /repos/GranatenUdo/funworldmap/pages -f build_type=workflow
```

Expected: a JSON response with `"status": null` and `"url": "https://granatenudo.github.io/funworldmap/"`. If the API returns `409 Conflict`, Pages was already enabled — proceed to the next step.

Alternative (manual): open `https://github.com/GranatenUdo/funworldmap/settings/pages` in a browser and set **Source** to `GitHub Actions`.

- [ ] **Step 9.2: Trigger a rebuild if Pages was enabled after the first deploy run failed**

If the first deploy run from Task 8 failed with a Pages-not-enabled error, push an empty commit to re-trigger it:

```bash
git commit --allow-empty -m "chore: trigger Pages deploy after Pages source set"
git push
```

If the first deploy run succeeded, skip this step.

- [ ] **Step 9.3: Wait for the deploy workflow to complete**

Run:
```bash
gh run watch --repo GranatenUdo/funworldmap --exit-status
```

Expected: exits 0. If the deploy job prints a URL in its logs (typically `https://granatenudo.github.io/funworldmap/`), that's the live site.

- [ ] **Step 9.4: Verify the deployed site responds**

Run:
```bash
curl -I https://granatenudo.github.io/funworldmap/
```

Expected: `HTTP/2 200` (or `HTTP/1.1 200 OK`) and `content-type: text/html; charset=utf-8`. If 404: the deploy job may still be propagating — wait 30 seconds and retry. If still 404, check Settings → Pages in the repo UI for the actual URL (custom or otherwise).

- [ ] **Step 9.5: Open the site in a browser**

Manually open `https://granatenudo.github.io/funworldmap/`. Verify:
- The globe and country data load (no error overlay, no degraded banner)
- Clicking a country opens the panel
- Header reads `funworldmap`
- Page title in the browser tab is `funworldmap — Interactive political world map`
- View Source: OG tags reference `granatenudo.github.io/funworldmap`
- Visit `https://granatenudo.github.io/funworldmap/robots.txt` — returns the robots content
- Visit `https://granatenudo.github.io/funworldmap/sitemap.xml` — returns the sitemap content

- [ ] **Step 9.6: Share a link in Slack/iMessage/etc. to check the preview card**

Paste `https://granatenudo.github.io/funworldmap/` into a chat app that unfurls OG tags. Expected: preview shows the title, the description, and the og-image.png screenshot (the same image we copied earlier in the production-readiness plan). If the image doesn't show, check that `https://granatenudo.github.io/funworldmap/og-image.png` returns `200 OK` with `content-type: image/png`.

---

## Wrap-up

- [ ] **Step W.1: Update memory with the deployment URL**

Save a project memory for future sessions (follow the format in your memory system):

```
name: funworldmap deployment
description: Live URL and repo location for the funworldmap project
type: project

funworldmap is deployed to https://granatenudo.github.io/funworldmap/ from the private repo github.com/GranatenUdo/funworldmap on branch `main`. The repo uses a GitHub Pro account to host Pages from a private source. Local directory is still named `E:\polworldmap\` (not renamed to avoid breaking the Claude memory path).
```

- [ ] **Step W.2 (optional): Add the Sentry DSN as a repo secret**

If you have a Sentry DSN from the earlier production-readiness work, add it now to enable error reporting on the deployed site:

```bash
gh secret set VITE_SENTRY_DSN --repo GranatenUdo/funworldmap
```

(Paste the DSN when prompted.) Then trigger a rebuild:
```bash
git commit --allow-empty -m "chore: rebuild with Sentry DSN"
git push
```

- [ ] **Step W.3 (optional): Rename the local directory**

If you want the local path to match the new project name:

1. Close this editor session.
2. Outside the session:
   ```bash
   cd ..
   mv polworldmap funworldmap
   ```
3. Re-open your editor in the new path.

Note: Claude memory under `.claude/projects/E--polworldmap/` stays where it is. If you want to migrate it, copy the folder manually to `.claude/projects/E--funworldmap/` and Claude will pick it up on the next session.

- [ ] **Step W.4 (optional): Follow-up issues to file in the new repo**

In `github.com/GranatenUdo/funworldmap/issues`, open issues for the known follow-ups carried over from the production-readiness plan:

1. **Pre-existing theme-toggle test failures** — 4 tests in `e2e/theme-and-responsive.spec.ts` fail on this branch (inherited from `polworldmap` master). ARIA label mismatch; theme cycle UX likely diverged from test expectations.
2. **Basemap failover to a second provider** — requires Stadia/MapTiler signup; wire a `FALLBACK_BASEMAP_STYLE` constant.
3. **Data refresh runbook** — owner and cadence for `npm run update-data`.
4. **GH Pages bandwidth watch** — soft cap ~100 GB/month; revisit if traffic grows.
