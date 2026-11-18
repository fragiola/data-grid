import type { SummaryPosition } from "@fragiola/data-grid";
import {
    type SummaryState,
    summaryPartOf,
} from "@fragiola/data-grid/summary-rows";
import type { ReactNode } from "react";
import { SummaryContext } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { SummaryRows } from "./summary-rows";

export type { SummaryState } from "@fragiola/data-grid/summary-rows";

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
 * `render`. Above the rows scrolling under it and below the header (a structural `z-index`); its
 * background is the consumer's, as the header's.
 */
export function Summary(props: SummaryProps) {
    const { position, children = <SummaryRows />, ...rest } = props;
    const view = useGridView();
    const element = useRenderElement("div", rest, {
        ...summaryPartOf(view, position),
        children: <SummaryContext value={position}>{children}</SummaryContext>,
    });
    return view.summaryRows[position] > 0 ? element : null;
}
