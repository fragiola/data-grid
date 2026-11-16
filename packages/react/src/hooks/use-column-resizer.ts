import {
    type ColumnResizerState,
    columnResizerPart,
} from "@fragiola/data-grid";
import type { HeaderCellInfo } from "../context";

import { controlPart, resizerData } from "../utils/control-part";
import type { PartHookResult } from "./internal";
import { useGridView } from "./use-grid-view";

/**
 * A column resizer (Epic #70, W3): the state and props of a handle the app renders inside a
 * header cell (a column's, or a group's, which resizes its columns together). The props make it
 * a vertical separator whose values are widths in pixels, marked for the engine, which drags it,
 * resizes with its arrows and fits its columns to their content on a double click or Enter
 * (Epic #80). `state.width` and `aria-valuenow` are the width on screen. Its place, look and name (`aria-label`)
 * are the app's: it has no style of its own. Under a cell whose columns do not resize
 * (`state.resizable` false) it has no props: render none there.
 */
export function useColumnResizer<TRow>(
    cell: HeaderCellInfo<TRow>,
): PartHookResult<ColumnResizerState> {
    const view = useGridView<TRow>();
    const { state, tabIndex, attributes } = columnResizerPart(view, cell);
    return controlPart(
        state,
        state.resizable ? { ...attributes, tabIndex } : undefined,
        resizerData,
    );
}
