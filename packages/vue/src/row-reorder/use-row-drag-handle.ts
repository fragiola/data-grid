import {
    type RowDragHandleState,
    rowDragHandlePartOf,
} from "@fragiola/data-grid";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { useGridView } from "../context";
import { vueProps } from "../utils/render";
import type { PartComposableResult } from "./internal";

/**
 * A row's drag handle (Epic #86): the state and props of an element the app renders in a row (a
 * cell of it; `row` is a row's or a cell's info), which drags the row once a press on it moves
 * past a click's slop, while the grid's rows move (`onRowMove` on `DataGrid.Root`), it is not
 * sorted and the row is loaded (`state.reorderable`). Its look, cursor and `touch-action: none`
 * are the app's: it has no style of its own.
 */
export function useRowDragHandle(
    row: MaybeRefOrGetter<{
        readonly rowIndex: number;
        readonly loaded: boolean;
    }>,
): PartComposableResult<RowDragHandleState> {
    const view = useGridView();
    const part = computed(() => rowDragHandlePartOf(view.value, toValue(row)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
