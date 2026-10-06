import {
    columnsError,
    headerRowCount,
    isHeaderRow,
    layoutColumns,
} from "../header/header";
import {
    DIRECTIONS,
    type GridBounds,
    isRowOf,
    keptRow,
    nextPosition,
    sameCell,
} from "../navigation/navigation";
import { clamp, isIndex, keySet, sameKeys, toggledKey } from "../utils";
import { overlaps } from "../viewport/window";
import {
    collapsingKeys,
    followedColumn,
    groupByKey,
    isGroupCollapsed,
} from "./collapse";
import {
    DEFAULT_DETAIL_HEIGHT,
    expandedRowsOf,
    holdsRow,
    isRowKey,
    newRowsOf,
    type RowKeyHints,
    sameRowKeys,
    uniqueRowKeys,
    withExpandedRows,
    withRow,
} from "./expansion";
import {
    isReorderable,
    keptOrder,
    landingIndex,
    movedOrder,
    sameOrder,
    siblingOrder,
    siblingsOf,
} from "./order";
import { isBodyCell, isCellSelected, keptRange, sameCellRange } from "./range";
import { done, fail, veto } from "./result";
import {
    allKeys,
    extendedKeys,
    groupSelectable,
    groupToggledKeys,
    isRowSelectable,
    isRowSelected,
    keptAnchor,
    keptRowKeys,
    notLoaded,
    ROW_SELECTIONS,
    sameAnchor,
    toggledKeys,
    validAnchor,
} from "./selection";
import {
    SORT_DIRECTIONS,
    sameSortColumns,
    sortableColumn,
    toggledSort,
    validSortColumns,
} from "./sort";
import {
    cellValue,
    dataRowAt,
    groupAt,
    groupCellValue,
    groupKeyAt,
    isGroupExpanded,
    keyOf,
    loadedRowKey,
    type RowsState,
    rowAt,
    rowCountOf,
    rowKeyAt,
    rowLoaded,
    rowMetaAt,
} from "./source";
import { activeInCell, coveringCell, hasColumnSpans, spanAt } from "./spans";
import {
    NO_SUMMARY_ROWS,
    summaryRowAt,
    summaryRowCounts,
    summaryRowIndex,
} from "./summary";
import type {
    CellPosition,
    CellRange,
    CellSelection,
    Column,
    ColumnOrder,
    ColumnOrGroup,
    ColumnWidths,
    CommandArgs,
    CommandContext,
    CommandFailure,
    CommandListener,
    CommandMap,
    CommandName,
    CommandResult,
    DataGridModelOptions,
    DataGridState,
    GridDirection,
    GroupRow,
    Middleware,
    PayloadArgs,
    PayloadOf,
    QueryKey,
    QueryMap,
    QuestionKey,
    QuestionMap,
    ReorderSide,
    ResultOf,
    RowKey,
    RowKeyGetter,
    RowMeta,
    RowSource,
    SelectionAnchor,
    SortColumn,
} from "./types";
import {
    type ColumnSpan,
    columnWidth,
    keptWidths,
    keptWidthsOf,
    resizedWidths,
    sameWidths,
    spanResizable,
    withoutWidths,
} from "./widths";

// The model (D3): the grid's data and rules, the single source of truth. Every change is a
// command through the middleware chain; reads are `get`/`is` keys. It loads and runs in plain
// Node: no DOM, no framework.

/** A row's height when none is given. */
export const DEFAULT_ROW_HEIGHT = 35;
/** The header row's height when none is given. */
export const DEFAULT_HEADER_ROW_HEIGHT = 35;

/** The grid's model. */
export interface DataGridModel<TRow, TNode = unknown> {
    /** the committed state: immutable, a new object after every committed command */
    readonly state: DataGridState<TRow, TNode>;
    /** runs a command through the middleware chain and commits it */
    run<C extends CommandName>(
        command: C,
        ...payload: CommandArgs<C, TRow, TNode>
    ): CommandResult<ResultOf<C, TRow, TNode>>;
    /** whether the command would apply now (a dry run: nothing is committed) */
    can<C extends CommandName>(
        command: C,
        ...payload: CommandArgs<C, TRow, TNode>
    ): boolean;
    /** what the command would return now (a dry run: nothing is committed) */
    check<C extends CommandName>(
        command: C,
        ...payload: CommandArgs<C, TRow, TNode>
    ): CommandResult<ResultOf<C, TRow, TNode>>;
    /** reads a value */
    get<K extends QueryKey>(
        key: K,
        ...payload: PayloadArgs<QueryMap<TRow, TNode>[K]["payload"]>
    ): QueryMap<TRow, TNode>[K]["result"];
    /** answers a yes/no question */
    is<K extends QuestionKey>(key: K, payload: QuestionMap[K]): boolean;
    /** adds a middleware around every command; returns its removal */
    use(middleware: Middleware<TRow, TNode>): () => void;
    /** listens to every committed command; returns the unsubscription */
    subscribe(listener: CommandListener<TRow, TNode>): () => void;
}

type Applied<TRow, TNode, R> = CommandResult<{
    state: DataGridState<TRow, TNode>;
    value: R;
    /** the payload the command ran with, after the middleware rewrote it */
    payload?: unknown;
}>;

type Handlers<TRow, TNode> = {
    [C in CommandName]: (
        state: DataGridState<TRow, TNode>,
        payload: PayloadOf<C, TRow, TNode>,
    ) => Applied<TRow, TNode, ResultOf<C, TRow, TNode>>;
};

/** The refusal of a toggle given neither a row's index nor its key. */
const TOGGLE_BY =
    "toggle a rowIndex, or a rowKey (a string or a finite number)";

/** The refusal of a row group's toggle given neither a row's index nor a key. */
const TOGGLE_GROUP_BY =
    "toggle a rowIndex, or a groupKey (a string or a finite number)";

/** The sides a column lands on, beside a sibling. */
const REORDER_SIDES: readonly ReorderSide[] = ["before", "after"];

/** A column's part, as a refused move names it. */
const PART_NAMES = {
    start: "pinned at the start",
    end: "pinned at the end",
    none: "unpinned",
} as const;

/** The grid's directions. */
const GRID_DIRECTIONS: readonly GridDirection[] = ["ltr", "rtl"];

/** The refusal of a payload that is not what the command takes. */
function invalid(message: string): CommandFailure {
    return fail("invalid_payload", message);
}

/** The refusal of a value that is none of `list`. */
function notOneOf(name: string, list: readonly string[]): CommandFailure {
    return invalid(`${name} must be one of ${list.join(", ")}`);
}

/** Every selection command's refusal while rows are not selectable. */
function selectionOff(): CommandFailure {
    return fail("refused", "rows are not selectable (no rowSelection)");
}

/**
 * The state after a command, its range kept to its rule (Epic #88): a range's anchor is the
 * active cell where it started, so the active cell moving elsewhere (a click, a Tab, a control
 * taking focus, the keys, the app's `active-position.set`, a new order) leaves no range; a range
 * the active cell did not start (select-all) stays until it moves.
 */
function withAnchoredRange<TRow, TNode>(
    before: DataGridState<TRow, TNode>,
    after: DataGridState<TRow, TNode>,
): DataGridState<TRow, TNode> {
    const range = after.selectedRange;
    const active = after.activePosition;
    if (
        !range ||
        active === before.activePosition ||
        (active !== null && sameCell(active, range.anchor))
    ) {
        return after;
    }
    return { ...after, selectedRange: null };
}

/** The cell selection modes, for validation. */
const CELL_SELECTIONS: readonly CellSelection[] = ["range"];

/** Every range command's refusal while cells are not selectable (Epic #88). */
function cellsOff(): CommandFailure {
    return fail("refused", "cells are not selectable (no cellSelection)");
}

/** The refusal of a range corner that is no body cell. */
function noBodyCell(position: CellPosition): CommandFailure {
    return fail(
        "not_found",
        `no body cell at row ${position?.rowIndex}, column ${position?.columnIndex}`,
    );
}

/** The state with a selected range (the same object when it is the same cells), and it. */
function withRange<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    range: CellRange,
): Applied<TRow, TNode, CellRange> {
    if (sameCellRange(range, state.selectedRange) && state.selectedRange) {
        return done(state, state.selectedRange);
    }
    const kept = {
        anchor: {
            rowIndex: range.anchor.rowIndex,
            columnIndex: range.anchor.columnIndex,
        },
        focus: {
            rowIndex: range.focus.rowIndex,
            columnIndex: range.focus.columnIndex,
        },
    };
    return done({ ...state, selectedRange: kept }, kept);
}

/**
 * What the keys move a range's focus in (E4.1): the body's rows only (no header, no summary rows),
 * the columns, and their spans (E1.2).
 */
function bodyBoundsOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): GridBounds {
    const bounds = boundsOf(state);
    return {
        rowCount: bounds.rowCount,
        columnCount: bounds.columnCount,
        headerRowCount: 0,
        cellSpanAt: bounds.cellSpanAt,
    };
}

/**
 * What moves in the grid are bounded by: its rows, its columns, its header's cells, its summary
 * rows (E2.1) and, with column spans, its body and summary rows' cells (E1.2).
 */
function boundsOf<TRow, TNode>(state: DataGridState<TRow, TNode>): GridBounds {
    return {
        rowCount: state.rowCount,
        columnCount: state.columns.length,
        headerRowCount: headerRowCount(state),
        headerDepth: state.header.depth,
        summaryRows: state.summaryRows,
        headerCellAt: state.header.cellAt,
        cellSpanAt: hasColumnSpans(state.columns)
            ? (rowIndex, columnIndex) => spanAt(state, rowIndex, columnIndex)
            : undefined,
    };
}

/**
 * A position inside a cell's span, as that cell's position: its first column, on the same row (a
 * header cell's; a column spanning header rows has a position on each of them; a body cell's
 * under a column span, E1.2).
 */
function cellPosition<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    position: CellPosition,
): CellPosition {
    const columnIndex = coveringCell(state, position)?.columnIndex;
    return columnIndex !== undefined && columnIndex !== position.columnIndex
        ? { rowIndex: position.rowIndex, columnIndex }
        : position;
}

/** Whether a position is a cell: a header row shown, a summary row or a body row, and a column. */
function isCell<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    { rowIndex, columnIndex }: CellPosition,
): boolean {
    return (
        isRowOf(rowIndex, boundsOf(state)) &&
        isIndex(columnIndex, state.columns.length)
    );
}

/**
 * The active row kept in the grid after its shape changed from `before`'s (Epic #86, E2.1): a
 * summary row as the same row of its position (the last one left there), its index following
 * the header's depth, the counts and the rows; with none left there, the nearest row on its side.
 * A header row stays in the header, a body row in the body (the last one, when the rows shrank
 * below it); any other row, or one with no such row left, goes to the nearest row (`keptRow`).
 */
function keptActiveRow<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    before: DataGridState<TRow, TNode>,
    rowIndex: number,
): number | null {
    const bounds = boundsOf(state);
    const summary = summaryRowAt(before, rowIndex);
    if (summary) {
        const { position, summaryIndex } = summary;
        const count = state.summaryRows[position];
        if (count > 0) {
            return summaryRowIndex(
                state,
                position,
                Math.min(summaryIndex, count - 1),
            );
        }
        return keptRow(position === "top" ? -1 : state.rowCount - 1, bounds);
    }
    if (isHeaderRow(rowIndex, before.header)) {
        return keptRow(Math.max(rowIndex, -state.header.depth), bounds);
    }
    if (rowIndex >= 0 && rowIndex < before.rowCount && state.rowCount > 0) {
        return Math.min(rowIndex, state.rowCount - 1);
    }
    return keptRow(rowIndex, bounds);
}

/**
 * The active position kept inside the grid after its shape changed from `before`'s (or none
 * left): on the same row where it can be (`keptActiveRow`), and column; and the selected range
 * inside its body (`keptRange`, Epic #88).
 */
function reconcile<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    before: DataGridState<TRow, TNode> = state,
): DataGridState<TRow, TNode> {
    const next = keptActive(state, before);
    const range = keptRange(next, next.selectedRange);
    return range === next.selectedRange
        ? next
        : { ...next, selectedRange: range };
}

/** `reconcile`'s active position. */
function keptActive<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    before: DataGridState<TRow, TNode>,
): DataGridState<TRow, TNode> {
    const active = state.activePosition;
    if (!active) return state;
    const rowIndex = Number.isInteger(active.rowIndex)
        ? keptActiveRow(state, before, active.rowIndex)
        : null;
    if (
        state.columns.length === 0 ||
        rowIndex === null ||
        !Number.isInteger(active.columnIndex)
    ) {
        return { ...state, activePosition: null };
    }
    const position = cellPosition(state, {
        rowIndex,
        columnIndex: clamp(active.columnIndex, 0, state.columns.length - 1),
    });
    return sameCell(position, active)
        ? state
        : { ...state, activePosition: position };
}

/** The model's own copy of a sort: the caller's array changing later changes nothing. */
function copied(sortColumns: readonly SortColumn[]): readonly SortColumn[] {
    return sortColumns.map(({ columnKey, direction }) => ({
        columnKey,
        direction,
    }));
}

/**
 * The state with its rows from `source` (`data.set`, and a new model): the active cell kept
 * inside them (following its row from `state`'s, unless `follow` is false: a new model's position
 * is given for its rows), the expanded rows looked for where the new source may hold them.
 */
function withSource<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    source: RowSource<TRow>,
    rowKey: RowKeyGetter<TRow> | undefined,
    hints: RowKeyHints,
    follow = true,
): DataGridState<TRow, TNode> {
    const sourced = {
        ...state,
        source,
        rowCount: rowCountOf(source),
        rowKey,
    };
    const next = reconcile(sourced, follow ? state : sourced);
    return withExpandedRows(next, hints, newRowsOf(state, next));
}

/** A source's own copy of where rows come from: the rows or the getter, and their kinds. */
function sourceOf<TRow>(given: RowSource<TRow>): RowSource<TRow> {
    const meta = given.getRowMeta ? { getRowMeta: given.getRowMeta } : {};
    return "rows" in given
        ? { rows: given.rows, ...meta }
        : { rowCount: given.rowCount, getRow: given.getRow, ...meta };
}

/** The keys a `set` takes, once each, or why they are refused. */
function validRowKeys(
    rowKeys: readonly RowKey[],
    name = "rowKeys",
): CommandResult<readonly RowKey[]> {
    if (!Array.isArray(rowKeys)) return invalid(`${name} must be an array`);
    const keys = uniqueRowKeys(rowKeys);
    return keys
        ? { ok: true, value: keys }
        : invalid("a row key must be a string or a finite number");
}

/**
 * The key of the loaded row at `rowIndex`, or why there is none: no such row, or what `unloaded`
 * says while it is not loaded (its key is unknown).
 */
function loadedKeyAt<TRow>(
    state: RowsState<TRow>,
    rowIndex: number,
    unloaded: (rowIndex: number) => CommandFailure,
    meta: RowMeta | undefined = rowMetaAt(state.source, rowIndex),
): CommandResult<RowKey> {
    if (!isIndex(rowIndex, state.rowCount)) {
        return fail("not_found", `no row ${rowIndex}`);
    }
    const row = dataRowAt(state.source, rowIndex, meta);
    const key = row === undefined ? undefined : keyOf(state, row, rowIndex);
    return key === undefined ? unloaded(rowIndex) : { ok: true, value: key };
}

/** A toggle's value: the keys, and the anchor it leaves (a controlled root keeps that part). */
function toggled<TRow, TNode>(
    applied: Applied<TRow, TNode, readonly RowKey[]>,
): Applied<TRow, TNode, ResultOf<"selected-rows.toggle">> {
    if (!applied.ok) return applied;
    const { state } = applied.value;
    return done(state, {
        rowKeys: state.selectedRowKeys,
        anchor: state.selectionAnchor,
    });
}

/** The state with the selected keys and the anchor, the same object when neither changed. */
function selected<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    keys: readonly RowKey[],
    anchor: SelectionAnchor | null,
): Applied<TRow, TNode, readonly RowKey[]> {
    const sameKeys = sameRowKeys(keys, state.selectedRowKeys);
    const next =
        sameKeys && sameAnchor(anchor, state.selectionAnchor)
            ? state
            : {
                  ...state,
                  selectedRowKeys: sameKeys ? state.selectedRowKeys : keys,
                  selectionAnchor: anchor,
              };
    return done(next, next.selectedRowKeys);
}

/** A setting's next value: `undefined` keeps the current one, `null` clears it. */
function setting<T>(value: T | null | undefined, current: T | undefined) {
    return value === undefined ? current : (value ?? undefined);
}

/**
 * The columns of a span: a column's or a group's header cell (`header.cellByKey`), a column's
 * with the ones its header span covers (E1.2).
 */
function columnsOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    span: ColumnSpan,
): readonly Column<TRow, TNode>[] {
    return state.columns.slice(
        span.columnIndex,
        span.columnIndex + span.columnSpan,
    );
}

/** The state with the columns' widths (the same object when they did not change), and them. */
function withWidths<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    columnWidths: ColumnWidths,
): Applied<TRow, TNode, ColumnWidths> {
    const next =
        columnWidths === state.columnWidths
            ? state
            : { ...state, columnWidths };
    return done(next, next.columnWidths);
}

/**
 * The columns and the header of the entries, each sibling list in the column order, the
 * collapsible groups' children shown by their state (E1.3).
 */
function layoutOf<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
    columnOrder: ColumnOrder,
    collapsedGroupKeys: readonly string[],
) {
    return layoutColumns(
        entries,
        siblingOrder(columnOrder),
        collapsedGroupKeys,
    );
}

/**
 * The state in a new column order (O1) or with new collapsed groups (E1.3), the same object when
 * neither changed: the columns and the header laid out again, and the active cell on its column,
 * wherever it went (a header cell's at its cell's new first column, on the same row), or, hidden
 * by a collapse, on the nearest column its group still shows (`followedColumn`).
 */
function withLayout<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    next: {
        readonly columnOrder?: ColumnOrder;
        readonly collapsedGroupKeys?: readonly string[];
    },
): DataGridState<TRow, TNode> {
    const columnOrder = next.columnOrder ?? state.columnOrder;
    // the collapsed groups are a set: the same keys in another order change nothing
    const collapsedGroupKeys =
        next.collapsedGroupKeys &&
        !sameKeys(next.collapsedGroupKeys, state.collapsedGroupKeys)
            ? next.collapsedGroupKeys
            : state.collapsedGroupKeys;
    const sameColumnOrder = sameOrder(columnOrder, state.columnOrder);
    if (sameColumnOrder && collapsedGroupKeys === state.collapsedGroupKeys) {
        return state;
    }
    // keys of no collapsible group (kept: it may come back) collapse nothing: no new layout
    if (
        sameColumnOrder &&
        sameKeys(
            collapsingKeys(state.columnEntries, collapsedGroupKeys),
            collapsingKeys(state.columnEntries, state.collapsedGroupKeys),
        )
    ) {
        return { ...state, collapsedGroupKeys };
    }
    const { columns, header } = layoutOf(
        state.columnEntries,
        columnOrder,
        collapsedGroupKeys,
    );
    const active = state.activePosition;
    const columnIndex = active
        ? followedColumn(state, header, active)
        : undefined;
    const activePosition =
        active &&
        columnIndex !== undefined &&
        columnIndex !== active.columnIndex
            ? { rowIndex: active.rowIndex, columnIndex }
            : active;
    // in its new place, a span may cover it (E1.2); a range's columns are others now (Epic #88)
    return reconcile(
        {
            ...state,
            columnOrder,
            collapsedGroupKeys,
            columns,
            header,
            activePosition,
            selectedRange: null,
        },
        state,
    );
}

/** The state in a new column order (`withLayout`), and the order. */
function withOrder<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    columnOrder: ColumnOrder,
): Applied<TRow, TNode, ColumnOrder> {
    const next = withLayout(state, { columnOrder });
    return done(next, next.columnOrder);
}

/** The state with new collapsed groups (`withLayout`), and their keys. */
function withCollapsed<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    collapsedGroupKeys: readonly string[],
): Applied<TRow, TNode, readonly string[]> {
    const next = withLayout(state, { collapsedGroupKeys });
    return done(next, next.collapsedGroupKeys);
}

/**
 * The state with its active position at its cell's (`cellPosition`): a span's first column; the
 * same object when it is there.
 */
function withSnappedActive<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): DataGridState<TRow, TNode> {
    const active = state.activePosition;
    const position = active && cellPosition(state, active);
    return position === active ? state : { ...state, activePosition: position };
}

function validSize(size: unknown): boolean {
    return (
        typeof size === "function" ||
        (typeof size === "number" && Number.isFinite(size) && size >= 0)
    );
}

/** A row's or a detail's height: a size, a function, or `"auto"` (measured, E2.2). */
function validHeight(height: unknown): boolean {
    return height === "auto" || validSize(height);
}

/**
 * What a measured height starts from: a size above 0 (a window of rows of no height would hold
 * them all).
 */
function validEstimate(size: unknown): size is number {
    return typeof size === "number" && Number.isFinite(size) && size > 0;
}

/** The state with the expanded row groups' keys (a set: the same keys reordered change nothing). */
function withGroupKeys<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    keys: readonly RowKey[],
): Applied<TRow, TNode, readonly RowKey[]> {
    const next = sameKeys(keys, state.expandedGroupKeys)
        ? state
        : { ...state, expandedGroupKeys: keys };
    return done(next, next.expandedGroupKeys);
}

/**
 * A group row's selection toggled (Epic #87): its rows' keys, all selected or all cleared (many
 * rows only; a group naming none cannot be). With `extend`, a range from the anchor to it (group
 * rows giving their rows' keys); without an anchor, a toggle.
 */
function toggledGroup<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    group: GroupRow,
    rowIndex: number,
    extend: boolean,
): Applied<TRow, TNode, ResultOf<"selected-rows.toggle">> {
    if (!groupSelectable(state, group)) {
        return fail(
            "refused",
            `group row "${String(group.key)}" cannot be selected (multiple mode, its rows' keys)`,
        );
    }
    // a range from the anchor; without one, a toggle (as a data row's)
    const extended = extend ? extendedKeys(state, rowIndex) : undefined;
    if (extended) {
        return extended.ok
            ? toggled(selected(state, extended.value, state.selectionAnchor))
            : extended;
    }
    // a toggle by index makes its row the anchor, with the state it gave (as a data row's)
    const was = isRowSelected(state, rowIndex);
    return toggled(
        selected(state, groupToggledKeys(state, group), {
            rowKey: group.key,
            rowIndex,
            selected: !was,
        }),
    );
}

/**
 * The commands' handlers. `hints` (where expanded keys were last seen) is a cache they share: a
 * dry run may fill it, and every use checks it first.
 */
function createHandlers<TRow, TNode>(
    hints: RowKeyHints,
): Handlers<TRow, TNode> {
    return {
        "columns.set": (state, { columns: entries }) => {
            const error = columnsError(entries);
            if (error) return invalid(error);
            const { columns, header } = layoutOf(
                entries,
                state.columnOrder,
                state.collapsedGroupKeys,
            );
            const next = reconcile(
                {
                    ...state,
                    columns,
                    columnEntries: entries,
                    header,
                    // a sorted column gone, or no longer sortable, leaves the sort (one a
                    // collapsed group hides keeps it)
                    sortColumns: validSortColumns(entries, state.sortColumns),
                },
                state,
            );
            return done(next, { columnCount: columns.length });
        },
        "data.set": (state, payload) => {
            if ("rows" in payload) {
                if (!Array.isArray(payload.rows)) {
                    return invalid("rows must be an array");
                }
            } else if (
                !Number.isInteger(payload.rowCount) ||
                payload.rowCount < 0
            ) {
                return invalid("rowCount must be a whole number, 0 or more");
            } else if (typeof payload.getRow !== "function") {
                return invalid("getRow must be a function");
            }
            const { getRowMeta } = payload;
            if (getRowMeta !== undefined && typeof getRowMeta !== "function") {
                return invalid("getRowMeta must be a function");
            }
            const next = withSource(
                state,
                // the rows' kinds belong to the source they come with (by index): left out, none
                sourceOf(payload),
                "rowKey" in payload ? payload.rowKey : state.rowKey,
                hints,
            );
            return done(next, { rowCount: next.rowCount });
        },
        "rows.changed": (state, { start, end }) => {
            for (const [name, bound] of [
                ["start", start],
                ["end", end],
            ] as const) {
                if (bound !== undefined && !isIndex(bound)) {
                    return invalid(`${name} must be a whole number, 0 or more`);
                }
            }
            if (start !== undefined && end !== undefined && start > end) {
                return invalid("start must not be after end");
            }
            const range = {
                start: Math.min(start ?? 0, state.rowCount),
                end: Math.min(end ?? state.rowCount, state.rowCount),
            };
            // no row in it: nothing to tell. Rows that arrived may be expanded ones
            const next =
                range.start < range.end
                    ? withExpandedRows(
                          {
                              ...state,
                              rowsChanged: {
                                  revision: state.rowsChanged.revision + 1,
                                  ...range,
                              },
                          },
                          hints,
                          range,
                      )
                    : state;
            // the active row's new data may span over its column (E1.2)
            const active = next.activePosition;
            return done(
                active && overlaps(range, active.rowIndex, active.rowIndex + 1)
                    ? withSnappedActive(next)
                    : next,
                range,
            );
        },
        "sort-columns.set": (state, { sortColumns }) => {
            if (!Array.isArray(sortColumns)) {
                return invalid("sortColumns must be an array");
            }
            const seen = new Set<string>();
            for (const entry of sortColumns) {
                if (!SORT_DIRECTIONS.includes(entry?.direction)) {
                    return notOneOf("direction", SORT_DIRECTIONS);
                }
                const found = sortableColumn(
                    state.columnEntries,
                    entry.columnKey,
                );
                if (!found.ok) return found;
                if (seen.has(entry.columnKey)) {
                    return invalid(
                        `column "${entry.columnKey}" is sorted twice`,
                    );
                }
                seen.add(entry.columnKey);
            }
            const next = sameSortColumns(sortColumns, state.sortColumns)
                ? state
                : { ...state, sortColumns: copied(sortColumns) };
            return done(next, next.sortColumns);
        },
        "sort-columns.toggle": (state, { columnKey, multi }) => {
            const found = sortableColumn(state.columnEntries, columnKey);
            if (!found.ok) return found;
            const sortColumns = toggledSort(
                state.sortColumns,
                columnKey,
                multi === true,
            );
            const next = sameSortColumns(sortColumns, state.sortColumns)
                ? state
                : { ...state, sortColumns };
            return done(next, next.sortColumns);
        },
        "expanded-rows.set": (state, { rowKeys }) => {
            const keys = validRowKeys(rowKeys);
            if (!keys.ok) return keys;
            const next = sameRowKeys(keys.value, state.expandedRowKeys)
                ? state
                : withExpandedRows(
                      { ...state, expandedRowKeys: keys.value },
                      hints,
                  );
            return done(next, next.expandedRowKeys);
        },
        "expanded-rows.toggle": (state, payload) => {
            let key: RowKey;
            if (payload.rowIndex !== undefined) {
                // its key is unknown until it loads; a group row has no detail (Epic #87)
                const found = loadedKeyAt(state, payload.rowIndex, (rowIndex) =>
                    fail(
                        "refused",
                        groupAt(state.source, rowIndex)
                            ? `row ${rowIndex} is a group row: it has no detail`
                            : `row ${rowIndex} is not loaded`,
                    ),
                );
                if (!found.ok) return found;
                key = found.value;
            } else if (isRowKey(payload.rowKey)) {
                key = payload.rowKey;
            } else {
                return invalid(TOGGLE_BY);
            }
            const expanded = keySet(state.expandedRowKeys).has(key);
            const keys = toggledKey(state.expandedRowKeys, key);
            let expandedRows: readonly number[];
            if (payload.rowIndex !== undefined) {
                // the toggled row alone changes: the others are where they were
                const index = payload.rowIndex;
                hints.set(key, index);
                // collapsed: every row showing the key goes (a key the data repeats included)
                expandedRows = expanded
                    ? state.expandedRows.filter(
                          (entry) => loadedRowKey(state, entry) !== key,
                      )
                    : withRow(state.expandedRows, index);
            } else {
                expandedRows = expandedRowsOf(
                    { ...state, expandedRowKeys: keys },
                    hints,
                    { start: 0, end: state.rowCount },
                );
            }
            return done(
                { ...state, expandedRowKeys: keys, expandedRows },
                keys,
            );
        },
        "row-groups.set": (state, { groupKeys }) => {
            const keys = validRowKeys(groupKeys, "groupKeys");
            if (!keys.ok) return keys;
            return withGroupKeys(state, keys.value);
        },
        "row-groups.toggle": (state, payload) => {
            let key: RowKey | undefined;
            if (payload.rowIndex !== undefined) {
                if (!isIndex(payload.rowIndex, state.rowCount)) {
                    return fail("not_found", `no row ${payload.rowIndex}`);
                }
                key = groupKeyAt(state, payload.rowIndex);
                if (key === undefined) {
                    return fail(
                        "refused",
                        `row ${payload.rowIndex} does not expand (no group row, nor a loaded row that expands)`,
                    );
                }
            } else if (isRowKey(payload.groupKey)) {
                key = payload.groupKey;
            } else {
                return invalid(TOGGLE_GROUP_BY);
            }
            return withGroupKeys(
                state,
                toggledKey(state.expandedGroupKeys, key),
            );
        },
        "selected-rows.set": (state, { rowKeys }) => {
            if (!state.rowSelection) return selectionOff();
            const unique = validRowKeys(rowKeys);
            if (!unique.ok) return unique;
            const keys = keptRowKeys(unique.value, state.rowSelection);
            return selected(
                state,
                keys,
                keptAnchor(state, state.selectionAnchor, keys),
            );
        },
        "selected-rows.toggle": (state, payload) => {
            if (!state.rowSelection) return selectionOff();
            if (payload.rowIndex === undefined) {
                if (!isRowKey(payload.rowKey)) return invalid(TOGGLE_BY);
                // no index to start a range from: the anchor goes
                return toggled(
                    selected(state, toggledKeys(state, payload.rowKey), null),
                );
            }
            const rowIndex = payload.rowIndex;
            // the row read once: a group row, or a data row's key
            const meta = rowMetaAt(state.source, rowIndex);
            if (meta?.group) {
                return toggledGroup(
                    state,
                    meta.group,
                    rowIndex,
                    payload.extend === true,
                );
            }
            const found = loadedKeyAt(state, rowIndex, notLoaded, meta);
            if (!found.ok) return found;
            const key = found.value;
            // one row at a time has no range: a Shift+click is a toggle there
            if (payload.extend === true && state.rowSelection === "multiple") {
                const extended = extendedKeys(state, rowIndex);
                // the range starts where it did: the anchor stays
                if (extended) {
                    return extended.ok
                        ? toggled(
                              selected(
                                  state,
                                  extended.value,
                                  state.selectionAnchor,
                              ),
                          )
                        : extended;
                }
                // nothing to extend from: a toggle
            }
            const was = keySet(state.selectedRowKeys).has(key);
            // a row that cannot be selected is never added; one selected already can be cleared
            if (!isRowSelectable(state, rowIndex) && !was) {
                return fail("refused", `row ${rowIndex} cannot be selected`);
            }
            return toggled(
                selected(state, toggledKeys(state, key), {
                    rowKey: key,
                    rowIndex,
                    selected: !was,
                }),
            );
        },
        "selection-anchor.clear": (state) =>
            done(
                state.selectionAnchor
                    ? { ...state, selectionAnchor: null }
                    : state,
                undefined,
            ),
        "selection-anchor.set": (state, { rowIndex, selected: selects }) => {
            if (!state.rowSelection) return selectionOff();
            if (!isIndex(rowIndex, state.rowCount)) {
                return fail("not_found", `no row ${rowIndex}`);
            }
            // a group row's anchor is its group key (Epic #87)
            const rowKey = rowKeyAt(state, rowIndex);
            if (rowKey === undefined) return notLoaded(rowIndex);
            const anchor = {
                rowKey,
                rowIndex,
                selected: selects !== false,
            };
            const next = sameAnchor(state.selectionAnchor, anchor)
                ? state
                : { ...state, selectionAnchor: anchor };
            return done(next, next.selectionAnchor ?? anchor);
        },
        "selected-rows.select-all": (state) => {
            if (!state.rowSelection) return selectionOff();
            if (state.rowSelection === "single") {
                return fail("refused", "a single selection selects one row");
            }
            const all = allKeys(state);
            if (!all.ok) return all;
            return selected(
                state,
                all.value,
                keptAnchor(state, state.selectionAnchor, all.value),
            );
        },
        "row-selection.set": (state, { rowSelection, isRowSelectable }) => {
            if (
                rowSelection !== undefined &&
                rowSelection !== null &&
                !ROW_SELECTIONS.includes(rowSelection)
            ) {
                return notOneOf("rowSelection", ROW_SELECTIONS);
            }
            if (
                isRowSelectable !== undefined &&
                isRowSelectable !== null &&
                typeof isRowSelectable !== "function"
            ) {
                return invalid("isRowSelectable must be a function");
            }
            const mode = setting(rowSelection, state.rowSelection);
            const filter = setting(isRowSelectable, state.isRowSelectable);
            const keys = keptRowKeys(state.selectedRowKeys, mode);
            const next =
                mode === state.rowSelection &&
                filter === state.isRowSelectable &&
                keys === state.selectedRowKeys
                    ? state
                    : {
                          ...state,
                          rowSelection: mode,
                          isRowSelectable: filter,
                          selectedRowKeys: keys,
                          // no range survives selection turned off, nor its row trimmed
                          selectionAnchor: mode
                              ? keptAnchor(state, state.selectionAnchor, keys)
                              : null,
                      };
            return done(next, undefined);
        },
        "cell-selection.set": (state, { cellSelection }) => {
            if (
                cellSelection !== null &&
                !CELL_SELECTIONS.includes(cellSelection)
            ) {
                return notOneOf("cellSelection", CELL_SELECTIONS);
            }
            const mode = cellSelection ?? undefined;
            // off, no range survives
            const next =
                mode === state.cellSelection
                    ? state
                    : {
                          ...state,
                          cellSelection: mode,
                          selectedRange: mode ? state.selectedRange : null,
                      };
            return done(next, next.cellSelection);
        },
        "selected-range.set": (state, { anchor, focus }) => {
            if (!state.cellSelection) return cellsOff();
            for (const corner of [anchor, focus]) {
                if (!isBodyCell(state, corner)) return noBodyCell(corner);
            }
            return withRange(state, { anchor, focus });
        },
        "selected-range.extend": (state, payload) => {
            if (!state.cellSelection) return cellsOff();
            const range = state.selectedRange;
            const active = isBodyCell(state, state.activePosition)
                ? state.activePosition
                : null;
            if (payload.direction !== undefined) {
                const { direction, pageSize } = payload;
                if (!DIRECTIONS.includes(direction)) {
                    return notOneOf("direction", DIRECTIONS);
                }
                if (pageSize !== undefined && !Number.isFinite(pageSize)) {
                    return invalid("pageSize must be a number");
                }
                const from =
                    range ?? (active && { anchor: active, focus: active });
                if (!from) {
                    return fail(
                        "refused",
                        "no range, nor an active body cell, to extend",
                    );
                }
                // in the body: never into the header nor the summary rows
                const focus = nextPosition(
                    from.focus,
                    direction,
                    bodyBoundsOf(state),
                    pageSize,
                );
                return withRange(state, { anchor: from.anchor, focus });
            }
            const cell = {
                rowIndex: payload.rowIndex,
                columnIndex: payload.columnIndex,
            };
            if (!isBodyCell(state, cell)) return noBodyCell(cell);
            return withRange(state, {
                anchor: range?.anchor ?? active ?? cell,
                focus: cell,
            });
        },
        "selected-range.select-all": (state) => {
            if (!state.cellSelection) return cellsOff();
            if (state.rowCount === 0 || state.columns.length === 0) {
                return fail("refused", "the grid has no body cells");
            }
            return withRange(state, {
                anchor: { rowIndex: 0, columnIndex: 0 },
                focus: {
                    rowIndex: state.rowCount - 1,
                    columnIndex: state.columns.length - 1,
                },
            });
        },
        "selected-range.clear": (state) =>
            done(
                state.selectedRange ? { ...state, selectedRange: null } : state,
                undefined,
            ),
        "column-widths.set": (state, { columnWidths }) => {
            const kept = keptWidths(columnWidths);
            if (
                typeof columnWidths !== "object" ||
                columnWidths === null ||
                Array.isArray(columnWidths) ||
                Object.keys(kept).length !== Object.keys(columnWidths).length
            ) {
                return invalid(
                    "columnWidths must map column keys to widths (finite, not negative)",
                );
            }
            return withWidths(
                state,
                sameWidths(kept, state.columnWidths)
                    ? state.columnWidths
                    : kept,
            );
        },
        "column-widths.resize": (state, { columnKey, width, autoWidths }) => {
            if (!Number.isFinite(width)) {
                return invalid("width must be a finite number");
            }
            const span = state.header.cellByKey(columnKey);
            if (!span) {
                return fail("not_found", `no column or group "${columnKey}"`);
            }
            if (!spanResizable(state.columns, span)) {
                return fail("refused", `"${columnKey}" is not resizable`);
            }
            return withWidths(
                state,
                resizedWidths(
                    columnsOf(state, span),
                    state.columnWidths,
                    width,
                    autoWidths && keptWidthsOf(autoWidths),
                ),
            );
        },
        "column-widths.reset": (state, { columnKey }) => {
            if (columnKey === undefined) {
                return withWidths(
                    state,
                    Object.keys(state.columnWidths).length > 0
                        ? {}
                        : state.columnWidths,
                );
            }
            // a key that is no column (kept by a `set`) drops too
            const span = state.header.cellByKey(columnKey);
            const keys =
                span && columnsOf(state, span).map((column) => column.key);
            if (!keys && !Object.hasOwn(state.columnWidths, columnKey)) {
                return fail("not_found", `no column or group "${columnKey}"`);
            }
            return withWidths(
                state,
                withoutWidths(state.columnWidths, keys ?? [columnKey]),
            );
        },
        "column-order.set": (state, { columnOrder }) => {
            if (
                !Array.isArray(columnOrder) ||
                columnOrder.some((key) => typeof key !== "string")
            ) {
                return invalid("columnOrder must be an array of keys");
            }
            if (new Set(columnOrder).size !== columnOrder.length) {
                return invalid("columnOrder lists a key twice");
            }
            return withOrder(state, [...columnOrder]);
        },
        "column-order.move": (state, { columnKey, targetKey, side }) => {
            if (!REORDER_SIDES.includes(side)) {
                return notOneOf("side", REORDER_SIDES);
            }
            const siblings = siblingsOf(state.columns, state.header, columnKey);
            const missing = !siblings
                ? columnKey
                : state.header.cellByKey(targetKey)
                  ? null
                  : targetKey;
            if (!siblings || missing !== null) {
                return fail("not_found", `no column or group "${missing}"`);
            }
            const { cells, index, start, end } = siblings;
            if (!isReorderable(siblings.cell)) {
                return fail("refused", `"${columnKey}" is not reorderable`);
            }
            // a column a header span covers (E1.2) has no cell among its siblings
            if (index < 0) {
                return fail(
                    "refused",
                    `"${columnKey}" is covered by a header span`,
                );
            }
            const target = cells.findIndex((cell) => cell.key === targetKey);
            if (target < 0) {
                return fail(
                    "refused",
                    `"${targetKey}" is not a sibling of "${columnKey}"`,
                );
            }
            // pinned columns lead and trail (P1): each part's land among their own
            // (beside the first one past the edge, on its near side, is still their own part)
            const to = landingIndex(index, target, side);
            if (to < start || to >= end) {
                return fail(
                    "refused",
                    `"${columnKey}" moves among the ${PART_NAMES[siblings.pinned ?? "none"]} ones only`,
                );
            }
            if (to === index) return done(state, state.columnOrder);
            // a column whose header spans its siblings (E1.2) moves with the ones it covers
            const units = cells.map((cell) =>
                cell.group || cell.columnSpan === 1
                    ? [cell.key]
                    : state.columns
                          .slice(
                              cell.columnIndex,
                              cell.columnIndex + cell.columnSpan,
                          )
                          .map((column) => column.key),
            );
            const [moved = [columnKey]] = units.splice(index, 1);
            units.splice(to, 0, moved);
            return withOrder(
                state,
                movedOrder(state.columnOrder, units.flat()),
            );
        },
        "column-order.reset": (state) => withOrder(state, []),
        "column-groups.set": (state, { groupKeys }) => {
            if (
                !Array.isArray(groupKeys) ||
                groupKeys.some((key) => typeof key !== "string")
            ) {
                return invalid("groupKeys must be an array of keys");
            }
            return withCollapsed(state, [...new Set(groupKeys)]);
        },
        "column-groups.toggle": (state, { groupKey }) => {
            const group =
                typeof groupKey === "string"
                    ? groupByKey(state.columnEntries, groupKey)
                    : undefined;
            if (!group) return fail("not_found", `no group "${groupKey}"`);
            if (group.collapsible !== true) {
                return fail("refused", `group "${groupKey}" does not collapse`);
            }
            return withCollapsed(
                state,
                toggledKey(state.collapsedGroupKeys, groupKey),
            );
        },
        "direction.set": (state, { direction }) => {
            if (direction !== null && !GRID_DIRECTIONS.includes(direction)) {
                return notOneOf("direction", GRID_DIRECTIONS);
            }
            const next = direction ?? undefined;
            return done(
                next === state.direction
                    ? state
                    : { ...state, direction: next },
                next,
            );
        },
        "summary-rows.set": (state, payload) => {
            const counts = summaryRowCounts(payload, state.summaryRows);
            if (!counts) {
                return invalid(
                    "top and bottom must be whole numbers, 0 or more",
                );
            }
            const next =
                counts === state.summaryRows
                    ? state
                    : reconcile({ ...state, summaryRows: counts }, state);
            return done(next, next.summaryRows);
        },
        "summary-rows.changed": (state) => {
            const { top, bottom } = state.summaryRows;
            // no summary row: nothing to draw again
            const next =
                top + bottom > 0
                    ? { ...state, summaryRevision: state.summaryRevision + 1 }
                    : state;
            return done(next, next.summaryRevision);
        },
        "sizes.set": (
            state,
            {
                rowHeight,
                estimatedRowHeight,
                headerRowHeight,
                summaryRowHeight,
                detailHeight,
                estimatedDetailHeight,
            },
        ) => {
            if (rowHeight !== undefined && !validHeight(rowHeight)) {
                return invalid(
                    'rowHeight must be a size, a function or "auto"',
                );
            }
            for (const [name, size] of [
                ["headerRowHeight", headerRowHeight],
                ["summaryRowHeight", summaryRowHeight],
            ] as const) {
                if (
                    size !== undefined &&
                    (typeof size !== "number" || !validSize(size))
                ) {
                    return invalid(`${name} must be a size`);
                }
            }
            if (detailHeight !== undefined && !validHeight(detailHeight)) {
                return invalid(
                    'detailHeight must be a size, a function or "auto"',
                );
            }
            for (const [name, size] of [
                ["estimatedRowHeight", estimatedRowHeight],
                ["estimatedDetailHeight", estimatedDetailHeight],
            ] as const) {
                if (size !== undefined && !validEstimate(size)) {
                    return invalid(`${name} must be a size above 0`);
                }
            }
            const next = reconcile(
                {
                    ...state,
                    rowHeight: rowHeight ?? state.rowHeight,
                    estimatedRowHeight:
                        estimatedRowHeight ?? state.estimatedRowHeight,
                    headerRowHeight: headerRowHeight ?? state.headerRowHeight,
                    summaryRowHeight:
                        summaryRowHeight ?? state.summaryRowHeight,
                    detailHeight: detailHeight ?? state.detailHeight,
                    estimatedDetailHeight:
                        estimatedDetailHeight ?? state.estimatedDetailHeight,
                },
                state,
            );
            return done(next, undefined);
        },
        "active-position.set": (state, payload) => {
            if (!isCell(state, payload)) {
                return fail(
                    "not_found",
                    `no cell at row ${payload.rowIndex}, column ${payload.columnIndex}`,
                );
            }
            const position = cellPosition(state, {
                rowIndex: payload.rowIndex,
                columnIndex: payload.columnIndex,
            });
            const current = state.activePosition;
            const next =
                current && sameCell(current, position)
                    ? state
                    : { ...state, activePosition: position };
            return done(next, position);
        },
        "active-position.clear": (state) =>
            done(
                state.activePosition
                    ? { ...state, activePosition: null }
                    : state,
                undefined,
            ),
        "active-position.move": (
            state,
            { direction, pageSize, visibleColumns },
        ) => {
            if (!DIRECTIONS.includes(direction)) {
                return notOneOf("direction", DIRECTIONS);
            }
            if (pageSize !== undefined && !Number.isFinite(pageSize)) {
                return invalid("pageSize must be a number");
            }
            if (
                visibleColumns !== undefined &&
                (!Number.isInteger(visibleColumns.start) ||
                    !Number.isInteger(visibleColumns.end))
            ) {
                return invalid("visibleColumns must have whole-number bounds");
            }
            const current = state.activePosition;
            if (!current) return fail("refused", "no cell is active");
            const position = nextPosition(
                current,
                direction,
                { ...boundsOf(state), visibleColumns },
                pageSize,
            );
            const next = sameCell(position, current)
                ? state
                : { ...state, activePosition: position };
            return done(next, position);
        },
    };
}

/** What a thrown value says. */
function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

interface Queued {
    command: CommandName;
    payload: unknown;
}

/** Creates a grid's model. It throws when the columns are invalid (see `columns.set`). */
export function createDataGridModel<TRow, TNode = unknown>(
    options: DataGridModelOptions<TRow, TNode> = {},
): DataGridModel<TRow, TNode> {
    const hints: RowKeyHints = new Map();
    const handlers = createHandlers<TRow, TNode>(hints);
    const entries = options.columns ?? [];
    // the same rules as `columns.set`: a grid never starts with columns it would refuse
    const error = columnsError(entries);
    if (error) throw new TypeError(`invalid columns: ${error}`);
    const columnOrder = keptOrder(options.columnOrder);
    const collapsedGroupKeys = keptOrder(options.collapsedGroupKeys);
    const { columns, header } = layoutOf(
        entries,
        columnOrder,
        collapsedGroupKeys,
    );
    const selectionMode =
        options.rowSelection && ROW_SELECTIONS.includes(options.rowSelection)
            ? options.rowSelection
            : undefined;
    const cellMode =
        options.cellSelection && CELL_SELECTIONS.includes(options.cellSelection)
            ? options.cellSelection
            : undefined;
    const blank: DataGridState<TRow, TNode> = {
        columns,
        columnEntries: entries,
        header,
        // no rows yet: `withSource` gives them, as `data.set` does
        source: { rows: [] },
        rowCount: 0,
        rowKey: undefined,
        rowHeight: options.rowHeight ?? DEFAULT_ROW_HEIGHT,
        estimatedRowHeight: validEstimate(options.estimatedRowHeight)
            ? options.estimatedRowHeight
            : DEFAULT_ROW_HEIGHT,
        headerRowHeight: options.headerRowHeight ?? DEFAULT_HEADER_ROW_HEIGHT,
        // counts that are not whole numbers start without summary rows
        summaryRows:
            summaryRowCounts(options.summaryRows, NO_SUMMARY_ROWS) ??
            NO_SUMMARY_ROWS,
        summaryRowHeight: options.summaryRowHeight ?? DEFAULT_ROW_HEIGHT,
        summaryRevision: 0,
        activePosition: options.activePosition ?? null,
        sortColumns: copied(
            validSortColumns(entries, options.sortColumns ?? []),
        ),
        rowsChanged: { revision: 0, start: 0, end: 0 },
        expandedRowKeys: uniqueRowKeys(options.expandedRowKeys ?? []) ?? [],
        expandedGroupKeys: uniqueRowKeys(options.expandedGroupKeys ?? []) ?? [],
        expandedRows: [],
        detailHeight: options.detailHeight ?? DEFAULT_DETAIL_HEIGHT,
        estimatedDetailHeight: validEstimate(options.estimatedDetailHeight)
            ? options.estimatedDetailHeight
            : DEFAULT_DETAIL_HEIGHT,
        rowSelection: selectionMode,
        selectedRowKeys: keptRowKeys(
            uniqueRowKeys(options.selectedRowKeys ?? []) ?? [],
            selectionMode,
        ),
        isRowSelectable: options.isRowSelectable,
        selectionAnchor: null,
        cellSelection: cellMode,
        // kept inside the body once the rows are given (`withSource`)
        selectedRange: options.selectedRange ?? null,
        columnWidths: keptWidths(options.columnWidths),
        columnOrder,
        collapsedGroupKeys,
        direction:
            options.direction && GRID_DIRECTIONS.includes(options.direction)
                ? options.direction
                : undefined,
    };
    let state = withSource(
        blank,
        sourceOf(
            options.rows !== undefined || options.getRow === undefined
                ? { rows: options.rows ?? [], getRowMeta: options.getRowMeta }
                : {
                      rowCount: options.rowCount ?? 0,
                      getRow: options.getRow,
                      getRowMeta: options.getRowMeta,
                  },
        ),
        options.rowKey,
        hints,
        // the position given is for these rows
        false,
    );
    const middlewares: Middleware<TRow, TNode>[] = [];
    const listeners = new Set<CommandListener<TRow, TNode>>();
    const queue: Queued[] = [];
    let running = false;

    /** The chain, then the handler; returns the new state (uncommitted) and the value. */
    function execute(
        command: CommandName,
        payload: unknown,
        dryRun: boolean,
    ): Applied<TRow, TNode, unknown> {
        if (!Object.hasOwn(handlers, command)) {
            return fail("unknown_command", `no command "${String(command)}"`);
        }
        // the union of payloads is checked by the handler that reads it
        const ctx = {
            command,
            payload: payload ?? {},
            dryRun,
            state,
        } as CommandContext<TRow, TNode>;
        let applied: Applied<TRow, TNode, unknown> | undefined;
        const step = (index: number): CommandResult<unknown> => {
            const middleware = middlewares[index];
            if (!middleware) {
                const handler = handlers[ctx.command] as (
                    state: DataGridState<TRow, TNode>,
                    payload: unknown,
                ) => Applied<TRow, TNode, unknown>;
                try {
                    applied = handler(state, ctx.payload);
                    // the range follows the active cell's rule, whatever moved it (Epic #88)
                    if (applied.ok) {
                        const kept = withAnchoredRange(
                            state,
                            applied.value.state,
                        );
                        if (kept !== applied.value.state) {
                            applied = done(kept, applied.value.value);
                        }
                    }
                } catch (error) {
                    // a payload of the wrong shape: the command never throws on bad input
                    applied = invalid(messageOf(error));
                }
                return applied.ok
                    ? { ok: true, value: applied.value.value }
                    : applied;
            }
            let called = false;
            let nextResult: CommandResult<unknown> | undefined;
            const next = () => {
                called = true;
                nextResult = step(index + 1);
                return nextResult;
            };
            let returned: CommandResult<unknown> | undefined;
            try {
                returned = middleware(ctx, next);
            } catch (error) {
                return fail("middleware_error", messageOf(error));
            }
            if (returned) return returned;
            if (called && nextResult) return nextResult;
            return veto();
        };
        const result = step(0);
        if (!result.ok) return result;
        if (!applied?.ok) {
            // a middleware answered without running the command: nothing changes
            return { ok: true, value: { state, value: result.value } };
        }
        return {
            ok: true,
            value: {
                state: applied.value.state,
                value: result.value,
                payload: ctx.payload,
            },
        };
    }

    function commit(
        command: CommandName,
        payload: unknown,
    ): CommandResult<unknown> {
        if (running) {
            queue.push({ command, payload });
            return fail(
                "queued",
                "issued while another command ran: it runs right after",
            );
        }
        // running until the listeners are told: a command a listener issues is queued, so every
        // listener sees the events in order
        running = true;
        let outcome: Applied<TRow, TNode, unknown>;
        try {
            outcome = execute(command, payload, false);
            if (outcome.ok && outcome.value.state !== state) {
                const before = state;
                state = outcome.value.state;
                const event = {
                    command,
                    payload: outcome.value.payload ?? payload,
                    result: outcome.value.value,
                    before,
                    after: state,
                };
                for (const listener of [...listeners]) listener(event);
            }
        } finally {
            running = false;
            // what was queued runs even when a listener threw
            drain();
        }
        return outcome.ok ? { ok: true, value: outcome.value.value } : outcome;
    }

    function drain() {
        const pending = queue.shift();
        if (pending) commit(pending.command, pending.payload);
    }

    function dryRun(
        command: CommandName,
        payload: unknown,
    ): CommandResult<unknown> {
        const outcome = execute(command, payload, true);
        return outcome.ok ? { ok: true, value: outcome.value.value } : outcome;
    }

    const queries: {
        [K in QueryKey]: (
            payload: QueryMap<TRow, TNode>[K]["payload"],
        ) => QueryMap<TRow, TNode>[K]["result"];
    } = {
        columns: () => state.columns,
        "column-by": ({ key }) =>
            state.columns.find((column) => column.key === key),
        "column-count": () => state.columns.length,
        "row-count": () => state.rowCount,
        "header-row-count": () => headerRowCount(state),
        "header-depth": () => state.header.depth,
        "header-rows": () => state.header.rows,
        "header-cell-by": ({ rowIndex, columnIndex }) =>
            rowIndex < 0 && rowIndex >= 0 - headerRowCount(state)
                ? state.header.cellAt(rowIndex, columnIndex)
                : undefined,
        "column-entries": () => state.columnEntries,
        "row-by": ({ index }) => rowAt(state.source, index),
        "row-key-by": ({ rowIndex }) => rowKeyAt(state, rowIndex) ?? rowIndex,
        "cell-value-by": ({ rowIndex, columnIndex }) => {
            const column = state.columns[columnIndex];
            if (!column) return undefined;
            const meta = rowMetaAt(state.source, rowIndex);
            if (meta?.group) return groupCellValue(meta.group, column);
            const row = dataRowAt(state.source, rowIndex, meta);
            return row !== undefined
                ? cellValue(column, row, rowIndex)
                : undefined;
        },
        "active-position": () => state.activePosition,
        "sort-columns": () => state.sortColumns,
        "sort-column-by": ({ columnKey }) =>
            state.sortColumns.find((entry) => entry.columnKey === columnKey),
        "column-widths": () => state.columnWidths,
        "column-width-by": ({ columnKey }) => {
            const span = state.header.cellByKey(columnKey);
            return span
                ? columnsOf(state, span).reduce(
                      (sum, column) =>
                          sum + columnWidth(column, state.columnWidths),
                      0,
                  )
                : undefined;
        },
        "column-order": () => state.columnOrder,
        "collapsed-group-keys": () => state.collapsedGroupKeys,
        "row-height": () => state.rowHeight,
        "header-row-height": () => state.headerRowHeight,
        "summary-rows": () => state.summaryRows,
        "summary-row-height": () => state.summaryRowHeight,
        "summary-row-by": ({ rowIndex }) => summaryRowAt(state, rowIndex),
        direction: () => state.direction,
        "expanded-row-keys": () => state.expandedRowKeys,
        "expanded-group-keys": () => state.expandedGroupKeys,
        "row-meta-by": ({ rowIndex }) => rowMetaAt(state.source, rowIndex),
        "expanded-rows": () => state.expandedRows,
        "detail-height": () => state.detailHeight,
        "row-selection": () => state.rowSelection,
        "selected-row-keys": () => state.selectedRowKeys,
        "selection-anchor": () => validAnchor(state),
        "cell-selection": () => state.cellSelection,
        "selected-range": () => state.selectedRange,
    };

    const questions: {
        [K in QuestionKey]: (payload: QuestionMap[K]) => boolean;
    } = {
        // a header cell spanning rows or columns, a body cell spanning columns (E1.2): any
        // position inside it
        "cell-active": (position) => {
            const active = state.activePosition;
            if (!active) return false;
            if (isHeaderRow(position.rowIndex, state.header)) {
                return sameCell(active, position, state.header.cellAt);
            }
            const span = spanAt(state, position.rowIndex, position.columnIndex);
            return activeInCell(
                active,
                position.rowIndex,
                span.columnIndex,
                span.columnSpan,
            );
        },
        "row-active": ({ rowIndex }) =>
            state.activePosition?.rowIndex === rowIndex,
        // a group row (Epic #87) has nothing to wait for
        "row-loaded": ({ rowIndex }) => rowLoaded(state.source, rowIndex),
        "column-sortable": ({ columnKey }) =>
            sortableColumn(state.columnEntries, columnKey).ok,
        "group-collapsed": ({ groupKey }) => isGroupCollapsed(state, groupKey),
        "row-expanded": ({ rowIndex }) =>
            holdsRow(state.expandedRows, rowIndex),
        "row-group-expanded": ({ rowIndex }) =>
            isGroupExpanded(state, rowIndex),
        "row-selected": ({ rowIndex }) => isRowSelected(state, rowIndex),
        "row-selectable": ({ rowIndex }) => isRowSelectable(state, rowIndex),
        "cell-selected": (position) => isCellSelected(state, position),
    };

    const model: DataGridModel<TRow, TNode> = {
        get state() {
            return state;
        },
        run(command, ...[payload]) {
            return commit(command, payload) as CommandResult<
                ResultOf<typeof command, TRow, TNode>
            >;
        },
        can(command, ...[payload]) {
            return dryRun(command, payload).ok;
        },
        check(command, ...[payload]) {
            return dryRun(command, payload) as CommandResult<
                ResultOf<typeof command, TRow, TNode>
            >;
        },
        get(key, ...[payload]) {
            const query = queries[key] as (
                payload: unknown,
            ) => QueryMap<TRow, TNode>[typeof key]["result"];
            return query(payload);
        },
        is(key, payload) {
            const question = questions[key] as (payload: unknown) => boolean;
            return question(payload);
        },
        use(middleware) {
            middlewares.push(middleware);
            return () => {
                const index = middlewares.indexOf(middleware);
                if (index >= 0) middlewares.splice(index, 1);
            };
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
    return model;
}

/** The commands' names, for tools and guards (the naming test checks it lists every one). */
export const COMMANDS = [
    "columns.set",
    "data.set",
    "rows.changed",
    "sort-columns.set",
    "sort-columns.toggle",
    "expanded-rows.set",
    "expanded-rows.toggle",
    "row-groups.set",
    "row-groups.toggle",
    "selected-rows.set",
    "selected-rows.toggle",
    "selected-rows.select-all",
    "selection-anchor.set",
    "selection-anchor.clear",
    "row-selection.set",
    "cell-selection.set",
    "selected-range.set",
    "selected-range.extend",
    "selected-range.select-all",
    "selected-range.clear",
    "column-widths.set",
    "column-widths.resize",
    "column-widths.reset",
    "column-order.set",
    "column-order.move",
    "column-order.reset",
    "column-groups.set",
    "column-groups.toggle",
    "direction.set",
    "summary-rows.set",
    "summary-rows.changed",
    "sizes.set",
    "active-position.set",
    "active-position.clear",
    "active-position.move",
] satisfies (keyof CommandMap<unknown>)[];
