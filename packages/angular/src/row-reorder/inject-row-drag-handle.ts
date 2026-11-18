import {
    type RowDragHandleState,
    rowDragHandlePartOf,
} from "@fragiola/data-grid/row-reorder";
import {
    injectGridView,
    type PartInjectResult,
    ɵpartResult as partResult,
    type ValueOrSignal,
    ɵvalueNow as valueNow,
} from "@fragiola/data-grid-angular";

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
