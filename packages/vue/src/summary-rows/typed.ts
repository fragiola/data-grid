import type { DataGridComponent } from "../utils/primitive";
import { Summary, type SummaryProps, type SummarySlots } from "./summary";
import {
    SummaryCell,
    type SummaryCellProps,
    type SummaryCellSlots,
} from "./summary-cell";
import {
    SummaryCells,
    type SummaryCellsProps,
    type SummaryCellsSlots,
} from "./summary-cells";
import {
    SummaryRow,
    type SummaryRowProps,
    type SummaryRowSlots,
} from "./summary-row";
import {
    SummaryRows,
    type SummaryRowsProps,
    type SummaryRowsSlots,
} from "./summary-rows";

/** The summary rows' primitives typed by the row type (their cells' columns, in their slots). */
export interface TypedSummaryRows<TRow> {
    Summary: DataGridComponent<SummaryProps, SummarySlots>;
    SummaryRows: DataGridComponent<SummaryRowsProps, SummaryRowsSlots>;
    SummaryRow: DataGridComponent<SummaryRowProps, SummaryRowSlots>;
    SummaryCells: DataGridComponent<SummaryCellsProps, SummaryCellsSlots<TRow>>;
    SummaryCell: DataGridComponent<SummaryCellProps<TRow>, SummaryCellSlots>;
}

const PARTS = { Summary, SummaryRows, SummaryRow, SummaryCells, SummaryCell };

/**
 * The summary rows' primitives typed by your row type, as `typedDataGrid<TRow>()` types the
 * grid's (a Vue template cannot pass type arguments): the same components.
 */
export function typedSummaryRows<TRow>(): TypedSummaryRows<TRow> {
    return PARTS as unknown as TypedSummaryRows<TRow>;
}
