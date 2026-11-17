import { type FillHandleState, fillHandlePartOf } from "@fragiola/data-grid";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/**
 * A fill handle's state and props (Epic #88, E4.4; React's `useFillHandle`): visible in the cell
 * at the corner a fill drags from. `*dataGridFillHandle` is its directive.
 */
export function injectFillHandle(
    cell: ValueOrSignal<{
        readonly rowIndex: number;
        readonly columnIndex: number;
    }>,
): PartInjectResult<FillHandleState> {
    const view = injectGridView();
    return partResult(() => fillHandlePartOf(view(), valueNow(cell)));
}
