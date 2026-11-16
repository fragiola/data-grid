import {
    ariaRowDetail,
    measuredRow,
    type RowDetailState,
    rowDetailPart,
    rowDisplay,
} from "@fragiola/data-grid";
import type { RowInfo } from "../context";
import { DETAIL_AREA } from "../utils/cell-props";
import { inlineSide } from "../utils/inline-side";
import { dataAttributes } from "../utils/use-render";
import type { PartHookResult } from "./internal";
import { useGridView } from "./use-grid-view";

/**
 * A row's detail (M3): its state, and the props for its element (render it only while
 * `state.expanded`). It is one cell of its row spanning every column (M4: no row count or index changes),
 * in the row's flow below its cells, sticky at the view's start (the engine writes its `left`),
 * as wide as the visible area.
 */
export function useRowDetail<TRow>(
    row: RowInfo<TRow>,
): PartHookResult<RowDetailState> {
    const view = useGridView<TRow>();
    const { state, box } = rowDetailPart(view, row.rowIndex);
    if (!box) return { state, props: { style: {} } };
    const flex = rowDisplay(view) === "flex";
    // a measured detail is as tall as its content (Epic #86)
    const height = view.measuredDetails ? {} : { height: box.height };
    return {
        state,
        props: {
            role: "gridcell",
            ...ariaRowDetail(view),
            ...dataAttributes({
                "grid-part": "row-detail",
                "row-index": row.rowIndex,
            }),
            // in a measured row, the area below its cells'
            style: measuredRow(view, row.loaded)
                ? {
                      position: "sticky",
                      display: "block",
                      gridArea: DETAIL_AREA,
                      width: box.width,
                      ...height,
                      boxSizing: "border-box",
                  }
                : {
                      position: "sticky",
                      display: "block",
                      marginTop: box.top,
                      // in a row of pinned cells (flex), from the row's start, never shrunk,
                      // and measured, never stretched to the row's height
                      ...(flex
                          ? {
                                [inlineSide(view.direction, "margin")]:
                                    box.start,
                                flexShrink: 0,
                                ...(view.measuredDetails
                                    ? { alignSelf: "flex-start" }
                                    : {}),
                            }
                          : {}),
                      width: box.width,
                      ...height,
                      boxSizing: "border-box",
                  },
        },
    };
}
