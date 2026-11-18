import type { ReactNode } from "react";
import { keyed } from "../utils/keyed";
import type { SummaryCellInfo } from "./context";
import { SummaryCell } from "./summary-cell";
import { useSummaryCells } from "./use-summary-cells";

export interface SummaryCellsProps<TRow> {
    /** renders a cell; without it, `<DataGrid.SummaryCell cell={cell} />` */
    children?: (cell: SummaryCellInfo<TRow>) => ReactNode;
}

/** The cells of the summary row it is in, for the rendered columns. */
export function SummaryCells<TRow = unknown>({
    children,
}: SummaryCellsProps<TRow>) {
    const cells = useSummaryCells<TRow>();
    return keyed(
        cells,
        (cell) => cell.column.key,
        children ?? ((cell) => <SummaryCell cell={cell} />),
    );
}
