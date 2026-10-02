import {
    ariaRowCount,
    type EngineLayer,
    renderedWidth,
} from "@fragiola/data-grid";
import type * as React from "react";
import { type ReactNode, useCallback, useLayoutEffect } from "react";
import {
    type CellInfo,
    type HeaderCellInfo,
    RowContext,
    type RowInfo,
    useDataGrid,
    useRowContext,
} from "./context";
import {
    type CellState,
    type HeaderCellState,
    type RowState,
    useCell,
    useCells,
    useGridView,
    useHeaderCell,
    useHeaderCells,
    useRow,
    useRows,
} from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export { Root, type RootProps, type RootState } from "./Root";

/** A ref that registers an element as one of the layers the engine writes. */
function useLayer(layer: EngineLayer): React.RefCallback<HTMLElement> {
    const { engine } = useDataGrid();
    return useCallback(
        (element: HTMLElement | null) =>
            element ? engine.adapter.registerLayer(layer, element) : undefined,
        [engine, layer],
    );
}

type LayerStyle<State> = DivPrimitiveProps<State>["style"];

/**
 * A layer's props without a `transform` in their style: the engine writes the layer's transform
 * itself, after every commit, so a consumer's would hide the rows.
 */
function withoutTransform<
    P extends { style?: LayerStyle<Record<string, never>> },
>(props: P): P {
    const { style } = props;
    if (style === undefined) return props;
    const strip = (value: React.CSSProperties | undefined) => {
        if (!value || !("transform" in value)) return value;
        const { transform: _, ...rest } = value;
        return rest;
    };
    return {
        ...props,
        style:
            typeof style === "function"
                ? (state: Record<string, never>) => strip(style(state))
                : strip(style),
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
    const { engine } = useDataGrid();
    const view = useGridView();
    // the view is on screen: the engine writes the layers' offsets for it and moves focus
    useLayoutEffect(() => {
        engine.adapter.commit(view);
    }, [engine, view]);
    const empty = view.rowCount === 0;
    return useRenderElement("div", rest, {
        state: { rowCount: view.rowCount, columnCount: view.columnCount },
        ref: useLayer("grid"),
        props: {
            role: "grid",
            "aria-rowcount": ariaRowCount(view),
            "aria-colcount": view.columnCount,
            tabIndex: view.active ? -1 : 0,
            ...dataAttributes({ "grid-part": "grid", empty }),
            children,
        },
        style: {
            position: "relative",
            display: "block",
            // without rows, the sizer still spans the visible area: the empty state has room
            width: empty
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
    });
}

// ── the header ───────────────────────────────────────────────────────────────

export type HeaderProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/**
 * The header (`role="rowgroup"`): sticky at the viewport's top, as tall as the header row. A
 * `<thead>` through `render`. Nothing renders without a header row. Stacking is the consumer's:
 * give it a background and a `z-index` so rows scroll under it.
 */
export function Header(props: HeaderProps) {
    const { children = <HeaderRow />, ...rest } = props;
    const view = useGridView();
    const element = useRenderElement("div", rest, {
        state: {},
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "header" }),
            children,
        },
        style: {
            position: "sticky",
            top: 0,
            display: "block",
            height: view.headerHeight,
            boxSizing: "border-box",
        },
    });
    return view.headerRowCount > 0 ? element : null;
}

export type HeaderRowProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/** The header row (`role="row"`), the layer the engine moves with the columns. A `<tr>`. */
export function HeaderRow(props: HeaderRowProps) {
    const { children = <HeaderCells />, ...rest } = withoutTransform(props);
    const view = useGridView();
    return useRenderElement("div", rest, {
        state: {},
        ref: useLayer("header"),
        props: {
            role: "row",
            "aria-rowindex": 1,
            ...dataAttributes({ "grid-part": "header-row" }),
            children,
        },
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: renderedWidth(view),
            height: view.headerHeight,
            boxSizing: "border-box",
        },
    });
}

export interface HeaderCellsProps<TRow> {
    /** renders a header cell; without it, `<DataGrid.HeaderCell cell={cell} />` */
    children?: (cell: HeaderCellInfo<TRow>) => ReactNode;
}

/** The header cells of the rendered columns (the column window, plus the active column). */
export function HeaderCells<TRow = unknown>({
    children,
}: HeaderCellsProps<TRow>) {
    const cells = useHeaderCells<TRow>();
    return cells.map((cell) => (
        <HeaderCellSlot key={cell.column.key}>
            {children ? children(cell) : <HeaderCell cell={cell} />}
        </HeaderCellSlot>
    ));
}

function HeaderCellSlot({ children }: { children: ReactNode }) {
    return children;
}

export type HeaderCellProps<TRow> = DivPrimitiveProps<HeaderCellState> & {
    cell: HeaderCellInfo<TRow>;
    /** without children: the column's `renderHeaderCell`, else its `name` */
    children?: ReactNode;
};

/** A header cell (`role="columnheader"`). A `<th>` through `render`. */
export function HeaderCell<TRow>(props: HeaderCellProps<TRow>) {
    const { cell, children, ...rest } = props;
    const { state, props: own } = useHeaderCell(cell);
    const { style, ...cellProps } = own;
    const content =
        children !== undefined
            ? children
            : cell.column.renderHeaderCell
              ? cell.column.renderHeaderCell({
                    column: cell.column,
                    columnIndex: cell.columnIndex,
                })
              : cell.column.name;
    return useRenderElement("div", rest, {
        state,
        props: { ...cellProps, children: content },
        style,
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
        props: {
            ...dataAttributes({ "grid-part": "empty" }),
            children,
        },
        style: {
            position: "sticky",
            left: 0,
            display: "block",
            width: view.viewportWidth,
            height: view.viewportBodyHeight,
            boxSizing: "border-box",
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
    const { children = <Rows />, ...rest } = withoutTransform(props);
    const view = useGridView();
    return useRenderElement("div", rest, {
        state: {},
        ref: useLayer("body"),
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "body" }),
            children,
        },
        style: {
            position: "absolute",
            top: view.headerHeight,
            left: 0,
            boxSizing: "border-box",
        },
    });
}

export interface RowsProps<TRow> {
    /** renders a row; without it, `<DataGrid.Row row={row} />` */
    children?: (row: RowInfo<TRow>) => ReactNode;
}

/** The rendered rows (the row window, plus the active row), in order. */
export function Rows<TRow = unknown>({ children }: RowsProps<TRow>) {
    const { model } = useDataGrid();
    const keyed = model.state.rowKey !== undefined;
    const rows = useRows<TRow>();
    return rows.map((row) => (
        // keyed by the app's keys when it gives some (a row not loaded yet has none: its index),
        // else by index, so a row loading in place keeps its elements (and focus); the prefixes
        // keep a key and an index apart
        <RowSlot key={keyed && row.loaded ? `k${row.key}` : `i${row.rowIndex}`}>
            {children ? children(row) : <Row row={row} />}
        </RowSlot>
    ));
}

function RowSlot({ children }: { children: ReactNode }) {
    return children;
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
    const { state, props: own } = useRow(row);
    const { style, ...rowProps } = own;
    const element = useRenderElement("div", rest, {
        state,
        props: { ...rowProps, children },
        style,
    });
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
        <CellSlot key={cell.column.key}>
            {children ? children(cell) : <Cell cell={cell} />}
        </CellSlot>
    ));
}

function CellSlot({ children }: { children: ReactNode }) {
    return children;
}

/** A value rendered as text when the cell has no children and its column no `renderCell`. */
function plain(value: unknown): ReactNode {
    return typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "bigint"
        ? String(value)
        : typeof value === "boolean"
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
    const { state, props: own } = useCell(cell);
    const { style, ...cellProps } = own;
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
        state,
        props: { ...cellProps, children: content },
        style,
    });
}
