import {
    type RowDragHandleState,
    rowDragHandlePartOf,
} from "@fragiola/data-grid";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/**
 * A row's drag handle's state and props (Epic #86; React's `useRowDragHandle`).
 * `[dataGridRowDragHandle]` is its directive.
 */
export function injectRowDragHandle(
    row: ValueOrSignal<{
        readonly rowIndex: number;
        readonly loaded: boolean;
    }>,
): PartInjectResult<RowDragHandleState> {
    const view = injectGridView();
    return partResult(() => rowDragHandlePartOf(view(), valueNow(row)));
}
