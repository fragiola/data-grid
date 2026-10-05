import {
    ariaRowCount,
    ariaRowIndex,
    type EngineLayer,
    type SummaryPosition,
    summaryHeight,
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
    type SummaryCellInfo,
    SummaryContext,
    SummaryRowContext,
    type SummaryRowInfo,
    useRootGrid,
    useRowContext,
} from "./context";
import {
    type CellState,
    type HeaderCellState,
    headerCellContent,
    inlineSide,
    type RowDetailState,
    type RowState,
    rowStyle,
    type SummaryCellState,
    type SummaryRowState,
    useCellPart,
    useCells,
    useGridView,
    useHeaderCell,
    useHeaderCells,
    useHeaderRowOf,
    useHeaderRows,
    useRow,
    useRowDetail,
    useRows,
    useSummaryCellPart,
    useSummaryCells,
    useSummaryRow,
    useSummaryRows,
} from "./hooks";
import { layerRef } from "./utils/layerRef";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export { Root, type RootProps, type RootState } from "./Root";

/** A ref that registers an element as one of the layers the engine of the `Root` around writes. */
function useLayer(layer: EngineLayer): React.RefCallback<HTMLElement> {
    return layerRef(useRootGrid().engine, layer);
}

/** The layers' `transform` is the engine's: a consumer's would move the rows. */
const LAYER_KEYS = ["transform"] as const;

/**
 * A pinned cell's inline start inset (`left`, right to left `right`) is the engine's, and the
 * other insets and a `transform` would let it
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
 * and `rowSpan`, each only over 1 (a render function finds them in its props' `aria-colspan` and
 * `aria-rowspan`, a header cell's in its state too). The same props without.
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
                    summaryHeight(view, "top") +
                    summaryHeight(view, "bottom") +
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
 * then gets `colSpan`/`rowSpan` too (a render function finds them in the state, and in its props'
 * `aria-colspan`/`aria-rowspan`).
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
                [inlineSide(view.direction)]: 0,
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

/**
 * The body (`role="rowgroup"`), the layer the engine moves with the rows, below the header and the
 * top summary rows. A `<tbody>`.
 */
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
                top: view.headerHeight + summaryHeight(view, "top"),
                [inlineSide(view.direction)]: 0,
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

/**
 * A body or summary row cell's element: its part's props with its table span, its content, and,
 * pinned, the engine's inset (sticky, it stays in view sideways).
 */
function useCellElement<State extends { readonly pinned: boolean }>(
    rest: DivPrimitiveProps<State>,
    own: {
        readonly state: State;
        readonly props: Record<string, unknown>;
        readonly columnSpan: number;
    },
    content: ReactNode,
) {
    const { engine } = useRootGrid();
    return useRenderElement("div", rest, {
        state: own.state,
        props: withTableSpans(own.props, rest.render, own.columnSpan),
        children: content,
        ref: own.state.pinned ? layerRef(engine, "pinned") : undefined,
        drop: own.state.pinned ? PINNED_KEYS : undefined,
    });
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
 * A body cell (`role="gridcell"`), positioned in its row. A `<td>` through `render`, which then
 * gets `colSpan` when it spans columns (`aria-colspan`, a column's `colSpan`); a render function
 * finds the span in its props' `aria-colspan` (`<td {...props} colSpan={props["aria-colspan"]} />`).
 * The active cell is the grid's tab stop (`tabIndex` 0, `data-active`); the others take focus on
 * click.
 */
export function Cell<TRow>(props: CellProps<TRow>) {
    const { cell, children, ...rest } = props;
    const own = useCellPart(cell);
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
    return useCellElement(rest, own, content);
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

// ── summary rows (Epic #86) ──────────────────────────────────────────────────

/** The state of a position's summary rows. */
export interface SummaryState {
    readonly position: SummaryPosition;
}

export type SummaryProps = DivPrimitiveProps<SummaryState> & {
    /** under the header (`"top"`), or at the view's bottom edge (`"bottom"`) */
    position: SummaryPosition;
    /** without children, a summary row per row of its position (`DataGrid.SummaryRows`) */
    children?: ReactNode;
};

/**
 * A position's summary rows (`role="rowgroup"`, `data-summary`), sticky: the top ones under the
 * header, the bottom ones at the visible body's bottom edge (right after the last row in a grid
 * shorter than the view). Nothing renders while the grid has none there (`summaryRows` on the
 * root). Its place in the flow is the grid's: the top one after the `Header`, the bottom one last
 * (after `Body` and `Empty`). A `<tbody>` for the top, a `<tfoot>` for the bottom, through
 * `render`. Stacking is the consumer's: give it a background and a `z-index` so rows scroll under
 * it, as the header.
 */
export function Summary(props: SummaryProps) {
    const { position, children = <SummaryRows />, ...rest } = props;
    const view = useGridView();
    const height = summaryHeight(view, position);
    const element = useRenderElement("div", rest, {
        state: { position },
        children: <SummaryContext value={position}>{children}</SummaryContext>,
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "summary", summary: position }),
            // the top ones stick under the header, the bottom ones as far down as the view's
            // bottom edge: a sticky inset's percentage is the scroll container's height, so no
            // measure places them, and the grid's end keeps them right after its last row
            style: {
                position: "sticky",
                top:
                    position === "top"
                        ? view.headerHeight
                        : `calc(100% - ${height}px)`,
                display: "block",
                height,
                boxSizing: "border-box",
            },
        },
    });
    return view.summaryRows[position] > 0 ? element : null;
}

export interface SummaryRowsProps {
    /** renders a summary row; without it, `<DataGrid.SummaryRow row={row} />` */
    children?: (row: SummaryRowInfo) => ReactNode;
    /** whose rows: without it, the `DataGrid.Summary` around's */
    position?: SummaryPosition | undefined;
}

/** A position's summary rows, the first one first. */
export function SummaryRows({ children, position }: SummaryRowsProps) {
    const rows = useSummaryRows(position);
    return rows.map((row) => (
        <Fragment key={row.summaryIndex}>
            {children ? children(row) : <SummaryRow row={row} />}
        </Fragment>
    ));
}

export type SummaryRowProps = DivPrimitiveProps<SummaryRowState> & {
    row: SummaryRowInfo;
    /** without children, `<DataGrid.SummaryCells />` */
    children?: ReactNode;
};

/**
 * A summary row (`role="row"`, `data-summary`), one of the layers the engine moves with the
 * columns, as a header row. A `<tr>`. `data-active` while it holds the active cell.
 */
export function SummaryRow(props: SummaryRowProps) {
    const { row, children = <SummaryCells />, ...rest } = props;
    return useRenderElement("div", rest, {
        ...useSummaryRow(row),
        ref: useLayer("header"),
        drop: LAYER_KEYS,
        children: <SummaryRowContext value={row}>{children}</SummaryRowContext>,
    });
}

export interface SummaryCellsProps<TRow> {
    /** renders a cell; without it, `<DataGrid.SummaryCell cell={cell} />` */
    children?: (cell: SummaryCellInfo<TRow>) => ReactNode;
}

/** The cells of the summary row it is in, for the rendered columns. */
export function SummaryCells<TRow = unknown>({
    children,
}: SummaryCellsProps<TRow>) {
    const cells = useSummaryCells<TRow>();
    return cells.map((cell) => (
        <Fragment key={cell.column.key}>
            {children ? children(cell) : <SummaryCell cell={cell} />}
        </Fragment>
    ));
}

export type SummaryCellProps<TRow> = DivPrimitiveProps<SummaryCellState> & {
    cell: SummaryCellInfo<TRow>;
    /** without children: the column's `renderSummaryCell`, else nothing */
    children?: ReactNode;
};

/**
 * A summary row's cell (`role="gridcell"`, `data-summary`), positioned in its row as a body cell:
 * pinned, spanning (`aria-colspan`, a `td`'s `colSpan`), active and in interaction alike. A
 * `<td>` through `render`. Its content is the app's: the column's `renderSummaryCell`, computed
 * in the app's closure.
 */
export function SummaryCell<TRow>(props: SummaryCellProps<TRow>) {
    const { cell, children, ...rest } = props;
    const own = useSummaryCellPart(cell);
    const { column } = cell;
    const content =
        children !== undefined
            ? children
            : (column.renderSummaryCell?.({
                  position: cell.position,
                  summaryIndex: cell.summaryIndex,
                  column,
                  columnIndex: cell.columnIndex,
              }) ?? null);
    return useCellElement(rest, own, content);
}
