// What every adapter's root does with its declarative props (D3, Epic #123): the model and the
// engine it creates, the controlled pieces it binds, the commands its props map onto and the
// engine events it tells. One rule for every adapter: a decision a root takes is the core's, the
// adapter only renders and calls `sync` after each render.

import { createDataGridEngine } from "../engine/engine";
import type {
    CellEdit,
    DataGridEngine,
    RangeFill,
    RowMove,
} from "../engine/types";
import { sameEditingCell } from "../model/editing";
import { DEFAULT_DETAIL_HEIGHT, sameRowKeys } from "../model/expansion";
import {
    createDataGridModel,
    type DataGridModel,
    DEFAULT_HEADER_ROW_HEIGHT,
    DEFAULT_ROW_HEIGHT,
} from "../model/model";
import { keptOrder, sameOrder } from "../model/order";
import { keptRange, sameCellRange } from "../model/range";
import { sameSortColumns, validSortColumns } from "../model/sort";
import type {
    CellPosition,
    CellRange,
    CellSelection,
    ColumnOrder,
    ColumnOrGroup,
    ColumnWidths,
    CommandName,
    DataGridState,
    DetailHeight,
    EditingCell,
    GridDirection,
    RangePaste,
    ResultOf,
    RowHeight,
    RowKey,
    RowKeyGetter,
    RowMetaGetter,
    RowSelectable,
    RowSelection,
    SortColumn,
} from "../model/types";
import { keptWidths, sameWidths } from "../model/widths";
import { sameKeys } from "../utils/utils";
import type { AxisWindow } from "../viewport/window";
import {
    bindControlled,
    type Controlled,
    type ControlledFlags,
    type ControlledState,
} from "./controlled";

/**
 * An edit committed (Epic #88, E4.3), as `onCellEdit` tells it: the cell, its column's key, the
 * value, and the row (loaded: a cell is edited only then), which the app writes it into.
 */
export interface CellEditEvent<TRow> extends CellEdit {
    readonly row: TRow;
}

/** Where the rows come from: all of them, or a count and a getter (D6). */
export type GridRowsProps<TRow> =
    | {
          /** every row (fixed, or growing for infinite loading) */
          rows: readonly TRow[];
          rowCount?: undefined;
          getRow?: undefined;
      }
    | {
          rows?: undefined;
          /** how many rows the grid represents, loaded or not */
          rowCount: number;
          /**
           * the row at an index, or `undefined` while it is not loaded (it renders with
           * `data-loading`). When rows arrive, run `rows.changed` (through a `gridRef` from
           * outside the root), or pass a new function, so the grid renders them.
           */
          getRow: (index: number) => TRow | undefined;
      };

/**
 * A root's declarative props, whatever the framework: the data, the sizes, every piece of state it
 * holds controlled (`x` + `onXChange`) or not (`defaultX`), what it tells, and the engine's
 * options. `TNode` is what the columns' renderers return.
 */
export interface GridRootOptions<TRow, TNode> {
    /** the columns, and the groups above them (nested to any depth) */
    columns: readonly ColumnOrGroup<TRow, TNode>[];
    /** a row's key; without one, rows are keyed by their index */
    rowKey?: RowKeyGetter<TRow> | undefined;
    /**
     * what kind of row an index is (Epic #87): a group row (`group`: the grid reads no row at
     * its index; `getRow` may answer `undefined` there), or a data row at a depth, under a row
     * (`parentIndex`), that may expand (`expandable`). Given, the grid is a `treegrid`; rows
     * in memory get it from `useLocalRows`'s `groupBy`
     */
    getRowMeta?: RowMetaGetter | undefined;
    /**
     * a row's height in pixels, or a function of its index (default 35); `"auto"`: as tall as
     * its content, measured once rendered (`estimatedRowHeight` until then)
     */
    rowHeight?: RowHeight | undefined;
    /**
     * a measured row's height until it is measured, in pixels (default 35): the scrollbar is
     * approximate until the rows are
     */
    estimatedRowHeight?: number | undefined;
    /** a header row's height in pixels (default 35); 0 for no header */
    headerRowHeight?: number | undefined;
    /**
     * how many summary rows the grid has: at the top, under the header, and at the bottom, at
     * the view's bottom edge (default none). Each column's `renderSummaryCell` draws their
     * cells from the app's own values; `DataGrid.Summary` renders them
     */
    summaryRows?:
        | { readonly top?: number; readonly bottom?: number }
        | undefined;
    /** a summary row's height in pixels (default 35) */
    summaryRowHeight?: number | undefined;
    /** the active cell, controlled (`null` for none); pair it with `onActivePositionChange` */
    activePosition?: CellPosition | null | undefined;
    /** the active cell to start with, uncontrolled */
    defaultActivePosition?: CellPosition | null | undefined;
    /** the active cell changed (or, controlled, asks to) */
    onActivePositionChange?:
        | ((position: CellPosition | null) => void)
        | undefined;
    /**
     * the sorted columns, controlled, the first one first; pair it with `onSortColumnsChange`.
     * The grid keeps the sort: the app orders the rows it passes
     */
    sortColumns?: readonly SortColumn[] | undefined;
    /** the sorted columns to start with, uncontrolled */
    defaultSortColumns?: readonly SortColumn[] | undefined;
    /** the sort changed (or, controlled, asks to): a header cell was toggled, or a command ran */
    onSortColumnsChange?:
        | ((sortColumns: readonly SortColumn[]) => void)
        | undefined;
    /**
     * the expanded rows' keys (a row's `rowKey`, else its index), controlled; pair it with
     * `onExpandedRowKeysChange`. An expanded row shows its `DataGrid.RowDetail`
     */
    expandedRowKeys?: readonly RowKey[] | undefined;
    /** the expanded rows' keys to start with, uncontrolled */
    defaultExpandedRowKeys?: readonly RowKey[] | undefined;
    /** the expanded rows changed (or, controlled, ask to): a row was toggled, or a command ran */
    onExpandedRowKeysChange?:
        | ((expandedRowKeys: readonly RowKey[]) => void)
        | undefined;
    /**
     * the expanded row groups' keys (Epic #87: a group row's `GroupRow.key`, a row that
     * expands by its key), controlled; pair it with `onExpandedGroupKeysChange`. The app's
     * rows follow them (`useLocalRows` does it for rows in memory)
     */
    expandedGroupKeys?: readonly RowKey[] | undefined;
    /** the expanded row groups' keys to start with, uncontrolled */
    defaultExpandedGroupKeys?: readonly RowKey[] | undefined;
    /**
     * the expanded row groups changed (or, controlled, ask to): a group was toggled (its
     * toggle, Enter, Space, →, ←), or a command ran
     */
    onExpandedGroupKeysChange?:
        | ((expandedGroupKeys: readonly RowKey[]) => void)
        | undefined;
    /**
     * an expanded row's detail height in pixels, or a function of the row (default 300): it
     * adds to the row's own height. `"auto"`: as tall as its content, measured once rendered
     * (`estimatedDetailHeight` until then)
     */
    detailHeight?: DetailHeight<TRow> | undefined;
    /** a measured detail's height until it is measured, in pixels (default 300) */
    estimatedDetailHeight?: number | undefined;
    /**
     * how rows are selected: one at a time or many (default: not at all). Selected rows carry
     * `data-selected` and `aria-selected`; Shift+Space, Shift+Up/Down and Ctrl/⌘+A select
     */
    rowSelection?: RowSelection | undefined;
    /** whether a loaded row can be selected (default: every row can) */
    isRowSelectable?: RowSelectable<TRow> | undefined;
    /**
     * the selected rows' keys (a row's `rowKey`, else its index), controlled; pair it with
     * `onSelectedRowKeysChange`
     */
    selectedRowKeys?: readonly RowKey[] | undefined;
    /** the selected rows' keys to start with, uncontrolled */
    defaultSelectedRowKeys?: readonly RowKey[] | undefined;
    /** the selection changed (or, controlled, asks to): a row was toggled, or a command ran */
    onSelectedRowKeysChange?:
        | ((selectedRowKeys: readonly RowKey[]) => void)
        | undefined;
    /**
     * the cell being edited (Epic #88): the active one, of a column `editable` for its row;
     * controlled (`null` for none), paired with `onEditingCellChange`
     */
    editingCell?: EditingCell | null | undefined;
    /** the cell being edited to start with, uncontrolled */
    defaultEditingCell?: EditingCell | null | undefined;
    /**
     * an edit started or ended (or, controlled, asks to): Enter, F2, typing or a double click
     * on an editable cell; a commit (Enter, Tab, a click outside) or a cancel (Escape)
     */
    onEditingCellChange?:
        | ((editingCell: EditingCell | null) => void)
        | undefined;
    /**
     * an edit was committed with a new value (Epic #88): the cell, its column's key, the value
     * and the row. Write it into your rows: the grid writes no data
     */
    onCellEdit?: ((edit: CellEditEvent<TRow>) => void) | undefined;
    /**
     * how cells are selected (Epic #88): a range of body cells (default: not at all). Shift
     * with the navigation keys, a press dragged across cells and Shift+click select one; its
     * cells carry `data-selected-cell` and `aria-selected`, its edges' cells
     * `data-range-edge`; Ctrl/⌘+C copies it as TSV and Ctrl/⌘+V pastes into it
     * (`onRangePaste`)
     */
    cellSelection?: CellSelection | undefined;
    /**
     * the selected range of cells (`{ anchor, focus }`, body cells), controlled (`null` for
     * none); pair it with `onSelectedRangeChange`
     */
    selectedRange?: CellRange | null | undefined;
    /** the selected range to start with, uncontrolled */
    defaultSelectedRange?: CellRange | null | undefined;
    /** the selected range changed (or, controlled, asks to): a key, a drag, a click or a command */
    onSelectedRangeChange?: ((range: CellRange | null) => void) | undefined;
    /**
     * values were pasted into the grid (Ctrl/⌘+V on one of its cells, `cellSelection` set): the
     * range they land in, from the selected range's first cell (else the active cell), and
     * the values parsed from the clipboard's text (TSV), as many as land. The app writes them
     * into its rows: the grid writes nothing
     */
    onRangePaste?: ((paste: RangePaste) => void) | undefined;
    /**
     * asked before `onRangePaste`, with the same paste: `false` refuses it (`onRangePaste` is
     * not called), as a middleware would
     */
    onBeforeRangePaste?:
        | ((paste: RangePaste) => boolean | undefined)
        | undefined;
    /**
     * a fill handle was dropped (Epic #88): the range (or the active cell) and the cells it
     * fills, below it or to its end. Given, cells fill: a `useFillHandle` element at the
     * range's corner drags one. The app writes the values (`repeatedFill` in
     * `@fragiola/data-grid/fill` repeats the source's); the grid writes no data
     */
    onFill?: ((fill: RangeFill) => void) | undefined;
    /**
     * the resized columns' widths in pixels, by column key, controlled; pair it with
     * `onColumnWidthsChange`. On screen a column is the first of: its width here (when it is
     * resizable, within its limits), its automatic width (`autoSize`), its flex share
     * (`flex`), its own `width`
     */
    columnWidths?: ColumnWidths | undefined;
    /** the resized columns' widths to start with, uncontrolled */
    defaultColumnWidths?: ColumnWidths | undefined;
    /**
     * the widths changed (or, controlled, ask to): a resizer was dragged (once per frame),
     * moved with the keys, fitted (a double click, Enter, `fit-columns`), or a command ran
     */
    onColumnWidthsChange?: ((columnWidths: ColumnWidths) => void) | undefined;
    /**
     * the order columns and groups take among their siblings, by key, controlled; pair it
     * with `onColumnOrderChange`. The ones not listed keep their place
     */
    columnOrder?: ColumnOrder | undefined;
    /** the column order to start with, uncontrolled */
    defaultColumnOrder?: ColumnOrder | undefined;
    /**
     * the order changed (or, controlled, asks to): a header cell was dropped or moved with
     * the keys, or a command ran
     */
    onColumnOrderChange?: ((columnOrder: ColumnOrder) => void) | undefined;
    /**
     * the collapsed groups' keys (groups with `collapsible`), controlled; pair it with
     * `onCollapsedGroupKeysChange`. A collapsed group shows only its children for that state
     * (`groupShow`)
     */
    collapsedGroupKeys?: readonly string[] | undefined;
    /** the collapsed groups' keys to start with, uncontrolled */
    defaultCollapsedGroupKeys?: readonly string[] | undefined;
    /** the collapsed groups changed (or, controlled, ask to): a group was toggled, or a command ran */
    onCollapsedGroupKeysChange?:
        | ((collapsedGroupKeys: readonly string[]) => void)
        | undefined;
    /**
     * a row was moved (Epic #86): dropped elsewhere by its drag handle (`useRowDragHandle`),
     * or by Ctrl/⌘+Shift+↑/↓ on one of its cells. Given, the rows move: the app moves the row
     * in its own rows, from `fromIndex` to `toIndex` (its index once moved: `moveRow` in
     * `@fragiola/data-grid/local`), and the active cell follows it. Never while the grid is
     * sorted, nor for rows not loaded
     */
    onRowMove?: ((move: RowMove) => void) | undefined;
    /** the rows in view or rendered changed: load what they need */
    onRowWindowChange?: ((window: AxisWindow) => void) | undefined;
    /** the columns in view or rendered changed */
    onColumnWindowChange?: ((window: AxisWindow) => void) | undefined;
    /** the view's last row came within `endReachedThreshold` rows of the end (once per count) */
    onRowsEndReached?: ((info: { rowCount: number }) => void) | undefined;
    /** rows from the end that count as reaching it (default 10) */
    endReachedThreshold?: number | undefined;
    /** items rendered beyond the view on each side (default 4 rows, 2 columns) */
    overscan?: { rows?: number; columns?: number } | undefined;
    /** the cap on an axis's scroll size before scroll scaling takes over (default 10M px) */
    maxScrollSize?: number | undefined;
    /**
     * the grid's direction (default: the page's, as the browser computes it for the root): in
     * `"rtl"` its start is the right edge, the columns, pinned ones and scroll mirrored, and
     * ArrowLeft moves to the next column. Given, the root renders it as `dir` (on the server
     * too); without it, the root has none
     */
    direction?: GridDirection | undefined;
    /**
     * nested in another grid's cell, row or detail, keep a tab stop of its own, as a grid on its
     * own does (default off: its tab stops are in the page's tab order only while the outer
     * grid's active cell, or row, holds it, or focus is inside it)
     */
    ownTabStop?: boolean | undefined;
}

/** A root's props as the core reads them: where its rows come from, and the rest. */
export type GridRootProps<TRow, TNode> = GridRowsProps<TRow> &
    GridRootOptions<TRow, TNode>;

/** Every prop name of a root's props (`GridRootProps`): what a root takes, not its element. */
export const GRID_ROOT_PROPS = [
    "columns",
    "rows",
    "rowCount",
    "getRow",
    "getRowMeta",
    "rowKey",
    "rowHeight",
    "estimatedRowHeight",
    "headerRowHeight",
    "summaryRows",
    "summaryRowHeight",
    "activePosition",
    "defaultActivePosition",
    "onActivePositionChange",
    "sortColumns",
    "defaultSortColumns",
    "onSortColumnsChange",
    "expandedRowKeys",
    "defaultExpandedRowKeys",
    "onExpandedRowKeysChange",
    "expandedGroupKeys",
    "defaultExpandedGroupKeys",
    "onExpandedGroupKeysChange",
    "detailHeight",
    "estimatedDetailHeight",
    "rowSelection",
    "isRowSelectable",
    "selectedRowKeys",
    "defaultSelectedRowKeys",
    "onSelectedRowKeysChange",
    "editingCell",
    "defaultEditingCell",
    "onEditingCellChange",
    "onCellEdit",
    "cellSelection",
    "selectedRange",
    "defaultSelectedRange",
    "onSelectedRangeChange",
    "onRangePaste",
    "onBeforeRangePaste",
    "onFill",
    "columnWidths",
    "defaultColumnWidths",
    "onColumnWidthsChange",
    "columnOrder",
    "defaultColumnOrder",
    "onColumnOrderChange",
    "collapsedGroupKeys",
    "defaultCollapsedGroupKeys",
    "onCollapsedGroupKeysChange",
    "onRowMove",
    "onRowWindowChange",
    "onColumnWindowChange",
    "onRowsEndReached",
    "endReachedThreshold",
    "overscan",
    "maxScrollSize",
    "direction",
    "ownTabStop",
] as const satisfies readonly (keyof GridRootProps<unknown, unknown>)[];

/** A root prop name: one of `GRID_ROOT_PROPS`, which lists every one (a type test checks it). */
export type GridRootPropName = (typeof GRID_ROOT_PROPS)[number];

/**
 * Props without the root's own (`GRID_ROOT_PROPS`): what goes on the root's element. A new object
 * (an adapter's render reads it once).
 */
export function withoutRootProps<P extends object>(
    props: P,
): Omit<P, GridRootPropName> {
    const rest: Record<string, unknown> = {};
    for (const key in props) {
        if (!ROOT_PROP_SET.has(key)) {
            rest[key] = props[key];
        }
    }
    return rest as Omit<P, GridRootPropName>;
}

const ROOT_PROP_SET: ReadonlySet<string> = new Set(GRID_ROOT_PROPS);

/** What `bindGridRoot` gives the adapter's root. */
export interface GridRoot<TRow, TNode> {
    readonly model: DataGridModel<TRow, TNode>;
    readonly engine: DataGridEngine<TRow, TNode>;
    /**
     * After every render of the root (before paint, the parts' layout done): the props follow
     * onto the model, each group of them only when one of its props changed (the first call: all
     * of them), the controlled pieces settle, and the engine takes its options. The first call
     * also tells the app a value to start with the grid did not take as given.
     */
    sync(): void;
}

/** What `selected-rows.toggle` returns: the keys, and the anchor it leaves. */
type ToggleResult = ResultOf<"selected-rows.toggle">;

/** Whether two active positions are the same cell (or both none). */
export function samePosition(
    a: CellPosition | null | undefined,
    b: CellPosition | null | undefined,
): boolean {
    return (
        (a ?? null) === (b ?? null) ||
        (a?.rowIndex === b?.rowIndex && a?.columnIndex === b?.columnIndex)
    );
}

/** Whether the model's source is the one these props give: the same rows, or count and getter. */
export function sourceMatches<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    props: GridRowsProps<TRow> & { getRowMeta?: RowMetaGetter | undefined },
): boolean {
    const { source } = state;
    if (source.getRowMeta !== props.getRowMeta) return false;
    if (props.rows !== undefined) {
        return "rows" in source && source.rows === props.rows;
    }
    return (
        !("rows" in source) &&
        source.getRow === props.getRow &&
        source.rowCount === props.rowCount
    );
}

/**
 * A controlled state over the root's props (the active position, the sort, the expanded rows, the
 * selection, the column widths and order): its prop, its handler, its default.
 */
interface PropsState<TRow, TNode, V>
    extends Pick<
        ControlledState<TRow, TNode, V>,
        "prefix" | "read" | "same" | "apply" | "vetoed"
    > {
    readonly prop: (props: GridRootProps<TRow, TNode>) => V | undefined;
    readonly onChange: (
        props: GridRootProps<TRow, TNode>,
    ) => ((value: V) => void) | undefined;
    /** the value to start with, uncontrolled, when the grid may not take all of it */
    readonly start?: (props: GridRootProps<TRow, TNode>) => V | undefined;
    /** what a command makes it, from the command's value; without it, that value itself */
    readonly fromCommand?: (command: CommandName, value: unknown) => V;
}

/** The controlled state the root's latest props hold: its prop, its handler, its default. */
function propsState<TRow, TNode, V>(
    latest: () => GridRootProps<TRow, TNode>,
    spec: PropsState<TRow, TNode, V>,
): ControlledState<TRow, TNode, V> {
    const { start } = spec;
    return {
        // its `prefix`, `read`, `same`, `apply` and `vetoed` as given
        ...spec,
        valueOf: spec.fromCommand ?? ((_, value) => value as V),
        prop: () => spec.prop(latest()),
        report: (value) => spec.onChange(latest())?.(value),
        start: start && (() => start(latest())),
    };
}

/**
 * A group of props a root follows together: what it reads of them (compared one by one with the
 * last values it ran on, by identity), and what it runs when one changed.
 */
interface PropsGroup<TRow, TNode> {
    readonly inputs: (props: GridRootProps<TRow, TNode>) => readonly unknown[];
    readonly run: (props: GridRootProps<TRow, TNode>) => void;
}

/** Whether two lists of inputs hold the same values, by identity. */
function sameInputs(
    a: readonly unknown[] | undefined,
    b: readonly unknown[],
): boolean {
    return (
        a !== undefined &&
        a.length === b.length &&
        a.every((value, index) => Object.is(value, b[index]))
    );
}

/**
 * Binds a root to a new model and engine, from its props as they are now (`props` reads the
 * latest ones: the handlers are read when called). The adapter renders the engine's view and
 * calls `sync()` after every render; its element's keys, clicks, presses and clipboard events go
 * to `engine.adapter` after the consumer's own handlers.
 */
export function bindGridRoot<TRow, TNode>(
    props: () => GridRootProps<TRow, TNode>,
): GridRoot<TRow, TNode> {
    const initial = props();
    const model = createDataGridModel<TRow, TNode>({
        columns: initial.columns,
        ...(initial.rows !== undefined
            ? { rows: initial.rows }
            : { rowCount: initial.rowCount ?? 0, getRow: initial.getRow }),
        getRowMeta: initial.getRowMeta,
        rowKey: initial.rowKey,
        rowHeight: initial.rowHeight,
        estimatedRowHeight: initial.estimatedRowHeight,
        headerRowHeight: initial.headerRowHeight,
        summaryRows: initial.summaryRows,
        summaryRowHeight: initial.summaryRowHeight,
        activePosition:
            initial.activePosition !== undefined
                ? initial.activePosition
                : initial.defaultActivePosition,
        sortColumns: initial.sortColumns ?? initial.defaultSortColumns,
        expandedRowKeys:
            initial.expandedRowKeys ?? initial.defaultExpandedRowKeys,
        expandedGroupKeys:
            initial.expandedGroupKeys ?? initial.defaultExpandedGroupKeys,
        detailHeight: initial.detailHeight,
        estimatedDetailHeight: initial.estimatedDetailHeight,
        rowSelection: initial.rowSelection,
        isRowSelectable: initial.isRowSelectable,
        selectedRowKeys:
            initial.selectedRowKeys ?? initial.defaultSelectedRowKeys,
        editingCell:
            initial.editingCell !== undefined
                ? initial.editingCell
                : initial.defaultEditingCell,
        cellSelection: initial.cellSelection,
        selectedRange:
            initial.selectedRange !== undefined
                ? initial.selectedRange
                : initial.defaultSelectedRange,
        columnWidths: initial.columnWidths ?? initial.defaultColumnWidths,
        columnOrder: initial.columnOrder ?? initial.defaultColumnOrder,
        collapsedGroupKeys:
            initial.collapsedGroupKeys ?? initial.defaultCollapsedGroupKeys,
        direction: initial.direction,
    });
    const flags: ControlledFlags = { syncing: false, applying: false };
    // each piece guarded on its own commands (the order they are bound in tells uncontrolled
    // changes in that order)
    const bind = <V>(spec: PropsState<TRow, TNode, V>) =>
        bindControlled(model, flags, propsState(props, spec));
    const position = bind<CellPosition | null>({
        prefix: "active-position.",
        prop: (props) => props.activePosition,
        onChange: (props) => props.onActivePositionChange,
        read: (state) => state.activePosition,
        same: samePosition,
        fromCommand: (command, value) =>
            command === "active-position.clear"
                ? null
                : (value as CellPosition),
        apply: (value) => {
            if (value === null) model.run("active-position.clear");
            else model.run("active-position.set", value);
        },
    });
    const sort = bind<readonly SortColumn[]>({
        prefix: "sort-columns.",
        prop: (props) => props.sortColumns,
        onChange: (props) => props.onSortColumnsChange,
        // an uncontrolled sort the columns could not take all of (a column not sortable) starts
        // without it: the app is told the sort the grid holds
        start: (props) => props.defaultSortColumns,
        read: (state) => state.sortColumns,
        same: sameSortColumns,
        // what the columns cannot take (a column not sortable, twice) is left out, as at mount,
        // and the parent is told the sort as it settled
        apply: (value) => {
            model.run("sort-columns.set", {
                sortColumns: validSortColumns(model.state.columnEntries, value),
            });
        },
    });
    const expanded = bind<readonly RowKey[]>({
        prefix: "expanded-rows.",
        prop: (props) => props.expandedRowKeys,
        onChange: (props) => props.onExpandedRowKeysChange,
        read: (state) => state.expandedRowKeys,
        same: sameRowKeys,
        apply: (rowKeys) => {
            model.run("expanded-rows.set", { rowKeys });
        },
    });
    const groups = bind<readonly RowKey[]>({
        prefix: "row-groups.",
        prop: (props) => props.expandedGroupKeys,
        onChange: (props) => props.onExpandedGroupKeysChange,
        read: (state) => state.expandedGroupKeys,
        // a set: the same keys in another order are no change
        same: sameKeys,
        apply: (groupKeys) => {
            model.run("row-groups.set", { groupKeys });
        },
    });
    const selection = bind<readonly RowKey[]>({
        prefix: "selected-rows.",
        // the keys follow the prop while rows are selectable; off, the model keeps the keys it
        // had (no row shows them) and the prop waits until it is on again
        prop: (props) =>
            props.rowSelection ? props.selectedRowKeys : undefined,
        onChange: (props) => props.onSelectedRowKeysChange,
        // an uncontrolled selection to start with that single mode trimmed (its last key kept):
        // the app is told the keys the grid holds
        start: (props) =>
            props.rowSelection ? props.defaultSelectedRowKeys : undefined,
        read: (state) => state.selectedRowKeys,
        same: sameRowKeys,
        fromCommand: (command, value) =>
            command === "selected-rows.toggle"
                ? (value as ToggleResult).rowKeys
                : (value as readonly RowKey[]),
        apply: (rowKeys) => {
            model.run("selected-rows.set", { rowKeys });
        },
        // the parent answers the keys; where a range starts is the grid's: a toggle's anchor is
        // kept as the model would have left it
        vetoed: (command, value) => {
            if (command !== "selected-rows.toggle") return;
            const { anchor } = value as ToggleResult;
            if (anchor) {
                model.run("selection-anchor.set", {
                    rowIndex: anchor.rowIndex,
                    selected: anchor.selected,
                });
            } else {
                model.run("selection-anchor.clear", {});
            }
        },
    });
    const editing = bind<EditingCell | null>({
        prefix: "editing-cell.",
        prop: (props) => props.editingCell,
        onChange: (props) => props.onEditingCellChange,
        start: (props) => props.defaultEditingCell,
        read: (state) => state.editingCell,
        same: sameEditingCell,
        fromCommand: (command, value) =>
            command === "editing-cell.clear" ? null : (value as EditingCell),
        // an edit the grid cannot take (not the active cell, not editable) settles told
        apply: (value) => {
            if (value === null) model.run("editing-cell.clear", {});
            else model.run("editing-cell.set", value);
        },
    });
    const range = bind<CellRange | null>({
        prefix: "selected-range.",
        // the range follows the prop while cells are selectable; off, there is none
        prop: (props) =>
            props.cellSelection ? props.selectedRange : undefined,
        onChange: (props) => props.onSelectedRangeChange,
        // a range to start with the body could not hold (cells outside it) starts inside it: the
        // app is told the range the grid holds
        start: (props) =>
            props.cellSelection ? props.defaultSelectedRange : undefined,
        read: (state) => state.selectedRange,
        same: sameCellRange,
        fromCommand: (command, value) =>
            command === "selected-range.clear" ? null : (value as CellRange),
        // kept inside the body, as at mount, and the parent told the range as it settled
        apply: (value) => {
            const kept = keptRange(model.state, value);
            if (kept) model.run("selected-range.set", kept);
            else model.run("selected-range.clear", {});
        },
    });
    const widths = bind<ColumnWidths>({
        prefix: "column-widths.",
        prop: (props) => props.columnWidths,
        onChange: (props) => props.onColumnWidthsChange,
        // uncontrolled widths to start with that were not all widths start without those: the
        // app is told the ones the grid holds
        start: (props) => props.defaultColumnWidths,
        read: (state) => state.columnWidths,
        same: sameWidths,
        // an entry that is not a width is left out, as at mount, and the parent is told the
        // widths as they settled
        apply: (columnWidths) => {
            model.run("column-widths.set", {
                columnWidths: keptWidths(columnWidths),
            });
        },
    });
    const order = bind<ColumnOrder>({
        prefix: "column-order.",
        prop: (props) => props.columnOrder,
        onChange: (props) => props.onColumnOrderChange,
        // an uncontrolled order to start with that listed a key twice (or a value that is no
        // key) starts without those: the app is told the order the grid holds
        start: (props) => props.defaultColumnOrder,
        read: (state) => state.columnOrder,
        same: sameOrder,
        // kept as at mount, and the parent told the order as it settled
        apply: (columnOrder) => {
            model.run("column-order.set", {
                columnOrder: keptOrder(columnOrder),
            });
        },
    });
    const collapsed = bind<readonly string[]>({
        prefix: "column-groups.",
        prop: (props) => props.collapsedGroupKeys,
        onChange: (props) => props.onCollapsedGroupKeysChange,
        // keys to start with that were not all strings (or listed one twice) start without
        // those: the app is told the keys the grid holds
        start: (props) => props.defaultCollapsedGroupKeys,
        read: (state) => state.collapsedGroupKeys,
        // a set: the same keys in another order are no change
        same: sameKeys,
        // kept as at mount, and the parent told the keys as they settled
        apply: (groupKeys) => {
            model.run("column-groups.set", {
                groupKeys: keptOrder(groupKeys),
            });
        },
    });
    const engine = createDataGridEngine<TRow, TNode>(
        model,
        engineOptions(initial),
    );
    // subscribed before the viewport attaches, so the first windows are reported too
    engine.subscribe("row-window", (rows) => props().onRowWindowChange?.(rows));
    engine.subscribe("column-window", (columns) =>
        props().onColumnWindowChange?.(columns),
    );
    engine.subscribe("rows-end-reached", (info) =>
        props().onRowsEndReached?.(info),
    );
    engine.subscribe("row-move", (move) => props().onRowMove?.(move));
    // an edit committed (Epic #88): told with its row, loaded while it is edited
    engine.subscribe("cell-edit", (edit) => {
        const row = model.get("row-by", { index: edit.rowIndex });
        if (row !== undefined) props().onCellEdit?.({ ...edit, row });
    });
    // a fill (Epic #88): told
    engine.subscribe("range-fill", (filled) => props().onFill?.(filled));
    // a paste (Epic #88): asked first, then told
    engine.subscribe("range-paste", (paste) => {
        const { onBeforeRangePaste, onRangePaste } = props();
        if (onBeforeRangePaste?.(paste) === false) return;
        onRangePaste?.(paste);
    });
    // followed before the data props, in this order: the layout inputs, then the active position
    const layout: readonly Controlled[] = [widths, order, collapsed, position];
    // settled (and started) in this order: the layout inputs first, so a position the order or a
    // collapse moved settles in the same pass; then the selection before the sort, as their
    // values to start with are told
    const controlled: readonly Controlled[] = [
        ...layout,
        editing,
        selection,
        range,
        sort,
        expanded,
        groups,
    ];
    const data = dataGroups(model);
    const options: PropsGroup<TRow, TNode> = {
        inputs: (props) => [
            props.overscan?.rows,
            props.overscan?.columns,
            props.maxScrollSize,
            props.endReachedThreshold,
            props.onRowMove !== undefined,
            props.onFill !== undefined,
            props.ownTabStop,
        ],
        run: (props) => engine.adapter.setOptions(engineOptions(props)),
    };
    const ran = new Map<PropsGroup<TRow, TNode>, readonly unknown[]>();
    const follow = (
        group: PropsGroup<TRow, TNode>,
        current: typeof initial,
    ) => {
        const inputs = group.inputs(current);
        if (sameInputs(ran.get(group), inputs)) return;
        ran.set(group, inputs);
        group.run(current);
    };
    let started = false;
    return {
        model,
        engine,
        sync() {
            const current = props();
            // the props follow onto the model. Controlled widths, order and collapsed groups
            // first: layout inputs, the axis a position scrolls into view against (an order or a
            // collapse moves the active cell with its column: there it stays unless its own prop
            // changed, told at the settle). Then a controlled position: valid before the data
            // changes (rows filtered down), it survives them
            for (const piece of layout) piece.follow();
            flags.applying = true;
            for (const group of data) follow(group, current);
            // and last: a controlled position valid only after the data changed (rows grown)
            // follows now; one the data made impossible was clamped by the model, and the parent
            // is told where. A controlled sort follows the columns, and one they cannot take is
            // told as it settled
            flags.applying = false;
            for (const piece of controlled) piece.settle();
            // uncontrolled, a value to start with the grid could not take as given (the
            // selection single mode trimmed, the sort the columns could not take all of, widths
            // that were not all widths, an order listing a key twice): the app is told the one
            // it holds
            if (!started) {
                started = true;
                for (const piece of controlled) piece.start();
            }
            follow(options, current);
        },
    };
}

/** The engine's options a root's props give. */
function engineOptions<TRow, TNode>(props: GridRootProps<TRow, TNode>) {
    return {
        overscan: {
            rows: props.overscan?.rows,
            columns: props.overscan?.columns,
        },
        maxScrollSize: props.maxScrollSize,
        endReachedThreshold: props.endReachedThreshold,
        // the rows move while the app takes their moves
        reorderableRows: props.onRowMove !== undefined,
        // cells fill while the app takes their fills
        fillable: props.onFill !== undefined,
        ownTabStop: props.ownTabStop,
    };
}

/** The data props a root follows, group by group, in this order. */
function dataGroups<TRow, TNode>(
    model: DataGridModel<TRow, TNode>,
): readonly PropsGroup<TRow, TNode>[] {
    return [
        {
            inputs: (props) => [props.columns],
            run: ({ columns }) => {
                if (columns !== model.state.columnEntries) {
                    model.run("columns.set", { columns });
                }
            },
        },
        {
            inputs: (props) => [
                props.rows,
                props.rowCount,
                props.getRow,
                props.getRowMeta,
                props.rowKey,
            ],
            run: (props) => {
                const { rows, rowCount, getRow, getRowMeta, rowKey } = props;
                if (
                    sourceMatches(model.state, props) &&
                    rowKey === model.state.rowKey
                ) {
                    return;
                }
                model.run(
                    "data.set",
                    rows !== undefined
                        ? { rows, getRowMeta, rowKey }
                        : {
                              rowCount: rowCount ?? 0,
                              getRow: getRow ?? (() => undefined),
                              getRowMeta,
                              rowKey,
                          },
                );
            },
        },
        {
            inputs: (props) => [
                props.rowHeight,
                props.headerRowHeight,
                props.summaryRowHeight,
                props.detailHeight,
                props.estimatedRowHeight,
                props.estimatedDetailHeight,
            ],
            run: (props) => {
                const { state } = model;
                // a prop removed goes back to the default
                const rows = props.rowHeight ?? DEFAULT_ROW_HEIGHT;
                const header =
                    props.headerRowHeight ?? DEFAULT_HEADER_ROW_HEIGHT;
                const summary = props.summaryRowHeight ?? DEFAULT_ROW_HEIGHT;
                const detail = props.detailHeight ?? DEFAULT_DETAIL_HEIGHT;
                // the three sizes together when one changed, as always; the summary rows' height
                // and the estimates (Epic #86) each on its own, only when it changed: one refused
                // (an estimate that is no size above 0) never holds the others back
                if (
                    rows !== state.rowHeight ||
                    header !== state.headerRowHeight ||
                    detail !== state.detailHeight
                ) {
                    model.run("sizes.set", {
                        rowHeight: rows,
                        headerRowHeight: header,
                        detailHeight: detail,
                    });
                }
                if (summary !== model.state.summaryRowHeight) {
                    model.run("sizes.set", { summaryRowHeight: summary });
                }
                const rowEstimate =
                    props.estimatedRowHeight ?? DEFAULT_ROW_HEIGHT;
                const detailEstimate =
                    props.estimatedDetailHeight ?? DEFAULT_DETAIL_HEIGHT;
                if (rowEstimate !== model.state.estimatedRowHeight) {
                    model.run("sizes.set", { estimatedRowHeight: rowEstimate });
                }
                if (detailEstimate !== model.state.estimatedDetailHeight) {
                    model.run("sizes.set", {
                        estimatedDetailHeight: detailEstimate,
                    });
                }
            },
        },
        {
            inputs: (props) => [
                props.summaryRows?.top ?? 0,
                props.summaryRows?.bottom ?? 0,
            ],
            run: (props) => {
                const top = props.summaryRows?.top ?? 0;
                const bottom = props.summaryRows?.bottom ?? 0;
                const held = model.state.summaryRows;
                // a count left out (the prop removed) is 0
                if (top !== held.top || bottom !== held.bottom) {
                    model.run("summary-rows.set", { top, bottom });
                }
            },
        },
        {
            inputs: (props) => [props.rowSelection, props.isRowSelectable],
            run: ({ rowSelection, isRowSelectable }) => {
                const { state } = model;
                if (
                    rowSelection !== state.rowSelection ||
                    isRowSelectable !== state.isRowSelectable
                ) {
                    // a prop removed turns it off
                    model.run("row-selection.set", {
                        rowSelection: rowSelection ?? null,
                        isRowSelectable: isRowSelectable ?? null,
                    });
                }
            },
        },
        {
            inputs: (props) => [props.cellSelection],
            run: ({ cellSelection }) => {
                // a prop removed turns it off (Epic #88): the range goes
                if (cellSelection !== model.state.cellSelection) {
                    model.run("cell-selection.set", {
                        cellSelection: cellSelection ?? null,
                    });
                }
            },
        },
        {
            inputs: (props) => [props.direction],
            run: ({ direction }) => {
                // a prop removed goes back to the page's direction (the engine reads the
                // viewport's)
                if (direction !== model.state.direction) {
                    model.run("direction.set", {
                        direction: direction ?? null,
                    });
                }
            },
        },
    ];
}
