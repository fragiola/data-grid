import { type SummaryCellState, summaryCellContent } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { SummaryCellInfo } from "../context";
import { useCellElement, useSummaryCellPart } from "../hooks/internal";
import type { DivPrimitiveProps } from "../utils/use-render";

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
    const content =
        children !== undefined ? children : summaryCellContent(cell);
    return useCellElement(rest, own, content, own.columnSpan, own.measured);
}
