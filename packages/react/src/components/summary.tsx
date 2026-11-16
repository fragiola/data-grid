import { type SummaryPosition, summaryHeight } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { SummaryContext } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import { SUMMARY_LAYER } from "../utils/sticky-layers";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";
import { SummaryRows } from "./summary-rows";

/** The state of a position's summary rows. */
export interface SummaryState {
    readonly position: SummaryPosition;
}

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
    const height = summaryHeight(view, position);
    const element = useRenderElement("div", rest, {
        state: { position },
        children: <SummaryContext value={position}>{children}</SummaryContext>,
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "summary", summary: position }),
            // the top ones stick under the header, the bottom ones as far down as the view's
            // bottom edge: a sticky inset's percentage is the scroll container's height, so no
            // measure places them, and the grid's end keeps them right after its last row
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
    });
    return view.summaryRows[position] > 0 ? element : null;
}
