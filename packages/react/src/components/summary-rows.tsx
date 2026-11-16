import type { SummaryPosition } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { SummaryRowInfo } from "../context";
import { useSummaryRows } from "../hooks/use-summary-rows";
import { keyed } from "../utils/keyed";
import { SummaryRow } from "./summary-row";

export interface SummaryRowsProps {
    /** renders a summary row; without it, `<DataGrid.SummaryRow row={row} />` */
    children?: (row: SummaryRowInfo) => ReactNode;
    /** whose rows: without it, the `DataGrid.Summary` around's */
    position?: SummaryPosition | undefined;
}

/** A position's summary rows, the first one first. */
export function SummaryRows({ children, position }: SummaryRowsProps) {
    const rows = useSummaryRows(position);
    return keyed(
        rows,
        (row) => row.summaryIndex,
        children ?? ((row) => <SummaryRow row={row} />),
    );
}
