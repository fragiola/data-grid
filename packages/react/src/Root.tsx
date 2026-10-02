import {
    type AxisWindow,
    type CellPosition,
    createDataGridEngine,
    createDataGridModel,
    type DataGridState,
    DEFAULT_HEADER_ROW_HEIGHT,
    DEFAULT_ROW_HEIGHT,
    type GridView,
    type RowKeyGetter,
    type Size,
    type SortColumn,
    sameSortColumns,
    validSortColumns,
} from "@fragiola/data-grid";
import type * as React from "react";
import {
    cloneElement,
    isValidElement,
    type ReactNode,
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
    followControlled,
    settleControlled,
} from "./utils/controlled";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

interface HandlerProps {
    onKeyDown?:
        | ((event: React.KeyboardEvent<HTMLDivElement>) => void)
        | undefined;
    onClick?: ((event: React.MouseEvent<HTMLDivElement>) => void) | undefined;
}

/** The root's state: what its `className`/`style` functions and `render` receive. */
export type RootState = Record<string, never>;

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
 * the grid's keys after the consumer's own `onKeyDown`, so `preventDefault` cancels one.
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
        onRowWindowChange,
        onColumnWindowChange,
        onRowsEndReached,
        endReachedThreshold,
        overscan,
        maxScrollSize,
        gridRef,
        children,
        onKeyDown,
        onClick,
        ...rest
    } = props;
    const latest = useRef(props);
    latest.current = props;
    const flags: ControlledFlags = {
        syncing: useRef(false),
        applying: useRef(false),
    };

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
        });
        const position: ControlledState<TRow, CellPosition | null> = {
            prefix: "active-position.",
            prop: () => latest.current.activePosition,
            read: (state) => state.activePosition,
            same: samePosition,
            valueOf: (command, value) =>
                command === "active-position.clear"
                    ? null
                    : (value as CellPosition),
            report: (value) => latest.current.onActivePositionChange?.(value),
            apply: (value) => {
                if (value === null) model.run("active-position.clear");
                else model.run("active-position.set", value);
            },
        };
        const sort: ControlledState<TRow, readonly SortColumn[]> = {
            prefix: "sort-columns.",
            prop: () => latest.current.sortColumns,
            read: (state) => state.sortColumns,
            same: sameSortColumns,
            valueOf: (_, value) => value as readonly SortColumn[],
            report: (value) => latest.current.onSortColumnsChange?.(value),
            // what the columns cannot take (a column not sortable, twice) is left out, as at
            // mount, and the parent is told the sort as it settled
            apply: (value) => {
                model.run("sort-columns.set", {
                    sortColumns: validSortColumns(model.state.columns, value),
                });
            },
        };
        bindControlled(model, flags, position);
        bindControlled(model, flags, sort);
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
        return { context, position, sort };
    });
    const { context } = grid;
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
    // the viewport attaches after the parts' first layout effects (refs attach child first) and
    // its size makes a new view: render it before the first paint, not after
    useLayoutEffect(() => {
        if (engine.adapter.getView() !== view) rerender((count) => count + 1);
    });

    // the props follow onto the model, before paint. A controlled position first: valid before
    // the data changes (rows filtered down), it survives them
    useLayoutEffect(() => followControlled(model, flags, grid.position));

    useLayoutEffect(() => {
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
        if (rows !== state.rowHeight || header !== state.headerRowHeight) {
            model.run("sizes.set", {
                rowHeight: rows,
                headerRowHeight: header,
            });
        }
    }, [model, rowHeight, headerRowHeight]);

    // and last: a controlled position valid only after the data changed (rows grown) follows now;
    // one the data made impossible was clamped by the model, and the parent is told where. A
    // controlled sort follows the columns, and one they cannot take is told as it settled
    useLayoutEffect(() => {
        flags.applying.current = false;
        settleControlled(model, flags, grid.position);
        settleControlled(model, flags, grid.sort);
    });

    // an uncontrolled sort to start with that the columns could not take all of (a column not
    // sortable) started without it: the app is told the sort the grid holds
    useLayoutEffect(() => {
        const start = latest.current.defaultSortColumns;
        if (
            latest.current.sortColumns === undefined &&
            start !== undefined &&
            !sameSortColumns(start, model.state.sortColumns)
        ) {
            latest.current.onSortColumnsChange?.(model.state.sortColumns);
        }
    }, [model]);

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

    // the consumer's onKeyDown and onClick, on the root or on its render element, run before the
    // grid's keys and header clicks (sorting), so preventDefault cancels them
    const { render } = rest;
    const renderElement = isValidElement<HandlerProps>(render)
        ? render
        : undefined;
    const renderKeyDown = renderElement?.props.onKeyDown;
    const renderClick = renderElement?.props.onClick;
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        renderKeyDown?.(event);
        engine.adapter.keydown(event.nativeEvent);
    };
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(event);
        renderClick?.(event);
        engine.adapter.click(event.nativeEvent);
    };

    const element = useRenderElement(
        "div",
        renderElement && (renderKeyDown || renderClick)
            ? {
                  ...rest,
                  render: cloneElement(renderElement, {
                      onKeyDown: undefined,
                      onClick: undefined,
                  }),
              }
            : rest,
        {
            state: {},
            ref,
            props: {
                ...dataAttributes({
                    "grid-part": "root",
                    empty: view.rowCount === 0,
                }),
                // a scroll container is a tab stop in some browsers: the grid has its own
                tabIndex: -1,
                onKeyDown: handleKeyDown,
                onClick: handleClick,
                children,
            },
            style: { position: "relative", overflow: "auto" },
        },
    );

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
