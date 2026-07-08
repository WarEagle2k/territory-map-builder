# Territory Map Builder

An internal tool for Connector Specialists Incorporated (CSI) to draw and share
sales/service territory maps across the southeastern US. Paint counties into
named, color-coded territories, attach rep contact details, and export a
branded PDF.

## Tech stack

- **React 18 + TypeScript**, built with **Vite**
- **D3 + TopoJSON** for the county / state / highway map rendering
- **Tailwind CSS** for styling
- **jsPDF** for PDF export (lazy-loaded so it stays out of the initial bundle)
- **Zod** for validating saved and imported data
- State persists to the browser's `localStorage` — there is no backend

## Getting started

```bash
npm install
npm run dev      # start the Vite dev server (default http://localhost:3000)
```

The dev server uses port 3000 by default; set the `PORT` environment variable
to run on a different port (useful when 3000 is already taken).

## Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the Vite dev server        |
| `npm run build`        | Production build to `dist/`      |
| `npm run preview`      | Preview the production build     |
| `npm run check`        | TypeScript type-check (no emit)  |
| `npm run lint`         | Run ESLint                       |
| `npm run format`       | Format with Prettier             |
| `npm run format:check` | Check formatting without writing |
| `npm test`             | Run the Vitest unit tests        |

## Project structure

```
client/
  public/            Static map data (see below) + CSI logo
  src/
    components/      Map, side panel, legend, rep dialog, shadcn UI primitives
    lib/             use-territories (territory state hook), storage (persistence +
                     Zod schemas), export-pdf, validation, colors
    pages/           home (app shell, layout, import/export)
```

## Usage notes

- **One color per territory.** Colors already used by another territory are
  disabled in the palette, and after saving a territory the brush automatically
  advances to the next unused color.
- **Import replaces everything.** Importing a JSON file swaps in the file's
  territories in place of the current set; the app asks for confirmation first
  if you have existing territories. Export (JSON) from the header to back up
  the current set before importing.
- **Data lives in your browser.** Territories persist to `localStorage` on the
  machine/browser where you built them. Use JSON export/import to move a map
  between machines, and PDF export to share the finished map.
- **PDF framing is territory-aware.** The exported map uses a fixed cover-fit
  crop of the region for a consistent look, but automatically zooms out or
  shifts just enough that no assigned county is ever cropped out — even
  territories at the region's edges (far-west Texas, south Florida).

## Map data

The map is driven by pre-generated static files in `client/public/`, fetched at
runtime (they are not bundled into the JS):

- `region-topo.json` — TopoJSON of counties + state outlines for the region
- `highways-topo.json` — TopoJSON of limited-access highways (from OpenStreetMap)
- `county-names.json` — FIPS → county name / state lookup
- `cities.json` — city markers and labels

To grow the region, regenerate these data files. The FIPS → state-abbreviation
table also lives in `client/src/components/TerritoryMap.tsx`.
