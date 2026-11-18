import type {
    DataGridFeatures,
    FeatureKeys,
    FeatureState,
} from "../feature/feature";
import {
    composeFeatures,
    type GridFeatures,
    registerFeatures,
} from "../feature/registry";
import {
    type ColumnArrangement,
    columnsError,
    headerRowCount,
    isHeaderRow,
    layoutColumns,
} from "../header/header";
import { keptRow, sameCell } from "../navigation/navigation";
import { clamp, isIndex, isWidth } from "../utils/utils";
import { overlaps } from "../viewport/window";
import { boundsOf, cellPosition } from "./bounds";
import { DEFAULT_DETAIL_HEIGHT, uniqueRowKeys } from "./expansion";
import { followedColumn } from "./layout";
import { done, fail, invalid, notOneOf, ok, veto } from "./result";
import {
    dataRowAt,
    rowAt,
    rowCellValue,
    rowCountOf,
    rowKeyAt,
    rowLoaded,
    rowMetaAt,
} from "./source";
import { NO_SUMMARY_ROWS, summaryRowAt, summaryRowIndex } from "./summary";
import type {
    ColumnOrGroup,
    CommandContext,
    CommandListener,
    CommandMap,
    CommandName,
    CommandResult,
    DataGridModelOptions,
    DataGridState,
    GridCommandName,
    GridCommands,
    GridDirection,
    GridQueries,
    GridQuestions,
    KeyArgs,
    Middleware,
    ModelState,
    PayloadArgs,
    PayloadIn,
    PayloadOf,
    QueryKey,
    QueryMap,
    QuestionKey,
    QuestionMap,
    ResultIn,
    ResultOf,
    RowKey,
    RowKeyGetter,
    RowSource,
} from "./types";
import { columnsOf, columnWidth, NO_WIDTHS } from "./widths";

// The model (D3): the grid's data and rules, the single source of truth. Every change is a
// command through the middleware chain; reads are `get`/`is` keys. It loads and runs in plain
// Node: no DOM, no framework.

/** A row's height when none is given. */
export const DEFAULT_ROW_HEIGHT = 35;
/** The header row's height when none is given. */
export const DEFAULT_HEADER_ROW_HEIGHT = 35;

/**
 * The grid's model. Its keys are the core's and its installed features' (`TFeatures`, Epic #141):
 * a command, a `get` or an `is` key of a feature not installed does not compile.
 */
export interface DataGridModel<
    TRow,
    TNode = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> {
    /** the committed state: immutable, a new object after every committed command */
    readonly state: ModelState<TRow, TNode, TFeatures>;
    /** runs a command through the middleware chain and commits it */
    run<C extends GridCommandName<TRow, TNode, TFeatures>>(
        command: C,
        ...payload: KeyArgs<GridCommands<TRow, TNode, TFeatures>, C>
    ): CommandResult<ResultIn<GridCommands<TRow, TNode, TFeatures>[C]>>;
    /** whether the command would apply now (a dry run: nothing is committed) */
    can<C extends GridCommandName<TRow, TNode, TFeatures>>(
        command: C,
        ...payload: KeyArgs<GridCommands<TRow, TNode, TFeatures>, C>
    ): boolean;
    /** what the command would return now (a dry run: nothing is committed) */
    check<C extends GridCommandName<TRow, TNode, TFeatures>>(
        command: C,
        ...payload: KeyArgs<GridCommands<TRow, TNode, TFeatures>, C>
    ): CommandResult<ResultIn<GridCommands<TRow, TNode, TFeatures>[C]>>;
    /** reads a value */
    get<K extends keyof GridQueries<TRow, TNode, TFeatures> & string>(
        key: K,
        ...payload: PayloadArgs<
            PayloadIn<GridQueries<TRow, TNode, TFeatures>[K]>
        >
    ): ResultIn<GridQueries<TRow, TNode, TFeatures>[K]>;
    /** answers a yes/no question */
    is<K extends keyof GridQuestions<TRow, TNode, TFeatures> & string>(
        key: K,
        payload: GridQuestions<TRow, TNode, TFeatures>[K],
    ): boolean;
    /**
     * adds a middleware around every command (`Middleware`); returns its removal. (Its type is
     * spelled out, not `Middleware`'s name: a model with features is then a model, Epic #141.)
     */
    use(
        middleware: {
            // a method's parameters compare both ways
            middleware(
                ctx: CommandContext<TRow, TNode, TFeatures>,
                next: () => CommandResult<unknown>,
            ): CommandResult<unknown> | undefined;
        }["middleware"],
    ): () => void;
    /** listens to every committed command (`CommandListener`); returns the unsubscription */
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

/** The grid's directions. */
const GRID_DIRECTIONS: readonly GridDirection[] = ["ltr", "rtl"];

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
 * left): on the same row where it can be (`keptActiveRow`), and column. A feature's state keeps
 * to its own rules (`stateChanged`: a range's, an edit's).
 */
export function reconcile<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    before: DataGridState<TRow, TNode> = state,
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

/**
 * The state with its rows from `source` (`data.set`, and a new model): the active cell kept
 * inside them (following its row from `state`'s, unless `follow` is false: a new model's position
 * is given for its rows). A feature keeps its own state to them (`sourceChanged`: the expanded
 * rows looked for where the new source may hold them).
 */
function withSource<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
    source: RowSource<TRow>,
    rowKey: RowKeyGetter<TRow> | undefined,
    follow = true,
): DataGridState<TRow, TNode> {
    const sourced = {
        ...state,
        source,
        rowCount: rowCountOf(source),
        rowKey,
    };
    return reconcile(sourced, follow ? state : sourced);
}

/** A source's own copy of where rows come from: the rows or the getter, and their kinds. */
function sourceOf<TRow>(given: RowSource<TRow>): RowSource<TRow> {
    const meta = given.getRowMeta ? { getRowMeta: given.getRowMeta } : {};
    return "rows" in given
        ? { rows: given.rows, ...meta }
        : { rowCount: given.rowCount, getRow: given.getRow, ...meta };
}

/** The keys a `set` takes, once each, or why they are refused. */
export function validRowKeys(
    rowKeys: readonly RowKey[],
    name = "rowKeys",
): CommandResult<readonly RowKey[]> {
    if (!Array.isArray(rowKeys)) return invalid(`${name} must be an array`);
    const keys = uniqueRowKeys(rowKeys);
    return keys
        ? ok(keys)
        : invalid("a row key must be a string or a finite number");
}

/**
 * The columns and the header of the entries, each sibling list as the features lay it out
 * (`columnLayout`, Epic #148: an order, a collapsible group's children by its state) for `state`;
 * as declared without any.
 */
function layoutOf<TRow, TNode>(
    features: GridFeatures,
    state: DataGridState<TRow, TNode>,
    entries: readonly ColumnOrGroup<TRow, TNode>[],
) {
    // the features' arrangement is of any row: it reads keys and flags only
    return layoutColumns(
        entries,
        features.columnLayout?.arrangement(state as FeatureState) as
            | ColumnArrangement<TRow, TNode>
            | undefined,
    );
}

/**
 * The state laid out again for its features' new say in the layout (an order, a collapse: Epic
 * #148), its active cell on its column wherever it went (a header cell's at its cell's new first
 * column, on the same row), or, hidden by a collapse, on the nearest column its group still shows
 * (`followedColumn`).
 */
function relaidOut<TRow, TNode>(
    features: GridFeatures,
    state: DataGridState<TRow, TNode>,
): DataGridState<TRow, TNode> {
    const { columns, header } = layoutOf(features, state, state.columnEntries);
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
    // in its new place, a span may cover it (E1.2)
    return reconcile({ ...state, columns, header, activePosition }, state);
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
    return typeof size === "function" || isWidth(size);
}

/** A row's or a detail's height: a size, a function, or `"auto"` (measured, E2.2). */
export function validHeight(height: unknown): boolean {
    return height === "auto" || validSize(height);
}

/**
 * What a measured height starts from: a size above 0 (a window of rows of no height would hold
 * them all).
 */
export function validEstimate(size: unknown): size is number {
    return isWidth(size) && size > 0;
}

/** The commands' handlers. */
function createHandlers<TRow, TNode>(
    features: GridFeatures,
): Handlers<TRow, TNode> {
    return {
        "columns.set": (state, { columns: entries }) => {
            const error = columnsError(entries);
            if (error) return invalid(error);
            const { columns, header } = layoutOf(features, state, entries);
            const next = reconcile(
                {
                    ...state,
                    columns,
                    columnEntries: entries,
                    header,
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
            // no row in it: nothing to tell. Rows that arrived may be expanded ones (a feature
            // keeps its state to them: `sourceChanged`)
            const next =
                range.start < range.end
                    ? {
                          ...state,
                          rowsChanged: {
                              revision: state.rowsChanged.revision + 1,
                              ...range,
                          },
                      }
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
                if (size !== undefined && !isWidth(size)) {
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

/**
 * What `createDataGridModel` takes: the core's options (`DataGridModelOptions`), the features
 * installed (fixed for the model's life) and their options.
 */
export type ModelOptions<
    TRow,
    TNode = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> = DataGridModelOptions<TRow, TNode> &
    Partial<FeatureKeys<TFeatures, TRow, TNode>["options"]> & {
        /**
         * the features installed on the grid (Epic #141), fixed for its life: their keys join the
         * core's, their state the model's
         */
        readonly features?: TFeatures | undefined;
    };

/**
 * Creates a grid's model, with the features it installs. It throws when the columns are invalid
 * (see `columns.set`), a feature is installed twice, one misses a feature it requires, or two
 * add the same key.
 */
export function createDataGridModel<
    TRow,
    TNode = unknown,
    const TFeatures extends DataGridFeatures = [],
>(
    options: ModelOptions<TRow, TNode, TFeatures> = {},
): DataGridModel<TRow, TNode, TFeatures> {
    const features = composeFeatures(options.features ?? []);
    const handlers: Handlers<TRow, TNode> = createHandlers<TRow, TNode>(
        features,
    );
    for (const [name, handler] of features.commands) {
        if (Object.hasOwn(handlers, name)) {
            throw new TypeError(
                `a feature adds the command "${name}", which the grid has`,
            );
        }
        (handlers as Record<string, unknown>)[name] = handler;
    }
    const entries = options.columns ?? [];
    // the same rules as `columns.set`: a grid never starts with columns it would refuse
    const error = columnsError(entries);
    if (error) throw new TypeError(`invalid columns: ${error}`);
    // as declared: the features' say in the layout (an order, a collapse) is theirs to start with
    const { columns, header } = layoutColumns(entries);
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
        // the row bands and a size (D7): the summary rows feature's options give them (Epic #151)
        summaryRows: NO_SUMMARY_ROWS,
        summaryRowHeight: DEFAULT_ROW_HEIGHT,
        summaryRevision: 0,
        // a feature's to set (navigation, Epic #144): none without it
        activePosition: null,
        rowsChanged: { revision: 0, start: 0, end: 0 },
        // a size (D7): row expansion's options give them (Epic #151)
        detailHeight: DEFAULT_DETAIL_HEIGHT,
        estimatedDetailHeight: DEFAULT_DETAIL_HEIGHT,
        direction:
            options.direction && GRID_DIRECTIONS.includes(options.direction)
                ? options.direction
                : undefined,
        // the column spans in effect (Epic #151: `cellSpans()`'s), for the model's life
        ...(features.cellSpans ? { cellSpans: features.cellSpans } : {}),
    };
    // each feature's slice, from its options (the columns laid out as declared), then the columns
    // as the features lay them out (Epic #148: an order, collapsed groups to start with)
    const sliced = features.initial(
        blank as DataGridState<unknown, unknown>,
        options as Readonly<Record<string, unknown>>,
    ) as DataGridState<TRow, TNode>;
    const initial = features.columnLayout
        ? { ...sliced, ...layoutOf(features, sliced, entries) }
        : sliced;
    let state = withSource(
        initial,
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
        // the position given is for these rows
        false,
    );
    // the features' state its rules, for the rows given (a range: Epic #144; an edit given to
    // start with takes the keys it finds: Epic #146)
    const settle = features.stateChanged;
    if (settle) {
        // against the state as given, its active cell as the rows keep it (a position clamped or
        // snapped at creation is no move)
        state = settle(
            state as FeatureState,
            {
                ...initial,
                activePosition: state.activePosition,
            } as FeatureState,
        ) as DataGridState<TRow, TNode>;
    }
    const middlewares: Middleware<TRow, TNode, []>[] = [];
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
            // a feature's command while that feature is not installed (Epic #141), or no command
            return fail(
                "not_found",
                `no command "${String(command)}": not the grid's, nor an installed feature's`,
            );
        }
        // the union of payloads is checked by the handler that reads it
        const ctx = {
            command,
            payload: payload ?? {},
            dryRun,
            state,
        } as CommandContext<TRow, TNode, []>;
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
                    // the features keep their state to a new source, new columns or rows changed,
                    // then to their own rules (a range's: Epic #144; an edit's, following the
                    // active cell whatever moved it: Epic #146)
                    if (applied.ok) {
                        const kept = withFeatureState(
                            features,
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
                return applied.ok ? ok(applied.value.value) : applied;
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
            return done(state, result.value);
        }
        return ok({
            state: applied.value.state,
            value: result.value,
            payload: ctx.payload,
        });
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
        return outcome.ok ? ok(outcome.value.value) : outcome;
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
        return outcome.ok ? ok(outcome.value.value) : outcome;
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
            return rowCellValue(
                column,
                rowIndex,
                meta?.group,
                dataRowAt(state.source, rowIndex, meta),
            );
        },
        "column-width-by": ({ columnKey }) => {
            const span = state.header.cellByKey(columnKey);
            // a resize's widths over the declared ones (Epic #148: `columnResize()`'s)
            const overrides =
                features.columnWidths?.(state as FeatureState) ?? NO_WIDTHS;
            return span
                ? columnsOf(state, span).reduce(
                      (sum, column) => sum + columnWidth(column, overrides),
                      0,
                  )
                : undefined;
        },
        "row-height": () => state.rowHeight,
        "header-row-height": () => state.headerRowHeight,
        direction: () => state.direction,
        "row-meta-by": ({ rowIndex }) => rowMetaAt(state.source, rowIndex),
    };

    const questions: {
        [K in QuestionKey]: (payload: QuestionMap[K]) => boolean;
    } = {
        // a group row (Epic #87) has nothing to wait for
        "row-loaded": ({ rowIndex }) => rowLoaded(state.source, rowIndex),
    };

    for (const [kind, own, added] of [
        ["get", queries, features.queries],
        ["is", questions, features.questions],
    ] as const) {
        for (const key of added.keys()) {
            if (Object.hasOwn(own, key)) {
                throw new TypeError(
                    `a feature adds the ${kind} key "${key}", which the grid has`,
                );
            }
        }
    }

    const model: DataGridModel<TRow, TNode, []> = {
        get state() {
            return state;
        },
        // each value is the one its command's type names (`ResultIn`)
        run(command, ...[payload]) {
            return commit(command, payload) as never;
        },
        can(command, ...[payload]) {
            return dryRun(command, payload).ok;
        },
        check(command, ...[payload]) {
            return dryRun(command, payload) as never;
        },
        get(key, ...[payload]) {
            if (Object.hasOwn(queries, key)) {
                const query = queries[key as QueryKey] as (
                    payload: unknown,
                ) => never;
                return query(payload);
            }
            // a feature's key; one no installed feature has reads nothing
            return features.queries.get(key)?.(
                state as FeatureState,
                payload,
            ) as never;
        },
        is(key, payload) {
            if (Object.hasOwn(questions, key)) {
                const question = questions[key as QuestionKey] as (
                    payload: unknown,
                ) => boolean;
                return question(payload);
            }
            return (
                features.questions.get(key)?.(state as FeatureState, payload) ??
                false
            );
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
    // its engines and root read its features from it; its surface stays its verbs
    registerFeatures(model, features);
    return model as unknown as DataGridModel<TRow, TNode, TFeatures>;
}

/**
 * The state after a command: the columns laid out again when a feature's say in the layout
 * changed (`columnLayout`), each feature's state kept to a new source, new columns or rows
 * changed (`sourceChanged`: only after a command that changed one of them), then to its rules
 * (`stateChanged`: after every command).
 */
function withFeatureState<TRow, TNode>(
    features: GridFeatures,
    before: DataGridState<TRow, TNode>,
    handled: DataGridState<TRow, TNode>,
): DataGridState<TRow, TNode> {
    // a feature's new say in the layout (an order, a collapse: Epic #148) lays the columns out
    const layout = features.columnLayout;
    const after =
        layout?.changed(handled as FeatureState, before as FeatureState) ===
        true
            ? relaidOut(features, handled)
            : handled;
    const keep = features.sourceChanged;
    const kept =
        !keep ||
        (after.source === before.source &&
            after.columnEntries === before.columnEntries &&
            after.rowsChanged === before.rowsChanged)
            ? after
            : (keep(
                  after as FeatureState,
                  before as FeatureState,
              ) as DataGridState<TRow, TNode>);
    const settle = features.stateChanged;
    return settle
        ? (settle(
              kept as FeatureState,
              before as FeatureState,
          ) as DataGridState<TRow, TNode>)
        : kept;
}

/** The commands' names, for tools and guards (the naming test checks it lists every one). */
export const COMMANDS = [
    "columns.set",
    "data.set",
    "rows.changed",
    "direction.set",
    "sizes.set",
] satisfies (keyof CommandMap<unknown>)[];
