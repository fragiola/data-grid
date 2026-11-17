// What every adapter's root does with its declarative props (D3, Epic #123): the model and the
// engine it creates, the controlled pieces it binds, the commands its props map onto and the
// engine events it tells. One rule for every adapter: a decision a root takes is the core's, the
// adapter only renders and calls `sync` after each render.

import { createDataGridEngine } from "../engine/engine";
import type {
    DataGridEngine,
    DataGridEngineOptions,
    RowMove,
} from "../engine/types";
import type { DataGridFeatures, FeatureKeys } from "../feature/feature";
import {
    bindFeatureEvents,
    featureControlledProps,
    featureEngineOptions,
    featureFollowers,
    featureOptions,
    featuresOf,
    type GridFeatures,
} from "../feature/registry";
import { DEFAULT_DETAIL_HEIGHT, sameRowKeys } from "../model/expansion";
import {
    createDataGridModel,
    type DataGridModel,
    DEFAULT_HEADER_ROW_HEIGHT,
    DEFAULT_ROW_HEIGHT,
} from "../model/model";
import { keptOrder, sameOrder } from "../model/order";
import type {
    ColumnOrder,
    ColumnOrGroup,
    ColumnWidths,
    DataGridState,
    DetailHeight,
    GridDirection,
    RowHeight,
    RowKey,
    RowKeyGetter,
    RowMetaGetter,
} from "../model/types";
import { keptWidths, sameWidths } from "../model/widths";
import { sameKeys } from "../utils/utils";
import type { AxisWindow } from "../viewport/window";
import {
    bindControlled,
    type Controlled,
    type ControlledFlags,
    type ControlledProp,
    controlledProp,
} from "./controlled";

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

/**
 * A root's props as the core reads them: where its rows come from, the rest, the features it
 * installs (fixed when it is created, Epic #141) and the props they add (`sortColumns` with
 * `sorting()`, …).
 */
export type GridRootProps<
    TRow,
    TNode,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> = GridRowsProps<TRow> &
    GridRootOptions<TRow, TNode> &
    FeatureKeys<TFeatures, TRow, TNode>["props"] & {
        /**
         * the features the grid installs (`[sorting()]`), fixed when it is created: a list given
         * later is ignored (told in the console). A feature not installed is not in the bundle
         */
        features?: TFeatures | undefined;
    };

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
    "expandedRowKeys",
    "defaultExpandedRowKeys",
    "onExpandedRowKeysChange",
    "expandedGroupKeys",
    "defaultExpandedGroupKeys",
    "onExpandedGroupKeysChange",
    "detailHeight",
    "estimatedDetailHeight",
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
    "features",
] as const satisfies readonly (keyof GridRootProps<unknown, unknown>)[];

/** A root prop name: one of `GRID_ROOT_PROPS`, which lists every one (a type test checks it). */
export type GridRootPropName = (typeof GRID_ROOT_PROPS)[number];

/**
 * Props without the root's own (`GRID_ROOT_PROPS`, and the props of the features it installs):
 * what goes on the root's element. A new object (an adapter's render reads it once).
 */
export function withoutRootProps<P extends object>(
    props: P,
    features?: DataGridFeatures,
): Omit<P, GridRootPropName> {
    const featureProps = features?.flatMap(
        (feature): readonly string[] => feature.root?.props ?? [],
    );
    const rest: Record<string, unknown> = {};
    for (const key in props) {
        if (!ROOT_PROP_SET.has(key) && !featureProps?.includes(key)) {
            rest[key] = props[key];
        }
    }
    return rest as Omit<P, GridRootPropName>;
}

const ROOT_PROP_SET: ReadonlySet<string> = new Set(GRID_ROOT_PROPS);

/** What `bindGridRoot` gives the adapter's root. */
export interface GridRoot<
    TRow,
    TNode,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> {
    readonly model: DataGridModel<TRow, TNode, TFeatures>;
    readonly engine: DataGridEngine<TRow, TNode>;
    /**
     * After every render of the root (before paint, the parts' layout done): the props follow
     * onto the model, each group of them only when one of its props changed (the first call: all
     * of them), the controlled pieces settle, and the engine takes its options. The first call
     * also tells the app a value to start with the grid did not take as given.
     */
    sync(): void;
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
export function bindGridRoot<
    TRow,
    TNode,
    TFeatures extends DataGridFeatures = DataGridFeatures,
>(
    gridProps: () => GridRootProps<TRow, TNode, TFeatures>,
): GridRoot<TRow, TNode, TFeatures> {
    // the core's props read as such; the features' through their own bindings
    const props = gridProps as () => GridRootProps<TRow, TNode>;
    const initial = props();
    // fixed for the grid's life (Epic #141): a list given later is told, never taken
    const installed: DataGridFeatures = initial.features ?? [];
    const model = createDataGridModel<TRow, TNode>({
        ...featureOptions(installed, initial),
        features: installed as [],
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
        expandedRowKeys:
            initial.expandedRowKeys ?? initial.defaultExpandedRowKeys,
        expandedGroupKeys:
            initial.expandedGroupKeys ?? initial.defaultExpandedGroupKeys,
        detailHeight: initial.detailHeight,
        estimatedDetailHeight: initial.estimatedDetailHeight,
        columnWidths: initial.columnWidths ?? initial.defaultColumnWidths,
        columnOrder: initial.columnOrder ?? initial.defaultColumnOrder,
        collapsedGroupKeys:
            initial.collapsedGroupKeys ?? initial.defaultCollapsedGroupKeys,
        direction: initial.direction,
    });
    const flags: ControlledFlags = { syncing: false, applying: false };
    // each piece guarded on its own commands (the order they are bound in tells uncontrolled
    // changes in that order)
    const bind = <V>(
        spec: ControlledProp<
            GridRootProps<TRow, TNode>,
            DataGridState<TRow, TNode>,
            V
        >,
    ) => bindControlled(model, flags, controlledProp(props, spec));
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
    const installedFeatures = featuresOf(model);
    const engine = createDataGridEngine<TRow, TNode>(
        model,
        engineOptions(installedFeatures, initial),
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
    // the features' events (Epic #144: a fill, a paste; Epic #146: an edit), told to their
    // props
    bindFeatureEvents(
        installedFeatures,
        engine as unknown as DataGridEngine<unknown, unknown>,
        props,
        model as unknown as DataGridModel<unknown, unknown>,
    );
    // the features' controlled props (Epic #141), bound after the core's, in their order; the
    // ones followed first (the active position, Epic #144) with the layout inputs
    const featureSpecs = featureControlledProps<GridRootProps<TRow, TNode>>(
        installedFeatures,
        model as unknown as DataGridModel<unknown, unknown>,
    );
    const featurePieces = featureSpecs.map((spec) =>
        bind(
            spec as ControlledProp<
                GridRootProps<TRow, TNode>,
                DataGridState<TRow, TNode>,
                unknown
            >,
        ),
    );
    const firstPieces = featurePieces.filter(
        (_, index) => featureSpecs[index]?.first === true,
    );
    // followed before the data props, in this order: the layout inputs, then the active position
    const layout: readonly Controlled[] = [
        widths,
        order,
        collapsed,
        ...firstPieces,
    ];
    // settled (and started) in this order: the layout inputs first, so a position the order or a
    // collapse moved settles in the same pass; the features' last (the selections, the sort)
    const controlled: readonly Controlled[] = [
        ...layout,
        expanded,
        groups,
        ...featurePieces.filter((piece) => !firstPieces.includes(piece)),
    ];
    // the core's data props, then the features' (a selection's mode, Epic #144)
    const data: readonly PropsGroup<TRow, TNode>[] = [
        ...dataGroups(model),
        ...featureFollowers<GridRootProps<TRow, TNode>>(
            installedFeatures,
            model as unknown as DataGridModel<unknown, unknown>,
        ),
    ];
    const options: PropsGroup<TRow, TNode> = {
        inputs: (props) => [
            props.overscan?.rows,
            props.overscan?.columns,
            props.maxScrollSize,
            props.endReachedThreshold,
            props.onRowMove !== undefined,
            props.ownTabStop,
            ...Object.values(featureEngineOptions(installedFeatures, props)),
        ],
        run: (props) =>
            engine.adapter.setOptions(engineOptions(installedFeatures, props)),
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
    let toldFeatures = false;
    return {
        model: model as unknown as DataGridModel<TRow, TNode, TFeatures>,
        engine,
        sync() {
            const current = props();
            // the features are the grid's from its creation: another list is not taken
            if (
                !toldFeatures &&
                current.features !== initial.features &&
                !sameFeatures(current.features ?? [], installed)
            ) {
                toldFeatures = true;
                console.warn(
                    "data grid: `features` changed after the grid was created; the grid keeps the features it was created with (remount it, with a new `key`, for others)",
                );
            }
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

/** Whether two feature lists are the same features, in the same order. */
function sameFeatures(a: DataGridFeatures, b: DataGridFeatures): boolean {
    return (
        a.length === b.length &&
        a.every((feature, index) => feature === b[index])
    );
}

/** The engine's options a root's props give. */
function engineOptions<TRow, TNode>(
    features: GridFeatures,
    props: GridRootProps<TRow, TNode>,
): DataGridEngineOptions {
    return {
        // the features' first (the fill handle's `fillable`, Epic #144)
        ...featureEngineOptions(features, props),
        overscan: {
            rows: props.overscan?.rows,
            columns: props.overscan?.columns,
        },
        maxScrollSize: props.maxScrollSize,
        endReachedThreshold: props.endReachedThreshold,
        // the rows move while the app takes their moves
        reorderableRows: props.onRowMove !== undefined,
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
