import { PINNED_KEYS, type RowDetailState } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { useRowContext } from "../context";
import { useLayer } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";
import { useRowDetail } from "../hooks/use-row-detail";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { withTableSpans } from "../utils/with-table-spans";

export type RowDetailProps = DivPrimitiveProps<RowDetailState> & {
    /** what the detail holds: another grid, a summary, controls (the app's own content) */
    children?: ReactNode;
};

/**
 * An expanded row's detail (M3): inside its `Row`, after its cells, below the row's own height;
 * as wide as the visible area and in view while the grid scrolls sideways (sticky, the engine
 * writes its `left`). It renders only while its row is expanded (`expanded-rows.toggle`, the
 * row's `data-expanded`), and holds only its children: no text and no names. One cell of its row
 * spanning every column (`role="gridcell"`). Its keys and focus are its content's, never the
 * grid's: a grid inside it is its own grid. A `<td>` through `render`, which then gets `colSpan`.
 */
export function RowDetail(props: RowDetailProps) {
    const { children, ...rest } = props;
    const own = useRowDetail(useRowContext("RowDetail"));
    const { columnCount } = useGridView();
    const element = useRenderElement("div", rest, {
        state: own.state,
        props: withTableSpans(own.props, rest.render, columnCount),
        children,
        ref: useLayer("detail"),
        // its inset is the engine's, and the other insets would move it from its place
        drop: PINNED_KEYS,
    });
    return own.state.expanded ? element : null;
}
