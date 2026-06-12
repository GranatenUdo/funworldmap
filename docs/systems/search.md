# Search System

## Purpose

Search is one of the two primary navigation methods (alongside direct map interaction). It allows users to find any country by typing — matching against country names, capitals, regions, and country codes.

## Technology

**Fuse.js** — a lightweight (~8KB gzipped) client-side fuzzy search library. It runs entirely in the browser with no server or index service.

## How It Works

### Index Construction

On application load, a Fuse.js search index is built from the bundled `countries.json` data. The index covers multiple fields with weighted relevance:

| Field           | Weight | Why                                                   |
| --------------- | ------ | ----------------------------------------------------- |
| `name.common`   | 2.0    | Most users search by common name ("France", "Brazil") |
| `name.official` | 1.5    | Some users search official names ("French Republic")  |
| `capital`       | 1.0    | Searching by capital is common ("Paris" → France)     |
| `region`        | 0.5    | Regional browsing ("Europe", "South America")         |
| `subregion`     | 0.5    | More specific regions ("Western Europe")              |
| `cca2`          | 0.3    | Two-letter codes ("FR", "US")                         |
| `cca3`          | 0.3    | Three-letter codes ("FRA", "USA")                     |

### Fuzzy Matching

Fuse.js uses approximate string matching with a configurable threshold (0.4). This means:

- "Untied Stats" → "United States" (typo tolerance)
- "Brasil" → "Brazil" (common misspellings)
- "Fra" → "France" (fuzzy substring — f, r, a appear in sequence)
- "UK" → matches via cca2 code

### Query Flow

1. User types in the search bar
2. Input is debounced (150ms) to avoid excessive computation
3. Fuse.js searches the index, returns scored results
4. Top 8 results displayed in a dropdown
5. Each result shows: flag, country name, capital, region

### Selection Flow

When a user selects a search result (click or Enter):

1. Country is selected in application state
2. Map animates to the country's center (`flyTo`)
3. Information panel opens with country details
4. URL hash updates (e.g., `#FRA`)
5. Search input clears
6. Dropdown closes

## User Interface

### Search Bar

- Positioned prominently in the header
- Placeholder text: "Search countries..." (becomes "Choose country to compare..." in compare-picking mode)
- Clear button (×) appears when text is present
- Full-width on mobile, constrained width on desktop

### Autocomplete Dropdown

- Appears below the search bar when results exist
- Maximum 8 results to keep it scannable
- Each result: flag icon + country name + capital + region
- Disappears when search is empty or after selection

### No Results

When a query matches nothing:

- Dropdown shows "No countries found for '{query}'"
- ARIA live region announces "No results for {query}"
- User adjusts their query; no further action available

### Keyboard Navigation

- **Arrow Down / Arrow Up**: Move through results
- **Enter**: Select the highlighted result
- **Escape**: Close the dropdown
- Active result indicated visually and via `aria-activedescendant`

## Accessibility

The search implements the WAI-ARIA combobox pattern:

| Attribute               | Element     | Value                                  |
| ----------------------- | ----------- | -------------------------------------- |
| `role="combobox"`       | Input       | Identifies as combobox                 |
| `aria-expanded`         | Input       | `true` when dropdown open              |
| `aria-controls`         | Input       | Points to results listbox ID           |
| `aria-activedescendant` | Input       | Points to currently highlighted result |
| `role="listbox"`        | Dropdown    | Identifies as option list              |
| `role="option"`         | Each result | Identifies as selectable option        |
| `aria-selected`         | Each result | `true` on highlighted item             |

An ARIA live region announces result counts: "5 results for Fra" — so screen reader users know results are available without visually scanning.

## Performance

- Index is built once at startup from ~195 country records — negligible cost
- Each search query runs against the in-memory index — sub-millisecond
- 150ms debounce prevents unnecessary re-computation while typing
- No network requests — search is entirely local
