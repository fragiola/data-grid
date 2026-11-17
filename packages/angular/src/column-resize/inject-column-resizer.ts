import { computed, isSignal } from "@angular/core";
import type { ColumnResizerState } from "@fragiola/data-grid";
import { columnResizerPartOf } from "@fragiola/data-grid/column-resize";
import {
    type HeaderCellInfo,
    injectGridView,
    type PartInjectResult,
    type ValueOrSignal,
} from "@fragiola/data-grid-angular";

/**
 * A column resizer's state and props (Epic #70; React's `useColumnResizer`; `columnResize()`'s
 * since Epic #148): no props under a cell that does not resize. `*dataGridColumnResizer` is its
 * directive.
 */
export function injectColumnResizer<TRow>(
    cell: ValueOrSignal<HeaderCellInfo<TRow>>,
): PartInjectResult<ColumnResizerState> {
    const view = injectGridView<TRow>();
    const result = computed(() =>
        columnResizerPartOf(
            view(),
            isSignal(cell) || typeof cell === "function"
                ? (cell as () => HeaderCellInfo<TRow>)()
                : cell,
        ),
    );
    return {
        state: computed(() => result().state),
        props: computed(() => result().props),
    };
}
