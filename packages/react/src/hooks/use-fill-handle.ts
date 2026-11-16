import { type FillHandleState, fillHandlePart } from "@fragiola/data-grid";

import { controlPart, fillHandleData } from "../utils/control-part";
import type { PartHookResult } from "./internal";
import { useGridView } from "./use-grid-view";

/**
 * A fill handle (Epic #88, E4.4): the state and props of an element the app renders in a cell
 * (a cell's info, or its position), visible in the cell at the corner a fill drags from (the
 * selected range's last row and column, else the active cell) while cells fill (`onFill` on
 * `DataGrid.Root`) and none is edited. A press on it drags the fill (the engine's, after the
 * app's own `onPointerDown`). The props mark it (`data-grid-fill-handle`,
 * `data-grid-part="fill-handle"`, `data-filling` during a drag); its look, its place at the
 * corner (a cell is positioned), its cursor and `touch-action: none` are the app's: it has no
 * style of its own. Not visible (`state.visible` false), it has no props: render none.
 */
export function useFillHandle(cell: {
    readonly rowIndex: number;
    readonly columnIndex: number;
}): PartHookResult<FillHandleState> {
    const view = useGridView();
    const { state, attributes } = fillHandlePart(view, cell);
    return controlPart(state, attributes, fillHandleData);
}
