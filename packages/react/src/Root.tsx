import {
    type AxisWindow,
    type CellPosition,
    type ColumnOrder,
    type ColumnWidths,
    type CommandName,
    createDataGridEngine,
    createDataGridModel,
    type DataGridState,
    DEFAULT_DETAIL_HEIGHT,
    DEFAULT_HEADER_ROW_HEIGHT,
    DEFAULT_ROW_HEIGHT,
    type DetailHeight,
    type GridDirection,
    type GridView,
    keptOrder,
    keptWidths,
    type ResultOf,
    type RowKey,
    type RowKeyGetter,
    type RowSelectable,
    type RowSelection,
    type Size,
    type SortColumn,
    sameKeys,
    sameOrder,
    sameRowKeys,
    sameSortColumns,
    sameWidths,
    validSortColumns,
} from "@fragiola/data-grid";
import type * as React from "react";
import {
    type ReactNode,
    type RefObject,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import {
    type ColumnOrGroup,
    DataGridContext,
    type DataGridContextValue,
    HeaderRowContext,
    RowContext,
    ViewContext,
} from "./context";
import { attachGridRef, type DataGridRef } from "./gridRef";
import {
    bindControlled,
    type ControlledFlags,
    type ControlledState,
} from "./utils/controlled";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

/** The root's state: what its `className`/`style` functions and `render` receive. */
export type RootState = Record<string, never>;

/** What `selected-rows.toggle` returns: the keys, and the anchor it leaves. */
type ToggleResult = ResultOf<"selected-rows.toggle">;

/** Where the rows come from: all of them, or a count and a getter (D6). */
type RowsProps<TRow> =
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

export type RootProps<TRow> = DivPrimitiveProps<RootState> &
    RowsProps<TRow> & {
        /** the columns, and the groups above them (nested to any depth) */
        columns: readonly ColumnOrGroup<TRow>[];
        /** a row's key; without one, rows are keyed by their index */
        rowKey?: RowKeyGetter<TRow> | undefined;
        /** a row's height in pixels, or a function of its index (default 35) */
        rowHeight?: Size | undefined;
        /** a header row's height in pixels (default 35); 0 for no header */
        headerRowHeight?: number | undefined;
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
         * an expanded row's detail height in pixels, or a function of the row (default 300): it
         * adds to the row's own height
         */
        detailHeight?: DetailHeight<TRow> | undefined;
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
        onColumnWidthsChange?:
            | ((columnWidths: ColumnWidths) => void)
            | undefined;
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
         * a handle on this grid from outside the root (`useDataGridRef()`): its model and engine,
         * and the hooks that take it. `ref` stays the root's element.
         */
        gridRef?: DataGridRef<TRow> | undefined;
        children?: ReactNode;
    };

function samePosition(
    a: CellPosition | null | undefined,
    b: CellPosition | null | undefined,
): boolean {
    return (
        (a ?? null) === (b ?? null) ||
        (a?.rowIndex === b?.rowIndex && a?.columnIndex === b?.columnIndex)
    );
}

/**
 * A controlled state over the root's props (the active position, the sort, the expanded rows, the
 * selection, the column widths and order): its prop, its handler, its default.
 */
interface PropsState<TRow, V>
    extends Pick<
        ControlledState<TRow, V>,
        "prefix" | "read" | "same" | "apply" | "vetoed"
    > {
    readonly prop: (props: RootProps<TRow>) => V | undefined;
    readonly onChange: (
        props: RootProps<TRow>,
    ) => ((value: V) => void) | undefined;
    /** the value to start with, uncontrolled, when the grid may not take all of it */
    readonly start?: (props: RootProps<TRow>) => V | undefined;
    /** what a command makes it, from the command's value; without it, that value itself */
    readonly fromCommand?: (command: CommandName, value: unknown) => V;
}

/** The controlled state a root's latest props hold: its prop, its handler, its default. */
function propsState<TRow, V>(
    latest: RefObject<RootProps<TRow>>,
    spec: PropsState<TRow, V>,
): ControlledState<TRow, V> {
    const { start } = spec;
    return {
        // its `prefix`, `read`, `same`, `apply` and `vetoed` as given
        ...spec,
        valueOf: spec.fromCommand ?? ((_, value) => value as V),
        prop: () => spec.prop(latest.current),
        report: (value) => spec.onChange(latest.current)?.(value),
        start: start && (() => start(latest.current)),
    };
}

function sourceMatches<TRow>(
    state: DataGridState<TRow, ReactNode>,
    rows: readonly TRow[] | undefined,
    rowCount: number | undefined,
    getRow: ((index: number) => TRow | undefined) | undefined,
): boolean {
    const { source } = state;
    if (rows !== undefined) {
        return "rows" in source && source.rows === rows;
    }
    return (
        !("rows" in source) &&
        source.getRow === getRow &&
        source.rowCount === rowCount
    );
}

/**
 * The grid's root: the scroll container (a `div`, overflow auto; give it a size). It holds the
 * model and the engine, maps its props onto the model's commands (controlled or not), and runs
 * the grid's keys, clicks and presses after the consumer's own handlers, so `preventDefault`
 * cancels one.
 */
export function Root<TRow>(props: RootProps<TRow>) {
    const {
        columns,
        rows,
        rowCount,
        getRow,
        rowKey,
        rowHeight,
        headerRowHeight,
        activePosition,
        defaultActivePosition,
        onActivePositionChange,
        sortColumns,
        defaultSortColumns,
        onSortColumnsChange,
        expandedRowKeys,
        defaultExpandedRowKeys,
        onExpandedRowKeysChange,
        detailHeight,
        rowSelection,
        isRowSelectable,
        selectedRowKeys,
        defaultSelectedRowKeys,
        onSelectedRowKeysChange,
        columnWidths,
        defaultColumnWidths,
        onColumnWidthsChange,
        columnOrder,
        defaultColumnOrder,
        onColumnOrderChange,
        collapsedGroupKeys,
        defaultCollapsedGroupKeys,
        onCollapsedGroupKeysChange,
        onRowWindowChange,
        onColumnWindowChange,
        onRowsEndReached,
        endReachedThreshold,
        overscan,
        maxScrollSize,
        direction,
        gridRef,
        children,
        ...rest
    } = props;
    const latest = useRef(props);
    latest.current = props;

    const [grid] = useState(() => {
        const model = createDataGridModel<TRow, ReactNode>({
            columns,
            ...(rows !== undefined
                ? { rows }
                : { rowCount: rowCount ?? 0, getRow }),
            rowKey,
            rowHeight,
            headerRowHeight,
            activePosition:
                activePosition !== undefined
                    ? activePosition
                    : defaultActivePosition,
            sortColumns: sortColumns ?? defaultSortColumns,
            expandedRowKeys: expandedRowKeys ?? defaultExpandedRowKeys,
            detailHeight,
            rowSelection,
            isRowSelectable,
            selectedRowKeys: selectedRowKeys ?? defaultSelectedRowKeys,
            columnWidths: columnWidths ?? defaultColumnWidths,
            columnOrder: columnOrder ?? defaultColumnOrder,
            collapsedGroupKeys: collapsedGroupKeys ?? defaultCollapsedGroupKeys,
            direction,
        });
        const flags: ControlledFlags = {
            syncing: { current: false },
            applying: { current: false },
        };
        // each piece guarded on its own commands (the order they are bound in tells uncontrolled
        // changes in that order)
        const bind = <V,>(spec: ControlledState<TRow, V>) =>
            bindControlled(model, flags, spec);
        const position = bind(
            propsState<TRow, CellPosition | null>(latest, {
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
            }),
        );
        const sort = bind(
            propsState<TRow, readonly SortColumn[]>(latest, {
                prefix: "sort-columns.",
                prop: (props) => props.sortColumns,
                onChange: (props) => props.onSortColumnsChange,
                // an uncontrolled sort the columns could not take all of (a column not
                // sortable) starts without it: the app is told the sort the grid holds
                start: (props) => props.defaultSortColumns,
                read: (state) => state.sortColumns,
                same: sameSortColumns,
                // what the columns cannot take (a column not sortable, twice) is left out, as at
                // mount, and the parent is told the sort as it settled
                apply: (value) => {
                    model.run("sort-columns.set", {
                        sortColumns: validSortColumns(
                            model.state.columnEntries,
                            value,
                        ),
                    });
                },
            }),
        );
        const expanded = bind(
            propsState<TRow, readonly RowKey[]>(latest, {
                prefix: "expanded-rows.",
                prop: (props) => props.expandedRowKeys,
                onChange: (props) => props.onExpandedRowKeysChange,
                read: (state) => state.expandedRowKeys,
                same: sameRowKeys,
                apply: (rowKeys) => {
                    model.run("expanded-rows.set", { rowKeys });
                },
            }),
        );
        const selection = bind(
            propsState<TRow, readonly RowKey[]>(latest, {
                prefix: "selected-rows.",
                // the keys follow the prop while rows are selectable; off, the model keeps the
                // keys it had (no row shows them) and the prop waits until it is on again
                prop: (props) =>
                    props.rowSelection ? props.selectedRowKeys : undefined,
                onChange: (props) => props.onSelectedRowKeysChange,
                // an uncontrolled selection to start with that single mode trimmed (its last key
                // kept): the app is told the keys the grid holds
                start: (props) =>
                    props.rowSelection
                        ? props.defaultSelectedRowKeys
                        : undefined,
                read: (state) => state.selectedRowKeys,
                same: sameRowKeys,
                fromCommand: (command, value) =>
                    command === "selected-rows.toggle"
                        ? (value as ToggleResult).rowKeys
                        : (value as readonly RowKey[]),
                apply: (rowKeys) => {
                    model.run("selected-rows.set", { rowKeys });
                },
                // the parent answers the keys; where a range starts is the grid's: a toggle's
                // anchor is kept as the model would have left it
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
            }),
        );
        const widths = bind(
            propsState<TRow, ColumnWidths>(latest, {
                prefix: "column-widths.",
                prop: (props) => props.columnWidths,
                onChange: (props) => props.onColumnWidthsChange,
                // uncontrolled widths to start with that were not all widths start without
                // those: the app is told the ones the grid holds
                start: (props) => props.defaultColumnWidths,
                read: (state) => state.columnWidths,
                same: sameWidths,
                // an entry that is not a width is left out, as at mount, and the parent is told
                // the widths as they settled
                apply: (columnWidths) => {
                    model.run("column-widths.set", {
                        columnWidths: keptWidths(columnWidths),
                    });
                },
            }),
        );
        const order = bind(
            propsState<TRow, ColumnOrder>(latest, {
                prefix: "column-order.",
                prop: (props) => props.columnOrder,
                onChange: (props) => props.onColumnOrderChange,
                // an uncontrolled order to start with that listed a key twice (or a value that is
                // no key) starts without those: the app is told the order the grid holds
                start: (props) => props.defaultColumnOrder,
                read: (state) => state.columnOrder,
                same: sameOrder,
                // kept as at mount, and the parent told the order as it settled
                apply: (columnOrder) => {
                    model.run("column-order.set", {
                        columnOrder: keptOrder(columnOrder),
                    });
                },
            }),
        );
        const collapsed = bind(
            propsState<TRow, readonly string[]>(latest, {
                prefix: "column-groups.",
                prop: (props) => props.collapsedGroupKeys,
                onChange: (props) => props.onCollapsedGroupKeysChange,
                // keys to start with that were not all strings (or listed one twice) start
                // without those: the app is told the keys the grid holds
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
            }),
        );
        const engine = createDataGridEngine<TRow, ReactNode>(model, {
            overscan,
            maxScrollSize,
            endReachedThreshold,
        });
        // subscribed before the viewport attaches, so the first windows are reported too
        engine.subscribe("row-window", (window) =>
            latest.current.onRowWindowChange?.(window),
        );
        engine.subscribe("column-window", (window) =>
            latest.current.onColumnWindowChange?.(window),
        );
        engine.subscribe("rows-end-reached", (info) =>
            latest.current.onRowsEndReached?.(info),
        );
        const context: DataGridContextValue<TRow> = { model, engine };
        // the grid's keys, header clicks (sorting) and presses on a resizer (a drag) run after the
        // consumer's onKeyDown, onClick and onPointerDown, on the root or on its render element,
        // so preventDefault cancels them
        const after = {
            onKeyDown: (event: React.KeyboardEvent) =>
                engine.adapter.keydown(event.nativeEvent),
            onClick: (event: React.MouseEvent) =>
                engine.adapter.click(event.nativeEvent),
            onPointerDown: (event: React.PointerEvent) =>
                engine.adapter.pointerdown(event.nativeEvent),
        };
        return {
            context,
            flags,
            position,
            sort,
            selection,
            widths,
            order,
            collapsed,
            // settled (and started) in this order: the layout inputs first, so a position the order
            // or a collapse moved settles in the same pass; then the selection before the sort, as
            // their values to start with are told
            controlled: [
                widths,
                order,
                collapsed,
                position,
                selection,
                sort,
                expanded,
            ],
            after,
        };
    });
    const { context, flags } = grid;
    const { model, engine } = context;
    // before paint; the components that follow the ref (useRowWindow(gridRef), …) are told
    useLayoutEffect(
        () => (gridRef ? attachGridRef(gridRef, context) : undefined),
        [gridRef, context],
    );
    const view = useSyncExternalStore(
        engine.adapter.subscribe,
        engine.adapter.getView,
        engine.adapter.getView,
    );
    const [, rerender] = useState(0);
    useLayoutEffect(() => {
        // the viewport attaches after the parts' first layout effects (refs attach child first)
        // and its size makes a new view: render it before the first paint, not after
        if (engine.adapter.getView() !== view) rerender((count) => count + 1);
        // the props follow onto the model, before paint. Controlled widths, order and collapsed
        // groups first: layout inputs, the axis a position scrolls into view against (an order or
        // a collapse moves the active cell with its column: there it stays unless its own prop
        // changed, told at the settle). Then a controlled position: valid before the data changes
        // (rows filtered down), it survives them
        grid.widths.follow();
        grid.order.follow();
        grid.collapsed.follow();
        grid.position.follow();
        flags.applying.current = true;
    });

    useLayoutEffect(() => {
        if (columns !== model.state.columnEntries) {
            model.run("columns.set", { columns });
        }
    }, [model, columns]);

    useLayoutEffect(() => {
        if (
            sourceMatches(model.state, rows, rowCount, getRow) &&
            rowKey === model.state.rowKey
        ) {
            return;
        }
        model.run(
            "data.set",
            rows !== undefined
                ? { rows, rowKey }
                : {
                      rowCount: rowCount ?? 0,
                      getRow: getRow ?? (() => undefined),
                      rowKey,
                  },
        );
    }, [model, rows, rowCount, getRow, rowKey]);

    useLayoutEffect(() => {
        const { state } = model;
        // a prop removed goes back to the default
        const rows = rowHeight ?? DEFAULT_ROW_HEIGHT;
        const header = headerRowHeight ?? DEFAULT_HEADER_ROW_HEIGHT;
        const detail = detailHeight ?? DEFAULT_DETAIL_HEIGHT;
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
    }, [model, rowHeight, headerRowHeight, detailHeight]);

    useLayoutEffect(() => {
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
    }, [model, rowSelection, isRowSelectable]);

    useLayoutEffect(() => {
        // a prop removed goes back to the page's direction (the engine reads the viewport's)
        if (direction !== model.state.direction) {
            model.run("direction.set", { direction: direction ?? null });
        }
    }, [model, direction]);

    // and last: a controlled position valid only after the data changed (rows grown) follows now;
    // one the data made impossible was clamped by the model, and the parent is told where. A
    // controlled sort follows the columns, and one they cannot take is told as it settled
    useLayoutEffect(() => {
        flags.applying.current = false;
        for (const piece of grid.controlled) piece.settle();
    });

    // uncontrolled, a value to start with the grid could not take as given (the selection single
    // mode trimmed, the sort the columns could not take all of, widths that were not all
    // widths, an order listing a key twice): the app is told the one it holds
    useLayoutEffect(() => {
        for (const piece of grid.controlled) piece.start();
    }, [grid]);

    const overscanRows = overscan?.rows;
    const overscanColumns = overscan?.columns;
    useLayoutEffect(() => {
        engine.adapter.setOptions({
            overscan: { rows: overscanRows, columns: overscanColumns },
            maxScrollSize,
            endReachedThreshold,
        });
    }, [
        engine,
        overscanRows,
        overscanColumns,
        maxScrollSize,
        endReachedThreshold,
    ]);

    const ref = useCallback(
        (element: HTMLElement | null) =>
            element ? engine.adapter.attach(element) : undefined,
        [engine],
    );

    const element = useRenderElement("div", rest, {
        state: {},
        ref,
        after: grid.after,
        children,
        props: {
            ...dataAttributes({
                "grid-part": "root",
                empty: view.rowCount === 0,
            }),
            // a scroll container is a tab stop in some browsers: the grid has its own
            tabIndex: -1,
            // the direction given (the prop, `direction.set`): rendered, never the engine's
            ...(view.givenDirection ? { dir: view.givenDirection } : {}),
            style: { position: "relative", overflow: "auto" },
        },
    });

    return (
        <DataGridContext value={context as unknown as DataGridContextValue}>
            <ViewContext
                value={view as unknown as GridView<unknown, ReactNode>}
            >
                {/* a grid nested in a cell of another one is not inside the outer one's rows */}
                <RowContext value={null}>
                    <HeaderRowContext value={null}>{element}</HeaderRowContext>
                </RowContext>
            </ViewContext>
        </DataGridContext>
    );
}
