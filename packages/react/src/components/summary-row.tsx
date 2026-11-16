import { LAYER_KEYS, type SummaryRowState } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { SummaryRowContext, type SummaryRowInfo } from "../context";
import { useLayer } from "../hooks/internal";
import { useSummaryRow } from "../hooks/use-summary-row";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { SummaryCells } from "./summary-cells";

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
