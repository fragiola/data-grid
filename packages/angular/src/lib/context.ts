import { InjectionToken, inject, type Signal } from "@angular/core";
import type {
    CellRenderProps,
    ColumnOrGroup,
    DataGridEngine,
    DataGridModel,
    EditDraft,
    GridCellInfo,
    GridHandle,
    GridRowInfo,
    GridSummaryCellInfo,
    GridView,
    HeaderCellLayout,
    HeaderRowView,
    SummaryPosition,
    SummaryRowView,
} from "@fragiola/data-grid";
import type { DataGridNode } from "./utils/content";

/** What `injectDataGrid()` returns: the grid's model and its engine (column renderers return nodes). */
export interface DataGridContextValue<TRow = unknown> {
    readonly model: DataGridModel<TRow, DataGridNode>;
    readonly engine: DataGridEngine<TRow, DataGridNode>;
}

/**
 * A handle on a grid from outside its `[dataGridRoot]`: `current` is the grid's model and engine
 * while a root holds it (`<div dataGridRoot [gridRef]="gridRef">`), `null` otherwise. It tells when
 * that changes, so the injection functions take it (`injectRowWindow(gridRef)`,
 * `injectDataGrid(gridRef)`) and follow the grid from anywhere.
 */
export type DataGridRef<TRow = unknown> = GridHandle<
    DataGridContextValue<TRow>
>;

/** A body row, as `[dataGridRows]` hands it to its template. */
export type RowInfo<TRow = unknown> = GridRowInfo<TRow>;

/** A body cell, as `[dataGridCells]` hands it to its template: its renderers return nodes. */
export type CellInfo<TRow = unknown> = GridCellInfo<TRow, DataGridNode>;

/**
 * A header cell, as `[dataGridHeaderCells]` hands it to its template: a group (`group`) or a
 * column (`column`), its row, its first column and its spans.
 */
export type HeaderCellInfo<TRow = unknown> = HeaderCellLayout<
    TRow,
    DataGridNode
>;

/** A header row, as `[dataGridHeaderRows]` hands it to its template: its index and its cells. */
export type HeaderRowInfo<TRow = unknown> = HeaderRowView<TRow, DataGridNode>;

/**
 * A summary row (Epic #86), as `[dataGridSummaryRows]` hands it to its template: its row index,
 * its position and its index among its position's rows.
 */
export type SummaryRowInfo = SummaryRowView;

/** A summary row's cell, as `[dataGridSummaryCells]` hands it to its template. */
export type SummaryCellInfo<TRow = unknown> = GridSummaryCellInfo<
    TRow,
    DataGridNode
>;

/** A body cell's render props in Angular: what a column's `renderCell` receives. */
export type CellTemplateProps<TRow = unknown> = CellRenderProps<
    TRow,
    DataGridNode
>;

/**
 * What types a template directive's context by the row type: nothing (any row), the root
 * (`#grid="dataGridRoot"`, then `[dataGridRows]="grid"`) or the columns (`[dataGridRows]="columns"`).
 */
export type TypedBy<TRow> =
    | { readonly columns: Signal<readonly ColumnOrGroup<TRow, DataGridNode>[]> }
    | readonly ColumnOrGroup<TRow, DataGridNode>[]
    | ""
    | undefined;

/** What a `[dataGridRoot]` gives the parts inside it. */
export interface GridContext {
    readonly model: DataGridModel<unknown, DataGridNode>;
    readonly engine: DataGridEngine<unknown, DataGridNode>;
    /** the view: a part follows it (a new window, new sizes), never a scroll frame (D9) */
    readonly view: Signal<GridView<unknown, DataGridNode>>;
    /** the edit's draft (Epic #88): read only by the cell being edited */
    readonly draft: Signal<EditDraft | null>;
}

/** @internal */
export const GRID_CONTEXT = new InjectionToken<GridContext>("DataGridContext");

/** The row a part is in (`[dataGridCells]`, `*dataGridRowDetail`). */
export interface RowContext {
    readonly rowInfo: Signal<RowInfo>;
}

/** @internal `null` from a root: a grid nested in a cell is not in the outer grid's rows */
export const DATA_GRID_ROW = new InjectionToken<RowContext | null>(
    "DataGridRow",
);

/** The header row a part is in (`[dataGridHeaderCells]`). */
export interface HeaderRowContext {
    readonly headerRow: Signal<HeaderRowInfo | undefined>;
}

/** @internal */
export const DATA_GRID_HEADER_ROW = new InjectionToken<HeaderRowContext | null>(
    "DataGridHeaderRow",
);

/** The summary rows' position a part is in (`[dataGridSummaryRows]`). */
export interface SummaryContext {
    readonly position: Signal<SummaryPosition>;
}

/** @internal */
export const DATA_GRID_SUMMARY = new InjectionToken<SummaryContext | null>(
    "DataGridSummary",
);

/** The summary row a part is in (`[dataGridSummaryCells]`). */
export interface SummaryRowContext {
    readonly summaryRow: Signal<SummaryRowInfo>;
}

/** @internal */
export const DATA_GRID_SUMMARY_ROW =
    new InjectionToken<SummaryRowContext | null>("DataGridSummaryRow");

/** The cell a part is in: what `*dataGridCellContent` renders, its edit's cell. */
export interface CellContext {
    /** the cell's default content: its column's renderer, its value as text, or its editor */
    readonly content: Signal<DataGridNode>;
    /** a body cell's info (`null` in a header or a summary cell) */
    readonly bodyCell: Signal<CellInfo | null>;
}

/** @internal */
export const DATA_GRID_CELL = new InjectionToken<CellContext>("DataGridCell");

/** Whether the grid is a `<table>`: its empty state takes a table's structure. */
export interface TableContext {
    readonly table: boolean;
}

/** @internal */
export const DATA_GRID_TABLE = new InjectionToken<TableContext>(
    "DataGridTable",
);

/** @internal The root around a part; throws outside one (`part` names it). */
export function injectGrid(part: string): GridContext {
    const grid = inject(GRID_CONTEXT, { optional: true });
    if (!grid) {
        throw new Error(`${part} must be used inside [dataGridRoot]`);
    }
    return grid;
}

/** @internal The row around a part; throws outside one. */
export function injectRowContext(part: string): RowContext {
    const row = inject(DATA_GRID_ROW, { optional: true });
    if (!row) {
        throw new Error(`${part} must be used inside [dataGridRow]`);
    }
    return row;
}
