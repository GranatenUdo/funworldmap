# Globe + Terrain + Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade polworldmap from flat Mercator to a 3D globe with atmosphere, satellite-linked terrain, and polished mouse navigation.

**Architecture:** Globe projection always active via MapLibre 5.x `projection: { type: 'globe' }`. Terrain DEM source loaded at init but inactive until satellite toggle enables it. Mouse navigation improvements (constraints, cursors, tooltip, reset) applied during map initialization. All changes in 3 files.

**Tech Stack:** MapLibre GL JS 5.23.0 (built-in globe, terrain, sky APIs), AWS Terrain Tiles (terrarium encoding, no API key)

---

### Task 1: Add terrain constants to mapStyles.ts

**Files:**
- Modify: `src/lib/mapStyles.ts`

- [ ] **Step 1: Add terrain tile URL and constraints**

Replace the entire file content with:

```typescript
/** OpenFreeMap positron basemap style URL */
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

/** EOX Sentinel-2 Cloudless satellite tiles (no API key, CC BY-NC-SA 4.0) */
export const SATELLITE_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'

export const SATELLITE_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless</a> by EOX (Copernicus Sentinel data 2024)'

/** AWS Terrain Tiles — terrarium encoding, no API key (AWS Open Data) */
export const TERRAIN_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

export const TERRAIN_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">AWS Terrain Tiles</a>'

/** Default map view */
export const DEFAULT_CENTER: [number, number] = [0, 20]
export const DEFAULT_ZOOM = 1.8
export const DEFAULT_PITCH = 20

/** Navigation constraints */
export const MIN_ZOOM = 1.5
export const MAX_ZOOM = 12
export const MAX_PITCH = 60
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/lib/mapStyles.ts
git commit -m "feat: add terrain tile constants and navigation constraints"
```

---

### Task 2: Add tooltip styles to index.css

**Files:**
- Modify: `src/index.css` (append before the `@media (prefers-reduced-motion)` block)

- [ ] **Step 1: Add tooltip CSS**

Add before the `@media (prefers-reduced-motion: reduce)` block:

```css
/* Country name tooltip — positioned by JS, not React */
.country-tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(18, 21, 24, 0.88);
  color: #5eead4;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 100ms ease-out;
}

.country-tooltip.visible {
  opacity: 1;
}

.country-tooltip img {
  width: 24px;
  height: 16px;
  object-fit: cover;
  border-radius: 2px;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add country tooltip styles"
```

---

### Task 3: Globe projection + atmosphere + navigation constraints

The main task. Modify WorldMap.tsx to add globe, sky, constraints, cursors, and double-click disable.

**Files:**
- Modify: `src/components/WorldMap.tsx`

- [ ] **Step 1: Update imports**

Replace the mapStyles import block (lines 4-11) with:

```typescript
import {
  BASEMAP_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_PITCH,
  SATELLITE_TILES,
  SATELLITE_ATTRIBUTION,
  TERRAIN_TILES,
  TERRAIN_ATTRIBUTION,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_PITCH,
} from '../lib/mapStyles'
```

- [ ] **Step 2: Add terrain DEM source in addCountryLayers**

After the satellite layer block (after the `map.addLayer({ id: 'satellite-layer' ... })` call), add:

```typescript
    // Terrain DEM source — loaded but inactive until satellite toggle enables it
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: [TERRAIN_TILES],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
      attribution: TERRAIN_ATTRIBUTION,
    })
```

- [ ] **Step 3: Add cursor handlers and disable double-click zoom**

After the existing ocean click handler (`map.on('click', (e) => { ... })`), add:

```typescript
    // Grab cursor for map dragging
    map.getCanvas().style.cursor = 'grab'
    map.on('dragstart', () => {
      map.getCanvas().style.cursor = 'grabbing'
    })
    map.on('dragend', () => {
      map.getCanvas().style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    })

    // Disable double-click zoom — prevents race condition with country click
    map.doubleClickZoom.disable()
```

Also update the `mouseleave` handler: change `map.getCanvas().style.cursor = ''` to:

```typescript
      map.getCanvas().style.cursor = 'grab'
```

- [ ] **Step 4: Update Map constructor with constraints**

Replace the Map constructor options with:

```typescript
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: reducedMotion ? 0 : DEFAULT_PITCH,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxPitch: MAX_PITCH,
        attributionControl: false,
      })
```

- [ ] **Step 5: Set globe projection and scroll zoom tuning after map load**

Replace the `map.on('load', ...)` handler with:

```typescript
    map.on('load', () => {
      // Enable globe projection
      map.setProjection({ type: 'globe' })

      // Smooth trackpad zoom
      map.scrollZoom.setZoomRate(1 / 150)

      addCountryLayers(map).catch(console.error)
    })
```

- [ ] **Step 6: Update NavigationControl with visualizePitch**

Replace `new maplibregl.NavigationControl()` with:

```typescript
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
```

- [ ] **Step 7: Add sky/atmosphere to theme effect**

After the existing `setFog` call in the theme effect, add the `setSky` call:

```typescript
      // Atmosphere — visible on globe at low zoom, fades as you zoom in
      ;(map as never as { setSky: (sky: Record<string, unknown>) => void }).setSky({
        'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
        'horizon-color': isDark ? '#1a2030' : '#f0ede6',
        'fog-color': isDark ? '#10141a' : '#e8e3da',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.8,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': [
          'interpolate', ['linear'], ['zoom'],
          0, 1,
          5, 1,
          7, 0,
        ],
      })
```

- [ ] **Step 8: Add terrain toggle to satellite effect**

In the satellite toggle effect, after the satellite layer visibility toggle, add:

```typescript
      // Enable/disable 3D terrain with satellite
      if (satellite) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
      } else {
        map.setTerrain(null)
      }
```

- [ ] **Step 9: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build passes with no TypeScript errors

- [ ] **Step 10: Commit**

```bash
git add src/components/WorldMap.tsx
git commit -m "feat: globe projection, atmosphere, terrain, navigation constraints"
```

---

### Task 4: Country name tooltip

**Files:**
- Modify: `src/components/WorldMap.tsx`

- [ ] **Step 1: Add tooltip ref**

After `const hoveredRef = useRef<string | null>(null)` add:

```typescript
  const tooltipRef = useRef<HTMLDivElement | null>(null)
```

- [ ] **Step 2: Create tooltip DOM element in map init effect**

After `mapRef.current = map`, add:

```typescript
    // Tooltip DOM element (raw DOM, not React — avoids re-render on mousemove)
    const tooltip = document.createElement('div')
    tooltip.className = 'country-tooltip'
    containerRef.current!.parentElement!.appendChild(tooltip)
    tooltipRef.current = tooltip
```

In the cleanup function, before `map.remove()`, add:

```typescript
      tooltipRef.current?.remove()
      tooltipRef.current = null
```

- [ ] **Step 3: Show tooltip content in mousemove handler**

In the `mousemove country-fill` handler, after the cursor line, add:

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

- [ ] **Step 4: Position tooltip with global mousemove**

After the `mousemove country-fill` handler, add a global mousemove listener:

```typescript
    // Position tooltip at cursor
    map.on('mousemove', (e) => {
      const tooltip = tooltipRef.current
      if (tooltip && tooltip.classList.contains('visible')) {
        tooltip.style.left = `${e.point.x + 15}px`
        tooltip.style.top = `${e.point.y + 15}px`
      }
    })
```

- [ ] **Step 5: Hide tooltip on mouseleave**

In the `mouseleave country-fill` handler, after the cursor line, add:

```typescript
      const tooltip = tooltipRef.current
      if (tooltip) {
        tooltip.classList.remove('visible')
      }
```

- [ ] **Step 6: Verify build and commit**

Run: `npm run build 2>&1 | tail -3`

```bash
git add src/components/WorldMap.tsx
git commit -m "feat: country name tooltip on hover"
```

---

### Task 5: Reset view control

**Files:**
- Modify: `src/components/WorldMap.tsx`

- [ ] **Step 1: Add ResetViewControl class**

Before the `export default function WorldMap` line, add:

```typescript
/** Custom MapLibre control — reset to world view */
class ResetViewControl implements maplibregl.IControl {
  _container?: HTMLDivElement

  onAdd(map: maplibregl.Map): HTMLElement {
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const button = document.createElement('button')
    button.type = 'button'
    button.title = 'Reset to world view'
    button.setAttribute('aria-label', 'Reset to world view')
    button.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;'

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '22')
    svg.setAttribute('height', '22')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path1.setAttribute('d', 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    path2.setAttribute('points', '9 22 9 12 15 12 15 22')

    svg.appendChild(path1)
    svg.appendChild(path2)
    button.appendChild(svg)

    button.addEventListener('click', () => {
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: prefersReducedMotion() ? 0 : DEFAULT_PITCH,
        bearing: 0,
        duration: prefersReducedMotion() ? 0 : 1400,
      })
    })

    this._container.appendChild(button)
    return this._container
  }

  onRemove(): void {
    this._container?.remove()
  }
}
```

- [ ] **Step 2: Add the control in map init**

After the NavigationControl line, add:

```typescript
    map.addControl(new ResetViewControl(), 'bottom-right')
```

- [ ] **Step 3: Verify build and commit**

Run: `npm run build 2>&1 | tail -3`

```bash
git add src/components/WorldMap.tsx
git commit -m "feat: reset view control button"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build 2>&1`
Expected: Clean build, no errors

- [ ] **Step 2: Lint**

Run: `npm run lint 2>&1`
Expected: Zero violations

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit 2>&1`
Expected: All tests pass

- [ ] **Step 4: Start dev server and visual test**

Run: `npm run dev`

Test checklist:
1. Globe visible at world view — Earth rendered as sphere
2. Drag to spin the globe
3. Search + select a country — globe rotates and zooms
4. Atmosphere visible at low zoom, fades at higher zoom
5. Toggle satellite — terrain appears after brief loading
6. Toggle satellite off — terrain disappears, flat map returns
7. Hover a country — tooltip shows name + flag at cursor
8. Cursor: grab on idle, grabbing while dragging, pointer on country
9. Double-click does NOT zoom (disabled)
10. Reset view button (home icon) returns to world overview
11. Compass tilts to show pitch angle
12. Can't zoom past level 12 or below 1.5
13. Theme toggle: atmosphere adapts to dark/light
