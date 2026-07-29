# Accessibility System

## Standard

WCAG 2.1 Level AA. This is a baseline requirement for every component from the start, not a final-phase add-on.

## Challenges Specific to Maps

Interactive maps are inherently difficult for accessibility. The primary interface (a WebGL2 canvas) is opaque to screen readers, and individual country polygons cannot receive keyboard focus. funworldmap addresses this through:

1. **Search as the keyboard-first path** — country selection is accessible through the search combobox. A keyboard user types a country name, navigates results with arrow keys, and selects with Enter.
2. **ARIA live regions** — map state changes are announced to screen readers
3. **Semantic panel content** — all country information is in proper HTML, fully accessible
4. **Keyboard controls** — map pan/zoom, panel, and search are all keyboard-operable

### Honest Limitation

Direct country selection by clicking a polygon requires a pointer device (mouse or touch). A keyboard user selects countries through search. This is an inherent limitation of canvas-based rendering — the map canvas cannot expose individual polygons to the accessibility tree. Search provides equivalent functionality through a different interaction path.

## Keyboard Navigation

### Tab Order

```
Skip links → Search input → Play button → Satellite toggle → Theme toggle → Map container → Country panel (when open)
```

### Skip Links

Two skip links at the top of the page, visible only on focus:

- "Skip to search" → focuses the search input
- "Skip to map" → focuses the map container

### Search Keyboard Controls

| Key        | Action                    |
| ---------- | ------------------------- |
| Type       | Filter results            |
| Arrow Down | Move to next result       |
| Arrow Up   | Move to previous result   |
| Enter      | Select highlighted result |
| Escape     | Close dropdown            |

### Map Keyboard Controls

| Key        | Action                     |
| ---------- | -------------------------- |
| Arrow keys | Pan map                    |
| + / -      | Zoom in / out              |
| Tab        | Move focus to next control |

### Panel Keyboard Controls

| Key    | Action                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| Escape | Close panel                                                                                                       |
| Tab    | Cycle through interactive elements (close button, expand/collapse, sources footer, border and explore-next chips) |
| Enter  | Activate focused element (e.g., navigate to border country)                                                       |

All attribution affordances are in the Tab order (D2 retired the hover-only `tabIndex=-1` 'i' buttons and the documented trade-off they carried): the sources footers' links, the single panel's "Source by field" disclosure button (`aria-expanded`, `aria-controls` while expanded), and the superscript exception markers (`SourceMarker.tsx`) — ordinary links labelled `Source: <name>`.

### Bottom Sheet (Mobile)

| Key                              | Action                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enter / Space (on expand button) | Toggle between peek (40dvh) and full (80dvh) states — the chevron exposes `aria-expanded`; the visible grabber bar is a pointer-only duplicate (`aria-hidden`, out of the tab order) |
| Escape                           | Close sheet entirely                                                                                                                                                                 |

## Screen Reader Support

### ARIA Roles and Labels

| Element        | Role                     | Label                                                                                                                                              |
| -------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map container  | `role="application"`     | `aria-label`: "Interactive world map", `aria-description`: "Pan with arrow keys, zoom with plus/minus, reset view with Home, deselect with Escape" |
| Search input   | `role="combobox"`        | "Search countries..." (accessible name from the placeholder)                                                                                       |
| Search results | `role="listbox"`         | (controlled by combobox)                                                                                                                           |
| Each result    | `role="option"`          | Country name                                                                                                                                       |
| Country panel  | `role="complementary"`   | "Country information"                                                                                                                              |
| Theme toggle   | `<button>`               | "Switch to dark mode" / "Switch to system theme" / "Switch to light mode"                                                                          |
| Sources footer | `<button aria-expanded>` | "Source by field" — expands to the field → source table                                                                                            |

**Note on `role="application"`**: This role tells screen readers to pass all keystrokes to the page instead of intercepting them for screen reader navigation (H for heading, L for list, etc.). This is intentional — arrow keys pan the map, +/- zoom. The label explicitly tells screen reader users to use search for country selection. When the user tabs out of the map container, normal screen reader navigation resumes.

### Live Region Announcements

An ARIA live region (`aria-live="polite"`) announces state changes:

- "France selected" — when a country is clicked or chosen from search
- "5 results for Fra" — when search results update
- "Country panel opened" / "Country panel closed" — panel state changes

This ensures screen reader users are informed of changes that are visually obvious but otherwise invisible to assistive technology.

### Image Accessibility

- Country flags use descriptive `alt` text (from REST Countries `flags.alt` field, bundled in the data)
- Decorative images use `alt=""`
- No information is conveyed through images alone

## Focus Management

### Panel Open

When the country panel opens, focus moves first to the panel heading (so screen readers announce the country name), then settles on the panel's close button once the slide-in completes (~300 ms). Keyboard users land on Close; the announcement still happens.

### Panel Close

When the panel closes (close button or Escape), focus returns to:

- The search input (if the country was found via search)
- The map container (if the country was clicked directly)

### Search Selection

After selecting a search result, the search input is cleared and the panel receives focus.

## Motion and Animation

### `prefers-reduced-motion`

When the user's system preference is `prefers-reduced-motion: reduce`:

- `flyTo` camera animations use `duration: 0` (instant jump, no animation)
- CSS transitions are disabled
- Panel slide-in/out happens instantly
- No hover scale effects on buttons

The application checks this preference directly — MapLibre's built-in `essential` flag is not used.

## Color and Contrast

### Text Contrast

All text meets WCAG AA minimum:

- Normal text (< 18pt): 4.5:1 contrast ratio
- Large text (>= 18pt bold): 3:1 contrast ratio

### Map Contrast

- Country borders are visible in both light and dark modes
- Selected country uses a high-contrast accent color
- Hover state provides sufficient visual distinction

### Non-Text Contrast

- Interactive controls (buttons, inputs) have 3:1 contrast against background
- Focus indicators have 3:1 contrast minimum

### Color Independence

No information is conveyed by color alone. Selected state uses both color change AND border change. Hover uses both opacity change AND cursor change.

## Touch Accessibility

- All interactive elements: minimum 44x44px touch target (exceeds WCAG 2.1 AA requirements; aligns with WCAG 2.5.5 Level AAA and Material Design guidelines)
- Preferred: 48x48px (Material Design guideline)
- Sufficient spacing between adjacent targets to prevent mis-taps

## Automated Auditing

Axe-core runs as part of the Playwright test suite, catching violations automatically:

- Missing labels
- Insufficient contrast
- Invalid ARIA patterns
- Missing alt text
- Keyboard traps

Target: zero violations on every test run.
