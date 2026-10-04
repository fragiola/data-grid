import {
    ariaRowCount,
    ariaRowIndex,
    type DataGridEngine,
    type EngineLayer,
} from "@fragiola/data-grid";
import type * as React from "react";
import {
    Fragment,
    isValidElement,
    type ReactNode,
    useLayoutEffect,
} from "react";
import {
    type CellInfo,
    type HeaderCellInfo,
    HeaderRowContext,
    type HeaderRowInfo,
    RowContext,
    type RowInfo,
    useRootGrid,
    useRowContext,
} from "./context";
import {
    type CellState,
    type HeaderCellState,
    headerCellContent,
    type RowDetailState,
    type RowState,
    rowStyle,
    useCell,
    useCells,
    useGridView,
    useHeaderCell,
    useHeaderCells,
    useHeaderRowOf,
    useHeaderRows,
    useRow,
    useRowDetail,
    useRows,
} from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export { Root, type RootProps, type RootState } from "./Root";

type LayerRef = React.RefCallback<HTMLElement>;

/** Each engine's layer refs, made once: a part's ref keeps its identity across renders. */
const layerRefs = new WeakMap<object, Map<EngineLayer, LayerRef>>();

/** A ref that registers an element as one of the layers an engine writes. */
function layerRef(
    engine: DataGridEngine<unknown, ReactNode>,
    layer: EngineLayer,
): LayerRef {
    let refs = layerRefs.get(engine);
    if (!refs) {
        refs = new Map();
        layerRefs.set(engine, refs);
    }
    let ref = refs.get(layer);
    if (!ref) {
        ref = (element) =>
            element ? engine.adapter.registerLayer(layer, element) : undefined;
        refs.set(layer, ref);
    }
    return ref;
}

/** A ref that registers an element as one of the layers the engine of the `Root` around writes. */
function useLayer(layer: EngineLayer): LayerRef {
    return layerRef(useRootGrid().engine, layer);
}

/** The layers' `transform` is the engine's: a consumer's would move the rows. */
const LAYER_KEYS = ["transform"] as const;

/**
 * A pinned cell's `left` inset is the engine's, and the other insets and a `transform` would let it
 * move from its place (`position: sticky` obeys every inset it is given).
 */
const PINNED_KEYS = [
    "transform",
    "left",
    "right",
    "top",
    "bottom",
    "inset",
    "insetInline",
    "insetInlineStart",
    "insetInlineEnd",
    "insetBlock",
    "insetBlockStart",
    "insetBlockEnd",
] as const;

/**
 * A cell's props with its table spans: a `render` element that is a `th` or a `td` takes `colSpan`
 * and `rowSpan`, each only over 1 (a render function finds them in the state). The same props
 * without.
 */
function withTableSpans(
    props: Record<string, unknown>,
    render: unknown,
    colSpan: number,
    rowSpan = 1,
): Record<string, unknown> {
    if (
        (colSpan <= 1 && rowSpan <= 1) ||
        !isValidElement(render) ||
        (render.type !== "th" && render.type !== "td")
    ) {
        return props;
    }
    return {
        ...props,
        ...(colSpan > 1 ? { colSpan } : {}),
        ...(rowSpan > 1 ? { rowSpan } : {}),
    };
}

// ── the grid ─────────────────────────────────────────────────────────────────

/** The grid's state. */
export interface GridState {
    readonly rowCount: number;
    readonly columnCount: number;
}

export type GridProps = DivPrimitiveProps<GridState> & { children?: ReactNode };

/**
 * The grid (`role="grid"`) and the sizer: as large as the whole dataset (the physical size, under
 * scroll scaling), so the scrollbars represent it. A `<table>` through `render`. It is the grid's
 * tab stop while no cell is active.
 */
export function Grid(props: GridProps) {
    const { children, ...rest } = props;
    const { engine } = useRootGrid();
    const view = useGridView();
    // the view is on screen: the engine writes the layers' offsets for it and moves focus
    useLayoutEffect(() => {
        engine.adapter.commit(view);
    }, [engine, view]);
    const empty = view.rowCount === 0;
    // without rows, and with expanded rows (a detail is as wide as the view), the sizer spans at
    // least the visible area: it clips what it holds
    const wide = empty || view.expandedRows.length > 0;
    return useRenderElement("div", rest, {
        state: { rowCount: view.rowCount, columnCount: view.columnCount },
        ref: layerRef(engine, "grid"),
        children,
        props: {
            role: "grid",
            "aria-rowcount": ariaRowCount(view),
            "aria-colcount": view.columnCount,
            // many rows selectable (R7)
            ...(view.rowSelection === "multiple"
                ? { "aria-multiselectable": true }
                : {}),
            // the grid's tab stop until a cell is active (roving: then that cell is)
            tabIndex: view.active ? -1 : 0,
            ...dataAttributes({ "grid-part": "grid", empty }),
            style: {
                position: "relative",
                display: "block",
                // without rows, the sizer still spans the visible area: the empty state has room
                width: wide
                    ? Math.max(view.width, view.viewportWidth)
                    : view.width,
                height:
                    view.headerHeight +
                    (empty
                        ? Math.max(view.height, view.viewportBodyHeight)
                        : view.height),
                // clips the rendered rows to the sizer without being a scroll container (sticky
                // headers stick to the viewport)
                overflow: "clip",
                boxSizing: "border-box",
            },
        },
    });
}

// ── the header ───────────────────────────────────────────────────────────────

export type HeaderProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/**
 * The header (`role="rowgroup"`): sticky at the viewport's top, as tall as its header rows. A
 * `<thead>` through `render`. Nothing renders without a header. Stacking is the consumer's: give
 * it a background and a `z-index` so rows scroll under it. Without children, a header row per
 * level (`DataGrid.HeaderRows`).
 */
export function Header(props: HeaderProps) {
    const { children = <HeaderRows />, ...rest } = props;
    const view = useGridView();
    const element = useRenderElement("div", rest, {
        state: {},
        children,
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "header" }),
            style: {
                position: "sticky",
                top: 0,
                display: "block",
                height: view.headerHeight,
                boxSizing: "border-box",
            },
        },
    });
    return view.headerRowCount > 0 ? element : null;
}

export interface HeaderRowsProps<TRow> {
    /** renders a header row; without it, `<DataGrid.HeaderRow row={row} />` */
    children?: (row: HeaderRowInfo<TRow>) => ReactNode;
}

/**
 * The header rows, the top one first: one without column groups, one per level with them (the
 * columns' row last).
 */
export function HeaderRows<TRow = unknown>({
    children,
}: HeaderRowsProps<TRow>) {
    const rows = useHeaderRows<TRow>();
    return rows.map((row) => (
        <HeaderRowContext key={row.rowIndex} value={row as HeaderRowInfo}>
            {children ? children(row) : <HeaderRow row={row} />}
        </HeaderRowContext>
    ));
}

/** The state of a header row. */
export interface HeaderRowState {
    /** -1 for the columns' row, above it for groups */
    readonly rowIndex: number;
}

export type HeaderRowProps<TRow = unknown> =
    DivPrimitiveProps<HeaderRowState> & {
        /**
         * its header row; without it, the one `HeaderRows` renders, else the columns' row (with
         * column groups, render the rows through `HeaderRows`: a column spanning header rows is
         * in the top one)
         */
        row?: HeaderRowInfo<TRow> | undefined;
        children?: ReactNode;
    };

/**
 * A header row (`role="row"`), one of the layers the engine moves with the columns. A `<tr>`.
 * Without children, its header cells.
 */
export function HeaderRow<TRow = unknown>(props: HeaderRowProps<TRow>) {
    const { row: given, children = <HeaderCells />, ...rest } = props;
    const view = useGridView<TRow>();
    const row = useHeaderRowOf(given);
    const rowIndex = row?.rowIndex ?? -1;
    return useRenderElement("div", rest, {
        state: { rowIndex },
        ref: useLayer("header"),
        drop: LAYER_KEYS,
        children: (
            <HeaderRowContext
                value={(row as HeaderRowInfo | undefined) ?? null}
            >
                {children}
            </HeaderRowContext>
        ),
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, rowIndex),
            ...dataAttributes({ "grid-part": "header-row" }),
            style: {
                ...rowStyle(
                    view,
                    (rowIndex + view.headerRowCount) * view.headerRowHeight,
                    view.headerRowHeight,
                ),
                // with several rows, an upper one stays above the next: a cell spanning down
                // from it is not covered by the row it reaches into
                ...(view.headerRowCount > 1 ? { zIndex: -rowIndex } : {}),
            },
        },
    });
}

export interface HeaderCellsProps<TRow> {
    /** renders a header cell; without it, `<DataGrid.HeaderCell cell={cell} />` */
    children?: (cell: HeaderCellInfo<TRow>) => ReactNode;
}

/**
 * A header row's cells: groups and columns intersecting the column window (a group cut by it
 * included), plus the one holding the active column.
 */
export function HeaderCells<TRow = unknown>({
    children,
}: HeaderCellsProps<TRow>) {
    const cells = useHeaderCells<TRow>();
    return cells.map((cell) => (
        <Fragment key={cell.key}>
            {children ? children(cell) : <HeaderCell cell={cell} />}
        </Fragment>
    ));
}

export type HeaderCellProps<TRow> = DivPrimitiveProps<HeaderCellState> & {
    cell: HeaderCellInfo<TRow>;
    /** without children: the group's or the column's `renderHeaderCell`, else its `name` */
    children?: ReactNode;
};

/**
 * A header cell (`role="columnheader"`), a group's or a column's. A `<th>` through `render`, which
 * then gets `colSpan`/`rowSpan` too (a render function finds them in the state).
 */
export function HeaderCell<TRow>(props: HeaderCellProps<TRow>) {
    const { cell, children, ...rest } = props;
    const own = useHeaderCell(cell);
    const { engine } = useRootGrid();
    return useRenderElement("div", rest, {
        state: own.state,
        props: withTableSpans(
            own.props,
            rest.render,
            cell.columnSpan,
            cell.rowSpan,
        ),
        children: children !== undefined ? children : headerCellContent(cell),
        // a pinned cell's inset is the engine's (sticky, it stays in view sideways)
        ref: own.state.pinned ? layerRef(engine, "pinned") : undefined,
        drop: own.state.pinned ? PINNED_KEYS : undefined,
    });
}

// ── the empty state ──────────────────────────────────────────────────────────

export type EmptyProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/**
 * What the grid shows while it has no rows: its children, in the body area (below the header, as
 * large as the visible body), staying in view when the grid scrolls sideways. Nothing renders
 * while there are rows. It has no text of its own. Place it after the `Header`: it sits in the flow
 * below it. As a table, render it as a `<tbody>` holding a row and a cell.
 */
export function Empty(props: EmptyProps) {
    const { children, ...rest } = props;
    const view = useGridView();
    const element = useRenderElement("div", rest, {
        state: {},
        children,
        props: {
            ...dataAttributes({ "grid-part": "empty" }),
            style: {
                position: "sticky",
                left: 0,
                display: "block",
                width: view.viewportWidth,
                height: view.viewportBodyHeight,
                boxSizing: "border-box",
            },
        },
    });
    return view.rowCount === 0 ? element : null;
}

// ── the body ─────────────────────────────────────────────────────────────────

export type BodyProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/** The body (`role="rowgroup"`), the layer the engine moves with the rows. A `<tbody>`. */
export function Body(props: BodyProps) {
    const { children = <Rows />, ...rest } = props;
    const view = useGridView();
    return useRenderElement("div", rest, {
        state: {},
        ref: useLayer("body"),
        drop: LAYER_KEYS,
        children,
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "body" }),
            style: {
                position: "absolute",
                top: view.headerHeight,
                left: 0,
                boxSizing: "border-box",
            },
        },
    });
}

export interface RowsProps<TRow> {
    /** renders a row; without it, `<DataGrid.Row row={row} />` */
    children?: (row: RowInfo<TRow>) => ReactNode;
}

/** The rendered rows (the row window, plus the active row), in order. */
export function Rows<TRow = unknown>({ children }: RowsProps<TRow>) {
    const rows = useRows<TRow>();
    const keyed = useGridView().rowKey !== undefined;
    return rows.map((row) => (
        // keyed by the app's keys when it gives some (a row not loaded yet has none: its index),
        // else by index, so a row loading in place keeps its elements (and focus); the prefixes
        // keep a key and an index apart
        <Fragment
            key={keyed && row.loaded ? `k${row.key}` : `i${row.rowIndex}`}
        >
            {children ? children(row) : <Row row={row} />}
        </Fragment>
    ));
}

export type RowProps<TRow> = DivPrimitiveProps<RowState> & {
    row: RowInfo<TRow>;
    /** without children, `<DataGrid.Cells />` */
    children?: ReactNode;
};

/**
 * A body row (`role="row"`), positioned in the body layer. A `<tr>`. `data-loading` while its
 * row is not loaded, `data-active` while it holds the active cell.
 */
export function Row<TRow>(props: RowProps<TRow>) {
    const { row, children = <Cells />, ...rest } = props;
    const element = useRenderElement("div", rest, { ...useRow(row), children });
    return <RowContext value={row as RowInfo}>{element}</RowContext>;
}

export interface CellsProps<TRow> {
    /** renders a cell; without it, `<DataGrid.Cell cell={cell} />` */
    children?: (cell: CellInfo<TRow>) => ReactNode;
}

/** The cells of the row it is in, for the rendered columns. */
export function Cells<TRow = unknown>({ children }: CellsProps<TRow>) {
    const row = useRowContext<TRow>("Cells");
    const cells = useCells(row);
    return cells.map((cell) => (
        <Fragment key={cell.column.key}>
            {children ? children(cell) : <Cell cell={cell} />}
        </Fragment>
    ));
}

/** A value rendered as text when the cell has no children and its column no `renderCell`. */
function plain(value: unknown): ReactNode {
    const type = typeof value;
    return type === "string" ||
        type === "number" ||
        type === "bigint" ||
        type === "boolean"
        ? String(value)
        : null;
}

export type CellProps<TRow> = DivPrimitiveProps<CellState> & {
    cell: CellInfo<TRow>;
    /**
     * without children: the column's `renderCell` for a loaded row, else its value as text (a
     * string, number or boolean); nothing while the row is not loaded
     */
    children?: ReactNode;
};

/**
 * A body cell (`role="gridcell"`), positioned in its row. A `<td>` through `render`. The active
 * cell is the grid's tab stop (`tabIndex` 0, `data-active`); the others take focus on click.
 */
export function Cell<TRow>(props: CellProps<TRow>) {
    const { cell, children, ...rest } = props;
    const own = useCell(cell);
    const { engine } = useRootGrid();
    let content: ReactNode = null;
    if (children !== undefined) {
        content = children;
    } else if (cell.loaded && cell.row !== undefined) {
        content = cell.column.renderCell
            ? cell.column.renderCell({
                  row: cell.row,
                  rowIndex: cell.rowIndex,
                  column: cell.column,
                  columnIndex: cell.columnIndex,
                  value: cell.value,
              })
            : plain(cell.value);
    }
    return useRenderElement("div", rest, {
        ...own,
        children: content,
        // a pinned cell's inset is the engine's (sticky, it stays in view sideways)
        ref: own.state.pinned ? layerRef(engine, "pinned") : undefined,
        drop: own.state.pinned ? PINNED_KEYS : undefined,
    });
}

export type RowDetailProps = DivPrimitiveProps<RowDetailState> & {
    /** what the detail holds: another grid, a summary, controls (the app's own content) */
    children?: ReactNode;
};

/**
 * An expanded row's detail (M3): inside its `Row`, after its cells, below the row's own height;
 * as wide as the visible area and in view while the grid scrolls sideways (sticky, the engine
 * writes its `left`). It renders only while its row is expanded (`expanded-rows.toggle`, the
 * row's `data-expanded`), and holds only its children: no text and no names. One cell of its row
 * spanning every column (`role="gridcell"`). Its keys and focus are its content's, never the
 * grid's: a grid inside it is its own grid. A `<td>` through `render`, which then gets `colSpan`.
 */
export function RowDetail(props: RowDetailProps) {
    const { children, ...rest } = props;
    const own = useRowDetail(useRowContext("RowDetail"));
    const { columnCount } = useGridView();
    const element = useRenderElement("div", rest, {
        state: own.state,
        props: withTableSpans(own.props, rest.render, columnCount),
        children,
        ref: useLayer("detail"),
        // its inset is the engine's, and the other insets would move it from its place
        drop: PINNED_KEYS,
    });
    return own.state.expanded ? element : null;
}
