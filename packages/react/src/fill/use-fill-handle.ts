import {
    type FillHandleState,
    fillHandlePartOf,
} from "@fragiola/data-grid/fill";

import type { PartHookResult } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";

/**
 * A fill handle (Epic #88, E4.4): the state and props of an element the app renders in a cell
 * (a cell's info, or its position), visible in the cell at the corner a fill drags from (the
 * selected range's last row and column, else the active cell) while cells fill (`fillHandle()`
 * installed, `onFill` on `DataGrid.Root`) and none is edited. A press on it drags the fill (the engine's, after the
 * app's own `onPointerDown`). The props mark it (`data-grid-fill-handle`,
 * `data-grid-part="fill-handle"`, `data-filling` during a drag); its look, its place at the
 * corner (a cell is positioned), its cursor and `touch-action: none` are the app's: it has no
 * style of its own. Not visible (`state.visible` false), it has no props: render none.
 */
export function useFillHandle(cell: {
    readonly rowIndex: number;
    readonly columnIndex: number;
}): PartHookResult<FillHandleState> {
    return fillHandlePartOf(useGridView(), cell);
}
