import type { RowMeta } from "@fragiola/data-grid";
import {
    type GroupToggleState,
    groupTogglePartOf,
} from "@fragiola/data-grid/row-grouping";
import {
    injectGridView,
    type PartInjectResult,
    ɵpartResult as partResult,
    type ValueOrSignal,
    ɵvalueNow as valueNow,
} from "@fragiola/data-grid-angular";

/**
 * A row group's toggle's state and props (Epic #87; React's `useGroupToggle`): no props under a
 * row that does not expand. `*dataGridGroupToggle` is its directive.
 */
export function injectGroupToggle(
    row: ValueOrSignal<{
        readonly rowIndex: number;
        readonly meta?: RowMeta | undefined;
    }>,
): PartInjectResult<GroupToggleState> {
    const view = injectGridView();
    return partResult(() => groupTogglePartOf(view(), valueNow(row)));
}
