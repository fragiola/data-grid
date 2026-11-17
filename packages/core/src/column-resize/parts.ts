import { controlPart, type PartResult } from "../adapter/props";
import { COLUMN_RESIZER_ATTRIBUTE } from "../engine/dom";
import { columnSide } from "../engine/geometry";
import type { ColumnResizerPart, ColumnResizerState } from "../engine/parts";
import type { GridView } from "../engine/types";
import type { HeaderCellLayout, PinnedSide } from "../model/types";
import type { ColumnResizeView } from "./types";
import {
    resizeMaximum,
    type SpanWidths,
    spanResizable,
    spanWidths,
} from "./widths";

// A column resizer's part (Epic #70, W3; resizing's since Epic #148): the handle the app renders
// in a resizable header cell, as a pure function of a view, and its props for the adapters'
// resizer hooks (`useColumnResizer`).

/**
 * The edge of a header cell a resize moves (E1.1), by its column's part (`columnPart`): a column
 * pinned at the end grows from its start edge (toward the start), every other one from its end.
 * What the drag and keys and a resizer's state both read.
 */
export function resizeEdge(part: PinnedSide | undefined): "start" | "end" {
    return part === "end" ? "start" : "end";
}

/**
 * The state and attributes of the resizer in a header cell (W3): its column's, or for a group's
 * cell its columns' together (W5).
 */
export function columnResizerPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): ColumnResizerPart {
    const resizable = spanResizable(view.columnDefs, cell);
    const axis = view.columnAxis;
    // a cell whose columns do not resize is its width, with nothing to move within
    let span: SpanWidths;
    if (resizable) span = spanWidths(view.columnDefs, axis, cell);
    else {
        const fixed =
            axis.offsetOf(cell.columnIndex + cell.columnSpan) -
            axis.offsetOf(cell.columnIndex);
        span = { width: fixed, minWidth: fixed, maxWidth: fixed };
    }
    const { width, minWidth, maxWidth } = span;
    const pinnedSide = columnSide(view, cell.columnIndex);
    // its engine's field, on the view by name (none before an engine laid out)
    const resize = (view as GridView<TRow, TNode> & Partial<ColumnResizeView>)
        .columnResize;
    return {
        state: {
            columnKey: cell.key,
            resizable,
            resizing: resize?.columnKey === cell.key,
            width,
            minWidth,
            maxWidth,
            edge: resizeEdge(pinnedSide),
        },
        tabIndex: 0,
        attributes: {
            role: "separator",
            "aria-orientation": "vertical",
            "aria-valuenow": width,
            "aria-valuemin": minWidth,
            "aria-valuemax": resizeMaximum(span, view.viewportWidth),
            [COLUMN_RESIZER_ATTRIBUTE]: cell.key,
        },
    };
}

const resizerData = (state: ColumnResizerState) => ({
    "grid-part": "column-resizer",
    resizing: state.resizing,
});

/** A column resizer's state and props (`useColumnResizer`): none under a cell that does not resize. */
export function columnResizerPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: HeaderCellLayout<TRow, TNode>,
): PartResult<ColumnResizerState> {
    const { state, tabIndex, attributes } = columnResizerPart(view, cell);
    return controlPart(
        state,
        state.resizable ? { ...attributes, tabIndex } : undefined,
        resizerData,
    );
}
