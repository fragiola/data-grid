import { columnsError, headerRowCount, layoutColumns } from "../header/header";
import {
    DIRECTIONS,
    type GridBounds,
    nextPosition,
    sameCell,
} from "../navigation/navigation";
import { clamp, isIndex, keySet, toggledKey } from "../utils";
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
import { done, fail, veto } from "./result";
import {
    allKeys,
    extendedKeys,
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
import { cellValue, loadedRowKey, type RowsState, rowAt } from "./source";
import type {
    CellPosition,
    Column,
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
    Middleware,
    PayloadArgs,
    PayloadOf,
    QueryKey,
    QueryMap,
    QuestionKey,
    QuestionMap,
    ResultOf,
    RowKey,
    RowKeyGetter,
    RowSource,
    SelectionAnchor,
    SortColumn,
} from "./types";
import {
    columnWidth,
    isResizable,
    keptWidths,
    resizedWidths,
    sameWidths,
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

function rowCountOf<TRow>(source: RowSource<TRow>): number {
    return "rows" in source ? source.rows.length : source.rowCount;
}

/** What moves in the grid are bounded by: its rows, its columns and its header's cells. */
function boundsOf<TRow, TNode>(state: DataGridState<TRow, TNode>): GridBounds {
    return {
        rowCount: state.rowCount,
        columnCount: state.columns.length,
        headerRowCount: headerRowCount(state),
        headerCellAt: state.header.cellAt,
    };
}

/**
 * A position inside a header cell's span, as that cell's position: its first column, on the same
 * row (a column spanning header rows has a position on each of them).
 */
function headerCellPosition<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    position: CellPosition,
): CellPosition {
    if (position.rowIndex >= 0) return position;
    const cell = state.header.cellAt(position.rowIndex, position.columnIndex);
    return cell && cell.columnIndex !== position.columnIndex
        ? { rowIndex: position.rowIndex, columnIndex: cell.columnIndex }
        : position;
}

function isCell<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    { rowIndex, columnIndex }: CellPosition,
): boolean {
    return (
        Number.isInteger(rowIndex) &&
        rowIndex >= 0 - headerRowCount(state) &&
        rowIndex < state.rowCount &&
        isIndex(columnIndex, state.columns.length)
    );
}

/** The active position kept inside the grid after its shape changed (or none left). */
function reconcile<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): DataGridState<TRow, TNode> {
    const active = state.activePosition;
    if (!active) return state;
    const firstRow = 0 - headerRowCount(state);
    const lastRow = state.rowCount - 1;
    if (
        state.columns.length === 0 ||
        lastRow < firstRow ||
        !Number.isInteger(active.rowIndex) ||
        !Number.isInteger(active.columnIndex)
    ) {
        return { ...state, activePosition: null };
    }
    const position = headerCellPosition(state, {
        rowIndex: clamp(active.rowIndex, firstRow, lastRow),
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
 * inside them, the expanded rows looked for where the new source may hold them.
 */
function withSource<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    source: RowSource<TRow>,
    rowKey: RowKeyGetter<TRow> | undefined,
    hints: RowKeyHints,
): DataGridState<TRow, TNode> {
    const next = reconcile({
        ...state,
        source,
        rowCount: rowCountOf(source),
        rowKey,
    });
    return withExpandedRows(next, hints, newRowsOf(state, next));
}

/** The keys a `set` takes, once each, or why they are refused. */
function validRowKeys(
    rowKeys: readonly RowKey[],
): CommandResult<readonly RowKey[]> {
    if (!Array.isArray(rowKeys)) return invalid("rowKeys must be an array");
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
): CommandResult<RowKey> {
    if (!isIndex(rowIndex, state.rowCount)) {
        return fail("not_found", `no row ${rowIndex}`);
    }
    const key = loadedRowKey(state, rowIndex);
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

/** The columns under a column's or a group's key (a column's is itself), or `undefined`. */
function columnsOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    key: string,
): readonly Column<TRow, TNode>[] | undefined {
    const cell = state.header.cellByKey(key);
    return cell
        ? state.columns.slice(
              cell.columnIndex,
              cell.columnIndex + cell.columnSpan,
          )
        : undefined;
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

function validSize(size: unknown): boolean {
    return (
        typeof size === "function" ||
        (typeof size === "number" && Number.isFinite(size) && size >= 0)
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
            const { columns, header } = layoutColumns(entries);
            const next = reconcile({
                ...state,
                columns,
                columnEntries: entries,
                header,
                // a sorted column gone, or no longer sortable, leaves the sort
                sortColumns: validSortColumns(columns, state.sortColumns),
            });
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
            const next = withSource(
                state,
                "rows" in payload
                    ? { rows: payload.rows }
                    : { rowCount: payload.rowCount, getRow: payload.getRow },
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
            return done(next, range);
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
                const found = sortableColumn(state.columns, entry.columnKey);
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
            const found = sortableColumn(state.columns, columnKey);
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
                // its key is unknown until it loads
                const found = loadedKeyAt(state, payload.rowIndex, (rowIndex) =>
                    fail("refused", `row ${rowIndex} is not loaded`),
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
        "selected-rows.set": (state, { rowKeys }) => {
            if (!state.rowSelection) return selectionOff();
            const unique = validRowKeys(rowKeys);
            if (!unique.ok) return unique;
            const keys = keptRowKeys(unique.value, state.rowSelection);
            return selected(
                state,
                keys,
                keptAnchor(state.selectionAnchor, keys),
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
            const found = loadedKeyAt(state, rowIndex, notLoaded);
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
            const found = loadedKeyAt(state, rowIndex, notLoaded);
            if (!found.ok) return found;
            const anchor = {
                rowKey: found.value,
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
                keptAnchor(state.selectionAnchor, all.value),
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
                              ? keptAnchor(state.selectionAnchor, keys)
                              : null,
                      };
            return done(next, undefined);
        },
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
        "column-widths.resize": (state, { columnKey, width }) => {
            if (!Number.isFinite(width)) {
                return invalid("width must be a finite number");
            }
            const columns = columnsOf(state, columnKey);
            if (!columns) {
                return fail("not_found", `no column or group "${columnKey}"`);
            }
            if (!columns.some(isResizable)) {
                return fail("refused", `"${columnKey}" is not resizable`);
            }
            return withWidths(
                state,
                resizedWidths(columns, state.columnWidths, width),
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
            const keys = columnsOf(state, columnKey)?.map(
                (column) => column.key,
            );
            if (!keys && !Object.hasOwn(state.columnWidths, columnKey)) {
                return fail("not_found", `no column or group "${columnKey}"`);
            }
            return withWidths(
                state,
                withoutWidths(state.columnWidths, keys ?? [columnKey]),
            );
        },
        "sizes.set": (state, { rowHeight, headerRowHeight, detailHeight }) => {
            if (rowHeight !== undefined && !validSize(rowHeight)) {
                return invalid("rowHeight must be a size or a function");
            }
            if (
                headerRowHeight !== undefined &&
                (typeof headerRowHeight !== "number" ||
                    !validSize(headerRowHeight))
            ) {
                return invalid("headerRowHeight must be a size");
            }
            if (detailHeight !== undefined && !validSize(detailHeight)) {
                return invalid("detailHeight must be a size or a function");
            }
            const next = reconcile({
                ...state,
                rowHeight: rowHeight ?? state.rowHeight,
                headerRowHeight: headerRowHeight ?? state.headerRowHeight,
                detailHeight: detailHeight ?? state.detailHeight,
            });
            return done(next, undefined);
        },
        "active-position.set": (state, payload) => {
            if (!isCell(state, payload)) {
                return fail(
                    "not_found",
                    `no cell at row ${payload.rowIndex}, column ${payload.columnIndex}`,
                );
            }
            const position = headerCellPosition(state, {
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
    const { columns, header } = layoutColumns(entries);
    const selectionMode =
        options.rowSelection && ROW_SELECTIONS.includes(options.rowSelection)
            ? options.rowSelection
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
        headerRowHeight: options.headerRowHeight ?? DEFAULT_HEADER_ROW_HEIGHT,
        activePosition: options.activePosition ?? null,
        sortColumns: copied(
            validSortColumns(columns, options.sortColumns ?? []),
        ),
        rowsChanged: { revision: 0, start: 0, end: 0 },
        expandedRowKeys: uniqueRowKeys(options.expandedRowKeys ?? []) ?? [],
        expandedRows: [],
        detailHeight: options.detailHeight ?? DEFAULT_DETAIL_HEIGHT,
        rowSelection: selectionMode,
        selectedRowKeys: keptRowKeys(
            uniqueRowKeys(options.selectedRowKeys ?? []) ?? [],
            selectionMode,
        ),
        isRowSelectable: options.isRowSelectable,
        selectionAnchor: null,
        columnWidths: keptWidths(options.columnWidths),
    };
    let state = withSource(
        blank,
        options.rows !== undefined || options.getRow === undefined
            ? { rows: options.rows ?? [] }
            : { rowCount: options.rowCount ?? 0, getRow: options.getRow },
        options.rowKey,
        hints,
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
        "row-key-by": ({ rowIndex }) =>
            loadedRowKey(state, rowIndex) ?? rowIndex,
        "cell-value-by": ({ rowIndex, columnIndex }) => {
            const row = rowAt(state.source, rowIndex);
            const column = state.columns[columnIndex];
            return row !== undefined && column
                ? cellValue(column, row, rowIndex)
                : undefined;
        },
        "active-position": () => state.activePosition,
        "sort-columns": () => state.sortColumns,
        "sort-column-by": ({ columnKey }) =>
            state.sortColumns.find((entry) => entry.columnKey === columnKey),
        "column-widths": () => state.columnWidths,
        "column-width-by": ({ columnKey }) =>
            columnsOf(state, columnKey)?.reduce(
                (sum, column) => sum + columnWidth(column, state.columnWidths),
                0,
            ),
        "row-height": () => state.rowHeight,
        "header-row-height": () => state.headerRowHeight,
        "expanded-row-keys": () => state.expandedRowKeys,
        "expanded-rows": () => state.expandedRows,
        "detail-height": () => state.detailHeight,
        "row-selection": () => state.rowSelection,
        "selected-row-keys": () => state.selectedRowKeys,
        "selection-anchor": () => validAnchor(state),
    };

    const questions: {
        [K in QuestionKey]: (payload: QuestionMap[K]) => boolean;
    } = {
        "cell-active": (position) =>
            state.activePosition !== null &&
            sameCell(state.activePosition, position, state.header.cellAt),
        "row-active": ({ rowIndex }) =>
            state.activePosition?.rowIndex === rowIndex,
        "row-loaded": ({ rowIndex }) =>
            rowAt(state.source, rowIndex) !== undefined,
        "column-sortable": ({ columnKey }) =>
            sortableColumn(state.columns, columnKey).ok,
        "row-expanded": ({ rowIndex }) =>
            holdsRow(state.expandedRows, rowIndex),
        "row-selected": ({ rowIndex }) => isRowSelected(state, rowIndex),
        "row-selectable": ({ rowIndex }) => isRowSelectable(state, rowIndex),
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
    "selected-rows.set",
    "selected-rows.toggle",
    "selected-rows.select-all",
    "selection-anchor.set",
    "selection-anchor.clear",
    "row-selection.set",
    "column-widths.set",
    "column-widths.resize",
    "column-widths.reset",
    "sizes.set",
    "active-position.set",
    "active-position.clear",
    "active-position.move",
] satisfies (keyof CommandMap<unknown>)[];
