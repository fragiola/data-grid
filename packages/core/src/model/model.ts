import { columnsError, layoutColumns } from "../header/header";
import {
    DIRECTIONS,
    type GridBounds,
    nextPosition,
    sameCell,
} from "../navigation/navigation";
import {
    DEFAULT_DETAIL_HEIGHT,
    expandedRowsOf,
    holdsRow,
    isRowKey,
    loadedRowKey,
    type RowKeyHints,
    type SearchRange,
    sameRowKeys,
} from "./expansion";
import {
    SORT_DIRECTIONS,
    sameSortColumns,
    sortableColumn,
    toggledSort,
    validSortColumns,
} from "./sort";
import { rowAt } from "./source";
import type {
    CellPosition,
    Column,
    CommandArgs,
    CommandContext,
    CommandError,
    CommandErrorCode,
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
    RowSource,
    SortColumn,
} from "./types";

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

/** The vetoed result a middleware returns to stop a command. */
export function veto(message = "vetoed by a middleware"): {
    readonly ok: false;
    readonly error: CommandError;
} {
    return { ok: false, error: { code: "vetoed", message } };
}

function fail(
    code: CommandErrorCode,
    message: string,
): { readonly ok: false; readonly error: CommandError } {
    return { ok: false, error: { code, message } };
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

function rowCountOf<TRow>(source: RowSource<TRow>): number {
    return "rows" in source ? source.rows.length : source.rowCount;
}

function headerRowCountOf<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): number {
    return state.headerRowHeight > 0 ? state.header.depth : 0;
}

/** What moves in the grid are bounded by: its rows, its columns and its header's cells. */
function boundsOf<TRow, TNode>(state: DataGridState<TRow, TNode>): GridBounds {
    return {
        rowCount: state.rowCount,
        columnCount: state.columns.length,
        headerRowCount: headerRowCountOf(state),
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

/** The cell's value: the column's getter, or the row's property named by the key. */
export function cellValue<TRow, TNode>(
    column: Column<TRow, TNode>,
    row: TRow,
    rowIndex: number,
): unknown {
    if (column.getValue) return column.getValue(row, rowIndex);
    if (typeof row === "object" && row !== null) {
        const value: unknown = Reflect.get(row, column.key);
        return value;
    }
    return undefined;
}

function isCell<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    { rowIndex, columnIndex }: CellPosition,
): boolean {
    return (
        Number.isInteger(rowIndex) &&
        Number.isInteger(columnIndex) &&
        rowIndex >= 0 - headerRowCountOf(state) &&
        rowIndex < state.rowCount &&
        columnIndex >= 0 &&
        columnIndex < state.columns.length
    );
}

/** The active position kept inside the grid after its shape changed (or none left). */
function reconcile<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): DataGridState<TRow, TNode> {
    const active = state.activePosition;
    if (!active) return state;
    const firstRow = 0 - headerRowCountOf(state);
    const lastRow = state.rowCount - 1;
    if (
        state.columns.length === 0 ||
        lastRow < firstRow ||
        !Number.isInteger(active.rowIndex) ||
        !Number.isInteger(active.columnIndex)
    ) {
        return { ...state, activePosition: null };
    }
    const { rowIndex, columnIndex } = headerCellPosition(state, {
        rowIndex: Math.min(Math.max(active.rowIndex, firstRow), lastRow),
        columnIndex: Math.min(
            Math.max(active.columnIndex, 0),
            state.columns.length - 1,
        ),
    });
    if (rowIndex === active.rowIndex && columnIndex === active.columnIndex) {
        return state;
    }
    return { ...state, activePosition: { rowIndex, columnIndex } };
}

/** The model's own copy of a sort: the caller's array changing later changes nothing. */
function copied(sortColumns: readonly SortColumn[]): readonly SortColumn[] {
    return sortColumns.map(({ columnKey, direction }) => ({
        columnKey,
        direction,
    }));
}

/**
 * The state with the expanded rows found again after the rows or the keys changed: a key missing
 * from where it was is looked for in `search` (every row by default).
 */
function withExpandedRows<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    hints: RowKeyHints,
    search: SearchRange = { start: 0, end: state.rowCount },
): DataGridState<TRow, TNode> {
    const expandedRows = expandedRowsOf(state, hints, search);
    return sameRowKeys(expandedRows, state.expandedRows)
        ? state
        : { ...state, expandedRows };
}

/** The expanded keys, once each: `undefined` when one is not a key. */
function uniqueRowKeys(
    keys: readonly unknown[],
): readonly RowKey[] | undefined {
    const unique = new Set<RowKey>();
    for (const key of keys) {
        if (!isRowKey(key)) return undefined;
        unique.add(key);
    }
    return [...unique];
}

function validSize(size: unknown): boolean {
    return (
        typeof size === "function" ||
        (typeof size === "number" && Number.isFinite(size) && size >= 0)
    );
}

/**
 * The rows a new source may hold expanded keys in: behind the same `getRow` and `rowKey`, only
 * the rows it added (the others change through `rows.changed`); anything else, every row.
 */
function newRowsOf<TRow, TNode>(
    before: DataGridState<TRow, TNode>,
    after: DataGridState<TRow, TNode>,
): SearchRange {
    const same =
        "getRow" in before.source &&
        "getRow" in after.source &&
        before.source.getRow === after.source.getRow &&
        before.rowKey === after.rowKey;
    return { start: same ? before.rowCount : 0, end: after.rowCount };
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
            if (error) return fail("invalid_payload", error);
            const { columns, header } = layoutColumns(entries);
            return {
                ok: true,
                value: {
                    state: reconcile({
                        ...state,
                        columns,
                        columnEntries: entries,
                        header,
                        // a sorted column gone, or no longer sortable, leaves the sort
                        sortColumns: validSortColumns(
                            columns,
                            state.sortColumns,
                        ),
                    }),
                    value: { columnCount: columns.length },
                },
            };
        },
        "data.set": (state, payload) => {
            let source: RowSource<TRow>;
            if ("rows" in payload) {
                if (!Array.isArray(payload.rows)) {
                    return fail("invalid_payload", "rows must be an array");
                }
                source = { rows: payload.rows };
            } else {
                if (
                    !Number.isInteger(payload.rowCount) ||
                    payload.rowCount < 0
                ) {
                    return fail(
                        "invalid_payload",
                        "rowCount must be a whole number, 0 or more",
                    );
                }
                if (typeof payload.getRow !== "function") {
                    return fail("invalid_payload", "getRow must be a function");
                }
                source = {
                    rowCount: payload.rowCount,
                    getRow: payload.getRow,
                };
            }
            const rowCount = rowCountOf(source);
            const reconciled = reconcile({
                ...state,
                source,
                rowCount,
                rowKey: "rowKey" in payload ? payload.rowKey : state.rowKey,
            });
            const next = withExpandedRows(
                reconciled,
                hints,
                newRowsOf(state, reconciled),
            );
            return { ok: true, value: { state: next, value: { rowCount } } };
        },
        "rows.changed": (state, { start, end }) => {
            for (const [name, bound] of [
                ["start", start],
                ["end", end],
            ] as const) {
                if (
                    bound !== undefined &&
                    (!Number.isInteger(bound) || bound < 0)
                ) {
                    return fail(
                        "invalid_payload",
                        `${name} must be a whole number, 0 or more`,
                    );
                }
            }
            if (start !== undefined && end !== undefined && start > end) {
                return fail("invalid_payload", "start must not be after end");
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
            return { ok: true, value: { state: next, value: range } };
        },
        "sort-columns.set": (state, { sortColumns }) => {
            if (!Array.isArray(sortColumns)) {
                return fail("invalid_payload", "sortColumns must be an array");
            }
            const seen = new Set<string>();
            for (const entry of sortColumns) {
                if (!SORT_DIRECTIONS.includes(entry?.direction)) {
                    return fail(
                        "invalid_payload",
                        `direction must be one of ${SORT_DIRECTIONS.join(", ")}`,
                    );
                }
                const found = sortableColumn(state.columns, entry.columnKey);
                if ("error" in found) return { ok: false, error: found.error };
                if (seen.has(entry.columnKey)) {
                    return fail(
                        "invalid_payload",
                        `column "${entry.columnKey}" is sorted twice`,
                    );
                }
                seen.add(entry.columnKey);
            }
            const next = sameSortColumns(sortColumns, state.sortColumns)
                ? state
                : { ...state, sortColumns: copied(sortColumns) };
            return {
                ok: true,
                value: { state: next, value: next.sortColumns },
            };
        },
        "sort-columns.toggle": (state, { columnKey, multi }) => {
            const found = sortableColumn(state.columns, columnKey);
            if ("error" in found) return { ok: false, error: found.error };
            const sortColumns = toggledSort(
                state.sortColumns,
                columnKey,
                multi === true,
            );
            const next = sameSortColumns(sortColumns, state.sortColumns)
                ? state
                : { ...state, sortColumns };
            return {
                ok: true,
                value: { state: next, value: next.sortColumns },
            };
        },
        "expanded-rows.set": (state, { rowKeys }) => {
            if (!Array.isArray(rowKeys)) {
                return fail("invalid_payload", "rowKeys must be an array");
            }
            const keys = uniqueRowKeys(rowKeys);
            if (!keys) {
                return fail(
                    "invalid_payload",
                    "a row key must be a string or a finite number",
                );
            }
            const next = sameRowKeys(keys, state.expandedRowKeys)
                ? state
                : withExpandedRows({ ...state, expandedRowKeys: keys }, hints);
            return {
                ok: true,
                value: { state: next, value: next.expandedRowKeys },
            };
        },
        "expanded-rows.toggle": (state, payload) => {
            let key: RowKey | undefined;
            if (payload.rowIndex !== undefined) {
                if (
                    !Number.isInteger(payload.rowIndex) ||
                    payload.rowIndex < 0 ||
                    payload.rowIndex >= state.rowCount
                ) {
                    return fail("not_found", `no row ${payload.rowIndex}`);
                }
                key = loadedRowKey(state, payload.rowIndex);
                if (key === undefined) {
                    // its key is unknown until it loads
                    return fail(
                        "refused",
                        `row ${payload.rowIndex} is not loaded`,
                    );
                }
            } else if (isRowKey(payload.rowKey)) {
                key = payload.rowKey;
            } else {
                return fail(
                    "invalid_payload",
                    "toggle a rowIndex, or a rowKey (a string or a finite number)",
                );
            }
            const expanded = state.expandedRowKeys.includes(key);
            const keys = expanded
                ? state.expandedRowKeys.filter((entry) => entry !== key)
                : [...state.expandedRowKeys, key];
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
                    : [...state.expandedRows, index].sort((a, b) => a - b);
            } else {
                expandedRows = expandedRowsOf(
                    { ...state, expandedRowKeys: keys },
                    hints,
                    { start: 0, end: state.rowCount },
                );
            }
            const next = { ...state, expandedRowKeys: keys, expandedRows };
            return {
                ok: true,
                value: { state: next, value: keys },
            };
        },
        "sizes.set": (state, { rowHeight, headerRowHeight, detailHeight }) => {
            if (rowHeight !== undefined && !validSize(rowHeight)) {
                return fail(
                    "invalid_payload",
                    "rowHeight must be a size or a function",
                );
            }
            if (
                headerRowHeight !== undefined &&
                (typeof headerRowHeight !== "number" ||
                    !validSize(headerRowHeight))
            ) {
                return fail(
                    "invalid_payload",
                    "headerRowHeight must be a size",
                );
            }
            if (detailHeight !== undefined && !validSize(detailHeight)) {
                return fail(
                    "invalid_payload",
                    "detailHeight must be a size or a function",
                );
            }
            const next = reconcile({
                ...state,
                rowHeight: rowHeight ?? state.rowHeight,
                headerRowHeight: headerRowHeight ?? state.headerRowHeight,
                detailHeight: detailHeight ?? state.detailHeight,
            });
            return { ok: true, value: { state: next, value: undefined } };
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
                current?.rowIndex === position.rowIndex &&
                current.columnIndex === position.columnIndex
                    ? state
                    : { ...state, activePosition: position };
            return { ok: true, value: { state: next, value: position } };
        },
        "active-position.clear": (state) => ({
            ok: true,
            value: {
                state: state.activePosition
                    ? { ...state, activePosition: null }
                    : state,
                value: undefined,
            },
        }),
        "active-position.move": (
            state,
            { direction, pageSize, visibleColumns },
        ) => {
            if (!DIRECTIONS.includes(direction)) {
                return fail(
                    "invalid_payload",
                    `direction must be one of ${DIRECTIONS.join(", ")}`,
                );
            }
            if (pageSize !== undefined && !Number.isFinite(pageSize)) {
                return fail("invalid_payload", "pageSize must be a number");
            }
            if (
                visibleColumns !== undefined &&
                (!Number.isInteger(visibleColumns.start) ||
                    !Number.isInteger(visibleColumns.end))
            ) {
                return fail(
                    "invalid_payload",
                    "visibleColumns must have whole-number bounds",
                );
            }
            const current = state.activePosition;
            if (!current) {
                return fail("refused", "no cell is active");
            }
            const position = nextPosition(
                current,
                direction,
                { ...boundsOf(state), visibleColumns },
                pageSize,
            );
            const moved =
                position.rowIndex !== current.rowIndex ||
                position.columnIndex !== current.columnIndex;
            return {
                ok: true,
                value: {
                    state: moved
                        ? { ...state, activePosition: position }
                        : state,
                    value: position,
                },
            };
        },
    };
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
    const source: RowSource<TRow> =
        options.rows !== undefined || options.getRow === undefined
            ? { rows: options.rows ?? [] }
            : { rowCount: options.rowCount ?? 0, getRow: options.getRow };
    const entries = options.columns ?? [];
    // the same rules as `columns.set`: a grid never starts with columns it would refuse
    const error = columnsError(entries);
    if (error) throw new TypeError(`invalid columns: ${error}`);
    const { columns, header } = layoutColumns(entries);
    let state: DataGridState<TRow, TNode> = reconcile({
        columns,
        columnEntries: entries,
        header,
        source,
        rowCount: rowCountOf(source),
        rowKey: options.rowKey,
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
    });
    state = withExpandedRows(state, hints);
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
                    applied = fail(
                        "invalid_payload",
                        error instanceof Error ? error.message : String(error),
                    );
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
                return fail(
                    "middleware_error",
                    error instanceof Error ? error.message : String(error),
                );
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
        "header-row-count": () => headerRowCountOf(state),
        "header-depth": () => state.header.depth,
        "header-rows": () => state.header.rows,
        "header-cell-by": ({ rowIndex, columnIndex }) =>
            rowIndex < 0 && rowIndex >= 0 - headerRowCountOf(state)
                ? state.header.cellAt(rowIndex, columnIndex)
                : undefined,
        "column-entries": () => state.columnEntries,
        "row-by": ({ index }) => rowAt(state.source, index),
        "row-key-by": ({ rowIndex }) => {
            const row = rowAt(state.source, rowIndex);
            return row !== undefined && state.rowKey
                ? state.rowKey(row, rowIndex)
                : rowIndex;
        },
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
        "row-height": () => state.rowHeight,
        "header-row-height": () => state.headerRowHeight,
        "expanded-row-keys": () => state.expandedRowKeys,
        "expanded-rows": () => state.expandedRows,
        "detail-height": () => state.detailHeight,
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
            "column" in sortableColumn(state.columns, columnKey),
        "row-expanded": ({ rowIndex }) =>
            holdsRow(state.expandedRows, rowIndex),
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

/** The commands' names, for tools and guards. */
export const COMMANDS: readonly CommandName[] = [
    "columns.set",
    "data.set",
    "rows.changed",
    "sort-columns.set",
    "sort-columns.toggle",
    "expanded-rows.set",
    "expanded-rows.toggle",
    "sizes.set",
    "active-position.set",
    "active-position.clear",
    "active-position.move",
] satisfies (keyof CommandMap<unknown>)[];
