import { computed, isSignal } from "@angular/core";
import {
    type FillHandleState,
    fillHandlePartOf,
} from "@fragiola/data-grid/fill";
import {
    injectGridView,
    type PartInjectResult,
    type ValueOrSignal,
} from "@fragiola/data-grid-angular";

/**
 * A fill handle's state and props (Epic #88, E4.4; React's `useFillHandle`): visible in the cell
 * at the corner a fill drags from, while cells fill (`fillHandle()` installed, `dataGridFill` on
 * the root) and none is edited. `*dataGridFillHandle` is its directive.
 */
export function injectFillHandle(
    cell: ValueOrSignal<{
        readonly rowIndex: number;
        readonly columnIndex: number;
    }>,
): PartInjectResult<FillHandleState> {
    const view = injectGridView();
    const result = computed(() =>
        fillHandlePartOf(
            view(),
            isSignal(cell) || typeof cell === "function"
                ? (cell as () => { rowIndex: number; columnIndex: number })()
                : cell,
        ),
    );
    return {
        state: computed(() => result().state),
        props: computed(() => result().props),
    };
}
