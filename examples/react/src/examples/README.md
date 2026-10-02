# Examples

Each folder is one example of the site's gallery (`fragiola.com/data-grid/examples/<folder>`),
rendered alone by this app at `index.html?id=<folder>`.

```
src/examples/
  <slug>/index.tsx     the example (default export, "use client")
  <slug>/meta.ts       title, description, category, order, features, docs link, layout, height
  <slug>/styles.ts     how it looks: one class string (or state function) per part
  <slug>/*.ts(x)       optional sibling files, shown in the code panel
  _kit/                shared demo content and app logic (data generators, the fake API, the
                       range cache); no DataGrid assembly, no styles
  _themes/             the five themes (one CSS file each, values only) and their list
```

## Categories

The gallery groups examples by the feature they show (`CATEGORIES` in `meta-types.ts`, in sidebar
order; the site export contract calls a category a `level`). An example belongs where a reader
looking for its feature would search, and `order` is its place inside the category.

| category | what belongs in it |
|---|---|
| `getting-started` | the first grids: the smallest themed one, the same as a real `<table>` |
| `virtualization` | large grids on both axes: millions of cells, thousands of columns, variable heights |
| `data-loading` | where rows come from: infinite loading, loading by window, tiles |
| `keyboard` | the active cell and the keys that move it, and replacing them |
| `styling` | how the grid looks when it is not about one feature, the unstyled grid |

## Adding an example

1. Create `src/examples/<slug>/index.tsx`, `meta.ts` and `styles.ts` (see `meta-types.ts`).
2. `pnpm dev` at the root lists it in the playground (`apps/playground`), with hot reload, the five
   themes and its source: `http://localhost:5173/?example=<slug>`. The embed alone is
   `pnpm --filter examples-react dev` (`http://localhost:5180/?id=<slug>`, it regenerates the
   loaders).
3. The smoke e2e visits it in the reference theme (every theme only for the representative
   examples in `e2e/smoke.spec.ts`; `E2E_ALL_THEMES=1` runs them all), and inside an iframe. Add
   a spec for its main behaviour in `e2e/examples/<slug>.spec.ts`.

## Anatomy of an example

A reader opens `index.tsx` and sees the logic first: what is rendered, how the grid is assembled,
which API is called. How it looks is one click away, in `styles.ts`. The code panel shows the
example's files, the shared demo content it imports and the theme's CSS, and nothing else.

- **`index.tsx` renders `<DataGrid.Root>`** and the parts under it. Parts may be components in the
  same file or in sibling files of the same folder, never in a shared module: `_kit/` holds no
  DataGrid assembly (`tests/examples.test.ts`).
- **Classes in `styles.ts`**, beside `index.tsx`. It exports one `const` per styled part, named
  after the part (`root`, `header`, `headerCell`, `row`, `cell`, …): a class string, built with
  `cn()` when it is long or has conditions, or a function of the part's state. The `.tsx` files
  `import * as styles from "./styles"` and write `className={styles.cell}`. No `.tsx` file of an
  example holds a class string or calls `cn()` (`tests/examples.test.ts`).
- **Classes are complete literals.** Tailwind finds a class by reading the source, so
  `` `palette-${tone}` `` is never generated: map a value to a full class instead.
- **A class that does a job beyond looks keeps a short comment** in `styles.ts`.
- **Accessible names inline**: the grid's `aria-label`, each icon button's.
- **Tokens, not values that differ per theme**: fonts, padding, lines, the header and the active
  cell read the `--dg-*` tokens each theme declares (listed in `_themes/<name>.css`).

## Rules

- **Copyable imports only**: `react`, `@fragiola/data-grid`, `@fragiola/data-grid-react`,
  `lucide-react`, Fragiola UI (`#/components/ui/*`, `#/components/atoms/*`, `#/lib/cn`), and
  relative files inside `src/examples/`. `#/` is the app's `src/`; `@name` is reserved for
  packages (site export contract, §6). `tests/examples.test.ts` enforces it.
- **Theme-agnostic**: style through palette roles (`bg-palette-base`, …) and the theme tokens
  (`--dg-*`), never fixed colours, so the example works in all five themes.
- **State as data**: style the package's state through `data-*` and ARIA only.
- **Accessible names**: every button has `aria-label` or text; the package renders none.
- **App policy stays in the app**: fetching, caching and placeholders live in the example or in
  `_kit/`, never in a package.
- **Workarounds are commented** in the code (users copy them) and listed in
  `docs/walking-skeleton-report.md` at the repo root.
