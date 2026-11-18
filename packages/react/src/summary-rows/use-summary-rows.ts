import { type SummaryPosition, summaryRowsOf } from "@fragiola/data-grid";
import { useContext, useMemo } from "react";
import { SummaryContext, type SummaryRowInfo } from "../context";

import { useGridView } from "../hooks/use-grid-view";

/**
 * A position's summary rows (Epic #86), the first one first: `position`'s, else the ones of the
 * `DataGrid.Summary` around. None while the grid has none there.
 */
export function useSummaryRows(
    position?: SummaryPosition,
): readonly SummaryRowInfo[] {
    const view = useGridView();
    const around = useContext(SummaryContext);
    const at = position ?? around;
    const { summaryRows, rowCount, header } = view;
    const rows = useMemo(
        () => at && summaryRowsOf({ summaryRows, rowCount, header }, at),
        [summaryRows, rowCount, header, at],
    );
    if (!rows) {
        throw new Error(
            "useSummaryRows() must be given a position, or be used inside <DataGrid.Summary>",
        );
    }
    return rows;
}
