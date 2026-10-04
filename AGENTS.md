# Data Grid

A **headless** data grid. It ships behaviour, accessibility and composable primitives. It ships
**no CSS, no icons, no rendered menus and no text**, and it imposes **no DOM structure**: the same
primitives render a real `<table>` or a tree of `<div>`s. Styling belongs 100% to the consuming
developer; the package never assumes Tailwind, shadcn or anything else.

It is built for **millions of cells**: virtualized on both axes, with a scroll space that represents
the whole dataset from the start, and windows (which rows and columns are in view) a developer
loads data by.

Other adapters may follow React, so **every piece of logic that isn't rendering lives in the core**.

| package | name | contains | depends on |
|---|---|---|---|
| `packages/core` | `@fragiola/data-grid` | the typed model and its commands, axis math, windows, scroll scaling, cell navigation, the engine that binds one grid to the DOM; `/local`: the opt-in pipeline for rows in memory | DOM only |
| `packages/react` | `@fragiola/data-grid-react` | the `DataGrid.*` primitives and hooks over the core; `/local`: `useLocalRows` | peer `react`, `react-dom` (^19) |
| `apps/playground` | private | the dev app (every site example live, with themes and source), unstyled fixture pages driven by Playwright | both packages, `examples/react` |

## Non-negotiable rules

Do not "fix" these. They are the decisions of Epic #1 (D1–D12).

1. **Names (D1).** `@fragiola/data-grid` (core) and `@fragiola/data-grid-react`; the site's slug is
   `/data-grid`.
2. **Own implementation, referenced sources (D2).** React Data Grid (`../react-data-grid`,
   7.0.0-beta.60, MIT) and TanStack Table (`../tanstack-table`, v9.2.4, MIT) are **study
   references, read-only: never modified, never copied wholesale**. A file whose algorithm or code
   is derived from one starts with a header naming the project, its copyright and the MIT licence
   (RDG: "Original work Copyright (c) 2014 Prometheus Research / Modified work Copyright 2015
   Comcast"; TanStack: "Copyright (c) 2016 Tanner Linsley"), the root `LICENSE` appends that
   project's notice, and `packages/core/tests/guard.test.ts` lists the file.
3. **Hybrid state (D3).** The **model** is the grid's data and rules (columns, the row source, the
   active position). Every change is a command through a middleware chain (`model.run`,
   `model.use`); reads are `get`/`is` keys typed by a registry. An **engine** is one grid on
   screen: the scroll element, sizes, the rendered window, scroll scaling, keyboard and focus. Both
   share Dockable's verbs, each taking a key and a payload: `run` (do), `can` (a boolean), `check`
   (the dry-run result), `get` (read), `is` (yes/no). Keys are kebab-case; a command name has a dot
   (`active-position.move`), an engine action never does (`scroll-to-cell`). Everything only an
   adapter calls is under `engine.adapter`; an app never touches it. `DataGrid.Root` takes
   declarative props, controlled (`activePosition` + `onActivePositionChange`) or uncontrolled
   (`defaultActivePosition`), and maps them onto commands; `useDataGrid()` returns the model and
   the engine. **From outside the root (Epic #23)** an app gives `Root` a `gridRef`
   (`useDataGridRef()`, or `createDataGridRef()` outside a component): a subscribable handle whose `current` is `{ model, engine }` while that
   root is mounted, which `useDataGrid(gridRef)`, `useRowWindow(gridRef)` and
   `useColumnWindow(gridRef)` take. No Provider, no model created outside `Root`; `ref` stays the
   element. Rows that arrive behind the same `getRow` are told with `rows.changed { start?, end? }`,
   which renders only when the range is on screen. **Names say what they take**: an id field is `<entity>Id`, an index is
   `<entity>Index` (`rowIndex`, `columnIndex`), except a plain `index` (or `key`) when it is the
   index of what the key returns (`row-by { index }`, `column-by { key }`, as Dockable's
   `node-by { id }`); a key and its payload read as one sentence
   (`model.run("active-position.set", { rowIndex, columnIndex })`); a `get` key names its result,
   with `-by` when its payload selects (`row-key-by { rowIndex }`).
4. **The primitive contract is Dockable's (D4)**, below.
5. **Structure is the consumer's (D5).** The same primitives render `table/thead/tbody/tr/th/td` or
   `div`s (or anything through `render`). Two unstyled fixtures, one table and one div, are driven
   by the **same** Playwright spec.
6. **Data contract (D6).** `rows: TRow[]`, or `rowCount` + `getRow(index) => TRow | undefined`;
   `undefined` is "not loaded yet": the row keeps its space and renders with `data-loading`. The
   engine reports the row and column windows (visible and rendered ranges) and the end being
   reached. Fetching, caching and placeholders are **app policy**: they live in the examples
   (`_kit/`), never in a package.
7. **Sizes (D7).** `rowHeight: number | (index) => number`; columns `width: number` (px), the
   width a column starts with and a reset gives back: the model keeps a resized column's width
   over it (`columnWidths`, Epic #70).
8. **Scroll scaling (D8).** When an axis is larger than a physical cap (configurable, safe in
   Chromium, Firefox and WebKit by default), the engine maps physical scroll to virtual offset.
   Small moves stay pixel-exact relative to the content, the scrollbar reaches the whole dataset,
   both axes alike.
9. **Scrolling does not render React (D9)** unless the rendered window changes. The engine writes
   the layers' offsets imperatively; React never reconciles what the engine writes.
10. **One generic: the row type (D10).** `Column<TRow>` is `{ key, name?, width, getValue?,
    renderHeaderCell?, renderCell?, sortable?, pinned?, resizable?, minWidth?, maxWidth?,
    compare?, filter?, meta? }`. Without children, a header cell renders
    `renderHeaderCell`, else the column's `name` (the app's own text, never translated or made
    up); a cell renders `renderCell` for a loaded row, else its value as text. No column helper,
    no feature registry, no `flexRender`. **Column groups live in `columns` (Epic #13, G1):** an
    entry is a `Column` or a `ColumnGroup<TRow>` `{ key, name?, renderHeaderCell?, children,
    meta? }`, nested to any depth, keys unique across both; the leaves, in order, are the grid's
    columns (the column axis, cells and windows never see groups). The header has a row per level
    (rows `-depth … -1`, each `headerRowHeight` tall); a leaf with fewer groups above it spans the
    rows down to -1 (G2). The core lays the header cells out per column window (G3, a cut group
    included); a header cell's position is its first column on its row, a leaf spanning rows has
    one per row (G4); `aria-colspan`/`aria-rowspan` (G5). **Sorting (Epic #27, S1–S7):** the
    model keeps `sortColumns` (`{ columnKey, direction: "ascending" | "descending" }[]`, the
    first one first; `sort-columns.set`, `sort-columns.toggle { columnKey, multi }`), controlled
    or not on `Root` like the active position (`sortColumns`/`defaultSortColumns`/
    `onSortColumnsChange`, one helper for both). A click, Enter or Space on a sortable column's
    header cell toggles it (ascending, descending, none; Ctrl/⌘ adds it); a control inside the
    cell (or a widget holding controls), a drag and a held key's repeats are not a sort. `aria-sort` on the first
    sorted column only; `data-sortable`, `data-sort`, `data-sort-priority`. The grid never orders
    the rows: the app does. **Pinned columns (Epic #31, P1–P7):** `pinned: "start"` on the
    leading columns (`columnsError` refuses one after an unpinned column, and a group mixing
    both). They are always rendered (first in `view.columns` and each header row); the column
    window covers the view right of them; scrolling a cell into view leaves it right of them.
    A pinned cell (`data-pinned="start"`, `data-pinned-edge` on the last) is `position: sticky`
    in its row's flow, before the cells that scroll, and the row (header rows too) is
    `display: flex`, only while there are pinned columns (Epic #38). It registers as the
    engine's `pinned` element: the engine writes its `left` inset, `offsetOf(column) − layerX`
    (the layers' x, `scrollLeft − virtualX + columnBase`), only when `layerX` or the columns
    change (unscaled: a new view, never a scroll frame; scaled: with the engine's own moves, in
    the same task), so no painted frame lags the scroll; React renders no `left` for it. Rows
    and header rows start at `rowLeft` (−the pinned width − the rendered columns' width) so their
    box holds the pinned cells and sticky keeps them in place through a scroll not rendered yet,
    both ways. Stacking is the consumer's; pinned cells are their row's own children, and an
    `overflow` other than `visible`/`clip` on a row or a layer, or a row's padding or flex
    direction, breaks them. Pinned columns as wide as the view scroll with
    the rest until it is wider. **Master-detail (Epic #41, M1–M4):** the model keeps
    `expandedRowKeys` (keys, `rowKey` else index; `expanded-rows.set { rowKeys }`,
    `expanded-rows.toggle { rowIndex } | { rowKey }`, `is("row-expanded", { rowIndex })`),
    controlled or not on `Root` like the sort (`expandedRowKeys`/`defaultExpandedRowKeys`/
    `onExpandedRowKeysChange`). A row is expanded when it is loaded and its key is expanded; the
    model derives `expandedRows` (indexes) looking for a key where it was last seen, then only in
    the rows the app names (a `rows.changed` range, rows added behind the same `getRow`, a new
    source), so nothing is scanned without expanded keys. `detailHeight: number | (row, rowIndex)
    => number` (default 300) adds to an expanded row's size in the row axis (`withExtraSizes`, a
    sorted list over the base axis): no fake rows, indexes, windows and `getRow` unchanged; a row
    expanding above the view keeps the view where it is. `DataGrid.RowDetail` sits inside its
    `Row` after its cells, renders only while expanded, sticky (the engine's `detail` element,
    `left` = −layerX) with `margin-top` = the row's own height, as wide as the view; an expanded
    row is at least as wide as what holds it (`rowWidth`). ARIA: a detail is one `gridcell` of
    its row (`aria-colindex` 1, `aria-colspan` every column), so counts and row indexes never
    change. Keys: the arrows move between rows' cells and scroll by a row's own height; a detail
    has no `data-column-index`, so its keys and focus are its content's (a grid in it is its own). **Rows in memory (Epic #47, L1–L7):** an opt-in entry point per package, never imported by
    the main ones (their built files must not contain it): `@fragiola/data-grid/local` holds the
    framework-free pipeline (`createLocalRows` keeps the sort, filters, search and page;
    `derive(rows, columns)` filters, searches, sorts and pages in that order, each stage
    computed again only when its own inputs change; `sortRows`, `filterRows`, `searchRows`,
    `pageRows`), `@fragiola/data-grid-react/local` holds `useLocalRows(rows, columns, options)`,
    which keeps that state itself and returns `props` to spread onto `Root` (`rows`,
    `sortColumns`, a stable `onSortColumnsChange`) and `sort`/`filter`/`page` for the app's
    controls. Filter and page are not model state (no grid behaviour); the sort is. Values
    compare by type (`Intl.Collator`, numeric, base), empty ones last; `Column.compare` and
    `Column.filter` override; a text filter contains (case and accents aside), a list holds,
    anything else equals. A filter, the search or the sort changing goes to the first page.
   **Row selection (Epic #57, R1–R9):** headless first: the core keeps only what ARIA, `data-*`
   and the keys need. The model keeps `selectedRowKeys` (keys, `rowKey` else index, in the order
   selected; `selected-rows.set { rowKeys }`, `selected-rows.toggle { rowIndex, extend? } |
   { rowKey }`, `selected-rows.select-all`), `rowSelection: "single" | "multiple"` (absent: no
   selection, the commands refuse; single keeps one key, `extend` toggles, no select-all),
   `isRowSelectable(row, rowIndex)` (never added by a toggle by index, skipped by a range and
   select-all; keys the app gives are kept as given) and the anchor (`selection-anchor.set { rowIndex, selected? }`, `.clear`; a toggle
   by index sets it with the state it gave, and returns `{ rowKeys, anchor }`: a controlled
   `Root` keeps the anchor of a toggle its parent answers). A range gives every row from the
   anchor the anchor's state; a range or select-all reaching a row not loaded refuses whole
   (`not_loaded`). `is("row-selected")` is a key in a `Set`: no scan. Controlled or not on
   `Root` like the sort (`selectedRowKeys`/`defaultSelectedRowKeys`/`onSelectedRowKeysChange`).
   `aria-multiselectable` in multiple mode; a row that can be selected (or is) carries
   `aria-selected` `true`/`false` (ARIA's vocabulary: the one `"false"`), `data-selected` when
   selected. The extras are opt-in entry points, never imported by the main ones:
   `@fragiola/data-grid/selection` (`selectionStatus`, `withRowKeys`, `withoutRowKeys`,
   `toggledRowKeys`) and `@fragiola/data-grid-react/selection` (`useSelectAll(rowKeys,
   gridRef?)` → `{ status, count, toggle, canToggle }`); `useLocalRows` returns `filteredRows`. The
   checkbox is always the app's.
   **Column resizing (Epic #70, W1–W8):** the model keeps `columnWidths` (`{ [columnKey]: px }`,
   over each column's `width`; a key that is not a column is kept: it may come back),
   controlled or not on `Root` like the sort (`columnWidths`/`defaultColumnWidths`/
   `onColumnWidthsChange`); `column-widths.set { columnWidths }`, `.resize { columnKey, width }`,
   `.reset { columnKey? }`; `get("column-widths")`, `get("column-width-by", { columnKey })` (the
   width on screen, a group's its columns'). `resizable: true` opts a column in; `minWidth`
   (default 40) and `maxWidth` (default none) clamp every resize, and a `width` outside them is
   clamped where used; `columnsError` refuses a negative minimum or one above the maximum. The
   column axis reads the effective width, so pinned widths, header spans, windows and scroll
   scaling follow. A group's resize is shared by its resizable columns in proportion to their
   widths, each clamped, what one cannot take going to every other one that can; a resize writes
   a width only for a column whose width changes, none for one back to its own `width`, and
   commits nothing when no width changes; a group is resizable when one of its columns is. A
   width changing left of the view keeps the view on its first column (as a row expanding above
   it, M2), scaled or not. The handle is the app's element with `useColumnResizer(cell)`'s props
   (`role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`/`-min`/`-max` in px, the
   maximum without one the view's width, `data-grid-column-resizer` = the key,
   `data-grid-part="column-resizer"`); its name, place, look and `touch-action: none` are the
   app's. The engine drags it: a primary-button press (handed over by `Root` after the
   consumer's `onPointerDown`, and prevented: no focus, no text selection) captures the pointer,
   one `column-widths.resize` per animation frame (the view's `requestAnimationFrame`), right
   grows, the release (a lost capture, a move with no button) keeps the width, Escape or
   `pointercancel` resizes its column back to the width it started from (the others keep theirs)
   (`engine.get("column-resize")` → `{ columnKey, width } | null`, the `column-resize` event); a
   double click runs `column-widths.reset`; a press, click or drag on it is never a sort (an
   element with `data-grid-column-resizer` is a control of its header cell; no ARIA role changes
   for grids without resizing). `data-resizable` on a resizable header cell (a group's when
   one of its columns is), `data-resizing` on the header cell and the handle during a drag. Auto
   widths, reordering, RTL and persisting the widths are not the grid's (yet, or ever).
11. **Navigation is core behaviour (D11).** The active position lives in the model; the engine maps
    arrows, Home/End, Ctrl+Home/End and PageUp/PageDown onto it (APG grid pattern), scrolls the
    target into view and moves focus with a roving tabindex. Tab leaves the grid. With
    `rowSelection`, on a body cell in navigation: Shift+Space toggles its row, Shift+Up/Down
    (multiple) move and select from the anchor (the starting row when there is none or it
    clears; additive), Ctrl/⌘+A selects every row; at most one `selected-rows.*` command a key. **Interactive
    cells (Epic #52, I1–I5):** two modes, the engine's. Outside interaction the engine keeps the
    controls inside its own cells at `tabindex` -1 (a MutationObserver from the viewport's window,
    cells rendered later included; their own value kept; `data-grid-tab-stop` opts a control
    out; a nested grid's elements are that grid's), so the grid stays one tab stop. Enter or F2
    on a cell holding controls (Enter on a sortable header cell sorts: F2), or a control taking
    focus, hands the cell's keys to its controls: Tab and Shift+Tab cycle them, Escape (or focus
    leaving the cell) gives them back. The cell in interaction is always the active one
    (`engine.get("interaction")`, the `interaction` event, `view.interaction`,
    `interact-cell`/`leave-cell`); `data-interacting` on it. A column's resize handle is a control
    of its header cell: in interaction (F2, Enter on a header that does not sort, Tab among its
    controls), on the focused handle ←/→ resize by 10 px (Shift: 50), Home/End go to the minimum
    and the maximum (its `aria-valuemax`: without a `maxWidth`, the view's width), each one
    `column-widths.resize` after the consumer's handlers; the other page keys and Space do
    nothing there (no paging); Escape leaves interaction and keeps the width. A consumer can
    cancel or replace any key, and middleware can refuse or redirect a move. ARIA: `role="grid"`,
    `aria-rowcount`/`aria-colcount` are totals, `aria-rowindex`/`aria-colindex` 1-based.
12. **Versions (D12).** Exact versions published at least 7 days ago, checked against the registry
    (`npm view`) before pinning. **No virtualization library**: virtualization is the core's job.
13. **The core never touches global `document`/`window`** (nor `requestAnimationFrame`,
    `ResizeObserver`, …): DOM access goes through the root element's `ownerDocument`/`defaultView`,
    so the model loads in plain Node. **The core has zero runtime dependencies** and never imports
    `react`. A guard test enforces both.
14. **App policy stays in the app.** The packages ship no fetching, caching, persistence or
    translations.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm check` | Biome lint + format + assist (non-mutating) |
| `pnpm check:fix` | Biome check with auto-fix |
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit) |
| `pnpm test` | Vitest: `core` (node), `react` (jsdom), `playground`, `examples-react`, `site` |
| `pnpm bench` | Vitest benchmarks (informative, not a gate) |
| `pnpm build` | `pnpm -r build` (tsdown for the packages, Vite for the apps), then the `.d.ts` check |
| `pnpm size` | the bundle sizes of every entry point and chunk (raw, gzip, min + gzip): a report, after `pnpm build` |
| `pnpm e2e` | Playwright: the playground (Chromium and Firefox) and the examples app (Chromium) |
| `pnpm dev` | the playground on <http://localhost:5173>: every example live, the fixtures (`PLAYGROUND_PORT` moves it) |
| `pnpm site:export --base /data-grid --out <dir>` | the site export for fragiola.com (contract v1.2, `../www/CONTRACT.md`), self-validated |
| `pnpm site:dev --base /data-grid --port <n>` | the examples app with hot reload, under the base `www` proxies in dev |

## Repository layout

```
packages/core/      @fragiola/data-grid        src/, tests/
packages/react/     @fragiola/data-grid-react  src/, tests/
apps/playground/    src/                       the shell: catalog, sidebar, toolbar, stage, source
                    fixtures/<name>/           unstyled pages Playwright drives
                    e2e/, tests/               Playwright specs, unit tests
examples/react/     src/examples/<slug>/       the site's examples (the embed app, Vite)
                    src/components, lib, …     Fragiola UI, vendored (scripts/vendor-fragiola.ts)
                    e2e/                       Playwright specs, also inside an iframe
site/               docs/                      the pages fragiola.com/data-grid serves
                    export.ts, contract.ts     `pnpm site:export` and its validation
docs/                                          reports
```

## Playground

`pnpm dev` serves `apps/playground`: a local app to see the packages working, with hot reload on
the core, the React primitives and the examples. A sidebar, a theme switch (the five example
themes) and the source beside the stage; the state is in the URL
(`?example=<slug>&theme=<name>&code=1`).

- **Examples** live in `examples/react/src/examples` and are public: the site embeds them, readers
  copy them. The playground reads them in place (`import.meta.glob`, the `#/` alias and the
  pre-paint theme from `examples/react/vite.shared.ts`); it never keeps a second list.
- **Fixtures** (`fixtures/<name>/`) are the unstyled pages Playwright drives; the sidebar links
  them.

## Conventions

- Biome: 4-space indent, double quotes, LF, trailing newline, organized imports.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
  Do not relax it; a blanket `!` on every index access is not a fix.
- Commits are gitmoji-conventional: `✨ feat(core): …`, `🐛 fix(react): …`,
  `✅ test(core): …`, `🔧 chore: …`, `📝 docs: …`.
- Branches: `<type>/epic-<n>-<short-description>`; one worktree per Epic under `.worktrees/`.

## Type safety

- **No `any` in public types.** A guard test checks the core's exported declarations, and
  `pnpm build` checks every package's emitted `.d.ts` (`scripts/check-dts.ts`).
- **One generic, the row type.** No casts on row data, in the packages or the examples.
- **Type fixtures** go in `tests/types/` (checked by `tsc`, not run): `@ts-expect-error` marks
  what must not compile.

## Code quality

Every change keeps the packages small, simple and fast (Epic #62). Before writing code:

- **Reuse first.** Look for the helper that already exists (`sameCell`, `holdsRowIn`,
  `windowFor`, the row-key rule, the failure helper, the shared utils) before writing one. Logic
  needed twice becomes one function; a helper several modules use goes in a small shared module
  (`src/utils.ts` in the core, `src/utils/` in React), outside `local/` and `selection/` so the main
  entry never reaches the extras.
- **The core grows only for the grid's own job.** Headless first (Epic #57): what is not the
  grid's own (ARIA, `data-*`, keys, focus, layout, data contract) is an opt-in entry point or the
  app's.
- **Simple over clever.** No flag that duplicates other state, no defensive branch that cannot
  happen, no wrapper with a single caller unless its name says something the code does not.
- **Hot paths allocate nothing they do not need**: the scroll and wheel handlers, `update`,
  `commit`, and the per-cell hooks. Nothing runs per frame that can run per window change (D9).
- **Size is watched.** `pnpm size` (after `pnpm build`; CI prints it too) reports each entry point;
  a PR says when one grows noticeably, and why.
- **Tests share their setup**, never a copy: `packages/core/tests/engine/harness.ts` (the engine
  on a fake viewport), `packages/react/tests/helpers.tsx` and `examples/react/e2e/helpers.ts`,
  `examples/react/e2e/examples/helpers.ts` (the playground's spec imports it too).

A review checks:

1. Nothing is duplicated: logic needed twice is one function.
2. An existing helper is reused where one fits.
3. The core grows only for the grid's own job.
4. A hot path allocates and computes nothing it does not need.
5. The size report: what it adds, and why, in the PR.

## The primitive contract (`@fragiola/data-grid-react`)

Every primitive follows the same rules. Tests enforce them; keep it that way.

- **`render`, never `asChild`.** `render={<table />}` merges the primitive's props into the
  element; `render={(props, state) => …}` receives them plus the state.
- **`ref` is a plain prop** (React 19) and is merged with the primitive's own.
- **Arbitrary props are forwarded.** Consumer handlers compose with the internal ones: internal
  first, then the consumer's.
- **`className` and `style` accept a value or a `(state) => value` function.** Consumer style is
  merged *under* the structural style: structural keys always win.
- **Structural inline style only**: `position` (`sticky` on the header, `Empty`, pinned
  cells and a row's detail), `top`/`left`/`width`/`height`/`inset`, `transform` on the layers,
  `display` (also to make table parts positionable, and `flex` on rows and header rows with
  pinned columns), `overflow` on the viewport, `contain`, `box-sizing`, `z-index` between header
  rows (with column groups, an upper row stays above the next, which a column spanning rows
  reaches into), and on a row's detail `margin-top` (its place below the row's cells) and, in a
  row of pinned cells, `margin-left` and `flex-shrink: 0` (its box from the row's start, never
  shrunk). Nothing cosmetic.
- **State only through `data-*` and ARIA**, present or absent (never `"false"`; a selectable
  row's `aria-selected="false"` is ARIA's own "selectable, not selected"): `data-active`,
  `data-loading`, `data-empty`, … Every part carries `data-grid-part` and, for rows and cells,
  `data-row-index`/`data-column-index`; e2e selectors use them, never class names.
- **No text and no names.** Primitives render only their children (or the column's renderer) and
  set no `aria-label` of their own.
- **A column resizer is the app's element (Epic #70, W3).** `useColumnResizer(cell)` returns
  `{ state, props }` (`state`: `columnKey`, `resizable`, `resizing`, `width`, `minWidth`,
  `maxWidth`; `props`: the separator's ARIA, `tabIndex`, `data-grid-column-resizer`,
  `data-grid-part="column-resizer"`, `data-resizing`, an empty `style`), and no props under a
  cell that does not resize (`state.resizable` false: render none). The app gives it a name
  (`aria-label`), a place (a header cell is positioned), a look and `touch-action: none`. A header
  cell given children renders only them: `headerCellContent(cell)` is its default content, for
  `{headerCellContent(cell)}<Resizer cell={cell} />`. A focusable `separator` on a `div` needs a
  documented `biome-ignore` of `useAriaPropsSupportedByRole` (the APG splitter; an `<hr>` cannot
  take focus).
- **Hooks have one shape.** `useDataGrid()` is `{ model, engine }` (with a `gridRef`, or `null`
  until a root holds it); a part hook (`useRow`, `useCell`, `useHeaderCell`,
  `useColumnResizer`) returns `{ state, props }`, the structural style in `props.style`.
- **Keys go to the engine after the consumer.** `Root` calls the engine's `keydown` after the
  consumer's `onKeyDown` (on `Root` or on its `render` element), and a cell's `onKeyDown` runs
  before both (bubbling): `preventDefault` in either cancels a grid key, Enter, F2, Tab and
  Escape of interactive cells included. **Clicks too (Epic
  #27):** `Root` calls the engine's `click` (a header cell's sort) after the consumer's
  `onClick`, the same way. **Presses on a resizer too (Epic #70):** `Root` calls the engine's
  `pointerdown` (a resizer's drag) after the consumer's `onPointerDown`; during a drag, Escape
  goes to the engine's `keydown` the same way, and from outside the grid to a listener on the
  document's bubble phase, after the app's own handlers (a prevented Escape keeps the drag).
  Keys from outside the
  viewport (a menu portalled out of a cell) and from the app's content beside the cells (a
  control in `Empty`) are never the grid's: only its cells, its layers and its viewport.
- **The layers' `transform` is the engine's**: `Body` and `HeaderRow` drop a consumer's. The
  header layer has an element per header row: the engine writes the same transform to each. A
  pinned column's `Cell`/`HeaderCell` drop a consumer's `transform` and insets (`top`, `left`,
  `right`, `bottom`, `inset*`): its `left` is the engine's.
- **Header rows render through `HeaderRows` (Epic #13, G6)**, a children function over the
  header rows that `Header` renders by default; each `HeaderRow` takes its `row`, `HeaderCells`
  that row's cells (groups and columns), and `HeaderCell` carries `data-group` for a group and
  `colSpan`/`rowSpan` when rendered as a `th`. A grid without groups renders exactly as before.
- **A grid owns only its own cells (Epic #12, E4).** Every cell lookup and focus decision of an
  engine considers only cells whose nearest attached viewport is its own (a registry of attached
  viewports, across engines). A grid nested in a cell is its own grid; to the outer grid, focus
  inside it is focus inside the cell that holds it, and its keys (and wheel) are never the outer
  grid's. The registry is module state: nesting needs one copy of `@fragiola/data-grid` in the app.
- **`Empty` renders only while there are no rows (Epic #12, E3).** It sits in the body area (in
  the flow after `Header`, sticky on the left, as large as the visible body), has no text or role
  of its own, and `Root` and `Grid` carry `data-empty` meanwhile. With no rows, the grid's sizer
  spans at least the visible area (the view's `viewportWidth`/`viewportBodyHeight`).
- **`RowDetail` renders only while its row is expanded (Epic #41, M3).** It holds only its
  children (no text, no names), is a block (its content's layout is the app's), and drops a
  consumer's insets and `transform` like a pinned cell. As a `td` it gets `colSpan`.
- **The root is no tab stop** (`tabIndex={-1}`, some browsers make a scroll container one): the
  grid is, until a cell is active, then the active cell is (roving tabindex).
- **The developer owns the recursion**: children functions over the windowed rows and cells.

## Site

The docs and examples are served by `fragiola.com/data-grid`, built by the `www` repo from this
repo's **site export** (`../www/CONTRACT.md`, v1.2). This repo only provides: the pages
(`site/docs`, base-free links, the v1.2 vocabulary), the gallery configuration (`examples.json`)
and the examples app (`examples/react`, built for `<base>/embed/react/`). `www` owns the shell,
the gallery chrome, the code panel and search. A page's `title` is at most 60 characters and
never repeats "Data Grid"; its `description` is 50–160 characters, plain words, no `: ` (YAML);
a page body has no `#` and never skips a heading level; `pnpm site:export` checks all of it. Examples import internal modules through `#/…`
(never `@/…`). Every HTML file of the examples app carries
`<meta name="robots" content="noindex">`.

In dev the playground resolves both packages to their sources through the `development` export
condition; production builds use `dist`.
