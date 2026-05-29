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
npm run dev      # start the Vite dev server (default http://localhost:5173)
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run check` | TypeScript type-check (no emit) |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm test` | Run the Vitest unit tests |

## Project structure

```
client/
  public/            Static map data (see below) + CSI logo
  src/
    components/      Map, side panel, legend, rep dialog, shadcn UI primitives
    lib/             storage (persistence + Zod schemas), export-pdf, validation, colors
    pages/           home (app shell + state)
```

## Map data

The map is driven by pre-generated static files in `client/public/`, fetched at
runtime (they are not bundled into the JS):

- `region-topo.json` — TopoJSON of counties + state outlines for the region
- `highways-topo.json` — TopoJSON of limited-access highways (from OpenStreetMap)
- `county-names.json` — FIPS → county name / state lookup
- `cities.json` — city markers and labels

To grow the region, regenerate these data files. The FIPS → state-abbreviation
table also lives in `client/src/components/TerritoryMap.tsx`.
