import {
    cellPartProps,
    cellsOf,
    dataAttributes,
    type PartResult,
    rowStyle,
    SUMMARY_LAYER,
} from "../adapter/props";
import { ariaRowIndex, summaryHeight } from "../engine/geometry";
import {
    cellPart,
    type SummaryCellPart,
    type SummaryCellState,
    type SummaryRowState,
} from "../engine/parts";
import type { GridView } from "../engine/types";
import type {
    CellPosition,
    Column,
    SummaryPosition,
    SummaryRowView,
} from "../model/types";

// Summary rows' parts (Epic #86, E2.1; the summary rows feature's since Epic #151): the layers a
// position's rows render in, a row's and a cell's state and props, and what a cell shows. Their
// place in the grid (the row bands, their sticky layers' insets and the body below them) is the
// core's.

/** A summary row's cell, as `DataGrid.SummaryCells` hands it to its children. */
export interface GridSummaryCellInfo<TRow = unknown, TNode = unknown> {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly column: Column<TRow, TNode>;
    readonly position: SummaryPosition;
    readonly summaryIndex: number;
}

/** The state of a position's summary rows. */
export interface SummaryState {
    readonly position: SummaryPosition;
}

/** A summary row's state (E2.1). */
export function summaryRowPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: SummaryRowView,
): { readonly state: SummaryRowState } {
    return {
        state: {
            rowIndex: row.rowIndex,
            position: row.position,
            summaryIndex: row.summaryIndex,
            active: view.active?.rowIndex === row.rowIndex,
        },
    };
}

/**
 * A summary row's cell's state, its `tabIndex` and its `aria-colspan` (E2.1): a body cell's
 * (`cellPart`), on its summary row.
 */
export function summaryCellPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: CellPosition & {
        readonly position: SummaryPosition;
        readonly summaryIndex: number;
    },
): SummaryCellPart {
    const part = cellPart(view, {
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        loaded: true,
    });
    return {
        ...part,
        // a summary row's cells are never selected (Epic #88): the range is the body's
        ariaSelected: undefined,
        state: {
            ...part.state,
            selected: undefined,
            fillTarget: undefined,
            position: cell.position,
            summaryIndex: cell.summaryIndex,
        },
    };
}

/**
 * The cells a summary row renders, with their columns: one per rendered column, but a cell
 * spanning columns (a column's `colSpan` asked with `type: "summary"`) stands for the ones it
 * covers.
 */
export function summaryCellsOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: SummaryRowView,
): GridSummaryCellInfo<TRow, TNode>[] {
    return cellsOf(view, row.rowIndex, (columnIndex, column) => ({
        rowIndex: row.rowIndex,
        columnIndex,
        column,
        position: row.position,
        summaryIndex: row.summaryIndex,
    }));
}

/** A summary row cell's state and props (`useSummaryCell`), with its span (as a body cell's). */
export function summaryCellPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: GridSummaryCellInfo<TRow, TNode>,
): PartResult<SummaryCellState> & { columnSpan: number; measured: boolean } {
    return cellPartProps(
        view,
        summaryCellPart(view, cell),
        cell,
        view.summaryRowHeight,
    );
}

/**
 * A summary row's state and props (Epic #86): ARIA (`role="row"`, its `aria-rowindex` after the
 * header's or the body's rows), `data-summary`, and its structural style in its summary (from
 * `rowLeft`, a summary row tall; a flex container with pinned columns, as a body row).
 */
export function summaryRowPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: SummaryRowView,
): PartResult<SummaryRowState> {
    const { state } = summaryRowPart(view, row);
    return {
        state,
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, row.rowIndex),
            ...dataAttributes({
                "grid-part": "summary-row",
                summary: row.position,
                "row-index": row.rowIndex,
                active: state.active,
            }),
            style: rowStyle(
                view,
                row.summaryIndex * view.summaryRowHeight,
                view.summaryRowHeight,
            ),
        },
    };
}

/**
 * A position's summary rows' state and props, sticky: the top ones under the header, the bottom
 * ones as far down as the view's bottom edge (a sticky inset's percentage is the scroll
 * container's height, so no measure places them).
 */
export function summaryPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    position: SummaryPosition,
): PartResult<SummaryState> {
    const height = summaryHeight(view, position);
    return {
        state: { position },
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "summary", summary: position }),
            style: {
                position: "sticky",
                top:
                    position === "top"
                        ? view.headerHeight
                        : `calc(100% - ${height}px)`,
                // above the rows scrolling under them, below the header (E5.2)
                zIndex: SUMMARY_LAYER,
                display: "block",
                height,
                boxSizing: "border-box",
            },
        },
    };
}

/** What a summary row's cell shows by default: its column's `renderSummaryCell`, else nothing. */
export function summaryCellContent<TRow, TNode>(
    cell: GridSummaryCellInfo<TRow, TNode>,
): TNode | null {
    const { column } = cell;
    return (
        column.renderSummaryCell?.({
            position: cell.position,
            summaryIndex: cell.summaryIndex,
            column,
            columnIndex: cell.columnIndex,
        }) ?? null
    );
}
