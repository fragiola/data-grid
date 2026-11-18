import {
    type GroupToggleState,
    groupTogglePartOf,
    type RowMeta,
} from "@fragiola/data-grid";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

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
