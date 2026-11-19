# Data Grid

A **headless** data grid. It ships behaviour, accessibility and composable primitives. It ships
**no CSS, no icons, no rendered menus and no text**, and it imposes **no DOM structure**: the same
primitives render a real `<table>` or a tree of `<div>`s. Styling belongs 100% to the consuming
developer; the package never assumes Tailwind, shadcn or anything else.

It is built for **millions of cells**: virtualized on both axes, with a scroll space that represents
the whole dataset from the start, and windows (which rows and columns are in view) a developer
loads data by.

**v0 is reached** (Epics #85–#89): a stable grid at parity with React Data Grid 7.0.0-beta.60
(every example of its website has a counterpart here: `site/docs/guides/from-react-data-grid.mdx`
maps them and its props), plus four capabilities it lacks: **cell ranges** (with the clipboard
and the fill handle), **measured row heights**, **collapsible column groups with sticky labels**
and **row reordering**. It also takes rows by index (`rowCount` + `getRow`) and scales the scroll
past the browser's size limit. What it leaves out is `site/docs/beyond-v0.mdx`; next come the
maintainer's API review, then features and examples inspired by Bryntum Grid. Publishing is set
up (`docs/releasing.md`): nothing reaches npm until the maintainer merges the Version Packages PR.

Vue follows React (Epic #123), then Angular (Epic #129), and other adapters may follow, so
**every piece of logic that isn't rendering lives in the core**: a decision every adapter takes is a core helper
(`packages/core/src/adapter/`, below).

| package | name | contains | depends on |
|---|---|---|---|
| `packages/core` | `@fragiola/data-grid` | the typed model and its commands, axis math, windows, scroll scaling, the engine that binds one grid to the DOM, the feature registry (below); opt-in entry points: `/local` (the pipeline for rows in memory); the features: `/sorting` (`sorting()`), `/navigation` (`navigation()`), `/row-selection` (`rowSelection()` and its helpers), `/range` (`cellRange()`), `/clipboard` (`clipboard()`, `parseTsv`/`toTsv`), `/fill` (`fillHandle()`, `repeatedFill`), `/editing` (`editing()`, `editActions`, `editCellPropsOf`), the column features (`/column-resize`, `/column-reorder`, `/column-pinning`, `/column-group-collapse`) and the row features (Epic #151): `/row-expansion` (`rowExpansion()`, `rowDetailPartOf`), `/row-grouping` (`rowGrouping()`, `groupTogglePartOf`), `/row-reorder` (`rowReorder()`, `rowDragHandlePartOf`, `rowsMove`), `/spans` (`cellSpans()`), `/summary-rows` (`summaryRows()`, the summary parts' helpers), and (Epic #153) `/filtering` (`filtering()`, `validColumnFilters`, `sameFilters`), `/search` (`search()`), `/pagination` (`pagination()`, `pageCount`) | DOM only |
| `packages/react` | `@fragiola/data-grid-react` | the `DataGrid.*` primitives and hooks over the core; `/local`: `useLocalRows`; each feature's subpath re-exports the core's (`/sorting`, `/navigation`, `/range`, `/clipboard`), `/row-selection` with `useSelectAll`, `/fill` with `useFillHandle`, `/editing` with `useCellEdit`, `/column-resize` with `useColumnResizer`, the other column features, and (Epic #151) `/row-expansion` with `RowDetail` and `useRowDetail`, `/row-grouping` with `useGroupToggle`, `/row-reorder` with `useRowDragHandle`, `/spans`, `/summary-rows` with `Summary`, `SummaryRows`, `SummaryRow`, `SummaryCells`, `SummaryCell`, their hooks, `SummaryRowInfo`, `SummaryCellInfo` (the core's `SummaryRowsProps` as `SummaryRowsFeatureProps`), and (Epic #153) `/filtering`, `/search`, `/pagination` (the core's only) | peer `react`, `react-dom` (^19) |
| `packages/vue` | `@fragiola/data-grid-vue` | the `DataGrid.*` primitives (Vue 3 components, `typedDataGrid<TRow, TFeatures>()`) and composables over the core; `/local`: `useLocalRows`; each feature's subpath re-exports the core's (`/sorting`, `/navigation`, `/range`, `/clipboard`), `/row-selection` with `useSelectAll`, `/fill` with `useFillHandle`, `/editing` with `useCellEdit`, `/column-resize` with `useColumnResizer`, the other column features, and (Epic #151) `/row-expansion` with `RowDetail`, `/row-grouping` with `useGroupToggle`, `/row-reorder` with `useRowDragHandle`, `/spans`, `/summary-rows` with the summary components, their composables and `typedSummaryRows<TRow>()`, and (Epic #153) `/filtering`, `/search`, `/pagination` (the core's only) | peer `vue` (^3.5) |
| `packages/angular` | `@fragiola/data-grid-angular` | the primitives as Angular directives (`DATA_GRID`: `[dataGridRoot]`, `[dataGridRow]`, …) and injection functions (`inject<Hook>`) over the core; `/local`: `injectLocalRows`, `[dataGridLocalRows]`; each feature's secondary entry re-exports the core's with a root directive for its inputs: `/sorting` (`[dataGridSorting]`), `/navigation` (`[dataGridNavigation]`), `/row-selection` (`[dataGridRowSelection]`, `injectSelectAll`), `/range` (`[dataGridCellRange]`), `/clipboard` (`[dataGridClipboard]`), `/fill` (`[dataGridFill]`, `*dataGridFillHandle`, `injectFillHandle`), `/editing` (`[dataGridEditing]`, `*dataGridCellEdit`, `injectCellEdit`), the column features, and (Epic #151) `/row-expansion` (`[dataGridRowExpansion]`, `*dataGridRowDetail`, `injectRowDetail`), `/row-grouping` (`[dataGridRowGrouping]`, `*dataGridGroupToggle`, `injectGroupToggle`), `/row-reorder` (`[dataGridRowReorder]`: present, the rows move, `="false"` stops them; `[dataGridRowDragHandle]`, `injectRowDragHandle`), `/spans`, `/summary-rows` (`[dataGridSummaryRows]`, class `DataGridSummaryRowsRoot`; the summary directives in `SUMMARY_ROWS`, their inject functions), and (Epic #153) `/filtering` (`[dataGridFiltering]`), `/search` (`[dataGridSearch]`), `/pagination` (`[dataGridPagination]`) | peer `@angular/core` (^22) |
| `apps/playground` | private | the dev app (every site example live, with themes and source), unstyled fixture pages driven by Playwright | both packages, `examples/react`, `examples/shared` |

## Non-negotiable rules

Do not "fix" these. They are the decisions of Epic #1 (D1–D12).

1. **Names (D1).** `@fragiola/data-grid` (core), `@fragiola/data-grid-react`,
   `@fragiola/data-grid-vue` and `@fragiola/data-grid-angular`; the site's slug is `/data-grid`.
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
   declarative props, controlled (`activePosition` + `onActivePositionChange`, navigation's since
   Epic #144: a feature's props type only with it installed) or uncontrolled
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
   by the **same** Playwright spec, in Chromium, Firefox and WebKit (Epic #89), as is the examples
   suite.
6. **Data contract (D6).** `rows: TRow[]`, or `rowCount` + `getRow(index) => TRow | undefined`;
   `undefined` is "not loaded yet": the row keeps its space and renders with `data-loading`. The
   engine reports the row and column windows (visible and rendered ranges) and the end being
   reached. Fetching, caching and placeholders are **app policy**: they live in the examples
   (`_kit/`), never in a package. Either source may say what kind of row each index is
   (`getRowMeta(index) => RowMeta | undefined`, Epic #87, part of the source: `data.set` carries
   it): a group row, whose index the grid never reads a data row at, or a data row at a depth;
   still one generic, and `getRow` unchanged (see D10's row kinds).
7. **Sizes (D7).** `rowHeight: number | (index) => number | "auto"` (`RowHeight`; `"auto"`:
   measured, Epic #86, below); columns `width: number` (px), the
   width a column starts with and a reset gives back: with `columnResize()` installed (a feature
   since Epic #148) the model keeps a resized column's width over it (`columnWidths`, Epic #70).
   The effective width, within the column's limits, is the override (`columnWidths`: the
   feature's, through its `columnWidths` contribution point; none without it), else the engine's
   automatic width (`autoSize`), else its flex share (`flex`), else `width` (Epic #80). `width`,
   `flex`, `autoSize` and a resizable column's limits on its flex share and automatic width stay
   the core's: how a column's width is declared. **Measured heights (Epic #86, E2.2):** `rowHeight: "auto"`
   with `estimatedRowHeight` (default `DEFAULT_ROW_HEIGHT`) and `detailHeight: "auto"` with
   `estimatedDetailHeight` (default `DEFAULT_DETAIL_HEIGHT`): model state, options and
   `sizes.set` (an estimate is a size above 0: `sizes.set` refuses another with
   `invalid_payload`, an option leaves it out; `Root` sends `rowHeight` and `headerRowHeight`
   together when one changed, and each estimate in a command of its own, only when it changed,
   so a refused one never holds the others back; since Epic #151 `detailHeight` and
   `estimatedDetailHeight` are `rowExpansion()`'s props and options, `summaryRowHeight`
   `summaryRows()`'s, each sent in a `sizes.set` of its own when it changed: the fields stay the
   core's sizes, state and `sizes.set`). The engine
   measures: `measuring(state)` while either is
   `"auto"`, nothing otherwise (a grid of given heights reads, observes and allocates nothing
   more). A loaded measured row registers as the engine's `row` element (`EngineLayer`; React's
   `Row` through `useRowPart`'s `ref`, `useRow`'s props carry it), a detail as before (`detail`).
   Each element is read once, at the commit that first renders it (`heights.take`,
   `engine/heights.ts`, the engine's measuring: border-box
   height, `layoutScale` from the viewport as the fit; before the browser paints; not at the
   commit of a view already replaced, as when an automatic width changed meanwhile: the next
   commit reads), and from the
   next frame on a `ResizeObserver` from the viewport's `defaultView` (created then, and only
   while measuring: `observeLater`, one frame for all) tells its resizes (`heights`, a WeakMap
   per element, forgotten when an element unregisters or measuring stops; a pass allocates
   nothing while no height changed). Observing in the frame an element renders would report it again in the
   observers' delivery at the same depth, which a browser defers with an error; a resize
   reported lays out at once. A row's own height is its element's less its detail's; a row
   measured 0 (hidden) keeps its height. `MeasuredHeights` (`engine/measure.ts`) keeps them by
   index with the row's key (`rowKey` else index), in persistent sorted blocks (64 to 128
   heights, never changed once made) with the heights and counts before each block: a batch of m
   makes its few blocks and the block list again (O(m log k + m·B + k/B)), never the whole store;
   `keep(start, end, keyAt)` drops the ones whose row left its index (a new source: every index,
   or behind the same `getRow` from the old count; a `rows.changed` range: off screen too, so a
   row that moved off screen counts at the estimate until it renders), `clear()` when no longer
   `"auto"`. `axis(count, estimate)` is a `MeasuredAxis` over the version (O(1) to make, O(log k)
   a question, old versions valid: a view's axis keeps its offsets; `resized` is itself, one
   estimate for all, `withCount` O(1)), so 100M estimated rows allocate nothing per row. The row
   axis is `withDetails(measuredRows.axis(…), state, measuredDetails)` (`rowAxisFor`). A change
   relayouts once (`remeasured`), the view kept on the first row in view whose height did not
   just change (`measureAnchor`; none, the first row in view), as far from the view's top (M2's
   `anchoredOffset`, a row below the first one in view with a negative `within`), the offset
   clamped to the rows before any window is worked out, then `followRowAnchor`: a scroll up
   shows what it brought in at its measured height and what was in view stays where the scroll
   put it; under scaling too (the virtual offset is exact). The row of the last `scroll-to-cell`
   (`cellScroll`: its `rowIndex` and `align` only, never its column; kept until a scroll the
   engine did not make on either axis, more than a pixel, the wheel, or `scroll-to`, which the
   column drag's edge scroll uses) is scrolled to again after a change, so a key lands at the
   row's measured height. A row expanding or collapsing is read again. Nothing is measured per
   scroll frame: only elements rendered for the first time are read. The scrollbar is
   approximate until rows are measured (documented). React: a measured row (`measuredRow(view,
   loaded)`: `view.measuredRows` and loaded; a row not loaded keeps the estimate's height as
   before) has no height and `display: grid`; its cells share the area `1 / 1`, each at
   `cellBox`'s `left` as its inline start margin (`margin-left`, `margin-right` right to left),
   `position: relative` (a pinned one `sticky`; both drop a consumer's `transform` and insets, as
   a pinned cell), no height: as tall as the tallest (stretch); its
   detail is the area `2 / 1` (no `margin-top`). A measured detail (`view.measuredDetails`) has no
   height (in a row of pinned cells, a flex row of a given height, `align-self: flex-start`:
   stretched to the row's height, it would measure what the axis gave it). The CSS consequences are the app's: wrap the text (no `nowrap`), padding and borders
   count.
8. **Scroll scaling (D8).** When an axis is larger than a physical cap (configurable, safe in
   Chromium, Firefox and WebKit by default), the engine maps physical scroll to virtual offset.
   Small moves stay pixel-exact relative to the content, the scrollbar reaches the whole dataset,
   both axes alike.
9. **Scrolling does not render React (D9)** unless the rendered window changes. The engine writes
   the layers' offsets imperatively; React never reconciles what the engine writes. A commit reads
   the scroll as it is first (`syncScroll`), so a scroll whose event has not run yet (a scroll and
   a click in one task) never has the layers written against the scroll the engine last knew.
   A rendered range is kept while it covers what is in view. Through a scroll (any update but a
   relayout: no size changed) it is kept even when larger than the view needs (`windowFor`'s
   `scrolled`), so rows or columns of different sizes coming and going render nothing; a relayout
   (the sizes or the content changed: `update("trim")`, `"fresh"`) trims it (Epic #89, E5.3). React's tests count commits with
   `renderCounting` (`packages/react/tests/helpers.tsx`, a `Profiler`), one per feature in
   `render-counts.test.tsx`; the stress fixture counts them in the browser (`window.commits`).
10. **One generic: the row type (D10).** `Column<TRow>` is `{ key, name?, width, getValue?,
    renderHeaderCell?, renderCell?, renderSummaryCell?, renderGroupCell?, sortable?, pinned?, resizable?, minWidth?, maxWidth?,
    flex?, autoSize?, reorderable?, colSpan?, groupShow?, compare?, filter?, getCopyText?, editable?,
    renderEditCell?, meta? }`. Without children, a header cell renders
    `renderHeaderCell`, else the column's `name` (the app's own text, never translated or made
    up); a cell renders `renderCell` for a loaded row, else its value as text. No column helper,
    no `flexRender`; a column's options stay on `Column` (one generic), read only by the feature
    that uses them (`sortable`, `compare`: sorting). **Optional behaviour is a feature (Epic
    #141, revising D10's "no feature registry", maintainer's decision 2026-11-17):** the grid
    installs a fixed list of features at creation (`features`, below). **Column groups live in `columns` (Epic #13, G1):** an
    entry is a `Column` or a `ColumnGroup<TRow>` `{ key, name?, renderHeaderCell?, children,
    reorderable?, collapsible?, groupShow?, meta? }`, nested to any depth, keys unique across both; the leaves, in order, are the grid's
    columns (the column axis, cells and windows never see groups). The header has a row per level
    (rows `-depth … -1`, each `headerRowHeight` tall); a leaf with fewer groups above it spans the
    rows down to -1 (G2). The core lays the header cells out per column window (G3, a cut group
    included); a header cell's position is its first column on its row, a leaf spanning rows has
    one per row (G4); `aria-colspan`/`aria-rowspan` (G5). **Sorting (Epic #27, S1–S7; the first
    feature, Epic #141: `@fragiola/data-grid/sorting`, `src/sorting/`, everything below only with
    `sorting()` installed):** the model keeps `sortColumns` (`{ columnKey, direction: "ascending" | "descending" }[]`, the
    first one first; `sort-columns.set`, `sort-columns.toggle { columnKey, multi }`), controlled
    or not on `Root` like the active position (`sortColumns`/`defaultSortColumns`/
    `onSortColumnsChange`, one helper for both). A click, Enter or Space on a sortable column's
    header cell toggles it (ascending, descending, none; Ctrl/⌘ adds it); a control inside the
    cell (or a widget holding controls), a drag and a held key's repeats are not a sort. `aria-sort` on the first
    sorted column with a header cell of its own only (one a collapsed group hides or a header
    span covers still sorts, its priority kept); `data-sortable`, `data-sort`, `data-sort-priority`. The grid never orders
    the rows: the app does. **Pinned columns (Epic #31, P1–P7; at the end, Epic #85, E1.1;
    pinning is `columnPinning()` since Epic #148, `/column-pinning`: which columns are pinned in
    effect and the strips' widths, the fit rule below, through its `pinnedColumns` contribution
    point, and `get("pinned-column-keys")`. The declared parts (validation, spans that never cross
    a part, moves within a part) stay the core's column model, and so do the layers, the insets
    and the windows between the strips, zeros without pinning: every column scrolls):**
    `pinned: "start"` on the leading columns, `pinned: "end"` on the trailing ones (`PinnedSide`;
    `columnsError` refuses a start after a column not pinned at the start, a column after one
    pinned at the end, and a group mixing parts). They are always rendered (the start part first
    in `view.columns` and each header row, the end part last; `view.pinnedEndColumnCount`,
    `pinnedEndWidth`); the column window covers the view between them; scrolling a cell into
    view leaves it between them. A pinned cell (`data-pinned="start" | "end"`,
    `data-pinned-edge` on the last pinned at the start and the first pinned at the end; part
    state `pinned`, `pinnedSide`, `pinnedEdge`) is `position: sticky` in its row's flow, the end
    part after the start part, before the cells that scroll, and the row (header rows too) is
    `display: flex`, only while there are pinned columns (Epic #38). It registers as the
    engine's `pinned` element: the engine writes its inline start inset (`left`, `right` in
    RTL), `offsetOf(column) − layerX` (the layers' x, `scrollLeft − virtualX + columnBase`), plus
    for the end part `pinnedEndShift` (`min(viewWidth, total) − total`: the view's end, or where
    the columns end in a narrower grid), only when `layerX`, the columns, the view's width or the
    direction change (unscaled: a new view or a resize, never a scroll frame; scaled: with the
    engine's own moves, in the same task), so no painted frame lags the scroll; React renders no
    inset for it. Rows and header rows start at `rowLeft` (−both parts' widths − the rendered
    columns' width) and, with an end part, reach past the last rendered column by its width and
    the rendered columns' width again (`renderedWidth`; with no column that scrolls, from where
    they would start), so their box holds the pinned cells and sticky keeps them in place through
    a scroll not rendered yet, both ways. Stacking is the
    consumer's; pinned cells are their row's own children, and an `overflow` other than
    `visible`/`clip` on a row or a layer, or a row's padding or flex direction, breaks them.
    Pinned columns as wide as the view (both parts together) scroll with the rest until it is
    wider. A column reorders only within its part; flex and fit work in either part; a column
    pinned at the end resizes from its start edge (its boundary with the columns that scroll:
    dragged, or its arrow, toward the start grows it; `useColumnResizer`'s `state.edge`
    `"start"`, else `"end"`: where the app places the handle; `resizeEdge`, the engine's drag and
    keys reading it too). The parts are a few helpers in `header.ts`, everywhere: the first column
    pinned at the end `pinnedEndFrom(columnCount, pinnedEndCount)` (a view's `endPartFrom`, the
    engine's `endFrom()`), the declared parts `pinnedPartsOf(columns)`, a column's part
    `columnPart(columnIndex, startCount, endFrom)` and its part's bounds `partStart`/`partEnd`.
    **Direction (Epic #85, E1.1):** the model keeps the direction given (`GridDirection`, or
    `undefined`: the page's; option, `get("direction")`, `direction.set { direction }`, `null`
    gives it back), `Root` takes it as a prop (a prop removed gives it back). The given one is the
    view's `givenDirection`, which `Root` renders as its `dir` (on the server and before attach
    too; none without one): the engine never writes or removes `dir`. The engine's direction in
    effect (`view.direction`) is the given one, else the viewport's computed `direction` (its
    window's `getComputedStyle`, read on attach and when a given direction is taken back; never
    per command, frame or resize: a page direction changed later is picked up at the next attach,
    or through the prop): a grid under `<html dir="rtl">` needs no prop, and LTR markup without
    one has no `dir`. A direction given or taken back is taken at the commit of the render that
    renders (or removes) its `dir` (`directionPending`; the page's read then), and applies before
    anything is written for it (`updateDirection` at the top of `relayout`). Right to left, the start is the right edge: everything stays inline
    offsets from the start (indexes, windows, `scroll-position`, the axes, scroll scaling, ARIA
    unchanged) and the mirroring lives where the grid meets the DOM, in a few helpers: the engine
    reads and sets `scrollLeft` through `inlineSign` (geometry, beside `inlineStart`; negative
    `scrollLeft`, every current browser's), translates the layers by `−x`, writes the insets on
    `inlineStart(direction)` (`right`; the side is part of what they were written for, the other
    one cleared on a change), reads a pointer's x from the view's right edge (`viewXOf`), mirrors
    a resize (drag and keys: `resizeSign`) and the wheel's x under scaling, and swaps the arrows
    (`inlineKey`: ArrowLeft is the next column; on a reorderable header cell Ctrl/⌘+Shift+←
    moves after the next sibling). The parts place by `inlineStart(view.direction)` (`inlineSide`
    in React, a key written straight into the style object: `right` instead of `left`, a detail's
    `marginRight`), and the rows' flex lays pinned cells out from the right on its own (the
    viewport's direction). A direction change keeps the view as far from the start, the insets and the
    transforms written again on the new side. The app's styles mirror with logical sides.
    **Column spans (Epic #85, E1.2):** `colSpan?: (args: ColSpanArgs<TRow>) => number | undefined`
    on a column (never a group), `args` `{ type: "header", rowIndex: -1 } | { type: "row", row,
    rowIndex } | { type: "summary", position, summaryIndex, rowIndex }` (Epic #86: an app narrows
    a row's by `type === "row"`, never by "not a header"). A cell covers the columns after it within its
    part and the columns (one clamp, `keptSpan`, the header's and the body's); a row's cells
    partition each part from its start (a covered column is never asked, nor, in `rowSpansOf`,
    one between the rendered columns and the next part: `spanPartStart`); a row not loaded spans
    nothing. Header spans are laid out with the header
    (`layoutColumns`, over sibling leaves only): `columnSpan` and `cellAt` carry them, a covered
    leaf keeps a one-column cell in `cellByKey` only; a spanning header cell's key resizes and fits
    its whole span, as a group's. Body spans depend on the row: `spanAt(state, rowIndex,
    columnIndex)` and the view's `rowSpansOf` share one walk (`cellCovering`, `model/spans.ts`) over
    the columns with a `colSpan` only, asked for the rendered rows only (`view.rowSpans`, `null`
    without one, a row without a span allocating nothing; `rowColumns`, `cellSpan`), never per
    scroll frame (D9); a span starting left of the window is rendered, and an active span reaching
    into it needs no extra column. The spanning cell is as wide as its columns, `aria-colspan`
    (`colSpan` as a `td`; a render function reads its props' `aria-colspan`), active on any of
    them (`activeInCell`, the `cell-active` question's and a cell part's); an arrow into a covered column lands on it and
    leaves from its edge (`cellSpanAt` bound); the model snaps the active position to its first
    column (`active-position.*`, `reconcile`, a new order, `rows.changed` holding the active row),
    `is("cell-active")` holds on any of its columns, and `elementPosition` finds its element (the
    model's snap and it share `coveringCell`). A fit
    never measures a spanning cell; a header span reorders with the columns it covers, a covered
    column cannot move.
    **Collapsible groups and sticky labels (Epic #85, E1.3; collapsing is `columnGroupCollapse()`
    since Epic #148, `/column-group-collapse`: the groups, their `groupShow` layout and the sticky
    labels stay the core's, a collapsible group laid out expanded without the feature; the keys,
    commands, `group-collapsed`, the header cell's `collapsed`, the root props and
    `columnAnchored` are the feature's):** `collapsible: true` on a group;
    its children `groupShow?: GroupShow` (`"expanded" | "collapsed"`, unset: both; `columnsError`
    refuses `groupShow` outside a collapsible group's children, a collapsible group showing
    no child in either state, and `collapsible` on a column). The model keeps
    `collapsedGroupKeys`, a set (in the order collapsed; compared by membership, `sameKeys`, in
    the model and `Root`: the same keys reordered change nothing; a key that is no collapsible
    group is kept: it may come back, and only the keys of collapsible groups lay the columns out
    again: `collapsingKeys`), controlled or not on `Root` through
    the controlled factory (`collapsedGroupKeys`/`defaultCollapsedGroupKeys`/
    `onCollapsedGroupKeysChange`, a layout input followed and settled with the widths and the
    order); `column-groups.toggle { groupKey }` (`not_found` for no group, `refused` for one not
    collapsible; a group a collapsed one hides toggles too; `toggledKey`),
    `column-groups.set { groupKeys }`,
    `get("collapsed-group-keys")`, `is("group-collapsed", { groupKey })`. `layoutColumns` takes
    the collapsed keys and shows a collapsible group's children by its state after ordering each
    sibling list (a hidden entry keeps its place in `columnOrder`); the depth counts every entry,
    so a toggle never changes the header's height (a column left with fewer groups above spans
    down, G2). A hidden column is no column: not in `state.columns`, the header, the axis, the
    windows, `aria-colcount` or the keys. By key it keeps its width (`columnWidths`), its place
    and its sort (sort validity reads every leaf: `entryByKey`, one walk for a column or a group
    at any depth; `sortableColumn` and `validSortColumns` take the entries); `aria-sort` is on
    the first sorted column with a header cell of its own, a hidden one keeping its
    `data-sort-priority`. `/local` reads
    every leaf, hidden ones included (`leafColumns`): a sort, a filter or a search on one is data.
    `withLayout` (`model.ts`) lays out a new order or new collapsed keys alike: the active cell
    follows its column or header cell by key (`followedColumn`), else `shownColumnOf`
    (`model/collapse.ts`): the nearest column the nearest group above it still shows, the
    start's side first, else that group's first column (its other state's); the engine keeps the
    view on its first column by key across a collapse, else on `shownColumnOf`'s
    (`collapseAnchor`). A header cell's part state `collapsed` (`boolean`, `undefined` for a cell
    that does not collapse), `data-collapsible`/`data-collapsed`; the view's
    `collapsedGroupKeys`. The toggle is the app's control in the group's header cell (a control
    of the cell: interaction, never a sort). Sticky labels: `useGroupLabel(cell)` returns
    `{ state: { groupKey }, props }` (the `label` layer's ref, `data-grid-group-label` = the key
    (`GROUP_LABEL_ATTRIBUTE`), `data-grid-part="group-label"`, `position: sticky`) for an element
    the app renders inside the header cell; the engine writes its inline start inset with the
    pinned cells' and details' (`writeInsets`: only when `layerX`, the columns, the view's width
    or the direction change; scaled, with the engine's own moves) as `pinnedWidth − layerX`, so
    the browser's sticky holds it at the start of the columns that scroll on every painted frame
    and the header cell's box (cut under scaling) keeps it inside its group; none in a pinned
    group. The label is narrower than its cell, and nothing between it and the cell clips (an
    `overflow` other than `visible`/`clip`).
    **Master-detail (Epic #41, M1–M4; `rowExpansion()`, `/row-expansion`, since Epic #151: its
    state, commands, keys, props and `RowDetail`; the core lays out the rows it names through
    `rowDetails`, their size and measuring the core's):** the model keeps `expandedRowKeys` (keys, `rowKey` else index; `expanded-rows.set { rowKeys }`,
    `expanded-rows.toggle { rowIndex } | { rowKey }`, `is("row-expanded", { rowIndex })`),
    controlled or not on `Root` like the sort (`expandedRowKeys`/`defaultExpandedRowKeys`/
    `onExpandedRowKeysChange`). A row is expanded when it is loaded and its key is expanded; the
    model derives `expandedRows` (indexes) looking for a key where it was last seen, then only in
    the rows the app names (a `rows.changed` range, rows added behind the same `getRow`, a new
    source), so nothing is scanned without expanded keys. `detailHeight: number | (row, rowIndex)
    => number | "auto"` (default 300; `"auto"` measured, D7) adds to an expanded row's size in the row axis (`withExtraSizes`, a
    sorted list over the base axis): no fake rows, indexes, windows and `getRow` unchanged; a row
    expanding above the view keeps the view where it is. `RowDetail` sits inside its
    `Row` after its cells, renders only while expanded, sticky (the engine's `detail` element,
    `left` = −layerX) with `margin-top` = the row's own height, as wide as the view; an expanded
    row is at least as wide as what holds it (`rowWidth`). ARIA: a detail is one `gridcell` of
    its row (`aria-colindex` 1, `aria-colspan` every column), so counts and row indexes never
    change. Keys: the arrows move between rows' cells and scroll by a row's own height; a detail
    has no `data-column-index`, so its keys and focus are its content's (a grid in it is its own).
    **Summary rows (Epic #86, E2.1; `summaryRows()`, `/summary-rows`, since Epic #151: its options,
    props, commands, `get` keys and the parts; the row bands, their counts in `state.summaryRows`
    (written by the feature, none without it), their layers and height are the core's):** one
    generic still: `Root`'s `summaryRows?: { top?, bottom? }`
    (counts; the model's `summaryRows: SummaryRowCounts`, option, `summary-rows.set { top?,
    bottom? }` (a count left out is 0, `invalid_payload` for one that is no whole number 0 or
    more), `get("summary-rows")`, a prop removed gives none) and `summaryRowHeight` (default
    `DEFAULT_ROW_HEIGHT`, `sizes.set`). The figures are the app's (no aggregates in the grid):
    live ones are rendered in the `SummaryCells` children function (app state read at render,
    the columns unchanged); a column's `renderSummaryCell({ position, summaryIndex, column,
    columnIndex })` is what a `SummaryCell` without children shows (nothing without it), and
    `summary-rows.changed` (like `rows.changed`; nothing without summary rows) bumps
    `summaryRevision` (state and view, `VIEW_KEYS`) so their cells and spans are drawn again for
    data behind the same columns. Their types are in `types.ts` (`SummaryPosition`,
    `SummaryRowCounts`, `SummaryRowView`, `SummaryCellRenderProps`, `SummaryColSpanArgs`); the
    naming guard scans every model module and allows `summaryIndex` (`<entity>Index`); the index
    scheme is `model/summary.ts` (`summaryRowIndex`, `summaryRowAt`, `summaryRowsOf`, one
    computation of where each position starts). Row indexes extend the grid's, the header's and
    the body's untouched: header rows `-depth … -1`, top summary rows `-(depth + top) … -(depth +
    1)` (the header's depth shown or not: `isHeaderRow` tells a header row from them), body rows
    `0 … rowCount - 1`, bottom summary rows `rowCount … rowCount + bottom - 1`
    (`get("summary-row-by", { rowIndex })`). An active summary row is followed as (position,
    summaryIndex) through every change of shape (`reconcile(state, before)`, `keptActiveRow`:
    `data.set`, `columns.set` and a new depth, `summary-rows.set`, `sizes.set`, a new layout): its
    index rebuilt, the last one left at its position, none left the nearest row on its side; a
    header row stays in the header, a body row past a shrunken `rowCount` lands on the last body
    row (never a summary row); a new model's position is for its rows (`withSource(…, false)`).
    The engine treats a summary row followed to a new index (the rows' count, the header's depth)
    as the same cell (`followedActive`, as a column moved by an order: `interaction.cellMoved`,
    no scroll, focus kept in its element: its interaction and its focused control stay).
    On screen and to the keys the rows go by **line** (`rowLine`/`lineRow` in `navigation.ts`,
    the identity without summary rows): header, top summary rows, body, bottom summary rows;
    `nextPosition` moves by line (`linesOf`, `isRowOf` and `keptRow` for the model's `isCell` and
    `reconcile`), a page stays in the body (from a bottom summary row PageDown stays, PageUp goes
    into the body), Ctrl+End reaches the last bottom summary row; `aria-rowindex` is the line +
    header rows + top + 1, `aria-rowcount` counts them. The engine takes their height from the
    body's (`bodyHeight`: the view less the header and `summaryHeight` of both positions:
    windows, pages, scaling follow), never renders an active summary row as a body row, scrolls
    only to its column, measures their cells in a fit (span 1) and gives them no selection keys.
    Spans: `rowSpanArgs` asks `type: "summary"`, `view.rowSpans` holds the summary rows' too
    (`rowColumns`, `cellSpan`), the active cell snaps as in a body row (`coveringCell`). React:
    `Summary position` (from `/summary-rows`; a `rowgroup`, `data-summary`, sticky in the grid's flow, pure CSS
    so it is placed before the first measure and a resize renders nothing: the top one after
    `Header` at `top: headerHeight`, the bottom one last, after `Body` and `Empty`, at `top:
    calc(100% - its height)`: a sticky inset's percentage is the scroll container's height, so it
    sticks at the view's bottom edge, and the grid's end (its containing block) keeps it right
    after the last row; nothing while none; a `tbody`/`tfoot`; a border at the top of a summary
    row pushes its cells, placed from the row's inner edge, past that edge: draw the line
    otherwise),
    `SummaryRows` (children function, the `Summary` around's position or its own),
    `SummaryRow` (a `header` layer element: moved with the columns only; `rowStyle`; `data-summary`,
    `data-row-index`, `data-active`), `SummaryCells`, `SummaryCell` (a body cell's part and element,
    shared with `Cell`: `summaryCellPart` through `cellPartProps`/`cellBox` with the summary row's
    height, `useCellElement`: roving tab stop, pinned, spans, interaction;
    `data-grid-part="summary-cell"`, `data-summary`); `Body` starts below the top ones and `Grid`
    holds them all. Hooks `useSummaryRows`, `useSummaryRow`, `useSummaryCells` (the body cells'
    span-aware walk, `cellsOf` in `utils/cells-of.ts`, shared with `useCells`), `useSummaryCell`;
    `SummaryContext`/`SummaryRowContext` reset by `Root` for nested grids. Their layer is the
    grid's (a structural `z-index`, below the header's, Epic #89, E5.2); their background is the
    app's, as the header's. **Rows in memory (Epic #47, L1–L7):** an opt-in entry point per package, never imported by
    the main ones (their built files must not contain it), and since Epic #153 the in-memory
    derivation over the features' state: the sort, the column filters, the search text and the page
    are model state, each its feature's (`sorting()`, `filtering()`, `search()`, `pagination()`),
    and `/local` applies the state of those installed. `@fragiola/data-grid/local` holds the
    framework-free pipeline (`createLocalRows` keeps the sort, filters, search and page, its
    `stages` option, `localStagesOf(features)`, the stages it runs: every one without it;
    `derive(rows, columns)` filters, searches, sorts and pages in that order, each stage
    computed again only when its own inputs change, a stage left out skipped; `sortRows`,
    `filterRows`, `searchRows`, `pageRows`), `@fragiola/data-grid-react/local` holds
    `useLocalRows(rows, columns, options)`, whose `features` option (the root's list, read once;
    none without it) says which stages run, and which return `props` to spread onto `Root`
    (`rows`, and for each feature given its state and a stable handler: `sortColumns`,
    `columnFilters`, `searchText`, `pageIndex`/`pageSize` (`null`: none)/`totalRowCount`, the rows
    paged; grouped, with `rowGrouping()`, `expandedGroupKeys`; `LocalRowsProps<TRow, TFeatures>`
    types them by the features) and `sort`/`filter`/`page` for the app's controls (and
    `moveRow(move)`, Epic #86: a row move applied to the rows given; stable, the latest rows and
    `rowIndexes` written to a ref in a layout effect, moves before a render applied one after the
    other). The pipeline stays the controlling parent of that state (the hook runs before the
    root's model exists): the root's model holds it as controlled props, `model.get` reads it, a
    command run on the model is asked of the hook through its handler, one pipeline update per
    action (a filter and the first page together). `/local` never imports a feature (the entry
    tests, and the bundle guard over every `/local` entry): it reads their names
    (`localStagesOf`) and hands their props. Values
    compare by type (`Intl.Collator`, numeric, base), empty ones last; `Column.compare` and
    `Column.filter` override; a text filter contains (case and accents aside), a list holds,
    anything else equals. A filter, the search or the sort changing goes to the first page (the
    pipeline's rule: the model's pieces never move each other, a server app does it itself).
   **Row kinds and grouping (Epic #87, E3.1–E3.2):** one generic still (the epic's stop
   condition never met). A source's optional `getRowMeta` (`RowSource`, `RowMetaGetter`; option,
   `data.set`: by index, it belongs to the source it comes with, so a payload without it has none,
   unlike `rowKey` (a function of the row, kept when left out); `Root` passes it every time;
   `sourceMatches` compares it) answers a `RowMeta` `{ depth?,
   group?, expandable?, parentIndex?, setSize?, posInSet? }` per index, asked only for the
   source's rows (`rowMetaAt`, bounded by `rowCountOf`), `undefined` a data row at the top. A
   **group row** carries `group: GroupRow` (core type, `model/types.ts`: `{ key, columnKey, value,
   depth, childCount (data rows at every depth below), aggregates, rowKeys? }`): `rowAt` answers
   `undefined` there whatever the source holds (so every data-row reader, the key rule, details,
   spans by `type: "row"`, the selection's ranges, measured heights' `loadedRowKey`, see none),
   `groupAt`, `rowKeyAt` (a group row's key is its group's: `row-key-by`, `Rows`' React key,
   `takeRow`/`forgetMeasures`' measured key), `is("row-loaded")` true (nothing to wait for:
   `RowInfo.loaded`, no `data-loading`), `cell-value-by` and `CellInfo.value` `groupCellValue`
   (the group's value in its column, else `aggregates[column.key]`). A data row may expand
   (`expandable`, a tree's parent, #97) by its own key (`groupKeyAt`). Since Epic #151 the
   expansion is `rowGrouping()`'s (`/row-grouping`: its state, commands, keys, props, the toggle's
   click and keys, the tree's ARIA and the `treegrid` role); the row kinds stay the core's data
   contract. The model keeps
   `expandedGroupKeys` (a set of keys, `sameKeys`; group keys and expandable rows' keys; a key no
   row has is kept), controlled or not on `Root` through the controlled factory
   (`expandedGroupKeys`/`defaultExpandedGroupKeys`/`onExpandedGroupKeysChange`, prefix
   `row-groups.`, settled last): `row-groups.toggle { rowIndex } | { groupKey }` (`not_found` past
   the rows, `refused` for a row that does not expand), `row-groups.set { groupKeys }`,
   `get("expanded-group-keys")`, `get("row-meta-by", { rowIndex })`,
   `is("row-group-expanded", { rowIndex })` (`groupExpanded`: a `keySet` lookup). The grid never
   groups: the app's rows follow the keys. Selection: `selected-rows.toggle { rowIndex }` at a group
   row (multiple mode, `rowKeys` named: `groupSelectable`) selects its `rowKeys` or clears them all
   when every one is (`groupToggledKeys`, anchor kept by `keptAnchor`), with `extend` a range from
   the anchor (none: a toggle), and by index makes the group row the anchor (its group key, the
   state it gave; `validAnchor` reads `rowKeyAt`, `keptAnchor` a group anchor's state by
   `groupSelected`, `selection-anchor.set` takes a group row); `rowKeys` are kept as given (as `selected-rows.set`'s: the grid
   cannot ask `isRowSelectable` of a collapsed group's rows; the app lists the selectable ones);
   `is("row-selected")` on a group row is every one of its keys selected (`groupSelected`, cached
   per group and key list); a range and select-all take a collapsed group row's `rowKeys`
   (`keysOfRow`: its rows are not on the rows), an expanded one's rows as rows (a range never
   reaches past its ends); a data row not loaded still refuses it all. Group keys and data row
   keys share one key space and must never collide (`/local`'s group keys are JSON strings). A row's
   per-render paths read its meta once and pass it on (`rowMetaAt`, `dataRowAt`, `rowKeyOf`,
   `rowSelectedWith`/`rowSelectableWith`, `groupKeyAt`'s `meta` and `row`, `rowPart`'s and
   `groupTogglePart`'s `RowRead`): `rowPart` reads a data row only when the selection or its key
   needs it, and nothing is asked without `getRowMeta`; `useRows` reads the meta once, carries it
   (`RowInfo.meta`, `CellInfo.meta`) into `useRow` and `useGroupToggle`, and keys rows by the
   core's `rowKeyOf` (the engine's measured keys' rule). A fit measures group rows' cells
   (`rowLoaded`); `autoSize` waits for a loaded data row (group rows alone, all collapsed, would
   freeze it at their cells), then measures them with it. `expanded-rows.toggle` refuses a group row (no detail); `rowsMove` is false while
   the source has `getRowMeta` (grouped rows never move). Spans ask `{ type: "group", group,
   rowIndex }` (`GroupColSpanArgs`). `Column.renderGroupCell({ group, rowIndex, column,
   columnIndex, value })` is what a group row's `Cell` without children shows, else `value` as text;
   never `renderCell`. Parts: `RowState` gains `depth` (`undefined` without row kinds), `group`,
   `groupExpanded` (`undefined` for a row that does not expand); `RowPart.ariaTree`
   (`AriaTreeRow`: `aria-level` = depth + 1, `aria-expanded`, `aria-setsize`, `aria-posinset`,
   `undefined` without row kinds); `gridRole(view)` is `treegrid` with `getRowMeta`, else `grid`;
   `groupTogglePart` (`GroupToggleState { rowIndex, groupKey, expandable, expanded, depth }`,
   attributes `aria-expanded` and `GROUP_TOGGLE_ATTRIBUTE` = the row index, none for a row that does
   not expand); the engine's `click` runs `row-groups.toggle` for a marked toggle (a control of its
   cell, never a sort; before the modifiers' guard: Shift or Alt+click toggles too; row
   grouping's `click` since Epic #151). `view.expandedGroupKeys` (row grouping's view field). A grid without `getRowMeta` asks
   none, renders the same (no attribute, part fields `undefined`, `role="grid"`). React:
   `RowInfo.group`/`depth`, `CellInfo.group`, `data-group-row`, `data-group-expanded`, `data-depth`
   on rows, `useGroupToggle(row)`. `/local`: the grouping stage (`local/group.ts`: `groupTree`,
   `shownRowsOf`, `groupedRowsOf`, `groupKeysOf`; pure, `groupRows(rows, columns, grouping)`) after
   filter, search and sort, before the page:
   `derive(rows, columns, grouping?)` (`LocalGrouping { groupBy, aggregates?, rowKey?,
   expandedGroupKeys? }`; `groupBy` compared by its items, each stage memoised: expanding groups
   nothing again) groups by text value (an empty value one group), orders the groups by the sort
   when it sorts their column else ascending (`sortEntries` over their first rows: `compare`,
   empty last), keeps the rows' order inside, keys a group `groupKeyOf(path)` (JSON of `[columnKey,
   text]` pairs, exported) and its rows by `rowKey(row, index among the rows given)` else that
   index; pages the rows shown, group rows included (a parent on an earlier page: no
   `parentIndex`); the state keeps `expandedGroupKeys` (`setExpandedGroupKeys`,
   `defaultExpandedGroupKeys`); the view's `groups: GroupedRows | null` (`rowCount`, `getRow`,
   `getRowMeta`, `rowKey`, `groupKeys`). `useLocalRows` options `groupBy`, `aggregates`, `rowKey`, `isRowSelectable`
   (`(row) => boolean`, the row only so the root's works too: leaves refused rows out of
   `rowKeys` and `subRowKeysOf`; `LocalGrouping` too),
   `expandedGroupKeys`/`onExpandedGroupKeysChange` (controlled, else its own; the options read
   from a ref written in a layout effect); grouped, `props` are `rowCount`, `getRow`,
   `getRowMeta`, `rowKey`, `expandedGroupKeys`, a stable `onExpandedGroupKeysChange` and the sort,
   else as before plus the `rowKey` option when given (called with the row's index among the rows
   given, `rowIndexes`: the same keys grouped or not); `group` `{ by, expandedKeys,
   setExpandedKeys, expandAll, collapseAll }` for the app's controls. A server sends the same
   flattened shape (documented).
   **Tree data (Epic #87, E3.3):** the same row model: a tree's parent is a data row with
   `RowMeta.expandable` (its own key expands it, through `expandedGroupKeys`), its rows a level
   down (`depth`, `parentIndex`, `setSize`, `posInSet`). Keys: Space toggles any row that expands
   (`groupKeyAt`), Enter only a group row (a data row's Enter stays its cell's: controls, editing);
   →/← as for groups. Selection: a parent selects itself (a data row); its rows are the app's
   (`subRowKeysOf` + `useSelectAll`/`toggledRowKeys`). `/local`: `local/tree.ts` (`treeOf`,
   `keptTree`, `shownTreeOf`, `parentKeysOf`, `subtreeKeysOf`; pure `treeRows(rows, grouping)`),
   `LocalGrouping.getSubRows` (`groupBy` then not read): every row at every depth is an entry,
   its index its place in the tree read top to bottom (`getValue`'s `rowIndex`, the default key,
   one rule for every stage: `entryKeyOf` in `local/filter.ts`;
   give `rowKey` for keys stable across changes); filters and the search on every row, a match's
   ancestors kept (`filteredCount`/`filteredRows`: the kept rows at every depth, in the sorted
   tree's order, `treeEntriesOf`); the sort per sibling list; the page of the rows shown; `moveRow`
   a no-op; the tree read once per
   rows and `getSubRows`, kept per filter and sort, shown per expansion. `GroupedRows.groupKeys`
   (a tree's parents' keys) and `subRowKeysOf(index)` (a group's `rowKeys`, a parent's rows at
   every depth as kept, less the refused ones; cached per node, `subtreeKeysOf`'s WeakMap; the
   hook's `group.subRowKeysOf` changes only with the rows shown). `useLocalRows` option `getSubRows`, `group.subRowKeysOf`. A server's
   lazy children are an app pattern (the `tree-data` example's `lazy.ts`): not-loaded rows keep
   their place under an expanded parent with their meta (`data-loading`); a failed listing is
   forgotten, asked again when its folder opens again.
   **Row selection (Epic #57, R1–R9):** headless first: the core keeps only what ARIA, `data-*`
   and the keys need. A feature since Epic #144: `rowSelection()` (`/row-selection`; its props,
   keys and state exist only installed). Its state keeps `selectedRowKeys` (keys, `rowKey` else index, in the order
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
   selected (its `row`/`cell`/`grid` contributions). Its entry also has `selectionStatus`,
   `withRowKeys`, `withoutRowKeys`, `toggledRowKeys`, and `@fragiola/data-grid-react/row-selection`
   (`/selection` is gone, no alias) `useSelectAll(rowKeys, gridRef?)` → `{ status, count, toggle,
   canToggle }` (nothing selectable without the feature); `useLocalRows` returns `filteredRows`. The
   checkbox is always the app's.
   **Cell ranges and the clipboard (Epic #88, E4.1–E4.2):** headless first: the grid keeps one
   range, its keys, its pointer and the clipboard; its look, any figure worked out of it and the
   data are the app's. Features since Epic #144: `cellRange()` (`/range`, requires `navigation()`)
   and `clipboard()` (`/clipboard`, requires `cellRange()`): their props, keys and state exist only
   installed. The range's state keeps `cellSelection: CellSelection | undefined` (`"range"`;
   option, `cell-selection.set { cellSelection }`, `null` turns it off and the range goes,
   `get("cell-selection")`) and `selectedRange: CellRange | null` (`{ anchor, focus }`, two body
   cells: rows 0 … rowCount - 1 and the grid's columns, never the header nor the summary rows; a
   group row's cells are cells of it; the anchor where it started, the active cell, the focus the
   corner the keys and the pointer move), kept inside the body by its `stateChanged` (`keptRange`: each
   corner clamped to the last row and column; none without rows, columns or cell selection),
   cleared after a new order or collapse (its columns are others) and after any
   command that moves the active cell off its anchor (the same `stateChanged`, run after every
   command: a click, a Tab, a control taking focus, a plain key, the app's
   `active-position.set`; one model rule, so a controlled range is told by the cross-piece rule,
   never by a second command; a range the active cell did not start, select-all's, stays until
   it moves), and kept on its cells by key: `selectedRangeKeys` (`RangeKeys { anchor, focus }`,
   each a `CellKeys { rowKey, columnKey }`, the edit's type too, `cellKeysAt` in
   `model/source.ts`; `undefined` for a corner on a row not loaded, kept by index, its keys taken
   once it loads) are taken when the range is set; after new rows or columns (or `rows.changed`
   over a corner's row) other keys at a corner (a sort, rows inserted above, a column hidden)
   leave no range and the same ones keep it (rows growing at the end, a new `columns` array:
   `withRangeKeys`, `sameKnownKeys`); looked at only when the rows, the columns or the range
   change, never after an unrelated command, controlled or not on
   `Root` through the controlled factory (`selectedRange`/`defaultSelectedRange`/
   `onSelectedRangeChange`, prefix `selected-range.`, settled with the features in install order,
   the prop applied through `keptRange`). Commands, `refused` while cells are not selectable:
   `selected-range.set { anchor, focus }` (body cells, else `not_found`; the model's own copy; the
   same cells commit nothing), `selected-range.extend { rowIndex, columnIndex } | { direction,
   pageSize? }` (the focus to a body cell, or `nextPosition` from the focus over the body only:
   `bodyBoundsOf`, no header, no summary rows, spans kept; the anchor stays: without a range the
   active body cell, else the cell itself; a move with neither `refused`),
   `selected-range.select-all` (the first body cell to the last; `refused` without one),
   `selected-range.clear`; `get("selected-range")`, `is("cell-selected", { rowIndex,
   columnIndex })` (`isCellSelected`: a cell spanning columns while any of them is). The pure
   helpers are `model/range.ts` (`sameCellRange` and `keptRange` exported from `/range`, `isBodyCell`, `rangeBounds`, `keptRange`,
   `inRange` and `rangeEdgesOf`, which allocate nothing (the edges' 16 strings made once),
   `valueText`, `rangeText`, `pastedRange`, `selectedArea`: the range, else the active body cell,
   as its first and last cells, what a copy, a paste and a fill act on). The view carries `cellSelection` and
   `selectedRange` (the feature's `view` keys, not `GridView`'s: `view as GridView & …`; a new
   view per range change, never per scroll frame). Parts:
   `CellState.selected` (`boolean | undefined`: `undefined` while cells are not selectable and in
   a summary row, so a grid without it reads as before) and `rangeEdges` (`"top bottom start
   end"`, the ones it sits on in that order, logical; `undefined` inside the range or outside),
   `CellPart.ariaSelected` (`true`/`false` on a body cell while cells are selectable, ARIA's
   "selectable, not selected"; none otherwise, nor on a summary cell); React renders
   `data-selected-cell`, `data-range-edge` and `aria-selected` on cells and `aria-multiselectable`
   on the grid. A spanning cell is in the range while any of its columns is, on its start edge
   when it starts at or before it, its end edge when it reaches it. The keys are D11's
   (the range's `laterKeydown`). The pointer: a primary press on a body cell of this grid (`pressedBodyCellOf`: not a
   control inside it, a resizer or a row's drag handle; not a nested grid's; no Ctrl, ⌘ or Alt),
   after the consumer's `onPointerDown` (a prevented one vetoes), clears the range and is not
   prevented (it focuses the cell: the active cell, the anchor); with Shift, one
   `selected-range.extend` to the cell (`check` first: the drag's anchor), prevented (the active
   cell and focus stay; refused, no range and no drag); a touch's press drags nothing (it
   scrolls). Past `CLICK_SLOP` the press drags (`RangeDrag`, a `FeatureDrag`, on the shared
   `PointerDrag` machinery: `listen`, `capture` on the viewport, as the pressed cell may scroll
   out of the rendered ones, `askFrame`, `endDrag`): once a frame `cellDragStep` (shared with the fill's) reads the pointer's
   place once (`viewXOf`, `viewYOf`), scrolls both axes in one move near the body's edges and the
   scrolling columns' (or past them; never over a pinned strip, `columnPartAt`: a range among
   pinned columns scrolls nothing sideways; `edgeStep`, `edgeScrollBy(top, left)`, shared with
   the reorders), `cellAtView` takes the cell under it from the axes (the row
   axis over the body; `partOffsetAt(columnPartAt(x), x)`, the pinned strips or the columns that
   scroll, shared with the column reorder's `offsetAt`; scaling, measured rows and RTL alike),
   and `rangeTo` runs one `selected-range.set` when that cell changed; a scroll during the drag works it
   out again once a frame; the release takes the cell under it, Escape clears the range, cells
   no longer selectable or other keys at its anchor after new rows or columns end the drag (its
   indexes would point elsewhere: `keptAt` against the keys taken at the press; rows growing at
   the end, infinite scrolling, keep it); the click ending it is the drag's. The clipboard: `Root`
   hands its element's `copy` and `paste` events to `engine.adapter.copy`/`paste` after the
   consumer's `onCopy`/`onPaste` (a prevented one is the app's), taken only from one of this
   grid's cells itself (`isCellElement`: a field inside one keeps its own clipboard, a nested
   grid's cell is that grid's) while cells are selectable. WebKit fires `copy` only while
   something is selected, and a copy goes to the selection: Ctrl/⌘+C on one of the grid's cells,
   with something to copy, or Ctrl/⌘+V (Epic #89: Firefox fires a paste at the page's selection,
   not at the focused cell, whose text a press with `user-select: none` never selects; the letter
   read through `shortcutLetter`: the key's own, else its `code` on a non-Latin layout), selects a
   hidden node appended to the cell (`selectForClipboard`, `holdSelection` in `dom.ts`, through
   the viewport document's Selection, the keydown never prevented), unless, for a copy, text inside
   that cell is selected (its content, its editor: copied as it is); the copy takes the event from that
   node as from its cell and `endClipboardSelection` (at the copy or the paste) removes it and puts the selection back (else the
   next task does, through the view's `setTimeout`). A copy writes the range, else the
   active body cell, as TSV into `event.clipboardData` and is prevented: the page's own event, no
   permission (`rangeText`: a loaded row's cell through `Column.getCopyText(CellRenderProps)`,
   else `valueText` (a string, number, big integer or boolean as text, anything else empty;
   React's `plain` renders it, nothing for an empty one but a string); a group row's value as
   text; a row not loaded empty; a span's value at its first column in the range, the columns it
   covers there empty; each row's kind and data row read once and its spans walked once
   (`cellCovering`, as `rowSpansOf`); every cell read). A paste parses
   `text/plain` (`parseTsv`) and tells the engine's `range-paste` event (`RangePaste { range,
   values }`), prevented: from the range's first cell (`selectedArea`'s), else the active body cell,
   as many rows and columns as the values (each row padded to the longest), cut at the last row
   and column (`pastedRange`); no text, nothing. `Root` asks `onBeforeRangePaste(paste)` (`false`
   refuses) and then tells `onRangePaste(paste)` (named apart from the DOM's `onPaste`, which stays
   the root element's handler). The grid writes no data and selects nothing new. `parseTsv` and
   `toTsv` (`src/clipboard/clipboard.ts`, pure, exported): a tab between values, a line feed between rows, a
   value holding a tab, a line break or a double quote quoted (its quotes doubled); parsing reads
   LF, CRLF and CR lines, quoted values (what follows one before the tab kept; one never closed
   is text, its quote included, the tabs and line breaks splitting), drops one line break at the
   end, and makes no rows of empty text (`/clipboard` exports them; `valueText` stays in the main
   entry). A grid without `cellSelection` is unchanged:
   no attribute, part state `undefined`, the keys, presses and clipboard as before. Several ranges,
   selecting a column or a row by its header, and fill (#100) are not this one's.
   **Cell editing (Epic #88, E4.3):** the grid owns the edit (which cell, its keys, its draft, its
   end), the editors and the data are the app's (D6: a commit is an event). A feature since Epic
   #146: `editing()` (`/editing`, requires `navigation()`: the edited cell is the active one); its
   state (`editingCell`, `editingKeys`), commands, keys, engine block (`editing/feature.ts`) and
   root props (`editingCell`/`defaultEditingCell`/`onEditingCellChange`/`onCellEdit`, typed only
   with it). **Without it** no edit ever starts: Enter, F2, typing and a double click are not the
   grid's (they reach the interaction and the moves as on a column not editable),
   `editing-cell.*` is `not_found`, `engine.get("edit-draft")` is `undefined`, the engine's edit
   actions do nothing, `CellState.editing` is `undefined` and no cell part renders
   `renderEditCell`. `Column.editable` and `renderEditCell` stay on `Column` (one generic), read
   only by the feature. `Column.editable?:
   boolean | (row, rowIndex) => boolean` and `renderEditCell?(EditCellRenderProps)` (`{ row,
   rowIndex, column, columnIndex, value (the draft), initialValue, startKey, onChange, onCommit,
   onCancel, editorProps }`; a group has neither: its type's `never`s). `editing/editing.ts`: a cell can be
   edited (`editRefusal`, `isCellEditable`, `is("cell-editable")`) when it is a loaded data row's
   body cell whose column is editable for it: `not_found` past the grid, `refused` for a header or
   a summary row's cell, a group row's or a column not editable for it, `not_loaded` for a row not
   loaded yet; `hasEditable(columns)` (internal) keeps a grid without one from asking anything,
   its engine caching it per `state.columns` (`editsCells`). The model keeps `editingCell:
   EditingCell | null` (`{ rowIndex, columnIndex, startKey? }`, option, `get("editing-cell")`),
   always the active cell, and `editingKeys` (`CellKeys { rowKey, columnKey }`: the row's key,
   `rowKey` else its index, and the column's, taken when it starts, `cellKeysAt`, the range's
   rule too):
   `editing-cell.set` (snapped to a span's first column; `refused` for any cell but the active
   one) and `editing-cell.clear`; controlled or not on `Root` through the controlled factory
   (`editingCell`/`defaultEditingCell`/`onEditingCellChange`, prefix `editing-cell.`, its
   `FeatureRoot.controlled`, settled with the features' pieces). One rule after a handler (its
   `stateChanged`, `withEditingRules`, after every command and once at creation: an edit given to
   start with, without keys yet, takes the ones it finds: `withKeptEditing`), only when the
   source, the columns, the active cell or the edit changed, or `rows.changed` reached its row (the
   app's `editable` never asked after an unrelated command): the edit stays only while it is the
   active cell, can still be edited and has its keys at its place (another row there: a new order
   of the rows, a row inserted above; another column: `columns.set`; an edit given to start with
   takes the keys it finds); else no edit and no keys, nothing told. The draft is the engine's
   (`EditDraft { value, initialValue, editorProps }`, `engine.get("edit-draft")` and its event;
   the position and `startKey` are `editingCell`'s; `editorProps` (`EditorProps`) is
   `{ "data-grid-editor": "<engine>-<edit>" }`, the engine's name among the page's (a module
   counter) and the edit's, the same for the edit): made from the cell's value (`cell-value-by`)
   when the model's `editingKeys` change (`followEdit`, `draftFor`: its engine's `changed`, and
   once when its engine is made, for an edit given to start with, telling no one), replaced by
   `change-edit { value }`, dropped when the edit ends. Engine actions (its `actions`): `edit-cell` (refused, a cell that cannot be edited
   changes nothing; another edit open is committed first, told; then activate and
   `editing-cell.set`, its editor focused wherever focus is), `change-edit`, `commit-edit { value?
   }` (a value given replaces the draft first) and `cancel-edit`. A commit (`commitEdit`) emits
   `cell-edit` (`CellEdit { rowIndex, columnIndex, columnKey, value }`) only when the draft is not
   the value it started from (`Object.is`), the told value becoming it (an edit a controlled parent
   keeps open never tells it twice), then `endEdit`: the cell focused first (its editor's focus
   would fall to the page), with a move one `active-position.move` (focus following), which ends
   it by the model's rule, and `editing-cell.clear` only while it is still open (no move, an edge,
   a parent keeping the cell): a controlled parent is asked once per gesture. `Root`'s
   `onCellEdit(CellEditEvent<TRow>)` adds the row (`row-by`, its root's `events` given the model;
   none told for a row gone). Starting
   (`editStartKey`, its `startKeydown`: after `rowGroupKey`, before the interaction's Enter/F2): on a body cell in
   navigation that can be edited, Enter and F2 (once per press) or a printable key (one
   character, its `startKey`; a character typed with AltGr, Ctrl and Alt, or Option, Alt alone,
   too: `isAltCharacter`, Space aside, the one Alt path past the keydown's modifier guard, which
   reaches nothing else of the grid's; not with ⌘ or Ctrl alone, nor Shift+Space, nor
   Shift+Enter, nor a key of a composition: `isComposing`, `isComposing` or key code 229, which
   Safari's confirming Enter carries), each one `editing-cell.set`, prevented; a cell that cannot be edited lets them through (its controls'
   interaction, unchanged); a double click (`click`, `detail` 2) on such a cell, not on a control
   inside it (`pressedBodyCellOf`), edits it (its `click`). In an edit (its `guardKeydown`, after a
   drag's Escape and before the interaction's guard), every key from inside the edited cell
   (`partOfEdit`: the cell, or an element the app marks with this edit's `editorProps`,
   `EDITOR_ATTRIBUTE` = its name, for a portalled popover: another grid's or an earlier edit's is
   not it) is its editor's but Enter (commit, move down; Shift: up), Tab (commit, the next column;
   Shift: the previous one) and Escape (cancel), each after the consumer's handlers (a prevented
   one keeps the edit open) and never during a composition (`isComposing`); on
   the edited cell itself (its editor without focus: a parent keeping the edit), any other key
   focuses the editor first, and the page keys (and Space without an editor) are prevented:
   nothing scrolls natively. A press anywhere but the edit and the viewport itself (its
   scrollbars), heard on the document's capture phase while an edit is open (`onEditPress`),
   commits, staying where it is; focus in the edit then, once the press ends (its `pointerEnd`,
   `refocusAfterEdit`) focus left on the page's body or the viewport goes back to the active cell.
   Focus leaving for an element outside the edit commits too (its `focusout`; focus going nowhere
   is the press's). At the commit rendering an edit (`focusEditor`, its `rendered`, for the view that renders it),
   the edited cell's editor takes focus while focus is in the grid (started by `edit-cell`,
   wherever it is) unless the editor holds it already (its own, its marked popover):
   `editorControlsIn`, its own controls (a nested grid's are that grid's) but the grid's own
   (`isGridControl`: a group's toggle, a row's drag handle, a fill handle, a resizer), the ones
   inside an element marked `data-grid-editor` in the cell first; a cell where none takes it
   (an `editable` column without an editor) has its edit cancelled in the next task
   (`cancelWithoutEditor`, the view's `setTimeout`, cleared on detach), unless the same edit's
   editor took focus by then (an effect, a frame: focus in the cell's controls or its marked
   popover), so it never traps the keys. Focus in the edited cell never starts an interaction (its
   `focusin`). An edit
   starting ends a range's drag and an interaction; the range stays. The edited cell, the active
   one, stays rendered through any scroll. Parts: `CellState.editing` through its `cell`
   (`CellShare.editing`, `isHeldCell(held, cell)`: `engine/parts.ts`, the one comparison of a held
   cell, the interaction's too, `useCellEdit`'s and `edit-cell`'s); the view's `editingCell` (its
   `view` key; `EditingView`). React:
   `data-editing` on the cell; a `Cell` without children, edited, renders its column's
   `renderEditCell` through an `EditCell` of its own, the one component subscribing to the draft
   (a keystroke renders it alone), its props from the core's `cellEditOf` (the feature's
   `editCell` contribution: `null` without it); `useCellEdit(cell)` (`/editing`) gives the same
   props (else `null`) to an editor in a cell's children. Copy and paste in an editor are its field's (the clipboard is
   the grid's only from a cell itself). Validation, editors and what a value means are the
   app's; fill (#100) is not this one's.
   **Fill handle (Epic #88, E4.4):** the grid owns the handle's drag, its target and the event;
   the values are the app's (a fill is an event, the grid writes no data). A feature since Epic
   #144: `fillHandle()` (`/fill`, requires `cellRange()`). `Root`'s `onFill` (typed only with it)
   turns it on (its `engineOptions` give `fillable`, `view.fillable`; a grid without it is unchanged: no
   attribute, part state `undefined`, `engine.get("fill")` `undefined`). The handle is the app's
   element with `useFillHandle(cell)`'s (`/fill` in every adapter)
   props (`fillHandlePart`: visible in the one cell at `view.fillSource`'s last cell, a spanning
   cell when it reaches it, never while a cell is edited; `FillHandleState { visible, filling }`; attributes
   `FILL_HANDLE_ATTRIBUTE` (`data-grid-fill-handle`) = the row index, `data-grid-part="fill-handle"`,
   `data-filling`, an empty `style`; none elsewhere: render none; read without allocating, every
   cell asks, two constants for the hidden). A primary press on one (after the consumer's
   `onPointerDown`, a prevented one vetoes) is a drag at once, prevented (no focus, no text
   selection; never a range, an edit, a sort: `pressedBodyCellOf` passes it over, its click is the
   drag's), captured by the viewport (`FillHandleDrag`, a `FeatureDrag`, on the shared `PointerDrag` machinery, its
   `source` the view's `fillSource` when it started, the keys at its corners (`sourceKeys`) and
   its `anchor` the active cell then); `fillSource` (the feature's `view`, `FillView`), worked out once per change of
   the range, the active cell, the edit, the rows (`rows.changed` too) or the columns, never per
   cell nor per press: `selectedArea(state)` widened to the column spans it cuts on any of its
   rows (`spannedArea`, every row read once a pass), `null` while not fillable or editing; the
   handle and the fill read the same one. Once a frame `cellDragStep` edge-scrolls (the
   range's rule: the body's edges, the scrolling columns' edges, never over a pinned strip) and
   `fillTo` works the target out (`fillTargetOf`: below the source, as wide, to the pointer's
   row, or to its end, as tall, to the pointer's column, whichever the pointer went farther past,
   down on a tie; none over the source, above it or before it; up and to the start never fill),
   a new `fill` state only when it changed (`cellAtView` hands back the last cell when the
   pointer is over the same one: a frame allocates only when the cell changes). State: `engine.get("fill")` → `FillDrag { source,
   target | null }` (`null` without a drag; ranges as their first and last cells), the `fill`
   event, `view.fill` (its `view` too); `CellState.fillTarget` (`data-fill-target`). The release takes
   the cell under it and, with a target, emits `range-fill` (`RangeFill { source, target }`,
   `Root`'s `onFill`) once, then, cells selectable, the source and the target together (`fillRange`, from the
   press's source and anchor): anchored at the union's corner on the active cell's sides of the
   source (its bottom or end only when it was at the source's bottom or end and the fill went
   past it there; between the edges, in a span the source widened to, the first side), an
   `active-position.set` there first when that moves it (refused or snapped: no range), then one
   `selected-range.set`. Escape (after the app's handlers, anywhere), `pointercancel`, a lost
   capture or a move with no button tell nothing; other keys at its source's corners after new
   rows or columns (rows growing at the end keep it), another selected range or active cell (a
   key, the app) and an edit opening (`followEdit`) end it, telling nothing (`endDrag("lost")`),
   as `fillable` turning off does. The target is body cells
   (never the header nor a summary row); group rows, rows not loaded and cells not editable are in
   it: what a fill writes there is the app's rule. Its entry point, `@fragiola/data-grid/fill`
   (never imported by the main one: `tests/local/entry.test.ts`), also has
   `repeatedFill(fill, valueAt)` → `FilledCell { rowIndex, columnIndex, value }[]`, the source
   repeated over the target (row by row down, column by column across, starting again after its
   last), with `fillHandle()`, `fillTargetOf` and `fillHandlePart(Of)`. A series, undo and a
   keyboard fill (Ctrl+D) are the app's.
   **Column resizing (Epic #70, W1–W8; `columnResize()` since Epic #148, `/column-resize`: its
   state, commands, `get("column-widths")`, root props, the resizer's part and hook, the drag, the
   keys (`interactionKeydown`), the fit (`fit-columns`), the engine's `column-resize` key, view
   field and event, and the `autoWidths` middleware; `column-width-by` and the width math stay
   the core's):** the model keeps `columnWidths` (`{ [columnKey]: px }`,
   over each column's `width`; a key that is not a column is kept: it may come back),
   controlled or not on `Root` like the sort (`columnWidths`/`defaultColumnWidths`/
   `onColumnWidthsChange`); `column-widths.set { columnWidths }`, `.resize { columnKey, width }`,
   `.reset { columnKey? }`; `get("column-widths")`, `get("column-width-by", { columnKey })` (the
   override, else `width`, a group's its columns'; the width on screen is the view's column axis,
   Epic #80). `resizable: true` opts a column in; `minWidth`
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
   double click fits its column (or group) to its content (Epic #80, A4; it replaced #70's
   reset); a press, click or drag on it is never a sort (an
   element with `data-grid-column-resizer` is a control of its header cell; no ARIA role changes
   for grids without resizing). `data-resizable` on a resizable header cell (a group's when
   one of its columns is), `data-resizing` on the header cell and the handle during a drag.
   Persisting the widths is not the grid's.
   **Automatic widths (Epic #80, A1–A6):** headless first: the grid lays widths out against the
   view and measures its own rendered cells; which columns flex or fit, the buttons that fit and
   what a reset means are the app's. `flex?: number` on a column (refused on a group, like
   `autoSize`; `columnsError`): flex columns share the view's width minus every other column's
   effective width, in proportion to `flex`, each within `[max(width, minWidth), maxWidth]` when
   resizable, else `[width, ∞)` (limits are a resizable column's only), what
   one cannot take going to the others, limits settled as a flexbox does (`sharedWidths` in
   `model/widths.ts`, shared with a group's resize); nothing left, each is its `width` and the grid scrolls. The shares are the engine's
   (they depend on the view, D3), worked out again when the view's width, the columns, the order
   or the overrides change, and only while a column flexes (no measure, no recompute otherwise);
   the view keeps its first column across one (as a resize). Resizing a flex column (a drag, a
   key, a fit) writes an override: it stops flexing; `column-widths.reset` makes it flex again. A
   fit measures this grid's own rendered header cell of the column and its body cells of loaded
   rows (`ownerViewport`): each one's inline `width` set to `max-content` (important; a pinned
   cell's `flex-shrink` 0), every box read, every `style` attribute put back, in one task; the
   widest, rounded up, within a resizable column's limits (a group: each resizable column), in
   layout pixels (a transform above the viewport scaled back). Only rendered rows are
   measured (virtualization; a full-data width is the app's `column-widths.set`). Triggers: a
   double click on a resizer, Enter on a focused resizer (in interaction), the engine action
   `fit-columns { columnKeys? }` (no dot; without keys every rendered resizable column), each one
   `column-widths.set` with the other overrides as they are; a column fitted, dragged or keyed
   back to the width it has without an override (`unresizedWidth`: its share or automatic width
   as they are without it, else its own) keeps none. `autoSize?: boolean`: after the first commit
   rendering the column with loaded rows while the grid has a size, the engine measures it once
   per key per attach (measured 0, it keeps its width; unclamped when it does not resize) and keeps that width as engine state (`automatic`), never
   an override: not reported, not in `columnWidths`, a reset gives it back, with `flex` it is the
   base, a new `columns` keeps it for the same keys. `engine.get("column-auto-widths")` (and its
   event) is the automatic widths and flex shares in effect, by key; `column-width-by` stays the
   model's override-or-width; `column-widths.resize` takes an optional `autoWidths` the engine
   fills itself (a model middleware), so a resize starts from the width on screen. The parts read
   the width on screen from the view's column axis: `useColumnResizer`'s `state.width` and
   `aria-valuenow`, the header cells' and cells' boxes; the limits and `aria-valuemax` are the
   column's. Known: a flex column that does not resize, in a resizable group, cannot be moved by
   the group's handle (the group ends off the pointer): make it resizable or keep it out of the
   group. Fitting rows not rendered, canvas text measuring and `flex` on groups are not the
   grid's.
   **Column reordering (Epic #75, O1–O6; `columnReorder()` since Epic #148, `/column-reorder`:
   its state, commands, root props, `columnLayout` arrangement, header drag (a `FeatureDrag` on
   the shared machinery, `axis: "x"`), Ctrl/⌘+Shift+←/→ (its `keydown`), the engine's
   `column-reorder` key, view field and event; it reads the declared parts through the core's
   header helpers and the strips in effect through `EngineKit.pinned`, never pinning's code):**
   the model keeps `columnOrder` (keys of columns and
   groups, the order siblings take: in each sibling list, a group's children or the top level,
   the listed entries take the listed ones' places in its order, the others keep theirs; pinned
   and unpinned are ordered apart, so the pinned lead whatever it says; a key that is not an entry
   is kept: it may come back), controlled or not on `Root` like the widths (`columnOrder`/
   `defaultColumnOrder`/`onColumnOrderChange`; a prop listing a key twice, or a value that is not
   a key, is kept without it and the app told). `columnEntries` stays as declared; the model
   derives `columns` (leaves), the header layout, the axis and windows in the order. Commands,
   key-based: `column-order.set { columnOrder }` (keys, each once, else `invalid`),
   `column-order.move { columnKey, targetKey, side: "before" | "after" }` (an unknown key
   `not_found`; `refused` when the entry is not `reorderable`, the target is not its sibling, or
   it lands across the pinned columns' edge, judged by where it lands: a pinned entry before the
   first unpinned sibling, an unpinned one after the last pinned, are in their part; the target
   may be fixed; landing where it is
   commits nothing; it writes the whole sibling list where the first of it was listed),
   `column-order.reset`; `get("column-order")`. `reorderable: true` opts a column or a group in
   (default off); a group moves whole, its columns inside it by their own flag; never into
   another group. When the order changes, the active position follows its column or header cell
   by key (unrelated `columns.set` keeps the `reconcile` rules); the engine treats that as the
   same cell at a new index (compared by key), not another cell made active: no scroll, its
   interaction kept, focus to its element at the commit. The controlled cross-piece rule
   (`utils/controlled.ts`): an order moves the active cell with its column; uncontrolled, the
   moved piece is told at once; controlled, the moved value stands (its prop, unchanged, never
   pulls it back) and is told once: when the root settles (another piece's prop moved it) or at
   once (another piece's own commit, an uncontrolled order's drop); a prop that changes wins
   again. `Root` settles the pieces widths, order, collapsed groups, position, selection, sort,
   expansion. The
   engine drags a reorderable header cell: a primary press (after the consumer's
   `onPointerDown`, which vetoes with `preventDefault`), not on a control inside the cell nor a
   resizer, is not prevented: under `CLICK_SLOP` it stays a click (focus, a sort); past it the
   cell drags, holding the pointer; at most once per animation frame (the view's) the target is
   the allowed sibling under the pointer and the side of its middle, from the column axis and the
   header layout (not the DOM: off-screen and scaled siblings count), the pointer kept over the
   pinned strip or the columns that scroll; within 40 px of the scrolling columns' left or right
   edge (or past it; the zones at most half the scrolling width each) the engine's own scroll
   moves them up to 20 px a frame, none for a pinned cell, and none toward an edge its allowed
   siblings already end inside; any scroll during the drag (the wheel, the scrollbar) works the
   target out again from the pointer's last x, once a frame. The release runs one `column-order.move`; Escape (anywhere, after the app's handlers, a
   prevented one keeps the drag), `pointercancel`, a lost capture or a move with no button end it
   moving nothing; the click ending a drag is swallowed (never a sort); columns changing mid-drag
   keep it on its entry, gone or no longer reorderable ends it. Nothing moves during the drag
   (no render beyond the state change): `engine.get("column-reorder")` → `{ columnKey } &
   ({ targetKey, side } | { targetKey: null, side: null })` (null while a release would move
   nothing) or `null`, the `column-reorder` event, `view.columnReorder`; `data-reorderable`,
   `data-dragging` on the dragged header cell, `data-drop-target="before" | "after"` on the
   target; `useHeaderCell` reports `reorderable`, `dragging`, `dropTarget` (`engine/parts.ts`).
   The indicator, the cursor, `touch-action` and any announcement (a live region) are the
   app's; live reordering, pinning by drag, rows and touch gestures are not the grid's.
   **Row reordering (Epic #86, E2.3; `rowReorder()`, `/row-reorder`, since Epic #151: the drag, now
   a `FeatureDrag` on `axis: "y"`, its keys in `keydown`, the `row-move` event, `onRowMove`, the
   handle's part and `get("row-reorder")`; `buildView` keeps the feature's `heldRow`; its marker
   is `is("row-movable", { rowIndex })`: a loaded row of rows without kinds):** the grid never
   orders the rows (D6, the sorting rules),
   so a move is an **event**, never a command on rows: the engine's `row-move` event
   `RowMove { fromIndex, toIndex, rowKey }` (`toIndex` the index once moved: the rows without it,
   it inserted there; `landingIndex`, the columns' too), `Root`'s `onRowMove`, whose presence
   turns it on (the engine option `reorderableRows`, `view.reorderableRows`; a grid without it
   is unchanged: no attribute, part state `undefined`). The app moves its rows (`moveRow(rows,
   fromIndex, toIndex)` and `moveShownRow(rows, rowIndexes, …)`/`shownRowMove` in
   `@fragiola/data-grid/local`, the shown rows by their places among the rows given
   (`LocalRowsView.rowIndexes`, built when first read: equal rows told apart), `indexAfterMove`
   (`utils/utils.ts`, the engine's too); `useLocalRows`'s `moveRow(move)` placing it beside the row it
   lands next to on screen, filtered or paged). Measured heights are kept by index with their key:
   after a move, the shifted rows off screen count at the estimate until they render again
   (documented; the store is not remapped). Refused (`rowsMove(reorderableRows, rowsOrdered, source)`, parts: a feature's `rowsOrdered`): while sorted (the handle
   does not drag, the keys move nothing, documented: clear the sort), a row not loaded (no
   key: neither dragged nor a target), a drop beside itself (null target, nothing told). The
   handle is the app's element with `useRowDragHandle(row)`'s props (a row's or a cell's info;
   `RowDragHandlePart`: `aria-hidden` (a pointer's affordance: the keys move a row from its
   cells), `data-grid-row-drag-handle` = the row index (`ROW_DRAG_HANDLE_ATTRIBUTE`),
   `data-grid-part="row-drag-handle"`, `data-reorderable`, `data-dragging`, an empty `style`;
   `state` `{ rowIndex, reorderable, dragging }`); a plain element, not a control. The drag
   shares the column reorder's machinery (`PointerDrag` with both coordinates, `listen`,
   `capture`, `askFrame`, `endDrag`, `markedOf`, one frame step for both axes (`reorderStep`:
   the view coordinate read once, `edgeStep(at, start, length)` (`columnEdgeStep` for a header
   cell, its siblings' reach), `edgeScrollBy(top, left)` (one axis's step, the other 0; a range's
   drag both, Epic #88), which tells whether anything moved
   (none past the first or last row), the target, `askFrame`) and one target tail
   (`dropTargetOf`: the side of the item's middle, `landingIndex`, `keptIfSame`, so a target
   worked out again unchanged keeps its object)): a primary press on an own
   handle (after the consumer's `onPointerDown`, a prevented one vetoes; not prevented: under
   `CLICK_SLOP` a click, which focuses its cell), past it the row drags (the active cell left as
   it is: `buildView` keeps `rowReorder.rowIndex` in `view.rows`, as the active row, so the
   handle holding the pointer stays rendered through the edge scroll; selection and native drags
   blocked); once a frame the target is the row under the pointer's y (`viewY`, the one layout
   read, at the start, once a frame and on the release) kept over the
   body (`bodyTop`, `bodyHeight`), from the row axis (off screen, measured, variable, details,
   scaled alike), the side of its cells' middle (`cellsSizeOf`: over a detail, after); within
   40 px of the body's top or bottom edge (or past it) the rows scroll up to 20 px a frame
   (from the drag's start too); a scroll during the drag retargets once a frame. The dragged row
   counts as rendered (`rendersRows`, `viewChanged`'s details): a `rows.changed` covering it
   renders, and another key there ends the drag. After every
   model change, laid out (`followRowDrag`, after `relayout`: the offset clamped), the target is
   worked out again from the last `viewY` (no layout read) and, held in an edge zone, a frame is
   asked (rows appended come into reach). The release emits one `row-move`; Escape (after the
   app's handlers), `pointercancel`, a lost capture, a move with no button, rows no longer moving
   or its row gone from its index (by key) end it telling nothing; the click ending it is the
   drag's. State:
   `engine.get("row-reorder")` → `RowReorder` `{ rowIndex, rowKey } & ({ targetIndex, side } |
   { targetIndex: null, side: null })` or `null`, the `row-reorder` event, `view.rowReorder`;
   `RowState.dragging` (`boolean | undefined`) and `dropTarget` (`ReorderSide | null |
   undefined`), `undefined` while rows do not move (pre-existing `RowState` assertions hold),
   `data-dragging`/`data-drop-target` on the row. The active cell stays on its row by key, only
   with `rowKey` (an index key cannot tell rows apart: without one it stays at its index): a move
   remembers the active cell and its row's key (`movedRow`); at a new source or `rows.changed`
   that puts the moved key at `toIndex`, the active cell unchanged since, it goes to
   `indexAfterMove` of its row (the moved row to `toIndex`, a row between one place toward
   `fromIndex`) when its key is there, an `active-position.set` (queued after that change: no
   render in between), focus going with it. Kept through rows changing otherwise (a server
   answering in pieces); forgotten once followed, once the active cell changed (the person or the
   app moved it), at the next move and when the viewport detaches.
   The indicator, the cursor, `touch-action` and announcements are the app's; live moves,
   between grids, several rows and touch gestures are not the grid's.
11. **Navigation is a feature (D11, Epic #144).** `navigation()` (`/navigation`, `navigable`) maps
    arrows, Home/End, Ctrl+Home/End and PageUp/PageDown onto the active position (APG grid
    pattern, its `lastKeydown`), scrolls the target into view and moves focus with a roving
    tabindex (its `activate` and `move`: a click, a Tab, a control taking focus, an edit's Enter
    and Tab). Its keys are `active-position.*`, `get("active-position")`, `is("cell-active")`,
    `is("row-active")`; its props `activePosition`/`defaultActivePosition`/
    `onActivePositionChange` (the model option `activePosition`, settled with the layout
    inputs: `ControlledProp.first`). The active position stays core state (`null` forever
    without it), and so do its rules: kept or moved on shape changes, the cells that hold it
    (an edit, interaction, a nested grid's holder). **A grid without it is the APG table**:
    `role="table"`, `row`, `columnheader`, `cell`, no `tabIndex` on the grid nor on its cells
    (the props omit the key), no cell ever active, controls in cells keep their own tab order
    (the interactive cells' management below runs only with navigation), arrows do nothing, and
    the selections' `aria-selected`/`aria-multiselectable` (a grid's, not a table's) are left out
    (their `data-*` stay) (`apps/playground/e2e/bare.spec.ts`). Tab leaves the grid. Right to left
    (Epic #85), the arrows mirror (ArrowLeft moves to the next column, `inlineKey`); Home/End stay
    logical. With
    `rowSelection()` (its `laterKeydown`), on a body cell in navigation: Shift+Space toggles its row, Shift+Up/Down
    (multiple) move and select from the anchor (the starting row when there is none or it
    clears; additive), Ctrl/⌘+A selects every row (`isSelectAll`: its letter read through `shortcutLetter`, on a non-Latin layout too); at most one `selected-rows.*` command a key. **Interactive
    cells (Epic #52, I1–I5):** two modes, the engine's. Outside interaction the engine keeps the
    controls inside its own cells at `tabindex` -1 (a MutationObserver from the viewport's window,
    cells rendered later included; their own value kept; `data-grid-tab-stop` opts a control
    out; a nested grid's elements are that grid's), so the grid stays one tab stop. Enter or F2
    on a cell holding controls (Enter on a sortable header cell sorts: F2), or a control taking
    focus, hands the cell's keys to its controls: Tab and Shift+Tab cycle them, Escape (or focus
    leaving the cell) gives them back. The cell in interaction is always the active one
    (`engine.get("interaction")`, the `interaction` event, `view.interaction`,
    `interact-cell`/`leave-cell`); `data-interacting` on it. A column's resize handle (with
    `columnResize()`, its `interactionKeydown`, Epic #148) is a control of its header cell: in interaction (F2, Enter on a header that does not sort, Tab among its
    controls), on the focused handle ←/→ move it by 10 px (Shift: 50), the column growing the way it grows (`resizeSign`: right, left in RTL, toward the start pinned at the end), Home/End go to the minimum
    and the maximum (its `aria-valuemax`: without a `maxWidth`, the view's width), each one
    `column-widths.resize` after the consumer's handlers, and Enter fits its column to its
    content (one `column-widths.set`, Epic #80); the other page keys and Space do
    nothing there (no paging); Escape leaves interaction and keeps the width. On a reorderable
    header cell in navigation (with `columnReorder()`, its `keydown`, Epic #148),
    Ctrl/⌘+Shift+←/→ run one `column-order.move` before the previous
    sibling or after the next (handled at an end or at the pinned edge too, moving nothing),
    after the consumer's handlers; the active cell follows and focus stays on it; on a body cell
    or a fixed header cell they are plain arrows (Epic #75). While rows move (`onRowMove`, Epic
    #86, E2.3; `rowReorder()`'s `keydown` since Epic #151), Ctrl/⌘+Shift+↑/↓ on a body cell in navigation (`bodyCellOf`, the selection keys'
    guard too) emit one `row-move` by ∓1, once per press (a repeat moves nothing; handled at the
    first or last row, next to a row not loaded and while sorted too, moving nothing; RTL the
    same), after the consumer's handlers; with `rowKey` the active cell follows the row once the
    app moved it; without `onRowMove` they are plain arrows. With `cellRange()` and `cellSelection`
    (Epic #88, its `laterKeydown`, after the row move's keys; the row selection
    defers its Shift+↑/↓ and Ctrl/⌘+A to it while `get("cell-selection")` is set, so their
    install order does not matter): on a body cell in
    navigation, Shift with an arrow (`inlineKey`), Home, End, PageUp or PageDown
    (Ctrl/⌘+Shift+Home/End: the first and last cells) runs one `selected-range.extend { direction,
    pageSize }` (a refused one, `check`, does nothing), the active cell staying (the anchor), the
    asked focus scrolled into view; Ctrl/⌘+A on any of the grid's cells one
    `selected-range.select-all`, once per press; Escape with a range one `selected-range.clear`
    (and, Epic #113, a press outside the viewport while there is a range: `onRangePress`, a
    capture listener on the owner document only while a range exists, `followRange`; refusable
    by middleware, the active cell kept);
    a plain move to another cell leaves no range (the model's anchor rule, rule 10; one command:
    `active-position.move`). The page size of PageUp/PageDown is one helper (`pageSize`). With
    `editing()` and an editable column (Epic #88, E4.3; a feature since Epic #146): Enter, F2 or a printable key on a body cell in
    navigation that can be edited edit it (before the interaction's Enter and F2, which stay a
    cell's without an edit); in an edit, Enter commits and moves down (Shift: up), Tab commits and
    moves to the next column (Shift: the previous one), Escape cancels, and every other key is the
    editor's (rule 10). Escape with nothing else to end (a drag, an edit, controls, a range;
    Epic #113, `releaseFocus`, after every other key of the grid's) gives focus up, never
    prevented (a dialog around the grid still closes): the active position stays (the roving tab
    stop, Tab comes back to it); a nested grid hands focus to the outer cell holding it, else
    the target is blurred. While cells are selectable, Shift+↑/↓ and
    Ctrl/⌘+A are the cells' and Shift+Space stays the row's; Ctrl/⌘+C and Ctrl/⌘+V are the
    page's own copy and paste (never prevented on keydown; `clipboard()`'s `beforeKeydown` only
    holds a selection for them), which the grid takes (rule 10). A consumer can
    cancel or replace any key, and middleware can refuse or redirect a move. With row kinds (Epic
    #87, `rowGroupKey`, the APG treegrid, on a body cell in navigation, no modifier): Enter on a
    group row and Space on any row that expands (a tree's parent too) run one `row-groups.toggle`
    (once per press; before interaction, so a group cell's controls get the keys by F2); on a row's
    tree cell (`onTreeColumn`, asked only of a row that expands or has a `parentIndex`: the cell
    holding its `data-grid-group-toggle`, the engine's own cells; a row with none, the column
    this grid's toggles are in: one rendered, else `treeColumn`, the one they were last found in,
    reset with the columns, else the first; the app keeps them in one column) → (logical:
    `inlineKey`) on a collapsed row group expands it, ← on an expanded one collapses it, else ←
    goes to its `parentIndex` in the same column (`active-position.set`, focus following); any other arrow, or one with nothing to
    do, moves as usual. Shift+Space on a group row selects its rows. With summary rows
    (Epic #86) the keys move by line through the header, the top summary rows, the body and the
    bottom ones (see D10). ARIA: `role="grid"` (`treegrid` with row kinds; `table` without
    navigation, `gridPartOf`),
    `aria-rowcount`/`aria-colcount` are totals, `aria-rowindex`/`aria-colindex` 1-based.
12. **Versions (D12).** Exact versions published at least 7 days ago, checked against the registry
    (`npm view`) before pinning. **No virtualization library**: virtualization is the core's job.
13. **The core never touches global `document`/`window`** (nor `requestAnimationFrame`,
    `ResizeObserver`, …): DOM access goes through the root element's `ownerDocument`/`defaultView`,
    so the model loads in plain Node. **The core has zero runtime dependencies** and never imports
    `react`. A guard test enforces both. **Server rendering (Epic #89, E5.1):** a `Root` renders
    to a string in plain Node with no warning (React 19 no longer warns about layout effects on
    the server: no isomorphic wrapper is needed) and hydrates without a mismatch: before it
    attaches, the engine's view has no size, so the server and the client's first render hold the
    same shell (the parts, the ARIA counts and roles, `data-empty` and `Empty`, the given `dir`,
    structural styles) and no row or cell; the window renders at attach, before paint
    (`packages/react/tests/server.test.tsx` in Node, `hydration.test.tsx` in jsdom, both over
    `server-grids.tsx`: rows, groups, row groups, tree meta, summary rows, pinned columns, empty,
    RTL, cell ranges, as divs and as a table). A table's header rows and rows must be `tr`s down to
    the cells (the HTML parser moves a `div` out of a table). Docs: `guides/server-rendering`.
    **Touch (Epic #89, E5.1):** the drags read pointer events of any type: a touch drags a
    resizer, a reorderable header cell, a row's handle and the fill handle as a mouse does (their
    `touch-action` is the app's: `none` on handles, `pan-y` on reorderable header cells in the
    fixture and examples); a touch press on a body cell starts no range drag (the browser pans
    the body; the grid sets no `touch-action`). While a press is held (`listen`), `selectstart`
    and `dragstart` are prevented on the document, and for a touch `contextmenu` too: a long
    press selects no text and opens no menu, the page's own again at the release (a mouse's
    context menu, a macOS Ctrl+click's, stays the app's). A long press on a body cell, and
    `-webkit-touch-callout`, are the browser's and the app's CSS (`user-select` is not
    structural). The shared spec's `touch` block drives an emulated touch screen (`hasTouch`):
    `touchDrag` (`examples/shared/e2e/examples/helpers.ts`, the page's own touch pointer events,
    every engine), `page.touchscreen.tap`, and in Chromium a finger through CDP
    (`Input.dispatchTouchEvent`: touch-action and the native scroll). Docs: `guides/touch`.
    **WebKit (Epic #89):** fixes where it differs. Scrolling is whole pixels, as WebKit drops a
    fraction of `scrollTop` Chromium rounds (a measured row's edge left out of view), and the axis
    holds exactly what the engine writes (`viewport/scaling.ts`): the physical size and its end
    are rounded up (`createScrollMapping`); unscaled, the virtual offset is the physical scroll,
    whole (`maxVirtual` = `maxPhysical`, `ScrollAxisState.offsetFor`, `scrollTo`), scaled it
    stays exact and `toPhysical` rounds; the wheel's writes go through `scrollBy` on both axes,
    an unscaled one keeping a delta's fraction for the next (`remainder`, reset by a scroll the
    engine did not make). A scroll target's span start is rounded down and its end and maximum
    up (`scrollTargetForSpan`), a column's worked out in the scroll's own space (less the pinned
    width, fractional or not), and a move is compared with the clamped offset (`offsetFor`): a
    key at the end is no move. A field's
    default width is the browser's: the fixture sizes its own. Paste: Playwright's WebKit fires
    `paste` at a focused cell; Firefox fires it at the page's selection (`selectForClipboard`).
14. **App policy stays in the app.** The packages ship no fetching, caching, persistence or
    translations.

## Features (Epic #141)

A **minimal core plus opt-in features** (the ecosystem's pattern,
`../guidelines/architecture/features.md`; this repo is its reference): a feature the app does
not import is not in its bundle. Epics #144–#153 moved every other optional behaviour onto it:
the migration is complete, and new capabilities start as features. Nineteen are features:
`sorting()` (`/sorting`, Epic #141), and since Epic #144 `navigation()` (`/navigation`),
`rowSelection()` (`/row-selection`), `cellRange()` (`/range`, requires `navigation`),
`clipboard()` (`/clipboard`, requires `cellRange`) and `fillHandle()` (`/fill`, requires
`cellRange`), since Epic #146 `editing()` (`/editing`, requires `navigation`), and since Epic
#148 the column features: `columnResize()` (`/column-resize`), `columnReorder()`
(`/column-reorder`), `columnPinning()` (`/column-pinning`) and `columnGroupCollapse()`
(`/column-group-collapse`), and since Epic #151 the row features: `rowExpansion()`
(`/row-expansion`), `rowGrouping()` (`/row-grouping`), `rowReorder()` (`/row-reorder`),
`cellSpans()` (`/spans`: one feature for the body's column spans, a row's and a summary row's;
a header cell's span, a column's `colSpan` for `type: "header"` and a group's, stays the core's)
and `summaryRows()` (`/summary-rows`), and since Epic #153 `filtering()` (`/filtering`: the
column filters, `column-filters.set`/`column-filter.set`/`column-filters.clear`,
`get("column-filters")`/`get("column-filter-by")`/`is("column-filtered")`, `data-filtered` and
`HeaderCellState.filtered` on a filtered column's header cell, root props `columnFilters`/
`defaultColumnFilters`/`onColumnFiltersChange`; keys are leaf columns', a hidden one's too, empty
values never kept), `search()` (`/search`: `search.set`/`search.clear`, `get("search-text")`,
`is("searched")`, `searchText`/`defaultSearchText`/`onSearchTextChange`) and `pagination()`
(`/pagination`: `page.set`, `page-size.set`, `total-row-count.set`, `get("page-info")`,
`get("page-count")`, `is("page-previous")`/`is("page-next")`; `pageIndex`/`defaultPageIndex`/
`onPageIndexChange`, `pageSize` (`null` controls it as none)/`defaultPageSize`/
`onPageSizeChange`, and `totalRowCount`, a followed plain prop (`FeatureRoot.follow`): the rows
across every page, the grid's own row count without it; a page past the last is kept, the app
clamps it: a server's total may not be known yet). None of the three filters, searches or pages
rows (the app's, or `/local`'s), and none moves another's piece (the first page on a filter is
`/local`'s and the app's). The full list, factory, subpath and requirements: `navigation()`
`/navigation`; `sorting()` `/sorting`; `rowSelection()` `/row-selection`; `cellRange()` `/range`
(requires `navigation`); `clipboard()` `/clipboard` (requires `cellRange`); `fillHandle()`
`/fill` (requires `cellRange`); `editing()` `/editing` (requires `navigation`); `columnResize()`
`/column-resize`; `columnReorder()` `/column-reorder`; `columnPinning()` `/column-pinning`;
`columnGroupCollapse()` `/column-group-collapse`; `rowExpansion()` `/row-expansion`;
`rowGrouping()` `/row-grouping`; `rowReorder()` `/row-reorder`; `cellSpans()` `/spans`;
`summaryRows()` `/summary-rows`; `filtering()` `/filtering`; `search()` `/search`;
`pagination()` `/pagination`. The core keeps the column model (columns and groups as
declared, their header rows, spans and sticky labels, the declared pinned parts, `width`,
`flex`, `autoSize` and the limits on a resizable column's flex/auto width), the row model (the
data contract with `getRowMeta`: a group row renders as a row at its depth; the sizes and
measured heights, D7: `detailHeight`, `estimatedDetailHeight` and `summaryRowHeight` stay
`sizes.set` fields; the row axis with the details the features name on it; the row bands,
`state.summaryRows` counts, none without `summaryRows()`; the `detail` layer and its measuring)
and the layers (sticky insets, the windows between the strips: zeros without pinning).

- **The contract** (`src/feature/feature.ts`): a feature is a plain object a factory makes,
  exported from its own entry point (`sorting()` from `@fragiola/data-grid/sorting`; the
  factory camelCase, the subpath kebab-case), written with `defineFeature<Types>(spec)`. Its
  `FeatureTypes` (`state`, `options`, `commands`, `queries`, `questions`, `props`; `this["row"]`
  at a member's level is the grid's row type) type the grid; its spec contributes, each part
  optional: `name`, `requires` (other features by name), `initial(state, options)` (its state
  slice, flat in the model's immutable state), `commands` (handlers on the same bus: same
  middleware, `CommandResult`, error codes; `done`/`fail`/`ok`/`veto`), `queries`/`questions`
  (`get`/`is` keys, `(state, payload)`), `sourceChanged(after, before)` (after `data.set`,
  `columns.set`, `rows.changed`: keep or drop what no longer exists), `stateChanged(after,
  before)` (after every command, after `sourceChanged`, and once at creation for the rows given:
  its state kept to the core's rules, a range left when the active cell leaves its anchor),
  `view` (the state keys an engine's view carries, or fields its engine holds, compared by
  identity), `rowsOrdered(state)` (rows in an order of the app's: rows do not move), `navigable`
  (the grid's roles and tab stop: D11), the parts' contributions `row(view, rowIndex, meta,
  share)` and `cell(view, cell, span, share)` (they fill a reused `RowShare`/`CellShare`:
  nothing allocated per row or cell), `grid(view)` (attributes: `aria-multiselectable`) and
  `headerCell(view, cell)` (part state fields and attributes, `data-*` and ARIA, merged in the
  features' order), `engine(context)` and `root`; since Epic #148 `columnLayout` (`{ changed(after,
  before), arrangement(state) }`: its say in the columns' layout, `{ arrange?, collapsed? }`, each
  sibling list in its order and the collapsed groups; a `changed` state lays the columns out
  again, the active cell following its column: `relaidOut`, `model/layout.ts`'s
  `followedColumn`), `columnWidths(state)` (overrides over the declared sizing: resizing's; the
  first feature having it) and `pinnedColumns(columns, columnAxis, viewportWidth)` (the
  `PinnedColumns` in effect, `{ startCount, startWidth, endCount, endWidth }`: pinning's; none
  without it); since Epic #151 `rowDetails(state)` (the rows showing a detail, ascending, the same
  list while they stay: row expansion's; `detailRowsOf(features, state)`, `NO_DETAILS` without,
  so the axis is the rows' own and allocates nothing more), `cellSpans` (a `CellSpans` reader,
  `{ hasSpans, spanAt, rowArgs, covering, partStart, rowSpans }`: the model stores it on
  `state.cellSpans` at creation, so pure state reads (the bounds, the active position's snap, a
  view's `rowSpans`, the navigation's `cell-active`, the range's and the clipboard's walks) ask
  `spansOf(state)`, `null` without it or without a spanning column) and `tree` (the rows are a
  tree: with navigation and row kinds, `role="treegrid"`: row grouping's). The core asks these
  points, never a feature's state. The part state fields a feature fills stay
  declared, optional, on the core's part types (`HeaderCellState.sortable`, `CellState.selected`,
  …: `undefined` without it): a type costs no bytes. `RowShare` (the row part's share) has
  `selected`, `ariaSelected`, and since Epic #151 `groupExpanded`, `ariaTree` (row grouping's)
  and `dragging`, `dropTarget` (row reorder's).
- **In an engine** (`FeatureEngine`, made once per engine; `context`: the typed `model`,
  `headerCellOf` and `engine: EngineKit`, the engine's own means read at the event: its DOM
  questions (`cellOf`, `bodyCellOf`, `pressedBodyCellOf`, `cellElement`, `inViewport`,
  `markedOf`), scroll (`scrollToCell`, `pageSize`, `visibleColumns`), focus (`followFocus`,
  `focusFirstVisibleCell`), `emit`, `refresh`, the drags (`press`, `capture`, `askFrame`,
  `endDrag`, `stopDrag`, `drag`, `cellDragStep`, `cellUnder`), since Epic #146 `activate`
  and `move` (the navigation's, through the engine) and `leaveInteraction`, and since Epic #148
  the columns' layout (`columnAxis`, `viewportWidth`, `pinned`, `scrollLeft`, `viewX`,
  `columnOffsetAt`, `columnEdgeStep`, `edgeScroll`, `committed`, `measureColumns`,
  `autoWidths(overrides?)`), and since Epic #151 the rows' (`rowAxis`, `viewY`, `rowOffsetAt`,
  `rowEdgeStep`, `rowsOrdered`)). The keys go one
  chain, each hook walked in install order, `true` taking the key: `beforeKeydown` (never takes:
  the clipboard) → a drag's Escape → `guardKeydown` (an element a feature holds: an edit's
  editor and cell; `true` takes, `false` ends the chain untaken, `undefined` lets it through) →
  the guards (a control's `ownsKeysOf`, Alt: a character typed with Alt walks `startKeydown`
  only; inside it, after the interaction's Escape and Tab on a cell's control,
  `interactionKeydown`: a resizer's keys, Epic #148) → `keydown` (sorting, a column's move:
  reordering's Ctrl/⌘+Shift+←/→; since Epic #151 a row group's keys and a row's move,
  Ctrl/⌘+Shift+↑/↓, on body cells: the chain's row-group and row-move slots are gone) →
  `startKeydown` (an edit's start) → the interaction's Enter/F2 → `laterKeydown` (the range's, the row selection's: it defers Shift+↑/↓ and Ctrl/⌘+A to the
  range while `get("cell-selection")` is set) → Escape's release → the scaled Space →
  `lastKeydown` (navigation's arrows). Also `click` (a group toggle's, row grouping's),
  `pointerdown` (a resizer's, a fill handle's, a body cell's range (it leaves a row's handle to
  it), a reorderable header cell's, a row handle's (row reorder's, which leaves a fill handle
  inside it to the fill): disjoint targets), `copy`, `paste`, `changed(before, after)` (run before
  the engine's own follow, so the view built for the change shows the feature's fields),
  `followed(before, after)` (after it, the engine laid out: a drag whose cells are gone ends),
  `attach(viewport) => detach`, `optionsChanged`, and since Epic #146 `pointerEnd` (a press's
  end, before a drag's), `focusout` (before the engine's own), `focusin(cell)` (`true`: focus the
  feature holds, never an interaction), `rendered(view)` (the adapter's commit, focus moved) and
  `actions` (`engine.run` actions: editing's `edit-cell`, `change-edit`, `commit-edit`,
  `cancel-edit`; a clash throws, an action no feature has does nothing),
  `view()` (its engine-held view fields), `queries` (`engine.get` keys: `fill`, `edit-draft`,
  `column-resize`, `column-reorder`, `row-reorder`; `fit-columns` is resizing's action), since Epic #148
  `columnsFollowed(before, after)` (the columns laid out again for a change, a new axis or header,
  before the view is built: a column's drag follows its column, its view field set, not
  refreshed; told in `followed`), `columnAnchored(before, after)` (a relayout of the same entries
  keeps the view on its first column by key: collapse's) and `destroy` (resizing's middleware
  goes), since Epic #151 `heldRow()` (a body row it keeps rendered out of the rendered rows: a
  row's drag; the first not `null`, `view.heldRow`), and navigation's
  `activate(position)` and `move(direction)` (without them no cell is ever active and an edit's
  Enter/Tab move nothing). A feature's `editCell(view, cell, draft, engine)` (editing's) gives an
  edited cell's editor props, which the adapters' cell parts read through the core's
  `cellEditOf`. A feature's drag is a `FeatureDrag` (`kind: "feature"`, `start?`,
  `step`, `end(how)`, since Epic #148 `axis?` (`"x"`, `"y"`: the pointer moves it follows),
  `fixed?` (a scroll asks no frame of it: a resize) and `click?` (the click ending it: a
  resizer's double click fits)) on the shared `PointerDrag` machinery (`engine/drag.ts`): one drag
  at a time, whoever owns it; a column's resize and move and, since Epic #151, a row's move are
  feature drags (`Drag = FeatureDrag`: the engine has no drag of its own).
- **The registry** (`src/feature/registry.ts`): `createDataGridModel({ features })` composes
  them once (`composeFeatures`: one function or list per contribution point, nothing allocated
  per cell; `undefined` when no feature contributes) and keeps them for its engines and root in
  a WeakMap (`featuresOf(model)`): the model's surface stays its verbs. A feature twice, a
  missing requirement (`feature "cellRange" requires feature "navigation": install it too`), or
  a command/key two contribute (or the core has) throws at creation. A command no installed
  feature has is `not_found` (`unknown_command` is gone), never a throw; `get`/`is` of such a key
  read `undefined`/`false`. Features read each other only through keys (typed by a type-only
  import of the other's types; `get("cell-selection")`), never by importing its code.
- **The root** (`FeatureRoot`): its props' names, the model options they give, its controlled
  pieces (`defineControlled`, the same `bindControlled`; `ControlledProp.first`: followed and
  settled before the data props, `"layout"` first of all (the widths, the order, the collapsed
  groups, Epic #148), `true` right after (the active position)), `follow` (plain props followed after the
  core's data props: `rowSelection`, `cellSelection`; the details' and the summary rows' sizes
  and counts, Epic #151), `engineOptions` (`fillable` while `onFill`, `reorderableRows` while
  `onRowMove`) and `events(engine, props, model)` (`onFill`, `onRangePaste`, `onCellEdit`,
  `onRowMove`). `bindGridRoot` takes
  `features` from the first props: fixed for the root's life, a later list (by its items) is
  told once with `console.warn` and not taken. Settle order: the layout inputs (`first:
  "layout"`) and the active position (`first: true`), then the features' other pieces in install
  order (the edit's since Epic #146, the expanded rows' and the row groups' since Epic #151;
  only the order of `on…Change` calls in one commit can differ from before Epics #144, #146,
  #148 and #151).
  `GRID_ROOT_PROPS` lists only the core's; `withoutRootProps(props, features)` leaves the
  installed features' props off the element too.
- **Typed keys**: `DataGridModel<TRow, TNode, TFeatures>`' key maps are the core's merged with
  the features' (`FeatureKeys`, `GridCommands`, `GridQueries`, `GridQuestions`, `ModelState`),
  inferred from `features` (`const` type parameters). `[]` is a grid without features, exact;
  the default `DataGridFeatures` is a grid of any features, what a model with features is
  assignable to: its `run`/`get`/`is` check the core's keys, its middleware also sees a command
  no type names (`FeatureCommandContext`; `use` compares its middleware both ways), and
  `CommandEvent.command` is a string (`AnyFeatures`: a known feature whose types name only
  optional props, the clipboard, is still known). Root props: `GridRootProps<TRow, TNode,
  TFeatures>` (`sortColumns` compiles only with `sorting()`, `activePosition` only with
  `navigation()`, `onFill` only with `fillHandle()`, `columnWidths` only with `columnResize()`,
  `expandedRowKeys`/`detailHeight` only with `rowExpansion()`, `expandedGroupKeys` only with
  `rowGrouping()`, `onRowMove` only with `rowReorder()`, `summaryRows`/`summaryRowHeight` only
  with `summaryRows()`, `columnFilters` only with `filtering()`, `searchText` only with
  `search()`, `pageIndex`/`totalRowCount` only with `pagination()`). `GridView` declares none of a feature's
  fields: read them as `view as GridView & FillView`. The adapters' hooks, composables, inject
  functions and refs take the features as a type argument (`useDataGrid<Person, typeof
  features>()`, `createDataGridRef<…>()`); any ref fits a root. Type fixtures:
  `tests/types/features.ts(x)` in every package.
- **Entries**: each feature is a tsdown entry and an `exports`/`publishConfig.exports` subpath
  of the core; an adapter re-exports it under its own subpath, with its own hooks there
  (`useSelectAll` in `/row-selection`, `useFillHandle` in `/fill`, `useColumnResizer` in
  `/column-resize`; since Epic #151 a feature's primitives too, out of the `DataGrid` namespace,
  which holds the core's parts only: `RowDetail` in `/row-expansion`, `useGroupToggle` in
  `/row-grouping`, `useRowDragHandle` in `/row-reorder`, `Summary`, `SummaryRows`, `SummaryRow`,
  `SummaryCells`, `SummaryCell` and their hooks in `/summary-rows`, where the core's
  `SummaryRowsProps` is `SummaryRowsFeatureProps` (the component's props keep the name) and Vue
  has `typedSummaryRows<TRow>()`; Angular: an ng-packagr
  secondary entry with its own `[dataGridRoot][dataGridX]` directive for the feature's inputs,
  and its parts' directives: `[dataGridRowReorder]` is present while rows move (`="false"`
  stops them: an output cannot tell it has a listener), `DataGridSummaryRowsRoot` is the summary
  rows' (`[dataGridSummaryRows]`, the template directive keeping `DataGridSummaryRows`)).
  Nothing a main entry imports reaches a feature (the entry tests), and **the bundle guard**
  (`scripts/check-features.ts`, run by `pnpm build`, tested by
  `site/tests/check-features.test.ts`) fails when a package's main entry, its `/local` entry
  (Epic #153), or a chunk either imports holds a feature's markers (its command, `get` and `is` keys, read from the built feature) or
  imports a feature's entry point: a feature with none gets a key for it (`get("cell-span-by")`,
  `is("row-movable")`). `pnpm size` lists each entry.
- **The bare grid**: `apps/playground/fixtures/bare-grid` (no feature, both structures, both
  axes scaled: a table, no tab stop, arrows do nothing; its first column declared pinned,
  resizable and reorderable, which scrolls, never moves nor resizes; a column with a `colSpan`,
  whose cells never span) and `e2e/bare.spec.ts`. Every example
  and fixture installs what it uses (`navigation()` wherever keys move: practically all;
  `useLocalRows` runs the stages of the features it is given (`features`, the root's list) and its
  props carry their state: install `sorting()`, `filtering()`, `search()`, `pagination()` for the
  stages an example applies; `editing()` wherever a
  column is `editable`; the column features wherever a column is `pinned`, `resizable`,
  `reorderable` or a group `collapsible`; `rowExpansion()` where rows expand, `rowGrouping()`
  where rows have kinds that expand (grouped `useLocalRows` hands the expanded groups),
  `cellSpans()` where a column spans, `summaryRows()` where there are summary rows,
  `rowReorder()` where rows move); the stress fixture
  installs every feature (sorting, Epic #144's five, editing, the four column features, the five
  row features and Epic #153's three), its commit counts unchanged (D9). The server-side example
  (every framework) installs sorting, filtering, search and pagination with controlled props and no
  `/local`: its pretend server and its fetch policy (`createServerQuery`: the last answer kept
  while the next loads, a stale one dropped) are `_kit/people-server.ts` and
  `_kit/server-query.ts`.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm check` | Biome lint + format + assist (non-mutating), then `check:layout` |
| `pnpm check:layout` | the source layout over `git ls-files` (`scripts/check-layout.ts`, from Dockable): kebab-case names, only entries at a package's `src/` root |
| `pnpm check:fix` | Biome check with auto-fix |
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit; `examples/vue` runs `vue-tsc` on its own TypeScript 6; `packages/angular` and `examples/angular` run `ngc` (strict templates) on their own TypeScript 6.0.3) |
| `pnpm test` | Vitest: `core` (node), `react` (jsdom), `vue` (jsdom), `angular` (jsdom, `@analogjs/vitest-angular`, zoneless TestBed), `playground`, `examples-react`, `examples-vue`, `examples-angular`, `examples-shared`, `site` (`--project <name>` for one) |
| `pnpm bench` | Vitest benchmarks (informative, not a gate) |
| `pnpm build` | `pnpm -r build` (tsdown for the packages, ng-packagr for `packages/angular`, Vite for the apps), then the `.d.ts` check (the Angular compiler's own `static ɵ…` metadata aside) and the features' bundle guard (`scripts/check-features.ts`, below) |
| `pnpm check:package` | builds the packages, packs each with pnpm and checks the tarballs (`scripts/check-package.ts`, from Dockable): the packed `exports` are the repo's without the source condition (`types`/`import`/`default`, `dist` targets), publint (strict), attw (`esm-only`), each adapter of `ADAPTERS` pins the core exactly, and its smoke app (outside the workspace, that adapter's tarball only, rows in memory with the `/local`, `/sorting` and `/navigation` entries: React, Vite + React checked by `tsc`; Vue, Vite + Vue with a single-file component checked by vue-tsc on TypeScript 6; Angular, Vite + `@analogjs/vite-plugin-angular` with a standalone component checked by `ngc` on TypeScript 6, none with `skipLibCheck`) typechecks, builds and loads its dev server. `--tarballs <dir>` checks given tarballs (the release workflow's) |
| `pnpm changeset` / `release:version` | Changesets: add a changeset / bump the versions (the release workflow runs the latter); core and adapters are one `fixed` group (`@fragiola/*`). Releasing: `docs/releasing.md` |
| `pnpm size` | the bundle sizes of every entry point and chunk (raw, gzip, min + gzip; ng-packagr's `fesm2022/*.mjs` too): a report, after `pnpm build` |
| `pnpm e2e` | Playwright: the playground and every examples app (`./examples/*`, each running the shared specs against its embed), each in Chromium, Firefox and WebKit (`--project=<name>` for one) |
| `pnpm dev` | the playground on <http://localhost:5173>: every example live, the fixtures (`PLAYGROUND_PORT` moves it) |
| `pnpm site:export --base /data-grid --out <dir>` | the site export for fragiola.com (contract v1.2, `../www/CONTRACT.md`), self-validated |
| `pnpm site:dev --base /data-grid --port <n>` | every framework's examples app with hot reload, under `<base>/embed/<framework>/` on one port (a Node proxy, `site/dev-proxy.ts`, in front of one dev server per framework), the base `www` proxies in dev |

## CI

`.github/workflows/ci.yml` (its comment header describes every job) runs on pull requests and on
a manual run: Checks, Package (`pnpm check:package`), Changesets (a PR that changes what a package
ships needs a changeset; skipped for the Version Packages PR), Site export, and the E2E suites
(Epic #162). A `Changes` job picks the suites
a pull request can affect (`scripts/e2e-suites.ts`, a `git diff` against the base, tested by
`site/tests/e2e-suites.test.ts`): none for docs only (`site/docs/**`, `*.md`, `AGENTS.md`);
`packages/react` or `examples/react`: the playground and examples react; `packages/vue` or
`examples/vue`: examples vue; `packages/angular` or `examples/angular`: examples angular; any
other path, and a manual run: every suite. Only those may skip: a new rule names what it skips,
never what it runs. The E2E jobs run in `mcr.microsoft.com/playwright:v<version>-noble` (`--user
1001`), its tag the version of `@playwright/test` (`site/tests/ci-workflow.test.ts`): upgrading
Playwright changes both. Each suite is sharded (`--shard`, balanced per test under
`fullyParallel`), the playground in 4 and each examples app in 3, every browser in every shard.

## Releasing

**Releasing is a merge.** Changesets versions the four packages together (one `fixed` group) and
`.github/workflows/release.yml` publishes them over npm trusted publishing (OIDC, provenance, no
token) when the Version Packages PR is merged. A PR that changes what a package ships
(`changedFilePatterns` in `.changeset/config.json`) adds a changeset (`pnpm changeset`); while
`0.x`, a break is a `minor`, anything else a `patch`. Never run `npm`, `pnpm` or `changeset`
publish by hand: the stubs and `npm trust` of the first release are the maintainer's steps
(`docs/releasing.md`, which also covers adding a package and a failed publish).

## Repository layout

```
packages/core/      @fragiola/data-grid        src/<domain>/ (axis, engine, model, …, feature,
                                               utils), local/, the features (sorting/,
                                               navigation/, row-selection/, range/, clipboard/,
                                               fill/, editing/, column-resize/,
                                               column-reorder/, column-pinning/,
                                               column-group-collapse/, row-expansion/,
                                               row-grouping/, row-reorder/, spans/,
                                               summary-rows/, filtering/, search/,
                                               pagination/: each feature.ts and
                                               index.ts, its entry);
                                               tests/ mirrors src/
packages/react/     @fragiola/data-grid-react  src/index.ts, parts.ts (`DataGrid.*`), context.ts
                    src/components/            one primitive per file (root.tsx, grid.tsx, cell.tsx, …)
                    src/hooks/                 one public hook per file (use-cell.ts, …,
                                               use-data-grid-ref.ts); internal.ts: the primitives' own
                    src/utils/                 pure helpers (cells-of.ts, row-style.ts, use-render.ts, …)
                    src/local/, src/<feature>/ the opt-in entries (sorting/, navigation/,
                                               row-selection/, range/, clipboard/, fill/,
                                               editing/, column-resize/, column-reorder/,
                                               column-pinning/, column-group-collapse/,
                                               row-expansion/, row-grouping/, row-reorder/,
                                               spans/, summary-rows/, filtering/, search/,
                                               pagination/: a feature's primitives
                                               and hooks live there);
                                               tests/ named after behaviour
packages/vue/       @fragiola/data-grid-vue    the same layout: src/components/ (root.ts, …),
                                               src/composables/ (use-cell.ts, …), src/utils/,
                                               typed.ts (`typedDataGrid`), local/ and the
                                               features' entries, as React's
packages/angular/   @fragiola/data-grid-angular src/public-api.ts (the entry), src/lib/: context.ts,
                                               data-grid.ts (`DATA_GRID`), directives/
                                               (<part>.directive.ts), inject/ (inject-<hook>.ts),
                                               utils/; src/local/, src/<feature>/ (ng-packagr's
                                               secondary entries: local/, sorting/,
                                               navigation/, row-selection/, range/, clipboard/,
                                               fill/, editing/, column-resize/,
                                               column-reorder/, column-pinning/,
                                               column-group-collapse/, row-expansion/,
                                               row-grouping/, row-reorder/, spans/,
                                               summary-rows/, filtering/, search/,
                                               pagination/ ng-package.json);
                                               scripts/check-dist.ts
apps/playground/    src/main.tsx, app.tsx      the entries
                    src/shell/                 the shell: catalog, sidebar, toolbar, stage, source
                    src/fixture/               the fixtures' grids
                    fixtures/<name>/           unstyled pages Playwright drives
                    e2e/, tests/               Playwright specs, unit tests
examples/shared/    src/meta/<slug>.ts         every example's metadata, whatever the framework
                    src/themes/, src/embed/    the five themes, the embed's messages
                    src/styles/grid-edges.css  the grids' clean edges at any zoom (Epic #166), every app's
                                               embed stylesheet imports it
                    scripts/                   the manifest builder, the loader generator (by framework)
                    e2e/                       the Playwright specs every framework's embed runs, also
                                               inside an iframe; tests/: no framework import, metadata
examples/react/     src/examples/<slug>/       the site's React examples (the embed app, Vite)
                    src/components, lib, …     Fragiola UI, vendored (scripts/vendor-fragiola.ts)
                    playwright.config.ts       the shared specs against this embed
examples/vue/       src/examples/<slug>/       the site's Vue examples, every React one under the same
                                               id (the embed app, Vite, SFCs; its README)
                    src/components, hooks      the Vue kit: Fragiola UI's pieces over Reka UI (its
                                               families copied from examples/react)
                    src/lib, styles            `cn` and the theme, copied from examples/react
                    playwright.config.ts       the shared specs against this embed
examples/angular/   src/examples/<slug>/       the site's Angular examples, every React one under the
                                               same id (index.ts, a standalone component exported by
                                               default, styles.ts, siblings; its README); the embed
                                               app, Vite with the Analog plugin (Epic #132)
                    src/components             the Angular kit: Fragiola UI's pieces over Angular CDK
                                               and native elements, `@lucide/angular` icons (its
                                               families copied from examples/react)
                    src/lib, styles            `cn` and the theme, copied from examples/react
                    playwright.config.ts       the shared specs against this embed
site/               docs/                      the pages fragiola.com/data-grid serves
                    export.ts, contract.ts     `pnpm site:export` and its validation, every framework
                    dev.ts, dev-proxy.ts       `pnpm site:dev`: one port, one dev server per framework
                    sources.ts                 the export's parts, by framework of project.json
docs/                                          reports; releasing.md (the release runbook)
.changeset/                                    pending changesets, config.json (one `fixed` group)
.github/workflows/  ci.yml                     the checks, Package, Changesets, the E2E suites, Site export
                    release.yml                Version Packages PR, then pack, check --tarballs and
                                               publish over OIDC from the `npm` environment
scripts/check-package.ts                       `pnpm check:package` (tests: site/tests/check-package.test.ts)
```

## Playground

`pnpm dev` serves `apps/playground`: a local app to see the packages working, with hot reload on
the core, the React primitives and the examples. A sidebar, a theme switch (the five example
themes) and the source beside the stage; the state is in the URL
(`?example=<slug>&theme=<name>&code=1`).

- **Examples** live in `examples/react/src/examples` and are public: the site embeds them, readers
  copy them. Each of React Data Grid's website examples has one (the parity table of
  `site/docs/guides/from-react-data-grid.mdx`); a menu, a filter or a checkbox in one is the app's
  (Fragiola UI, vendored). The playground reads them in place, with their metadata from
  `examples/shared/src/meta` (`import.meta.glob`, the `#/` alias and the pre-paint theme from
  `examples/react/vite.shared.ts`); it never keeps a second list. It stays React-only.
- **Fixtures** (`fixtures/<name>/`) are the unstyled pages Playwright drives; the sidebar links
  them. `stress-grid` (Epic #89, E5.3; `src/fixture/stress-fixture.tsx`, the grid fixture's parts)
  has every feature on at once: 1,000,000 rows through `getRow`, 1,000 columns, both axes scaled
  (`maxScrollSize` 80,000), groups with a collapsible one and sticky labels, pinned columns at
  both ends, spans, sorting, resizing, reordering columns and rows, row selection, details,
  summary rows, cell ranges, the clipboard, editing, the fill handle and a direction toggle
  (`?kind=table|div`; `&grouped=1`: 100,000 rows in memory grouped, `getRow` cannot feed
  grouping). `e2e/stress.spec.ts` drives both structures in every browser, and counts React's
  commits through the wheel's exact steps (`window.commits`).

## Conventions

- Biome: 4-space indent, double quotes, LF, trailing newline, organized imports.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
  Do not relax it; a blanket `!` on every index access is not a fix.
- Commits are gitmoji-conventional: `✨ feat(core): …`, `🐛 fix(react): …`,
  `✅ test(core): …`, `🔧 chore: …`, `📝 docs: …`.
- Branches: `<type>/epic-<n>-<short-description>`; one worktree per Epic under `.worktrees/`.
- Files follow the Fragiola source layout (`../guidelines/repository.md#source-layout`): every name
  kebab-case, folders by responsibility, only entries at a `src/` root. `pnpm check:layout`
  enforces it.

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
  (`src/utils/utils.ts` in the core, `src/utils/` in React), outside `local/` and the features'
  folders so the main entry never reaches the extras.
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
  on a fake viewport), `packages/react/tests/helpers.tsx` (`renderCounting`, `scrollRoot` for
  D9) and `examples/shared/e2e/helpers.ts`, `examples/shared/e2e/examples/helpers.ts` (the
  playground's spec imports it too).
- **The engine's modules** (`packages/core/src/engine/`): `engine.ts` (the closure binding one
  grid to the DOM: scroll, windows, layers, focus, keys, drags; the edits are `editing/feature.ts`'s), `types`, `view` (pure: a
  view from its inputs), `geometry` (pure per-view and per-cell math, axis anchors), `parts`
  (part state and ARIA), `interaction` (a cell's controls), `heights` (measured rows and details:
  observing, reading, forgetting), `measure` (their store and axis), `drag` (the drags' state,
  the features' drags (`FeatureDrag`) among them, and pure geometry: edge steps, drop sides),
  `shortcuts` (Ctrl/⌘+Home/End, `shortcutLetter`, `isSelectAll`: what the features' keys read),
  `dom` (DOM predicates, attributes, the wheel's scrollers). A feature's own engine code is in its
  folder (`clipboard/held-selection.ts`, a fill's target in `fill/`), never in `engine/`. A helper only the main entry uses stays out
  of `utils/utils.ts` when `/local` imports that module too: a shared chunk carries every export the
  main entry uses (`pnpm size` shows it).

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
- **Structural inline style only**: `position` (`sticky` on the header, the summary rows'
  `Summary`, `Empty`'s area, pinned cells, a row's detail and a group's label), `top`/`left`/`width`/`height`/`inset` (`right` in place of `left`
  right to left: `inlineSide`), `transform` on the layers,
  `display` (also to make table parts positionable, `flex` on rows and header rows with
  pinned columns, `grid` on a measured row, Epic #86), in a measured row `grid-area` on its
  cells and detail and its cells' inline start margin (`margin-left`, `margin-right` right to
  left: their place, in place of `left`), `align-self` on a measured detail in a row of pinned
  cells, `overflow` on the viewport, `contain`, `box-sizing`, `z-index` for the grid's layers
  (Epic #89, E5.2: `Header` 2 above `Summary` 1, both above the body, which has none (its
  transform makes it a context, its pinned cells' stacking the app's); `Grid` none (no stacking
  context of its own: content placed in it, fixed or not, stacks against the page as the app
  says); between header rows, with column groups, an upper row above the next, which a
  column spanning rows reaches into; the header's and summary rows' background is the app's),
  `height: 100%` on the empty state's row and cell, and on a row's detail `margin-top` (its place below the row's cells) and, in a
  row of pinned cells, `margin-left` (`margin-right` right to left) and `flex-shrink: 0` (its box
  from the row's start, never shrunk). Nothing cosmetic. (The root's `dir`, when a direction is
  given, is structural: `Root` renders `view.givenDirection`.)
- **State only through `data-*` and ARIA**, present or absent (never `"false"`; a selectable
  row's `aria-selected="false"` is ARIA's own "selectable, not selected"; a row's drag handle's
  `aria-hidden="true"`; a group row's and its toggle's `aria-expanded="false"`, ARIA's collapsed;
  a body cell's `aria-selected="false"` while cells are selectable, Epic #88): `data-active`,
  `data-loading`, `data-empty`, … Every part carries `data-grid-part` and, for rows and cells,
  `data-row-index`/`data-column-index`; e2e selectors use them, never class names.
- **No text and no names.** Primitives render only their children (or the column's renderer) and
  set no `aria-label` of their own.
- **A column resizer is the app's element (Epic #70, W3).** `useColumnResizer(cell)` (from
  `/column-resize`, with `columnResize()` installed: Epic #148) returns
  `{ state, props }` (`state`: `columnKey`, `resizable`, `resizing`, `width` (on screen: a flex
  share or an automatic width included), `minWidth`, `maxWidth`, `edge` (`"end"`, `"start"` for
  a column pinned at the end: the edge the app places it on); `props`: the separator's ARIA, `tabIndex`, `data-grid-column-resizer`,
  `data-grid-part="column-resizer"`, `data-resizing`, an empty `style`), and no props under a
  cell that does not resize (`state.resizable` false: render none). The app gives it a name
  (`aria-label`), a place (a header cell is positioned), a look and `touch-action: none`. A header
  cell given children renders only them: `headerCellContent(cell)` is its default content, for
  `{headerCellContent(cell)}<Resizer cell={cell} />`. A focusable `separator` on a `div` needs a
  documented `biome-ignore` of `useAriaPropsSupportedByRole` (the APG splitter; an `<hr>` cannot
  take focus).
- **A row's drag handle is the app's element (Epic #86, E2.3).** `useRowDragHandle(row)` (from
  `/row-reorder`, Epic #151; without `rowReorder()` it drags nothing) returns
  `{ state, props }` (`state`: `rowIndex`, `reorderable`, `dragging`; `props`: `aria-hidden`,
  `data-grid-row-drag-handle`, `data-grid-part="row-drag-handle"`, `data-reorderable`,
  `data-dragging`, an empty `style`); its look, cursor and `touch-action: none` are the app's, and
  it is a plain element, not a control (a press focuses its cell).
- **A group row's toggle is the app's control (Epic #87).** `useGroupToggle(row)` (from
  `/row-grouping`, Epic #151; without `rowGrouping()` a click on it does nothing; a row's or a
  cell's info) returns `{ state, props }` (`state`: `rowIndex`, `groupKey`, `expandable`,
  `expanded`, `depth`; `props`: `aria-expanded`, `data-grid-group-toggle` = the row index,
  `data-grid-part="group-toggle"`, `data-expanded`, an empty `style`), and no props under a row
  that does not expand; its element (a `button`), name, look and place are the app's. The engine
  runs `row-groups.toggle` on its click, after the app's `onClick`.
- **An edited cell renders its column's `renderEditCell` (Epic #88, E4.3)** in place of its
  content, with `editing()` installed (Epic #146; a `Cell` given children renders only them:
  `useCellEdit(cell)`, from `/editing`, is for an editor there); the editor, its look and its validation are the app's; its `editorProps`
  (`data-grid-editor`, the edit's name) mark what of it is portalled out of the grid.
- **A fill handle is the app's element (Epic #88, E4.4).** `useFillHandle(cell)` (from `/fill`,
  with `fillHandle()` installed) returns
  `{ state, props }` (`state`: `visible`, `filling`; `props`: `data-grid-fill-handle`,
  `data-grid-part="fill-handle"`, `data-filling`, an empty `style`), and no props in any cell but
  the range's corner (render none); its look, place at the corner, cursor and
  `touch-action: none` are the app's. A press on it reaches the engine's `pointerdown` after the
  app's `onPointerDown`, as a resizer's does.
- **Hooks have one shape.** `useDataGrid()` is `{ model, engine }` (with a `gridRef`, or `null`
  until a root holds it; `useRow`'s props hold a measured row's `ref`); a part hook (`useRow`, `useCell`, `useHeaderCell`,
  `useGroupLabel`, `/row-reorder`'s `useRowDragHandle`, `/row-grouping`'s `useGroupToggle`, `/column-resize`'s `useColumnResizer`, `/fill`'s `useFillHandle`, `/row-expansion`'s `useRowDetail`, `/summary-rows`' `useSummaryRow`, `useSummaryCell`) returns
  `{ state, props }`, the structural style in `props.style`.
- **Keys go to the engine after the consumer.** `Root` calls the engine's `keydown` after the
  consumer's `onKeyDown` (on `Root` or on its `render` element), and a cell's `onKeyDown` runs
  before both (bubbling): `preventDefault` in either cancels a grid key, Enter, F2, Tab and
  Escape of interactive cells included. **Clicks too (Epic
  #27):** `Root` calls the engine's `click` (a header cell's sort) after the consumer's
  `onClick`, the same way. **Presses on a resizer, a reorderable header cell or a row's drag
  handle too (Epics #70, #75, #86):** `Root` calls the engine's `pointerdown` (a resizer's drag;
  a header cell's or a handle's once past the click slop, the press not prevented so a click
  still focuses and sorts) after the consumer's `onPointerDown`; during a drag, Escape goes to the engine's `keydown` the same way,
  and from outside the grid to a listener on the document's bubble phase, after the app's own
  handlers (a prevented Escape keeps the drag); the click ending a drag is the drag's. **Copies
  and pastes too (Epic #88):** a double click on an editable cell edits it through the engine's
  `click`, after the consumer's `onClick`. `Root` calls the engine's `copy` and `paste` after the consumer's
  `onCopy` and `onPaste`, the same way (taken by `clipboard()`), and a press on a body cell with
  `cellSelection` (a range's drag) after its `onPointerDown`. Keys from outside the
  viewport (a menu portalled out of a cell) and from the app's content beside the cells (a
  control in `Empty`) are never the grid's: only its cells, its layers and its viewport.
- **The layers' `transform` is the engine's**: `Body`, `HeaderRow` and `SummaryRow` drop a
  consumer's. The header layer has an element per header row and per summary row: the engine
  writes the same transform to each. A
  pinned column's `Cell`/`HeaderCell` drop a consumer's `transform` and insets (`top`, `left`,
  `right`, `bottom`, `inset*`): its inline start inset (`left`, `right` in RTL) is the engine's.
- **`Grid` is `role="treegrid"` while the rows have kinds (Epic #87, `gridRole`)**, else
  `grid`, both with `navigation()` installed (without it `table`, its cells `cell`: D11); rows then carry `aria-level`, a row group `aria-expanded`, and `aria-setsize`/
  `aria-posinset` when their meta says. A `Cell` on a group row renders `renderGroupCell`, else
  its value (the group's value or its aggregate) as text.
- **Header rows render through `HeaderRows` (Epic #13, G6)**, a children function over the
  header rows that `Header` renders by default; each `HeaderRow` takes its `row`, `HeaderCells`
  that row's cells (groups and columns), and `HeaderCell` carries `data-group` for a group and
  `colSpan`/`rowSpan` when rendered as a `th`. A grid without groups renders exactly as before.
- **A grid owns only its own cells (Epic #12, E4).** Every cell lookup and focus decision of an
  engine considers only cells whose nearest attached viewport is its own (a registry of attached
  viewports, across engines). A grid nested in a cell is its own grid; to the outer grid, focus
  inside it is focus inside the cell that holds it, and its keys (and wheel) are never the outer
  grid's. The registry is module state: nesting needs one copy of `@fragiola/data-grid` in the app.
  **Its tab stop is its holder's (Epic #89, E5.2):** a nested grid's tab stop (`view.tabbable`:
  the active cell's and header cell's `tabIndex` 0, the grid's) is in the page's tab order only
  while the outer grid's active cell holds it (`holdsNested`: the outer cell it is in, or, in a
  detail, a row index and no column, its row) or focus is inside it (`updateTabStop`, from
  `focusin`/`focusout`); a grid on its own always. Each engine registers a `NestingHost`
  (`HOSTS`, `dom.ts`) on attach and tells its nested grids, at the commit that renders its
  cells' indexes (`nestedStale`), when its active cell, or what is at it, can have changed (the
  active position, a new source, new columns, `rows.changed` over the active row); an inner grid
  takes the nearest attached viewport above its own for its host, every grid asked again on
  every attach (`NESTINGS`: refs attach child first, and a grid between two others may attach
  after both). A nested grid outside any row or cell of its host (in `Empty`) keeps its own tab
  stop. `ownTabStop` (an engine option, a `Root` prop) keeps a tab stop of its own; a part's
  `tabIndex` still overrides. **The wheel under scaling (E5.2):** a wheel along a scaled axis is
  the engine's, decided per axis: its part on an axis goes to what still scrolls that way
  between its target and the viewport (`scrollerBefore`: `overflow` auto/scroll with content
  beyond that edge, right to left mirrored, or `overscroll-behavior` contain/none; a nested grid,
  a panel or a field in a cell), else to the grid, moved exactly; every part an inner element's,
  the browser's (not prevented), else prevented and an inner part scrolled there by the engine.
  Not asked of the grid's own cells, rows and layers; the styles read once a gesture
  (`wheelStyles`, reset after `WHEEL_GESTURE` ms), the scroll sizes only where they scroll. A
  wheel along no scaled axis is the browser's.
- **`Empty` renders only while there are no rows (Epic #12, E3).** It is a cell (Epic #89, E5.2:
  `role="gridcell"`, `aria-colspan` every column; rendered as a `<td>`, `colSpan`, no role) in a
  row of its own (`data-grid-part="empty-row"`, `role="row"`; a `<tr>` for a `<td>`), in an area
  of its own (`empty-area`: in the flow after `Header`, sticky at the inline start, as tall as
  the visible body and as wide as the columns, at most the view, the view without columns: Epic
  #113, so content centred in it sits under the header; a `<tbody>` for a `<td>`): a table's structure in a table grid (`Grid`
  rendered as a `<table>` element: `TableContext`; there `Empty`'s own tag is a `<td>`, and a
  component rendering one, `render={<Td />}`, is given `colSpan`) or when its rendered element is
  a `<td>`; else divs with roles. The app's class, style and children go on the cell (`height: 100%`; a `<td>` a block,
  a div's display the app's); it has no text or name of its own and no indexes (the keys, the
  tab order and interaction leave its controls alone), and `Root` and `Grid` carry `data-empty`
  meanwhile. Its row counts in `aria-rowcount` (and moves the bottom summary rows' indexes) only
  while it is mounted: its cell registers as the engine's `empty` element (`view.emptyShown`).
  On the server nothing registers: the server's HTML counts no empty line, hydration starts from
  that count (it matches) and the first commit adds it. With no rows, the grid's sizer
  spans at least the visible area (the view's `viewportWidth`/`viewportBodyHeight`).
- **`RowDetail` renders only while its row is expanded (Epic #41, M3; from `/row-expansion`
  since Epic #151, with `rowExpansion()`).** It holds only its
  children (no text, no names), is a block (its content's layout is the app's), and drops a
  consumer's insets and `transform` like a pinned cell. As a `td` it gets `colSpan`.
- **The root is no tab stop** (`tabIndex={-1}`, some browsers make a scroll container one): with
  `navigation()` the grid is, until a cell is active, then the active cell is (roving tabindex);
  without it neither is (the APG table: the controls in its cells are the tab stops).
- **The developer owns the recursion**: children functions over the windowed rows and cells.

## The primitive contract in Vue (`@fragiola/data-grid-vue`)

The same contract, with Vue's own means: the parts render the same elements, `data-*`, ARIA and
structural style, the tests of `packages/vue` mirror React's. `site/docs/api/vue.mdx` maps each
React prop.

- **`as` and the `render` slot, never `asChild`.** `as` (a tag or a component) replaces the
  element; the `render` scoped slot receives `{ props, state, children }` (`v-bind="props"` on
  the app's element, `<component :is="children" />` inside it: one stable component, the content
  never remounts).
- **Children functions are scoped slots.** `Rows`, `HeaderRows`, `SummaryRows` give `{ row }`,
  `Cells`, `HeaderCells`, `SummaryCells` `{ cell }`; `Cell`'s default slot `{ cell, state }`, the
  other parts' `{ state }`.
- **`class` and `style` are fallthrough attributes** (`inheritAttrs: false`, merged by the part),
  under the structural style, the same keys dropped (`LAYER_KEYS`, `PINNED_KEYS`). No function
  form: state looks go through `data-*` or the `render` slot's `state`. A number in the
  structural style gets its `px` (Vue adds no unit).
- **Listeners in Vue casing compose as in React**: internal first, then the consumer's, then the
  engine's (`after`: `keydown`, `click`, `pointerdown`, `copy`, `paste` on `Root`), so a
  `preventDefault` cancels the grid's. `Root`'s own callbacks are props (`onExpandedRowKeysChange`,
  or `@expanded-row-keys-change`); a feature's are attributes (below: `@active-position-change`,
  editing's `@editing-cell-change` and `@cell-edit`, resizing's `@column-widths-change`).
- **A feature's props are fallthrough attributes** (Epic #141): `Root` declares its own props
  once, so `sort-columns`/`sortColumns`, `@sort-columns-change` reach it as attrs; it hands them
  to the core through getters of the latest values (`gridPropsOf`, only with features) and keeps
  them off its element. `typedDataGrid<TRow, typeof features>()` types them.
- **Column renderers return vnodes**: columns are the core's `Column<TRow, VNodeChild>`.
- **Composables return computed refs.** A part composable takes a value, a ref or a getter and
  returns `{ state, props }` (`PartComposableResult`); `useRowWindow(gridRef?)` and
  `useColumnWindow` a shallow ref; `useDataGrid()` plain `{ model, engine }` (a shallow ref with a
  `gridRef`); `/local`'s `useLocalRows` and `/row-selection`'s `useSelectAll` objects of getters;
  `/fill`'s `useFillHandle` a part composable.
- **`typedDataGrid<TRow>()` is Vue only**: a template cannot pass a type argument, so it returns
  the same components typed by the row (the plain `DataGrid` erases it); a feature's parts are
  outside it (Epic #151): `/summary-rows`' `typedSummaryRows<TRow>()` types the summary's. React's
  `DivPrimitiveProps`, `PrimitiveProps` (its own), `RenderedProps` and `RenderProp` are React
  only; Vue's `PrimitiveProps` is `as`.
- **A template ref on a part is its component instance** (its element `$el`); a handle on the
  grid is a `gridRef`.
- **Vue SSR is not supported yet**: the package renders in the browser.

## The primitive contract in Angular (`@fragiola/data-grid-angular`)

The same contract, with Angular's own means (Epic #129, Dockable's Angular decisions): the parts
put the same `data-*`, ARIA and structural style on the app's elements, the tests of
`packages/angular` mirror Vue's (one file per Vue file). `site/docs/api/angular.mdx` maps each
React prop.

- **Attribute directives on the app's elements, never `asChild`** (the Angular form of
  `render`): `<div dataGridRoot>`, `<table dataGridGrid>`, `<tr [dataGridRow]="row">`,
  `<td [dataGridCell]="cell">`. A part that renders only sometimes is a **structural directive**
  on its element (the template's first root element is the part's): `*dataGridHeader`,
  `*dataGridEmpty` (it makes the area and the row around the app's cell), `*dataGridRowDetail`
  (`/row-expansion`, Epic #151), `*dataGridSummary="'top'"` (`/summary-rows`, with the summary's
  other directives in `SUMMARY_ROWS`), and the app's elements React gives through hooks:
  `*dataGridGroupToggle` (`/row-grouping`), `*dataGridColumnResizer` (`/column-resize`, Epic #148),
  `*dataGridFillHandle` (`/fill`), `*dataGridCellEdit` (`/editing`, Epic #146);
  `[dataGridRowDragHandle]` (`/row-reorder`) and `[dataGridGroupLabel]` always render. Selectors
  `dataGrid<Part>`, classes `DataGrid<Part>`, `exportAs` the selector; `DATA_GRID` is every
  directive of the core's parts (React's `DataGrid` namespace); a feature's are in its entry. The
  main entry exports `ɵ` helpers for the feature entries (`ɵinjectRowContext`,
  `ɵDATA_GRID_SUMMARY`, `ɵDATA_GRID_SUMMARY_ROW`, `ɵpartResult`, `ɵcellBinding`, …: not the app's
  API).
- **The recursion is templates**: `ng-template[dataGridRows]`, `[dataGridCells]`,
  `[dataGridHeaderRows]`, `[dataGridHeaderCells]`, `/summary-rows`' `[dataGridSummaryRows]` and
  `[dataGridSummaryCells]`, each a keyed view per item (`utils/views.ts`, from Dockable: a view
  kept while its key stays, its context a `SignalContext` updated in place), typed by their input
  (the columns or the root: `TypedBy<TRow>`) through `ngTemplateContextGuard`. No default content:
  `*dataGridCellContent` renders a cell's, a header cell's or a summary cell's (the core's
  `cellContent`, `headerCellContent`, `summaryCellContent`; edited, with `editing()`,
  `renderEditCell` given the draft: `cellEditOf`).
- **Column renderers return `DataGridNode`** (`Column<TRow, DataGridNode>`): text, nothing, or
  `templateContent(template, context)` (`TemplateContent`), rendered with the context as its
  fields and its `$implicit`; `[dataGridTemplate]="contextOf<C>()"` types the template.
- **The props through one binding** (`bindPart`, `utils/helpers.ts`): the core's part props
  written as attributes (`tabIndex` → `tabindex`, a `<td>`/`<th>`'s `colspan`/`rowspan`; a
  boolean `data-*` absent, never `"false"`), an attribute the element had at creation is the
  app's and never touched; the structural style kept over the app's `style` (a key it stops
  setting gets the app's value back; the drop keys removed from the static style once); the engine
  layer registered after the style is written and released before (an unpinned cell gives up the
  engine's inset before the structural one is written).
- **Signals, `input()`, `output()`, `inject()`; zoneless and `OnPush`-safe.** The root's inputs
  are `GridRootProps`' names; each `onXChange` is the output `xChange` (`[(x)]` binds both ways),
  …; `onRowMove` (on by presence in React) is `/row-reorder`'s `[dataGridRowReorder]` (present,
  the rows move; `="false"` stops them) with its output `rowMove` (Epic #151). Another directive on
  the root's element may add props over its inputs (`addPropsSource`: `[dataGridLocalRows]`;
  with `{ inputs: true }` they rank as the root's own inputs: `[dataGridSorting]`). A feature's
  inputs are its own directive's, in its entry point (`@fragiola/data-grid-angular/sorting`'s
  `[dataGridRoot][dataGridSorting]`: `[(sortColumns)]`, `[defaultSortColumns]`;
  `[dataGridNavigation]`: `[(activePosition)]`; `[dataGridRowSelection]`: `rowSelection`,
  `isRowSelectable`, `[(selectedRowKeys)]`; `[dataGridCellRange]`: `cellSelection`,
  `[(selectedRange)]`; `[dataGridClipboard]`: the input `beforeRangePaste`, the output
  `rangePaste`; `[dataGridFill]`: on by presence (`[dataGridFill]="false"` off, React's `onFill`
  given), the output `fill`, replacing the root's `fillable` and `fill`; `[dataGridEditing]`
  (Epic #146): `[(editingCell)]`, `[defaultEditingCell]`, the output `cellEdit`, its row typed by
  `[dataGridEditing]="columns"`; Epic #148: `[dataGridColumnResize]`: `[(columnWidths)]`,
  `[defaultColumnWidths]`; `[dataGridColumnReorder]`: `[(columnOrder)]`, `[defaultColumnOrder]`;
  `[dataGridColumnGroupCollapse]`: `[(collapsedGroupKeys)]`, `[defaultCollapsedGroupKeys]`;
  `columnPinning()` has no input; the root lost its own width, order and collapsed groups inputs
  and outputs), so they compile only
  where the app imports it; the root takes `[features]`. `*dataGridFillHandle` and
  `injectFillHandle` are `/fill`'s, `*dataGridCellEdit` and `injectCellEdit` `/editing`'s (through
  the private `ɵinjectGrid` and `ɵDATA_GRID_CELL`), `injectSelectAll` `/row-selection`'s,
  `*dataGridColumnResizer` and `injectColumnResizer` `/column-resize`'s (through `ɵinjectGrid`,
  `ɵbindPart`, `ɵstructuralView`). The
  model and the engine are made from the inputs the first time a part reads them (after the
  inputs are set: `injectDataGrid()`'s are read when used). The view is a signal fed by the
  engine's subscription; a scroll within the rendered window changes no signal (D9,
  `render-counts.test.ts`); past it, the component's templates are refreshed (Angular checks an
  OnPush component's embedded views together), the DOM written only where a value changed.
- **The lifecycle**: the root attaches once its element is in the page (`afterNextRender`,
  `earlyRead`) and adds its keys, clicks, presses and clipboard listeners then, after the app's
  (registered at the element's creation), so `preventDefault` in the app's cancels the grid's;
  `[dataGridGrid]` commits the view the parts were refreshed with (`afterRenderEffect`, `write`);
  the root syncs its props after every render that changed an input or the view
  (`afterRenderEffect`, `mixedReadWrite`).
- **A part's `state()`** (through `exportAs`: `#cell="dataGridCell"`) is `undefined` on the first
  pass of a binding on its own element (Angular evaluates class bindings before the element's
  inputs: `beforeInputs`).
- **Injection functions mirror the hooks** (`inject<Hook>`, React's `useDataGridRef` is
  `createDataGridRef`): a part's takes a value, a signal or a getter and returns
  `{ state, props }` signals (`PartInjectResult`), `props()` put on an element with
  `[dataGridBind]`. `tests/exports.test.ts` maps every React name onto its Angular name and lists
  the Angular-only ones.
- **The package**: ng-packagr (partial compilation, TypeScript 6.0.3 pinned in the package),
  packed from its folder like the others (`files: ["dist"]`, dist-only `publishConfig.exports`);
  `scripts/check-dist.ts` removes the manifests ng-packagr writes into `dist` and checks the
  bundles import only Angular and the core. The opt-in entries import the main one by its name.
- **Angular SSR is not supported yet**: the package renders in the browser.

## The core's adapter helpers (`packages/core/src/adapter/`)

**A decision every adapter takes is a core helper**: an adapter adds only its framework's own
(refs, listeners, `render`/`as`, slots, the unit of a number in a style). Before writing logic in
an adapter, look here; if two adapters would write it, it moves here.

- `root.ts`: `bindGridRoot(options)` creates the model and the engine from a root's props, binds
  the controlled pieces (`bindControlled`, `controlled.ts`), maps the props onto commands and
  tells the engine's events; the adapter renders and calls `sync()` after each render.
  `GRID_ROOT_PROPS` lists the core's root props (`GridRootProps`), `withoutRootProps(props,
  features)` leaves what goes on the element (the installed features' props off too).
- `props.ts`: each part's props and state, whatever the framework (`rootPropsOf`,
  `gridPartOf`, `headerPropsOf`, `headerRowPartOf`, `headerCellPartOf`, `bodyPropsOf`,
  `rowPartOf`, `cellPartOf`, `rowDetailPartOf`, `summaryPartOf`, `summaryRowPartOf`,
  `summaryCellPartOf`, `columnResizerPartOf`, `rowDragHandlePartOf`, `groupTogglePartOf`,
  `groupLabelPartOf`, the empty state's; `fillHandlePartOf` is `/fill`'s), the lists the collection parts
  render (`rowsOf`, `rowCellsOf`, `summaryCellsOf`), and a part's default content:
  `cellContent`, `headerCellContent`, `summaryCellContent`; an edited cell's editor props,
  `cellEditOf` (editing's `editCell`, `null` without it).
- `grid-ref.ts`: `createGridHandle()` and `attachGridHandle(handle, grid, where)`, the `gridRef`
  every adapter types and makes.
- `@fragiola/data-grid/editing` (Epic #146): `editActions(engine)` (one set per engine) and
  `editCellPropsOf`, an editor's props (each `useCellEdit`'s).
- `@fragiola/data-grid/local`: `localRowsResult`, `plainRowKey`, `moveShownRowAt`, what each
  `useLocalRows` returns and keeps; `@fragiola/data-grid/row-selection`: `selectAllState`,
  `selectAllToggled`, what each `useSelectAll` shows and sets.

## Site

The docs and examples are served by `fragiola.com/data-grid`, built by the `www` repo from this
repo's **site export** (`../www/CONTRACT.md`, v1.2). This repo only provides: the pages
(`site/docs`, base-free links, the v1.2 vocabulary), the gallery configuration (`examples.json`)
and one examples app per framework of `site/project.json`'s `frameworks` (`examples/<framework>`,
package `examples-<framework>`, built for `<base>/embed/<framework>/`, with its own manifest:
`examples/react`, `examples/vue` (Epic #126) and `examples/angular` (Epics #129, #132), each with
every example). What every framework's examples share (the metadata, the themes, the
embed's messages, the manifest builder, the loader generator and every Playwright spec) lives
once in `examples/shared` (`examples-shared`, private, imports no framework); an example keeps
its id in every framework, and a spec for an example a framework lacks is skipped there, unless
that framework ships them all (`COMPLETE_FRAMEWORKS` in `examples/shared/e2e/available.ts`: React,
Vue and Angular). CI's
examples e2e is a matrix over the `examples/*` apps with a `playwright.config.ts` (× shard, below). `www` owns the shell,
the gallery chrome, the code panel and search. A page's `title` is at most 60 characters and
never repeats "Data Grid"; its `description` is 50–160 characters, plain words, no `: ` (YAML);
a page body has no `#` and never skips a heading level; `pnpm site:export` checks all of it. Examples import internal modules through `#/…`
(never `@/…`). Every HTML file of the examples app carries
`<meta name="robots" content="noindex">`.

In dev every workspace package resolves to its sources through the `@fragiola/source` export
condition (`SOURCE_CONDITION` in `scripts/source-condition.ts`, the first key of each `exports`
entry): the tsconfigs' `customConditions`, the Vitest configs and the examples' Vite config in
serve (`examples/react/vite.shared.ts`, which the playground shares), so `pnpm dev` hot-reloads
the core and React sources and `pnpm typecheck` and `pnpm test` need no build. Production builds
(the embed of `pnpm site:export`, the e2e builds) use `dist`. The published `exports`
(`publishConfig.exports`) are dist-only, and only pnpm applies them: the packages are packed and
published through pnpm, never npm (`site/tests/package-exports.test.ts` packs both and checks it).
