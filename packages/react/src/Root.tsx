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
    veto,
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
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

interface KeyDownProps {
    onKeyDown?:
        | ((event: React.KeyboardEvent<HTMLDivElement>) => void)
        | undefined;
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
        onRowWindowChange,
        onColumnWindowChange,
        onRowsEndReached,
        endReachedThreshold,
        overscan,
        maxScrollSize,
        gridRef,
        children,
        onKeyDown,
        ...rest
    } = props;
    const latest = useRef(props);
    latest.current = props;
    /** a command the root runs to follow a controlled prop: the controlled guard lets it through */
    const syncing = useRef(false);
    /** the root is applying the data props: a controlled position they clamp is settled after */
    const applying = useRef(false);

    const [context] = useState<DataGridContextValue<TRow>>(() => {
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
        });
        // controlled: a change is asked for (onActivePositionChange) and applied only when the
        // prop follows
        model.use((ctx, next) => {
            if (!ctx.command.startsWith("active-position.")) return next();
            const result = next();
            if (
                ctx.dryRun ||
                syncing.current ||
                latest.current.activePosition === undefined ||
                !result.ok
            ) {
                return result;
            }
            const position =
                ctx.command === "active-position.clear"
                    ? null
                    : (result.value as CellPosition);
            if (!samePosition(position, model.state.activePosition)) {
                latest.current.onActivePositionChange?.(position);
            }
            return veto("the active position is controlled");
        });
        // a change the guard let through: uncontrolled, or the grid's shape moved it (rows
        // removed); the root's own syncs to a controlled prop are not reported back
        model.subscribe(({ before, after }) => {
            if (
                syncing.current ||
                before.activePosition === after.activePosition ||
                // controlled: decided once every prop is applied (the last effect below)
                (applying.current &&
                    latest.current.activePosition !== undefined)
            ) {
                return;
            }
            latest.current.onActivePositionChange?.(after.activePosition);
        });
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
        return { model, engine };
    });
    const { model, engine } = context;
    // before paint and before the components around it run their effects: they see the grid
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

    /** Moves the model to the controlled position, when it is not there. */
    const followControlled = (position: CellPosition | null | undefined) => {
        if (
            position === undefined ||
            samePosition(position, model.state.activePosition)
        ) {
            return;
        }
        syncing.current = true;
        try {
            if (position === null) model.run("active-position.clear");
            else model.run("active-position.set", position);
        } finally {
            syncing.current = false;
        }
    };

    // the props follow onto the model, before paint. A controlled position first: valid before
    // the data changes (rows filtered down), it survives them
    useLayoutEffect(() => followControlled(activePosition));

    useLayoutEffect(() => {
        applying.current = true;
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
    // one the data made impossible was clamped by the model, and the parent is told where
    useLayoutEffect(() => {
        applying.current = false;
        followControlled(activePosition);
        const settled = model.state.activePosition;
        if (
            activePosition !== undefined &&
            !samePosition(activePosition, settled)
        ) {
            latest.current.onActivePositionChange?.(settled);
        }
    });

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

    // the consumer's onKeyDown, on the root or on its render element, runs before the grid's keys
    const { render } = rest;
    const renderElement = isValidElement<KeyDownProps>(render)
        ? render
        : undefined;
    const renderKeyDown = renderElement?.props.onKeyDown;
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        renderKeyDown?.(event);
        engine.adapter.keydown(event.nativeEvent);
    };

    const element = useRenderElement(
        "div",
        renderElement && renderKeyDown
            ? {
                  ...rest,
                  render: cloneElement(renderElement, { onKeyDown: undefined }),
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
