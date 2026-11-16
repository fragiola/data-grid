import {
    ariaHeaderCellSpans,
    type CellPart,
    type GridView,
    type HeaderCellPart,
    type SummaryCellPart,
} from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { PartHookResult } from "../hooks/internal";
import { inlineSide } from "./inline-side";
import { dataAttributes } from "./use-render";

/**
 * The props a body cell and a header cell share, in one record: the roving tab stop, ARIA,
 * `data-*` and their structural style. A cell that scrolls is positioned in its row (from its
 * inline start); a pinned one is in the row's flow, `sticky`: the browser's scrolling keeps it in
 * place, at the inline start inset the engine writes (it is the engine's, like a layer's
 * transform). In a `measured` row (Epic #86) every cell is in its row's one grid area, at its
 * inline start margin, as tall as the row's tallest cell (no height of its own).
 */
export function cellProps<TRow>(
    view: GridView<TRow, ReactNode>,
    part: CellPart | HeaderCellPart | SummaryCellPart,
    box: {
        readonly left: number;
        readonly width: number;
        readonly height: number;
    },
    measured = false,
): PartHookResult<unknown>["props"] {
    const { state } = part;
    // a header cell's state is the one with a `group` (its sort comes with it), a summary row
    // cell's the one with a `position`
    const header = "group" in state ? state : undefined;
    const summary = "position" in state ? state.position : undefined;
    const ariaSort = "ariaSort" in part ? part.ariaSort : undefined;
    const ariaColSpan = "ariaColSpan" in part ? part.ariaColSpan : undefined;
    // a body or summary row cell's (Epic #88): in the range, its edges, edited
    const ariaSelected = "ariaSelected" in part ? part.ariaSelected : undefined;
    const body = "rangeEdges" in state ? state : undefined;
    const { pinned } = state;
    const { width, height } = box;
    return {
        role: header ? "columnheader" : "gridcell",
        "aria-colindex": state.columnIndex + 1,
        ...(header ? ariaHeaderCellSpans(header) : undefined),
        ...(ariaColSpan ? { "aria-colspan": ariaColSpan } : undefined),
        ...(ariaSort ? { "aria-sort": ariaSort } : undefined),
        ...(ariaSelected === undefined
            ? undefined
            : { "aria-selected": ariaSelected }),
        tabIndex: part.tabIndex,
        ...dataAttributes({
            "grid-part": header
                ? "header-cell"
                : summary
                  ? "summary-cell"
                  : "cell",
            summary,
            "row-index": state.rowIndex,
            "column-index": state.columnIndex,
            loading: "loaded" in state && !state.loaded,
            active: state.active,
            group: header?.group,
            sortable: header?.sortable,
            sort: header?.sortDirection,
            "sort-priority": header?.sortPriority,
            pinned: state.pinnedSide,
            "pinned-edge": state.pinnedEdge,
            interacting: state.interacting,
            resizable: header?.resizable,
            resizing: header?.resizing,
            collapsible: header !== undefined && header.collapsed !== undefined,
            collapsed: header?.collapsed,
            reorderable: header?.reorderable,
            dragging: header?.dragging,
            "drop-target": header?.dropTarget ?? undefined,
            "selected-cell": body?.selected,
            "range-edge": body?.rangeEdges,
            editing: body?.editing,
            "fill-target": body?.fillTarget,
        }),
        style: measured
            ? {
                  position: pinned ? "sticky" : "relative",
                  gridArea: CELLS_AREA,
                  [inlineSide(view.direction, "margin")]: box.left,
                  width,
                  boxSizing: "border-box",
              }
            : pinned
              ? { position: "sticky", width, height, boxSizing: "border-box" }
              : {
                    position: "absolute",
                    top: 0,
                    [inlineSide(view.direction)]: box.left,
                    width,
                    height,
                    boxSizing: "border-box",
                },
    };
}

/** A measured row's grid areas (Epic #86): its cells share the first, its detail the one below. */
export const CELLS_AREA = "1 / 1";
export const DETAIL_AREA = "2 / 1";
