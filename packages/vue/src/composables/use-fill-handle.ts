import { type FillHandleState, fillHandlePartOf } from "@fragiola/data-grid";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { useGridView } from "../context";
import { vueProps } from "../utils/render";
import type { PartComposableResult } from "./internal";

/**
 * A fill handle (Epic #88, E4.4): the state and props of an element the app renders in a cell
 * (a cell's info, or its position), visible in the cell at the corner a fill drags from while
 * cells fill (`onFill` on `DataGrid.Root`) and none is edited. Its look, place at the corner, cursor
 * and `touch-action: none` are the app's. Not visible (`state.visible` false), it has no props.
 */
export function useFillHandle(
    cell: MaybeRefOrGetter<{
        readonly rowIndex: number;
        readonly columnIndex: number;
    }>,
): PartComposableResult<FillHandleState> {
    const view = useGridView();
    const part = computed(() => fillHandlePartOf(view.value, toValue(cell)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
