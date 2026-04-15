# Phase 0: Repository Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the polworldmap repository with git, project scaffold, tooling, CI pipeline, and GitHub Pages deployment — producing a deployable empty app.

**Architecture:** Vite 6 + React 19 + TypeScript (strict) + Tailwind CSS 4 (CSS-first config). Playwright for e2e testing with SwiftShader for headless WebGL2. GitHub Actions for CI (lint + type-check + build) and deployment (GitHub Pages). All production and dev dependencies installed upfront so subsequent phases can focus on features.

**Tech Stack:** Vite 6, React 19, TypeScript, Tailwind CSS 4, MapLibre GL JS, Fuse.js, Playwright, Vitest, ESLint, Prettier

---

## File Structure

```
polworldmap/
  .github/
    workflows/
      ci.yml                    # Lint + type-check + build on push
      deploy.yml                # Build + deploy dist/ to GitHub Pages on push to main
  docs/                         # Already exists — system design documents
  e2e/
    scaffold.spec.ts            # Phase 0 smoke test: app renders
  public/
    (empty, flags added in Phase 1)
  src/
    App.tsx                     # Minimal app shell
    main.tsx                    # React entry point (Vite scaffold)
    index.css                   # Tailwind CSS 4 imports + dark variant
    vite-env.d.ts               # Vite type declarations (scaffold)
  .gitignore
  .prettierrc
  eslint.config.js
  index.html                    # Vite entry HTML
  package.json
  playwright.config.ts
  README.md
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vite.config.ts
```

---

### Task 1: Initialize Git and Create .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repository**

Run:
```bash
cd /e/polworldmap && git init
```

Expected: `Initialized empty Git repository`

- [ ] **Step 2: Create .gitignore**

Create `.gitignore`:

```gitignore
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
```

- [ ] **Step 3: Commit docs and gitignore**

```bash
git add .gitignore docs/
git commit -m "feat: initialize repository with system design documentation

Add 11 system design documents covering architecture, data model,
map rendering, search, UI layout, accessibility, testing, and build.
Add implementation spec and plan.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Expected: Commit succeeds with docs/ and .gitignore

---

### Task 2: Scaffold Vite + React + TypeScript

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/index.css`

- [ ] **Step 1: Run Vite scaffold**

```bash
cd /e/polworldmap && npm create vite@latest . -- --template react-ts
```

Expected: Scaffold creates files in the existing directory. The `docs/` folder is preserved. Answer `y` if prompted about non-empty directory.

- [ ] **Step 2: Verify scaffold files exist**

```bash
ls package.json index.html vite.config.ts tsconfig.json src/main.tsx src/App.tsx
```

Expected: All files listed without errors.

- [ ] **Step 3: Install base dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev -- --host 0.0.0.0 &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1 2>/dev/null
```

Expected: HTML response containing `<div id="root">` — confirms Vite serves the React app.

- [ ] **Step 5: Commit scaffold**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript project

npm create vite@latest with react-ts template.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Install All Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

```bash
npm install maplibre-gl @vis.gl/react-maplibre fuse.js topojson-client world-atlas
```

Expected: 5 packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D @tailwindcss/vite @playwright/test @axe-core/playwright tsx vitest @types/topojson-client typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier
```

Expected: Packages added to `devDependencies` in `package.json`.

- [ ] **Step 3: Install Playwright browsers**

```bash
npx playwright install chromium
```

Expected: Chromium browser downloaded for Playwright.

- [ ] **Step 4: Verify no dependency conflicts**

```bash
npm ls --depth=0 2>&1 | tail -5
```

Expected: No `ERESOLVE` or `peer dep` errors.

- [ ] **Step 5: Commit dependencies**

```bash
git add package.json package-lock.json
git commit -m "feat: install all production and dev dependencies

Production: maplibre-gl, @vis.gl/react-maplibre, fuse.js, topojson-client, world-atlas
Dev: tailwindcss/vite, playwright, axe-core, tsx, vitest, eslint, prettier

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Configure Tailwind CSS 4

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Add Tailwind plugin to Vite config**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

- [ ] **Step 2: Replace src/index.css with Tailwind imports**

Replace `src/index.css` with:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Custom design tokens added as needed */
}
```

- [ ] **Step 3: Update App.tsx to use Tailwind classes**

Replace `src/App.tsx` with:

```tsx
function App() {
  return (
    <div className="h-screen w-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-center">
      <p className="text-lg">polworldmap</p>
    </div>
  )
}

export default App
```

- [ ] **Step 4: Clean up main.tsx imports**

Replace `src/main.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Remove Vite scaffold boilerplate**

```bash
rm -f src/App.css src/assets/react.svg public/vite.svg
```

- [ ] **Step 6: Verify Tailwind works**

```bash
npm run dev -- --host 0.0.0.0 &
sleep 3
curl -s http://localhost:5173 | grep -q "polworldmap" && echo "OK: App renders" || echo "FAIL"
kill %1 2>/dev/null
```

Expected: `OK: App renders`

- [ ] **Step 7: Verify production build**

```bash
npm run build && ls dist/assets/*.css
```

Expected: Build succeeds, CSS file exists in `dist/assets/`.

- [ ] **Step 8: Commit Tailwind configuration**

```bash
git add vite.config.ts src/index.css src/App.tsx src/main.tsx
git rm -f src/App.css 2>/dev/null; git rm -f src/assets/react.svg 2>/dev/null; git rm -f public/vite.svg 2>/dev/null
git commit -m "feat: configure Tailwind CSS 4 with dark mode variant

CSS-first config via @tailwindcss/vite plugin. Custom dark variant
for class-based dark mode. Minimal App shell with Tailwind classes.
Remove Vite scaffold boilerplate.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Configure ESLint and Prettier

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Replace scaffold ESLint config**

The Vite scaffold may have generated an `eslint.config.js`. Replace it with our config.

Replace `eslint.config.js` with:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
```

- [ ] **Step 2: Create Prettier config**

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 3: Add lint and format scripts to package.json**

Add to `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "test:e2e": "playwright test",
    "test:unit": "vitest run"
  }
}
```

- [ ] **Step 4: Run lint to verify config works**

```bash
npm run lint
```

Expected: No errors (or only warnings from scaffold code that we already cleaned up).

- [ ] **Step 5: Run format on source files**

```bash
npm run format
```

Expected: Files formatted, no errors.

- [ ] **Step 6: Commit linting and formatting**

```bash
git add eslint.config.js .prettierrc package.json src/
git commit -m "feat: configure ESLint + Prettier

ESLint with typescript-eslint, react-hooks, react-refresh plugins.
Prettier with single quotes, no semicolons, trailing commas.
Add lint and format npm scripts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Configure Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/scaffold.spec.ts`

- [ ] **Step 1: Create Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-gl=swiftshader'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 2: Create scaffold smoke test**

Create `e2e/scaffold.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('app renders with polworldmap text', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toContainText('polworldmap')
})

test('page has no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/')
  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
})
```

- [ ] **Step 3: Run the Playwright tests**

```bash
npm run test:e2e
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit Playwright configuration**

```bash
git add playwright.config.ts e2e/
git commit -m "feat: configure Playwright with SwiftShader for WebGL2

Playwright config with SwiftShader GPU emulator for headless WebGL2 testing.
Scaffold smoke test: app renders, no console errors.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Configure Vitest

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add Vitest config to vite.config.ts**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 2: Verify vitest runs (no tests yet, but config works)**

```bash
npm run test:unit 2>&1 | head -3
```

Expected: Output mentions "no test files found" or similar — no config errors.

- [ ] **Step 3: Commit vitest config**

```bash
git add vite.config.ts
git commit -m "feat: configure Vitest for unit testing

Vitest integrated via vite.config.ts. Node environment for data tool tests.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Create GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: tsc -b

      - name: Build
        run: npm run build

      - name: Unit tests
        run: npm run test:unit

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: E2E tests
        run: npm run test:e2e

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit CI workflow**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add GitHub Actions CI workflow

Lint, type-check, build, unit tests, and Playwright e2e tests on push/PR.
Node 22, npm ci, Playwright report uploaded as artifact.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Create GitHub Pages Deployment Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Add base path config for GitHub Pages**

GitHub Pages serves from `https://<user>.github.io/<repo>/` which requires a base path. Update `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/polworldmap/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 3: Verify build still works with base path**

```bash
npm run build && grep -l "polworldmap" dist/index.html
```

Expected: Build succeeds. The HTML references assets with the base path when `GITHUB_ACTIONS` is set.

- [ ] **Step 4: Commit deploy workflow**

```bash
git add .github/workflows/deploy.yml vite.config.ts
git commit -m "feat: add GitHub Pages deployment workflow

Deploys dist/ to GitHub Pages on push to main.
Vite base path set to /polworldmap/ in CI for correct asset URLs.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Create README and Update index.html

**Files:**
- Create: `README.md`
- Modify: `index.html`

- [ ] **Step 1: Create README.md**

Create `README.md`:

```markdown
# polworldmap

Free, interactive political world map. Explore countries, borders, and geopolitical facts through a map-first interface.

## Development

```bash
npm install
npm run dev           # Start dev server at localhost:5173
npm run build         # Type-check and produce production build
npm run test:e2e      # Run Playwright end-to-end tests
npm run test:unit     # Run Vitest unit tests
npm run lint          # Check for lint errors
npm run format        # Format source files with Prettier
```

## Documentation

See [docs/index.md](docs/index.md) for the full system design documentation.
```

- [ ] **Step 2: Update index.html title and meta**

Replace `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Free, interactive political world map. Explore countries, borders, and geopolitical facts." />
    <title>polworldmap</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Final build and test verification**

```bash
npm run build && npm run test:e2e && npm run lint
```

Expected: Build passes. 2 Playwright tests pass. Lint passes.

- [ ] **Step 4: Commit README and HTML**

```bash
git add README.md index.html
git commit -m "feat: add README and update HTML meta tags

README with development setup and link to system docs.
HTML title, description, and lang attribute for polworldmap.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 0 Completion Checklist

After all tasks, verify:

- [ ] `npm run dev` serves the app at localhost:5173 with "polworldmap" text
- [ ] `npm run build` produces `dist/` with no errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test:e2e` — 2 Playwright tests pass
- [ ] `npm run test:unit` runs without config errors
- [ ] `git log --oneline` shows 10 clean commits
- [ ] `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` exist
- [ ] `README.md` exists at root with dev setup instructions
- [ ] `docs/` directory preserved with all 11+ system design documents
