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
7. **Sizes (D7).** `rowHeight: number | (index) => number | "auto"` (`RowHeight`; `"auto"`:
   measured, Epic #86, below); columns `width: number` (px), the
   width a column starts with and a reset gives back: the model keeps a resized column's width
   over it (`columnWidths`, Epic #70). The effective width, within the column's limits, is the
   override (`columnWidths`), else the engine's automatic width (`autoSize`), else its flex share
   (`flex`), else `width` (Epic #80). **Measured heights (Epic #86, E2.2):** `rowHeight: "auto"`
   with `estimatedRowHeight` (default `DEFAULT_ROW_HEIGHT`) and `detailHeight: "auto"` with
   `estimatedDetailHeight` (default `DEFAULT_DETAIL_HEIGHT`): model state, options and
   `sizes.set` (an estimate is a size above 0: `sizes.set` refuses another with
   `invalid_payload`, an option leaves it out; `Root` sends only the sizes that changed, the
   estimates in commands of their own, so a refused one never holds the others back). The engine
   measures: `measuring(state)` while either is
   `"auto"`, nothing otherwise (a grid of given heights reads, observes and allocates nothing
   more). A loaded measured row registers as the engine's `row` element (`EngineLayer`; React's
   `Row` through `useRowPart`'s `ref`, `useRow`'s props carry it), a detail as before (`detail`).
   Each element is read once, at the commit that first renders it (`takeMeasures`: border-box
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
10. **One generic: the row type (D10).** `Column<TRow>` is `{ key, name?, width, getValue?,
    renderHeaderCell?, renderCell?, renderSummaryCell?, sortable?, pinned?, resizable?, minWidth?, maxWidth?,
    flex?, autoSize?, reorderable?, colSpan?, groupShow?, compare?, filter?, meta? }`. Without children, a header cell renders
    `renderHeaderCell`, else the column's `name` (the app's own text, never translated or made
    up); a cell renders `renderCell` for a loaded row, else its value as text. No column helper,
    no feature registry, no `flexRender`. **Column groups live in `columns` (Epic #13, G1):** an
    entry is a `Column` or a `ColumnGroup<TRow>` `{ key, name?, renderHeaderCell?, children,
    reorderable?, collapsible?, groupShow?, meta? }`, nested to any depth, keys unique across both; the leaves, in order, are the grid's
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
    sorted column with a header cell of its own only (one a collapsed group hides or a header
    span covers still sorts, its priority kept); `data-sortable`, `data-sort`, `data-sort-priority`. The grid never orders
    the rows: the app does. **Pinned columns (Epic #31, P1–P7; at the end, Epic #85, E1.1):**
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
    **Collapsible groups and sticky labels (Epic #85, E1.3):** `collapsible: true` on a group;
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
    **Master-detail (Epic #41, M1–M4):** the model keeps `expandedRowKeys` (keys, `rowKey` else index; `expanded-rows.set { rowKeys }`,
    `expanded-rows.toggle { rowIndex } | { rowKey }`, `is("row-expanded", { rowIndex })`),
    controlled or not on `Root` like the sort (`expandedRowKeys`/`defaultExpandedRowKeys`/
    `onExpandedRowKeysChange`). A row is expanded when it is loaded and its key is expanded; the
    model derives `expandedRows` (indexes) looking for a key where it was last seen, then only in
    the rows the app names (a `rows.changed` range, rows added behind the same `getRow`, a new
    source), so nothing is scanned without expanded keys. `detailHeight: number | (row, rowIndex)
    => number | "auto"` (default 300; `"auto"` measured, D7) adds to an expanded row's size in the row axis (`withExtraSizes`, a
    sorted list over the base axis): no fake rows, indexes, windows and `getRow` unchanged; a row
    expanding above the view keeps the view where it is. `DataGrid.RowDetail` sits inside its
    `Row` after its cells, renders only while expanded, sticky (the engine's `detail` element,
    `left` = −layerX) with `margin-top` = the row's own height, as wide as the view; an expanded
    row is at least as wide as what holds it (`rowWidth`). ARIA: a detail is one `gridcell` of
    its row (`aria-colindex` 1, `aria-colspan` every column), so counts and row indexes never
    change. Keys: the arrows move between rows' cells and scroll by a row's own height; a detail
    has no `data-column-index`, so its keys and focus are its content's (a grid in it is its own).
    **Summary rows (Epic #86, E2.1):** one generic still: `Root`'s `summaryRows?: { top?, bottom? }`
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
    `DataGrid.Summary position` (a `rowgroup`, `data-summary`, sticky in the grid's flow, pure CSS
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
    holds them all. Hooks `useSummaryRows`, `useSummaryRow`, `useSummaryCells`, `useSummaryCell`;
    `SummaryContext`/`SummaryRowContext` reset by `Root` for nested grids. Stacking is the app's,
    as the header's. **Rows in memory (Epic #47, L1–L7):** an opt-in entry point per package, never imported by
    the main ones (their built files must not contain it): `@fragiola/data-grid/local` holds the
    framework-free pipeline (`createLocalRows` keeps the sort, filters, search and page;
    `derive(rows, columns)` filters, searches, sorts and pages in that order, each stage
    computed again only when its own inputs change; `sortRows`, `filterRows`, `searchRows`,
    `pageRows`), `@fragiola/data-grid-react/local` holds `useLocalRows(rows, columns, options)`,
    which keeps that state itself and returns `props` to spread onto `Root` (`rows`,
    `sortColumns`, a stable `onSortColumnsChange`) and `sort`/`filter`/`page` for the app's
    controls (and `moveRow(move)`, Epic #86: a row move applied to the rows given; stable, the
    latest rows read through a ref, moves before a render applied one after the other). Filter and page are not model state (no grid behaviour); the sort is. Values
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
   **Column reordering (Epic #75, O1–O6):** the model keeps `columnOrder` (keys of columns and
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
   **Row reordering (Epic #86, E2.3):** the grid never orders the rows (D6, the sorting rules),
   so a move is an **event**, never a command on rows: the engine's `row-move` event
   `RowMove { fromIndex, toIndex, rowKey }` (`toIndex` the index once moved: the rows without it,
   it inserted there; `landingIndex`, the columns' too), `Root`'s `onRowMove`, whose presence
   turns it on (the engine option `reorderableRows`, `view.reorderableRows`; a grid without it
   is unchanged: no attribute, part state `undefined`). The app moves its rows (`moveRow(rows,
   fromIndex, toIndex)` and `moveShownRow(rows, shown, …)` in `@fragiola/data-grid/local`,
   `useLocalRows`'s `moveRow(move)` placing it beside the row it lands next to on screen, filtered
   or paged). Refused (`rowsMove(reorderableRows, sortColumns)`, parts): while sorted (the handle
   does not drag, the keys move nothing, documented: clear the sort), a row not loaded (no
   key: neither dragged nor a target), a drop beside itself (null target, nothing told). The
   handle is the app's element with `useRowDragHandle(row)`'s props (a row's or a cell's info;
   `RowDragHandlePart`: `aria-hidden` (a pointer's affordance: the keys move a row from its
   cells), `data-grid-row-drag-handle` = the row index (`ROW_DRAG_HANDLE_ATTRIBUTE`),
   `data-grid-part="row-drag-handle"`, `data-reorderable`, `data-dragging`, an empty `style`;
   `state` `{ rowIndex, reorderable, dragging }`); a plain element, not a control. The drag
   shares the column reorder's machinery (`PointerDrag` with both coordinates, `listen`,
   `capture`, `askFrame`, `endDrag`, `markedOf`, `keptIfSame` (a target worked out again
   unchanged keeps its object, the columns' too), the edge scroll split into
   `edgeStep(at, start, length)` and `edgeScrollBy(vertical, step)`, which tells whether the
   rows moved: none past the first or last row): a primary press on an own
   handle (after the consumer's `onPointerDown`, a prevented one vetoes; not prevented: under
   `CLICK_SLOP` a click, which focuses its cell), past it the row drags (the active cell left as
   it is: `buildView` keeps `rowReorder.rowIndex` in `view.rows`, as the active row, so the
   handle holding the pointer stays rendered through the edge scroll; selection and native drags
   blocked); once a frame the target is the row under the pointer's y (`viewY`, the one layout
   read, at the start, once a frame and on the release) kept over the
   body (`bodyTop`, `bodyHeight`), from the row axis (off screen, measured, variable, details,
   scaled alike), the side of its cells' middle (`cellsSizeOf`: over a detail, after); within
   40 px of the body's top or bottom edge (or past it) the rows scroll up to 20 px a frame
   (from the drag's start too); a scroll during the drag retargets once a frame. After every
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
   `data-dragging`/`data-drop-target` on the row. The active cell follows its row by key, only
   with `rowKey` (an index key cannot tell rows apart: without one it stays at its index): a move
   from the active row remembers it (`movedRow`); at a new source or `rows.changed` that puts the
   key at `toIndex`, the active cell still on `fromIndex`, an `active-position.set` runs (queued
   after that change: no render in between), focus going with it. Kept through rows changing
   otherwise (a server answering in pieces); forgotten once followed, once the active cell is on
   another row (the person or the app moved it), at the next move and when the viewport detaches.
   The indicator, the cursor, `touch-action` and announcements are the app's; live moves,
   between grids, several rows and touch gestures are not the grid's.
11. **Navigation is core behaviour (D11).** The active position lives in the model; the engine maps
    arrows, Home/End, Ctrl+Home/End and PageUp/PageDown onto it (APG grid pattern), scrolls the
    target into view and moves focus with a roving tabindex. Tab leaves the grid. Right to left
    (Epic #85), the arrows mirror (ArrowLeft moves to the next column, `inlineKey`); Home/End stay
    logical. With
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
    controls), on the focused handle ←/→ move it by 10 px (Shift: 50), the column growing the way it grows (`resizeSign`: right, left in RTL, toward the start pinned at the end), Home/End go to the minimum
    and the maximum (its `aria-valuemax`: without a `maxWidth`, the view's width), each one
    `column-widths.resize` after the consumer's handlers, and Enter fits its column to its
    content (one `column-widths.set`, Epic #80); the other page keys and Space do
    nothing there (no paging); Escape leaves interaction and keeps the width. On a reorderable
    header cell in navigation, Ctrl/⌘+Shift+←/→ run one `column-order.move` before the previous
    sibling or after the next (handled at an end or at the pinned edge too, moving nothing),
    after the consumer's handlers; the active cell follows and focus stays on it; on a body cell
    or a fixed header cell they are plain arrows (Epic #75). While rows move (`onRowMove`, Epic
    #86, E2.3), Ctrl/⌘+Shift+↑/↓ on a body cell in navigation (`bodyCellOf`, the selection keys'
    guard too) emit one `row-move` by ∓1, once per press (a repeat moves nothing; handled at the
    first or last row, next to a row not loaded and while sorted too, moving nothing; RTL the
    same), after the consumer's handlers; with `rowKey` the active cell follows the row once the
    app moved it; without `onRowMove` they are plain arrows. A consumer can
    cancel or replace any key, and middleware can refuse or redirect a move. With summary rows
    (Epic #86) the keys move by line through the header, the top summary rows, the body and the
    bottom ones (see D10). ARIA: `role="grid"`,
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
- **Structural inline style only**: `position` (`sticky` on the header, the summary rows'
  `Summary`, `Empty`, pinned cells, a row's detail and a group's label), `top`/`left`/`width`/`height`/`inset` (`right` in place of `left`
  right to left: `inlineSide`), `transform` on the layers,
  `display` (also to make table parts positionable, `flex` on rows and header rows with
  pinned columns, `grid` on a measured row, Epic #86), in a measured row `grid-area` on its
  cells and detail and its cells' inline start margin (`margin-left`, `margin-right` right to
  left: their place, in place of `left`), `align-self` on a measured detail in a row of pinned
  cells, `overflow` on the viewport, `contain`, `box-sizing`, `z-index` between header
  rows (with column groups, an upper row stays above the next, which a column spanning rows
  reaches into), and on a row's detail `margin-top` (its place below the row's cells) and, in a
  row of pinned cells, `margin-left` (`margin-right` right to left) and `flex-shrink: 0` (its box
  from the row's start, never shrunk). Nothing cosmetic. (The root's `dir`, when a direction is
  given, is structural: `Root` renders `view.givenDirection`.)
- **State only through `data-*` and ARIA**, present or absent (never `"false"`; a selectable
  row's `aria-selected="false"` is ARIA's own "selectable, not selected"; a row's drag handle's
  `aria-hidden="true"`): `data-active`,
  `data-loading`, `data-empty`, … Every part carries `data-grid-part` and, for rows and cells,
  `data-row-index`/`data-column-index`; e2e selectors use them, never class names.
- **No text and no names.** Primitives render only their children (or the column's renderer) and
  set no `aria-label` of their own.
- **A column resizer is the app's element (Epic #70, W3).** `useColumnResizer(cell)` returns
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
- **A row's drag handle is the app's element (Epic #86, E2.3).** `useRowDragHandle(row)` returns
  `{ state, props }` (`state`: `rowIndex`, `reorderable`, `dragging`; `props`: `aria-hidden`,
  `data-grid-row-drag-handle`, `data-grid-part="row-drag-handle"`, `data-reorderable`,
  `data-dragging`, an empty `style`); its look, cursor and `touch-action: none` are the app's, and
  it is a plain element, not a control (a press focuses its cell).
- **Hooks have one shape.** `useDataGrid()` is `{ model, engine }` (with a `gridRef`, or `null`
  until a root holds it; `useRow`'s props hold a measured row's `ref`); a part hook (`useRow`, `useCell`, `useHeaderCell`,
  `useColumnResizer`, `useGroupLabel`, `useRowDragHandle`, `useSummaryRow`, `useSummaryCell`) returns
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
  handlers (a prevented Escape keeps the drag); the click ending a drag is the drag's.
  Keys from outside the
  viewport (a menu portalled out of a cell) and from the app's content beside the cells (a
  control in `Empty`) are never the grid's: only its cells, its layers and its viewport.
- **The layers' `transform` is the engine's**: `Body`, `HeaderRow` and `SummaryRow` drop a
  consumer's. The header layer has an element per header row and per summary row: the engine
  writes the same transform to each. A
  pinned column's `Cell`/`HeaderCell` drop a consumer's `transform` and insets (`top`, `left`,
  `right`, `bottom`, `inset*`): its inline start inset (`left`, `right` in RTL) is the engine's.
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
  the flow after `Header`, sticky at the inline start, as large as the visible body), has no text or role
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
