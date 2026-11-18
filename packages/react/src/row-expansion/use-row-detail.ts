import {
    type RowDetailState,
    rowDetailPartOf,
} from "@fragiola/data-grid/row-expansion";
import type { RowInfo } from "../context";
import type { PartHookResult } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";

/**
 * A row's detail (M3): its state, and the props for its element (render it only while
 * `state.expanded`). It is one cell of its row spanning every column (M4: no row count or index changes),
 * in the row's flow below its cells, sticky at the view's start (the engine writes its `left`),
 * as wide as the visible area.
 */
export function useRowDetail<TRow>(
    row: RowInfo<TRow>,
): PartHookResult<RowDetailState> {
    return rowDetailPartOf(useGridView<TRow>(), row);
}
