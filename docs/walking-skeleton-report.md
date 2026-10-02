# Walking skeleton report

Epic #1 set out to cross five risky bets end to end with the smallest working surface:
structure-agnostic virtualization, millions of cells in a scroll larger than the browser allows,
windows as the data contract, headless keyboard navigation, and a hybrid state model. This
report records what held, the numbers, what the styled examples could not express, and what
feeds the next Epics.

The examples (`examples/react/src/examples/`) change **no file under `packages/`**. Every gap below
was worked around in an example, or left visible, not patched in the packages.

## 1. What held

### Bet 1: the same primitives as a table or as divs

Held. `apps/playground/e2e/grid.spec.ts` runs the **same nine tests** against the unstyled table
fixture (`table/thead/tbody/tr/th/td` through `render`) and the div fixture, in Chromium and
Firefox (36 runs, all green, also when repeated three times). Table parts become positionable with
structural style only: `display: block` on the table and its header, absolute positions on the
header row, the body, rows and cells (absolute positioning blockifies table parts). The table
keeps `role="grid"` and its elements.

- `packages/react/tests/primitives.test.tsx` checks that no part sets an inline style outside the
  structural list, that no part names itself, and the rest of the primitive contract.
- The `table-elements` and `hello-grid` examples share one `styles.ts`: the look does not depend on
  the elements.

### Bet 2: millions of cells, and a scroll larger than the browser allows

Held.

- **Virtualization**: the view keeps the rendered range while the visible range stays inside it,
  so scrolling inside the overscan renders nothing (the fixture's React `Profiler` counts no
  commit for a two-row scroll; `grid.spec.ts`).
- **Scroll scaling** (`packages/core/src/viewport/scaling.ts`): above a 10M px cap the sizer is
  capped and the engine maps physical onto virtual offsets. Native jumps (thumb, track, fling) are
  proportional with exact ends; the engine's own moves (wheel, keyboard, `scroll-to-cell`) are
  exact, and the scroll event they cause is recognised instead of remapped. In 100,000,000 rows,
  ArrowDown moves exactly one row and keeps it fully in view at 33% and 78% of the dataset; the
  scrollbar's end and Ctrl+End reach row 99,999,999; the same holds sideways over 1,000,000
  columns; variable heights stay exact under scaling (2,000,000 rows). All in Chromium and Firefox.
- Rows and cells are positioned from a per-render **base** (the first rendered row's offset), so
  CSS never sees an offset near the browser's limits.

### Bet 3: windows as the data contract

Held. The engine reports `row-window` and `column-window` (visible and rendered ranges) and
`rows-end-reached` (once per row count).

- `windowed-loading`: a jump from row 0 to about row 900,000 requests only the landing block
  (at most four requests in total, none between), placeholders first (`data-loading`), then rows.
- `windowed-columns`: tiles from both windows; a 2D jump requests only the tiles around the view.
- `infinite-loading`: three more pages, the scroll position unchanged as rows are appended.

### Bet 4: headless keyboard navigation

Held. Navigation is pure (`packages/core/src/navigation`), committed through
`active-position.move`, scrolled into view through the scaling-aware mapping and focused once
rendered (roving tab stop). The active row and column stay rendered out of the window, so focus
survives scrolling away and back. A cell's `onKeyDown` runs before the grid's keys
(`custom-navigation` replaces Tab), and middleware can refuse or redirect a move.

### Bet 5: a hybrid state model

Held. The model has Dockable's verbs (`run`/`can`/`check`/`get`/`is`, `use`, `subscribe`) with a
naming guard test; `DataGrid.Root` maps RDG-style props onto commands. A controlled
`activePosition` goes through a guard middleware that asks `onActivePositionChange` and vetoes,
so only the prop moves it; `useDataGrid().model.run` drives the same state.

## 2. Numbers

| what | measured |
| --- | --- |
| build 10,000,000 variable row offsets (`pnpm bench`) | ~37 ms |
| `windowFor` over 100,000,000 fixed rows | ~10,000,000 calls/s |
| `windowFor` over 10,000,000 variable rows | ~1,600,000 calls/s |
| cells in the page, 1,000,000 × 1,000 at 1200×700 (div fixture) | 350 at the top and the end, 480 in the middle |
| cells in the page, `large-dataset` at 1280×800 (production build) | 496 |
| React commits scrolling 100 rows in 10px steps (dev, StrictMode) | 40; none inside the overscan |
| a page jump, and a one-row step, `large-dataset` (production) | both within two frames (33 ms at 60 Hz) |
| the sizer of 1,000,000 rows × 1,000 columns | 10,000,000 × 100,000 px (rows scaled, columns not) |

## 3. What the styled examples could not express

| # | missing | workaround in the examples | next |
| --- | --- | --- | --- |
| 1 | **Pinned columns**: the row-number column of `large-dataset` scrolls away. | None. | Done in Epic #31: `pinned: "start"` |
| 2 | The **header needs a background and a `z-index`** to cover the rows. | `z-10 bg-palette-base` on `Header`. | Documented; by design (stacking is the consumer's) |
| 3 | Rows loaded by window render only when **`getRow` changes**. | A `getRow` memoised on the cache's version (with a lint suppression). | Done in Epic #23: `rows.changed` |
| 4 | A component outside the grid that shows its **windows** re-renders the grid when its state lives in the grid's parent. | `_kit/store.ts`, written by the callbacks. | Done in Epic #23: `gridRef` and the hooks that take it |
| 5 | No per-column **alignment** hint (numeric columns). | `justify-end` on the cells' classes. | Settled in Epic #23: app policy, `meta` read in the cells' classes (guide "Column alignment") |
| 6 | A **placeholder** for a row not loaded is the app's. | Cell children when `!cell.loaded`. | By design (D6) |

## 4. Decisions taken while building

- **Keys reach the engine through the adapter**, not a native listener: React's handlers on a cell
  run first (bubbling) and can `preventDefault`; `Root` calls `engine.adapter.keydown` after its
  consumer's `onKeyDown`.
- **The root is no tab stop** (`tabIndex={-1}`): Firefox makes a scroll container one. Focus that
  lands on it (or on the grid) without a click goes to the active cell, or the first in view.
- **The view reaches the parts through context** from the root, re-rendered before the first paint
  when attaching the viewport produced a new one (refs attach after the parts' layout effects).
- **Rows are keyed by index** unless the app gives `rowKey`, so a row loading in place keeps its
  elements and focus; the engine restores focus a render removed.
- **Vitest 5** (`bench` is now a test-context fixture) and **React 19.3**, newer than Dockable's.

## 5. What feeds the next Epics

In the roadmap's order (`site/docs/limitations.mdx`): row operations (sort, filter, pagination,
external and local, the local pipeline opt-in), columns (pinned, groups, spans, reorder, resize,
alignment), selection and editing, rows beyond a flat list (grouping, tree, measured heights).
Gaps 3 and 4 above are small API questions worth settling in the first of them.
