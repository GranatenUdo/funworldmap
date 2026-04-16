# Polish, Keyboard, and Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement navigation restyling, tooltip capital city, basic keyboard shortcuts (`/`, `Esc`), and country comparison (side-by-side A vs B with map highlights, deep linking, and share link).

**Architecture:** Pure functions for hash parse/write (unit-testable in Node environment). React hook extended for compare state. New React components (Toast). Compare layers added to MapLibre on init, toggled via filters. State in App.tsx orchestrates compare/picking modes and keyboard handling. All changes preserve existing accessibility and animation patterns.

**Tech Stack:** React 19, TypeScript, MapLibre GL JS 5.x, Tailwind CSS 4, Vitest (Node env)

---

### Task 1: Hash parse/write pure functions + unit tests

**Files:**
- Create: `src/lib/hashState.ts`
- Create: `src/lib/__tests__/hashState.test.ts`

Extracts URL hash parsing/writing into pure, testable functions. Used by `useSelectedCountry` hook.

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/hashState.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseHash, writeHash } from '../hashState'

describe('parseHash', () => {
  it('returns empty state for empty hash', () => {
    expect(parseHash('')).toEqual({ selected: null, compareWith: null })
    expect(parseHash('#')).toEqual({ selected: null, compareWith: null })
  })

  it('parses single country', () => {
    expect(parseHash('#FRA')).toEqual({ selected: 'FRA', compareWith: null })
  })

  it('parses compare pair', () => {
    expect(parseHash('#FRA,DEU')).toEqual({ selected: 'FRA', compareWith: 'DEU' })
  })

  it('uppercases codes', () => {
    expect(parseHash('#fra,deu')).toEqual({ selected: 'FRA', compareWith: 'DEU' })
  })

  it('ignores empty second segment', () => {
    expect(parseHash('#FRA,')).toEqual({ selected: 'FRA', compareWith: null })
  })

  it('ignores trailing extra segments', () => {
    expect(parseHash('#FRA,DEU,JPN')).toEqual({ selected: 'FRA', compareWith: 'DEU' })
  })
})

describe('writeHash', () => {
  it('empty state returns empty string', () => {
    expect(writeHash(null, null)).toBe('')
  })

  it('single country', () => {
    expect(writeHash('FRA', null)).toBe('FRA')
  })

  it('compare pair', () => {
    expect(writeHash('FRA', 'DEU')).toBe('FRA,DEU')
  })

  it('ignores compareWith when selected is null', () => {
    expect(writeHash(null, 'DEU')).toBe('')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm run test:unit`
Expected: FAIL with "Cannot find module '../hashState'"

- [ ] **Step 3: Implement pure functions**

Create `src/lib/hashState.ts`:

```typescript
export interface HashState {
  selected: string | null
  compareWith: string | null
}

/** Parse URL hash (with or without leading #) into selected/compareWith country codes. */
export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { selected: null, compareWith: null }

  const parts = clean.split(',').map((s) => s.trim().toUpperCase())
  const selected = parts[0] || null
  const compareWith = parts[1] || null

  return { selected, compareWith }
}

/** Serialize state to hash string (without leading #). */
export function writeHash(selected: string | null, compareWith: string | null): string {
  if (!selected) return ''
  if (!compareWith) return selected
  return `${selected},${compareWith}`
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm run test:unit`
Expected: PASS (10 new tests for hashState + existing 15)

- [ ] **Step 5: Commit**

```bash
git add src/lib/hashState.ts src/lib/__tests__/hashState.test.ts
git commit -m "feat: pure hash parse/write functions with unit tests"
```

---

### Task 2: Extend useSelectedCountry for compare state

**Files:**
- Modify: `src/hooks/useSelectedCountry.ts` (full rewrite — currently 55 lines)

Extends the hook to expose `compareWith` state, `compareSelect` to set the second country, and `clearCompare`. Uses the pure functions from Task 1.

- [ ] **Step 1: Rewrite the hook**

Replace entire contents of `src/hooks/useSelectedCountry.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { CountryData } from '../lib/types'
import { parseHash, writeHash } from '../lib/hashState'

export function useSelectedCountry(
  byCca3: Map<string, CountryData>,
): {
  selected: CountryData | null
  compareWith: CountryData | null
  select: (cca3: string) => void
  compareSelect: (cca3: string) => void
  clearCompare: () => void
  deselect: () => void
} {
  const [selected, setSelected] = useState<CountryData | null>(null)
  const [compareWith, setCompareWith] = useState<CountryData | null>(null)

  const resolveHash = useCallback(() => {
    const { selected: selCode, compareWith: cmpCode } = parseHash(window.location.hash)

    const selCountry = selCode ? byCca3.get(selCode) ?? null : null
    const cmpCountry = cmpCode ? byCca3.get(cmpCode) ?? null : null

    // Invalid selected silently cleared
    if (selCode && !selCountry) {
      history.replaceState(null, '', window.location.pathname)
      setSelected(null)
      setCompareWith(null)
      return
    }

    setSelected(selCountry)
    setCompareWith(cmpCountry)
  }, [byCca3])

  useEffect(() => {
    resolveHash()
    window.addEventListener('hashchange', resolveHash)
    return () => window.removeEventListener('hashchange', resolveHash)
  }, [resolveHash])

  const select = useCallback((cca3: string) => {
    // New selection clears any existing compareWith
    window.location.hash = writeHash(cca3.toUpperCase(), null)
  }, [])

  const compareSelect = useCallback((cca3: string) => {
    // Pair compareWith with the existing selected (from state at call time)
    const currentHash = parseHash(window.location.hash)
    if (!currentHash.selected) return
    window.location.hash = writeHash(currentHash.selected, cca3.toUpperCase())
  }, [])

  const clearCompare = useCallback(() => {
    const currentHash = parseHash(window.location.hash)
    if (!currentHash.selected) return
    window.location.hash = writeHash(currentHash.selected, null)
  }, [])

  const deselect = useCallback(() => {
    history.replaceState(null, '', window.location.pathname)
    setSelected(null)
    setCompareWith(null)
  }, [])

  return { selected, compareWith, select, compareSelect, clearCompare, deselect }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (App.tsx will warn about destructuring until Task 6, but TypeScript-wise the hook signature change is the only breaking point; existing `select`/`deselect` are preserved)

Actually, App.tsx destructures `{ selected, select, deselect }` — still works since we just added new fields. Build should pass.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: PASS (hashState tests still pass, no regressions)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSelectedCountry.ts
git commit -m "feat: extend useSelectedCountry with compareWith state"
```

---

### Task 3: CSS — nav control restyling + tooltip layout

**Files:**
- Modify: `src/index.css`

Adds bottom-right control restyling scoped to navigation (not attribution), the two-line tooltip layout, and the compare A/B badge styles.

- [ ] **Step 1: Add CSS after the existing `.country-tooltip img` block**

Find in `src/index.css`:

```css
.country-tooltip img {
  width: 24px;
  height: 16px;
  object-fit: cover;
  border-radius: 2px;
}
```

After that block, append:

```css
/* Tooltip two-line layout (name + capital) */
.country-tooltip .tooltip-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.country-tooltip .tooltip-name {
  font-weight: 500;
  font-size: 13px;
  color: #5eead4;
}

.country-tooltip .tooltip-capital {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.7);
}

/* MapLibre navigation control restyling — scoped to bottom-right */
.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group {
  background: rgba(18, 21, 24, 0.88);
  border: 1px solid rgba(94, 234, 212, 0.25);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
  color: #5eead4;
  background: transparent;
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:hover {
  background: rgba(94, 234, 212, 0.12);
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button + button {
  border-top: 1px solid rgba(94, 234, 212, 0.15);
}

/* MapLibre compass/zoom icon color override (uses an img element with filter) */
.maplibregl-ctrl-bottom-right .maplibregl-ctrl-icon {
  filter: brightness(0) saturate(100%) invert(83%) sepia(37%) saturate(356%) hue-rotate(122deg) brightness(92%) contrast(93%);
}

/* Compare A/B badges */
.compare-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.compare-badge-a {
  background: #f43f5e;
}

.compare-badge-b {
  background: #0d9488;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: CSS for nav restyling, tooltip layout, compare badges"
```

---

### Task 4: Tooltip capital city + reset icon replacement

**Files:**
- Modify: `src/components/WorldMap.tsx`

Updates the existing tooltip `mousemove` handler to render a two-line structure, and replaces the "home" icon in `ResetViewControl` with a globe-with-arrow icon.

- [ ] **Step 1: Update tooltip content rendering in mousemove handler**

Find in `src/components/WorldMap.tsx` (inside the `mousemove country-fill` handler):

```typescript
        // Update tooltip content
        const tooltip = tooltipRef.current
        if (tooltip) {
          const country = byNumericRef.current.get(id)
          if (country) {
            tooltip.textContent = ''
            const img = document.createElement('img')
            img.src = country.flag
            img.alt = ''
            tooltip.appendChild(img)
            tooltip.appendChild(document.createTextNode(country.name.common))
            tooltip.classList.add('visible')
          }
        }
```

Replace with:

```typescript
        // Update tooltip content (flag + name + capital)
        const tooltip = tooltipRef.current
        if (tooltip) {
          const country = byNumericRef.current.get(id)
          if (country) {
            tooltip.textContent = ''
            const img = document.createElement('img')
            img.src = country.flag
            img.alt = ''
            tooltip.appendChild(img)

            const textWrap = document.createElement('div')
            textWrap.className = 'tooltip-text'

            const nameEl = document.createElement('div')
            nameEl.className = 'tooltip-name'
            nameEl.textContent = country.name.common
            textWrap.appendChild(nameEl)

            if (country.capital.length > 0) {
              const capitalEl = document.createElement('div')
              capitalEl.className = 'tooltip-capital'
              capitalEl.textContent = country.capital[0]
              textWrap.appendChild(capitalEl)
            }

            tooltip.appendChild(textWrap)
            tooltip.classList.add('visible')
          }
        }
```

- [ ] **Step 2: Replace the ResetViewControl SVG paths**

Find in `src/components/WorldMap.tsx` (in `ResetViewControl` class, `onAdd` method):

```typescript
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path1.setAttribute('d', 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    path2.setAttribute('points', '9 22 9 12 15 12 15 22')

    svg.appendChild(path1)
    svg.appendChild(path2)
    button.appendChild(svg)
```

Replace with:

```typescript
    // Globe with reset-arrow icon
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '12')
    circle.setAttribute('cy', '12')
    circle.setAttribute('r', '7')

    const meridian = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    meridian.setAttribute('cx', '12')
    meridian.setAttribute('cy', '12')
    meridian.setAttribute('rx', '3')
    meridian.setAttribute('ry', '7')

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrow.setAttribute('d', 'M20 4 L20 9 L15 9')

    svg.appendChild(circle)
    svg.appendChild(meridian)
    svg.appendChild(arrow)
    button.appendChild(svg)
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build passes

- [ ] **Step 4: Commit**

```bash
git add src/components/WorldMap.tsx
git commit -m "feat: tooltip capital city and globe-reset icon"
```

---

### Task 5: WorldMap compare layers + compare props

**Files:**
- Modify: `src/components/WorldMap.tsx`

Adds four compare layers (glow/fill/border/extrusion targeting `compareWith.ccn3`), adds the `compareWith` and `comparePickingMode` props, and handles picking mode cursor + opacity locking during compare viewing.

- [ ] **Step 1: Extend Props interface**

Find in `src/components/WorldMap.tsx`:

```typescript
interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
  resolvedTheme: 'light' | 'dark'
  satellite: boolean
  onSelect: (cca3: string) => void
  onDeselect: () => void
}
```

Replace with:

```typescript
interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
  compareWith: CountryData | null
  comparePickingMode: boolean
  resolvedTheme: 'light' | 'dark'
  satellite: boolean
  onSelect: (cca3: string) => void
  onDeselect: () => void
}
```

And update the function signature:

```typescript
export default function WorldMap({ byNumeric, selected, compareWith, comparePickingMode, resolvedTheme, satellite, onSelect, onDeselect }: Props) {
```

- [ ] **Step 2: Add teal-dim color constant**

Find near line 17 (existing color constants):

```typescript
const TEAL = '#14b8a6'
const TEAL_LIGHT = '#5eead4'
const CORAL = '#f43f5e'
const CORAL_LIGHT = '#fb7185'
```

Add after:

```typescript
const TEAL_DIM = '#0d9488'
```

- [ ] **Step 3: Add compare layers inside addCountryLayers**

Find in `addCountryLayers` (after the `country-selected-extrusion` layer block):

```typescript
    map.addLayer({
      id: 'country-selected-extrusion',
      type: 'fill-extrusion',
      source: 'countries',
      paint: {
        'fill-extrusion-color': CORAL,
        'fill-extrusion-height': 80000,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.55,
      },
      filter: ['==', ['get', 'id'], ''],
    })
```

After that block, add:

```typescript
    // --- Compare layers (second country "B" when in compare mode) ---
    map.addLayer({
      id: 'country-compare-glow',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': TEAL_DIM,
        'line-width': 10,
        'line-blur': 5,
        'line-opacity': 0.3,
      },
      filter: ['==', ['get', 'id'], ''],
    })

    map.addLayer({
      id: 'country-compare-fill',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': TEAL_DIM, 'fill-opacity': 0.32 },
      filter: ['==', ['get', 'id'], ''],
    })

    map.addLayer({
      id: 'country-compare-border',
      type: 'line',
      source: 'countries',
      paint: { 'line-color': TEAL_DIM, 'line-width': 2.5 },
      filter: ['==', ['get', 'id'], ''],
    })

    map.addLayer({
      id: 'country-compare-extrusion',
      type: 'fill-extrusion',
      source: 'countries',
      paint: {
        'fill-extrusion-color': TEAL_DIM,
        'fill-extrusion-height': 80000,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.55,
      },
      filter: ['==', ['get', 'id'], ''],
    })
```

- [ ] **Step 4: Add effect for compareWith filter updates**

Find the existing selection effect:

```typescript
  // Selection highlight + camera
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (selected) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], selected.ccn3]
      map.setFilter('country-selected', filter)
      map.setFilter('country-selected-border', filter)
      map.setFilter('country-selected-glow', filter)
      map.setFilter('country-selected-extrusion', filter)
      flyToCountry(map, selected)
    } else {
      const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
      map.setFilter('country-selected', emptyFilter)
      map.setFilter('country-selected-border', emptyFilter)
      map.setFilter('country-selected-glow', emptyFilter)
      map.setFilter('country-selected-extrusion', emptyFilter)
    }
  }, [selected, loaded])
```

After that effect, add:

```typescript
  // Compare-with highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (compareWith) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], compareWith.ccn3]
      map.setFilter('country-compare', filter)
      map.setFilter('country-compare-fill', filter)
      map.setFilter('country-compare-border', filter)
      map.setFilter('country-compare-glow', filter)
      map.setFilter('country-compare-extrusion', filter)
    } else {
      const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
      map.setFilter('country-compare-fill', emptyFilter)
      map.setFilter('country-compare-border', emptyFilter)
      map.setFilter('country-compare-glow', emptyFilter)
      map.setFilter('country-compare-extrusion', emptyFilter)
    }
  }, [compareWith, loaded])
```

Wait — there's no `country-compare` layer (only `-fill`, `-border`, `-glow`, `-extrusion`). Remove that line. Corrected:

```typescript
  // Compare-with highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (compareWith) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], compareWith.ccn3]
      map.setFilter('country-compare-fill', filter)
      map.setFilter('country-compare-border', filter)
      map.setFilter('country-compare-glow', filter)
      map.setFilter('country-compare-extrusion', filter)
    } else {
      const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
      map.setFilter('country-compare-fill', emptyFilter)
      map.setFilter('country-compare-border', emptyFilter)
      map.setFilter('country-compare-glow', emptyFilter)
      map.setFilter('country-compare-extrusion', emptyFilter)
    }
  }, [compareWith, loaded])
```

- [ ] **Step 5: Add effect for compare viewing mode (lock hover, dim borders)**

After the Compare-with highlight effect, add:

```typescript
  // Lock hover and dim borders when in compare viewing mode
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const emptyFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']
    const inCompareView = compareWith !== null

    try {
      if (inCompareView) {
        // Fixed 0.05 opacity (expression-free) so hover state doesn't change it
        map.setPaintProperty('country-fill', 'fill-opacity', 0.05)
        map.setFilter('country-hover-border', emptyFilter)
        map.setFilter('country-extrusion', emptyFilter)
        // Dim regular borders
        map.setPaintProperty('country-borders', 'line-opacity', 0.15)
      } else if (!satellite) {
        // Restore non-satellite normal expression
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.28,
          0.05,
        ])
        const isDark = resolvedTheme === 'dark'
        map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)
      }
      // (satellite mode has its own opacity values, handled by satellite effect)
    } catch {
      // Layers may not exist yet
    }
  }, [compareWith, loaded, satellite, resolvedTheme])
```

- [ ] **Step 6: Add picking mode cursor effect**

After the compare viewing effect, add:

```typescript
  // Crosshair cursor during compare picking mode
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (comparePickingMode) {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    }
  }, [comparePickingMode, loaded])
```

- [ ] **Step 7: Update hover handlers to respect picking mode**

The `mousemove country-fill` handler currently sets cursor to `'pointer'` unconditionally. That would override the crosshair. Find:

```typescript
        map.setFilter('country-extrusion', ['==', ['get', 'id'], id])
        map.setFilter('country-hover-border', ['==', ['get', 'id'], id])
        map.getCanvas().style.cursor = 'pointer'
```

Replace the cursor line to skip if picking:

```typescript
        map.setFilter('country-extrusion', ['==', ['get', 'id'], id])
        map.setFilter('country-hover-border', ['==', ['get', 'id'], id])
        // Keep crosshair during picking mode — read the cursor directly
        const canvas = map.getCanvas()
        if (canvas.style.cursor !== 'crosshair') {
          canvas.style.cursor = 'pointer'
        }
```

Similarly find the `mouseleave` handler:

```typescript
      map.setFilter('country-extrusion', ['==', ['get', 'id'], ''])
      map.setFilter('country-hover-border', ['==', ['get', 'id'], ''])
      map.getCanvas().style.cursor = 'grab'
```

Replace cursor line:

```typescript
      map.setFilter('country-extrusion', ['==', ['get', 'id'], ''])
      map.setFilter('country-hover-border', ['==', ['get', 'id'], ''])
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') {
        canvas.style.cursor = 'grab'
      }
```

- [ ] **Step 8: Update dragend handler similarly**

Find:

```typescript
    map.on('dragend', () => {
      map.getCanvas().style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    })
```

Replace:

```typescript
    map.on('dragend', () => {
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') {
        canvas.style.cursor = hoveredRef.current ? 'pointer' : 'grab'
      }
    })
```

- [ ] **Step 9: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build passes

- [ ] **Step 10: Commit**

```bash
git add src/components/WorldMap.tsx
git commit -m "feat: compare map layers, picking cursor, hover locking"
```

---

### Task 6: Compare state in App.tsx + keyboard shortcuts

**Files:**
- Modify: `src/App.tsx`

Adds `comparePickingMode` state, keyboard handler (`/` focuses search, `Esc` has priority: exit compare → close panel → clear search), helper functions for entering/exiting compare, and passes new props to children.

- [ ] **Step 1: Update imports**

Find the destructuring of `useSelectedCountry`:

```typescript
  const { selected, select, deselect } = useSelectedCountry(byCca3)
```

Replace:

```typescript
  const { selected, compareWith, select, compareSelect, clearCompare, deselect } = useSelectedCountry(byCca3)
```

- [ ] **Step 2: Add compare picking mode state**

After the existing `const [satellite, setSatellite] = useState(false)` line, add:

```typescript
  const [comparePickingMode, setComparePickingMode] = useState(false)
  const enterComparePicking = useCallback(() => {
    if (selected) setComparePickingMode(true)
  }, [selected])
  const exitCompare = useCallback(() => {
    setComparePickingMode(false)
    clearCompare()
  }, [clearCompare])
```

- [ ] **Step 3: Add select/compareSelect routing**

When user clicks a country, the map calls `onSelect`. We need to route that through App: if in picking mode, set compareWith; otherwise normal select.

Add below the compare state helpers:

```typescript
  const onMapSelect = useCallback(
    (cca3: string) => {
      if (comparePickingMode) {
        if (selected && cca3.toUpperCase() !== selected.cca3) {
          compareSelect(cca3)
          setComparePickingMode(false)
        }
        // If user clicks country A again, stay in picking mode
      } else {
        // Normal select (clears any existing compare, handled inside select())
        select(cca3)
      }
    },
    [comparePickingMode, selected, select, compareSelect],
  )
```

- [ ] **Step 4: Add keyboard shortcut handler**

After the existing `useEffect` blocks (before the `return`), add:

```typescript
  // Keyboard shortcuts: '/' focuses search, 'Esc' has priority cascade
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Priority: exit compare → close panel → clear search
        if (compareWith || comparePickingMode) {
          exitCompare()
          return
        }
        if (selected) {
          deselect()
          return
        }
        const searchInput = document.getElementById('search-input') as HTMLInputElement | null
        if (searchInput && searchInput.value) {
          searchInput.value = ''
          searchInput.dispatchEvent(new Event('input', { bubbles: true }))
          return
        }
        return
      }

      // For `/`, skip if target is already an input
      const target = e.target as HTMLElement | null
      if (target && target.matches('input, textarea, [contenteditable]')) return

      if (e.key === '/') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, compareWith, comparePickingMode, exitCompare, deselect])
```

- [ ] **Step 5: Pass new props down**

Find `<WorldMap ... onSelect={select} ... />`:

```typescript
      <WorldMap
        byNumeric={byNumeric}
        selected={selected}
        resolvedTheme={resolved}
        satellite={satellite}
        onSelect={select}
        onDeselect={deselect}
      />
```

Replace:

```typescript
      <WorldMap
        byNumeric={byNumeric}
        selected={selected}
        compareWith={compareWith}
        comparePickingMode={comparePickingMode}
        resolvedTheme={resolved}
        satellite={satellite}
        onSelect={onMapSelect}
        onDeselect={deselect}
      />
```

Find `<CountryPanel ... onSelect={select} ...>`:

```typescript
      {selected && (
        <CountryPanel
          country={selected}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={select}
          onClose={deselect}
          byCca3={byCca3}
        />
      )}
```

Replace:

```typescript
      {selected && (
        <CountryPanel
          country={selected}
          compareWith={compareWith}
          comparePickingMode={comparePickingMode}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={onMapSelect}
          onClose={deselect}
          onEnterCompare={enterComparePicking}
          onExitCompare={exitCompare}
          byCca3={byCca3}
        />
      )}
```

- [ ] **Step 6: Verify build (will fail — CountryPanel props don't exist yet)**

Run: `npm run build 2>&1 | tail -10`
Expected: TypeScript errors about CountryPanel missing props. That's fine — next task adds them. Stop here and commit partial progress:

- [ ] **Step 7: Commit WIP**

```bash
git add src/App.tsx
git commit -m "feat: compare state + keyboard shortcuts (WIP — needs panel)"
```

---

### Task 7: CountryPanel compare/share buttons + capital city + header

**Files:**
- Modify: `src/components/CountryPanel.tsx`

Adds new props, adds Compare and Share buttons to panel header, and shows capital city below country name.

- [ ] **Step 1: Update Props interface**

Find in `src/components/CountryPanel.tsx`:

```typescript
interface Props {
  country: CountryData
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  byCca3: Map<string, CountryData>
}
```

Replace:

```typescript
interface Props {
  country: CountryData
  compareWith: CountryData | null
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  onExitCompare: () => void
  byCca3: Map<string, CountryData>
}
```

And update function signature:

```typescript
export default function CountryPanel({
  country,
  compareWith,
  comparePickingMode,
  sources,
  isDesktop,
  onSelect,
  onClose,
  onEnterCompare,
  onExitCompare,
  byCca3,
}: Props) {
```

- [ ] **Step 2: Add onShareLink handler inside component**

After `const showSecondary = isDesktop || expanded`, add:

```typescript
  const onShareLink = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const hash = compareWith ? `#${country.cca3},${compareWith.cca3}` : `#${country.cca3}`
    const url = base + hash
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).catch(() => window.prompt('Copy this link:', url))
    } else {
      window.prompt('Copy this link:', url)
    }
    // Show toast via window event (Toast component listens)
    window.dispatchEvent(new CustomEvent('polworldmap:toast', { detail: 'Link copied' }))
  }
```

- [ ] **Step 3: Update panel header to show picking mode hint or normal title**

Find the existing panel header section (starts with `{/* Header */}`):

```typescript
      {/* Header */}
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3.5 min-w-0"
            style={{ animation: 'fade-up 200ms ease-out' }}
          >
```

Add a picking-mode banner above the flex container. Replace the header's inner content (within the sticky div) with:

```typescript
      {/* Header */}
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        {comparePickingMode && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-teal/10 dark:bg-teal-light/10 border border-teal/20 dark:border-teal-light/20 text-xs text-teal dark:text-teal-light">
            Pick a country to compare with...
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3.5 min-w-0"
            style={{ animation: 'fade-up 200ms ease-out' }}
          >
```

- [ ] **Step 4: Show capital under country name in header**

Find in the header, after the official name paragraph:

```typescript
              {country.name.official !== country.name.common && (
                <p className="text-xs text-sand-500 dark:text-dark-100 truncate mt-0.5">
                  {country.name.official}
                </p>
              )}
              {/* Region badge */}
```

Between that and the region badge, add the capital line:

```typescript
              {country.name.official !== country.name.common && (
                <p className="text-xs text-sand-500 dark:text-dark-100 truncate mt-0.5">
                  {country.name.official}
                </p>
              )}
              {country.capital.length > 0 && (
                <p className="text-xs text-teal dark:text-teal-light truncate mt-0.5">
                  {country.capital[0]}
                </p>
              )}
              {/* Region badge */}
```

- [ ] **Step 5: Add Compare and Share buttons to header action area**

Find the header's action area (the div with expand + close buttons):

```typescript
          <div className="flex items-center gap-1 shrink-0">
            {!isDesktop && (
              <button
                onClick={() => setExpanded(!expanded)}
                ...
              >
```

Insert the Compare and Share buttons BEFORE the `{!isDesktop && ...}` expand block. The action area becomes:

```typescript
          <div className="flex items-center gap-1 shrink-0">
            {/* Compare button — only when no compare active */}
            {!compareWith && !comparePickingMode && (
              <button
                onClick={onEnterCompare}
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-teal dark:text-teal-light transition-colors"
                aria-label="Compare with another country"
                title="Compare"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                  <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                </svg>
              </button>
            )}

            {/* Share link button */}
            <button
              onClick={onShareLink}
              className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
              aria-label="Copy link to this country"
              title="Copy link"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>

            {!isDesktop && (
              <button
                onClick={() => setExpanded(!expanded)}
```

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build passes (CountryPanel now accepts the props App.tsx passes).

- [ ] **Step 7: Commit**

```bash
git add src/components/CountryPanel.tsx
git commit -m "feat: compare and share buttons, capital in header"
```

---

### Task 8: CountryPanel two-column desktop compare layout

**Files:**
- Modify: `src/components/CountryPanel.tsx`

When in compare viewing mode on desktop, renders two columns side by side. Country A in left column (coral badge), country B in right (teal-dim badge).

- [ ] **Step 1: Extract the "country column" renderer into a helper**

Since compare mode needs two instances of the same layout, extract the content renderer. At the top of `CountryPanel.tsx`, ABOVE the existing `export default function CountryPanel` line, add a helper component.

First find the existing imports/helpers and verify. Then add BEFORE the `export default function CountryPanel`:

```typescript
function CountryColumn({
  country,
  sources,
  byCca3,
  onSelect,
  onClose,
  badgeLetter,
  badgeColor,
  showColumnClose,
}: {
  country: CountryData
  sources: CountriesFile['_sources']
  byCca3: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onClose: () => void
  badgeLetter: 'A' | 'B'
  badgeColor: 'a' | 'b'
  showColumnClose: boolean
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Column header */}
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0" style={{ animation: 'fade-up 200ms ease-out' }}>
            <span className={`compare-badge compare-badge-${badgeColor} mt-1`}>{badgeLetter}</span>
            <img
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[56px] h-[38px] object-cover rounded-lg shadow-md shrink-0"
            />
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
                {country.name.common}
              </h2>
              {country.capital.length > 0 && (
                <p className="text-xs text-teal dark:text-teal-light truncate mt-0.5">
                  {country.capital[0]}
                </p>
              )}
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100">
                {country.region}
              </span>
            </div>
          </div>
          {showColumnClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
              aria-label="Exit compare"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Column content — compact field list */}
      <div className="px-5 py-3 space-y-2">
        <CompareField label="Population">{country.population.toLocaleString('en-US')}</CompareField>
        <CompareField label="Area">{`${country.area.toLocaleString('en-US')} km\u00B2`}</CompareField>
        <CompareField label="Region">{country.region}{country.subregion && ` / ${country.subregion}`}</CompareField>
        {country.governmentType && <CompareField label="Government">{country.governmentType}</CompareField>}
        {Object.keys(country.languages).length > 0 && (
          <CompareField label="Languages">{Object.values(country.languages).join(', ')}</CompareField>
        )}
        {Object.keys(country.currencies).length > 0 && (
          <CompareField label="Currencies">
            {Object.values(country.currencies).map((c) => `${c.name} (${c.symbol})`).join(', ')}
          </CompareField>
        )}
        <CompareField label="UN Member">{country.unMember ? 'Yes' : 'No'}</CompareField>
        {country.borders.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-1.5">
              Borders
            </div>
            <div className="flex flex-wrap gap-1">
              {country.borders.slice(0, 6).map((code) => {
                const neighbor = byCca3.get(code)
                return (
                  <button
                    key={code}
                    onClick={() => onSelect(code)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 transition-colors"
                  >
                    {neighbor ? neighbor.name.common : code}
                  </button>
                )
              })}
              {country.borders.length > 6 && (
                <span className="px-2 py-0.5 text-[11px] text-sand-400 dark:text-dark-100">
                  +{country.borders.length - 6}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
  // `sources` unused in compact compare view
}

function CompareField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light">
        {label}
      </div>
      <div className="text-sm text-sand-800 dark:text-dark-50">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Render compare layout on desktop when compareWith is set**

Inside the existing `return` of `CountryPanel`, wrap the existing single-country JSX with a conditional. The existing layout was:

```typescript
  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[360px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 overflow-y-auto rounded-2xl border border-sand-200/50 dark:border-dark-200/20'
    : `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl transition-[height] duration-200 ${
        expanded ? 'h-[80vh]' : 'h-[40vh]'
      }`

  return (
    <div
      className={panelClasses}
```

Replace the `panelClasses` logic and return structure. Replace from `const panelClasses =` up to the opening `<div className={panelClasses}`:

```typescript
  const compareMode = compareWith !== null

  const panelClasses = isDesktop
    ? compareMode
      ? 'fixed right-4 top-16 bottom-4 w-[656px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 rounded-2xl border border-sand-200/50 dark:border-dark-200/20 overflow-hidden'
      : 'fixed right-4 top-16 bottom-4 w-[360px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 overflow-y-auto rounded-2xl border border-sand-200/50 dark:border-dark-200/20'
    : compareMode
      ? 'fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-2xl h-[80vh] overflow-hidden'
      : `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl transition-[height] duration-200 ${
          expanded ? 'h-[80vh]' : 'h-[40vh]'
        }`

  // Compare layout: desktop = two columns, mobile = vertical split
  if (compareMode && compareWith) {
    return (
      <div
        className={panelClasses}
        role="complementary"
        aria-label="Country comparison"
        data-testid="country-panel"
        style={isDesktop ? { animation: 'panel-card-in 250ms cubic-bezier(0.34, 1.3, 0.64, 1)' } : undefined}
      >
        <div className={isDesktop ? 'grid grid-cols-2 h-full' : 'flex flex-col h-full'}>
          {/* Column A */}
          <div className={isDesktop ? 'border-r border-sand-200/50 dark:border-dark-200/30' : 'flex-1 border-b-2 border-dashed border-sand-300/50 dark:border-dark-200/30 min-h-0'}>
            <CountryColumn
              country={country}
              sources={sources}
              byCca3={byCca3}
              onSelect={onSelect}
              onClose={onClose}
              badgeLetter="A"
              badgeColor="a"
              showColumnClose={false}
            />
          </div>
          {/* Column B */}
          <div className={isDesktop ? '' : 'flex-1 min-h-0'}>
            <CountryColumn
              country={compareWith}
              sources={sources}
              byCca3={byCca3}
              onSelect={onSelect}
              onClose={onExitCompare}
              badgeLetter="B"
              badgeColor="b"
              showColumnClose={true}
            />
          </div>
        </div>
      </div>
    )
  }

  // Normal single-country layout
  return (
    <div
      className={panelClasses}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build passes (warnings about unused `sources` in CountryColumn are fine — silence via `_sources` if lint complains)

- [ ] **Step 4: Fix lint warning (unused sources)**

In the `CountryColumn` function signature, change `sources: CountriesFile['_sources']` to `sources: CountriesFile['_sources']` and add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` above OR prefix the param with underscore:

Change `sources` to `_sources` in the `CountryColumn` function parameters AND update the call sites to pass `_sources: sources`. Actually, simpler — rename the destructured param to signal unused:

In `CountryColumn`:
```typescript
function CountryColumn({
  country,
  sources: _sources,
  byCca3,
  ...
```

Or just accept and not use it. Since we removed per-field tooltips in compare view (too cramped), `sources` isn't needed. Easier: remove `sources` from the helper's props entirely.

Update the `CountryColumn` function — remove the `sources` prop:

```typescript
function CountryColumn({
  country,
  byCca3,
  onSelect,
  onClose,
  badgeLetter,
  badgeColor,
  showColumnClose,
}: {
  country: CountryData
  byCca3: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onClose: () => void
  badgeLetter: 'A' | 'B'
  badgeColor: 'a' | 'b'
  showColumnClose: boolean
}) {
```

And remove the trailing comment `// sources unused in compact compare view`.

Update the two `<CountryColumn>` calls — remove `sources={sources}` from both.

- [ ] **Step 5: Verify build and lint**

Run: `npm run build 2>&1 | tail -5 && npm run lint`
Expected: Build passes, zero lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/CountryPanel.tsx
git commit -m "feat: two-column compare layout (desktop) and mobile vertical split"
```

---

### Task 9: SearchBar dynamic placeholder for picking mode

**Files:**
- Modify: `src/components/SearchBar.tsx`
- Modify: `src/App.tsx` (pass prop)
- Modify: `src/components/Header.tsx` (pass prop through)

When in compare picking mode, search placeholder changes to guide the user.

- [ ] **Step 1: Add prop to SearchBar**

In `src/components/SearchBar.tsx`, find the `Props` interface:

```typescript
interface Props {
  countries: CountryData[]
  onSelect: (cca3: string) => void
}
```

Replace:

```typescript
interface Props {
  countries: CountryData[]
  comparePickingMode?: boolean
  onSelect: (cca3: string) => void
}
```

Function signature:

```typescript
export default function SearchBar({ countries, comparePickingMode, onSelect }: Props) {
```

Placeholder line — find:

```typescript
        placeholder="Search countries..."
```

Replace:

```typescript
        placeholder={comparePickingMode ? 'Choose country to compare...' : 'Search countries...'}
```

- [ ] **Step 2: Pass prop through Header**

In `src/components/Header.tsx`, extend Props:

```typescript
interface Props {
  countries: CountryData[]
  theme: Theme
  satellite: boolean
  comparePickingMode: boolean
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
  onSatelliteToggle: () => void
}
```

Function signature:

```typescript
export default function Header({ countries, theme, satellite, comparePickingMode, onSelect, onThemeCycle, onSatelliteToggle }: Props) {
```

Find `<SearchBar countries={countries} onSelect={onSelect} />`:

```typescript
        <div className="pointer-events-auto flex-1 max-w-md mx-auto lg:mx-0">
          <SearchBar countries={countries} onSelect={onSelect} />
        </div>
```

Replace:

```typescript
        <div className="pointer-events-auto flex-1 max-w-md mx-auto lg:mx-0">
          <SearchBar countries={countries} comparePickingMode={comparePickingMode} onSelect={onSelect} />
        </div>
```

- [ ] **Step 3: Pass prop from App.tsx**

In `src/App.tsx`, find the `<Header ... />` JSX:

```typescript
      <Header
        countries={countries}
        theme={theme}
        satellite={satellite}
        onSelect={select}
        onThemeCycle={cycle}
        onSatelliteToggle={toggleSatellite}
      />
```

Replace with passing the prop and using `onMapSelect`:

```typescript
      <Header
        countries={countries}
        theme={theme}
        satellite={satellite}
        comparePickingMode={comparePickingMode}
        onSelect={onMapSelect}
        onThemeCycle={cycle}
        onSatelliteToggle={toggleSatellite}
      />
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build passes

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx src/components/Header.tsx src/App.tsx
git commit -m "feat: dynamic search placeholder in compare picking mode"
```

---

### Task 10: Toast component + App.tsx integration

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/App.tsx`

Toast listens for a global `polworldmap:toast` event (dispatched by the share link button), shows a pill for 2s, and auto-dismisses.

- [ ] **Step 1: Create Toast component**

Create `src/components/Toast.tsx`:

```typescript
import { useEffect, useState } from 'react'

export default function Toast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setMessage(customEvent.detail)
    }
    window.addEventListener('polworldmap:toast', handler as EventListener)
    return () => window.removeEventListener('polworldmap:toast', handler as EventListener)
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 2000)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-dark-400/90 backdrop-blur-sm border border-teal/30 text-teal-light text-sm shadow-lg"
      style={{ animation: 'fade-up 200ms ease-out' }}
    >
      {message}
    </div>
  )
}
```

- [ ] **Step 2: Mount Toast in App.tsx**

In `src/App.tsx`, add import at the top with other component imports:

```typescript
import Toast from './components/Toast'
```

In the JSX return, add `<Toast />` inside the outer `<div>`. Find any stable location — placing it after the loading screen block is fine. Find:

```typescript
      {/* Vignette — gentle focus */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
```

Insert `<Toast />` before that vignette div:

```typescript
      <Toast />

      {/* Vignette — gentle focus */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build passes

- [ ] **Step 4: Commit**

```bash
git add src/components/Toast.tsx src/App.tsx
git commit -m "feat: Toast component for share link confirmation"
```

---

### Task 11: Final verification

**Files:** (none — verification only)

- [ ] **Step 1: Full build**

Run: `npm run build 2>&1`
Expected: Clean build with no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint 2>&1`
Expected: Zero violations.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit 2>&1`
Expected: All tests pass — existing 15 + 10 new hashState tests = 25 total.

- [ ] **Step 4: Manual browser verification**

Start dev server: `npm run dev`

Navigate to `http://localhost:5173/` and verify:

1. **Nav controls** are styled with dark/teal aesthetic (not default gray)
2. **Reset view button** shows the globe+arrow icon (not the house)
3. Hover over any country — tooltip shows **flag + name + capital** (two lines)
4. Click a country — panel opens
5. In the panel header: **Compare button** (two circles icon) and **Share button** (chain-link icon) visible
6. Click **Share** — clipboard receives URL, toast "Link copied" appears for 2s
7. Click **Compare** — panel shows "Pick a country to compare with..." banner, cursor becomes crosshair over the map, search placeholder changes
8. Click a second country — panel splits into two columns (desktop) with A (coral) and B (teal-dim) badges
9. Both countries highlighted on map: A coral, B teal-dim
10. Click **X** on column B — returns to single-country panel (A stays selected)
11. Re-enter compare mode. Press `Esc` — exits compare
12. Press `Esc` again — closes panel (country deselected)
13. Press `/` — search input focused
14. Resize to mobile (390×844) — bottom sheet with vertical split in compare mode
15. Reload with URL `http://localhost:5173/#FRA,DEU` — loads directly into compare view

- [ ] **Step 5: Any fixes found during manual testing**

If issues found, fix and commit individually. If clean:

```bash
# No changes to commit; flag is just to mark task complete in plan tracking
```
